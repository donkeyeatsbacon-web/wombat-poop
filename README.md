# 💩 Combat Wombat: Poop Stacker

A browser game about a wombat in a combat headband that poops cubes, and you,
who have to catch them on a little platform and stack them into a tower before
it topples. (Real wombats do poop cubes.)

**Play it:** <https://donkeyeatsbacon-web.github.io/wombat-poop/>

It runs in any modern browser, on desktop and phone, with nothing to install.
You can also add it to your home screen (Share → Add to Home Screen on iPhone,
or Install app in Chrome), and once you've opened it, it plays offline too.
The front page lets you pick a mode, and shows your best score and how far
your campaign has got.

## Two ways to play

### Endless — [`wombat-poop.html`](wombat-poop.html)

The wombat crawls along the plank at the top and every so often stops, strains,
and drops a poop. Slide the platform underneath to catch it. Poops pile up for
real: they rest on whatever is under them, bridge gaps and sit crooked.

- **Reach the red goal line** to climb a level. The wombat leaps, the view
  rises, and the climb continues.
- **Watch the Wobble-O-Meter.** A lopsided pile leans, and if its weight
  swings past the edge of the platform the whole tower topples.
- **You have three rolls of toilet paper.** Each missed poop costs one.
- **Lettuce falls now and then.** The wombat eats it and gets diarrhea, which
  melts poops into puddles and shrinks your platform for a while.
- Bigger poops score more, and poops come faster as your score climbs. Your
  top 5 scores are kept on your device, with your name.

### Campaign — [`wombat-campaign.html`](wombat-campaign.html)

A season in your territory. From your burrow, tap a wombat on the map to travel
there and play a stacking level against it.

- **💗 Mates:** stack to impress them for charm and a buff. They wander off if
  you leave them too long.
- **😤 Rivals:** out-stack them to drive them back. They march on your burrow
  on their own schedules, and any that arrive heckle your levels by rolling
  lettuce at your wombat.
- **Win the season** by reaching 100 charm; **lose it** if threat reaches 100.
- **Buffs and debuffs** change your platform width, how fast poops fall, your
  toilet paper and how easily the tower topples. They show as chips under the
  top bar: tap one to see what it does, or open the ☰ menu for the full list.
- **Retreat** from a level on the pause screen if it's going badly: the day
  passes, but it doesn't count as a loss (backing down from a rival still adds
  a little threat).

Progress saves automatically after each day, so you can close the page and
**Continue** later.

### Gum Nuts and the Workshop

Both modes earn **Gum Nuts**: 1 for every poop you stack (5 more for a rare
golden one), 5 for each finished stack or level climbed (10 more if it never
got wobbly), 15 for driving off a rival and 10 for wooing a mate. Spend them in
the **Workshop** (from the front page) on upgrades for your catch platform:
four trees (Width, Grip, Stability, Protection), where the second tier makes
you pick one of two branches. You can switch branch later for a fee.

Upgrades always apply in the campaign. Endless can be played **Upgraded** or
**Classic** (stock), each with its own top 5; the switch appears on endless
mode's title screen once you own an upgrade.

## Controls

| | Desktop | Phone / tablet |
| --- | --- | --- |
| Move the platform | Mouse, or ← → / A D | Drag your finger |
| Start / choose | Click (Space / Enter also start endless) | Tap |
| Pause | ⏸ button, or P / Esc | ⏸ button (top right) |
| Back to the mode menu | ◂ Menu, or Main menu from the pause screen | Same |
| Sound on/off | 🔊 button, M, or the pause screen | 🔊 button, or the pause screen |

The game also pauses itself if you switch tab or app mid-level. Sound starts
with your first tap or key press (browsers don't allow it before that), and the
on/off choice is remembered.

## Running it locally

Open `index.html` straight in your browser, and that's it. (Some browsers
won't load the bundled font from disk and use a fallback font instead; serving
the folder as below avoids that.)

To test from a phone on the same network, serve the folder instead:

```bash
python3 -m http.server 8752
```

Then visit `http://<your-computer's-IP>:8752/`.

## How the code is laid out

