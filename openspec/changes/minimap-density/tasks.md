# Tasks

## 1. Density shading

- [x] 1.1 Add the 40 × 40 density grid refreshed every 250 ms (and when a run starts), counting the body area of every live worm except the player (design decisions 1 and 3); verify in the browser console that a crowd of bots placed in one quadrant raises only that quadrant's cells
- [x] 1.2 Draw the grid as a smoothed single-colour image clipped to the arena circle, under the edge ring, player marker and view rectangle, and remove the per-bot dots and top-10 highlighting from `renderMinimap` (design decision 2); verify by looking at the minimap at 5, 30 and 60 bots on the 160 px and 110 px sizes, and tune `C` so a lone small worm shows faintly and a crowd reads clearly
- [x] 1.3 Add a browser test (`tests/browser/minimap.test.js`): a crowd in one quadrant shades it clearly more than an empty quadrant, shaded pixels match the shading colour (no skin colours), the biggest worm alone gets no marker, the player's body adds no shading, and the player marker still draws; verify it fails on the old dot minimap and passes now

## 2. Release

- [x] 2.1 Update the README's HUD description if it mentions the minimap, bump `VERSION` in `sw.js` (minor), and run `node --test "tests/**/*.test.js"`; verify all tests pass, including `tests/browser/layout.test.js`
- [ ] 2.2 Open the PR (`Closes #80`), run the `pr-reviewer` agent, address its findings, and merge once checks pass

## Workflow follow-up

- After merge, run `/opsx:archive` for this change and sync the hud spec.
