# Tasks

## 1. Baseline

- [x] 1.1 Before touching the engine, save seeded baseline reports: `tools/balance.js --minutes 2 --runs 3 --seed 4242` for easy, normal and hard (all profiles), and `--diff hard,expert --profile careful,skilled --minutes 4 --runs 12` on two seeds (for the noise band); verify the report files exist in the scratchpad and note the Hard / careful and Expert / careful survival and peak medians

## 2. Expert sharpness

- [x] 2.1 Add `DIFFICULTY.expert.sharp` with the start values from the design (think 0.6, look 1.25, dense 1, headings 1.5, sense 1.4, heads 12, escape 1); other levels have no `sharp`; verify with an engine test that only expert has it and that `--set expert.sharp.think=1` reaches it (`node tools/balance.js --minutes 0.1 --runs 1 --diff expert --set expert.sharp.think=1` runs)
- [x] 2.2 Faster re-planning: multiply the next think delay by `sharp.think` in `Game.update` (floor 0.04 s), leaving the saved `ai.interval` unchanged; verify with an engine test (*Faster reactions*) that a skill-1 expert bot re-plans more times in 10 simulated seconds than a skill-1 hard bot, and that a saved expert world's `ai.interval` values are unchanged
- [x] 2.3 Farther look-ahead and dense verification of the winning heading (best-first, points at most 2·rad apart, at most 4 dense checks, interpolated danger weights); verify with an engine test (*A thin body far ahead*): a thin body across an expert bot's path between today's sparse points blocks that heading for the expert bot, while a hard bot of the same skill still picks it
- [x] 2.4 More candidate headings and wider sensing: scale the candidate count by `headings`, the evasion range and head-gathering radius by `sense`, and track up to `heads` heads; verify with an engine test that an expert bot starts evading a cutter at a distance where a same-skill hard bot ignores it
- [x] 2.5 Multi-threat escape: with `escape` on, gather every threatening head, aim away from their weighted directions, and treat each threat's predicted path as an obstacle; keep the per-threat grudge for readers; verify with an engine test (*Two cutters*): with two cutters from different sides, the expert bot's chosen heading clears both predicted paths, where the single-threat escape runs into the second
- [x] 2.6 Bigger worms: set Expert's `bigShare` to 0.35 and `bigMax` to 5000; verify with an engine test that a new expert world (seeded, 60 bots) has about 35% large bots, none above 5000, and that easy/normal/hard starting worlds are unchanged
- [x] 2.7 Other levels unchanged: verify that the 1.1 easy/normal/hard reports match the same command after the change exactly, apart from ms/tick, and add an engine test that a seeded hard world's snapshot after 20 s is unchanged when `DIFFICULTY.expert.sharp` is removed
- [x] 2.8 Saves: verify with engine tests that `save-v1.json` still loads, and that an expert world saved and loaded again re-plans at the sharp rate (*Loaded world*)

## 3. Tune by measurement

- [x] 3.1 Run the Decision 6 arms (all on, all off, each part off on its own, including "big"), with paired seeds and 12 runs × 4 min per arm on expert, careful and skilled; drop any part whose removal doesn't make careful survival or peak worse than the noise band, removing its code; verify with a results table (per arm: careful survival and peak median, skilled deaths per minute, bot deaths from `body` and from the player, ms/tick) saved for the PR
- [x] 3.2 Tune the kept parts' values within the ms/tick budget (at most about 25% over the 1.1 Expert baseline); verify with the final seeded report: Expert / careful survival and peak median at or below Hard / careful on the same seeds (spec: *Expert is harder than Hard for a careful player*); if that gate fails, stop and report the numbers to the owner before going on
- [x] 3.3 Update the engine tests from section 2, and the *Initial world* numbers in the spec delta, to the final values; verify `node --test tests/engine.test.js` passes

> 3.1–3.2 outcome (design Decision 7): the stand-ins couldn't tell the arms apart beyond noise, so the gate wasn't met by measurement. The owner playtested, decided "it's better" and kept all parts, then chose trimmed values (think 0.7, headings 1.3) to stay within the tick budget. The spec scenario that depended on the gate was replaced.

## 4. Release

- [x] 4.1 Play Expert on desktop for a few minutes; verify that bots don't look twitchy, are visibly harder to cut off, and the frame rate holds; ask the owner for a playtest
- [x] 4.2 Update the README difficulty paragraph (what makes Expert sharper, and its bigger worms), bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`; verify that all tests pass
- [ ] 4.3 Open the PR (`Closes #110`) with the baseline and final tables, run the `pr-reviewer` agent, address its findings, and merge once checks pass

## Workflow follow-up

- After merge, run `/opsx:archive` for this change and sync the bots spec.
- If the 3.2 gate shows sharper bots aren't enough: a follow-up issue for Expert bots hunting much bigger worms, for example the leader.
