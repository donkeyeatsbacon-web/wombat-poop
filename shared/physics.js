// Poop physics shared by both modes: falling plops, the pile on the catch
// platform, its wobble, the diarrhea hazard and particles.
//
// Everything works on a "run" (S): one go at stacking — the platform, the pile,
// whatever is in the air, the wombat up top and its hazards. Endless mode keeps
// one run per game; the campaign makes a fresh one per level. Each mode plugs in
// its own rules through:
//   S.tune  — pile physics numbers (the two modes are tuned differently)
//   S.hooks — onSettle(p), onMiss(), nextPoopAt(t), and optional hop() for the
//             level-up leap that lifts the top platform in endless mode
// S.camOffset is the vertical camera scroll (endless climbs; the campaign is 0).
(() => {
  const { W, H, GRAV, SMALL_CUBE, topPlat, rand, clamp } = WB;

  WB.newRun = function(t, { platW, tune, hooks }){
    const plat = {
      w: platW, h: 26, x: W/2, y: H - 70, speed: 9,
      baseW: platW, shrink: 0, shrinkTimer: 0   // diarrhea can shrink the platform for a while
    };
    return {
      plat,
      wombat: {
        x: W/2, y: topPlat.y - 62, dir: 1, wob: 0, strain: 0, blink: 0, crawl: 0,
        face: 0,          // -1 = facing left, +1 = facing right, 0 = facing forward
        mode: 'crawl',    // crawl -> prep -> push -> recover (plus seek/eat for lettuce)
        timer: 0
      },
      plops: [],          // falling poop cubes
      stack: [],          // caught cubes resting on platform
      particles: [],
      misses: 0,
      nextSpawn: t + 70,  // frame index of next poop (random intervals)
      shake: 0, comboFlash: 0,
      // lettuce / diarrhea hazard
      lettuce: null,                          // {x,y,vy,landed} a leaf that lands by the wombat
      diarrhea: [],                           // hot liquid drops the wombat sprays
      diarrheaTimer: 0, diarrheaSpawn: 0, diarrheaX: 0,   // drips from a fixed spot
      pileCOMx: W/2,                          // horizontal centre of mass of the pile
      pileSway: 0, pileSwayV: 0,              // dynamic lean of the whole pile (the wobble)
      pileSwayShown: 0,                       // smoothed value used for drawing
      camOffset: 0,
      raiseBaseY: plat.y - plat.h/2,          // pile height (and so wobble) is measured from here
      tune, hooks
    };
  };

  // how far endless mode's level-up leap is lifting the top platform right now
  WB.hopOf = S => S.hooks.hop ? S.hooks.hop() : 0;

  // ---------- Particles ----------
  WB.puff = function(x,y,color){
    return { x, y, vx: rand(-2,2), vy: rand(-3,-0.5), life: rand(18,34), max:34,
             r: rand(3,8), color, kind:'puff' };
  };
  WB.splat = function(S,x,y){
    for(let i=0;i<14;i++){
      S.particles.push({ x, y, vx: rand(-5,5), vy: rand(-7,-1), life: rand(20,40), max:40,
        r: rand(4,11), color:'#6f4a24', kind:'splat', g: .35 });
    }
  };
  WB.star = function(S,x,y){
    for(let i=0;i<10;i++){
      const a = Math.random()*Math.PI*2, s = rand(2,6);
      S.particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 2, life: rand(20,36), max:36,
        r: rand(3,7), color: ['#ffe14d','#ff9ff3','#7bed9f','#70a1ff'][i%4], kind:'star', g:.15 });
    }
  };
  WB.updateParticles = function(list){
    for(let i=list.length-1;i>=0;i--){
      const pt = list[i];
      pt.x += pt.vx; pt.y += pt.vy;
      if(pt.g) pt.vy += pt.g;
      pt.vx *= 0.98;
      pt.life--;
      if(pt.life<=0) list.splice(i,1);
    }
  };

  // ---------- Stacking (real 2D piling) ----------
  // A poop rests on whatever is highest under its footprint — the platform,
  // a single poop, or bridging across several. Positions are stored as an
  // x-offset from the platform centre, so the whole pile rides the platform.
  const platTop = WB.platTop = S => S.plat.y - S.plat.h/2;

  // world y of the highest point of the pile (before camera offset)
  WB.stackTopWorldY = function(S){
    let top = platTop(S);
    for(const c of S.stack){ const ct = c.y - c.h/2; if(ct < top) top = ct; }
    return top;
  };

  // What a poop with the given bottom edge is ACTUALLY resting on: the span of
  // platform/poop tops that sit right at `bottom`. null if nothing is there
  // (so a poop perched on a sliver over air won't be treated as supported).
  function restingSupport(S, off, w, bottom){
    const plat = S.plat;
    const l = off - w/2, r = off + w/2;
    let supL = Infinity, supR = -Infinity, found = false;
    if(Math.abs(platTop(S) - bottom) < 5 && r > -plat.w/2 && l < plat.w/2){
      supL = Math.max(l, -plat.w/2); supR = Math.min(r, plat.w/2); found = true;
    }
    for(const c of S.stack){
      if(Math.abs((c.y - c.h/2) - bottom) < 5){
        const ol = Math.max(l, c.off - c.w/2), or = Math.min(r, c.off + c.w/2);
        if(or - ol > 2){ supL = Math.min(supL, ol); supR = Math.max(supR, or); found = true; }
      }
    }
    return found ? { supL, supR } : null;
  }

  // Box-collide a falling poop against the platform and stacked poops: push it
  // out of any overlap (rest on tops, stop against sides) so it never passes
  // through anything. Returns true if it's resting on something from above.
  function collideFallingPoop(S, p){
    const plat = S.plat;
    let resting = false, pushedL = false, pushedR = false, wedgeTop = Infinity;
    let gapL = -Infinity, gapR = Infinity;
    const hit = (ox, oy, ow, oh) => {
      const dx = p.x - ox, dy = p.y - oy;
      const px = (p.w/2 + ow/2) - Math.abs(dx);
      const py = (p.h/2 + oh/2) - Math.abs(dy);
      if(px <= 0 || py <= 0) return;
      p._touched = true;
      // only "land on top" when the poop's centre is actually over this object;
      // a poop merely grazing a top corner gets shoved off so it keeps falling
      const centreOver = Math.abs(dx) <= ow/2 + p.w*0.1;
      if(py <= px && centreOver){
        if(dy < 0){                                 // resting on its top
          p.y -= py;
          if(p.vy > 0) p.vy *= -0.12;               // tiny bounce
          if(Math.abs(p.vy) < 0.5) p.vy = 0;
          p.vx *= 0.6;                              // friction
          resting = true;
        } else { p.y += py; if(p.vy < 0) p.vy = 0; }
      } else {                                      // side / corner contact — shove off, don't perch
        if(dx < 0){ p.x -= px; pushedL = true; gapR = Math.min(gapR, ox - ow/2); }
        else       { p.x += px; pushedR = true; gapL = Math.max(gapL, ox + ow/2); }
        p.vx = (dx < 0 ? -1 : 1) * Math.max(Math.abs(p.vx)*0.3, 0.6);
        wedgeTop = Math.min(wedgeTop, oy - oh/2);
      }
    };
    hit(plat.x, plat.y, plat.w, plat.h);
    for(const c of S.stack){
      if(Math.abs(c.y - p.y) < 220 && Math.abs((plat.x + c.off) - p.x) < 200){
        hit(plat.x + c.off, c.y, c.w, c.h);
      }
    }
    // squeezed from both sides — too fat for that gap, so it rides on top,
    // centred between its neighbours instead of jittering between them
    if(pushedL && pushedR && isFinite(wedgeTop)){
      if(isFinite(gapL) && isFinite(gapR)) p.x = (gapL + gapR) / 2;
      p.y = wedgeTop - p.h/2; p.vy = 0; p.vx = 0; resting = true;
    }
    return resting;
  }

  // highest support surface (smallest y) directly under a thin column at world x
  function supportHeightAt(S, x){
    const plat = S.plat;
    let top = Infinity;
    if(x > plat.x - plat.w/2 && x < plat.x + plat.w/2) top = platTop(S);
    for(const c of S.stack){
      const cx = plat.x + c.off;
      if(Math.abs(x - cx) < c.w/2){ const ct = c.y - c.h/2; if(ct < top) top = ct; }
    }
    return top;
  }

  // A falling poop has come to rest — freeze it into the pile where it lies,
  // tilted to match uneven support so it can sit crooked between others.
  function settlePoop(S, p){
    const off = p.x - S.plat.x;
    // how close to the edge of its support it sits feeds the pile's nervous
    // sway; the campaign skips the measurement and treats every poop alike
    let tip = 0.5;
    if(S.tune.measureTip){
      const sup = restingSupport(S, off, p.w, p.y + p.h/2);
      if(sup){ const edge = Math.min(off - sup.supL, sup.supR - off); tip = clamp(1 - edge / Math.max(6, p.w*0.5), 0, 1); }
    }
    // Settle level by default. Only sit crooked when BOTH sides are genuinely
    // in contact with support at clearly different heights (a real wedge/bridge)
    // — not when one sample just straddles the edge of the poop below.
    const bottom = p.y + p.h/2;
    const lh = supportHeightAt(S, p.x - p.w*0.3), rh = supportHeightAt(S, p.x + p.w*0.3);
    const lContact = isFinite(lh) && Math.abs(lh - bottom) < 12;
    const rContact = isFinite(rh) && Math.abs(rh - bottom) < 12;
    let rot = 0;
    if(lContact && rContact && Math.abs(rh - lh) > 12){
      rot = clamp((rh - lh) / p.w, -0.3, 0.3);       // gentle slope, real bridges only
    }
    S.stack.push({ off, x: p.x, y: p.y, w: p.w, h: p.h, hue: p.hue, squish: 1.3, rot, tip });
    if(S.hooks.onSettle) S.hooks.onSettle(p);
    WB.sfx('land', p.w);
    S.comboFlash = 12;
    WB.star(S, p.x, p.y + S.camOffset);
    S.shake = Math.min(S.shake + 3, 10);
  }

  // Falling plops: simple box physics + real collisions, settling into the
  // pile, and misses off the bottom of the screen.
  WB.stepPlops = function(S){
    const plat = S.plat, tune = S.tune;
    for(let i=S.plops.length-1;i>=0;i--){
      const p = S.plops[i];
      p.vy = Math.min(p.vy + GRAV*tune.fallMul, tune.maxFallV);
      p.vx *= 0.99;
      p.x += p.vx; p.y += p.vy;
      p.rot = (p.rot||0) + (p.vr||0);
      p.vr = (p.vr||0) * 0.92;
      p.squish += (1 - p.squish)*0.2;

      // collide with the platform and stacked poops (rest on tops, stop on sides)
      p._touched = false;
      const resting = collideFallingPoop(S, p);
      // sustained contact without settling means it's jammed in an awkward gap —
      // park it on top of whatever is under it so it can never jitter forever
      p.contact = p._touched ? (p.contact||0) + 1 : Math.max(0, (p.contact||0) - 2);
      if(p.contact > 40){
        const top = supportHeightAt(S, p.x);   // must be supported under its centre
        if(isFinite(top)){
          p.y = top - p.h/2; p.vx = 0; p.vy = 0;
          settlePoop(S, p); S.plops.splice(i,1); continue;
        }
      }

      // decide whether it can settle where it landed
      if(resting && Math.abs(p.vy) < 0.6 && Math.abs(p.vx) < 0.6){
        const off = p.x - plat.x;
        const sup = restingSupport(S, off, p.w, p.y + p.h/2);  // what it's really on
        let committing = false;
        if(sup){
          const leftOver  = sup.supL - (off - p.w/2);
          const rightOver = (off + p.w/2) - sup.supR;
          if(leftOver <= p.w*0.33 && rightOver <= p.w*0.33){   // sitting mostly ON its support
            committing = true;
            p.stuck = 0;
            p.settle = (p.settle||0) + 1;
            if(p.settle >= 3){ settlePoop(S, p); S.plops.splice(i,1); continue; }
          }
        }
        if(!committing){
          // resting but can't commit here (overhanging / perched on a corner) —
          // shove it off decisively so it FALLS instead of hovering in the air
          p.settle = 0;
          p.stuck = (p.stuck||0) + 1;
          let dir;
          if(sup) dir = ((off + p.w/2) - sup.supR) > (sup.supL - (off - p.w/2)) ? 1 : -1;
          else    dir = (off >= 0 ? 1 : -1);
          p.x += dir * (2.2 + Math.min(p.stuck, 8) * 0.6);
          p.vx = dir * Math.max(Math.abs(p.vx), 2);
          if(p.stuck > 1) p.vy = Math.max(p.vy, 1.4);          // guarantee it drops away fast
        }
      } else { p.settle = 0; p.stuck = 0; }
      // fell past the bottom of the screen
      if(p.y + S.camOffset - p.h/2 > H){
        S.plops.splice(i,1);
        if(p.collapsed){ continue; }   // knocked loose by diarrhea, not a real miss
        S.misses++;
        WB.splat(S, p.x, H-6);
        WB.sfx('splat');
        S.shake = Math.min(S.shake+6, 14);
        S.hooks.onMiss();
        continue;
      }
    }
  };

  // Melting, collapse and the wobble of the pile. Returns where the leaning
  // mass effectively sits relative to the platform centre (+ = right), or null
  // when there's no pile. Each mode decides for itself when that's a topple.
  WB.updateStack = function(S, t){
    const plat = S.plat, tune = S.tune;
    for(const c of S.stack){
      c.squish += (1 - c.squish) * 0.18; c.x = plat.x + c.off;
      // a cube hit by diarrhea melts down into a flat puddle of its own
      if(c.melting){
        c.meltT++;
        const p = Math.min(1, c.meltT/28);
        c.h = c.origH * (1 - p*0.82);        // shrink almost flat
        c.w = c.origW * (1 + p*0.22);        // spread out
        c.y = c.bottomY - c.h/2;             // keep its bottom planted
        if(p >= 1){ c.melting = false; c.melted = true; c.tip = 0; }
      }
    }
    // if a cube's support melted out from under it, don't leave it floating —
    // let it drop and re-settle (a little collapse) instead of hanging in the air.
    // Re-scan until stable so an entire chain collapses in one frame (no lag).
    let changed = true, guard = 0;
    while(changed && guard++ < 20){
      changed = false;
      for(let i=S.stack.length-1;i>=0;i--){
        const c = S.stack[i];
        if(c.melting) continue;
        const bottom = c.y + c.h/2;
        let supported = Math.abs(bottom - platTop(S)) < 6 && c.off > -plat.w/2 && c.off < plat.w/2;
        if(!supported){
          for(const d of S.stack){
            if(d === c || d.melting) continue;
            const ov = Math.min(c.off+c.w/2, d.off+d.w/2) - Math.max(c.off-c.w/2, d.off-d.w/2);
            if(ov > 4 && Math.abs((d.y - d.h/2) - bottom) < 6){ supported = true; break; }
          }
        }
        if(!supported){
          S.plops.push({ x: plat.x + c.off, y: c.y, w: c.w, h: c.h, vx: rand(-0.5,0.5), vy: 0.5,
            rot: c.rot||0, vr: rand(-0.1,0.1), squish: 1, hue: c.hue||0, collapsed: true });
          S.stack.splice(i, 1); changed = true;
        }
      }
    }
    if(!S.stack.length){
      S.pileCOMx = plat.x;
      S.pileSway *= 0.8; S.pileSwayV *= 0.8; S.pileSwayShown *= 0.8;
      return null;
    }
    // centre of mass, height, and how precarious the pile is overall
    let m=0, mx=0, topY=platTop(S), tipSum=0;
    for(const c of S.stack){
      const w = c.w*c.h; m += w; mx += w*(plat.x + c.off);
      if(c.y - c.h/2 < topY) topY = c.y - c.h/2;
      tipSum += (c.tip||0);
    }
    S.pileCOMx = mx/m;
    // height measured from the CURRENT level's base, so the wobble feels the
    // same every level (not more wobbly just because the world tower is taller)
    const pileH = Math.max(0, S.raiseBaseY - topY);
    const hFactor = clamp(pileH/500, 0, 1.3);
    const comOff = S.pileCOMx - plat.x;                // + = heavy to the right
    const instability = clamp(tipSum*0.12 + hFactor*0.28, 0, 2);

    // A pile is rock-solid while its mass sits in the safe middle of the
    // platform; only the part of the imbalance that pushes toward the edge
    // drives the lean over. So an off-centre-but-supported poop won't topple.
    const safe = plat.w * 0.36;
    const excess = Math.sign(comOff) * Math.max(0, Math.abs(comOff) - safe);
    S.pileSwayV += excess * tune.swayPush * (0.6 + hFactor);
    S.pileSwayV += Math.sin(t*0.11) * instability * tune.nervous;   // gentle nervous sway (visual life)
    const restore = clamp(tune.restoreMax - instability*tune.restoreInstab, tune.restoreMin, tune.restoreMax);
    S.pileSwayV -= S.pileSway * restore;
    S.pileSwayV *= tune.damping;
    S.pileSway += S.pileSwayV;
    S.pileSwayShown += (S.pileSway - S.pileSwayShown) * 0.18;   // smooth, lagged value is what gets drawn

    const leverage = S.pileSway * (50 + Math.min(pileH, 700) * 0.14);
    return comOff + leverage;                          // where the leaning mass really is
  };

  // ---------- Lettuce & diarrhea hazard ----------
  // Whoever supplies the lettuce (endless: it falls from the sky; campaign:
  // rivals roll it along the plank), the rest plays out the same way.

  // highest surface directly under a drop at platform-offset offX: a cube top,
  // the platform, or null (nothing there)
  function diarrheaSurface(S, offX){
    const plat = S.plat;
    let bestTop = Infinity, bestCube = null;
    for(const c of S.stack){
      if(Math.abs(offX - c.off) < c.w/2){ const top = c.y - c.h/2; if(top < bestTop){ bestTop = top; bestCube = c; } }
    }
    if(bestCube) return { y: bestTop, cube: bestCube };
    if(offX > -plat.w/2 && offX < plat.w/2) return { y: platTop(S), cube: null };
    return null;
  }

  function meltCube(S, c){
    if(c.melting || c.melted) return;
    c.melting = true; c.meltT = 0;
    c.bottomY = c.y + c.h/2; c.origH = c.h; c.origW = c.w;
    S.shake = Math.min(S.shake + 3, 10);
    WB.sfx('sizzle');
  }

  function shrinkPlatform(S, x){
    const plat = S.plat;
    plat.shrink = Math.min(plat.shrink + SMALL_CUBE, SMALL_CUBE*3);
    plat.shrinkTimer = 1800;                    // ~30 seconds
    plat.w = plat.baseW - plat.shrink;
    plat.x = clamp(plat.x, plat.w/2, W - plat.w/2);
    S.shake = Math.min(S.shake + 6, 14);
    WB.sfx('fizz');
    for(let k=0;k<7;k++) S.particles.push({ x, y: plat.y - plat.h/2 + S.camOffset,
      vx: rand(-2.2,2.2), vy: rand(-3,-0.5), life: rand(16,30), max:30, r: rand(3,6), color:'#eaf6ff', kind:'puff' });
  }

  function diarrheaSplat(S, x, screenY){
    for(let k=0;k<6;k++) S.particles.push({ x, y: screenY, vx: rand(-3,3), vy: rand(-4,-0.5),
      life: rand(14,26), max:26, r: rand(3,7), color:'#7a5a1e', kind:'splat', g:.3 });
  }

  WB.updateLettuceAndDiarrhea = function(S, t){
    const plat = S.plat, lettuce = S.lettuce;
    if(lettuce){
      if(!lettuce.landed){
        lettuce.vy += 0.5; lettuce.y += lettuce.vy;
        const surf = topPlat.y - 20;
        if(lettuce.y >= surf){ lettuce.y = surf; lettuce.landed = true; }
      }
      if(lettuce.vx){                             // rolling along the plank
        lettuce.x += lettuce.vx; lettuce.vx *= 0.97;
        if(Math.abs(lettuce.vx) < 0.15) lettuce.vx = 0;
        lettuce.x = clamp(lettuce.x, W/2 - topPlat.w/2 + 20, W/2 + topPlat.w/2 - 20);
        lettuce.roll = (lettuce.roll||0) + lettuce.vx*0.05;
      }
      lettuce.wob = Math.sin(t*0.2) * 2;
    }

    // wombat spraying diarrhea
    if(S.diarrheaTimer > 0){
      S.diarrheaTimer--;
      if(t >= S.diarrheaSpawn){
        S.diarrheaSpawn = t + 3;
        for(let k=0;k<2;k++) S.diarrhea.push({ x: S.diarrheaX + rand(-9,9), y: S.wombat.y + 50 - S.camOffset,
          vx: rand(-0.7,0.7), vy: rand(0.4,1.4), r: rand(6,11) });
        S.wombat.strain = 0.85;
      }
      if(S.diarrheaTimer === 0) S.nextSpawn = t + rand(60, 120);   // normal pooping resumes
    }

    // fall + land the drops
    for(let i=S.diarrhea.length-1;i>=0;i--){
      const d = S.diarrhea[i];
      d.vy += GRAV*1.7; d.y += d.vy; d.x += d.vx; d.vx *= 0.99;
      const s = diarrheaSurface(S, d.x - plat.x);
      if(s && d.y + d.r >= s.y){
        if(s.cube) meltCube(S, s.cube); else shrinkPlatform(S, d.x);
        diarrheaSplat(S, d.x, s.y + S.camOffset);
        S.diarrhea.splice(i,1); continue;
      }
      if(d.y + S.camOffset > H + 40) S.diarrhea.splice(i,1);
    }

    // platform slowly earned back after the shrink timer runs out
    if(plat.shrinkTimer > 0){ plat.shrinkTimer--; if(plat.shrinkTimer===0){ plat.shrink=0; plat.w=plat.baseW; } }
  };

})();
