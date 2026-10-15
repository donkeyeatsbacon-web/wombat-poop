// Stickers (achievements): goals to aim for across both modes, collected in
// the sticker book (stickers.html). A few unlock looks you can't buy.
//
//   WB.stickers.note(what, n)    count something that happened (n defaults to 1)
//   WB.stickers.best(what, v)    record a new best (kept if higher)
//   WB.stickers.list             the catalogue
//   WB.stickers.got(id)          earned yet?
//   WB.stickers.progress(s)      { n, of } towards a sticker
//   WB.stickers.next()           a newly earned sticker to announce, or null
//   WB.stickers.unseen() / markSeen()   for the "new!" badge on the front page
//
// Kept in localStorage under wombatStickers: { v, got: {id: 'YYYY-MM-DD'},
// n: {counter: number}, seen: {id: true} }.
(() => {
  const KEY = 'wombatStickers';

  // [id, icon, name, what you do, counter, how many, reward look (optional)]
  const list = [
    ['first-plop',   '💩', 'First Plop',         'Stack your first poop.',                                 'poops', 1],
    ['poops-100',    '🧱', 'Hundred Club',       'Stack 100 poops.',                                       'poops', 100],
    ['poops-1000',   '🏗', 'Pooper Trooper',     'Stack 1,000 poops.',                                     'poops', 1000],
    ['poops-10000',  '🏰', 'Poop Tycoon',        'Stack 10,000 poops.',                                    'poops', 10000],
    ['golden-1',     '✨', 'Gold Digger',        'Stack a golden poop.',                                   'golden', 1],
    ['golden-50',    '🪙', 'Gold Rush',          'Stack 50 golden poops.',                                 'golden', 50, 'fur-gold'],
    ['lettuce-25',   '🥬', 'Salad Days',         'Your wombat eats 25 lettuces.',                          'lettuce', 25],
    ['topple-1',     '🌲', 'Timber!',            'Topple a tower. It happens to the best of us.',          'topples', 1],
    ['clean-10',     '🧘', 'Steady Paws',        'Finish 10 stacks or endless levels without a wobble warning.', 'clean', 10, 'paint-rainbow'],
    ['endless-3',    '🏔', 'Climber',            'Reach level 3 in endless.',                              'endlessLevel', 3],
    ['endless-6',    '⛰', 'Mountaineer',        'Reach level 6 in endless.',                              'endlessLevel', 6],
    ['endless-10',   '🚀', 'Sky High',           'Reach level 10 in endless.',                             'endlessLevel', 10],
    ['classic-5',    '🏁', 'Old School',         'Reach level 5 in endless on Classic (no upgrades).',     'classicLevel', 5],
    ['mate-1',       '💗', 'Smitten',            'Woo your first mate.',                                   'mates', 1],
    ['burrow-6',     '🏡', 'Cosy Burrow',        'Have 6 mates living in your burrow.',                    'burrow', 6],
    ['burrow-12',    '🎉', 'Full House',         'Have 12 mates living in your burrow.',                   'burrow', 12, 'trail-confetti'],
    ['party-3',      '🚌', 'Road Trip',          'Take 3 mates along to one level.',                       'party', 3],
    ['rival-1',      '👊', 'Shoo!',              'Out-stack a rival on the campaign map.',                 'rivals', 1],
    ['rival-25',     '🛡', 'Turf Boss',          'Out-stack 25 rivals.',                                   'rivals', 25],
    ['lob-1',        '🧤', 'Good Catch',         'Catch a lettuce a Lobber throws at you.',                'lobs', 1],
    ['siege',        '😤', 'Under Siege',        'Finish a stack with 3 rivals on your plank.',            'siege', 1],
    ['season-1',     '🏆', "Season's Greetings", 'Win a campaign season.',                                 'seasons', 1],
    ['season-3',     '🎩', 'Hat Trick',          'Win 3 campaign seasons.',                                'seasons', 3],
    ['season-5',     '😇', 'Legend',             'Win 5 campaign seasons.',                                'seasons', 5, 'hat-halo'],
    ['lone',         '🐺', 'Lone Wombat',        'Win a season without taking a mate along to any level.', 'lone', 1],
    ['nuts-1000',    '🌰', 'Nut Collector',      'Earn 1,000 Gum Nuts in total.',                          'nuts', 1000],
    ['nuts-10000',   '🐿', 'Squirrel Away',      'Earn 10,000 Gum Nuts in total.',                         'nuts', 10000],
    ['upgrade-1',    '🔧', 'Handy',              'Buy your first upgrade in the Workshop.',                'upgrades', 1],
    ['tree-max',     '⭐', 'Fully Loaded',       'Take any upgrade tree to tier 3.',                       'treeMax', 1],
    ['looks-10',     '💅', 'Fashionista',        'Own 10 looks (not counting the free ones).',             'looks', 10],
    ['hats-all',     '👒', 'Mad Hatter',         'Own every hat in the Workshop.',                         'hats', 1],
    ['all',          '🏅', 'Sticker Book',       'Earn every other sticker.',                              'allStickers', 1, 'hat-viking'],
  ].map(([id, icon, name, desc, counter, of, reward]) => ({ id, icon, name, desc, counter, of, reward: reward || null }));

  let state = { v: 1, got: {}, n: {}, seen: {} };
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if(d && d.v === 1 && d.got && d.n && typeof d.got === 'object' && typeof d.n === 'object') state = { seen: {}, ...d };
  } catch(e){}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){} };

  const queue = [];                      // newly earned, waiting to be announced
  const today = () => new Date().toISOString().slice(0, 10);
  function check(){
    let changed = false;
    for(const s of list){
      if(state.got[s.id]) continue;
      const n = s.counter === 'allStickers' ? +list.every(o => o.id === 'all' || state.got[o.id]) : (state.n[s.counter] || 0);
      if(n >= s.of){ state.got[s.id] = today(); queue.push(s); changed = true; }
    }
    if(changed) check();                 // the Sticker Book sticker may now be due
    return changed;
  }

  WB.stickers = {
    list,
    got: id => !!state.got[id],
    gotOn: id => state.got[id] || null,
    count: () => list.filter(s => state.got[s.id]).length,
    progress(s){
      if(s.counter === 'allStickers') return { n: list.filter(o => o.id !== 'all' && state.got[o.id]).length, of: list.length - 1 };
      return { n: Math.min(state.n[s.counter] || 0, s.of), of: s.of };
    },
    note(what, n = 1){
      if(!(n > 0)) return;
      state.n[what] = (state.n[what] || 0) + n;
      check(); save();
    },
    best(what, v){
      if(!(v > (state.n[what] || 0))) return;
      state.n[what] = v;
      check(); save();
    },
    // a season-long flag kept here, not in the campaign save: did a mate come along?
    seasonFlag(what, v){ state.n[what] = v; save(); },
    flag: what => state.n[what] || 0,
    next: () => queue.shift() || null,
    unseen: () => list.filter(s => state.got[s.id] && !state.seen[s.id]).length,
    markSeen(){ for(const s of list) if(state.got[s.id]) state.seen[s.id] = true; save(); },
    reload(){ try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if(d && d.v === 1) state = { seen: {}, ...d }; } catch(e){} },
  };
})();
