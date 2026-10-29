# Design

## Context

See proposal.md for motivation and the specs for behaviour. What shapes the approach:

- `Game` (engine.js) has one world per `settings` ({ botCount, difficulty }). `botCount` sizes the arena radius `R`, the food and power-up targets and, in `validateSnapshot`, the coordinate bound. It must never change inside a living world.
- `game.time` is saved and advances only inside `update(dt)`, so it does not advance while paused, in standby or in a hidden tab. Each worm has a saved `born` (the `game.time` it spawned).
- Snapshots allow at most 200 worms and a `respawnQueue` of at most 500. A save that breaks either is refused on load, so the run would be lost on reload.
- Bots keep only `skill`, `aggro` and `interval` as per-bot, saved state. `knowsTactic` and `sharp` read the world's difficulty, so they cannot differ per bot without a schema change.
- `main.js` reuses the existing world on Play when bot count and difficulty match (`startPlaying`).
- `recordRun` reloads the stored profile through `cleanProfile`/`cleanRun`, which rebuild a profile from whitelisted fields. Any new field not whitelisted there disappears the next time a run is recorded.
- The run tables already have a column headed "Mode"; it shows difficulty and bot count.
- Classic worlds must replay exactly as before from the same seed (simulation and bot tests depend on it).

## Goals / Non-Goals

**Goals:**
- All mode state derives from fields that are already saved, so the world snapshot stays format version 1 and gains one optional `settings.mode`.
- The Timed end and the Survival level live in the engine so they are testable headless.
- Classic draws the same random numbers as today.

