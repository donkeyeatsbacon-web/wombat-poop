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

  // wombat colour schemes: fur, its shade, belly/muzzle, inner ear, headband + knot
  WB.PAL_PLAYER = { fur:'#9b7556', shade:'#7b5a40', belly:'#e3be98', earIn:'#e9a98f', band:'#2f8a3a', dot:'#ff5a4e' };
  WB.PAL_RIVAL  = { fur:'#7d7068', shade:'#5d534c', belly:'#bfb0a2', earIn:'#c9998d', band:'#a3321a', dot:'#f0c419' };
  WB.PAL_MATE   = { fur:'#a87a5e', shade:'#855b44', belly:'#f2cfb2', earIn:'#f3a3b6', band:'#d0508f', dot:'#fff0f6' };

  // The cartoon wombat is drawn standing on its feet; this scales it to the
  // size of the game's original art, whose body centre sat 66 above the feet.
  const WOMBAT_SIZE = 0.9, FEET_BELOW = 66;

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

    // a poop cube: flat fill, a darker lower band, a highlight, and an outline
    function drawPoop(x,y,w,h,rot,squish,hue){
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(rot||0);
      const bw = w, bh = h*(squish||1), r = Math.min(bw,bh)*0.28, hh = 28+(hue||0);
      ctx.fillStyle = `hsl(${hh}, 52%, 37%)`;
      roundRect(-bw/2, -bh/2, bw, bh, r); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = `hsl(${hh}, 55%, 27%)`; ctx.fillRect(-bw/2, bh*0.16, bw, bh);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ell(-bw*0.2, -bh*0.24, bw*0.17, bh*0.09, -0.4); ctx.fill();
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
    // above the platform, so poops resting on the platform stay level and stuck.
    // Pass lean=false while the tower is toppling (it falls straight instead).
    function drawStack(S, lean){
      const sway = clamp(S.pileSwayShown, -0.5, 0.5);
      const top = S.plat.y - S.plat.h/2;
      for(const c of S.stack){
        let dx = 0;
        if(lean){
          const above = Math.max(0, top - (c.y + c.h/2));  // height of its underside
          dx = sway * above * 0.5;
        }
        if(c.melting || c.melted) drawPuddle(c.x + dx, c.y, c.w, c.h);
        else drawPoop(c.x + dx, c.y, c.w, c.h, (c.rot||0), c.squish, c.hue);
      }
    }

    // The combat wombat, parameterised so any wombat can use it: wb carries
    // x, y (body centre), face (-1 left .. 1 right), strain (0..1), crawl (walk
    // cycle), wob, mode ('crawl', 'eat', ...), timer, blink. extras: angry
    // (brows + grimace), love (floating hearts), lift (raise the body but not
    // its effort marks — endless mode's level-up leap).
    function drawWombatArt(wb, scale, pal, extras){
      pal = pal || WB.PAL_PLAYER; scale = scale || 1; extras = extras || {};
      const t = now();
      const p = wb.strain||0, f = clamp(wb.face||0,-1,1), af = Math.abs(f), sg = f<0 ? -1 : 1;
      const blink = (wb.blink||0) > 0, mode = wb.mode || 'crawl', walking = mode === 'crawl';
      const ph = wb.crawl||0, angry = !!extras.angry;

      ctx.save();
      ctx.translate(wb.x, wb.y + FEET_BELOW*scale + (wb.wob||0)*0.2*scale - (extras.lift||0));
      ctx.scale(scale*WOMBAT_SIZE, scale*WOMBAT_SIZE);
      ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // a shake when forcing one out
      ctx.translate(p > 0.35 ? Math.sin(t*1.1)*(p-0.35)*7 : 0, 0);

      // feet shuffle while walking
      const lf = walking ? Math.max(0, Math.sin(ph))*8 : 0, rf = walking ? Math.max(0, -Math.sin(ph))*8 : 0;
      ell(-24 + f*8, -9 - lf, 18, 10); inked(pal.shade);
      ell(24 + f*8, -9 - rf, 18, 10); inked(pal.shade);
      // the rest bobs with each step and squashes down when straining
      ctx.translate(0, walking ? -Math.abs(Math.sin(ph))*6 : 0);
      ctx.scale(1 + p*0.08, 1 - p*0.1);

      // body, belly, arms
      ell(0, -46, 54, 40); inked(pal.fur);
      ctx.fillStyle = pal.belly; ell(f*12, -38, 31, 25); ctx.fill();
      const sw = walking ? Math.sin(ph)*5 : 0;
      ell(-50 + f*6, -44 + sw, 11, 16, 0.45); inked(pal.fur);
      ell(50 + f*6, -44 - sw, 11, 16, -0.45); inked(pal.fur);

      // ears (the far one shrinks as it turns)
      const hx = f*12, ex = 38*(1 - af*0.2);
      for(const side of [-1, 1]){
        const sc = (side === -sg && af > 0.2) ? 1 - af*0.35 : 1;
        ell(hx + side*ex, -130, 12*sc, 16*sc, side*0.35); inked(pal.fur);
        ctx.fillStyle = pal.earIn; ell(hx + side*ex, -128, 6*sc, 9*sc, side*0.35); ctx.fill();
      }

      // head, with the headband across the top
      ell(hx, -96, 58, 44); ctx.fillStyle = pal.fur; ctx.fill();
      ctx.save(); ell(hx, -96, 58, 44); ctx.clip();
      ctx.fillStyle = pal.band; ctx.fillRect(hx - 70, -132, 140, 17);
      ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(hx - 70, -132); ctx.lineTo(hx + 70, -132); ctx.moveTo(hx - 70, -115); ctx.lineTo(hx + 70, -115);
      ctx.stroke();
      ctx.restore();
      ell(hx, -96, 58, 44); ctx.stroke();
      // band tails flap out behind the turn
      const tx = hx - sg*54, fl = Math.sin(t*0.22)*6, fl2 = Math.cos(t*0.22)*6;
      ctx.beginPath(); ctx.moveTo(tx, -124); ctx.lineTo(tx - sg*28, -132 + fl); ctx.lineTo(tx - sg*24, -118 + fl); ctx.closePath(); inked(pal.band);
      ctx.beginPath(); ctx.moveTo(tx, -120); ctx.lineTo(tx - sg*22, -104 + fl2); ctx.lineTo(tx - sg*12, -100 + fl2); ctx.closePath(); inked(pal.band);
      ell(hx + f*22, -123, 6.5, 6.5); inked(pal.dot);

      // muzzle and the big nose
      const mx = hx + f*22;
      ell(mx, -76, 31, 21); inked(pal.belly);
      roundRect(mx + f*4 - 16, -97, 32, 19, 9); inked('#3a2820');
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ell(mx + f*4 - 6, -92, 5, 2.5); ctx.fill();

      // eyes and brows do the acting
      const ecx = hx + f*16, sep = 25*(1 - af*0.3);
      for(const side of [-1, 1]){
        const exx = ecx + side*sep;
        const sc = (side === -sg && af > 0.15) ? 1 - af*0.35 : 1;
        if(p > 0.55 || blink){
          ctx.lineWidth = 4; ctx.beginPath();
          if(p > 0.55){ ctx.moveTo(exx + side*8*sc, -112); ctx.lineTo(exx - side*5*sc, -106); ctx.lineTo(exx + side*8*sc, -100); }  // >< squeezed shut
          else ctx.arc(exx, -110, 8*sc, 0.2*Math.PI, 0.8*Math.PI);
          ctx.stroke();
        } else {
          ctx.lineWidth = 3; ell(exx, -106, 10*sc, 12.5*sc); inked('#fff');
          ctx.fillStyle = INK; ell(exx + f*4, -104 + (p > 0.3 ? 2 : 0), 5*sc, 6.5*sc); ctx.fill();
          ctx.fillStyle = '#fff'; ell(exx + f*4 + 2, -107, 1.8, 1.8); ctx.fill();
        }
        ctx.lineWidth = 4.5; ctx.beginPath();
        if(p > 0.35 || angry){ ctx.moveTo(exx + side*12, -126); ctx.lineTo(exx - side*7, -119); }   // dug in
        else { ctx.moveTo(exx - 9, -122); ctx.quadraticCurveTo(exx, -127, exx + 9, -122); }         // relaxed
        ctx.stroke();
      }

      // mouth
      if(mode === 'eat'){
        const open = Math.abs(Math.sin((wb.timer||0)*0.5));       // chomping: 0 shut .. 1 wide
        ctx.lineWidth = 3.5; ell(mx, -66, 12, 3 + open*10); inked('#5a2a22');
        ctx.fillStyle = '#e07b7b'; ell(mx, -62 + open*4, 7, 2 + open*3); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(mx - 8, -66 - (3 + open*10) + 1, 4, 3); ctx.fillRect(mx + 4, -66 - (3 + open*10) + 1, 4, 3);
      } else if(p > 0.5 || angry){
        ctx.lineWidth = 3.5; roundRect(mx - 11, -70, 22, 10 + p*4, 5); inked('#5a2a22');
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx - 7, -66); ctx.lineTo(mx + 7, -66); ctx.stroke();
        ctx.strokeStyle = INK;
      } else {
        ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(mx, -74, 9, 0.2*Math.PI, 0.8*Math.PI); ctx.stroke();
      }
      ctx.lineWidth = 4.5;

      // cheeks flush with effort
      if(!angry || p > 0.4){
        ctx.fillStyle = `rgba(255,110,100,${0.22 + p*0.45})`;
        ell(ecx - sep - 8, -84, 9, 5.5); ctx.fill(); ell(ecx + sep + 8, -84, 9, 5.5); ctx.fill();
      }
      // sweat bead when really straining
      if(p > 0.6){
        const yy = -136 + ((t*1.2) % 26)/26*12;
        ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(hx + 46, yy - 8); ctx.quadraticCurveTo(hx + 53, yy + 2, hx + 46, yy + 4); ctx.quadraticCurveTo(hx + 39, yy + 2, hx + 46, yy - 8);
        inked('#9fe3ff');
      }
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

    // a wooden board: flat wood, a darker lower edge, a highlight, an outline
    function plank(x, y, w, h, r, grainStep, grainStart){
      ctx.fillStyle = '#c98b4a'; roundRect(x, y, w, h, r); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#9c6531'; ctx.fillRect(x, y + h*0.62, w, h);
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
      plank(-plat.w/2, -plat.h/2, plat.w, plat.h, 10, 44, 22);
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
      // ruffled leaf: the outer ring outlined, the heart drawn over it
      for(let i=0;i<6;i++){
        const a = i/6*Math.PI*2;
        ell(Math.cos(a)*7, Math.sin(a)*5, 9, 7, a); inked('#6cbf38');
      }
      ctx.fillStyle = '#6cbf38'; ell(0, 0, 11, 9); ctx.fill();
      ell(0, -1, 8, 7); inked('#b2e875');
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

    return { roundRect, drawButton, drawRoundButton, drawPoop, drawPuddle, drawStack, drawWombatArt, drawPlatform, drawTopPlat,
             drawLettuce, drawDiarrhea, drawParticles, drawGround, drawGoalLine };
  };
})();
