# Tasks

## 1. Tactic and detection

- [ ] 1.1 Append `escape` to `TACTICS` with shares easy 0 / normal 0 / hard 0.5 / expert 1, and gather `heads` for bots that know it; verify with engine tests that the first ten tactics are unchanged, Easy and Normal have no `escape`, and Expert has it on every bot
- [ ] 1.2 Add the coiler check (design decision 1); verify with engine tests using a laid-out coil (a 3,000-mass worm's body on a circle of radius 150 around a 120-mass bot, its turnRate set to match): the bot is detected as circled; a big worm passing straight by, a big worm circling a point 800 away, and a coil around a bot with open space (short body) are not
- [ ] 1.3 Verify fairness: with an engine test, the decision is the same whether the coiler is a bot in `coil` mode, a bot in another mode, or the player (*Only what's visible*)

## 2. Counter and fallback

- [ ] 2.1 Counter-cut (design decision 2), with escape ranked above hunting and evasion; verify with an engine test that in the laid-out coil the bot's mode is `escape`, `ai.aim` lies on the coiler's predicted path ahead of its head, and the bot can reach it at least 0.1 s before the coiler
- [ ] 2.2 Gap fallback (design decision 3); verify with an engine test using a large coil (radius 400, no cut point reachable within 0.8 s) where the remaining gap is on one side: the bot's mode is `escape` and it heads into the gap
- [ ] 2.3 Repeated encounters: run the baseline scenario (40 coils of a 120-mass bot by a 3,000-mass coiler, 6 s each) with and without the tactic; verify in an engine test that with it the coiler dies in clearly more encounters and the prey in fewer (thresholds set from the measured rates, with margin)

## 3. Balance and release

- [ ] 3.1 Run `node tools/balance.js` on Hard and Expert, and on Easy and Normal for regression; verify coil kills drop on Hard and Expert, churn and tick time stay within noise everywhere, and record the numbers in the PR
- [ ] 3.2 Update the README's difficulty paragraph (circled bots fight back on Hard and Expert), bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`; verify all tests pass
- [ ] 3.3 Open the PR (`Closes #94`), run the `pr-reviewer` agent in an isolated worktree, address its findings, and merge once checks pass

## Workflow follow-up

- After merge, run `/opsx:archive` for this change and sync the bots spec.
- Possible follow-up issue: a cue for the player that they are being circled.
