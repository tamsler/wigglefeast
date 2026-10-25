# Design

## Context

- **Profile** (`wormarena.profile`, `PROFILE_VERSION = 1`): `totals` (games, kills, time, eaten, best, bestByDiff), `top` (10 best runs) and `recent` (50 latest), each run with peak, kills, eaten, time, difficulty. `cleanProfile` rebuilds it from checked fields (imports, damaged data); `recordRun` merges a finished run into the stored profile (another window may have written meanwhile, #45). Export writes `{ app, kind, v, profile, world }`; import replaces both; Reset stats clears the profile and habits.
- **Skins**: `SKINS` in `engine.js`, saved by position (append only). `hidden` skins (Rainbow, Lavender) aren't offered in the picker and aren't in `PICKABLE_SKINS`, which bots pick from. The picker in `main.js` builds swatches for non-hidden skins.
- **Live run data**: the player's worm has `mass`, `peak`, `kills`, `eaten`, `born`; `game.leaderboard[0]` is the leader; `onSpecial` fires when the player eats special food.

## Goals / Non-Goals

**Goals:**
- One declarative list of achievements, each with a progress function, used for unlocking, past play and the stats screen alike.
- Achievements saved the moment they're earned, merged safely with other windows.
- Backward compatible both ways: older profiles load; an older version of the game loading a newer profile still works (it ignores the extra fields).

**Non-Goals:**
- Server-side anything; tracking new per-run details beyond the two counters below.

## Decisions

### 1. Skins: append four, mark unlockables with `unlock`
`SKINS` gains Dragon (scales `#9b1d12 / #ffb703 / #3d0a05`), Thunder (neon `#15140a / #ffe14d / #fffbe0`), Royal (metallic `#5b2a86 / #ffd86b / #2a0f40`) and Cosmic (galaxy `#1a0526 / #c2187a / #ffd1f0`), with the accents and food colours from the prototype the owner saw. All six rewards get `hidden: true` (so `PICKABLE_SKINS`, and therefore bots, never include them) and `unlock: '<achievement id>'`. The picker shows `!hidden || unlock` skins: the free ones first, then the six rewards.

### 2. Achievement list with progress functions
In `main.js`, `ACHIEVEMENTS` is an ordered array of `{ id, name, goal, skin?, progress(ctx) → [value, target] }`. `ctx` is the stored profile plus, during a run, the live run (`peak`, `kills`, `eaten`, `time`, `specials`, `first`, difficulty):

| id | progress |
|---|---|
| snack / noodle / titan | max(totals.best, live peak) vs 1,000 / 5,000 / 25,000 |
| hard / expert | max(bestByDiff.hard / .expert, live peak on that difficulty) vs 5,000 / 10,000 |
| firstbite / apex | totals.kills + live kills vs 1 / 100 |
| hunter | max(kills of saved top and recent runs, live kills) vs 10 |
| hang / marathon | max(time of saved runs, live time) vs 300 / 1,200 s |
| dedicated | totals.games vs 50 |
| grazer | totals.eaten + live eaten vs 10,000 |
| stargazer | totals.specials + live specials vs 25 |
| board | totals.firsts + (live first ? 1 : 0) vs 1 |

Run time uses `game.time − born`, which only advances while the game runs, so pauses don't count.

### 3. Profile fields
The profile keeps `v: 1` and gains optional fields: `ach: { [id]: unlockedAt }` and `totals.specials`, `totals.firsts`. `cleanProfile` accepts them when valid (known ids, finite non-negative numbers) and fills missing ones with `{}` / 0, so older profiles and exports load unchanged. An older game version rebuilds only the fields it knows, so a rollback simply forgets achievements (they're re-proven from stats on the way forward again).

- Alternative: bump to `v: 2`. That would make older versions reject newer profiles as damaged, which is worse than dropping the extra fields.

### 4. When achievements are checked
- **On load and after import**: `checkAchievements()` with no live run, silently (past play).
- **During a run**: every 0.5 s of play, `checkAchievements(liveRun)`; it also marks the run's `first` flag when `game.leaderboard[0] === player`. Newly earned ones get `ach[id] = Date.now()`, the profile is saved at once (re-reading the stored profile first and keeping the union of `ach`, like `recordRun`), and each shows a pop-up and plays the fanfare.
- **At the end of a run**: `recordRun` adds the run's special food and first-place flag to `totals.specials` / `totals.firsts`, then a silent check (nothing new is normally left).
- **Reset stats**: the profile (with `ach`) is cleared; nothing is re-earned until stats prove it.

### 5. Picker, pop-up, stats section
- **Locked swatches**: the normal swatch canvas dimmed, with a small padlock badge; `aria-label` "Cosmic (locked)". Clicking one doesn't change `settings.skin`; the skin name line shows "Reach 10,000 on Expert to unlock Cosmic" for a few seconds.
- **Pop-up**: a toast near the top centre, "🏆 Big Noodle" with "Rainbow unlocked!" underneath when a skin comes with it, shown for 3 s; several in a row queue up.
- **Stats section**: "Achievements (5 / 14)" with one row per achievement: name, goal, a progress bar with "3,200 / 5,000", or "Earned 12 Oct" and the skin it unlocks.

### 6. Fanfare
`audio.js` gains `achievement`: a bright five-note rising triangle arpeggio (C5 E5 G5 C6 E6) over a soft sine sparkle, about 0.6 s, distinct from the power-up chime (four notes, faster).

## Risks / Trade-offs

- **[Special food in an unfinished run]** → The live count is kept in `main.js`; if the page is closed mid-run and the run is resumed from the autosave, that run's earlier special food isn't counted toward Stargazer. Acceptable for a 25-item goal; achievements already earned mid-run are saved at once.
- **[Hungry Hunter / Marathon from past play]** → Only the saved top 10 and recent 50 runs are known, so an old 10-kill run outside both lists can't be proven. Acceptable; the spec says "the saved runs".
- **[Several windows]** → Saving merges with the stored profile, so two windows can't erase each other's achievements (#45).

## Migration Plan

No migration step: existing profiles load with empty `ach` and the past-play check earns what they prove. Minor version bump. Rollback: older versions ignore the new fields.
