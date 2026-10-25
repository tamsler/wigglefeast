# Tasks

## 1. Engine

- [x] 1.1 Before changing anything, run `node tools/balance.js` on expert with a fixed `--seed` and keep the report. Verify it runs.
- [x] 1.2 In `engine.js`, make `DIFFICULTY` `{ easy, normal, hard }` with `hard` = today's `expert` entry (delete the old `hard`), add and export `difficultyOf` (design decision 1), use it in `validateSnapshot` and when `Game` creates or loads a world so `settings.difficulty` is always one of the three; rename "expert"/"Expert sharpness" comments to "hard"/"Hard sharpness". Verify with engine tests that `DIFFICULTIES` is `['easy', 'normal', 'hard']`; `new Game({ difficulty: 'expert' })` reports `hard`; a snapshot saved with `expert` or `hard` validates and loads as `hard`; worlds created on `expert` and on `hard` from the same seed are identical after a minute of simulation; `tests/fixtures/save-v1.json` loads.
- [x] 1.3 Update the engine, bots, coil, habits and simulation tests: `expert` → `hard`; remove or fold in expectations that only held for the old Hard (half the bots escaping coils, some shadowing, 20% large starters up to 2500, prey ratio 1.6). Verify `node --test tests/engine.test.js tests/bots.test.js tests/coil.test.js tests/habits.test.js tests/simulation.test.js` passes.
- [x] 1.4 Run `node tools/balance.js` on hard with the same seed as 1.1 and verify the report matches 1.1 apart from time per tick (Hard is the old Expert).

## 2. Game page

- [x] 2.1 `index.html`: three difficulty buttons (Easy, Normal, Hard). `main.js`: `loadSettings` maps old names with `difficultyOf`; `cleanProfile` maps run difficulties and sets the Hard best to the higher of old Hard and Expert, keeping only three keys (design decision 2). Verify with browser tests that the menu shows three buttons; a remembered `expert` or `hard` setting selects Hard; a stored profile with an Expert run and bests `hard: 3000, expert: 7000` shows the run as hard and a Hard best of 7,000 with three tiles; importing such an export does the same; `tests/fixtures/save-v1.json` imports.
- [x] 2.2 Achievements: rename Expert Survivor to Hard Survivor, "Reach 10,000 on Hard", reading the Hard best; Hard Mode unchanged; ids kept (design decision 3). Verify with browser tests that a profile with `ach.expert` earned shows Hard Survivor earned and Cosmic unlocked; a Hard best of 10,000 earns Hard Survivor; tapping locked Cosmic says "Reach 10,000 on Hard to unlock Cosmic". Update `tests/browser/achievements.test.js` expectations that named Expert.
- [x] 2.3 Update the browser tests that use `expert` (`difficulty`, `habits`, `learning-cue`, `bots`, `import`, `audio` helpers): the learning cue shows on Hard and never on Easy or Normal. Verify those files pass.

## 3. Release and integration

- [x] 3.1 Bump `VERSION` in `sw.js` to 1.31.0 (no new files). Run `node --test "tests/**/*.test.js"` and verify everything passes.
- [ ] 3.2 Check on a real device that the menu shows three levels and that a Hard run plays like Expert did (cut-offs, coils, the learning brain).

## Workflow follow-up

- Open the PR with `Closes #177`, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- After merge, run `/opsx:archive` to sync the specs and archive this change.
