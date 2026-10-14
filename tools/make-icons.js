#!/usr/bin/env node
// Draw the game's icons and link-preview image with the game's own art.
//
// Runs shared/art.js against a stand-in canvas that records every shape as
// SVG, then rasterises with rsvg-convert. Re-run whenever the art changes:
//
//   node tools/make-icons.js
//
// Writes icons/: favicon-32.png, icon-180.png (Apple home screen),
// icon-192.png and icon-512.png (installable app), icon-maskable-512.png
// (Android's shaped icons), and og-image.png (1200x630 link preview).
// Needs rsvg-convert (librsvg) on the PATH.
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'icons');

// ---------- a canvas 2D context that writes SVG ----------
function svgContext(){
  const els = [], defs = [];
  let ids = 0;
  const fmt = v => (Math.round(v * 100) / 100).toString();
  let st = { m: [1,0,0,1,0,0], fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt',
             lineJoin: 'miter', globalAlpha: 1, clip: null };
  const stack = [];
  let subpaths = [], cur = null;                     // device-space points
  const T = (x, y) => { const m = st.m; return [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]]; };
  const scaleOf = () => Math.sqrt(Math.abs(st.m[0]*st.m[3] - st.m[1]*st.m[2]));
  const start = (x, y) => { cur = [T(x, y)]; cur.closed = false; cur.ux = cur.fx = x; cur.uy = cur.fy = y; subpaths.push(cur); };
  const lineTo = (x, y) => { if(!cur) start(x, y); else { cur.push(T(x, y)); cur.ux = x; cur.uy = y; } };
  const steps = (sweep, r) => Math.max(8, Math.ceil(Math.abs(sweep) * r * scaleOf() / 3));
  function ellipseArc(x, y, rx, ry, rot, a0, a1, ccw){
    let sweep = a1 - a0;
    if(!ccw && sweep < 0) sweep += Math.PI*2 * Math.ceil(-sweep / (Math.PI*2));
    if(ccw && sweep > 0) sweep -= Math.PI*2 * Math.ceil(sweep / (Math.PI*2));
    if(Math.abs(a1 - a0) >= Math.PI*2) sweep = ccw ? -Math.PI*2 : Math.PI*2;
    const n = steps(sweep, Math.max(rx, ry)), c = Math.cos(rot), s = Math.sin(rot);
    for(let i = 0; i <= n; i++){
      const a = a0 + sweep * i / n, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
      const px = x + ex*c - ey*s, py = y + ex*s + ey*c;
      if(i === 0 && !cur) start(px, py); else lineTo(px, py);
    }
  }
  const colour = c => typeof c === 'string' ? c : c.id ? `url(#${c.id})` : '#000';
  function dOf(){
    return subpaths.filter(p => p.length).map(p => 'M' + p.map(([x, y]) => fmt(x) + ' ' + fmt(y)).join('L') + (p.closed ? 'Z' : '')).join('');
  }
  function emit(attrs){
    const d = dOf(); if(!d) return;
    const clip = st.clip ? ` clip-path="url(#${st.clip})"` : '';
    els.push(`<path d="${d}" ${attrs}${clip}/>`);
  }
  function gradient(x0, y0, x1, y1){
    const g = { id: 'g' + (ids++), stops: [], x0, y0, x1, y1, placed: false,
      addColorStop(o, c){ this.stops.push([o, c]); } };
    return g;
  }
  function place(paint){                             // gradients take the transform in force when used
    if(typeof paint === 'string' || paint.placed) return;
    paint.placed = true;
    const [x1, y1] = T(paint.x0, paint.y0), [x2, y2] = T(paint.x1, paint.y1);
    defs.push(`<linearGradient id="${paint.id}" gradientUnits="userSpaceOnUse" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}">` +
      paint.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + '</linearGradient>');
  }
  const ctx = {
    save(){ stack.push({ ...st, m: st.m.slice() }); },
    restore(){ if(stack.length) st = stack.pop(); },
    setTransform(a, b, c, d, e, f){ st.m = [a, b, c, d, e, f]; },
    translate(x, y){ const m = st.m; m[4] += m[0]*x + m[2]*y; m[5] += m[1]*x + m[3]*y; },
    scale(x, y){ const m = st.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; },
    rotate(r){ const m = st.m, c = Math.cos(r), s = Math.sin(r), [a, b, cc, d] = m;
      m[0] = a*c + cc*s; m[1] = b*c + d*s; m[2] = -a*s + cc*c; m[3] = -b*s + d*c; },
    beginPath(){ subpaths = []; cur = null; },
    moveTo(x, y){ start(x, y); },
    lineTo,
    // like canvas: close this subpath, and carry on from its first point
    closePath(){ if(cur){ cur.closed = true; start(cur.fx, cur.fy); } },
    arc(x, y, r, a0, a1, ccw){ ellipseArc(x, y, r, r, 0, a0, a1, ccw); },
    ellipse(x, y, rx, ry, rot, a0, a1, ccw){ ellipseArc(x, y, rx, ry, rot, a0, a1, ccw); },
    arcTo(x1, y1, x2, y2, r){
      if(!cur){ start(x1, y1); return; }
      const x0 = cur.ux, y0 = cur.uy;
      const v1x = x0 - x1, v1y = y0 - y1, v2x = x2 - x1, v2y = y2 - y1;
      const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
      const cross = v1x*v2y - v1y*v2x;
      if(!r || !l1 || !l2 || Math.abs(cross) < 1e-9){ lineTo(x1, y1); return; }
      const ang = Math.acos(Math.max(-1, Math.min(1, (v1x*v2x + v1y*v2y) / (l1*l2))));
      const tl = r / Math.tan(ang / 2);
      const t1x = x1 + v1x / l1 * tl, t1y = y1 + v1y / l1 * tl, t2x = x1 + v2x / l2 * tl, t2y = y1 + v2y / l2 * tl;
      const bx = (v1x / l1 + v2x / l2), by = (v1y / l1 + v2y / l2), bl = Math.hypot(bx, by);
      const dc = r / Math.sin(ang / 2), cx = x1 + bx / bl * dc, cy = y1 + by / bl * dc;
      lineTo(t1x, t1y);
      const a0 = Math.atan2(t1y - cy, t1x - cx), a1 = Math.atan2(t2y - cy, t2x - cx);
      ellipseArc(cx, cy, r, r, 0, a0, a1, cross > 0);
    },
    quadraticCurveTo(cx, cy, x, y){
      const x0 = cur ? cur.ux : cx, y0 = cur ? cur.uy : cy, n = 16;
      for(let i = 1; i <= n; i++){ const t = i / n, u = 1 - t; lineTo(u*u*x0 + 2*u*t*cx + t*t*x, u*u*y0 + 2*u*t*cy + t*t*y); }
    },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y){
      const x0 = cur ? cur.ux : c1x, y0 = cur ? cur.uy : c1y, n = 24;
      for(let i = 1; i <= n; i++){ const t = i / n, u = 1 - t;
        lineTo(u*u*u*x0 + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*x, u*u*u*y0 + 3*u*u*t*c1y + 3*u*t*t*c2y + t*t*t*y); }
    },
    rect(x, y, w, h){ start(x, y); lineTo(x + w, y); lineTo(x + w, y + h); lineTo(x, y + h); cur.closed = true; },
    fill(){ place(st.fillStyle); emit(`fill="${colour(st.fillStyle)}"` + (st.globalAlpha < 1 ? ` fill-opacity="${fmt(st.globalAlpha)}"` : '')); },
    stroke(){
      place(st.strokeStyle);
      emit(`fill="none" stroke="${colour(st.strokeStyle)}" stroke-width="${fmt(st.lineWidth * scaleOf())}" stroke-linecap="${st.lineCap}" stroke-linejoin="${st.lineJoin}"` +
           (st.globalAlpha < 1 ? ` stroke-opacity="${fmt(st.globalAlpha)}"` : ''));
    },
    fillRect(x, y, w, h){ const keep = subpaths; subpaths = []; cur = null; ctx.rect(x, y, w, h); ctx.fill(); subpaths = keep; cur = null; },
    strokeRect(x, y, w, h){ const keep = subpaths; subpaths = []; cur = null; ctx.rect(x, y, w, h); ctx.stroke(); subpaths = keep; cur = null; },
    clearRect(){},
    clip(){
      const id = 'c' + (ids++), parent = st.clip ? ` clip-path="url(#${st.clip})"` : '';
      defs.push(`<clipPath id="${id}"${parent}><path d="${dOf()}"/></clipPath>`);
      st.clip = id;
    },
    createLinearGradient: gradient,
    fillText(){}, strokeText(){}, setLineDash(){},     // the icons use no text or dashes
    toSVG(w, h){ return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs>${els.join('')}</svg>`; },
  };
  for(const k of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'globalAlpha', 'font', 'textAlign', 'lineDashOffset'])
    Object.defineProperty(ctx, k, { get(){ return st[k]; }, set(v){ st[k] = v; } });
  return ctx;
}

// ---------- load the game's art ----------
function loadArt(){
  const sb = { console, document: {}, addEventListener(){} };
  sb.window = sb;
  vm.createContext(sb);
  for(const f of ['core.js', 'art.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared', f), 'utf8'), sb, { filename: f });
  return sb.WB;
}
const WB = loadArt();

function render(name, w, h, sizes, draw){
  const ctx = svgContext();
  const art = WB.createArt(ctx, () => 40);
  draw(ctx, art);
  const svgPath = path.join(OUT, name + '.svg');
  fs.writeFileSync(svgPath, ctx.toSVG(w, h));
  for(const [file, pw, ph] of sizes){
    execFileSync('rsvg-convert', ['-w', String(pw), '-h', String(ph), '-o', path.join(OUT, file), svgPath]);
    console.log(`${file}  ${pw}x${ph}  ${fs.statSync(path.join(OUT, file)).size} bytes`);
  }
  fs.unlinkSync(svgPath);
}

// a front-facing, contented wombat
const wombat = (x, y, extra) => ({ x, y, face: 0, strain: 0, crawl: 0, wob: 0, mode: 'idle', timer: 0, blink: 0, ...extra });

function skyAndGrass(ctx, w, h, grassY){
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#9fd8ff'); g.addColorStop(1, '#dff3ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#7cc23f'; ctx.fillRect(0, grassY, w, h - grassY);
  ctx.fillStyle = '#5aa72f'; ctx.fillRect(0, grassY + 14, w, h - grassY);
  ctx.strokeStyle = WB.INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, grassY); ctx.lineTo(w, grassY); ctx.stroke();
}

fs.mkdirSync(OUT, { recursive: true });

// App icons: the whole wombat standing on grass, filling the square.
render('icon', 512, 512, [['icon-512.png', 512, 512], ['icon-192.png', 192, 192], ['icon-180.png', 180, 180]], (ctx, art) => {
  skyAndGrass(ctx, 512, 512, 436);
  art.drawWombatArt(wombat(256, 248), 2.95, WB.PAL_PLAYER, {});
});

// Maskable: Android crops to a circle or squircle, so keep the wombat inside the middle 80%.
render('icon-maskable', 512, 512, [['icon-maskable-512.png', 512, 512]], (ctx, art) => {
  skyAndGrass(ctx, 512, 512, 404);
  art.drawWombatArt(wombat(256, 262), 2.2, WB.PAL_PLAYER, {});
});

// Favicon: just the head, big, on a green tile so it reads in a browser tab.
render('favicon', 512, 512, [['favicon-32.png', 32, 32]], (ctx, art) => {
  ctx.fillStyle = '#6ab04c'; ctx.beginPath(); ctx.arc(256, 256, 256, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(256, 256, 256, 0, 7); ctx.clip();
  art.drawWombatArt(wombat(256, 372), 3.4, WB.PAL_PLAYER, {});
  ctx.restore();
});

// Link preview (1200x630): the wombat straining on its plank, a tower of poops on the catch platform.
render('og-image', 1200, 630, [['og-image.png', 1200, 630]], (ctx, art) => {
  skyAndGrass(ctx, 1200, 630, 560);
  ctx.save(); ctx.scale(1.25, 1.25);                     // work in game units: 960 x 504
  // clouds
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for(const [x, y, r] of [[150, 70, 34], [780, 55, 28], [520, 110, 22]]){
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.arc(x + r, y + 6, r * 0.8, 0, 7); ctx.arc(x - r, y + 8, r * 0.7, 0, 7); ctx.arc(x + r * 0.4, y - r * 0.6, r * 0.7, 0, 7); ctx.fill();
  }
  // the wombat's plank, on the left
  ctx.save(); ctx.translate(250 - 360 * 0.6, 0); ctx.scale(0.6, 1); art.drawTopPlat(-98); ctx.restore();
  art.drawWombatArt(wombat(250, 160, { strain: 0.7, mode: 'push' }), 1.25, WB.PAL_PLAYER, {});
  art.drawPoop(262, 330, 44, 44, 0.3, 1, 3);
  // a tower on the catch platform, on the right
  const plat = { x: 690, y: 430, w: 170, h: 26 };
  art.drawPlatform(plat);
  const stack = [[0, 50, -3, 0], [-14, 46, 5, 0.04], [10, 54, 0, -0.03], [-4, 42, 6, 0.05], [8, 48, -5, -0.02]];
  let top = plat.y - plat.h / 2;
  for(const [dx, s, hue, rot] of stack){ art.drawPoop(plat.x + dx, top - s / 2, s, s, rot, 1, hue); top -= s - 2; }
  ctx.restore();
});