**Non-Goals:**
- No per-bot difficulty levels or new bot tactics for Survival.
- No change to `PROFILE_VERSION` or the snapshot version.
- No Settings-screen work (#13).

## Decisions

### 1. Mode is a world setting: `settings.mode` ('classic' | 'timed' | 'survival')
`Game` gets `settings.mode`, defaulting to classic and normalised like `difficulty` (an unknown value in the constructor falls back to classic). `snapshot()` writes it; `validateSnapshot` accepts it missing (classic) and refuses an unknown value. It is a menu setting too (`settings.mode`, saved with the others, default classic, unknown value ignored).

*Alternative: a separate field outside `settings`.* Rejected: `settings` already is "what this world was created with", and `startPlaying` compares it to the menu.

### 2. The clock and level are derived, never stored
The player's match time is `game.time - player.born`.
- Timed remaining = `300 - matchTime`.
- Survival level = `1 + floor(matchTime / 60)`.

Both survive a snapshot round-trip because `time` and `born` are saved, and neither advances while paused, in standby or hidden. The HUD reads them each frame via small engine helpers (`matchTime(w)`, `survivalLevel(w)`), so the engine and the UI share one definition. Constants `CFG.TIMED_LENGTH = 300` and `CFG.SURVIVAL_LEVEL = 60`.

*Alternative: a stored countdown.* Rejected: a second clock that must be kept in step with `time`, plus a new save field to validate.

### 3. Time-up ends the run inside `Game.update`
At the end of `update`, in Timed mode, if the player is alive and `matchTime >= 300`: take `rank = rankOf(player)` and `total = worms alive` first (after refreshing the leaderboard), then `kill(player, null, 'time')`. The `death` event carries `cause: 'time'`, plus `rank` and `total` on the event for that cause. `die()` keeps working as it does for `'quit'` (the worm turns into food).

*Alternative: main.js watches the clock.* Rejected: untestable without a browser, and rank would have to be read after the worm is gone.

The leaderboard is only refreshed every 10 ticks, so the time-up step calls `updateLeaderboard()` itself right before taking the rank.

### 4. Timed result is the score at the buzzer; the Timed best counts only matches ended by the clock
`recordRun` already stores `score` (mass at the end) and `peak`. A time-up run is recorded with `by: 'Time up'` and `rank`. The Timed best is `max(score)` over runs with `cause === 'time'`. Deaths in Timed still feed totals, the difficulty best, achievements and the top-10 by peak, but not the Timed best.

### 5. Profile changes are additive, and `cleanProfile` is taught about them
- Run: `mode` ('classic' | 'timed' | 'survival', missing or unknown → classic) and optional `rank` (a positive integer). `cleanRun` rebuilds both.
- Totals: `bestByMode: { classic, timed, survival }` (peak, score at buzzer, seconds). Missing → classic = `totals.best` (every old run was Classic, so their best peak is the Classic best), timed and survival = 0. `cleanProfile` rebuilds it, dropping unknown keys and non-numbers.
- `emptyProfile`, `recordRun`, Reset stats and export/import all go through these paths, so the fields survive a reload and a second recorded run (this is the regression a test must pin).
- `PROFILE_VERSION` stays 1.

Whether a run was ended by the clock is kept in the run as `by === 'Time up'` together with `rank` being present; there is no separate `cause` field in a stored run today, and adding one is not needed.

### 6. Survival: population and toughness derive from the level
Let `base = settings.botCount`, `cap = min(MAX_BOTS, 2 * base)`, `step = max(1, round(0.1 * base))`.
- Bot target = `min(cap, base + step * (level - 1))`. The respawn loop in `update` compares against this target instead of `settings.botCount` (equal for Classic and Timed, so nothing changes for them). Because the check runs every tick, new bots join through the normal queue (1–3 s) with no new state.
- Bots spawned at level L > 1 get `skill` and `aggro` raised by `0.05 * (L - 1)`, clamped to 1 (after the same two `rand()` calls as before, so Classic's random sequence is untouched). `interval` is still derived from `skill`, which keeps it within the validated 0.05–1.
- Existing bots keep their traits; the world difficulty, tactics and `sharp` are unchanged.
- The arena, food and power-up targets stay sized by `base`.
- With a cap of at most 150 bots the world stays far under the 200-worm and 500-queue limits; a test saves a capped world and reloads it.

*Alternative: step the world difficulty up (easy → normal → hard).* Rejected: tactics and sharpness are per-world and would change every bot at once; it would need a saved field and shifts all existing bots.
*Alternative: grow `botCount` with the level.* Rejected: it changes the arena size, which changes the snapshot bounds and the food density mid-run.

### 7. Fresh, even worlds
`Game` takes the mode at creation. In Timed and Survival, creating a world skips the starting giants and the `big` branch for initial bots, so all start at 15–200 mass (the existing "small" branch of `spawnBot`). Classic creation is unchanged. In `main.js`, `startPlaying` always builds a new `Game` when the mode is Timed or Survival; Classic keeps the "reuse if settings match" rule. The restored-world path is untouched, so Resume continues the saved world.

### 8. Menu, HUD and screens
- Menu: a three-button segmented control like the difficulty one (`#modePick`), with a one-line description below it, default Classic. The new row would have made the menu scroll on common phone and laptop sizes (a layout test forbids that), so Bots, Mode and Difficulty now put their label beside the control instead of above it. Like the other menu settings, the choice is saved when a run starts.
- HUD: one `#clock` element, hidden in Classic, inside the score area in the bottom-left corner (above the score), so it shares the space that area already has at every size instead of competing for the crowded top corners. Timed shows `m:ss` and gets a highlight class at 10 s or less; Survival shows `m:ss · Level N`. The layout test covers it at desktop and phone sizes with all power-ups, a rank outside the top 10 and the touch buttons.
- Death/result screen: a time-up shows "Time's up!" (or "You won!" at rank 1) with "Finished #R of N" under the title; a Survival death shows "Survived m:ss · Level L". Classic and Timed deaths look as before. The "Personal best" line uses the mode's own best.
- "Welcome back" panel: for Timed it adds the time remaining.
- Stats: a "Best by mode" tile row beside "Best by difficulty" (side by side on wide screens, so the stats panel still doesn't scroll on a laptop). The run tables' existing "Mode" column (difficulty · bots) is relabelled "Setup" ("Level" would be confused with Survival levels) and a new "Mode" column shows Classic/Timed/Survival; a Timed run that ran out the clock shows its rank in the "Killed by" cell ("Time up · #3"). Every value is escaped, as today.

### 9. Achievements need no counting change
They read `totals`, `top`, `recent` and the live run, all of which now include runs from every mode. The tests pin Hang In There after a full Timed match.

## Risks / Trade-offs

- [New profile fields dropped by `cleanProfile`] → Teach `cleanRun`/`cleanProfile` first, and add a test that records two runs and reloads.
- [A Survival save above the validator's limits] → Cap at `min(150, 2 × base)`, test save and restore at the cap, and keep `settings.botCount` unchanged.
- [Classic replays shift because of new random draws] → New logic is gated on mode and adds no draws for Classic; the existing simulation and bot tests must pass unchanged.
- [Timed #1 might still be hard or too easy] → The even start is the lever; the 300 s and the survival numbers are `CFG` constants so they can be tuned in a later release. A simulation test checks a bot-only world reaches a sensible spread in 5 minutes (no giants).
- [Rank ties or a mid-update leaderboard] → Refresh the leaderboard right before taking the rank and use its order (the same order the player saw).
- [Dropping `Timed` runs from top-10 ordering] → Top runs stay ordered by peak across modes, and each row shows its mode; a per-mode top list is out of scope.
- [HUD clutter on small phones] → The overlap test runs at both phone sizes before release.

## Migration Plan

No migration step: every change is optional or defaulted. Release as 1.36.0 (minor, new feature). Rollback is publishing the old code under a higher version; a profile or save written by 1.36.0 still loads in 1.35.0 because older code ignores the extra fields, except a world with `settings.mode` set, which 1.35.0 would run as an ordinary world of the same bot count and difficulty.
