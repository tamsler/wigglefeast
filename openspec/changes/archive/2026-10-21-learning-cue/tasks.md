# Tasks

## 1. The cue

- [x] 1.1 In `main.js`, draw 🧠 beside the head of the bot being watched (`game.encounter.bot`) when it knows `learn`, with the pulse and the 0.5 s fade from a per-bot "last seen" map that `newGame` clears and that drops dead bots (design Decisions 1 and 2). Add `learningCues()` and `learningCue(id)` to `window.wigglefeastDebug` (Decision 3). Verify with a browser test in `tests/browser/` that places an expert bot cutting off a shielded-then-unshielded player:
  - *Being studied*: while the encounter runs, exactly one brain is drawn, for that bot
  - *Done watching*: after the encounter ends, the brain's alpha drops and it's gone within 1 s
  - *Other levels*: the same scene on hard draws no brain
  - no page errors
- [x] 1.2 *Nothing else changes*: verify `git diff main -- engine.js` is empty and the engine tests still pass.

## 2. Release

- [x] 2.1 Add a sentence to the README's Expert learning paragraph (a small brain shows by a bot's head while it watches how you escape), bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`. Verify that all tests pass.
- [x] 2.2 Open the PR (`Closes #138`), run the `pr-reviewer` agent, address its findings, and merge once checks pass.

## Workflow follow-up

- After merge: `/opsx:archive learning-cue` in its own PR.
- Ask the owner to check on Expert that the brain is easy to notice and not distracting.
