# Tasks

## 1. Skins and finishes

- [x] 1.1 Archive `three-difficulty-levels` first if it isn't yet (it edits the same specs), then in `engine.js` give the six reward entries their new names, finishes, colours, accents and food colours in place (design decision 1), keeping positions and `unlock` ids. Verify with the engine skin tests (update `tests/engine.test.js`: names at positions 3, 8, 26–29, unlock ids unchanged, still hidden, `PICKABLE_SKINS` still the 24 free skins, a 150-bot world never gives a bot a reward).
- [x] 1.2 Add the six finishes and the `alpha` support in `paintBody` (decisions 2 and 3) from the prototype, with the additive-glow helper. Verify with a browser test that every reward renders in the arena without exceptions and leaves non-floor pixels on screen (extend *every skin renders in the arena* in `tests/browser/skins.test.js`), and that existing skins draw exactly as before (the rest of `tests/browser/skins.test.js` and `worm-look.test.js` pass).
- [x] 1.3 Make the swatches and preview use them. Verify with a browser test that each reward swatch canvas has colourful pixels and differs from the others, the locked ones are dimmed with a padlock, and the menu still fits (`tests/browser/layout.test.js`).

## 2. Names in tests and text

- [x] 2.1 Update the tests and texts that name old rewards: `tests/browser/skins.test.js` and `achievements.test.js` (picker names, hints, "Rainbow unlocked!" toast, Cosmic hint → Galaxy Prime) and the `skin` field shown on achievements. Verify those files pass.

## 3. Release and integration

- [x] 3.1 Take screenshots of each reward in the arena (still frames), the picker and the stats screen for the PR; run the 50,000-mass frame-time test with Inferno as the player's skin. Verify frame times pass.
- [x] 3.2 Bump `VERSION` in `sw.js` to 1.32.0 (no new files). Run `node --test "tests/**/*.test.js"` once (no parallel stress runs) and verify everything passes.
- [x] 3.3 Check on a real device that the rewards look right and animate smoothly.

## Workflow follow-up

- Open the PR with `Closes #180`, run the `pr-reviewer` agent (without browser test runs), address its findings, and merge once checks pass.
- After merge, run `/opsx:archive`.
