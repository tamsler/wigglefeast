# Tasks

## 1. Baseline

- [ ] 1.1 Save seeded baseline reports before touching the engine: `node tools/balance.js --minutes 2 --runs 12 --seed 100 --bots 30 --diff easy,normal,hard,expert --profile careful` (and `--seed 200`). Verify the files exist and note per-level careful survival, top-bot size and bot deaths per minute.

## 2. Cheaper boost

- [ ] 2.1 Add `CFG.BOOST_COST_BASE = 1.5` and `CFG.BOOST_COST_SHARE = 0.005`, and use them for the drain in `Worm.update`; the 60% dropped share stays. Verify with an engine test (*Boost cost*): a mass-3,000 worm boosting for 1 s loses about 16.5 and accumulates about 9.9 to drop, and `node tools/balance.js --minutes 0.1 --runs 1 --set BOOST_COST_SHARE=0.01` runs.
- [ ] 2.2 Update the README controls line if it states a cost, bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`. Verify that all tests pass.

## 3. Measure and ship

- [ ] 3.1 Re-run the 1.1 reports on the same seeds. Verify with a before/after table (careful survival, top-bot and >1000 counts, bot deaths per minute) for the PR.
- [ ] 3.2 Open the PR (`Closes #125`) with the table, run the `pr-reviewer` agent, address its findings, and merge once checks pass.

## Workflow follow-up

- After merge: `/opsx:archive halve-boost-cost` in its own PR.
