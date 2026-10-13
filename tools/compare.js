#!/usr/bin/env node
// Behaviour-equivalence check for refactors.
//
// Runs two versions of a game page side by side in Node VM contexts with the
// same seeded Math.random and the same scripted player, records a semantic log
// of every canvas draw (with its resolved transform and style, so save/restore
// shuffles and equivalent maths don't count as differences), and compares the
// two frame by frame. localStorage writes are compared too. A scripted player
// drives menus, the high-score box, the campaign map, save + app-kill + relaunch,
// and (with --skilled) chases falling poops so stacks get finished and levels climb.
//
//   node tools/compare.js                      # HEAD vs working tree, both pages
//   node tools/compare.js --old main~3 --page campaign --frames 40000 --seeds 1,2,3
//   node tools/compare.js --old /some/dir --new /other/dir
//   node tools/compare.js --old . --hz 120    # same game on a 120 Hz screen?
//
// --old takes a git ref (exported with `git archive`) or a directory; --new
// defaults to this checkout. Exits non-zero on any difference, printing the
// first differing draw call. Expect a run to fail if you change gameplay or
// visuals on purpose; that's the point.
//
// The campaign player peeks at the level state through `let L = null;` in the
// page script (read only), so keep that declaration if you want --skilled to
// keep working there.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'),
      os = require('os'), { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PAGES = { endless: 'wombat-poop.html', campaign: 'wombat-campaign.html' };

function parseArgs(argv){
  const o = { old: 'HEAD', new: ROOT, page: 'both', frames: 20000, seeds: [1,2], skilled: null, hz: 60 };
  for(let i=0;i<argv.length;i++){
    const a = argv[i], v = () => argv[++i];
    if(a === '--old') o.old = v();
    else if(a === '--new') o.new = path.resolve(v());
    else if(a === '--page') o.page = v();
    else if(a === '--frames') o.frames = +v();
    else if(a === '--seeds') o.seeds = v().split(',').map(Number);
    else if(a === '--hz') o.hz = +v();
    else if(a === '--skilled') o.skilled = true;
    else if(a === '--casual') o.skilled = false;
    else { console.error('unknown option ' + a); process.exit(2); }
  }
  if(!(o.hz >= 60 && o.hz % 60 === 0)){ console.error('--hz must be a multiple of 60'); process.exit(2); }
  if(o.page !== 'both' && !PAGES[o.page]){ console.error('--page must be endless, campaign or both'); process.exit(2); }
  return o;
}

// a directory as-is, or a git ref exported to a temp directory
function resolveVersion(spec){
  if(fs.existsSync(spec) && fs.statSync(spec).isDirectory()) return path.resolve(spec);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wombat-compare-'));
  const tar = execFileSync('git', ['-C', ROOT, 'archive', spec], { maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  return dir;
}

function scriptsOf(dir, file){
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const out = [];
  const re = /<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g;
  let m;
  while((m = re.exec(html))){
    if(m[1]) out.push({ name: m[1], code: fs.readFileSync(path.join(dir, m[1].split('?')[0]), 'utf8') });
    // controller-only peephole into the campaign's level state (read, never written)
    else out.push({ name: file + ':inline', code: m[2].replace(/let L = null;/, 'let L = null; globalThis.__L = () => L;') });
  }
  return out;
}

const r6 = v => { if(typeof v !== 'number') return v; const x = Math.round(v*1e4)/1e4; return Object.is(x,-0) ? 0 : x; };

function makeCtx(log){
  let st = { m:[1,0,0,1,0,0], fillStyle:'#000', strokeStyle:'#000', globalAlpha:1, lineWidth:1,
             lineCap:'butt', font:'10px sans-serif', textAlign:'start', dash:[], dashOffset:0 };
  const stack = [];
  let path = [];
  const M = () => st.m.map(r6).join(',');
  const style = s => (s && s.grad) ? 'grad(' + s.grad.map(r6) + '|' + s.stops.join(';') + ')' : String(s);
  const draw = (op, extra) => log.push([op, extra, 'a=' + r6(st.globalAlpha)].join(' '));
  const strokeState = () => `ss=${style(st.strokeStyle)} lw=${r6(st.lineWidth)} cap=${st.lineCap}` +
      (st.dash.length ? ` dash=${st.dash} off=${r6(st.dashOffset)}` : '');
  const ctx = {
    save(){ stack.push({ ...st, m: st.m.slice(), dash: st.dash.slice() }); },
    restore(){ if(stack.length) st = stack.pop(); },
    setTransform(a,b,c,d,e,f){ st.m = [a,b,c,d,e,f]; },
    translate(x,y){ const m = st.m; m[4] += m[0]*x + m[2]*y; m[5] += m[1]*x + m[3]*y; },
    scale(x,y){ const m = st.m; m[0]*=x; m[1]*=x; m[2]*=y; m[3]*=y; },
    rotate(r){ const m = st.m, c = Math.cos(r), s = Math.sin(r);
      const [a,b,cc,d] = m; m[0] = a*c + cc*s; m[1] = b*c + d*s; m[2] = -a*s + cc*c; m[3] = -b*s + d*c; },
    beginPath(){ path = []; },
    moveTo(...a){ path.push('M' + a.map(r6) + '@' + M()); },
    lineTo(...a){ path.push('L' + a.map(r6) + '@' + M()); },
    arc(...a){ path.push('A' + a.map(r6) + '@' + M()); },
    arcTo(...a){ path.push('T' + a.map(r6) + '@' + M()); },
    ellipse(...a){ path.push('E' + a.map(r6) + '@' + M()); },
    closePath(){ path.push('Z'); },
    fill(){ draw('fill', `fs=${style(st.fillStyle)} ${path.join(' ')}`); },
    stroke(){ draw('stroke', `${strokeState()} ${path.join(' ')}`); },
    clip(){ draw('clip', path.join(' ')); },
    fillRect(...a){ draw('fillRect', `fs=${style(st.fillStyle)} ${a.map(r6)}@${M()}`); },
    clearRect(...a){ draw('clearRect', `${a.map(r6)}@${M()}`); },
    fillText(txt,x,y){ draw('fillText', `fs=${style(st.fillStyle)} font=${st.font} al=${st.textAlign==='start'?'left':st.textAlign} "${txt}" ${r6(x)},${r6(y)}@${M()}`); },
    strokeText(txt,x,y){ draw('strokeText', `${strokeState()} font=${st.font} al=${st.textAlign==='start'?'left':st.textAlign} "${txt}" ${r6(x)},${r6(y)}@${M()}`); },
    createLinearGradient(...a){ const g = { grad:a, stops:[], addColorStop(o,c){ g.stops.push(o+':'+c); } }; return g; },
    setLineDash(d){ st.dash = d.slice(); },
  };
  for(const k of ['fillStyle','strokeStyle','globalAlpha','lineWidth','lineCap','font','textAlign'])
    Object.defineProperty(ctx, k, { get(){ return st[k]; }, set(v){ st[k] = k==='font' ? String(v).replace(/,\s+/g, ',') : v; } });
  Object.defineProperty(ctx, 'lineDashOffset', { get(){ return st.dashOffset; }, set(v){ st.dashOffset = v; } });
  return ctx;
}

function seeded(seed){   // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function boot(dir, page, storage, seed){
  const log = [];
  const winL = {}, docL = {};
  const el = (id) => {
    const o = { id, style:{}, value:'', textContent:'', listeners:{},
      addEventListener(k,f){ (o.listeners[k] = o.listeners[k] || []).push(f); },
      focus(){}, select(){} };
    return o;
  };
  const els = {};
  const canvas = Object.assign(el('game'), { width:720, height:960,
    getContext(){ return canvas.ctx || (canvas.ctx = makeCtx(log)); },
    getBoundingClientRect(){ return { left:0, top:0, width:720, height:960 }; } });
  els.game = canvas;
  els.wrap = Object.assign(el('wrap'), { clientWidth:720, clientHeight:960 });
  const document = {
    getElementById(id){ return els[id] || (els[id] = el(id)); },
    addEventListener(k,f){ (docL[k] = docL[k] || []).push(f); }, hidden:false };
  let raf = null, clock = 0;
  const sandbox = {
    document, devicePixelRatio:1, console,
    localStorage: { getItem:k => k in storage ? storage[k] : null, setItem:(k,v)=>{ storage[k] = String(v); },
                    removeItem:k => { delete storage[k]; } },
    requestAnimationFrame(f){ raf = f; }, setTimeout(f){ f(); },
    addEventListener(k,f){ (winL[k] = winL[k] || []).push(f); },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext('Math.random = __rng;', Object.assign(sandbox, { __rng: seeded(seed) }));
  // Kick off on the first step rather than at load: both versions call loop()
  // synchronously at the end of their script.
  for(const s of scriptsOf(dir, page)) vm.runInContext(s.code, sandbox, { filename: s.name });
  const fire = (target, k, e) => (target[k] || []).forEach(f => f(e));
  return {
    log, els, sandbox,
    frame(ms = 1000/60){ log.length = 0; clock += ms; const f = raf; raf = null; f(clock); return log.slice(); },
    key(type, key){ fire(winL, type, { key, preventDefault(){} }); },
    mouse(type, x, y){ fire(canvas.listeners, type, { clientX:x, clientY:y }); },
    touch(type, x, y){ fire(canvas.listeners, type, { touches:[{ clientX:x, clientY:y }], preventDefault(){} }); },
    click(id){ fire(els[id].listeners, 'click', {}); },
    elKey(id, key){ fire(els[id].listeners, 'keydown', { key, stopPropagation(){} }); },
    hide(){ fire(docL, 'visibilitychange'); fire(winL, 'pagehide'); },
  };
}

// ----- input controller: reads the (old) frame log, decides the next input -----
function findAll(log, re){ const out = []; for(const l of log){ const m = re.exec(l); if(m) out.push(m); } return out; }
function wombatX(log){
  // the player's headband dot (#e74c3c arc, radius 7) — world x via the transform's e
  const m = findAll(log, /fill fs=#e74c3c A(-?[\d.]+),-38,7,0,7@([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)/);
  if(!m.length) return null;
  const g = m[m.length-1]; const [a,,c,,e] = g.slice(2).map(Number);
  return e + a*Number(g[1]) + c*(-38);
}

// x (and screen y) of the falling poop nearest the ground: poop bodies are
// gradient fills (55% saturation); the first `height` of them are the pile
function lowestPlop(log, height){
  const bodies = findAll(log, /^fill fs=grad\([^)]*\|0:hsl\([^)]*55%, 42%\)[^@]*@[^ ]*/)
    .map(m => m[0].split('@')[1].split(',').map(Number));
  const puddles = log.filter(l => /^fill fs=grad\([^|]*\|0:#8a6a2a/.test(l)).length;
  const plops = bodies.slice(Math.max(0, height - puddles));
  let best = null;
  for(const m of plops){ if(!best || m[5] > best[5]) best = m; }
  return best ? best[4] : null;
}

function run(oldDir, newDir, page, frames, seed, skilled, hz = 60){
  const store = { old:{}, new:{} };
  let A = boot(oldDir, page, store.old, seed), B = boot(newDir, page, store.new, seed);
  const ctl = seeded(seed * 7919 + 13);
  let mismatches = 0, reloads = 0;
  const seen = new Set();
  const both = (fn) => { fn(A); fn(B); };
  let pointer = 360, aim = 0;

  for(let f=0; f<frames; f++){
    // the new version can run at a higher refresh rate: it should draw the same
    // picture at the end of each 1/60 s as the old one does every frame
    const la = A.frame();
    let lb; for(let k = 0; k < hz/60; k++) lb = B.frame(1000/hz);
    const ha = crypto.createHash('sha1').update(la.join('\n')).digest('hex');
    const hb = crypto.createHash('sha1').update(lb.join('\n')).digest('hex');
    if(ha !== hb){
      mismatches++;
      if(mismatches <= 1){
        console.log(`MISMATCH at frame ${f}: old ${la.length} ops, new ${lb.length} ops`);
        for(let i=0;i<Math.max(la.length, lb.length);i++){
          if(la[i] !== lb[i]){ console.log('  first diff op', i, '\n  old:', la[i], '\n  new:', lb[i]); break; }
        }
      }
      break;
    }
    const txt = la.filter(l => l.startsWith('fillText')).join('\n');
    // coverage markers
    for(const [k, re] of [['lettuce', /fs=#a6e06a/], ['diarrheaDrop', /fs=#6f4e1a/], ['puddle', /#8a6a2a/],
        ['level2+', /Lv [2-9]/], ['topple', /TIMBERRR/], ['outOfTP', /Out of toilet paper/],
        ['paused', /Paused/], ['tippy', /TIPPY/], ['overworld', /Home Burrow/], ['levelHUD', /Impress|Out-stack/],
        ['banked', /Stack complete/], ['won', /Impressed!|Driven off!/], ['failed', /Failed!/],
        ['heckle', /heckling/], ['continue', /Continue — Day/], ['seasonOver', /Season won|overran/],
        ['shrunk', /fs=#eaf6ff/]]){
      if(re.test(txt) || (k==='lettuce'||k==='diarrheaDrop'||k==='puddle'||k==='shrunk') && la.some(l => re.test(l))) seen.add(k);
    }

    // ---- choose input for the next frame (identical for both) ----
    const r = ctl();
    if(page === 'wombat-poop.html'){
      if(A.els.saveOverlay && A.els.saveOverlay.style.display === 'flex'){
        if(r < 0.5){ A.els.nameEntry.value = B.els.nameEntry.value = 'Tester'; both(g => g.click('saveBtn')); }
        else both(g => g.elKey('nameEntry', 'Escape'));
        continue;
      }
      if(/Click \/ (Tap|Space)/.test(txt) && r < 0.02){ both(g => g.mouse('mousedown', 360, 500)); continue; }
      if(r < 0.0008){ both(g => g.key('keydown','p')); }
      const wx = wombatX(la);
      const hm = /"height: (\d+)"/.exec(txt);
      const px = skilled && hm ? lowestPlop(la, +hm[1]) : null;
      if(px !== null) aim = px + (ctl()-0.5)*6;
      else if(wx !== null) aim = wx + (ctl()-0.5)*(skilled ? 6 : 60);
      if(r > 0.995){ const k = ctl() < 0.5 ? 'arrowleft' : 'arrowright'; both(g => g.key('keydown', k)); }
      else if(r > 0.985){ both(g => { g.key('keyup','arrowleft'); g.key('keyup','arrowright'); }); }
      pointer += (aim - pointer) * (skilled ? 0.5 : 0.08);
      if(r < 0.5) both(g => g.mouse('mousemove', pointer, 400));
      else if(r < 0.52) both(g => g.touch('touchmove', pointer, 400));
      if(r > 0.9999) both(g => g.mouse('mouseleave'));
    } else {
      const inLevel = /Impress|Out-stack/.test(txt);
      if(/Continue — Day/.test(txt) && r < 0.05){
        const btnY = r < 0.04 ? 768+31 : 768+74+31;              // mostly Continue, sometimes New
        both(g => g.mouse('mousedown', 360, btnY)); continue;
      }
      if(/Tap to begin|Tap to play again/.test(txt) && r < 0.03){ both(g => g.mouse('mousedown', 360, 480)); continue; }
      if(/Home Burrow/.test(txt) && !inLevel){
        if(r < 0.03){
          const nodes = findAll(la, /fill fs=(?:#ff9ec7|#e06a4a|#c0392b) A([\d.]+),([\d.]+),/);
          if(nodes.length){ const n = nodes[Math.floor(ctl()*nodes.length)]; both(g => g.mouse('mousedown', +n[1], +n[2])); }
        } else if(r > 0.999){
          // simulate the app being backgrounded and killed, then relaunched
          both(g => g.hide()); reloads++;
          A = boot(oldDir, page, store.old, seed + reloads); B = boot(newDir, page, store.new, seed + reloads);
        }
        continue;
      }
      if(inLevel){
        const wx = wombatX(la);
        const Lv = skilled && A.sandbox.__L && A.sandbox.__L();
        const low = Lv && Lv.plops.filter(p => !p.collapsed).sort((p,q) => q.y - p.y)[0];
        if(low) aim = low.x - (Lv.pileCOMx - Lv.plat.x)*0.5 + (ctl()-0.5)*6;
        else if(wx !== null) aim = wx + (ctl()-0.5)*50;
        pointer += (aim - pointer) * (skilled ? 0.5 : 0.09);
        if(r < 0.6) both(g => g.mouse('mousemove', pointer, 400));
        else if(r < 0.62) both(g => g.touch('touchmove', pointer, 400));
        if(r > 0.997){ const k = ctl() < 0.5 ? 'a' : 'd'; both(g => g.key('keydown', k)); }
        else if(r > 0.99){ both(g => { g.key('keyup','a'); g.key('keyup','d'); }); }
      }
    }
  }
  const storeSame = JSON.stringify(store.old) === JSON.stringify(store.new);
  console.log(`${page} seed=${seed}${skilled ? ' skilled' : ''}${hz !== 60 ? ' @' + hz + 'Hz' : ''}: ${mismatches ? 'DIFFERENT' : 'identical'} over ${frames} frames` +
              `, storage ${storeSame ? 'identical' : 'DIFFERENT'}, reloads=${reloads}`);
  console.log('  covered:', [...seen].sort().join(', '));
  return !mismatches && storeSame;
}

const opts = parseArgs(process.argv.slice(2));
const oldDir = resolveVersion(opts.old), newDir = resolveVersion(opts.new);
const pages = opts.page === 'both' ? Object.values(PAGES) : [PAGES[opts.page]];
const skills = opts.skilled === null ? [false, true] : [opts.skilled];
let ok = true;
for(const page of pages) for(const skill of skills) for(const seed of opts.seeds){
  // a version that throws (say, it can't even start) is a difference, not a tool crash
  try { ok = run(oldDir, newDir, page, opts.frames, seed, skill, opts.hz) && ok; }
  catch(e){ ok = false; console.log(`${page} seed=${seed}: THREW ${e.name}: ${e.message} (${e.stack.split('\n')[0]})`); }
}
console.log(ok ? 'PASS: no behaviour differences found' : 'FAIL: versions differ');
process.exitCode = ok ? 0 : 1;
