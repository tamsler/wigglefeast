# Tasks

## 1. Baseline and measurement tool

- [x] 1.1 On a branch for #149/#94, run `node tools/balance.js --seed 12345 --runs 3` on all four levels before any engine change, and save the report in the scratchpad for later comparison; verify the report prints the seed and every level
- [x] 1.2 Add `tools/coil.js` (design decision 6) with the bot coiler and the scripted coiler, the baseline arm, `--n`, `--seed` and 95% intervals, and export `encounter()`; verify that `node tools/coil.js --n 300` reproduces the #94 baseline roughly (prey deaths in the range seen there), and that a new `tests/coil.test.js` shows the same seed giving the same outcome twice and that a scripted-coiler encounter actually closes a loop (the prey is circled in at least 6 of 8 sectors at some point)

## 2. Reachable paths

- [x] 2.1 Add `reachPath(w, a, boosted)` and `reachAt(path, s)` (design decision 1) and export them; verify with engine tests that for several headings (0°, 45°, 90°, 170° to either side), with and without boost and with the tight-turn power-up, the predicted point at 0.5 s and 1 s lies within a few units of where `Worm.update` actually takes a worm whose `targetAngle` is that heading
- [x] 2.2 Add `reach: 1` to `DIFFICULTY.expert.sharp` and give every `reach` bot the boosted-path check before boosting, with candidate headings still judged along straight lines (design decision 2; judging headings along reachable paths was built, measured and taken out); verify with an engine test the spec scenario *Turning wider while boosting* (an expert bot keeps its heading but doesn't boost when only its boosted turn hits the body)
- [x] 2.3 Verify levels without it are unchanged: an engine test runs the same seeded world on easy, normal and hard with `expert.sharp.reach` set to 0 and 1 and gets identical worlds; the existing #110 and #118 sharpness tests still pass
- [x] 2.4 Add the reach-only arm to `tools/coil.js` (the bot coiler thinks with its own reach setting, so arms change the prey alone) and run `tools/balance.js` on expert with the task 1.1 seed; record prey deaths (reach only against baseline), Expert player deaths per minute, top bot mass, bot deaths per minute and ms/tick in the notes for the PR, for both the rejected heading check and the boost check; verify the 150-bot engine test stays under its 25 ms limit
- [x] 2.5 Update the README's Expert sentence (add that they don't boost into a turn they can't make at boost speed); verify the paragraph reads correctly and `node --test "tests/**/*.test.js"` passes

## 3. Coil escape

- [x] 3.1 Append `escape` to `TACTICS` with shares hard 0.5 / expert 1 (design decision 5), and gather `heads` for bots that know it; verify with engine tests that `TACTICS.slice(0, 11)` is unchanged, a fixed set of bot ids knows the same earlier tactics as before, no bot on easy or normal knows `escape`, about half on hard do, every bot on expert does, and the existing tactic-by-level tests are updated for the new list
- [x] 3.2 Add coil detection (design decision 3) with the 0.5 s hold, not saved; verify with engine tests using a live loop (a scripted coiler run for about 1.5 s around the bot, not a hand-laid spiral) that the bot is circled, and that a big worm passing straight by, a big worm circling a point 800 away, and a loose loop around a bot with open space are not; also that saving and loading a world while a bot is circled saves no new fields and `tests/fixtures/save-v1.json` still loads
- [x] 3.3 Fairness: verify with an engine test that the detection result and the escape move are the same when an identical loop and turnRate come from a bot in `coil` mode, a bot in `wander` mode, and the player (spec *Only what's visible*), and that detection draws nothing from `g.rng`
- [x] 3.4 Escape priority and the **out** move (design decision 4.1): while circled, hunting, head-on and evasion are skipped and the coiler leaves the ghosts; verify with engine tests that a circled bot whose loop still has a reachable gap gets `ai.escape === 'out'` and heads through it; that it doesn't go for a gap whose straight line is clear but whose turn runs into the loop (*A gap it can't turn into*); and that with a second ring beyond the gap (no way out) it hugs instead
- [x] 3.5 The **head shot** (design decision 4.2): built and tested (it aimed across the coiler's predicted path early enough, and a coiler holding its course ran into the prey), then measured in task 4.1. None landed in live coils, so it was removed with its tests (owner's decision); verify no `shot` move remains in the engine or tests and the numbers are in the notes for the PR and #94
- [x] 3.6 **Hugging** (design decision 4.3); verify with an engine test that with no way out the bot gets `ai.escape === 'hug'`, moves the coiler's way round, ends up nearer the loop than its centre, and survives 3 s inside a held loop
- [x] 3.7 **Boosting while circled**: verify with engine tests that a circled bot doesn't boost when its boosted path meets the loop (*Tight loop*), may boost through a clear gap (*Straight out at speed*), and that this holds for a hard bot that knows `escape` as well as an expert one; a hard bot without `escape` boosts as before
- [x] 3.8 Report `escape` kills in `tools/balance.js` `cause()`, and update the README's difficulty paragraph (circled bots hug the loop and slip out through gaps they can turn into: half on Hard, all on Expert); verify the README reads correctly and `node --test "tests/**/*.test.js"` passes

## 4. Measurement and ship gate

- [x] 4.1 Run `node tools/coil.js --n 300` for every arm against both coilers, with Expert prey and with Hard prey; verify the spec's *Coil escape works* outcome for Expert prey with 95% intervals that don't overlap the baseline (fewer prey deaths against both coilers), and record the Hard numbers. If it doesn't hold, stop and take the numbers to the owner (design decision 7) before going on
- [x] 4.2 Tune the open values (head-shot margins and commitment, before its removal) only with `tools/coil.js`, re-running 4.1 after each change; verify the values tried and their numbers are recorded for the PR
- [x] 4.3 Add a CI test to `tests/coil.test.js` that runs a small fixed-seed batch (sized to finish in a few seconds) for baseline and reach + escape against the scripted coiler, and asserts the escape arm has clearly fewer prey deaths than the baseline; verify it passes and finishes quickly
- [x] 4.4 Re-run `tools/balance.js` with the task 1.1 seed on all levels; verify easy and normal are identical apart from ms/tick, and record the hard and expert changes (player deaths per minute, coil kills, `escape` kills, top bot mass, ms/tick) for the PR

## 5. Release

- [x] 5.1 Bump `VERSION` in `sw.js` to 1.25.0 (no new game files for `FILES`), and run `node --test "tests/**/*.test.js"`; verify all tests pass
- [ ] 5.2 Comment on #149 with the measured numbers for judging headings along reachable paths (why only the boost check ships). Comment on #94 with the head-shot numbers (it stays open for a new approach). Open the PR with `Closes #149` and `Part of #94` and the numbers from tasks 2.4, 4.1 and 4.4. Run the `pr-reviewer` agent, verify each finding, fix the real ones and note dismissed ones in the PR, then squash-merge once *Tests* and *Release version bumped* pass; verify the `v1.25.0` release is published

## Workflow follow-up

- After merge, run `/opsx:archive` for this change and sync the bots spec.
- Delete the old `coil-escape-94` branch once this lands (its plan is superseded).
- Possible follow-up issues: a cue for the player that they're being circled; coilers boosting less to circle tighter (the W2 note in #94).
