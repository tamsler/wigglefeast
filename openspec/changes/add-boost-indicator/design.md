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
- The trail is purely visual. It lives in `main.js`, has no effect on the simulation and is never saved.
- The trail costs little even when many bots boost at once.

**Non-Goals:**
- Changing the existing outline glow; it stays as an extra cue.
- Deterministic particle positions.

## Decisions

### 1. The trail is a pooled particle list, updated with the frame's `dt`
`main.js` keeps one array of sparks, each with position, velocity, colour, age and lifetime.

- **Emitting:** each frame that is not paused, every worm that is boosting and inside the view (plus a margin) emits sparks from its last few body segments, about 70 per second, in its stripe colours. Each spark gets a random drift backwards and outwards, and lives 0.4–0.65 s. (These numbers were raised from 40/s and 0.35–0.5 s after screenshots showed the first version was too faint.)
- **Updating:** a new `updateTrails(dt)` runs next to `updateCamera` while not paused. The sparks therefore freeze with the world when paused and keep fading after a worm stops.
- **Drawing:** `render()` draws the sparks after food and power-ups but before worms, so bodies stay on top. They are short streaks along their motion, using the `lighter` composite for a glow, with alpha and width falling over their lifetime. Round dots read as food pellets, so streaks make the trail look like speed lines instead.
- **Cost:** the pool is capped at 600 sparks; the oldest are dropped first. Work is bounded no matter how many worms boost. Starting a new world or restoring a saved one clears the pool.

*Alternatives:*
- Drawing a stretched gradient behind the tail: rejected because it reads poorly on curled bodies.
- Simulating the sparks in the engine: rejected because the engine stays visual-free and headless.

### 2. The badge is synced every frame from `game.player.boosting`
- **Markup:** `<span id="boostBadge" class="hidden">BOOST</span>` sits inside `#stats .score`, after the "score" label. As an inline pill it adds no height to the score block, so the HUD layout barely changes.
- **Syncing:** `syncBoostBadge()` runs in `frame()` next to `syncTouchControls()`, caches the last state, and toggles `hidden` only when it changes. Running every frame instead of inside the 0.15 s HUD refresh keeps the badge in step with the trail.
- **Visibility:** the badge is hidden whenever there is no live player, for example in the menu or after death.

### 3. A small read-only debug hook for tests
Sparks are internal to `main.js`, so the browser tests can't see them directly. Pixel sampling is unreliable here, because boosting also drops food at the tail.

`main.js` therefore exposes `window.wigglefeastDebug = { trailSparks: () => count }`. It's read-only, has no effect on the game, and is documented as a test hook.

*Alternative:* spying on canvas draw calls from the test. Rejected because it depends on exactly how sparks are drawn.

## Risks / Trade-offs

- **Busy screens:** the trail may feel noisy when many bots boost near the player. → Emission is limited to worms in view, and both the pool cap and lifetime are constants that are easy to tune after playtesting.
- **Shielded worms:** their trail would ignore the transparent shield look. → Sparks use the worm's current drawing alpha, so a shielded worm's trail is faint too.
- **Debug hook:** adds a small global. → It only reads a count, and its name makes it clearly not part of the game.
- **Order with the tight-turn power-up (#38):** both changes touch the HUD and the touch layout test. Whichever lands second keeps both: the badge showing *and* all power-up timers in the layout test.

## Migration Plan

No data changes. Bump `VERSION` (minor) in `sw.js`. To roll back, publish the previous code under a higher version.
