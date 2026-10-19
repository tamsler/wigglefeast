# Tasks

## 1. Memory and signals

- [ ] 1.1 Append `read` to `TACTICS` with shares easy 0 / normal 0.2 / hard 0.5 / expert 1; verify with engine tests that existing bots' other tactics are unchanged (same ids give the same answers for the first nine tactics), Easy has no `read`, and Expert has it on every bot
- [ ] 1.2 Add the per-bot `ai.seen` memory with lazy decay (kills half-life 15 s, grudge 10 s), the drop threshold and the 16-entry cap; verify with engine tests that values decay as specified and the memory never exceeds 16 entries
- [ ] 1.3 Record seen kills (within 900) and close kills (grudge, within 300) in `Game.die` for reading bots; verify with engine tests that a kill within view counts, a kill far away does not (*Unseen kill*), and a kill right next to a bot also adds a grudge
- [ ] 1.4 Add a grudge when a reading bot's evasion fires against a worm, at most once per second per worm; verify with an engine test using the #78 evasion scene that the cutter ends up with a grudge
- [ ] 1.5 Confirm impressions aren't saved; verify with an engine test that a save/load round-trip yields bots with empty memories and no `retaliating`, and the snapshot still validates

## 2. Uses

- [ ] 2.1 Prey choice: drop seen killers unless they're at most half the bot's mass; retaliate against the highest-grudge candidate unless two other bots are already retaliating against it; clear `ai.retaliating` when the hunt ends; verify with engine tests for *Seen killer gets room* (not prey), *Much smaller killer*, *Cut off, then retaliates*, *Bigger culprit* (not prey) and *No gang-ups*
- [ ] 2.2 Keep away: scale the evade range by `1 + 0.5·min(2, wary)`; verify with engine tests that a reading bot evades a seen killer, and a bigger culprit it holds a grudge against, at a distance where it ignores an unknown worm
- [ ] 2.3 Run `node tools/balance.js` on every level; verify churn, top-bot size and hunting pressure on the stand-in stay within noise of v1.15 on Easy and Normal, and record Hard and Expert numbers in the PR

## 3. Reputation tags

- [ ] 3.1 Track a transient `killTimes` list per worm in `Game.die`, and draw `⚔N` after names and red-orange names for bots retaliating against the player; verify with a browser test that records `fillText` calls: a worm given two recent kills shows "⚔2", a kill older than 60 s doesn't count, and a bot retaliating against the player has its name drawn in red-orange
- [ ] 3.2 Look at the tags in play on desktop and phone sizes; verify they're readable and don't clutter (at most one short tag per name)

## 4. Release

- [ ] 4.1 Update the README's difficulty paragraph (seen kills, grudges) and HUD notes (⚔N tags, red-orange names), bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`; verify all tests pass
- [ ] 4.2 Open the PR (`Closes #83`), run the `pr-reviewer` agent in an isolated worktree, address its findings, and merge once checks pass

## Workflow follow-up

- After merge, run `/opsx:archive` for this change and sync the bots and hud specs.
- Possible follow-up issue: a bounty on the leaderboard's #1.
