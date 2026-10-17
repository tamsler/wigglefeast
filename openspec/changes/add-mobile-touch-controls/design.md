# Design

## Context

- **Touch input today** (`main.js`): pointer handlers on the game canvas track active touches in a `pointers` map. The first finger steers, and two or more fingers set `input.touchBoost`. The player's `wantBoost` is the OR of the mouse, keyboard and touch flags. Window `blur` clears every input and pauses.
- **Pause today:** `setPaused(true)` shows the `#paused` panel, but it can only be reached through P/Esc or `blur`. `mode` is one of `menu`, `playing`, `dead` or `paused`.
- **HUD** (`#hud`, `pointer-events: none`):
  - the score is bottom-left, the leaderboard top-right, the minimap bottom-right and the power-up timers top-left
  - the transient kill/power-up feed is top-centre
  - every corner element is already offset by `env(safe-area-inset-*)`
  - below 600px wide, the leaderboard narrows to 160px and the minimap shrinks to 110px
- **Existing overlap:** on landscape phones (e.g. 844×390), the 220px leaderboard and the 160px minimap already overlap. The new layout requirement fixes this too.
- **Touch detection:** the menu already uses `@media (pointer: coarse)` to show the touch help line.
- **Constraints:** no build step and no dependencies, and the game must work from `file://`. Desktop must be unchanged.

## Goals / Non-Goals

**Goals:**
- Two touch buttons that reuse the existing boost and pause paths, with no new game state.
- A touch-only HUD arrangement that the browser tests can check for overlap at phone sizes.

**Non-Goals:**
- Detecting touch support from JavaScript, or switching layouts at runtime when a mouse is plugged in.
- Changing the canvas pointer logic (steering and the two-finger boost).

## Decisions

### 1. Show the buttons with CSS `@media (pointer: coarse)`, and toggle them in JavaScript only for game mode
The buttons sit in `#touchControls` inside `#hud`.
- **CSS** shows them only when `(pointer: coarse)` matches, so desktop never renders them and no device detection code is needed. This is the same signal the touch help line already uses.
- **JavaScript** toggles `hidden` each frame, next to `syncUpdateBanner()`, using `mode === 'playing' && game.player`. Whenever they are hidden, it clears the button boost.

*Alternatives:*
- Detecting touch from the first `touchstart`: rejected because it needs state and misfires on touch laptops.
- `any-pointer: coarse`: rejected because it would show the buttons on touch laptops, which the proposal puts out of scope.

### 2. A separate `input.buttonBoost` flag, driven by pointer events on the button
- `pointerdown` on the boost button sets the flag. `pointerup`, `pointercancel` and `lostpointercapture` clear it.
- The handler calls `setPointerCapture`, so lifting the finger after it slides off the button still ends the boost. Touch pointers are captured implicitly anyway; mouse and pen pointers are not.
- `wantBoost` becomes `mouseBoost || keyBoost || touchBoost || buttonBoost`. Window `blur` clears the flag along with the others.
- The button's events never reach the canvas. The boost finger is therefore never counted by the canvas `pointers` map, so it can't take over steering or combine with one steering finger into a false two-finger boost.

*Alternative:* adding the button's pointer to the canvas `pointers` map. Rejected because it mixes two input paths, and lifting the button finger would hand steering to it.

### 3. The pause button calls the existing `setPaused(true)` on `click`
- A tap produces `click` after the finger lifts, so a finger resting on the button doesn't pause mid-gesture.
- The pause panel then covers the HUD, and decision 1 hides the buttons while paused.
- Resume and End run are the existing buttons on that panel.

### 4. Touch-only layout, by orientation
All of these rules sit inside `@media (pointer: coarse)`, so desktop CSS is untouched.

| Element | Portrait | Landscape |
|---|---|---|
| Boost button | about 76px round, bottom-right, inside the safe area | same |
| Pause button | 44px, top-left, inside the safe area | same |
| Power-up timers | move down below the pause button | same |
| Minimap | stacked directly above the boost button | sits to the left of the boost button, bottom-aligned |
| Leaderboard | unchanged | on short screens (`max-height: 520px`), shows the top 5 rows plus the player's own row, so it ends above the minimap |

For the landscape leaderboard, rows 6–10 and the `···` gap are hidden with CSS. The `.me` row is never hidden, so players always see their own rank.

The exact sizes are set during implementation. The overlap test at the sizes listed in the spec decides whether they work.

*Alternatives:*
- Boost button bottom-left, swapping places with the score: rejected because it puts boost under the left thumb, which most phone players use to steer.
- Minimap moved to the left column: rejected because there isn't enough height in landscape with the pause button, the power-up timers and the score already there.
- Hiding the minimap on phones: rejected because it removes information.

### 5. Inline SVG icons, and no browser gestures on the buttons
- **Icons:** the pause icon (two bars) and the boost icon (a double chevron) are inline SVG in `index.html`, with `aria-label`s. They need no new files, so `FILES` in `sw.js` and `file://` are unaffected, and they look the same on every platform, unlike emoji.
- **Gestures:** the buttons get `pointer-events: auto`, `touch-action: none` and `-webkit-touch-callout: none`. They also ignore `contextmenu`, so a long press boosts instead of opening a menu or selecting text.

### 6. Tests use Chrome's touch emulation, and the first test checks that `pointer: coarse` matches
- **Turning on coarse:** `Emulation.setTouchEmulationEnabled` (already used in `tests/browser/input.test.js`) makes `(pointer: coarse)` match. The touch tests first assert `matchMedia('(pointer: coarse)').matches`, so a Chrome change would fail clearly instead of silently testing nothing. If touch emulation turns out not to switch the media feature, use `Emulation.setEmulatedMedia` with `{ name: 'pointer', value: 'coarse' }`.
- **Layout test:** forces power-ups active, collects the bounding boxes of the visible HUD elements, and checks that each is inside the viewport and that no two intersect. The transient feed is excluded.
- **Desktop checks:** the existing layout and input tests run with a fine pointer and keep covering desktop. A new assertion checks that the touch buttons are not displayed there.

## Risks / Trade-offs

- **Coarse-pointer gaps:** touch devices that report a fine main pointer, such as touch laptops and phones with a mouse attached, get no buttons. → They keep the two-finger gesture, and the proposal puts these devices out of scope.
- **Unemulated safe areas:** headless Chrome can't emulate `env(safe-area-inset-*)`, so the notch and home bar aren't covered by automated tests. → A manual check on an iPhone home-screen install, in portrait and landscape, is a task.
- **iOS gestures:** iOS Safari might still start a gesture on a long press, despite `touch-action` and the callout setting. → The same manual check holds the boost button for several seconds and slides off it.
- **Shorter landscape leaderboard:** the leaderboard loses five rows on short touch screens. → The player's own row always shows, and the rule applies only to touch screens in landscape.
- **Feed overlap:** the feed can briefly overlap the leaderboard or the pause button on narrow screens. → It is transient and has no pointer events, so it doesn't block taps.

## Migration Plan

No data changes. Bump `VERSION` in `sw.js`. Installed copies get the update through the existing banner. To roll back, publish the previous code under a higher version.
