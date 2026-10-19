# Tasks

## 1. Field

- [x] 1.1 Add `drawMagnetField` and call it in `render` after the arena floor and before food, for live worms with an active magnet whose head is near the view (design decisions 1–4); verify by looking at a player and a bot with magnets on desktop and phone sizes, including the last 3 seconds and while paused
- [x] 1.2 Add `tests/browser/magnet.test.js`, recording arcs, stroke colours and alpha on the game canvas. Verify:
  - with the player's magnet active, waves are forward arcs about 110° wide centred on the heading, alternating blue and red by distance, with none beyond the food pull range and no full circle
  - with no magnet, none are drawn
  - a bot's waves are fainter than the player's
  - with under 3 s left, waves are fainter than at full time
  - while paused, two frames draw identical waves; while running, they move
  - the field is drawn before food (call order)

  The test must fail without the field.
- [x] 1.3 Extend the 150-bot frame-time check to give every bot a magnet; verify frame times stay within its bounds

## 2. Release

- [x] 2.1 Update the README's power-up line (the magnet shows its field), bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`; verify all tests pass
- [ ] 2.2 Open the PR (`Closes #103`), run the `pr-reviewer` agent in an isolated worktree, address its findings, and merge once checks pass

## Workflow follow-up

- After merge, run `/opsx:archive` for this change and sync the gameplay spec.
- Possible follow-up: streaks on food being pulled in.
