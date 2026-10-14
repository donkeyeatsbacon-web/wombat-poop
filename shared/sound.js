// Sound effects, all synthesised with the Web Audio API (no audio files).
//
//   WB.sfx('land', size)   play an effect; silently does nothing when muted,
//                          before the first tap/key (browsers block audio until
//                          then), or where Web Audio isn't available
//   WB.sound.muted()       is sound off?
//   WB.sound.toggle()      flip it; the choice is remembered on this device
//
// Effects must never call Math.random: the game's randomness (and
// tools/compare.js) depend on its exact sequence. Variation comes from the
// little generator below instead.
(() => {
  const KEY = 'wombatMuted';
  const VOLUME = 0.8;                       // overall level; the loudest effect peaks around 0.4
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ac = null, master = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch(e){}

  let seed = 1234567;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Create (or wake) the audio context. Browsers only allow this during a
  // user gesture, so it runs on the first tap/click/key of the page.
  function unlock(){
    if(!AudioCtx) return;
    if(!ac){
      try { ac = new AudioCtx(); } catch(e){ return; }
      master = ac.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i] = rnd()*2 - 1;
    }
    if(ac.state === 'suspended') ac.resume().catch(() => {});   // refused: try again on the next tap
  }
  for(const ev of ['pointerdown', 'touchstart', 'keydown'])
    window.addEventListener(ev, unlock, { capture: true, passive: true });

  // ---------- building blocks ----------
  // an envelope: quick attack, exponential-ish release
  function env(g, at, vol, dur, attack){
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + (attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  }
  function tone(freq, dur, o){
    o = o || {};
    const at = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if(o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + dur);
    if(o.vibrato){
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = o.vibrato; lg.gain.value = freq * 0.03;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(at); lfo.stop(at + dur);
    }
    let out = osc;
    if(o.lowpass){ const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lowpass; osc.connect(f); out = f; }
    env(g, at, o.vol || 0.3, dur, o.attack);
    out.connect(g); g.connect(master);
    osc.start(at); osc.stop(at + dur + 0.02);
  }
  function noise(dur, o){
    o = o || {};
    const at = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf;
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1000, at);
    if(o.to) f.frequency.exponentialRampToValueAtTime(o.to, at + dur);
    f.Q.value = o.q || 1;
    env(g, at, o.vol || 0.3, dur, o.attack);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(at, rnd() * 0.5); src.stop(at + dur + 0.02);
  }

  // ---------- the effects ----------
  const FX = {
    // a poop squeezed out: a low, wobbly raspberry
    plop(){
      const base = 60 + rnd()*20;
      tone(base, 0.28, { type:'sawtooth', to: base*0.7, vol:0.16, lowpass:420, vibrato:28 });
      noise(0.22, { freq:500, to:180, vol:0.12 });
    },
    // landing on the pile: a soft bloop, deeper for bigger poops
    land(size){
      const f = 260 * 48 / (size || 48);
      tone(f, 0.14, { to: f*0.55, vol:0.32 });
      noise(0.06, { freq:300, vol:0.10 });
    },
    // a missed poop hitting the ground
    splat(){
      noise(0.32, { filter:'bandpass', freq:1100, to:180, q:0.8, vol:0.45 });
      tone(110, 0.25, { to:40, vol:0.35 });
    },
    // the wombat chomping lettuce
    crunch(){
      for(let i=0;i<3;i++) noise(0.045, { filter:'highpass', freq:2200 + rnd()*1500, vol:0.18, delay:i*0.05 });
    },
    // uh oh: tummy gurgles as the diarrhea starts
    gurgle(){
      for(let i=0;i<7;i++){
        const f = 90 + rnd()*90;
        tone(f, 0.12, { type:'triangle', to:f*(0.6 + rnd()*0.8), vol:0.2, delay:i*0.11 + rnd()*0.04 });
      }
    },
    // a poop melting under diarrhea
    sizzle(){ noise(0.45, { filter:'highpass', freq:3000, to:6000, vol:0.09, attack:0.05 }); },
    // the platform shrinking
    fizz(){ noise(0.18, { filter:'bandpass', freq:2500, to:900, q:2, vol:0.3 }); },
    // the wobble getting dangerous
    creak(){ tone(140 + rnd()*30, 0.22, { type:'square', to:105, vol:0.11, lowpass:700, vibrato:18 }); },
    // reaching the goal line / finishing a stack
    levelup(){
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type:'square', vol:0.12, lowpass:2400, delay:i*0.08 }));
    },
    // the tower going over: slide whistle down, then a crash
    topple(){
      tone(900, 0.85, { type:'sine', to:140, vol:0.22, vibrato:6 });
      noise(0.6, { freq:1800, to:120, vol:0.4, delay:0.8 });
      tone(70, 0.5, { to:35, vol:0.35, delay:0.8 });
    },
    // game over / level lost: a sad trombone
    sad(){
      [[311,0.32],[294,0.32],[277,0.32],[262,0.9]].forEach(([f,d], i) =>
        tone(f, d, { type:'sawtooth', vol:0.14, lowpass:900, delay:i*0.34, vibrato: i===3 ? 5 : 0 }));
    },
    // level won / season won
    win(){
      [[523,0.12],[659,0.12],[784,0.12],[1047,0.4]].forEach(([f,d], i) =>
        tone(f, d, { type:'triangle', vol:0.22, delay:i*0.11 }));
    },
    // a rival stomping the plank
    stomp(){ tone(80, 0.3, { to:38, vol:0.45 }); noise(0.2, { freq:400, to:90, vol:0.35 }); },
    // a rival snatching a poop
    steal(){ tone(500, 0.18, { type:'triangle', to:1200, vol:0.14 }); noise(0.08, { filter:'highpass', freq:3000, vol:0.1, delay:0.05 }); },
    // UI button
    click(){ tone(880, 0.05, { type:'square', vol:0.12, lowpass:3000 }); },
  };

  // A few effects can fire every frame (drops hitting the platform); keep each
  // to a sensible repeat rate.
  const MIN_GAP = { fizz:0.12, sizzle:0.15, land:0.05, crunch:0.1, creak:0.45, splat:0.08 };
  const lastAt = {};

  WB.sfx = function(name, arg){
    if(muted || !ac || ac.state !== 'running' || !FX[name]) return;
    const now = ac.currentTime;
    if(MIN_GAP[name] && now - (lastAt[name] || -1) < MIN_GAP[name]) return;
    lastAt[name] = now;
    try { FX[name](arg); } catch(e){}
  };

  WB.sound = {
    available: !!AudioCtx,
    state: () => ac ? ac.state : 'locked',   // 'running' once audio is actually on
    muted: () => muted,
    toggle(){
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch(e){}
      unlock();
      if(master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ac.currentTime, 0.02);
      if(!muted) WB.sfx('click');
      return muted;
    }
  };
})();
