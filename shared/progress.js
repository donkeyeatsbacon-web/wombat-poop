// Gum Nuts (the currency) and the upgrades they buy, shared by both modes and
// the Workshop. Everything is kept on this device in localStorage.
//
//   WB.progress.nuts()             Gum Nuts in the wallet
//   WB.progress.earn(n)            add to the wallet (saved straight away)
//   WB.progress.tree / .trees      the upgrade catalogue
//   WB.progress.level(treeId)      { tier, branch } owned in that tree
//   WB.progress.buyNext(treeId, branch)   buy the next tier (branch 'a'/'b' at tier 2)
//   WB.progress.swap(treeId)       switch branch for a fee
//   WB.progress.mods(on)           what the owned upgrades change, for a run
//                                  (on=false gives the stock game: Classic)
//   WB.progress.pace(r, mid, M)    a poop gap's random part, evened out by Rhythm
//
// Trees come in groups: 'platform' (the catch platform), 'wombat' (the pooper:
// what it gives you to catch) and 'burrow' (seats for mates).
//
// A tree is three tiers: tier 1 is a single upgrade; tier 2 offers two
// branches (a / b) that lock each other out; tier 3 continues whichever
// branch you took. Swapping branch keeps your tier and costs a fee.
(() => {
  const KEY = 'wombatProgress';

  // Prices. Tier 1 costs about what one good campaign season earns: a
  // simulated player earns ~40 Gum Nuts a minute, and a won season takes
  // ~15 minutes (at least five mates wooed). Tiers 2 and 3 cost more.
  const PRICE = [0, 600, 1200, 2000];
  const SEAT_PRICE = [0, 1200, 2000];  // the burrow's extra seats for mates
  const SWAP_FEE = 0.3;            // swapping branch costs 30% of what you paid for the tiers you move

  const trees = [
    { id:'width', group:'platform', name:'Width', icon:'↔', blurb:'How big the catch platform is, and how it handles.',
      t1:{ name:'Long Board', desc:'The platform is 15 px wider.' },
      a:[{ name:'Wide Load', desc:'25 px wider again, but it steers 15% slower.' },
         { name:'Extendo',   desc:'For 5 s after each finished stack (or level in endless), the ends fold out 20 px.' }],
      b:[{ name:'Nimble',    desc:'Steers 15% faster.' },
         { name:'Snap',      desc:'Follows your finger or mouse much more tightly, and arrow keys move it faster.' }] },
    { id:'grip', group:'platform', name:'Grip', icon:'✋', blurb:'What happens when a poop lands.',
      t1:{ name:'Felt Top', desc:'Poops stop sliding sooner after they land.' },
      a:[{ name:'Sticky Pad', desc:'A poop on the board itself can hang 45% over an edge (instead of a third) and still stay.' },
         { name:'Super Glue', desc:'That 45% overhang works on top of other poops too.' }],
      b:[{ name:'Springs',  desc:'A poop landing on the board gets nudged toward its middle.' },
         { name:'Catapult', desc:'A poop landing near the edge of the board hops toward the middle.' }] },
    { id:'stability', group:'platform', name:'Stability', icon:'⚖', blurb:'How steady the tower is.',
      t1:{ name:'Gyro', desc:'The tower can lean 8 px further before it topples.' },
      a:[{ name:'Heavy Base', desc:'The wobble dies down faster.' },
         { name:'Anchor',     desc:'Once per level, a tower about to topple is caught and straightens up.' }],
      b:[{ name:'Low Centre', desc:'A lopsided pile pushes the tower 20% less.' },
         { name:'Slow-Mo',    desc:'Once per level, time slows right down for a moment when the tower is about to go.' }] },
    // The burrow is a straight line (no branches): more seats for mates who
    // come along to your campaign levels.
    { id:'burrow', group:'burrow', name:'Burrow', icon:'🏡', blurb:'Room for mates who come along to your campaign levels.', linear:true,
      t1:{ name:'Bunk Bed', desc:'A second seat: two mates can come along to a level.' },
      a:[{ name:'Guest Room', desc:'A third seat: three mates can come along.' }],
      b:[] },
    { id:'protection', group:'platform', name:'Protection', icon:'☂', blurb:'Shelter from the diarrhea.',
      t1:{ name:'Awning', desc:'Diarrhea hitting the board shrinks it half as much.' },
      a:[{ name:'Umbrella', desc:'The top poop of your stack can\'t be melted.' }],
      b:[{ name:'Gutter',   desc:'Every drop that hits the board earns 1 Gum Nut.' }] },

    // The wombat: you steer the platform, not the wombat, so these change
    // what it gives you to catch.
    { id:'diet', group:'wombat', name:'Diet', icon:'🌾', blurb:'The size and shape of the poops.',
      t1:{ name:'Fibre Diet', desc:'Poops stay between 36 and 70 px: fewer tiny ones, fewer giants.' },
      a:[{ name:'Bricklayer', desc:'Poops come out a fifth flatter: towers stand steadier, but climb more slowly.' },
         { name:'Mega Cube',  desc:'Every 10th poop is a wide, flat slab: a perfect foundation.' }],
      b:[{ name:'Big Eater',    desc:'Poops run 8 px bigger and each one stacked earns 1 more Gum Nut (more points in endless too), but they\'re harder to balance.' },
         { name:'Golden Belly', desc:'Golden poops (+5 Gum Nuts) turn up three times as often.' }] },
    { id:'aim', group:'wombat', name:'Aim', icon:'🎯', blurb:'Where the poops come from.',
      t1:{ name:'Steady Walker', desc:'The wombat changes direction half as often.' },
      a:[{ name:'Centre Line', desc:'Before each push the wombat shuffles toward the middle of the plank.' }],
      b:[{ name:'Telegraph',   desc:'It strains for longer before each poop: more warning of where it\'ll drop.' }] },
    { id:'tummy', group:'wombat', name:'Tummy', icon:'🤢', blurb:'Lettuce and the runs.',
      t1:{ name:'Tough Tummy', desc:'Diarrhea wears off 30% sooner.' },
      a:[{ name:'Picky Eater', desc:'The wombat turns its nose up at every third lettuce.' }],
      b:[{ name:'Fertiliser',  desc:'Diarrhea hitting the board never shrinks it.' }] },
    { id:'rhythm', group:'wombat', name:'Rhythm', icon:'🥁', blurb:'How fast the poops come.',
      t1:{ name:'Regular', desc:'Poops come at a more even pace: the gaps vary half as much.' },
      a:[{ name:'Slow Burn',  desc:'In endless, poops speed up 30% more slowly. In the campaign they come 10% less often.' }],
      b:[{ name:'Rapid Fire', desc:'Poops come 15% faster, but each is worth 50% more points in endless, and every 2nd one stacked earns an extra Gum Nut.' }] },
  ];

  // ---------- storage ----------
  let state = { v: 1, nuts: 0, owned: {} };
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if(d && d.v === 1 && Number.isFinite(d.nuts) && d.owned && typeof d.owned === 'object') state = d;
  } catch(e){}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){} };

  const tree = id => trees.find(t => t.id === id);
  const maxTier = t => 1 + Math.max(t.a.length, t.b.length);
  function level(id){
    const o = state.owned[id];
    return o && o.tier > 0 ? { tier: o.tier|0, branch: o.branch || null } : { tier: 0, branch: null };
  }
  const has = (id, tier, branch) => { const l = level(id); return l.tier >= tier && (!branch || l.branch === branch); };

  // the next thing you could buy in a tree (null when it's complete)
  const priceOf = (t, tier) => t.linear ? SEAT_PRICE[tier] : PRICE[tier];
  function next(id, branch){
    const t = tree(id), l = level(id);
    if(l.tier >= maxTier(t)) return null;
    if(l.tier === 0) return { tier: 1, branch: null, item: t.t1, price: priceOf(t, 1) };
    const b = l.branch || branch || (t.linear ? 'a' : null);
    if(!b) return null;                                       // tier 2: say which branch
    const item = t[b][l.tier - 1];
    return item ? { tier: l.tier + 1, branch: b, item, price: priceOf(t, l.tier + 1) } : null;
  }

  function buyNext(id, branch){
    const n = next(id, branch);
    if(!n || state.nuts < n.price) return false;
    state.nuts -= n.price;
    state.owned[id] = { tier: n.tier, branch: n.branch };
    save();
    return true;
  }

  // switch to the other branch, keeping your tier; the fee is a share of what you paid for it
  function swapFee(id){
    const l = level(id);
    if(l.tier < 2) return null;
    let paid = 0; for(let k = 2; k <= l.tier; k++) paid += PRICE[k];
    return Math.round(paid * SWAP_FEE / 10) * 10;
  }
  function swap(id){
    const l = level(id), t = tree(id), fee = swapFee(id);
    if(fee === null || state.nuts < fee) return false;
    const other = l.branch === 'a' ? 'b' : 'a';
    state.nuts -= fee;
    state.owned[id] = { tier: Math.min(l.tier, 1 + t[other].length), branch: other };
    save();
    return true;
  }

  // What the owned upgrades change for one run. Every default here is the
  // stock game's own value, so with nothing owned (or on=false) play is
  // exactly as before.
  function mods(on){
    const m = {
      widthAdd: 0, steerMul: 1, easeMul: 1, extendo: false,
      landFriction: 0.6, overhangBoard: 0.33, overhangPoops: 0.33, springs: false, catapult: false,
      marginAdd: 0, dampingAdd: 0, restoreAdd: 0, pushMul: 1, anchor: false, slowmo: false,
      shrinkPerDrop: 30, umbrella: false, gutter: false,
      // the wombat
      sizeMin: 30, sizeMax: 78, flat: 1, megaEvery: 0, goldBoost: false, nutPerPoop: 0,
      turnChance: 0.008, centreLine: false, pushAt: 24,
      diarrheaMul: 1, picky: false, fertiliser: false,
      paceSpread: 1, rampMul: 1, gapMul: 1, campGapMul: 1, scoreMul: 1, rapidNuts: false,
    };
    if(!on) return m;
    if(has('width', 1)) m.widthAdd += 15;
    if(has('width', 2, 'a')){ m.widthAdd += 25; m.steerMul *= 0.85; m.easeMul *= 0.85; }
    if(has('width', 3, 'a')) m.extendo = true;
    if(has('width', 2, 'b')){ m.steerMul *= 1.15; m.easeMul *= 1.15; }
    if(has('width', 3, 'b')){ m.steerMul *= 1.2;  m.easeMul *= 1.45; }
    if(has('grip', 1)) m.landFriction = 0.4;
    if(has('grip', 2, 'a')) m.overhangBoard = 0.45;
    if(has('grip', 3, 'a')) m.overhangPoops = 0.45;
    if(has('grip', 2, 'b')) m.springs = true;
    if(has('grip', 3, 'b')) m.catapult = true;
    if(has('stability', 1)) m.marginAdd += 8;
    if(has('stability', 2, 'a')){ m.dampingAdd -= 0.02; m.restoreAdd += 0.006; }
    if(has('stability', 3, 'a')) m.anchor = true;
    if(has('stability', 2, 'b')) m.pushMul *= 0.8;
    if(has('stability', 3, 'b')) m.slowmo = true;
    if(has('protection', 1)) m.shrinkPerDrop = 15;
    if(has('protection', 2, 'a')) m.umbrella = true;
    if(has('protection', 2, 'b')) m.gutter = true;
    if(has('diet', 1)){ m.sizeMin = 36; m.sizeMax = 70; }
    if(has('diet', 2, 'a')) m.flat = 0.8;
    if(has('diet', 3, 'a')) m.megaEvery = 10;
    if(has('diet', 2, 'b')){ m.sizeMin += 8; m.sizeMax += 8; m.nutPerPoop = 1; }
    if(has('diet', 3, 'b')) m.goldBoost = true;
    if(has('aim', 1)) m.turnChance = 0.004;
    if(has('aim', 2, 'a')) m.centreLine = true;
    if(has('aim', 2, 'b')) m.pushAt = 48;
    if(has('tummy', 1)) m.diarrheaMul = 0.7;
    if(has('tummy', 2, 'a')) m.picky = true;
    if(has('tummy', 2, 'b')) m.fertiliser = true;
    if(has('rhythm', 1)) m.paceSpread = 0.5;
    if(has('rhythm', 2, 'a')){ m.rampMul = 0.7; m.campGapMul = 1.1; }
    if(has('rhythm', 2, 'b')){ m.gapMul = 0.85; m.scoreMul *= 1.5; m.rapidNuts = true; }
    return m;
  }
  // The random part of a poop gap, r, evened out around its middle by Rhythm.
  function pace(r, mid, m){
    return m.paceSpread === 1 ? r : mid + (r - mid) * m.paceSpread;
  }
  // apply mods to a mode's pile tuning
  function tune(base, m){
    return { ...base,
      swayPush: base.swayPush * m.pushMul,
      damping: base.damping + m.dampingAdd,
      restoreMax: base.restoreMax + m.restoreAdd, restoreMin: base.restoreMin + m.restoreAdd,
      landFriction: m.landFriction, overhangBoard: m.overhangBoard, overhangPoops: m.overhangPoops,
      springs: m.springs, catapult: m.catapult, shrinkPerDrop: m.shrinkPerDrop, umbrella: m.umbrella,
      fertiliser: m.fertiliser, wm: m };
  }
  // "Upgraded" means platform upgrades; the burrow only matters in the campaign
  const anyOwned = () => trees.some(t => !t.linear && level(t.id).tier > 0);
  const seats = () => 1 + level('burrow').tier;

  WB.progress = {
    trees, tree, level, next, buyNext, swap, swapFee, mods, tune, pace, anyOwned, seats, PRICE, priceOf,
    nuts: () => state.nuts,
    earn(n){ if(n > 0){ state.nuts += Math.round(n); save(); } },
    reload(){ try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if(d && d.v === 1) state = d; } catch(e){} },
  };
})();
