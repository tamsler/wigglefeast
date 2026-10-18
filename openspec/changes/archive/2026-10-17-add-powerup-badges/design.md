# Design

## Context

- **Current HUD** (`index.html`, `style.css`):
  - `#powerups` is a column of `.pw` rows (icon, bar, seconds) at the top-left.
  - `#minimap` is a canvas at the bottom-right, 160 px, or 110 px on narrow and short screens.
  - `#leaderboard` is top-right and `#stats` (the score) bottom-left.
  - On touch screens, `#pauseBtn` is top-left (which pushes `#powerups` down), and `#boostBtn` is bottom-right with the minimap moved beside or above it.
- **Refresh:** `updateHud` rebuilds `#powerups.innerHTML` every 0.15 s from `POWERUP_INFO` and `player.pw`. A blink animation inside rebuilt markup would restart on every refresh.
- **Minimap size:** `resize()` reads the minimap's on-screen size to set its canvas resolution.
- **Layout tests:** `tests/browser/layout.test.js` checks for overlaps between `#boostBtn`, `#pauseBtn`, `#stats`, `#leaderboard`, `#minimap` and `#powerups` at five phone sizes, with every power-up active. At desktop sizes it only checks that the touch buttons are hidden.

## Goals / Non-Goals

**Goals:**
- **No overlaps:** a layout that holds up at every tested size, desktop included.
- **Smooth badges:** rings drain smoothly, and blinking never restarts or stutters.

**Non-Goals:**
- Making the HUD customisable.

## Decisions

### 1. One top-left cluster: `#cluster` = minimap + badge row
- **Markup:** `#minimap` and `#powerups` move into a new `#cluster` at the top-left (inside the safe area).
- **Wide screens:** a flex row, the minimap then the badges, which wrap if needed.
- **Narrow screens** (`max-width: 600px`): a column, with the badges under the minimap in rows of three. Three badges fit beside a 160-pixel leaderboard on a 360-pixel phone.
- **Sizes:** the minimap keeps its sizes (160 px, or 110 px on narrow and short screens). `resize()` keeps reading its on-screen size, so its canvas stays sharp.
- **Touch screens:** the pause button moves to the top-right, just left of the leaderboard. If the narrow-portrait overlap test still finds a collision with the minimap there, it moves below the leaderboard instead; the test decides.
- **Removed:** the touch rules that moved the minimap beside or above the boost button, and the compact `.pw` rules, are gone. Boost now has the bottom-right corner to itself.

*Alternatives:*
- Badges on the right, under the leaderboard: rejected because the user chose the top-left cluster.
- Keeping the minimap bottom-right: rejected for the same reason.

### 2. Stable badge elements, updated every frame from a per-frame sync
- **Built once:** `#powerups` is built once, with one badge per power-up type in `POWERUP_INFO` order: `.badge` with a `title`, the power-up colour as `--c`, and its icon.
- **Updated per frame:** a new `syncBadges()` runs in `frame()`, next to the other per-frame syncs. For each type it sets `hidden` when the power-up isn't running, sets `--left` (remaining ÷ 16) for the ring, and toggles the `ending` (≤ 3 s) and `ending-fast` (≤ 1 s) classes.
- **Cost:** only six elements are touched, and a property is written only when its value changes, so the cost is negligible.
- **Why this way:** because the elements persist, the CSS blink animation runs undisturbed.
- **Removed:** the badge HTML is no longer built in `updateHud`.

### 3. The ring is a CSS conic gradient; blinking is CSS animation
- **Ring:** `.badge` is a 40-pixel circle (36 px on short screens) whose background is `conic-gradient(var(--c) calc(var(--left) * 1turn), rgba(255,255,255,.14) 0)`. An inner `::before` disc in the panel colour turns that into a 4-pixel ring, with the icon on top.
- **Blink:** `.ending` runs a 0.5-second opacity animation, and `.ending-fast` a 0.2-second one.
- **Reduced motion:** `prefers-reduced-motion` swaps the blink for a steady warning outline in the power-up colour, so the signal remains without motion.

*Alternative:* drawing the badges on a canvas. Rejected: DOM and CSS keep them crisp, accessible through `title`, and testable.

### 4. Tests decide the final pixel positions
- **Overlap checks:** the layout test's element list stays the same. `#powerups` is now the badge row and `#minimap` sits in the cluster. Desktop sizes (1280×713, 1440×900, mouse) get the same no-overlap check, without the touch buttons.
- **Badge test:** a new browser test covers appearing, the ring value, the ending classes, disappearing, fixed order, and re-collecting.

## Risks / Trade-offs

- **The top-left gets busy** on small landscape phones (minimap plus up to six badges). → Badges shrink to 36 px on short screens, and the overlap tests at 640×360, 667×375 and 844×390 must pass.
- **Muscle memory:** players used to the minimap bottom-right must relearn where it is. → That's an accepted cost of the layout the user chose.
- **Coarser ring updates while paused or in standby:** the ring follows game time, so it freezes, which is correct. The blink keeps animating while the pause panel covers the HUD, which is harmless.

## Migration Plan

No data changes. Bump `VERSION` (minor). To roll back, publish the previous code under a higher version.
