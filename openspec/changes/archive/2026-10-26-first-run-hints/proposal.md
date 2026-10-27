# Proposal

## Why

New players are dropped into the arena with only the menu's one-line controls, and the core rule ("your head hitting a body kills you; make others hit yours") isn't explained anywhere (tamsler/wigglefeast#10). A few short hints on the first run fix that without a tutorial screen.

## What Changes

- **A short chain of hints on a new player's first run(s)**, one at a time, in a pill at the bottom centre of the screen:
  1. *Steer*: "Move the mouse to steer" (touch: "Drag to steer"). Done when the player has turned.
  2. *Boost*: "Hold click or Space to boost: it costs a little size" (touch: "Hold the boost button to boost: it costs a little size"). Done when the player has boosted.
  3. *Danger*: "Don't hit other worms with your head. Make them hit yours." Done after it has been on screen for 6 seconds.
  4. *Power-ups*: "Grab the glowing power-ups for a boost." Done when the player collects one, or after 6 seconds.
- **Each hint is remembered once seen**, so later runs show only the ones not seen yet, and a player who has seen all four never sees them again. A hint appears only while the game is running (paused: nothing moves, nothing counts) and never takes a tap or a click.
- **Existing players don't see them**: a profile that already has games played counts as having seen every hint.
- **"Show tips again"** on the stats screen turns them back on.
- The seen hints are stored in the profile as an optional field, so old profiles, old exports and `save-v1.json` load unchanged, and an export carries them.

### Out of scope

- A settings screen (#13, still open); the stats screen is where "Show tips again" lives.
- Hints in a mouse window shorter than about 420 px (no room beside the leaderboard): none show and none count as seen.
- A tutorial level, arrows or highlights in the arena, voice or sound for hints, or hints after the first runs (for example about difficulty or skins).
- A way to skip a hint with a tap: hints never take input (see the design).
- Translating the hints (the game is English only).

## Capabilities

### New Capabilities

- `first-run-hints`: which hints a new player sees, when each starts and ends, how they look and where they sit, and how they are shown again.

### Modified Capabilities

- `persistence`: the profile gets an optional record of the hints seen; old profiles load as "seen everything" if they have games played; Reset stats keeps it; export, import and the other-window merge carry it.

## Impact

- `main.js`: a small hint controller (state in the frame loop, triggers read from the running game), a `tips` field in `emptyProfile` / `cleanProfile`, the merge when one is seen, the "Show tips again" button; Reset stats keeps the seen tips.
- `index.html` and `style.css`: the hint pill (`role="status"`, bottom centre, above the touch controls on touch screens, no pointer events, calm fade, none under reduced motion) and a button on the stats screen.
- `tests/browser/`: a new `hints.test.js` (first run shows them, a later run doesn't, touch wording, no overlap at 360×640, 640×360 and desktop, paused freezes, Show tips again, old profile loads, import) and `tests/engine.test.js` or a persistence test for the profile field.
- `sw.js`: VERSION 1.34.0 (a visible feature). Nothing else shipped changes; no new files, so `FILES` is unchanged.
