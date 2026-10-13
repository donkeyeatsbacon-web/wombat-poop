// The pooping wombat up on the top platform, shared by both modes.
(() => {
  const { W, topPlat, rand, clamp } = WB;

  function spawnPlop(S, t){
    const wombat = S.wombat;
    const size = rand(30, 78);
    S.plops.push({
      x: wombat.x,
      y: wombat.y + 52 - S.camOffset,   // world y so it appears at the wombat on screen
      w: size, h: size,
      vx: rand(-0.3, 0.3),
      vy: rand(0.2, 0.6),
      rot: rand(-0.15, 0.15),
      vr: rand(-0.05, 0.05),
      squish: 1,
      hue: rand(-8, 8),
      born: t
    });
    wombat.strain = 1;   // peak scrunch at the moment of release
    WB.sfx('plop');
    // little grunt puff from underneath
    for(let i=0;i<6;i++){
      S.particles.push(WB.puff(wombat.x, wombat.y+40, '#9b6b3a'));
    }
  }

  // crawl (facing the way it walks) -> prep (turn to face us) ->
  // push (scrunch up and force one out) -> recover -> crawl again
  WB.updateWombat = function(S, t){
    const wombat = S.wombat;
    if(wombat.blink>0) wombat.blink--;

    if(wombat.mode === 'crawl'){
      if(S.lettuce && S.lettuce.landed){ wombat.mode = 'seek'; }
      else if(S.diarrheaTimer > 0){
        // queasy — stay put and drip diarrhea straight down from this spot
        wombat.x += clamp(S.diarrheaX - wombat.x, -0.5, 0.5);
        wombat.wob = Math.sin(t*0.5) * 6;
        wombat.face += (0 - wombat.face) * 0.1;
      }
      else {
        wombat.crawl += 0.18;
        wombat.wob = Math.sin(wombat.crawl) * 4;
        wombat.x += wombat.dir * 1.6;
        const bound = topPlat.w/2 - 40;
        if(wombat.x < W/2 - bound){ wombat.x = W/2 - bound; wombat.dir = 1; }
        if(wombat.x > W/2 + bound){ wombat.x = W/2 + bound; wombat.dir = -1; }
        if(Math.random() < 0.008) wombat.dir *= -1;
        // face the way it's walking (turn to the side)
        wombat.face += (wombat.dir - wombat.face) * 0.12;
        wombat.strain += (0 - wombat.strain) * 0.1;
        if(Math.random() < 0.01) wombat.blink = 8;
        if(t >= S.nextSpawn){ wombat.mode = 'prep'; wombat.timer = 0; }
      }

    } else if(wombat.mode === 'seek'){
      // spotted the lettuce — hustle over to it
      if(!S.lettuce){ wombat.mode = 'crawl'; }
      else {
        const dx = S.lettuce.x - wombat.x;
        wombat.dir = dx < 0 ? -1 : 1;
        wombat.crawl += 0.26;
        wombat.wob = Math.sin(wombat.crawl) * 5;
        wombat.x += clamp(dx, -2.6, 2.6);
        wombat.face += (wombat.dir - wombat.face) * 0.16;
        if(Math.abs(dx) < 12){ wombat.mode = 'eat'; wombat.timer = 0; wombat.face = 0; }
      }

    } else if(wombat.mode === 'eat'){
      // chomp chomp chomp
      wombat.timer++;
      wombat.face += (0 - wombat.face) * 0.3;                 // face forward to eat
      const chomp = Math.sin(wombat.timer * 0.5);            // -1..1 jaw cycle
      wombat.wob = -Math.abs(chomp) * 6;                     // head dips down on each bite
      const lettuce = S.lettuce;
      if(lettuce){
        // lift the leaf up to the mouth and nibble it away
        lettuce.x += (wombat.x - lettuce.x) * 0.3;
        lettuce.y += ((wombat.y + 16) - lettuce.y) * 0.3;
        lettuce.vx = 0;                                        // stop any roll
        lettuce.eatScale = clamp(1 - wombat.timer/42, 0, 1);
        if(wombat.timer % 12 === 6){                          // a bite — spit out crunch bits
          const hop = WB.hopOf(S);
          for(let k=0;k<6;k++) S.particles.push({ x: lettuce.x + rand(-10,10), y: lettuce.y - hop + rand(-6,6),
            vx: rand(-3,3), vy: rand(-3.5,-0.5), life: rand(12,24), max:24, r: rand(2,4), color:'#7cc743', kind:'splat', g:.25 });
          S.shake = Math.min(S.shake + 2, 6);
          WB.sfx('crunch');
        }
      }
      if(wombat.timer > 42){
        S.lettuce = null;
        S.diarrheaTimer = 210; S.diarrheaSpawn = t;   // uh oh — a few seconds of the runs
        S.diarrheaX = wombat.x;                       // it drips from right here for the duration
        S.nextSpawn = t + 1e9;                        // no normal poops meanwhile
        WB.sfx('gurgle');
        wombat.mode = 'crawl';
      }

    } else if(wombat.mode === 'prep'){
      // stop, settle, and turn to face forward before pooping
      wombat.wob *= 0.9;
      wombat.face += (0 - wombat.face) * 0.2;      // rotate to face us
      wombat.strain += (0.18 - wombat.strain) * 0.12; // small anticipation
      wombat.timer++;
      if((Math.abs(wombat.face) < 0.08 && wombat.timer > 14) || wombat.timer > 70){
        wombat.mode = 'push'; wombat.timer = 0;
      }

    } else if(wombat.mode === 'push'){
      wombat.face += (0 - wombat.face) * 0.3;       // stay squarely forward
      wombat.wob = 0;
      wombat.timer++;
      wombat.strain = Math.min(1, wombat.strain + 0.07); // scrunch harder
      if(wombat.timer === 24) spawnPlop(S, t);      // ...and out it comes
      if(wombat.timer > 34){ wombat.mode = 'recover'; wombat.timer = 0; }

    } else { // recover
      wombat.timer++;
      wombat.strain += (0 - wombat.strain) * 0.14;  // relief
      if(wombat.timer > 16){
        wombat.mode = 'crawl';
        S.nextSpawn = S.hooks.nextPoopAt(t);
      }
    }
  };
})();
