# tools/compare.js

Checks that a change to the game's code didn't change how the game behaves.
Use it after a cleanup or refactor, when the game should look and play exactly
as before.

It runs two versions of a page side by side in Node, with the same random
numbers and the same scripted player. It then compares every drawing call,
frame by frame, along with everything the game saves to `localStorage`.
Gameplay shows up in the drawing, so any difference in where things land,
how the pile wobbles or what the HUD shows gets caught.

## Requirements

- Node.js (developed on v22; it needs no npm packages)
- `git` and `tar` on your PATH, only when comparing against a git commit

## Running it

From the repo root:

```bash
node tools/compare.js
```

This compares the last commit (`HEAD`) against the files as they are now,
including uncommitted edits. It covers both pages, two seeds, and both a
casual and a skilled test player, and takes about three minutes.

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `--old <ref or dir>` | `HEAD` | The "before" version: any git ref (`main~3`, a commit hash, a tag) or a folder |
| `--new <dir>` | this checkout | The "after" version, as a folder |
| `--page <name>` | `both` | `endless`, `campaign` or `both` |
| `--frames <n>` | `20000` | Frames to play per run (60 frames ≈ 1 second of play) |
| `--seeds <list>` | `1,2` | Comma-separated random seeds; each seed is a different game |
| `--skilled` | both | Only the skilled player (follows falling poops, finishes stacks, climbs levels) |
| `--casual` | both | Only the casual player (sloppier, so it topples and misses more) |

Examples:

```bash
# quick check of just the campaign
node tools/compare.js --page campaign --frames 5000 --seeds 1

# a longer, more thorough run against an older commit
node tools/compare.js --old main~3 --frames 40000 --seeds 1,2,3,4
```

## Reading the output

Each run prints one line, then the situations it reached:

```
wombat-poop.html seed=1 skilled: identical over 20000 frames, storage identical, reloads=0
  covered: diarrheaDrop, lettuce, level2+, paused, puddle, shrunk
```

- **`covered`** lists the situations the test player got into, such as
  `topple`, `level2+`, `banked` (a campaign stack finished) or `continue`
  (resumed a saved campaign). A pass only vouches for what was covered. If
  your change touches something that isn't listed, add frames or seeds until
  it shows up.
- **`reloads`** counts how many times the campaign run simulated the app being
  closed and reopened from its save.

The last line is `PASS` or `FAIL`, and the exit code is 0 or 1, so it can be
used in scripts.

On a failure it shows the first drawing call that differs:

```
MISMATCH at frame 127: old 68 ops, new 68 ops
  first diff op 2
  old: fillRect fs=#7cc23f 0,898,720,960@1,0,0,1,0,0 a=1
  new: fillRect fs=#7cc23f -60,898,840,900@1,0,0,1,0,0 a=1
```

Here the fill colour (`fs=`) is the grass green and the rectangle size
changed, so the ground strip is what differs. Each line holds the drawing
call, its style, its coordinates, and after `@` the canvas transform. If a
version crashes, the run reports `THREW` with the error instead.

## When a FAIL is expected

The tool flags every visible difference, including ones you made on purpose.
If you changed gameplay or visuals deliberately, a failure is expected. To
check the rest of the change, apply the same deliberate change to a copy of
the old version and compare against that folder with `--old <dir>`.

## Keeping it working

- **The campaign page needs a `let L = null;` line.** The skilled player reads
  the current level's state through it, read-only. If you rename or move that
  variable, update the pattern near the top of `scriptsOf()` in `compare.js`.
- **The test players find things by their colours.** For example, they find the
  player wombat by its red headband dot (`#e74c3c`). Recolouring these won't
  break the comparison, but the test player will play worse and cover less.
