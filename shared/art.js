// Drawing shared by both modes. WB.createArt(ctx, now) returns the drawing
// functions bound to one canvas context; `now()` gives the current frame count
// for anything animated (wombat headband tails, spinning stars, the goal line).
//
// Art style: cartoon with thick dark outlines (WB.INK) and flat colours with
// one shade, so shapes stay readable small and against busy backgrounds. New
// art should follow suit: fill, then stroke with INK.
(() => {
  const { W, H, topPlat, clamp } = WB;
  const INK = WB.INK = '#2a1c12';
  const TAU = Math.PI * 2;

  // wombat colour schemes: fur and its shade, pale muzzle, belly, nose, inner
  // ear, headband + knot. The player is the grey-brown of a common wombat;
  // rivals are darker and greyer, mates warmer.
  WB.PAL_PLAYER = { fur:'#8c7d6e', shade:'#685b4f', light:'#c3b4a4', belly:'#a39383', nose:'#2b2420',
                    earIn:'#cfa79a', band:'#2f8a3a', dot:'#ff5a4e' };
  WB.PAL_RIVAL  = { fur:'#6e6762', shade:'#4e4945', light:'#a69d95', belly:'#857e77', nose:'#1f1b18',
                    earIn:'#b88f88', band:'#a3321a', dot:'#f0c419' };
  WB.PAL_MATE   = { fur:'#9e8069', shade:'#78614f', light:'#dbc4ae', belly:'#b99d86', nose:'#2b2420',
                    earIn:'#efa5b2', band:'#d0508f', dot:'#fff0f6' };

  // Cosmetics (see WB.progress.looks): what the player's wombat and platform
  // look like. Rivals and mates keep their own colours.
  const FURS = {
    'fur-sandy':    { fur:'#b8925e', shade:'#8d6c41', light:'#e6cfa6', belly:'#cdb08a', earIn:'#e8b7a0' },
    'fur-ginger':   { fur:'#b8703c', shade:'#8a4f26', light:'#efc9a0', belly:'#d0905c', earIn:'#f0a890' },
    'fur-midnight': { fur:'#4a4440', shade:'#332e2b', light:'#8a817a', belly:'#5f5852', earIn:'#a87f78' },
    'fur-gold':     { fur:'#e0ac3c', shade:'#b07f1c', light:'#fbe3a0', belly:'#f0c860', earIn:'#f5c7a0' },
    'fur-snowy':    { fur:'#e9e4dc', shade:'#bdb5a9', light:'#ffffff', belly:'#f6f1ea', earIn:'#f2b8c0', nose:'#5a4a44' },
  };
  const BANDS = {
    'band-blue':   { band:'#2f63c9', dot:'#ffd23f' }, 'band-orange': { band:'#ef7d22', dot:'#2f63c9' },
    'band-pink':   { band:'#e0569b', dot:'#fff0f6' }, 'band-purple': { band:'#7a3fb8', dot:'#ffd23f' },
    'band-black':  { band:'#2b2b2b', dot:'#ffffff' }, 'band-gold':   { band:'#e8b420', dot:'#c0392b' },
    'band-rainbow':{ band:'#e74c3c', dot:'#ffffff', rainbow:true },
  };
  const RAINBOW = ['#e74c3c','#f39c12','#f1c40f','#2ecc71','#3498db','#9b59b6'];
  const PAINTS = {
    'paint-red':   { top:'#d9534f', low:'#a33a37' }, 'paint-blue':  { top:'#4a90d9', low:'#2f63a3' },
    'paint-green': { top:'#6bbf59', low:'#468a3a' }, 'paint-night': { top:'#3b3f58', low:'#262a3d' },
    'paint-candy': { top:'#fdf6ec', low:'rgba(110,50,30,.2)', stripes:'#e74c3c' }, 'paint-gold':  { top:'#f2c230', low:'#cf9418' },
    'paint-rainbow': { top:'#e74c3c', low:'rgba(42,28,18,.18)', rainbow:true },
  };
  // (the Workshop sets WB.lookPreview to try a look on before buying it)
  const lookNow = () => WB.lookPreview || (WB.progress && WB.progress.look ? WB.progress.look() : null);
  const palCache = {};
  function playerPal(lk){
    if(!FURS[lk.fur] && !BANDS[lk.band]) return WB.PAL_PLAYER;
    const key = lk.fur + '|' + lk.band;
    return palCache[key] || (palCache[key] = { ...WB.PAL_PLAYER, ...(FURS[lk.fur] || {}), ...(BANDS[lk.band] || {}) });
  }

  // The wombat is drawn standing on its feet (about 160 tall, ears included);
  // this scales it to fit where the game's original art went, whose body
  // centre sat 66 above the feet.
  const WOMBAT_SIZE = 0.84, FEET_BELOW = 66;

  WB.createArt = function(ctx, now){

    function roundRect(x,y,w,h,r){
      r = Math.min(r, w/2, h/2);
      ctx.beginPath();
      ctx.moveTo(x+r,y);
      ctx.arcTo(x+w,y,x+w,y+h,r);
      ctx.arcTo(x+w,y+h,x,y+h,r);
      ctx.arcTo(x,y+h,x,y,r);
      ctx.arcTo(x,y,x+w,y,r);
      ctx.closePath();
    }
    function ell(x, y, rx, ry, rot){ ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
    // fill the current path, then outline it
    function inked(fill){ ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }

    // a poop cube: flat fill, a darker lower band, a highlight, and an outline.
    // Golden poops (see WB.isGolden) are gold with a twinkle.
    function drawPoop(x,y,w,h,rot,squish,hue){
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(rot||0);
      const bw = w, bh = h*(squish||1), r = Math.min(bw,bh)*0.28, hh = 28+(hue||0);
      const gold = WB.isGolden(hue||0), bad = WB.isBad(hue||0);
      ctx.fillStyle = gold ? '#f2c230' : bad ? '#5d6b45' : `hsl(${hh}, 52%, 37%)`;
      roundRect(-bw/2, -bh/2, bw, bh, r); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = gold ? '#cf9418' : bad ? '#434e30' : `hsl(${hh}, 55%, 27%)`; ctx.fillRect(-bw/2, bh*0.16, bw, bh);
      ctx.restore();
      if(bad){                                    // a rival's bad cube: a sickly green with stink lines
        ctx.strokeStyle = 'rgba(160,190,90,.8)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        const wv = Math.sin(now()*0.2 + x*0.1)*2;
        for(const k of [-1, 1]){
          ctx.beginPath(); ctx.moveTo(k*bw*0.18, -bh/2 - 4);
          ctx.quadraticCurveTo(k*bw*0.18 + 5 + wv, -bh/2 - 10, k*bw*0.18, -bh/2 - 16); ctx.stroke();
        }
      }
      ctx.fillStyle = gold ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.45)';
      ell(-bw*0.2, -bh*0.24, bw*0.17, bh*0.09, -0.4); ctx.fill();
      if(gold){                                   // a four-point twinkle that pulses
        const tw = 0.6 + 0.4*Math.sin(now()*0.15 + x*0.05), sz = Math.min(bw, bh)*0.22*tw;
        ctx.fillStyle = '#fffbe0'; ctx.beginPath();
        ctx.moveTo(bw*0.18, -bh*0.05 - sz); ctx.lineTo(bw*0.18 + sz*0.3, -bh*0.05); ctx.lineTo(bw*0.18, -bh*0.05 + sz);
        ctx.lineTo(bw*0.18 - sz*0.3, -bh*0.05); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bw*0.18 - sz, -bh*0.05); ctx.lineTo(bw*0.18, -bh*0.05 - sz*0.3);
        ctx.lineTo(bw*0.18 + sz, -bh*0.05); ctx.lineTo(bw*0.18, -bh*0.05 + sz*0.3); ctx.closePath(); ctx.fill();
      }
      ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
      roundRect(-bw/2, -bh/2, bw, bh, r); ctx.stroke();
      ctx.restore();
    }

    // a melted cube: a glossy flat puddle of diarrhea
    function drawPuddle(x, y, w, h){
      ctx.save();
      ctx.translate(x, y);
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
      // drips down the sides
      ctx.fillStyle = '#6b4f1e';
      ell(-w*0.3, h/2, 4.5, 5); ctx.fill(); ctx.stroke();
      ell(w*0.28, h/2+2, 5, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8a6a2a';
      roundRect(-w/2, -h/2, w, h, h/2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ell(-w*0.18, -h*0.12, w*0.14, Math.max(1.5, h*0.14)); ctx.fill();
      ctx.restore();
    }

    // The pile, each poop leaning with the wobble in proportion to its height
    // above the base of the current level (where the physics measures the
    // wobble from too), so poops at the base stay level and stuck, and a tall
    // endless tower doesn't swing harder just for having climbed.
    // Pass lean=false while the tower is toppling (it falls straight instead).
    const LEAN = 0.35;                                       // how far the drawn pile leans per unit of sway
    function drawStack(S, lean){
      const sway = clamp(S.pileSwayShown, -0.5, 0.5);
      const base = S.raiseBaseY;
      for(const c of S.stack){
        let dx = 0;
        if(lean){
          const above = Math.max(0, base - (c.y + c.h/2));  // height of its underside above the level's base
          dx = sway * above * LEAN;
        }
        if(c.melting || c.melted) drawPuddle(c.x + dx, c.y, c.w, c.h);
        else drawPoop(c.x + dx, c.y, c.w, c.h, (c.rot||0), c.squish, c.hue);
      }
    }

    // ---------- the wombat ----------
    // Drawn from a reference photo: small pointed ears set high, a broad flat
    // nose, no neck, a pear-shaped body widest at the hips, shaggy cheeks and
    // hips, and claws on the paws (held at the chest) and feet. The eyes are
    // cartoon (whites, pupils, eyebrows) so it can act.

    // One outlined silhouette from several overlapping shapes: stroke them all
    // at double width, then fill them all, so only the outer edge shows.
    function union(paths, fill){
      const lw = ctx.lineWidth;
      ctx.lineWidth = lw*2; for(const p of paths){ p(); ctx.stroke(); }
      ctx.fillStyle = fill; for(const p of paths){ p(); ctx.fill(); }
      ctx.lineWidth = lw;
    }
    function claws(x, y, n, gap, len){
      ctx.save(); ctx.strokeStyle = '#f1eadf'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      for(let k=0;k<n;k++){ const cx = x + (k - (n-1)/2)*gap; ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + len); ctx.stroke(); }
      ctx.restore();
    }
    function pointedEar(x, y, side, sc, fur, inner){
      const b = 11*sc, h = 24*sc;
      ctx.beginPath(); ctx.moveTo(x - b, y); ctx.lineTo(x + side*5*sc, y - h); ctx.lineTo(x + b, y); ctx.closePath(); inked(fur);
      ctx.fillStyle = inner; ctx.beginPath(); ctx.moveTo(x - b*0.45, y - 2); ctx.lineTo(x + side*4*sc, y - h*0.72); ctx.lineTo(x + b*0.45, y - 2); ctx.closePath(); ctx.fill();
    }

    // The combat wombat, parameterised so any wombat can use it: wb carries
    // x, y (body centre), face (-1 left .. 1 right), strain (0..1), crawl (walk
    // cycle), wob, mode ('crawl', 'eat', ...), timer, blink. extras: angry
    // (brows + grimace), love (floating hearts), lift (raise the body but not
    // its effort marks — endless mode's level-up leap).
    function drawWombatArt(wb, scale, pal, extras){
      pal = pal || WB.PAL_PLAYER; scale = scale || 1; extras = extras || {};
      let hat = null;
      if(pal === WB.PAL_PLAYER){                    // the player's wombat wears what you've picked
        const lk = extras.look || lookNow();
        if(lk){ pal = playerPal(lk); if(lk.hat !== 'hat-none') hat = lk.hat; }
      }
      const t = now();
      const p = wb.strain||0, f = clamp(wb.face||0,-1,1), af = Math.abs(f), sg = f<0 ? -1 : 1;
      const blink = (wb.blink||0) > 0, mode = wb.mode || 'crawl', walking = mode === 'crawl';
      const ph = wb.crawl||0, angry = !!extras.angry;
      const far = (side, from) => (side === -sg && af > from) ? 1 - af*0.35 : 1;   // the far ear/eye shrinks on a turn

      ctx.save();
      ctx.translate(wb.x, wb.y + FEET_BELOW*scale + (wb.wob||0)*0.2*scale - (extras.lift||0));
      ctx.scale(scale*WOMBAT_SIZE, scale*WOMBAT_SIZE);
      ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.translate(p > 0.35 ? Math.sin(t*1.1)*(p-0.35)*7 : 0, 0);         // a shake when forcing one out

      // short wide feet with claws
      for(const side of [-1, 1]){
        const lift = walking ? Math.max(0, side*Math.sin(ph))*7 : 0, fx = side*28 + f*6;
        ell(fx, -8 - lift, 21, 10); inked(pal.shade);
        claws(fx + f*8, -3 - lift, 3, 6, 4);
      }
      // the rest bobs with each step and squashes down when straining
      ctx.translate(0, walking ? -Math.abs(Math.sin(ph))*5 : 0);
      ctx.scale(1 + p*0.08, 1 - p*0.1);

      // small pointed ears, set high, behind the head
      const hx = f*10;
      for(const side of [-1, 1]) pointedEar(hx + side*24*(1 - af*0.2), -136, side, far(side, 0.2), pal.fur, pal.earIn);

      // head runs straight into a pear-shaped body: one silhouette, shaggy at cheeks and hips
      const head = () => ell(hx, -114, 46, 34);
      const tuft = (side, x, y) => () => {
        ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + side*14, y - 7); ctx.lineTo(x + side*3, y - 3);
        ctx.lineTo(x + side*12, y + 5); ctx.lineTo(x - side*2, y + 8); ctx.closePath();
      };
      union([
        () => ell(0, -46, 60, 44), () => ell(f*4, -84, 48, 40), head,
        tuft(-1, hx - 40, -106), tuft(1, hx + 40, -106), tuft(-1, -56, -44), tuft(1, 56, -44),
      ], pal.fur);
      ctx.fillStyle = pal.belly; ell(f*6, -46, 36, 30); ctx.fill();
      ctx.strokeStyle = pal.shade; ctx.lineWidth = 2.5;                   // a few strokes of fur
      for(const [fx, fy] of [[-34,-70], [-24,-94], [30,-66], [22,-92]]){ ctx.beginPath(); ctx.moveTo(fx + f*4, fy); ctx.lineTo(fx + f*4 + 4, fy + 6); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 4.5;

      // headband across the forehead, tails flapping out behind the turn
      ctx.save(); head(); ctx.clip();
      ctx.fillStyle = pal.band; ctx.fillRect(hx - 80, -142, 160, 13);
      if(pal.rainbow) RAINBOW.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(hx - 80, -142 + i*13/6, 160, 13/6 + 0.5); });
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - 80, -142); ctx.lineTo(hx + 80, -142); ctx.moveTo(hx - 80, -129); ctx.lineTo(hx + 80, -129); ctx.stroke();
      ctx.restore(); ctx.lineWidth = 4.5;
      const tx = hx - sg*44, fl = Math.sin(t*0.22)*6, fl2 = Math.cos(t*0.22)*6;
      ctx.beginPath(); ctx.moveTo(tx, -139); ctx.lineTo(tx - sg*26, -147 + fl); ctx.lineTo(tx - sg*22, -133 + fl); ctx.closePath(); inked(pal.band);
      ctx.beginPath(); ctx.moveTo(tx, -134); ctx.lineTo(tx - sg*20, -120 + fl2); ctx.lineTo(tx - sg*10, -116 + fl2); ctx.closePath(); inked(pal.rainbow ? RAINBOW[4] : pal.band);
      ell(hx + f*18, -135.5, 5.5, 5.5); inked(pal.dot);

      // pale muzzle and the big flat nose
      const mx = hx + f*18;
      ctx.fillStyle = pal.light; ell(mx, -100, 22, 15); ctx.fill();
      ctx.lineWidth = 3.5; roundRect(mx + f*3 - 15, -118, 30, 20, 9); inked(pal.nose);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ell(mx + f*3 - 5, -113, 5, 2.5); ctx.fill();

      // eyes with whites and pupils, and eyebrows that act
      const ecx = hx + f*12, sep = 23*(1 - af*0.3);
      for(const side of [-1, 1]){
        const sc = far(side, 0.15), ex = ecx + side*sep, ey = -123;
        ctx.lineWidth = 3.5; ctx.beginPath();
        if(p > 0.55){ ctx.moveTo(ex + side*7*sc, ey - 6); ctx.lineTo(ex - side*4*sc, ey); ctx.lineTo(ex + side*7*sc, ey + 6); ctx.stroke(); }  // >< squeezed shut
        else if(blink){ ctx.arc(ex, ey - 3, 6.5*sc, 0.2*Math.PI, 0.8*Math.PI); ctx.stroke(); }
        else {
          ctx.lineWidth = 3; ell(ex, ey, 7*sc, 8.5*sc); inked('#fff');
          ctx.fillStyle = INK; ell(ex + f*3, ey + 1, 3.8*sc, 4.8*sc); ctx.fill();
          ctx.fillStyle = '#fff'; ell(ex + f*3 + 1.4, ey - 1, 1.3, 1.3); ctx.fill();
        }
        ctx.lineWidth = 4; ctx.beginPath();
        if(p > 0.35 || angry){ ctx.moveTo(ex + side*10, -138); ctx.lineTo(ex - side*6, -132); }      // dug in
        else { ctx.moveTo(ex - 7.5, -134); ctx.quadraticCurveTo(ex, -139, ex + 7.5, -134); }       // relaxed
        ctx.stroke();
      }

      // mouth: a small "w" under the nose, a chomp, or gritted teeth
      const my = -94, ms = 0.9;
      if(mode === 'eat'){
        const open = Math.abs(Math.sin((wb.timer||0)*0.5));           // 0 shut .. 1 wide
        ctx.lineWidth = 3; ell(mx, my + 2, 9*ms, (2.5 + open*8)*ms); inked('#5a2a22');
        ctx.fillStyle = '#e07b7b'; ell(mx, my + 4 + open*3, 5*ms, (1.5 + open*2.5)*ms); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(mx - 6*ms, my + 2 - (2.5 + open*8)*ms + 1, 3*ms, 2.5*ms); ctx.fillRect(mx + 3*ms, my + 2 - (2.5 + open*8)*ms + 1, 3*ms, 2.5*ms);
      } else if(p > 0.5 || angry){
        ctx.lineWidth = 3; roundRect(mx - 9*ms, my - 3, 18*ms, (7 + p*3)*ms, 3); inked('#5a2a22');
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx - 6*ms, my + (0.5 + p)*ms); ctx.lineTo(mx + 6*ms, my + (0.5 + p)*ms); ctx.stroke();
        ctx.strokeStyle = INK;
      } else {
        ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(mx - 7*ms, my - 1); ctx.quadraticCurveTo(mx - 3.5*ms, my + 4*ms, mx, my - 1);
        ctx.quadraticCurveTo(mx + 3.5*ms, my + 4*ms, mx + 7*ms, my - 1); ctx.stroke();
      }
      ctx.lineWidth = 4.5;

      // cheeks flush with effort
      if(p > 0.3){
        ctx.fillStyle = `rgba(255,110,100,${(p - 0.3)*0.7})`;
        ell(ecx - sep - 6, -106, 8, 5); ctx.fill(); ell(ecx + sep + 6, -106, 8, 5); ctx.fill();
      }
      // paws held at the chest, claws out; they clench together when straining
      const sw = walking ? Math.sin(ph)*3 : 0, ax = 15 - p*4;
      for(const side of [-1, 1]){
        const px = f*8 + side*ax, py = -72 + side*sw;
        ell(px, py, 13, 9, side*0.5); inked(pal.fur);
        claws(px - side*2, py + 5, 3, 4, 5);
      }
      // sweat bead when really straining
      if(p > 0.6){
        const yy = -150 + ((t*1.2) % 26)/26*12;
        ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(hx + 44, yy - 8); ctx.quadraticCurveTo(hx + 51, yy + 2, hx + 44, yy + 4); ctx.quadraticCurveTo(hx + 37, yy + 2, hx + 44, yy - 8);
        inked('#9fe3ff');
      }
      if(hat) drawHat(hat, hx, t);
      ctx.restore();

      // effort marks floating around the head
      if(p > 0.45){
        ctx.fillStyle='#e74c3c'; ctx.font='bold 34px "Comic Neue", "Comic Sans MS", cursive'; ctx.textAlign='left';
        ctx.fillText('!', wb.x+84*scale, wb.y-30*scale-p*6);
        ctx.fillText('💨', wb.x-124*scale, wb.y+30*scale);
      }
      if(extras.love){
        ctx.font=(20*Math.max(scale,0.6))+'px serif'; ctx.textAlign='center';
        ctx.fillText('💗', wb.x+52*scale, wb.y-52*scale+Math.sin(t*0.1)*3);
        ctx.fillText('💗', wb.x-52*scale, wb.y-44*scale+Math.cos(t*0.12)*3);
      }
    }

    // Hats sit on the head, in the wombat's own drawing space (head top at -148,
    // hx = the head's sideways shift as it turns).
    function drawHat(id, hx, t){
      ctx.lineWidth = 4; ctx.strokeStyle = INK;
      if(id === 'hat-party'){
        ctx.beginPath(); ctx.moveTo(hx - 26, -140); ctx.lineTo(hx + 26, -140); ctx.lineTo(hx + 6, -186); ctx.closePath(); inked('#ff5a8a');
        ctx.fillStyle = '#ffe14d'; for(const [dx, dy] of [[-9,-150], [9,-156], [0,-166], [5,-176]]){ ell(hx + dx, dy, 3.5, 3.5); ctx.fill(); }
        ell(hx + 6, -188, 7, 7); inked('#ffe14d');
      } else if(id === 'hat-beanie'){
        ctx.beginPath(); ctx.ellipse(hx, -142, 42, 30, 0, Math.PI, TAU); ctx.closePath(); inked('#3a7bd5');
        roundRect(hx - 45, -148, 90, 14, 7); inked('#2f63c9');
        ctx.strokeStyle = 'rgba(42,28,18,.3)'; ctx.lineWidth = 2;
        for(let k = -30; k <= 30; k += 12){ ctx.beginPath(); ctx.moveTo(hx + k, -146); ctx.lineTo(hx + k, -136); ctx.stroke(); }
        ctx.strokeStyle = INK; ctx.lineWidth = 4;
        ell(hx, -172, 9, 9); inked('#ffffff');
      } else if(id === 'hat-flowers'){
        ctx.strokeStyle = '#3f8f3a'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(hx, -118, 44, 32, 0, Math.PI*1.08, Math.PI*1.92); ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        const cols = ['#ff8fb1', '#ffffff', '#ffd23f', '#c39bff'];
        for(let i = 0; i < 6; i++){
          const a = Math.PI*(1.12 + i*0.152), x = hx + 44*Math.cos(a), y = -118 + 32*Math.sin(a);
          for(let k = 0; k < 5; k++){ const b = k*TAU/5; ell(x + Math.cos(b)*5, y + Math.sin(b)*5, 4.5, 4.5); inked(cols[i % 4]); }
          ell(x, y, 3.5, 3.5); inked('#f39c12');
        }
      } else if(id === 'hat-propeller'){
        ctx.beginPath(); ctx.ellipse(hx, -142, 34, 20, 0, Math.PI, TAU); ctx.closePath(); inked('#e74c3c');
        ctx.save(); ctx.clip(); ctx.fillStyle = '#f1c40f'; ctx.fillRect(hx - 8, -170, 16, 30); ctx.restore(); ctx.stroke();
        ell(hx + 22, -142, 20, 5); inked('#c0392b');
        ctx.beginPath(); ctx.moveTo(hx, -162); ctx.lineTo(hx, -172); ctx.stroke();
        const bw = Math.abs(Math.cos(t*0.6))*32 + 3;
        ell(hx, -174, bw, 4.5); inked('#3498db'); ell(hx, -174, 3.5, 3.5); inked('#f1c40f');
      } else if(id === 'hat-cowboy'){
        roundRect(hx - 30, -176, 60, 36, 12); inked('#a0672e');
        ctx.beginPath(); ctx.moveTo(hx, -176); ctx.lineTo(hx, -166); ctx.stroke();
        ctx.fillStyle = '#5a2d0c'; ctx.fillRect(hx - 28, -158, 56, 8);
        ctx.beginPath(); ctx.moveTo(hx - 72, -150); ctx.quadraticCurveTo(hx, -128, hx + 72, -150);
        ctx.quadraticCurveTo(hx, -142, hx - 72, -150); ctx.closePath(); inked('#8b5a2b');
      } else if(id === 'hat-tophat'){
        roundRect(hx - 24, -186, 48, 42, 4); inked('#2b2b2b');
        ctx.fillStyle = '#c0392b'; ctx.fillRect(hx - 22, -158, 44, 9);
        ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - 14, -180); ctx.lineTo(hx - 14, -164); ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 4;
        ell(hx, -145, 42, 8); inked('#2b2b2b');
      } else if(id === 'hat-halo'){
        const bob = Math.sin(t*0.08)*3;
        ctx.lineWidth = 3; ell(hx, -164 + bob, 30, 8); ctx.stroke();
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 6; ell(hx, -164 + bob, 30, 8); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(hx, -164 + bob, 30, 8, 0, Math.PI*1.1, Math.PI*1.5); ctx.stroke();
        ctx.strokeStyle = INK;
      } else if(id === 'hat-viking'){
        for(const side of [-1, 1]){                 // horns first, so the helmet sits over their roots
          ctx.beginPath(); ctx.moveTo(hx + side*30, -150); ctx.quadraticCurveTo(hx + side*58, -152, hx + side*56, -184);
          ctx.quadraticCurveTo(hx + side*46, -164, hx + side*26, -162); ctx.closePath(); inked('#f6ecd8');
        }
        ctx.beginPath(); ctx.ellipse(hx, -142, 38, 28, 0, Math.PI, TAU); ctx.closePath(); inked('#9aa3ad');
        roundRect(hx - 40, -148, 80, 12, 5); inked('#6f7883');
        ctx.fillStyle = INK; for(const dx of [-26, -9, 9, 26]){ ell(hx + dx, -142, 2.2, 2.2); ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(hx - 4, -150, 26, 18, 0, Math.PI*1.15, Math.PI*1.45); ctx.stroke();
        ctx.strokeStyle = INK;
      } else if(id === 'hat-crown'){
        ctx.beginPath(); ctx.moveTo(hx - 30, -142); ctx.lineTo(hx - 32, -170); ctx.lineTo(hx - 16, -158); ctx.lineTo(hx, -176);
        ctx.lineTo(hx + 16, -158); ctx.lineTo(hx + 32, -170); ctx.lineTo(hx + 30, -142); ctx.closePath(); inked('#f2c230');
        ctx.lineWidth = 2.5;
        for(const [dx, c] of [[-17, '#3498db'], [0, '#e74c3c'], [17, '#2ecc71']]){ ell(hx + dx, -152, 4.5, 4.5); inked(c); }
        for(const [dx, dy] of [[-32,-172], [0,-178], [32,-172]]){ ell(hx + dx, dy, 4, 4); inked('#f2c230'); }
      }
      ctx.lineWidth = 4.5;
    }

    // a falling poop's trail (the Poop trail cosmetic); nothing with none worn
    function drawTrail(p){
      const lk = lookNow();
      if(!lk || lk.trail === 'trail-none' || !(p.vy > 1)) return;
      ctx.save();
      for(let k = 1; k <= 4; k++){
        const x = p.x - p.vx*k*4 + Math.sin(now()*0.25 + k*1.7 + (p.born||0))*5, y = p.y - p.h/2 - k*19;
        const r = Math.max(7, p.w/3.6) * (1 - k*0.14);
        ctx.globalAlpha = 1 - k*0.18;
        if(lk.trail === 'trail-sparkle'){
          ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath();
          for(let i = 0; i < 8; i++){ const a = i*Math.PI/4 + now()*0.08, rr = i % 2 ? r*0.35 : r; ctx.lineTo(x + Math.cos(a)*rr, y + Math.sin(a)*rr); }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if(lk.trail === 'trail-hearts'){
          ctx.fillStyle = '#ff6fa3'; ctx.beginPath(); ctx.moveTo(x, y + r*0.9);
          ctx.bezierCurveTo(x - r*1.4, y - r*0.2, x - r*0.6, y - r*1.2, x, y - r*0.4);
          ctx.bezierCurveTo(x + r*0.6, y - r*1.2, x + r*1.4, y - r*0.2, x, y + r*0.9); ctx.fill();
        } else if(lk.trail === 'trail-bubbles'){
          ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.strokeStyle = '#3aa6d9'; ctx.lineWidth = 2.5;
          ell(x, y, r*0.8, r*0.8); ctx.fill(); ctx.stroke();
        } else if(lk.trail === 'trail-stars'){
          drawStar(x, y, r, '#ffe14d');
        } else if(lk.trail === 'trail-confetti'){
          for(let j = 0; j < 3; j++){
            ctx.save(); ctx.translate(x + (j - 1)*r*0.9, y + (j % 2)*r*0.5); ctx.rotate(now()*0.15 + k + j*2);
            ctx.fillStyle = RAINBOW[(k*3 + j) % 6]; ctx.fillRect(-r*0.35, -r*0.2, r*0.7, r*0.4); ctx.restore();
          }
        }
      }
      ctx.restore();
    }

    // "Sticker earned!" (see shared/stickers.js): a card that drops in from the
    // top for a few seconds. age = frames since it appeared.
    function drawStickerToast(s, age, y){
      const inT = Math.min(1, age/14), outT = Math.min(1, Math.max(0, (240 - age)/16));
      const k = Math.min(inT, outT), yy = (y || 200) - (1 - k)*40;
      const reward = s.reward && WB.progress && WB.progress.lookById(s.reward);
      const w = 440, h = reward ? 100 : 82, x = W/2 - w/2;
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; roundRect(x + 4, yy + 6, w, h, 18); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = INK; roundRect(x, yy, w, h, 18); inked('#fff8e7');
      ell(x + 48, yy + h/2, 32, 32); inked('#ffe14d');
      ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
      ctx.fillText(s.icon, x + 48, yy + h/2 + 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#8a6a4f'; ctx.font = 'bold 15px "Comic Neue", "Comic Sans MS", cursive';
      ctx.fillText('🏅 STICKER EARNED', x + 94, yy + 30);
      ctx.fillStyle = '#5a2d0c'; ctx.font = 'bold 26px "Comic Neue", "Comic Sans MS", cursive';
      ctx.fillText(s.name, x + 94, yy + 60);
      if(reward){ ctx.fillStyle = '#2f7a2a'; ctx.font = 'bold 16px "Comic Neue", "Comic Sans MS", cursive';
        ctx.fillText('Unlocked a new look: ' + reward.name, x + 94, yy + 86); }
      ctx.restore();
    }

    // a wooden board: flat wood, a darker lower edge, a highlight, an outline
    // (paint: the Platform paint cosmetic, or plain wood)
    function plank(x, y, w, h, r, grainStep, grainStart, paint){
      ctx.fillStyle = paint ? paint.top : '#c98b4a'; roundRect(x, y, w, h, r); ctx.fill();
      ctx.save(); ctx.clip();
      if(paint && paint.rainbow) RAINBOW.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x, y + i*h/6, w, h/6 + 0.5); });
      if(paint && paint.stripes){
        ctx.fillStyle = paint.stripes;
        for(let sx = x - h; sx < x + w; sx += 18){ ctx.beginPath(); ctx.moveTo(sx, y + h); ctx.lineTo(sx + 9, y + h); ctx.lineTo(sx + 9 + h, y); ctx.lineTo(sx + h, y); ctx.closePath(); ctx.fill(); }
      }
      ctx.fillStyle = paint ? paint.low : '#9c6531'; ctx.fillRect(x, y + h*0.62, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x + 6, y + 5); ctx.lineTo(x + w - 6, y + 5); ctx.stroke();
      ctx.strokeStyle = 'rgba(42,28,18,.35)'; ctx.lineWidth = 2;
      for(let gx = x + grainStart; gx < x + w; gx += grainStep){
        ctx.beginPath(); ctx.moveTo(gx, y + 3); ctx.lineTo(gx, y + h - 3); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
      roundRect(x, y, w, h, r); ctx.stroke();
    }

    // the catch platform on its pole
    function drawPlatform(plat){
      ctx.save();
      ctx.translate(plat.x, plat.y);
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
      ctx.fillStyle = '#8a5a30';
      ctx.fillRect(-8, plat.h/2 - 2, 16, H); ctx.strokeRect(-8, plat.h/2 - 2, 16, H);
      const lk = lookNow();
      plank(-plat.w/2, -plat.h/2, plat.w, plat.h, 10, 44, 22, lk && PAINTS[lk.paint]);
      ctx.restore();
    }

    // the plank the wombat crawls along, raised by `hop` during a level-up leap
    function drawTopPlat(hop){
      ctx.save();
      ctx.translate(topPlat.x, topPlat.y - (hop||0));
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.fillStyle = '#8a5a30';
      for(const px of [-topPlat.w/2 + 10, topPlat.w/2 - 24]){
        ctx.fillRect(px, topPlat.h/2 - 2, 14, 42); ctx.strokeRect(px, topPlat.h/2 - 2, 14, 42);
      }
      plank(-topPlat.w/2, -topPlat.h/2, topPlat.w, topPlat.h, 8, 70, 40);
      ctx.restore();
    }

    function drawLettuce(lettuce, hop){
      if(!lettuce) return;
      const sc = lettuce.eatScale == null ? 1 : lettuce.eatScale;
      if(sc <= 0.02) return;
      ctx.save();
      ctx.translate(lettuce.x + lettuce.wob, lettuce.y - (hop||0));
      ctx.rotate(lettuce.roll||0);
      ctx.scale(sc, sc);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      // ruffled leaf: the outer ring outlined, the heart drawn over it (a Rotter's is brown and spotty)
      const leaf = lettuce.rotten ? '#8a9a3a' : '#6cbf38', heart = lettuce.rotten ? '#b8b860' : '#b2e875';
      for(let i=0;i<6;i++){
        const a = i/6*Math.PI*2;
        ell(Math.cos(a)*7, Math.sin(a)*5, 9, 7, a); inked(leaf);
      }
      ctx.fillStyle = leaf; ell(0, 0, 11, 9); ctx.fill();
      ell(0, -1, 8, 7); inked(heart);
      if(lettuce.rotten){ ctx.fillStyle = '#6b4a1c'; ell(-4, 2, 2, 1.6); ctx.fill(); ell(3, -3, 1.6, 1.3); ctx.fill(); ell(6, 4, 1.8, 1.4); ctx.fill(); }
      ctx.strokeStyle = '#3f7d1e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(0,5); ctx.stroke();
      ctx.restore();
    }

    // hot drops falling onto the tower (world y, shifted by the camera)
    function drawDiarrhea(drops, camOffset){
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      for(const d of drops){
        ctx.save();
        ctx.translate(d.x, d.y + (camOffset||0));
        ell(0, 0, d.r*0.8, d.r*1.15); inked('#7a5520');   // teardrop-ish blob
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ell(-d.r*0.25, -d.r*0.3, d.r*0.22, d.r*0.22); ctx.fill();
        ctx.restore();
      }
    }

    function drawStar(x,y,r,color){
      ctx.save(); ctx.translate(x,y); ctx.rotate(now()*0.1);
      ctx.fillStyle=color; ctx.beginPath();
      for(let i=0;i<5;i++){
        ctx.lineTo(Math.cos((i*4*Math.PI)/5 - Math.PI/2)*r, Math.sin((i*4*Math.PI)/5 - Math.PI/2)*r);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }

    function drawParticles(list){
      for(const p of list){
        ctx.globalAlpha = Math.max(0, p.life/p.max);
        if(p.kind==='star'){
          drawStar(p.x,p.y,p.r,p.color);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // grass at the base of the tower, just under the catch platform — oversized
    // so no sky shows past the edges during screen shake or camera scroll
    function drawGround(plat){
      const gy = plat.y + 8;
      ctx.fillStyle = '#7cc23f';
      ctx.fillRect(-60, gy, W + 120, 900);
      ctx.fillStyle = '#5aa72f';
      ctx.fillRect(-60, gy + 10, W + 120, 900);              // a darker band below the lip
      // tufts standing on the edge, outlined like everything else
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-60, gy); ctx.lineTo(W + 60, gy); ctx.stroke();
      ctx.fillStyle = '#8fd14c';
      for(let i=0;i<24;i++){
        const gx = i*32 - 30;
        ctx.beginPath(); ctx.moveTo(gx, gy+1); ctx.lineTo(gx+5, gy-13); ctx.lineTo(gx+9, gy-4);
        ctx.lineTo(gx+13, gy-15); ctx.lineTo(gx+18, gy+1); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }

    // pulsing red dashed goal line with its label
    function drawGoalLine(y){
      const t = now();
      ctx.save();
      ctx.setLineDash([20,14]);
      ctx.lineDashOffset = -(t*0.6 % 34);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#e23b2e';
      ctx.globalAlpha = 0.78 + Math.sin(t*0.14)*0.22;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.fillStyle = '#e23b2e';
      ctx.font = 'bold 19px "Comic Neue", "Comic Sans MS", cursive';
      ctx.textAlign = 'right';
      ctx.fillText('🎯 GOAL', W - 14, y - 9);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // a rounded, labelled button: b = {x,y,w,h}
    function drawButton(b, label, fill, edge, size){
      size = size || 25;
      ctx.save();
      ctx.fillStyle=fill; ctx.strokeStyle=edge; ctx.lineWidth=4;
      roundRect(b.x,b.y,b.w,b.h,14); ctx.fill(); ctx.stroke();
      ctx.fillStyle=edge; ctx.font='bold '+size+'px "Comic Neue", "Comic Sans MS", cursive'; ctx.textAlign='center';
      ctx.fillText(label, b.x+b.w/2, b.y+b.h/2+size*0.36);
      ctx.restore();
    }

    // the round in-game button: b = {x,y,r}, icon 'pause' (two bars), 'menu'
    // (three lines), or 'sound' / 'muted' (a speaker)
    function drawRoundButton(b, icon){
      ctx.save();
      ctx.fillStyle='rgba(255,255,255,.78)'; ctx.strokeStyle='#2d5016'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#2d5016';
      if(icon === 'menu'){
        for(let i=-1;i<=1;i++){ roundRect(b.x-10, b.y+i*7-1.5, 20, 3.5, 1.7); ctx.fill(); }
      } else if(icon === 'sound' || icon === 'muted'){
        // a speaker, with sound waves or a cross
        ctx.beginPath();
        ctx.moveTo(b.x-11, b.y-4); ctx.lineTo(b.x-6, b.y-4); ctx.lineTo(b.x+1, b.y-10);
        ctx.lineTo(b.x+1, b.y+10); ctx.lineTo(b.x-6, b.y+4); ctx.lineTo(b.x-11, b.y+4);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#2d5016'; ctx.lineWidth=2.5; ctx.lineCap='round';
        if(icon === 'sound'){
          ctx.beginPath(); ctx.arc(b.x+2, b.y, 6, -0.9, 0.9); ctx.stroke();
          ctx.beginPath(); ctx.arc(b.x+2, b.y, 11, -0.9, 0.9); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(b.x+5, b.y-5); ctx.lineTo(b.x+13, b.y+5);
          ctx.moveTo(b.x+13, b.y-5); ctx.lineTo(b.x+5, b.y+5); ctx.stroke();
        }
      } else {
        roundRect(b.x-8, b.y-9, 5.5, 18, 2); ctx.fill();
        roundRect(b.x+2.5, b.y-9, 5.5, 18, 2); ctx.fill();
      }
      ctx.restore();
    }

    // a Gum Nut (the currency): a little woody cup with a cap, size ~ its height
    function drawGumNut(x, y, size){
      const s = size/24;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-9, -4); ctx.quadraticCurveTo(-9, 11, 0, 12); ctx.quadraticCurveTo(9, 11, 9, -4); ctx.closePath();
      inked('#a0672e');
      ell(0, -5, 10, 4.5); inked('#7a4a1c');
      ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(3, -4); ctx.moveTo(3, -6); ctx.lineTo(-3, -4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ell(-4, 3, 2, 4, 0.3); ctx.fill();
      ctx.restore();
    }

    return { roundRect, drawButton, drawGumNut, drawRoundButton, drawPoop, drawPuddle, drawStack, drawWombatArt, drawPlatform, drawTopPlat, drawTrail, drawHat, drawStickerToast,
             drawLettuce, drawDiarrhea, drawParticles, drawGround, drawGoalLine };
  };
})();
