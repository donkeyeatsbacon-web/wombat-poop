// Shared by endless mode (wombat-poop.html) and the campaign (wombat-campaign.html).
// These are plain scripts rather than ES modules so the pages still run when
// opened straight from disk (file:// blocks module imports). Everything hangs
// off one global, window.WB. Load order: core, art, physics, wombat.
(() => {
  const WB = window.WB = {};

  WB.W = 720; WB.H = 960;          // logical drawing units — all game code works in these
  WB.GRAV = 0.16;                  // gentle float — poop falls slowly
  WB.SMALL_CUBE = 30;              // smallest poop size / platform shrink amount
  // top platform the wombat crawls along
  WB.topPlat = { x: WB.W/2, y: 132, w: WB.W - 120, h: 22 };

  WB.rand  = (a,b) => a + Math.random()*(b-a);
  WB.clamp = (v,a,b) => v<a?a:v>b?b:v;

  // ---------- Display fitting ----------
  // The canvas used to be a fixed 720x960 bitmap stretched by CSS, which is
  // visibly soft on any high-DPI screen. Instead size the backing store to the
  // real device pixels available inside the safe area. The returned object's
  // sx/sy (logical -> device-pixel scale) stay current across resizes; each
  // frame should start with ctx.setTransform(d.sx, 0, 0, d.sy, 0, 0).
  WB.fitDisplay = function(cv, wrapEl){
    const { W, H } = WB;
    const d = { sx: 1, sy: 1 };
    function fit(){
      const availW = wrapEl.clientWidth, availH = wrapEl.clientHeight;
      if(!availW || !availH) return;                  // laid out to nothing (e.g. hidden tab)
      const dpr  = Math.min(window.devicePixelRatio || 1, 3);  // past 3x the cost buys nothing visible
      const fitS = Math.min(availW / W, availH / H);           // letterbox, never distort
      const cssW = Math.max(1, Math.floor(W * fitS));
      const cssH = Math.max(1, Math.floor(H * fitS));
      cv.style.width  = cssW + 'px';
      cv.style.height = cssH + 'px';
      cv.width  = Math.round(cssW * dpr);             // note: this resets all context state
      cv.height = Math.round(cssH * dpr);
      d.sx = cv.width / W; d.sy = cv.height / H;
    }
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    if(window.visualViewport) window.visualViewport.addEventListener('resize', fit);
    fit();
    return d;
  };

  // ---------- Game clock ----------
  // The simulation always advances in fixed 1/60 s steps, however fast the
  // screen refreshes: a 120 Hz phone draws twice per step, a 30 Hz one runs
  // two steps per frame. All speeds and timers are tuned in steps, so this
  // keeps the game the same speed on every device. update() must hold all the
  // game's randomness; render() may run any number of times per step.
  WB.STEP_MS = 1000/60;
  WB.runLoop = function(update, render){
    const STEP = WB.STEP_MS;
    let last = null, acc = 0;
    function frame(now){
      if(last === null) acc = STEP;                 // first frame: exactly one step
      else acc += Math.min(now - last, 100);        // after a stall (hidden tab), don't race to catch up
      last = now;
      // A step runs once we're within 1.5 ms of a whole step behind. The slack
      // absorbs frame-timing jitter on 60 Hz screens (one step every frame,
      // never 0 then 2) while staying under one frame even at 240 Hz, and the
      // remainder carries over, so the average rate stays exact.
      let steps = 0;
      while(acc >= STEP - 1.5 && steps < 6){ update(); acc -= STEP; steps++; }
      if(steps === 6) acc = 0;
      render();
      requestAnimationFrame(frame);
    }
    update(); render();                             // draw straight away
    requestAnimationFrame(frame);
  };

  // client (CSS pixel) coordinates -> logical canvas coordinates
  WB.canvasPt = function(cv, clientX, clientY){
    const r = cv.getBoundingClientRect();
    return { x: (clientX - r.left) * (WB.W / r.width), y: (clientY - r.top) * (WB.H / r.height) };
  };

  // Move the catch platform from held arrow/A-D keys, else ease toward the
  // pointer. A key press drops the pointer so the two don't fight.
  WB.steerPlatform = function(S, input){
    const plat = S.plat, keys = input.keys;
    let dir = 0;
    if(keys['arrowleft']||keys['a']) dir -= 1;
    if(keys['arrowright']||keys['d']) dir += 1;
    if(dir !== 0){
      plat.x += dir * plat.speed;
      input.pointerX = null;
    } else if(input.pointerX !== null){
      plat.x += (input.pointerX - plat.x) * 0.35;
    }
    plat.x = WB.clamp(plat.x, plat.w/2, WB.W - plat.w/2);
  };
})();
