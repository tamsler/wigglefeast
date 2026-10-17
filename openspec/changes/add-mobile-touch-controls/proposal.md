# Proposal

## Why

On phones, boosting needs a two-finger gesture that is only mentioned in one line of the menu help, and there is no way to pause: pausing needs the P or Esc key, so a phone player can only pause by leaving the app (tamsler/wigglefeast#11). The installed app is likely to be played on phones, so these two basic controls should be visible and reachable with one thumb.

## What Changes

- On touch screens (devices whose main pointer is coarse), the in-game HUD shows two buttons while a run is being played:
  - a **boost button** in the bottom-right corner: holding it boosts, and lifting the finger stops. Another finger keeps steering anywhere on the screen.
  - a **pause button** in the top-left corner: tapping it opens the existing pause panel (Resume / End run).
- Both buttons stay clear of the screen's notch and home-bar areas and don't overlap the score, leaderboard, minimap or power-up timers, in portrait and landscape. On touch screens the minimap and power-up list move to make room.
- The buttons are hidden in the menu, on the death screen, while paused, and on devices with a mouse or trackpad. Desktop is unchanged.
- The existing two-finger boost gesture keeps working.
- The menu's touch help line mentions the boost and pause buttons.

### Out of scope

- A virtual joystick or any other steering style; steering toward the finger stays as it is.
- Letting players move, resize or hide the buttons, or swap them for left-handed play.
- Showing the buttons on touch laptops and other devices whose main pointer is a mouse or trackpad.
- Showing whether boost is currently possible (for example, dimming the button when the worm is too small to boost).
- Haptic feedback, and any change to keyboard or mouse controls.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `controls`: Boosting input adds holding the on-screen boost button on touch screens. Pause adds the on-screen pause button. A new requirement covers when the touch buttons are shown and how they're laid out.

## Impact

- `index.html`: the two buttons inside the HUD; the touch help line.
- `style.css`: button styles, shown only for a coarse pointer; touch-only placement of the minimap and power-up list; safe-area offsets.
- `main.js`: a touch-button boost input alongside the existing ones, the pause button wired to the existing pause, showing the buttons only while playing, and clearing the button boost when the window loses focus.
- `tests/browser/`: new tests for the buttons and for HUD layout at phone sizes.
- `sw.js`: `VERSION` bump. No new files, since the icons are inline.
- No change to the engine, saves or storage.
