# Tasks

## 1. Memory and signals

- [ ] 1.1 Append `read` to `TACTICS` with shares easy 0 / normal 0.2 / hard 0.5 / expert 1; verify with engine tests that existing bots' other tactics are unchanged (same ids give the same answers for the first nine tactics as before), Easy has no `read`, Expert has it on every bot
- [ ] 1.2 Add the per-bot `ai.seen` memory with the 30 s expiry and 16-entry cap, and the boost/wobble EMAs updated from the heads gathered each think; verify with engine tests that a worm seen boosting raises its boost score, a worm with jerky turning gets a higher wobble than a smooth one, and the memory stays within 16 entries
- [ ] 1.3 Record seen kills in `Game.die` for reading bots within 900 of the victim, with the 15 s half-life; verify with engine tests that a kill within view counts, a kill far away does not (*Unseen kill*), and the count decays to under a quarter after 30 s
- [ ] 1.4 Record escapes and catches when a bot's own hunt ends; verify with an engine test that a hunt timing out on a living prey counts as an escape and a prey dying during the hunt counts as caught
- [ ] 1.5 Confirm impressions aren't saved; verify with an engine test that a save/load round-trip yields bots with empty memories and the snapshot still validates

## 2. Uses

- [ ] 2.1 Measure wobble for low-skill and high-skill bots and the stand-in player in a headless run, set `W0` from it, and record the numbers in the design; verify the median low-skill wobble scores clearly above the high-skill one
- [ ] 2.2 Prey choice with danger and weakness (design decision 4); verify with engine tests for *Clumsy prey preferred*, *A worm that keeps escaping*, and that a seen killer is skipped unless it is at most half the bot's mass
- [ ] 2.3 Wider evade range for dangerous worms; verify with an engine test (*Seen killer gets room*) that a reading bot evades a head it saw kill at a distance where it ignores an unknown worm
- [ ] 2.4 Run `node tools/balance.js` on every level; verify churn, top-bot size and hunting pressure on the stand-in stay within noise of v1.15 on Easy and Normal, and record Hard and Expert numbers in the PR

## 3. Release

- [ ] 3.1 Update the README's difficulty paragraph to mention reading other worms, bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`; verify all tests pass
- [ ] 3.2 Open the PR (`Closes #83`), run the `pr-reviewer` agent in an isolated worktree, address its findings, and merge once checks pass

## Workflow follow-up

- After merge, run `/opsx:archive` for this change and sync the bots spec.
