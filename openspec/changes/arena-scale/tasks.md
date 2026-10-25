# Tasks

## 1. Camera zoom

- [x] 1.1 Change `targetZoom` in `main.js` to divide by `1 + (p.r − 14) / 35`. Add a browser test (in `tests/browser/massive.test.js`, next to the existing zoom test) that reads the settled zoom at spawn and at mass 1,000, 10,000 and 50,000 and checks each settled zoom matches `1 / (1 + (r − 14) / 35)` for the worm's radius at that moment (±2%), and that relative to a new worm (mass 15) that is about 0.74, 0.54 and 0.41, and that the zoom power-up multiplies the zoom by 0.62. Verify the new test and the existing *camera keeps zooming out past 10,000* test pass.

## 2. Bigger food

- [x] 2.1 Add `foodSizes(f, pulse)` and use it for food in `render`: Classic glow `f.r × 6.5`, themed glow `f.r × 6.5` and item `f.r × 5.4`, both times the pulse. Expose the factors on `window.wigglefeastDebug`. Add a browser test in `tests/browser/themes.test.js` that a radius-10 food reports a 54-unit item and 65-unit glow in a themed arena and a 65-unit dot in Classic, and that special food and power-ups keep their sizes. Verify `tests/browser/themes.test.js` and `tests/browser/specials.test.js` pass.
- [x] 2.2 Add an engine check that pickup is unchanged: a worm's head eats a piece of food from the same distance as before (`r × 0.9 + f.r × 0.4`) and pulls it from the same reach (`2.2 r + 24`). Verify with `node --test tests/engine.test.js` (or the food test file it belongs in).

## 3. Floor

- [x] 3.1 Replace `makeHexPattern` with the new 240×139 tile (design decision 1) and expose the tile size on the debug hook. Add a browser test that the floor tile is 240×139, and that pixels on a big hexagon's groove are darker than pixels near its centre. Verify it passes, and `tests/browser/themes.test.js` and `tests/browser/layout.test.js` still pass.

## 4. Release and integration

- [x] 4.1 Run `node --test tests/browser/massive.test.js tests/simulation.test.js` and the scratch GPU benchmark on `main` and on the branch (150 bots in view, player at 50,000). Verify the smoke limits pass and note the numbers in the PR.
- [x] 4.2 Bump `VERSION` in `sw.js` to 1.28.0 (no new files). Run `node --test "tests/**/*.test.js"` and verify everything passes, including `tests/fixtures/save-v1.json` loading.
- [ ] 4.3 Take before/after screenshots at mass 15, 1,000 and 10,000 (desktop and phone size) for the PR. Check on a real phone that the floor texture doesn't shimmer distractingly when zoomed out and the game runs smoothly.

## Workflow follow-up

- Open the PR with `Closes #163`, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- After merge, run `/opsx:archive` to sync the `gameplay` and `food-themes` specs and archive this change.
