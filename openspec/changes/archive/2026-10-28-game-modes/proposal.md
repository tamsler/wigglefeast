# Proposal

## Why

Wigglefeast has one open-ended mode: a run goes on until the worm dies, with no goal to aim at. Issue tamsler/wigglefeast#12 asks for modes that give a run a point: a **Timed match** (best score when the clock runs out, with a final rank among the bots) and **Survival** (bots get tougher and more numerous the longer you last; the score is time survived). Players who like a clear finish line, and players who want a harder late game, have nothing to play for today.

## What Changes

- A **Mode** picker on the main menu: **Classic** (default, exactly today's game), **Timed** and **Survival**. The choice is remembered like the other menu settings.
- **Timed**: a fixed 5:00 match. The clock starts when the player's worm spawns. When it reaches zero the match ends, the player's score is ranked among every worm in the arena, and a result screen shows the final rank ("Finished #3 of 31"). Dying before the clock ends ends the match as in Classic.
- **Survival**: the longer the player lives, the harder it gets. Every minute is a new level: more bots join (up to a cap) and bots spawned from then on are sharper and more aggressive. The score is the time survived; the result screen shows time and level reached.
- **Fresh, even worlds**: every Timed or Survival run starts in a new world in which all bots start small (no starting giants or big bots), so a 5-minute race is winnable and Survival ramps up from a gentle start. Classic keeps reusing its world and its starting giants.
- A **clock element** in the HUD: the countdown in Timed, the elapsed time and level in Survival.
- **Stats**: every finished run records its mode (and, in Timed, its final rank). The stats screen gains a **Best by mode** row (Classic and Timed: best score; Survival: longest time) and the run tables show each run's mode. Runs from all modes still feed the lifetime totals, the difficulty bests and the achievements.
- **Saves**: a world remembers its mode. Saving and resuming mid-match keeps the remaining time. Existing worlds, profiles and exports load unchanged, and their runs count as Classic.
- Release: `VERSION` in `sw.js` goes from 1.35.0 to 1.36.0. No new game files.

Decisions made with the owner for this plan:
- Timed length is fixed at 5:00 (no length picker).
- Death during a Timed match ends the match; there is no respawn.
- Timed and Survival always start a fresh world with an even (all-small) start.
- Timed and Survival runs count toward totals, difficulty bests and achievements, and also get their own per-mode best.

Out of scope:
- A Timed length picker, respawning during a match, and other modes (teams, last-worm-standing, etc.).
- New achievements or skins for modes.
- Separate leaderboards, online scores or sharing results.
- Changing Classic gameplay, bot balance in Classic, or the difficulty levels.
- The Settings screen (#13).

## Capabilities

### New Capabilities
- `game-modes`: the Classic, Timed and Survival modes: the menu picker, the Timed clock and result, Survival levels and their escalation, the fresh even start, how modes appear on the death screen, and how mode runs count toward achievements.

### Modified Capabilities
- `persistence`: a world and its settings carry a mode; changing the mode creates a new world; runs record their mode (and Timed rank); the profile keeps a best per mode; old worlds, profiles and exports load as Classic.
- `bots`: the bot population is no longer always the configured count: in Survival it grows by level up to a cap, and later-spawned bots are tougher.
- `hud`: the clock element for Timed and Survival must not overlap any other HUD element.

## Impact

- `engine.js`: `Game` settings gain an optional `mode`; the Timed time-up ends the player's run from inside `update` (headless-testable); Survival level, bot target and bot toughening derive from saved state; even start for new Timed/Survival worlds; `validateSnapshot` accepts an optional, checked `mode` and a cap on bots that keeps saves under its existing limits.
- `main.js`: menu picker and the `mode` setting; always a fresh world for Timed/Survival runs; run recording (`mode`, `rank`) and `cleanProfile`/`cleanRun` (so new fields survive a reload, and old profiles default to Classic); per-mode bests; clock element; death/result screens; run table columns (the existing "Mode" column actually shows difficulty and bots, so it is relabelled).
- `index.html`, `style.css`: picker, clock element, result text, stats tiles.
- `sw.js`: `VERSION` 1.36.0.
- Tests: `tests/engine.test.js`, `tests/bots.test.js`, new `tests/browser/modes.test.js`, plus a pre-modes profile fixture. `tests/fixtures/save-v1.json` must keep loading.
- Saved data: world snapshots stay format version 1 and profiles stay version 1; every new field is optional.
