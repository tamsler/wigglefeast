# Tasks

## 1. Skin table

- [x] 1.1 In `engine.js`, add the optional `finish`, `accent`, `food` and `hidden` skin fields (with defaults), mark Rainbow and Lavender hidden, append the twelve new skins at indices 14–25, export `PICKABLE_SKINS`, pick bot skins from it, and make `stripeColor` use `food`; verify with engine tests that the 14 original skins keep their index, name and colours, that every skin has a valid finish and `#rrggbb` colours, that 2,000 bot spawns never pick a hidden skin, that a Synthwave worm's death food uses only its food colours, and that the v1 fixture still loads

## 2. Drawing

- [x] 2.1 In `main.js`, add a routine per finish (stripes, gradient, neon, metallic, spots, scales, galaxy, pulse) with colour runs of 3 segments and patterns spaced in body lengths, dispatched from `drawWorm`; use `skin.accent` for the minimap dot, the boost glow and the boost arrows; and drive animation from `game.time`; verify with a browser test that puts a worm of every skin in view and renders frames with no page errors, and with headless screenshots of all twelve new skins in the arena
- [x] 2.2 Verify animated finishes freeze while paused: a browser test that pauses with a Magma worm in view and checks two frames render identically (canvas pixels hashed), while unpaused frames differ

## 3. Skin picker

- [x] 3.1 Build picker swatches as small canvases drawn by the finish routines, list only visible skins (each button keeping its real skin index), use an 8-column grid, and show no selection for a remembered hidden skin; verify with browser tests that 24 swatches show (no Rainbow or Lavender), that picking Galaxy and pressing Play gives the player that skin and remembers it, and that a remembered Lavender loads and plays as Lavender; verify the existing menu layout tests still pass at every size

## 4. Release and integration

- [x] 4.1 Bump `VERSION` in `sw.js` to the next minor version (no new files); run `node --test "tests/**/*.test.js"` and verify every test passes and `.github/scripts/check-version.sh main` passes after committing
- [ ] 4.2 Manual check on desktop and a phone: every new skin looks like its Skin Lab preview in the arena and in the picker, and a 60-bot arena stays smooth; verify by noting the result in the PR

## Workflow follow-up

- Open a PR that closes tamsler/wigglefeast#58, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- Archive the change with `/opsx:archive` after merge.
