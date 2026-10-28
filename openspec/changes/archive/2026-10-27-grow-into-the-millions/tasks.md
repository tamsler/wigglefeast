# Tasks

## 1. Size curves, shedding and save limit (engine)

- [x] 1.1 In `engine.js`, raise `SHED_ABOVE` to 2,000,000, lift the `radiusFor` cap from 90 to 300 and add the flatter `lengthFor` segment above 100,000 (exponent 0.08); verify with `tests/engine.test.js`: no shedding at 1,000,000, 0.2% of the excess at 3,000,000, radius about 79 / 148 at 100,000 / 1,000,000, length below 22,600 at 1,000,000 and unchanged up to 100,000 (the existing 10,000 to 50,000 test still passes).
- [x] 1.2 Raise `MAX_MASS` to 1e8 (clamps and `validateSnapshot`); verify with tests that a 3,000,000-mass world saves, validates and resumes with the same mass, radius and body length, that 200,000,000 is refused, and that `tests/fixtures/save-v1.json` still loads.
- [x] 1.3 Add a test that a worm at mass 200,000 that eats food only gains and never sheds, and that a 1,000,000-mass worm's death drops 80% of its mass in at most one pellet per segment, within `MAX_FOOD`.

## 2. Boost cost

- [x] 2.1 Add `BOOST_COST_MAX` (150) to `CFG`, halve `BOOST_COST_SHARE` to 0.0025 and cap the cost in `Worm.update`; verify with tests for mass 3,000 (about 9 lost, 5.4 dropped) and 1,000,000 (150 lost, 90 dropped), and that a worm at mass 12 or below still cannot boost.
- [x] 2.2 Check that nothing else reads the old boost cost (bots' boost decisions, `tools/balance.js`, other tests) with `grep -rn "BOOST_COST" .`, and update what does; verify `node --test "tests/**/*.test.js"` passes.

## 3. Food values and the x10 power-up

- [x] 3.1 Change the natural food table to `{1: 52, 2: 30, 4: 12, 10: 6}`; verify with a seeded test that over many spawns the shares are within a few points of 52/30/12/6 and no pellet is worth 8.
- [x] 3.2 Make `foodRadius` unchanged under 50 and `min(60, 20 + 18·log10(v/50))` from 50 up; verify with tests: radius of 49 or more for 2,000, 60 at 10,000, identical to the old formula for every value below 50.
- [x] 3.3 Append `x10: 2` to `POWERUP_WEIGHTS`, make `Worm.multiplier` return 10 for `pw.x10`, and add the `x10` entry to `POWERUP_INFO` in `main.js` after x5 ("Food x10", distinct colour); verify with tests: a worm with x10 gains 40 from natural food worth 4 and nothing extra from dropped food, x10 beats x5 and x2 together, x10 is the rarest type over many spawns, a save from before x10 loads with `pw.x10 = 0`, and a save with an active x10 round-trips.
- [x] 3.4 Run the whole engine suite and fix tests whose pinned seed outcomes moved because the power-up and food tables changed (for example the seeds 1, 1818 and 3436 in `tests/engine.test.js`); verify `node --test "tests/**/*.test.js"` passes, and note each re-pinned seed with a comment saying why.

## 4. HUD and layout for big numbers

- [x] 4.1 Widen the leaderboard score column (`--lb-cols`, `--lb-cols-big`, and the two narrow-layout overrides in `style.css`) to fit "99,999,999"; verify with a browser test in `tests/browser/layout.test.js` that with scores of 12, 4,567 and 12,345,678 the scores end at one position, none is clipped, and none overlaps the kills column or a name, in the wide and narrow layouts and for a 3-digit-rank player row.
- [x] 4.2 Check the score area, the game-over summary, the personal best line and the stats and high-score tables with an 8-digit score; verify in the same browser test, and adjust the CSS only where something clips.
- [x] 4.3 Add a browser test that a high score of 2,500,000 is recorded, shown in the stats and survives export and import.

## 5. Camera, rendering and speed at 1,000,000

- [x] 5.1 Extend the zoom test in `tests/browser/massive.test.js` to 1,000,000 (zoom about 0.21 of a new worm's, head and surrounding arena on screen); verify it passes.
- [x] 5.2 Extend the frame-time test to the player at 1,000,000 plus a second giant crossing the view and a corpse of large pellets; verify frames stay fast and the large pellets draw with their new radius without culling pop-in (`main.js` view-margin math follows `f.r`).
- [x] 5.3 Look at the result in a real browser: a prototype screenshot of a 1,000,000-mass worm, a 2,000-mass pellet, and the HUD with a 7-digit score, shared with the owner (they prefer prototypes and screenshots first); verify that the worm reads as huge and the pellets as big without overwhelming the screen, and adjust the radius and pellet curves if not. Run the test browser with fake audio output only.

## 6. Starting giants

- [x] 6.1 Add `CFG.GIANT_MIN_MASS` (20,000) and `giantMax` to each level in `DIFFICULTY` (35,000 / 55,000 / 80,000), and make a new world's first `min(botCount − 2, max(3, round(botCount / 10)))` bots giants in `spawnBot`; verify in `tests/engine.test.js` and `tests/bots.test.js` that a 30-bot world on every level has exactly 3 giants within range, a 5-bot world has 3 and a 150-bot world 15, the highest giants seen are higher on each harder level, the other bots stay within today's limits, and a replacement bot and a loaded save add no giants (update the existing start-size tests).
- [x] 6.2 Lay out a new body no longer than fits the arena in the `Worm` constructor and let `update` grow it to full length; verify with tests that an 80,000-mass giant in a 5-bot world starts entirely inside the arena, reaches the length `lengthFor` calls for after a minute of moving, that bodies of ordinary worms are laid out exactly as before, and that a seeded world still replays exactly.
- [x] 6.3 Check the start in the browser (a screenshot of a new 30-bot world on Hard with its giants and the player's spawn, for the owner) and that the 150-bot world still starts fast; verify the player never spawns inside a giant's body over many starts.

## 7. Size bonus on arena food

- [x] 7.1 The prototype is already in `engine.js` (`CFG.GROWTH_FROM` 1,000, `CFG.GROWTH_POWER` 0.5, `growthBonus` applied to natural food in `eatFood`); set `GROWTH_POWER` to 0.6 and verify with tests in `tests/engine.test.js`: a worm of 1,000 or less gains the plain value, a worm of 10,000 gains about 15.9 from a natural pellet worth 4 and about 31.8 with x2, a bot of the same mass gets the same, and nothing is scaled for food dropped by a worm (at mass 100,000) or for special food.
- [x] 7.2 Fix the tests the bonus changed (the 200,000-mass growth test now eats dropped food) and the earlier x10 and x5 tests keep a worm under 1,000 mass; verify `node --test "tests/**/*.test.js"` passes.

## 8. Balance

- [x] 8.1 Run `node tools/balance.js` on Easy, Normal and Hard (all three profiles, at least 3 seeds, 30 minutes) before and after the change, with the starting giants in and record largest-bot mass per run, the stand-in player's survival, and ms/tick; verify the bar in design.md (Migration Plan, step 2: the largest bot passes 100,000 in most runs on every level and 1,000,000 only rarely; stand-in survival within a few percent of today) is met, or tune `GROWTH_POWER`, `GROWTH_FROM`, `SHED_ABOVE`, `BOOST_COST_*`, the food weights and the x10 weight with `--set` and record the final values.
- [x] 8.2 Apply the tuned values to `engine.js`, then update the numbers in the delta specs and design.md if any of them moved; verify `openspec validate grow-into-the-millions` passes and the full test suite passes.
- [x] 8.3 Bump `VERSION` in `sw.js` (minor) and, if the README mentions growth or the 10,000 limit, update it; verify the *Version check* workflow's rule (a shipped file changed, so `VERSION` is higher than `main`'s).

## 9. Integration

- [x] 9.1 Run `node --test "tests/**/*.test.js"` and a playtest of a long run with a boosted giant (a console cheat or `window.__player.mass = 1000000` is enough); verify no console errors, the leaderboard and HUD read correctly, and a save and resume works at that size.

## Workflow follow-up

- Open the PR with `Closes #204`, run the `pr-reviewer` agent, address the findings, then squash-merge once *Tests* and *Release version bumped* pass.
- After merge, archive the change with `/opsx:archive` so the delta specs sync into `openspec/specs/`.
