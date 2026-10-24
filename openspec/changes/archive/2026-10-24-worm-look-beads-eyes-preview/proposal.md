# Proposal

## Why

Worms are drawn as one flat tube: colour bands, a thin shine line and two small eyes on the sides of the head. Next to other worm games they look plain and flat, and the menu only shows each skin as a small round swatch, so players can't see what their worm will look like before playing. Tracked in tamsler/wigglefeast#161.

## What Changes

- **Ridged, round body.** Every worm's body reads as a stack of thin round discs, one per segment, laid from tail to head: a smooth outline with fine curved ridges across it (each disc's back edge, with a faint light rim inside it) and a soft highlight along its length, so it looks round. This replaces the thin glossy shine line. (A first plan used a few big shaded balls; the owner preferred the dense ridged look, and stamping a shaded image per disc was far too slow, so ridges are drawn as lines.)
- **Every finish keeps its look.** Each finish (stripes, gradient, neon, metallic, spots, scales, galaxy, pulse) keeps its colours, and its markings (spots, diamond scales, stars, neon lights and glow) are drawn over the ridged body. Animated finishes keep moving with game time and stop while paused.
- **Boosting: arrows only.** The glow along the whole body while boosting is removed; the two arrows stay, a little further ahead of the head so they clear the bigger eyes.
- **Big cartoon eyes.** Two larger eyes sit near the front of the head, close together and facing forward, with large pupils that look where the worm is steering, and a small white glint.
- **Skin preview in the menu.** Under the Skin label, a wider strip shows a worm in the selected skin, drawn with the same code as the arena. It wiggles gently and changes as soon as another skin is picked. With reduced motion turned on it holds still.
- The outline, shield flicker, draw order (heavier worms on top), the player's head drawn last (#102) and drawing only the on-screen part of long bodies (#82) all stay as they are.

### Out of scope

- A thinner tail. The tail is drawn the same width as the rest of the body, because collisions use the full width and a thin tail would look smaller than it is.
- Hats, glasses, mouths or other accessories (a good fit for unlockables with #14).
- New skins, changes to skin colours, the order of skins, or how skins are saved.
- The app icon and the curled worm in the branding.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `skins`: how a worm's body and eyes are drawn (ridged round body, finishes as colours plus markings, boost arrows without the body glow, new eyes) and a new skin preview in the menu next to the picker.

## Impact

- `main.js`: the finish routines (split into a per-band colour and markings), a new body painter that adds the ridges, `drawWormBody` (ridges replace the shine line, no boost glow, new eyes), `drawBoostArrows` (further ahead), `skinSwatch` (swatches use the same painter), and a new menu preview canvas drawn by the existing frame loop while the menu shows.
- `index.html` and `style.css`: a preview canvas under the Skin label, sized for desktop and phone menus.
- `sw.js`: VERSION bump (minor: visible new feature). No new files.
- Tests: `tests/browser/skins.test.js` (preview present, follows the picked skin, swatches still drawn), existing draw-order, massive-worm and 150-bot frame-time checks must keep passing.
- No engine, save or settings changes; collisions and worm sizes are unchanged.
