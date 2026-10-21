# Tasks

## 1. Total kills on the tag

- [ ] 1.1 Make the name-tag label in `main.js` use `w.kills` (shown when > 0), and remove `killTimes`/`recentKills` from `engine.js` after checking with `grep` that nothing else uses them. Verify with the browser test in `tests/browser/tags.test.js` (*Killer*: a worm with 2 kills shows ⚔2; *Kills don't fade*: a minute of game time later it still shows ⚔2; *No kills yet*: no tag), keeping the red-orange retaliation check.
- [ ] 1.2 Replace the "name tags start empty" engine check with *After loading*: a saved and loaded world's worms keep their kill counts. Verify with `node --test tests/engine.test.js`; `save-v1.json` still loads.
- [ ] 1.3 Update the README Names line, bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`. Verify that all tests pass.

## 2. Ship

- [ ] 2.1 Open the PR (`Closes #126`), run the `pr-reviewer` agent, address its findings, and merge once checks pass.

## Workflow follow-up

- After merge: `/opsx:archive kill-tag-total` in its own PR.
