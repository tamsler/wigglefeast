# Tasks

## 1. Baseline

- [ ] 1.1 Before touching the engine, save seeded reports: `node tools/balance.js --minutes 4 --runs 12 --bots 30 --diff expert --profile careful` on seeds 100 and 200, `--minutes 2 --runs 3 --seed 100 --diff easy,normal,hard`, and the md5 of a seeded 20 s world snapshot for easy, normal and hard. Verify the files exist in the scratchpad.

## 2. The record (engine)

- [ ] 2.1 Add `freshHabits()`, `validHabits()`, the `CFG.HABIT_*` constants and `Game` taking `opts.habits` (design Decisions 1 and 4); export them for `main.js` and the tests. Verify with engine tests that a fresh record is empty, that invalid records (wrong version, negative, non-finite, huge) are rejected, and that one update decays the old counts by `HABIT_DECAY` and adds the new outcome.
- [ ] 2.2 Observe cut-off encounters with the player in `Game.update` (design Decision 2). Verify with engine tests using a scripted bot cutting the player off:
  - turning away, turning toward and keeping straight are recorded as such, and boosting is recorded
  - one encounter at a time, at least 1 s apart
  - *Habits come from movement only*: changing the player's `targetAngle` without the worm turning before the window ends records `straight`
  - nothing is recorded when the player is shielded or dies
- [ ] 2.3 Recording leaves worlds unchanged. Verify with an engine test (*Other levels unchanged*) that a seeded easy, normal and hard world after 20 s is identical with and without a pre-filled record, and that the md5s match the 1.1 baseline.

## 3. Using it (Expert)

- [ ] 3.1 Append `learn` to `TACTICS`; Expert gets it automatically, the other levels have share 0. Verify with an engine test that every expert bot knows `learn`, no hard bot does, and every bot of a seeded world keeps its other tactics (compare against the list before the change).
- [ ] 3.2 Shift the cut toward the learned escape side (design Decision 3), with precedence pin, flank, learn, trap. Verify with engine tests: *Escaping the same way every time* (with a strong `away` record the aim moves to the away side, compared with no record), *Little evidence* (after 1–2 encounters the shift is under a third of the cap), *No record* (the aim is exactly the same as a bot without `learn`), and *Prey choice unchanged*.
- [ ] 3.3 Lead farther for a player who boosts (design Decision 3). Verify with an engine test (*Boosting out of trouble*): with a strong `boost` record the aim lies further ahead along the player's heading than with no record.
- [ ] 3.4 *A new style*: verify with an engine test that after 20 `away` encounters, 10 `toward` encounters make `toward` outweigh `away`.

## 4. Persistence (page)

- [ ] 4.1 In `main.js`, load and validate `wormarena.habits`, pass it to every new or restored game, save it in `saveWorld()` and at run end (only while active), and clear it on *Reset stats*. Verify with a browser test in `tests/browser/` that a record survives a reload and reaches the new game, that reset empties it, that the exported save has no habits in it, and that a damaged stored record starts empty with no page errors.
- [ ] 4.2 Verify `tests/fixtures/save-v1.json` still loads and imports, with `node --test "tests/**/*.test.js"`.

## 5. Measure and release

- [ ] 5.1 Re-run the 1.1 reports, plus expert with `--set expert.tactics.learn=0`, on the same seeds. Verify with a table for the PR: expert careful survival with learning on and off, `learn` kills, and the stand-in's record split. Easy, normal and hard must match 1.1 apart from ms/tick.
- [ ] 5.2 Update the README difficulty paragraph (Expert bots learn how you escape a cut-off, across games; *Reset stats* forgets it), bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`. Verify that all tests pass.
- [ ] 5.3 Open the PR (`Closes #135`) with the table, run the `pr-reviewer` agent, address its findings, and merge once checks pass.

## Workflow follow-up

- After merge: `/opsx:archive learn-player-habits` in its own PR.
- Ask the owner for a playtest on Expert over several games: do bots start catching their usual escape, and does changing style beat them again?
