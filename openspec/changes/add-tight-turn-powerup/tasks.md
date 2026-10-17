# Tasks

## 1. Engine

- [x] 1.1 Add `turn: 14` to `POWERUP_WEIGHTS`, `turn: 0` to the worm `pw` defaults, `CFG.TURN_POWER_MULT = 2`, and apply it to the maximum turn in `Worm.update` while `pw.turn > 0`; verify with an engine test that two identical worms told to turn around (one with the power-up) turn at a 2:1 rate, with and without boosting, and that the effect ends when the 16 s run out
- [x] 1.2 Verify save compatibility with engine tests: `tests/fixtures/save-v1.json` and a save whose worms' `pw` lack `turn` still load with the effect off, and a save holding an active `turn` timer and an arena `turn` power-up round-trips through `validateSnapshot` and `new Game`

## 2. Display

- [x] 2.1 Add `turn: { icon: '🌀', label: 'Tight turns', color: '#8ac926' }` to `POWERUP_INFO` in `main.js`; verify with a browser test that collecting one shows the "🌀 Tight turns!" feed message and a HUD timer for it
- [x] 2.2 Add the 🌀 entry to the README power-up list; verify it matches the in-game label

## 3. Touch HUD layout

- [x] 3.1 Make the power-up timers compact on short touch screens (`@media (pointer: coarse) and (max-height: 520px)` in `style.css`) and turn on all six power-ups in the touch layout test (keeping the boost badge showing if #37 has landed); verify the layout tests pass at every phone size and the desktop layout tests are unchanged

## 4. Release and integration

- [x] 4.1 Bump `VERSION` in `sw.js` to the next minor version (no new files, so `FILES` unchanged); verify `.github/scripts/check-version.sh main` passes after committing
- [x] 4.2 Run `node --test "tests/**/*.test.js"`; verify every test passes, including the bot simulation health checks
- [ ] 4.3 Manual check in a real browser: the 🌀 power-up appears in the arena, collecting it visibly tightens turning with mouse and keyboard, and the HUD timer and feed message show; verify by noting the result in the PR

## Workflow follow-up

- Open a PR that closes tamsler/wigglefeast#38, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- Archive the change with `/opsx:archive` after merge.
