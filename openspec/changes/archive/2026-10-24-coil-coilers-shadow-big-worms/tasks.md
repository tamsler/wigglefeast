# Tasks

## 1. Baseline

- [x] 1.1 On a branch for #150, run `node tools/balance.js --seed 12345 --runs 3` on all four levels before any engine change, and save the report for the PR; verify it prints the seed and every level

## 2. Tactic table and the knot helper

- [x] 2.1 Append `shadow` to `TACTICS` with shares hard 0.4 and expert 1 (design decision 7; `overcoil` was appended too, then removed with coil the coiler); verify with tests in `tests/bots.test.js` that `TACTICS.slice(0, 12)` is unchanged, ids 1–40 keep their first twelve tactics on hard, normal and expert, neither new tactic appears on easy or normal, and the hard shares are near the table values
- [x] 2.2 Coil the coiler's knot helper (`knotOf`, design decisions 1–3): built and tested, then removed with the tactic (owner's decision after task 5.1); verify no `knotOf`, `overcoil` or `coilKnot` remains in the engine, tools or tests

## 3. Coil the coiler

- [x] 3.1 Prefer coilers in `pickPrey`, and circle the knot in `chasePrey` / `coilPrey` (design decisions 2–3): built and scene-tested, measured in task 5.1 (coilers killed by a coiling bot on Expert: 11 before, 8 after), then removed (owner's decision); verify `coilPrey` and `pickPrey` are back to their behaviour on `main`, and the numbers are recorded for the PR and #150

## 4. Shadowing

- [x] 4.1 Add `seekShadow` picking (design decision 4); verify with scene tests: a bot with nothing to hunt or eat and a worm three times its mass nearby starts shadowing it (*A big worm nearby*); not with two other shadowers on it (*Two shadows already*); not a worm over four times its mass (*Too big*); the player is picked like any worm (*The player as the big worm*); and a bot that doesn't know `shadow` draws no extra random numbers when a worm it could shadow is near (easy and normal staying identical is checked by task 5.1)
- [x] 4.2 Following and giving up (design decision 5); verify with scene tests: a shadowing bot's goal is a point beside the target's body behind its head, not ahead of its head; it stops after 15 s or beyond 900 (*Giving up*); a threat makes it evade instead
- [x] 4.3 Cutting in (design decision 6); verify with scene tests: alongside near the head with a clear, in-time cut it hands over to a cut-off (`ai.prey` is the target, `fromShadow` set, mode a cut mode) (*A cut opens up*); with the path blocked, or arriving after the head, it keeps shadowing (*Not in time*); it never cuts from in front of the target's head
- [x] 4.4 Update `tools/balance.js` (the `shadow` cause, deaths while shadowing) and the README's difficulty paragraph; verify the README reads correctly and `node --test "tests/**/*.test.js"` passes

## 5. Measurement and ship gate

- [x] 5.1 Re-run `tools/balance.js` with the task 1.1 seed on all levels; verify easy and normal are identical apart from ms/tick, and on hard and expert `shadow` kills appear and bot deaths per minute stay within about ±10% of before; record shadower deaths, player stand-in deaths, top bot mass and ms/tick for the PR. If it doesn't hold, tune the open values (design Open Questions) and re-run; if tuning doesn't help, stop and take the numbers to the owner
- [x] 5.2 Verify the 150-bot engine and browser frame-time tests stay within their limits

## 6. Release

- [x] 6.1 Bump `VERSION` in `sw.js` to 1.26.0 (no new game files), and run `node --test "tests/**/*.test.js"`; verify all tests pass
- [x] 6.2 Open the PR with `Closes #150` and the numbers from task 5.1. Run the `pr-reviewer` agent, verify each finding, fix the real ones and note dismissed ones in the PR, then squash-merge once *Tests* and *Release version bumped* pass; verify the `v1.26.0` release is published

## Workflow follow-up

- After merge, run `/opsx:archive` for this change and sync the bots spec.
- Playtest on a phone as a big worm: do shadowers feel fair and readable?
