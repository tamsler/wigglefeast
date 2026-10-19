# Tasks

## 1. Field

- [ ] 1.1 Add `drawMagnetField` and call it in `render` after the arena floor and before food, for live worms with an active magnet whose head is near the view (design decisions 1–4); verify by looking at a player and a bot with magnets on desktop and phone sizes, including the last 3 seconds and while paused
- [ ] 1.2 Add `tests/browser/magnet.test.js`, recording arcs, stroke colours and alpha on the game canvas. Verify:
  - with the player's magnet active, red and blue rings are drawn, none beyond the food pull range
  - with no magnet, none are drawn
  - a bot's rings are fainter than the player's
  - with under 3 s left, rings are fainter than at full time
  - while paused, two frames draw identical rings
  - the field is drawn before food (call order)

  The test must fail without the field.
- [ ] 1.3 Extend the 150-bot frame-time check to give every bot a magnet; verify frame times stay within its bounds

## 2. Release

- [ ] 2.1 Update the README's power-up line (the magnet shows its field), bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`; verify all tests pass
- [ ] 2.2 Open the PR (`Closes #103`), run the `pr-reviewer` agent in an isolated worktree, address its findings, and merge once checks pass

## Workflow follow-up

- After merge, run `/opsx:archive` for this change and sync the gameplay spec.
- Possible follow-up: streaks on food being pulled in.
