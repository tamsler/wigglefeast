# Tasks

## 1. Engine: modes, Timed clock, Survival levels

- [x] 1.1 Add `CFG.TIMED_LENGTH` (300), `CFG.SURVIVAL_LEVEL` (60) and a `MODES` list with a `modeOf` normaliser (unknown → classic); give `Game` an optional `settings.mode`, write it in `toJSON`, and make `validateSnapshot` accept it missing and refuse an unknown value. Verify with engine tests: an old snapshot (`tests/fixtures/save-v1.json`) loads as classic, a snapshot with a bad mode throws, and a Timed snapshot round-trips its mode.
- [x] 1.2 Add `matchTime(w)` and `survivalLevel(w)` helpers derived from `game.time - player.born`. Verify with engine tests: the values are right after 0, 59, 61 and 125 seconds, and are unchanged after a snapshot round-trip.
- [x] 1.3 Timed time-up: at the end of `update`, refresh the leaderboard, take the player's rank and the worm count, then `kill(player, null, 'time')`, with `rank` and `total` on the `death` event. Verify with engine tests: the player is killed at 300 s, not before; rank and total are right (first, middle, last); a player who died earlier is not killed again; nothing happens in Classic and Survival.
- [x] 1.4 Even start: a new Timed or Survival world has no starting giants or big bots (every bot at mass 15–200); Classic creation is untouched. Verify with engine tests for all three modes, and that the existing Classic simulation and bot tests pass unchanged (same seed, same results).
- [x] 1.5 Survival escalation: the respawn loop uses a bot target of `min(cap, base + step × (level − 1))` with `cap = min(150, 2 × base)` and `step = max(1, round(0.1 × base))`; bots spawned above level 1 get `skill` and `aggro` raised by 0.05 per level, clamped to 1, without extra random draws in Classic. Verify with bot tests: 30 bots reach 33 at level 2 and 36 at level 3, stop at 60, never grow with 150 bots, replacements at level 6 are sharper than at level 1 (and within range), and Classic and Timed keep exactly the configured count.
- [x] 1.6 Save at the cap: snapshot and restore a Survival world at its bot cap (30 and 150 configured). Verify the snapshot validates, restores with the same level and bots, and stays under the 200-worm and 500-queue limits.
- [x] 1.7 Run `node --test "tests/**/*.test.js"` and confirm every existing test is green before moving on.

## 2. Profile and stats

- [x] 2.1 Teach `cleanRun` and `cleanProfile` the new fields: run `mode` (missing or unknown → classic) and optional integer `rank`; `totals.bestByMode` (missing → classic from `totals.best`, others 0). Add them to `emptyProfile`. Keep `PROFILE_VERSION` at 1. Verify with a browser test: a pre-modes profile and `save-v1.json` import with every run listed as Classic, and the Classic best equals the old best.
- [x] 2.2 `recordRun` writes `mode`, `rank` and `by: 'Time up'` for a clock end, and updates `bestByMode` (Classic: peak; Timed: score, only for a run ended by the clock; Survival: time). Verify with browser tests: record a Classic, a Timed (clock end), a Timed death and a Survival run, reload, record one more, and check all fields and bests survive; a Timed death leaves the Timed best unchanged.
- [x] 2.3 Reset stats clears `bestByMode`; export and import carry the new fields. Verify with a browser test of export → reset → import and of reset.
- [x] 2.4 Stats screen: a "Best by mode" tile row (Classic score, Timed score, Survival time as m:ss); the existing run tables' "Mode" column (difficulty · bots) is relabelled "Level" and a new "Mode" column shows the mode, with the rank for Timed. All values escaped. Verify with a browser test that reads the tiles and the tables, including a run with a hostile name, and a check of the stats screen at 360×640.

## 3. Menu and run flow

- [x] 3.1 Menu: add the Mode picker (Classic / Timed / Survival) with a one-line description, default Classic; load, validate and save `settings.mode`, ignoring unknown values. Verify with a browser test: default is Classic, the choice survives a reload, old settings load as Classic.
- [x] 3.2 `startPlaying`: Timed and Survival always create a fresh world; a mode change creates a new world; Classic still reuses its world when bot count and difficulty match. Verify with browser tests: Play again after a Timed match gives a new world; Classic Play again keeps the world (same worm ids / time continues).
- [x] 3.3 Ending a run: on a clock end, show the result ("Time's up!" or "You won!", "Finished #R of N", score, kills); on a Survival death show time survived and level reached; Timed deaths and Classic deaths look as before; the "Personal best" line uses the mode's best. Verify with browser tests that drive a Timed world to its end (advance game time through the test helper) and a Survival death.
- [x] 3.4 "Welcome back" panel shows the remaining time in Timed. Verify with a browser test: save with 2:10 remaining, reload, Resume, the clock reads 2:10 and then counts down; pausing does not change it.

## 4. HUD clock

- [x] 4.1 Add the `#clock` element (hidden in Classic): Timed shows `m:ss`, highlighted at 10 s or less; Survival shows `m:ss · Lv N`. Update it from the HUD loop using the engine helpers. Verify with a browser test of the text in all three modes, the highlight at 10 s, and no element in Classic.
- [x] 4.2 Layout: place the clock so it overlaps nothing; extend the layout test for Timed and Survival at 1280×713, 360×640 and 640×360 with all six power-ups, a rank outside the top 10, a hint showing and the touch buttons visible. Verify the test passes at all three sizes.

## 5. Release

- [x] 5.1 Bump `VERSION` in `sw.js` to `1.36.0` (no new files, so `FILES` is unchanged). Verify with `tests/release.test.js` and `node --test "tests/**/*.test.js"`.
- [x] 5.2 Sync documentation: update `README.md` if it lists game features or modes. Verify by reading it for the old single-mode wording.
- [ ] 5.3 Manual checks on a real phone and a desktop browser (menu picker, a short Timed match to the buzzer, a Survival run past level 3, close and reopen mid-match, install/offline unaffected). Run test Chrome with the fake audio output from `tests/helpers`.
- [ ] 5.4 Run the `pr-reviewer` agent on the PR, verify and fix each finding, note dismissed ones in the PR, then squash-merge once checks pass.

## Workflow follow-up

- Open the PR with `Closes #12`, after confirming the plan with the owner.
- After merge, archive this change with `/opsx:archive`, which syncs the delta specs into `game-modes`, `persistence`, `bots` and `hud`.
