// Drawing shared by both modes. WB.createArt(ctx, now) returns the drawing
// functions bound to one canvas context; `now()` gives the current frame count
// for anything animated (wombat headband tails, spinning stars, the goal line).
(() => {
  const { W, H, topPlat, clamp } = WB;

  WB.PAL_PLAYER = { body:'#8a6a4f', belly:'#a88465', ear:'#7a5c44', earIn:'#c39b7d',
                    foot:'#6b4f3a', band:'#3d6b2e', dot:'#e74c3c' };
  WB.PAL_RIVAL  = { body:'#6d6058', belly:'#8b7d72', ear:'#5d534c', earIn:'#a99a8d',
                    foot:'#544a44', band:'#8a2a12', dot:'#f0c419' };
  WB.PAL_MATE   = { body:'#9a6f57', belly:'#c39079', ear:'#87604c', earIn:'#e0b49b',
                    foot:'#75543f', band:'#c94f8a', dot:'#fff0f6' };

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

    function drawPoop(x,y,w,h,rot,squish,hue){
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(rot||0);
      const bw = w, bh = h*(squish||1);
      // body
      const base = `hsl(${28+(hue||0)}, 55%,`;
      const g = ctx.createLinearGradient(0,-bh/2,0,bh/2);
      g.addColorStop(0, `${base} 42%)`);
      g.addColorStop(1, `${base} 28%)`);
      ctx.fillStyle = g;
      roundRect(-bw/2, -bh/2, bw, bh, Math.min(bw,bh)*0.28);
      ctx.fill();
      // shine
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      roundRect(-bw/2+bw*0.14, -bh/2+bh*0.12, bw*0.34, bh*0.2, 6);
      ctx.fill();
      // a couple of darker lumps for texture (no face)
      ctx.fillStyle = 'rgba(0,0,0,.10)';
      ctx.beginPath(); ctx.arc(bw*0.16, bh*0.12, bw*0.12, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(-bw*0.2, bh*0.02, bw*0.08, 0, 7); ctx.fill();
      ctx.restore();
    }

    // a melted cube: a glossy flat puddle of diarrhea
    function drawPuddle(x, y, w, h){
      ctx.save();
      ctx.translate(x, y);
      const g = ctx.createLinearGradient(0,-h/2,0,h/2);
      g.addColorStop(0,'#8a6a2a'); g.addColorStop(1,'#5e451c');
      ctx.fillStyle = g;
      roundRect(-w/2, -h/2, w, h, h/2); ctx.fill();
      // drips down the sides
      ctx.fillStyle = '#5e451c';
      ctx.beginPath(); ctx.arc(-w*0.3, h/2, 4, 0, 7); ctx.arc(w*0.28, h/2+2, 5, 0, 7); ctx.fill();
      // shine
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      roundRect(-w*0.32, -h*0.28, w*0.3, h*0.3, 4); ctx.fill();
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
    // x, y, face, strain, crawl, wob, mode, timer, blink. extras: angry (brows +
    // grimace), love (floating hearts), lift (raise the body but not its effort
    // marks — endless mode's level-up leap).
    function drawWombatArt(wb, scale, pal, extras){
      pal = pal || WB.PAL_PLAYER; scale = scale || 1; extras = extras || {};
      const t = now();
      const push  = wb.strain||0;                     // 0..1 pushing effort
      const turn  = clamp(wb.face||0,-1,1);           // -1 left .. +1 right
      const tt    = Math.abs(turn);
      const s     = turn<0?-1:1;                      // facing side
      const blink = (wb.blink||0) > 0;
      const mode  = wb.mode || 'crawl';

      ctx.save();
      ctx.translate(wb.x, wb.y + (wb.wob||0)*0.2 - (extras.lift||0));
      ctx.scale(scale, scale);
      // scrunch: shake, squash down and widen when forcing one out
      const shakeX = push>0.35 ? Math.sin(t*1.1)*(push-0.35)*6 : 0;
      ctx.translate(shakeX, push*4);
      ctx.scale(1+push*0.07, 1+push*0.14);

      const bw = 140*(1-tt*0.10);                     // body narrows a touch when turned
      const step = Math.sin(wb.crawl||0) * (mode==='crawl' ? 8 : 0);

      // feet (behind body)
      ctx.fillStyle=pal.foot;
      ctx.beginPath();
      ctx.arc(-30+step, 52-Math.max(0,step)*0.4, 14, 0, 7);
      ctx.arc(30-step, 52-Math.max(0,-step)*0.4, 14, 0, 7); ctx.fill();
      // trailing front paw reaching when crawling
      if(mode==='crawl'){ ctx.fillStyle=pal.ear;
        ctx.beginPath(); ctx.arc(-52*s+step*0.5, 30, 11, 0, 7); ctx.fill(); }

      // body, and a belly that drifts toward the side it's facing
      ctx.fillStyle=pal.body; roundRect(-bw/2,-52,bw,104,44); ctx.fill();
      ctx.fillStyle=pal.belly; roundRect(-46+turn*12,-20,92*(1-tt*0.12),66,34); ctx.fill();

      // ears — far ear tucks smaller behind the head
      const earNearX=48*s, earFarX=-30*s, farScale=1-tt*0.55;
      ctx.fillStyle=pal.ear;   ctx.beginPath(); ctx.arc(earFarX,-50,20*farScale,0,7); ctx.fill();
      ctx.fillStyle=pal.earIn; ctx.beginPath(); ctx.arc(earFarX,-50,10*farScale,0,7); ctx.fill();
      ctx.fillStyle=pal.ear;   ctx.beginPath(); ctx.arc(earNearX,-50,20,0,7); ctx.fill();
      ctx.fillStyle=pal.earIn; ctx.beginPath(); ctx.arc(earNearX,-50,10,0,7); ctx.fill();

      // combat headband + knot + trailing tails
      ctx.fillStyle=pal.band; roundRect(-72,-46,144,16,8); ctx.fill();
      ctx.fillStyle=pal.dot;  ctx.beginPath(); ctx.arc(turn*10,-38,7,0,7); ctx.fill();
      ctx.strokeStyle=pal.band; ctx.lineWidth=8; ctx.lineCap='round';
      const tailX=-66*s;
      ctx.beginPath(); ctx.moveTo(tailX,-40); ctx.lineTo(tailX-30*s,-24+Math.sin(t*0.2)*6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tailX,-36); ctx.lineTo(tailX-26*s,-6+Math.cos(t*0.2)*6); ctx.stroke();

      // snout pokes out toward the facing side when turned
      if(tt>0.15){
        ctx.fillStyle=pal.body;
        ctx.beginPath(); ctx.ellipse(s*(bw/2-4),4,10*tt+8,15,0,0,7); ctx.fill();
        ctx.fillStyle='#4a3220';
        ctx.beginPath(); ctx.ellipse(s*(bw/2+6*tt),0,6,5,0,0,7); ctx.fill();
      }

      // eye layout: both shift toward the turn, trailing eye shrinks
      const eyeCX=turn*16, sep=26*(1-tt*0.32);
      const eyeLX=eyeCX-sep, eyeRX=eyeCX+sep;
      const lScale = turn>0 ? 1-tt*0.5 : 1;           // facing right => left eye trails
      const rScale = turn<0 ? 1-tt*0.5 : 1;

      // brows dig in when pushing (or permanently, for a rival)
      if(push>0.35 || extras.angry){
        ctx.strokeStyle='#4a3220'; ctx.lineWidth=5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(eyeLX-11,-30); ctx.lineTo(eyeLX+7,-23); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(eyeRX+11,-30); ctx.lineTo(eyeRX-7,-23); ctx.stroke();
      }
      // eyes — squeezed shut when pushing hard or blinking, else open
      const drawEye=(ex,sc)=>{
        if(sc<=0.02) return;
        if(blink || push>0.55){
          ctx.strokeStyle='#222'; ctx.lineWidth=3.2*sc; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(ex-9*sc,-17); ctx.lineTo(ex,-12); ctx.lineTo(ex+9*sc,-17); ctx.stroke(); // >< pinch
        } else {
          ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex,-14,12*sc,0,7); ctx.fill();
          ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(ex+turn*3,-14+(push>0.3?3:0),6*sc,0,7); ctx.fill();
        }
      };
      drawEye(eyeLX,lScale); drawEye(eyeRX,rScale);

      // effort blush on the cheeks
      if(push>0.4){
        ctx.fillStyle=`rgba(230,90,70,${(push-0.4)*0.8})`;
        ctx.beginPath(); ctx.arc(eyeLX-3,4,9,0,7); ctx.arc(eyeRX+3,4,9,0,7); ctx.fill();
      }
      // nose (only when facing forward; the snout carries it when turned)
      if(tt<0.5){
        ctx.globalAlpha = Math.max(0, 1-tt*2);
        ctx.fillStyle='#4a3220'; roundRect(-10+turn*8,-4,20,14,6); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // mouth
      ctx.lineCap='round';
      if(mode==='eat'){
        // chomping: mouth opens and snaps shut
        const open=Math.abs(Math.sin((wb.timer||0)*0.5));      // 0 (shut) .. 1 (wide)
        ctx.fillStyle='#6e2b2b'; ctx.beginPath(); ctx.ellipse(0,13,12,3+open*11,0,0,7); ctx.fill();
        ctx.fillStyle='#d67b7b'; ctx.beginPath(); ctx.ellipse(0,16+open*4,7,2+open*3,0,0,7); ctx.fill();  // tongue
        ctx.fillStyle='#fff'; ctx.fillRect(-8,13-(3+open*11),4,3); ctx.fillRect(4,13-(3+open*11),4,3);   // little teeth
      } else if(push>0.5 || extras.angry){
        // strained, gritted grimace
        ctx.fillStyle='#5a3a24'; ctx.beginPath(); ctx.ellipse(turn*6,17,9,6+push*4,0,0,7); ctx.fill();
        ctx.strokeStyle='#fff'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(turn*6-7,15); ctx.lineTo(turn*6+7,15); ctx.stroke();
      } else {
        ctx.strokeStyle='#4a3220'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.arc(turn*6,10,12,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
      }
      // sweat bead when really straining
      if(push>0.6){
        ctx.fillStyle='#7fd7ff';
        const sy=-32+((t*1.2)%26)/26*12;
        ctx.beginPath(); ctx.arc(eyeRX+20,sy,5,0,7); ctx.fill();
      }
      ctx.restore();

      // effort marks floating around the head
      if(push>0.45){
        ctx.fillStyle='#e74c3c'; ctx.font='bold 34px "Comic Sans MS", cursive'; ctx.textAlign='left';
        ctx.fillText('!', wb.x+84*scale, wb.y-30*scale-push*6);
        ctx.fillText('💨', wb.x-124*scale, wb.y+30*scale);
      }
      if(extras.love){
        ctx.font=(20*Math.max(scale,0.6))+'px serif'; ctx.textAlign='center';
        ctx.fillText('💗', wb.x+52*scale, wb.y-52*scale+Math.sin(t*0.1)*3);
        ctx.fillText('💗', wb.x-52*scale, wb.y-44*scale+Math.cos(t*0.12)*3);
      }
    }

    // the catch platform on its pole
    function drawPlatform(plat){
      ctx.save();
      ctx.translate(plat.x, plat.y);
      // pole
      ctx.fillStyle='#7a5230';
      ctx.fillRect(-8, plat.h/2, 16, H);
      // board
      const g = ctx.createLinearGradient(0,-plat.h/2,0,plat.h/2);
      g.addColorStop(0,'#c98b4a'); g.addColorStop(1,'#9c6531');
      ctx.fillStyle = g;
      roundRect(-plat.w/2,-plat.h/2,plat.w,plat.h,10); ctx.fill();
      ctx.strokeStyle='#6f451f'; ctx.lineWidth=3; ctx.stroke();
      // plank grain
      ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=2;
      for(let gx=-plat.w/2+22; gx<plat.w/2; gx+=44){
        ctx.beginPath(); ctx.moveTo(gx,-plat.h/2+3); ctx.lineTo(gx,plat.h/2-3); ctx.stroke();
      }
      ctx.restore();
    }

    // the plank the wombat crawls along, raised by `hop` during a level-up leap
    function drawTopPlat(hop){
      ctx.save();
      ctx.translate(topPlat.x, topPlat.y - (hop||0));
      // support posts
      ctx.fillStyle = '#6f451f';
      ctx.fillRect(-topPlat.w/2+10, topPlat.h/2, 14, 40);
      ctx.fillRect(topPlat.w/2-24, topPlat.h/2, 14, 40);
      // plank
      const g = ctx.createLinearGradient(0,-topPlat.h/2,0,topPlat.h/2);
      g.addColorStop(0,'#c98b4a'); g.addColorStop(1,'#9c6531');
      ctx.fillStyle = g;
      roundRect(-topPlat.w/2,-topPlat.h/2,topPlat.w,topPlat.h,8); ctx.fill();
      ctx.strokeStyle='#6f451f'; ctx.lineWidth=3; ctx.stroke();
      // plank lines
      ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=2;
      for(let x=-topPlat.w/2+40; x<topPlat.w/2; x+=70){
        ctx.beginPath(); ctx.moveTo(x,-topPlat.h/2+2); ctx.lineTo(x,topPlat.h/2-2); ctx.stroke();
      }
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
      // ruffled leaf
      ctx.fillStyle = '#7cc743';
      for(let i=0;i<6;i++){
        const a = i/6*Math.PI*2;
        ctx.beginPath(); ctx.ellipse(Math.cos(a)*7, Math.sin(a)*5, 9, 7, a, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#a6e06a';
      ctx.beginPath(); ctx.arc(0, -1, 9, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4f8a24'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,6); ctx.stroke();
      ctx.restore();
    }

    // hot drops falling onto the tower (world y, shifted by the camera)
    function drawDiarrhea(drops, camOffset){
      for(const d of drops){
        ctx.save();
        ctx.translate(d.x, d.y + (camOffset||0));
        ctx.fillStyle = '#6f4e1a';
        ctx.beginPath();
        ctx.ellipse(0, 0, d.r*0.8, d.r*1.15, 0, 0, 7);   // teardrop-ish blob
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.3)';
        ctx.beginPath(); ctx.arc(-d.r*0.25, -d.r*0.3, d.r*0.22, 0, 7); ctx.fill();
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
      for(let i=0;i<24;i++){
        const gx = i*32 - 30;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx+7, gy-16); ctx.lineTo(gx+14, gy); ctx.fill();
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
      ctx.font = 'bold 19px "Comic Sans MS", cursive';
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
      ctx.fillStyle=edge; ctx.font='bold '+size+'px "Comic Sans MS",cursive'; ctx.textAlign='center';
      ctx.fillText(label, b.x+b.w/2, b.y+b.h/2+size*0.36);
      ctx.restore();
    }

    // the round in-game button: b = {x,y,r}, icon 'pause' (two bars) or 'menu' (three lines)
    function drawRoundButton(b, icon){
      ctx.save();
      ctx.fillStyle='rgba(255,255,255,.78)'; ctx.strokeStyle='#2d5016'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#2d5016';
      if(icon === 'menu'){
        for(let i=-1;i<=1;i++){ roundRect(b.x-10, b.y+i*7-1.5, 20, 3.5, 1.7); ctx.fill(); }
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
