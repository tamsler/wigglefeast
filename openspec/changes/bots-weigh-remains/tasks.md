# Tasks

## 1. Baseline

- [x] 1.1 Before touching the engine, save seeded baseline reports to the scratchpad: `node tools/balance.js --minutes 2 --runs 3 --seed 100` for `--diff easy,normal,hard,expert --profile careful` at `--bots 30` and at `--bots 150`, and the remains probe (share of hunting and coiling moments with more dropped food within 400 than the kill would drop). Verify the report files exist and note per-level careful survival, bot deaths by tactic and ms/tick.

## 2. Remains that last

- [x] 2.1 Turn remains points into records `{ x, y, reach, mass, value, time }` in `Game.die` (reach from body length and spread, per design Decision 1); raise `CFG.REMAINS_TIME` to 60; refresh `value` from live non-natural food within `reach` every 0.25 s of game time right after `rebuildFoodGrid()`, and prune records that are eaten up or expired. Verify with engine tests: *Remains outlast the first seconds* (20 s after a big death the remains still count) and *Remains eaten up* (after most of the food is removed, the value drops to what's left, and the record goes once almost nothing is left).
- [x] 2.2 Score scavenging by live `value` instead of the dropped `mass`. Verify the existing scavenging tests (*Big worm dies nearby*, *Remains already contested*) still pass unchanged.

## 3. Meal before fight

- [x] 3.1 Add `CFG.HUNT_ODDS` (start 0.5), a hunt score `HUNT_ODDS × 0.8 × prey mass / (d + 200)`, and the meal score of the best uncontested remains, for bots that know `scavenge`. Verify `node tools/balance.js --minutes 0.1 --runs 1 --set HUNT_ODDS=0.3` runs.
- [x] 3.2 Prey acquisition skips candidates whose hunt score doesn't beat the meal score. Verify with an engine test (*A meal before a new hunt*): a scavenging bot free to pick prey next to a big uncontested pile doesn't start a hunt, and without the pile it does.
- [x] 3.3 Hunt continuation drops the hunt (cut, pin and coil) when the meal score beats the current prey's hunt score. Verify with engine tests: *Hunting next to a big meal*, *Coiling next to a big meal* (a coiling bot leaves its coil for the pile) and *A few leftovers* (a small pile doesn't stop the hunt).
- [x] 3.4 Bots without `scavenge` and Easy are unaffected. Verify with engine tests: *Bots that don't scavenge* (a hunting bot without the tactic keeps hunting next to a big pile), and a seeded Easy world's snapshot after 20 s is identical to one from main's engine (compare against a recorded hash).

## 4. Measure and tune

- [x] 4.1 Re-run the 1.1 reports and the remains probe on the same seeds. Verify with a before/after table (careful survival median and p25, deaths by tactic, bots hunting the player, top-bot and >1000 counts, bot deaths per minute, ms/tick, remains-probe share). Easy must match exactly apart from ms/tick, and Expert at 150 bots must be within +5% ms/tick.
- [x] 4.2 If a level's careful survival median moves by more than about ±25%, tune `HUNT_ODDS` within 0.3–0.8 and repeat 4.1. If no value in that range brings it back, stop and report the numbers to the owner before going on. Verify with the final table saved for the PR.

> 4.1–4.2 outcome: Hard (+37%) and Expert (−37%) careful survival moved past ±25% (12 runs × 2 seeds). No `HUNT_ODDS` in 0.3–0.8 brought Expert back, and longer remains memory and the meal rule each made Expert harder on their own: Expert bots, all scavengers, kill each other less, grow bigger and eat the remains the careful stand-in lived on. Reported to the owner, who accepted the shift and kept `HUNT_ODDS` at 0.5. Expert and Hard are now about even for the careful stand-in, where before Expert was the easier of the two. Playtest to follow.

## 5. Release

- [x] 5.1 Update the README difficulty paragraph (bots that scavenge put a big meal before a fight), bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`. Verify that all tests pass.
- [ ] 5.2 Open the PR (`Closes #122`) with the before/after table, run the `pr-reviewer` agent, address its findings, and merge once checks pass.

## Workflow follow-up

- After merge: `/opsx:archive bots-weigh-remains` in its own PR, which syncs the *Scavenging* requirement into `openspec/specs/bots/spec.md`.
- Ask the owner for a playtest on Hard and Expert: do bots now leave fights for big piles, and does anything feel off?
