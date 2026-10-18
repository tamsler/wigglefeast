# Tasks

## 1. Engine

- [x] 1.1 Change the arena radius to `bc ≤ 60 ? 1800 + 60·bc : 5400·√(bc/60)` and accept 5–150 bots in `validateSnapshot`; verify with engine tests that the radius is unchanged for 5–60 bots, about 8538 at 150, and that food and power-up density matches a 30-bot world
- [x] 1.2 Add engine tests: a 150-bot world saves, validates and restores (151 is rejected); a 150-bot Expert simulation stays healthy (bot count, finite state) within the tick budget; verify with `node --test tests/engine.test.js`
- [x] 1.3 Run `node tools/balance.js --bots 150` on every level; verify that churn per bot, top-bot share and stand-in hunting pressure stay close to the 60-bot numbers (bot density is unchanged), and note the ms per tick

## 2. Menu and settings

- [x] 2.1 Raise the slider maximum to 150 and accept 5–150 in `loadSettings`; verify with a browser test that 150 can be chosen, starts a 150-bot world, and survives a reload, while a stored 151 falls back to 30
- [x] 2.2 Add a browser frame-time check at 30, 60 and 150 bots (design decision 4); verify it passes and record the engine and frame times in the PR

## 3. Release

- [x] 3.1 Update the README (bot range, arena size note), bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`; verify all tests pass
- [x] 3.2 Open the PR (`Closes #81`), run the `pr-reviewer` agent, address its findings, and merge once checks pass

## Workflow follow-up

- Owner playtest on a phone at 150 bots. If it stutters, lower the maximum in a follow-up.
- After merge, run `/opsx:archive` for this change and sync the bots and gameplay specs.