There's no build step and there are no dependencies, just HTML and plain JavaScript.

| Path | What's in it |
| --- | --- |
| `index.html` | The front page: pick endless or campaign |
| `wombat-poop.html` | Endless mode: scoring, level climbing, toppling, high scores |
| `wombat-campaign.html` | Campaign: map, mates and rivals, buffs, save/load |
| `shared/core.js` | The game clock, screen fitting for sharp high-DPI rendering and notches, constants, input helpers |
| `shared/physics.js` | Falling poops, stacking, the wobble, melting and collapse, particles |
| `shared/wombat.js` | The wombat's crawl, poop and lettuce-eating routine |
| `shared/progress.js` | Gum Nuts, the upgrade catalogue and prices, and what each upgrade changes |
| `workshop.html` | The Workshop: buying and switching upgrades |
| `shared/sound.js` | Sound effects, synthesised in code (no audio files), and the mute setting |
| `shared/art.js` | Drawing of the wombats, poops, platforms, lettuce, ground and goal line |
| `shared/base.css` | Page layout shared by both modes, and the bundled font |
| `shared/fonts/` | Comic Neue, the game's font ([SIL Open Font License](shared/fonts/OFL.txt)) |
| `tools/compare.js` | Refactor safety check, see [tools/README.md](tools/README.md) |
| `tools/bump-version.js` | Stamps the `shared/` links with version hashes, and keeps `sw.js`'s file list current (see below) |
| `tools/make-icons.js` | Draws the icons and link-preview image with the game's own art |
| `icons/` | Favicon, home-screen and app icons, and the link-preview image |
| `manifest.webmanifest` | Makes the game installable as an app |
| `sw.js` | Offline play: keeps a copy of the game for when there's no connection |

Both pages load the `shared/` files as ordinary `<script>` tags rather than ES
modules, so the game still works when opened directly from disk.

The game runs on a fixed clock of 60 steps a second, whatever the screen's
refresh rate, so it plays at the same speed on a 60 Hz laptop and a 120 Hz
phone. All speeds and timers are counted in those steps.

Each mode tunes the pile physics its own way. The campaign is softer and caps
how fast poops fall. Those settings sit in a `TUNE` block near the top of each
page's script.

### Saved data

Everything is kept in the browser's `localStorage`:

- `wombatPoopScores` / `wombatPoopScoresUp`: the endless-mode top 5, Classic
  and Upgraded (`wombatPoopHigh` keeps just the Classic best, for older
  front pages; `wombatPoopName` remembers the last name typed;
  `wombatPoopMode` remembers Classic or Upgraded)
- `wombatProgress`: your Gum Nuts and the upgrades you own
- `wombatCampaignSave`: the campaign in progress
- `wombatMuted`: whether sound is off
- `wombatTutorialDone`, `wombatCampaignTutorialDone`: the first-play tips have
  been shown (delete these to see them again)

## Making changes safely

**After editing anything in `shared/`, run:**

```bash
node tools/bump-version.js
```

It stamps each `shared/` link in the pages with a hash of the file
(`shared/physics.js?v=3fa9c2e1`). Browsers cache the site's files for a few
minutes, and without a new stamp a player could get a fresh page with a stale
shared script. `node tools/bump-version.js --check` tells you whether any stamp
is out of date without changing anything.

It also updates `sw.js`, the offline copy's file list and cache name, so
players' saved copies refresh when anything changes. Pages always come from the
network when there is one, so updates aren't held back by the offline copy.

**After changing the art,** redraw the icons and preview image:

```bash
node tools/make-icons.js
```

It needs `rsvg-convert` (part of librsvg). Run `bump-version.js` afterwards.

If you're cleaning up code and the game should play exactly the same afterwards,
run the comparison tool:

```bash
node tools/compare.js
```

It replays both versions side by side and points to the first frame where they
differ. See [tools/README.md](tools/README.md).

## License

MIT, see [LICENSE](LICENSE). The bundled Comic Neue font is by the Comic Neue
Project Authors under the SIL Open Font License, see
[shared/fonts/OFL.txt](shared/fonts/OFL.txt).
