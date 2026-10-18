# Tasks

## 1. Groundwork

- [x] 1.1 Rebase this branch onto `main` once #77 (#16 tuning) has merged; verify `git log main..HEAD` shows only this change's commits and `node --test "tests/**/*.test.js"` passes
- [x] 1.2 Add `expert` to `DIFFICULTY` (skill 0.85–1, aggro 0.6–1, preyRatio 2, bigShare 0.25, bigMax 3000), a `tactics` share table on every level (design decision 1), and export `DIFFICULTIES`; verify with an engine test that every level has all nine tactic keys, Easy's are all 0, Expert's are all 1, and an Expert world spawns about 25% big bots
- [x] 1.3 Add `knows(w, tactic)` (integer hash of id and tactic index against the level's share); verify with an engine test that the result is stable across save/load (`new Game(null, clone(g))`) and that the share of bots knowing a tactic on Hard is near its table value over 600 bots
- [x] 1.4 Track the observed `turnRate` in `Worm.update` (smoothed actual heading change, not saved) and add `predictHead(o, t)`; verify with an engine test that a worm turning steadily left gets a positive `turnRate`, that `predictHead` curves the same way, and that changing `targetAngle` alone does not change the prediction (Fair information scenario)
- [x] 1.5 Keep a transient `recentDeaths` list in `Game` (filled in `die`, pruned after 6 s, not saved); verify with an engine test that a death adds an entry, it expires after 6 s, and a save/load round-trip still produces a valid snapshot

## 2. Defensive tactics

- [x] 2.1 Restructure `botThink` into mode selection (evade → hunt → headOn → scavenge → existing goals) that records `ai.mode`, without changing behaviour for bots that know no tactics; verify the existing engine tests and the Easy rows of `node tools/balance.js --diff easy` stay within noise of the #16 numbers
- [x] 2.2 Head anticipation: gather up to 8 nearby heads once per think, sample their predicted paths, and count crossings in heading scoring (design decision 4); verify with an engine test where a head is about to cross an anticipating bot's straight path (no body there yet): the bot turns away, and a bot without the tactic does not
- [x] 2.3 Evasion: threat detection and escape heading, with boost (design decision 5.1); verify with an engine test where a head closes in aiming ahead of an evading bot: `ai.mode === 'evade'` and the new heading moves away from the threat's path
- [x] 2.4 Head-on awareness: target the oncoming head of a worm under 0.85× own mass, ignore its first 3 segments as danger only in that mode, and keep bigger heads as obstacles; verify with engine tests that a bot steers into a smaller oncoming head (`ai.mode === 'headOn'`) but turns away from a bigger one, and that the smaller worm dies on contact

## 3. Hunting tactics

- [x] 3.1 Turn-aware cut-off (predict) via the meeting-time iteration; verify with an engine test where the prey turns steadily left: a predicting bot's goal lies left of the straight-line lead, and a non-predicting bot's does not
- [x] 3.2 Trapping: prey choice weighted by escape freedom, and the cut-off point chosen from 3 sideways offsets; verify with the "Prey between two bodies" engine test (two equally close worms, one boxed in by bodies) that the trapping bot picks the boxed-in one
- [x] 3.3 Edge pinning; verify with an engine test where the prey moves along the edge: `ai.mode === 'pin'` and the aim point is on the arena side of the prey, ahead of it
- [x] 3.4 Flanking; verify with an engine test where a second Expert bot hunts a worm another bot is cutting off from the left: it aims at the prey's right side (`ai.mode === 'flank'`)
- [x] 3.5 Coiling, with the length check, shrinking radius, direction, boost, escape and 6 s timeout; verify with an engine test that a long Expert bot next to a small slow worm gets `ai.mode === 'coil'` and, run for a few seconds, its body surrounds the prey's head (body points on at least 6 of 8 sectors around it) or the prey dies, and that a bot too short to circle does not coil
- [x] 3.6 Scavenging toward `recentDeaths` with a boost for large remains; verify with an engine test where a large worm dies near an idle scavenging bot: `ai.mode === 'scavenge'` and it heads for the remains

## 4. Expert in the game UI and stats

- [x] 4.1 Add the Expert button to the difficulty control in `index.html` and use `DIFFICULTIES` in `main.js` for settings validation; verify with a browser test that picking Expert and pressing Play starts an Expert world, and that settings with Expert survive a reload
- [x] 4.2 Stats: `bestByDiff.expert` (default 0), run validation accepting `expert`, and four "best by difficulty" tiles using `.grid.four`; verify with a browser test that an Expert run shows as the Expert best, and that a profile from before Expert (e.g. the profile in `tests/fixtures/save-v1.json`) imports with all its runs and Expert best 0
- [x] 4.3 Verify the menu still fits at every size in `tests/browser/layout.test.js` with four buttons, and look at the menu and stats screen on a phone-width window (no touch or install behaviour changes, so no real-device check is needed)

## 5. Tuning, docs and integration

- [x] 5.1 Extend `tools/balance.js`: default levels include expert, report kills by the killer's `ai.mode`, and print ms per tick; verify that, over both stand-ins together, the share of stand-in deaths caused by tactics and the number of bots hunting it rise from Easy to Expert, and that Easy stays within noise of #16 (stand-in survival is not the check: it tracks how crowded the arena is with big bodies and is lowest on Easy; changed with the owner's approval during apply)
- [x] 5.2 Extend the simulation health test in `tests/engine.test.js` to cover expert, and add a 60-bot Expert run; verify it passes the existing limits (bot count, wall deaths, < 25 ms/tick)
- [x] 5.3 Update `README.md` (difficulty list, a short note on what Expert bots do) and record the tactic overview in `openspec/specs/bots` through this change's delta; verify `openspec validate bot-tactics-expert --strict` passes
- [x] 5.4 Bump `VERSION` in `sw.js` (minor) and run `node --test "tests/**/*.test.js"`; verify all tests pass, then open the PR (`Closes #78`), run the `pr-reviewer` agent, and address its findings

## Workflow follow-up

- Playtest each level, Expert especially, before merging. The bot tactic shares may still change.
- After merge, run `/opsx:archive` for this change and sync the bots and persistence specs.
