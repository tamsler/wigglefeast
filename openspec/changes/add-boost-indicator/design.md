# Design

## Context

- **Boost state:** the engine sets `worm.boosting` every tick. It's true only when boost is wanted *and* possible: mass above 12, or the ⚡ speed power-up running. That is exactly the "actually boosting" condition in the spec, so no engine change is needed.
- **Today's indicator:** `drawWorm()` in `main.js` already marks boosting worms with a translucent, pulsing outline (alpha 0.3–0.45).
- **Rendering:** `render()` draws food, then power-ups, then worms (player last), then names. It culls everything outside the view rectangle.
- **Frame loop:** `frame()` advances the simulation only when not paused, then renders, then updates the HUD. `updateHud` refreshes every 0.15 s. Per-frame UI state, such as the touch buttons, is synced in `frame()`.
- **HUD:** `#stats` (bottom-left) holds `.score` (the number plus a small "score" label) and the rank/kills line.
- **Touch layout:** `tests/browser/layout.test.js` checks for overlaps at phone sizes.

## Goals / Non-Goals

**Goals:**
- The indicator is purely visual. It lives in `main.js`, has no effect on the simulation and is never saved.
- It costs little even when many bots boost at once: a few strokes per boosting worm in view.

**Non-Goals:**
- Changing the existing outline glow; it stays as an extra cue.

## Decisions

### 1. Arrows in front of the head, drawn with the worm (replaces the v1.3.0 trail, #41)
`drawWorm()` draws the arrows for a boosting worm right after its body and eyes, so the worm's own body never covers them.

- **Shape:** two chevrons pointing along `w.angle`, centred 2× and 3.1× the head radius ahead of the head centre. Each arm is 1.05× the radius long, at 45° to the heading. (These were raised from 1.6×, 2.4× and 0.7× after screenshots showed the first size was too subtle.)
- **Look:** each chevron is a wide stroke in the worm's main skin colour under a thin white stroke with round caps. It reads clearly on the dark floor and over food, and is clearly the worm's own.
- **Animation:** a staggered alpha pulse, back chevron first, so the pair seems to push forward.
- **Shield:** the arrows use the worm's current drawing alpha, so a shielded worm's arrows are faint like its body.
- **When they show:** they follow `w.boosting`, the same "actually boosting" signal as the badge. No state is kept, so they appear and disappear with boosting on the very next frame.
- **Removed:** the v1.3.0 spark pool, `updateTrails`, `drawTrails`, the WeakMap and the clearing in `newGame()` all go.

*Alternatives:*
- The tail trail: shipped in v1.3.0 and replaced because it sits at the wrong end of the worm (#41).
- Arrows behind the head, along the body: rejected because they'd overlap the body stripes and read poorly.
- Copying another game's arrow art: rejected because of the project rule against using other games' assets.

### 2. The badge is synced every frame from `game.player.boosting`
- **Markup:** `<span id="boostBadge" class="hidden">BOOST</span>` sits inside `#stats .score`, after the "score" label. As an inline pill it adds no height to the score block, so the HUD layout barely changes.
- **Syncing:** `syncBoostBadge()` runs in `frame()` next to `syncTouchControls()`, caches the last state, and toggles `hidden` only when it changes. Running every frame instead of inside the 0.15 s HUD refresh keeps the badge in step with the arrows.
- **Visibility:** the badge is hidden whenever there is no live player, for example in the menu or after death.

### 3. A small read-only debug hook for tests
The arrows are only pixels on the canvas, so the browser tests can't see them directly, and pixel sampling is unreliable with food and other worms around.

`main.js` therefore exposes `window.wigglefeastDebug = { boostArrows: () => count }`: the number of worms whose arrows were drawn in the last frame. It's read-only, has no effect on the game, and is documented as a test hook. (v1.3.0 exposed `trailSparks()` for the trail; it goes with the trail.)

*Alternative:* spying on canvas draw calls from the test. Rejected because it depends on exactly how the arrows are drawn.

## Risks / Trade-offs

- **Busy screens:** many bots boosting near the player add many arrows. → Arrows are small, only drawn for worms in view, and their size and offsets are constants that are easy to tune after playtesting.
- **Edge clipping:** arrows reach about 3.5× the head radius ahead, past the worm's own bounds. → `drawWorm()` widens its off-screen check by that much for boosting worms, so a worm just outside the view still gets its arrows drawn.
- **Debug hook:** adds a small global. → It only reads a count, and its name makes it clearly not part of the game.
- **Order with the tight-turn power-up (#38):** both changes touch the HUD and the touch layout test. Whichever lands second keeps both: the badge showing *and* all power-up timers in the layout test.

## Migration Plan

No data changes. Bump `VERSION` (minor) in `sw.js`. To roll back, publish the previous code under a higher version.
