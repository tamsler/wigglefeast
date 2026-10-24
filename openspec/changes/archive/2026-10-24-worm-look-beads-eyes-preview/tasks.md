# Tasks

## 1. Ridged round body and boosting

- [x] 1.1 Before changing any drawing code, run `node --test tests/browser/massive.test.js tests/simulation.test.js` and note the frame-time and tick-budget diagnostics (p50/p95, engine ms) as the baseline for the PR.
- [x] 1.2 Add `paintBody(g, sx, sy, r, skin, t, px)` in `main.js`: the finish's glow under the body, the tube in runs of 3 segments in band colours, then (when the body is at least 6 screen pixels wide) one path of ridge arcs (dark), one of inner rim arcs (faint light) and a soft highlight stroke, respecting `span` with absolute segment numbers, at reduced alpha for neon and galaxy; then the markings. Verify by screenshot that stripes, gradient and metallic worms show fine ridges with a smooth outline.
- [x] 1.3 Split every finish into a colour per band and markings (design table), keeping today's formulas and absolute segment numbers. Neon glow goes under the body; its centre line and lights, plus spots, scales and galaxy stars, go over it. Drop the metallic edge line and the glossy shine stroke. Verify with a screenshot of the skin picker and arena that each skin keeps its colours and markings, and that animated finishes still move while running and freeze while paused (`tests/browser/skins.test.js`).
- [x] 1.4 Use `paintBody` in `drawWormBody` (after the outline, before the eyes) and in `skinSwatch`, so arena, head pass and swatches share it. Verify `tests/browser/skins.test.js` passes (24 swatches drawn, finishes animate and freeze).
- [x] 1.5 Add a head-repaint count to `window.wigglefeastDebug`. Rewrite *no seam behind the head* in `tests/browser/draw-order.test.js` to check what #104 guarded: with nothing over the player's head the count stays 0, and with a heavier body across it the repainted head matches the same head drawn in one piece along the centreline. Verify `node --test tests/browser/draw-order.test.js` passes.
- [x] 1.6 Remove the boost glow around the body and move the boost arrows further ahead (tips at 2.6 r and 3.7 r), widening the on-screen check to 4.2 r. Add to `tests/browser/boost.test.js`: while a worm boosts, a ring of pixels just outside its body (away from the head) is unchanged from the frame before it started boosting, and the arrows still draw. Verify the boost tests pass.
- [x] 1.7 Add a browser test that the body is ridged: along a straight Emerald body's centreline, luminance dips repeat at about the segment spacing (0.42 r). Verify it passes, and fails against a flat-tube copy of `main`.
- [x] 1.8 Run `node --test tests/browser/massive.test.js tests/simulation.test.js` again, and the scratch GPU-enabled benchmark (150 bots in view, 50,000-mass player) on `main` and on the branch. Verify the smoke limits pass and note both sets of numbers in the PR.

## 2. Eyes

- [x] 2.1 Extract `drawEyes(g, hx, hy, angle, targetAngle, r)` and draw the new eyes (radius 0.44 r, 0.34 r forward, 0.4 r apart from the centre line; pupil 0.25 r, offset 0.17 r toward `targetAngle`; white glint 0.08 r), used by the arena head pass and the preview (swatches show a piece of body without the head, as today). Verify locally that eyes stay on top of the player's body under a heavier worm, while shielded and while boosting, and are clearly visible on Synthwave and Galaxy.
- [x] 2.2 Add a browser test: lay the player straight heading right with `targetAngle` straight up, then straight down; sample the pupil area above and below each eye centre and check the dark pupil moves to the steered side. Verify it passes.

## 3. Skin preview in the menu

- [x] 3.1 Add `<canvas id="skinPreview">` between the Skin label and `#skins` in `index.html`, with styles in `style.css`: full menu width, about 64 px tall (56 px at narrow widths), rounded like the panel's other blocks. Verify `tests/browser/layout.test.js` still passes and the menu has no sideways scrolling at 360 px wide.
- [x] 3.2 Draw the preview from the existing `frame` loop while the menu is visible: a 28-segment worm on a travelling sine wave, head to the right, in `settings.skin`, using `beads`, the finish markings and `drawEyes` with page time; a fixed pose and time when `prefers-reduced-motion: reduce` matches (listen for changes). Size the canvas at the device pixel ratio (capped at 2). Add `previewSkin()` to the debug hook. Verify locally that picking skins updates it straight away and that it stops drawing during play.
- [x] 3.3 Add browser tests in `tests/browser/skins.test.js`: the preview shows the remembered skin on load; clicking Leopard makes `previewSkin()` return Leopard; a remembered hidden skin (Lavender) shows in the preview; the preview's pixels change between frames, and stay the same under emulated `prefers-reduced-motion: reduce` (`Emulation.setEmulatedMedia`); the preview canvas is not drawn while playing. Verify they pass.

## 4. Spec, release and integration

- [x] 4.1 Bump `VERSION` in `sw.js` to 1.27.0 (no new files, so `FILES` is unchanged). Verify `.github/scripts/check-version.sh origin/main` passes locally.
- [x] 4.2 Run `node --test "tests/**/*.test.js"` and verify everything passes, including `tests/fixtures/save-v1.json` loading.
- [x] 4.3 Take before/after screenshots of the arena (several skins, a large and a small worm) and the menu preview, desktop and phone size, and attach them to the PR. Check on a real phone that the menu fits and the game still runs smoothly with 30 bots.

## Workflow follow-up

- Open the PR with `Closes #161`, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- After merge, run `/opsx:archive` to sync the `skins` spec and archive this change.
