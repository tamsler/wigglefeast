# Tasks

## 1. Growth rules

- [x] 1.1 Set `CFG.SHED_ABOVE` to 10000 and `CFG.SHED_RATE` to 0.002; verify with an engine test that a worm at 20,000 loses 20 mass over one second (±1%), and that a worm at 10,000 or below loses none
- [x] 1.2 Change `lengthFor` and `radiusFor` above mass 10,000 (design decision 2); verify with engine tests that both are unchanged at and below 10,000, continuous and increasing above it, that a 50,000-mass worm has radius > 62 and is shorter than both 2× its 10,000 length and a 30-bot arena's edge, and that a 100,000-mass worm stays within the save limits and round-trips through save and load
- [x] 1.3 Add an engine test that a scripted worm fed a steady intake of 60 mass per second holds above 30,000 (with shedding balancing it), so massive growth is reachable; verify it fails with the old shedding numbers
- [x] 1.4 Run `node tools/balance.js` on every level; verify that top-bot median and share stay close to today's numbers (bots are limited by survival), and record them in the PR

## 2. Camera and drawing

- [x] 2.1 Draw only the visible stretches of a worm's body in `drawWorm` (design decision 4); verify with a browser test that a long worm crossing the screen still draws (pixels at a visible part of its body are filled) and that a frame-time check with the player at 50,000 mass stays within the bound used for #81
- [x] 2.2 Check the camera at player radius 80–90 (design decision 3); verify with a browser test that the zoom keeps decreasing between mass 10,000 and 50,000, and by looking at a massive player on desktop and phone sizes

## 3. Release

- [x] 3.1 Update the README (growth and shedding note), bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`; verify all tests pass, including `tests/fixtures/save-v1.json` still loading
- [x] 3.2 Open the PR (`Closes #82`), run the `pr-reviewer` agent, address its findings, and merge once checks pass

## Workflow follow-up

- After merge, run `/opsx:archive` for this change and sync the gameplay spec.
