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
  const SWAP_FEE = 0.3;            // swapping branch costs 30% of what you paid for the tiers you move

  const trees = [
    { id:'width', name:'Width', icon:'↔', blurb:'How big the catch platform is, and how it handles.',
      t1:{ name:'Long Board', desc:'The platform is 15 px wider.' },
      a:[{ name:'Wide Load', desc:'25 px wider again, but it steers 15% slower.' },
         { name:'Extendo',   desc:'For 5 s after each finished stack (or level in endless), the ends fold out 20 px.' }],
      b:[{ name:'Nimble',    desc:'Steers 15% faster.' },
         { name:'Snap',      desc:'Follows your finger or mouse much more tightly, and arrow keys move it faster.' }] },
    { id:'grip', name:'Grip', icon:'✋', blurb:'What happens when a poop lands.',
      t1:{ name:'Felt Top', desc:'Poops stop sliding sooner after they land.' },
      a:[{ name:'Sticky Pad', desc:'A poop on the board itself can hang 45% over an edge (instead of a third) and still stay.' },
         { name:'Super Glue', desc:'That 45% overhang works on top of other poops too.' }],
      b:[{ name:'Springs',  desc:'A poop landing on the board gets nudged toward its middle.' },
         { name:'Catapult', desc:'A poop landing near the edge of the board hops toward the middle.' }] },
    { id:'stability', name:'Stability', icon:'⚖', blurb:'How steady the tower is.',
      t1:{ name:'Gyro', desc:'The tower can lean 8 px further before it topples.' },
      a:[{ name:'Heavy Base', desc:'The wobble dies down faster.' },
         { name:'Anchor',     desc:'Once per level, a tower about to topple is caught and straightens up.' }],
      b:[{ name:'Low Centre', desc:'A lopsided pile pushes the tower 20% less.' },
         { name:'Slow-Mo',    desc:'Once per level, time slows right down for a moment when the tower is about to go.' }] },
    { id:'protection', name:'Protection', icon:'☂', blurb:'Shelter from the diarrhea.',
      t1:{ name:'Awning', desc:'Diarrhea hitting the board shrinks it half as much.' },
      a:[{ name:'Umbrella', desc:'The top poop of your stack can\'t be melted.' }],
      b:[{ name:'Gutter',   desc:'Every drop that hits the board earns 1 Gum Nut.' }] },
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
  function next(id, branch){
    const t = tree(id), l = level(id);
    if(l.tier >= maxTier(t)) return null;
    if(l.tier === 0) return { tier: 1, branch: null, item: t.t1, price: PRICE[1] };
    const b = l.branch || branch;
    if(!b) return null;                                       // tier 2: say which branch
    const item = t[b][l.tier - 1];
    return item ? { tier: l.tier + 1, branch: b, item, price: PRICE[l.tier + 1] } : null;
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
    return m;
  }
  // apply mods to a mode's pile tuning
  function tune(base, m){
    return { ...base,
      swayPush: base.swayPush * m.pushMul,
      damping: base.damping + m.dampingAdd,
      restoreMax: base.restoreMax + m.restoreAdd, restoreMin: base.restoreMin + m.restoreAdd,
      landFriction: m.landFriction, overhangBoard: m.overhangBoard, overhangPoops: m.overhangPoops,
      springs: m.springs, catapult: m.catapult, shrinkPerDrop: m.shrinkPerDrop, umbrella: m.umbrella };
  }
  const anyOwned = () => trees.some(t => level(t.id).tier > 0);

  WB.progress = {
    trees, tree, level, next, buyNext, swap, swapFee, mods, tune, anyOwned, PRICE,
    nuts: () => state.nuts,
    earn(n){ if(n > 0){ state.nuts += Math.round(n); save(); } },
    reload(){ try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if(d && d.v === 1) state = d; } catch(e){} },
  };
})();
