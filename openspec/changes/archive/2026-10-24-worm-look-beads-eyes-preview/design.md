# Design

## Context

Worms are drawn in `main.js`. `drawWormBody` strokes a dark outline (width 2r + 4), then calls the skin's finish routine (`FINISH[skin.finish]`), which strokes the body tail to head in runs of 3 segments (segments sit 0.42 r apart), then adds a translated white "glossy" stroke for most finishes, and finally draws the eyes and boost arrows. Several mechanisms rely on this path and must keep working:

- **Span culling (#82):** only the on-screen segment range (`span`) is traced; decorations step through `stepRange` with absolute segment numbers, so patterns don't shift as a worm moves on and off screen.
- **Head pass (#102):** worms are drawn lighter first; the player's head is drawn again last, clipped to a disc of r + 3, but only when another worm's body actually covers it (`headCovered`). Otherwise the head pass draws only eyes and arrows.
- **Swatches (#58):** `skinSwatch` paints a short body with the same finish routine on a small canvas.

A throwaway prototype (outside the repo) first tried one solid shaded ball per 3-segment band. The owner then asked for a denser look, like a stack of many thin discs with fine curved ridges and a smooth outline. Stamping a shaded disc image on every segment gave that look but took about 230 ms per frame with 150 bots in view, so the final approach draws the ridges as lines (decisions 1–4).

## Goals / Non-Goals

**Goals:**
- One drawing path for the arena, the swatches and the new preview, so they can't drift apart.
- Frame cost per worm stays about the same: a fixed, small number of canvas calls per band, nothing allocated per frame.
- Segment numbering stays absolute, so markings, band colours and ridges don't jump when only part of a body is drawn.

**Non-Goals:**
- Changing worm geometry, collision radii or the engine.
- Per-skin textures or images (everything stays procedural, works from `file://`).

## Decisions

### 1. The body is a smooth tube plus one ridge per segment
The body is still stroked as a tube in runs of 3 segments, each run in its band's colour, over the dark outline. On top, each segment i ≥ 1 gets a ridge: the part of a circle of radius r around it that a disc on segment i − 1 would not cover, i.e. the arc more than `acos(d / 2r)` away from straight ahead (d = distance to segment i − 1; about 78° for the usual 0.42 r spacing). That is exactly what shows when thin discs are stacked tail to head, so the body reads as many overlapping discs with a smooth outline. All ridges of a worm go into one path, stroked once in translucent black (width 0.08 r).

- Alternative: actually fill a disc per segment and stamp a shading image on it. Same look, but about 100× the drawing cost in testing, because each disc is a separate fill and image draw that can't be batched.
- Alternative: a solid ball every 3 segments (the first plan). Cheap, but the owner preferred the dense ridged look.

### 2. A light rim inside each ridge, and a soft highlight along the body
A second path of arcs at radius 0.88 r, over the part of that circle the next disc would not cover, is stroked in faint white, so each ridge has a light edge in front of its dark line and the discs look raised. A translucent white stroke (0.6 r wide), shifted toward the top left of the screen, runs along the body so it reads as a round tube. Neon and galaxy draw ridges and highlight at reduced alpha, as they skipped the shine line before, so their dark bodies stay dark.

### 3. Finishes split into a band colour and markings
Each finish becomes two parts, keeping the existing formulas:

| Finish | Colour for the band starting at segment a | Markings drawn over the body |
|---|---|---|
| stripes | `colors[(a / 3) % len]` | none |
| gradient | blend along the body | none |
| metallic | the moving shine blend | none (the old edge line is dropped; the highlight replaces it) |
| pulse | the travelling glow blend | none |
| galaxy | the nebula blend | stars |
| spots | base | spots |
| scales | base | diamond scales |
| neon | dark body | glow strokes **under** the body, then the bright centre line and running lights over it |

Animated colours still use game time `t`, so they freeze while paused, and the swatches still pass a fixed `t`.

### 4. Small worms skip the ridges
When a body is under 6 screen pixels wide, the ridges, light rim and highlight are skipped: they wouldn't be visible, and this keeps the worst case (many bots, zoomed far out) as cheap as before. With 150 bots crowded into view, drawing takes about 5.3 ms per frame against 3.4 ms before (GPU-enabled Chrome, both at 60 fps); a 50,000-mass player takes 2.9 ms against 1.2 ms.

### 5. Boosting: arrows only
The accent-coloured glow stroked around the whole body while boosting is removed (owner request). The two arrows stay and move further ahead (tips at 2.6 r and 3.7 r ahead of the head point, from 2 r and 3.1 r) so they clear the bigger eyes; the on-screen check for a boosting worm widens to match.

### 6. Eyes
`drawEyes(g, w-like data)` takes a context, so the arena, swatch and preview share it. Eye centres sit 0.34 r forward of the head point and 0.4 r to each side; eye radius 0.44 r with a thin dark outline; pupil radius 0.25 r, offset 0.17 r toward `targetAngle` (where the worm steers), so it stays inside the eye; a white glint of radius 0.08 r toward the top left of the pupil. The eyes stay in the head pass, so they are still drawn last and above the worm's own body.

### 7. Skin preview: a canvas under the Skin label, drawn by the existing frame loop
`index.html` gets a `<canvas id="skinPreview">` between the Skin label and the swatch grid: full menu width, about 64 CSS px tall (56 on narrow phones), sized at the device pixel ratio (capped at 2, as the swatches are). While the menu is visible, the existing `frame` loop redraws it: a worm of about 28 segments laid along a travelling sine wave across the strip, head to the right, with its pupils following the wave. It uses the body painter, finish and eye code with its own context, `span = null`, and page time for animated finishes. `refreshMenu()` already runs when a skin is picked, so the next frame shows the new skin; it also covers a remembered hidden skin, which has no selected swatch.

- With `prefers-reduced-motion: reduce` (checked through `matchMedia`, updated on change), the wave is drawn at a fixed phase and finishes at a fixed time.
- When the menu is hidden, the preview is not drawn, so it costs nothing during play.
- Alternative: a separate `requestAnimationFrame` loop. A second loop is easy to leave running; the frame loop already knows when the menu shows.
- The debug hook gains `previewSkin()` (the name of the skin last drawn in the preview) and a count of head repaints, for the tests.

## Risks / Trade-offs

- **[More drawing per worm]** → Two extra paths of arcs per worm (ridges and rims). Mitigation: ridges skipped under 6 px (decision 4); span culling unchanged; measured as above. Slow phones are checked by hand before merging.
- **[Existing pixel tests assume a flat body]** → The draw-order test's "no seam behind the head" check reads the darkest pixel along the centreline, and the dark ridges are now there on purpose. It is rewritten to check the actual bug it guarded (#104): with nothing over the player's head, the head is not repainted (head-repaint count 0), and with a body across it, the pixels just inside and outside the repaint circle's edge match. The draw-order colour checks keep their intent (which worm is on top), and still pass as is.
- **[Shield transparency]** → A shielded worm is drawn at reduced alpha; ridges are drawn at the same reduced alpha, so the flicker looks as before.
- **[Ridges on sharp turns]** → The ridge maths assumes the next disc sits straight ahead along the body; on tight curls the arcs are still drawn from each pair of neighbouring segments, so they follow the curve. Acceptable: discs on a real stack would look the same.

## Migration Plan

Drawing only; no saved data or settings change. Ships as a minor version bump in `sw.js`. Rollback is a normal higher-version revert.
