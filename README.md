# 💩 Combat Wombat: Poop Stacker

A browser game about a wombat in a combat headband that poops cubes, and you,
who have to catch them on a little platform and stack them into a tower before
it topples. (Real wombats do poop cubes.)

**Play it:** <https://donkeyeatsbacon-web.github.io/wombat-poop/>

It runs in any modern browser, on desktop and phone, with nothing to install.
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
  best score is saved under your name.

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
  toilet paper and how easily the tower topples.

Progress saves automatically after each day, so you can close the page and
**Continue** later.

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
| `shared/sound.js` | Sound effects, synthesised in code (no audio files), and the mute setting |
| `shared/art.js` | Drawing of the wombats, poops, platforms, lettuce, ground and goal line |
| `shared/base.css` | Page layout shared by both modes, and the bundled font |
| `shared/fonts/` | Comic Neue, the game's font ([SIL Open Font License](shared/fonts/OFL.txt)) |
| `tools/compare.js` | Refactor safety check, see [tools/README.md](tools/README.md) |
| `tools/bump-version.js` | Stamps the `shared/` links with version hashes (see below) |

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

- `wombatPoopHigh`: the endless-mode best score and name
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
