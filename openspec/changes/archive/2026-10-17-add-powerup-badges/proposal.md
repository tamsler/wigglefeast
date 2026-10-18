# Proposal

## Why

Active power-ups show as a list of bars in the top-left, the minimap sits bottom-right, and nothing warns that a power-up is about to end (tamsler/wigglefeast#63). Players lose the magnet or free boost without noticing. The user wants a compact power-up dashboard next to the map, as in other .io games, with an "about to expire" signal. They chose a top-left cluster, and a draining ring plus blinking for the warning.

## What Changes

- **Top-left cluster:** the minimap moves to the top-left corner. Active power-ups show as round badges in a row beside it, or below it on narrow phones.
- **Badges:** each one shows the power-up's icon in its colour, inside a ring that drains over its 16 seconds. In its last 3 seconds the badge blinks, faster in the last second. Badges appear and disappear with the power-up, in a fixed order.
- **Replaces the bars:** the current list of timer bars goes away.
- **Unchanged:** the leaderboard stays top-right, the score bottom-left, and the feed top-centre.
- **Touch screens:**
  - the pause button moves to the top-right, left of the leaderboard
  - the boost button keeps the bottom-right corner, now on its own, since the minimap left it
  - the landscape leaderboard keeps its compact top-5 form if the overlap test still needs it

### Out of scope

- New power-ups, or changes to how long they last.
- Sound when a power-up is about to end.
- Moving the leaderboard or the score, or a settings option to rearrange the HUD.

## Capabilities

### New Capabilities
- `hud`: the in-game heads-up display. Where the minimap, power-up badges, leaderboard and score sit, and how the badges show remaining time.

### Modified Capabilities
- `controls`:
  - On-screen touch buttons: the pause button moves from the top-left to the top-right.
  - Touch button layout: the overlap rule names the power-up badges instead of the timers.

## Impact

- `index.html`: `#powerups` becomes the badge row, grouped with `#minimap` in a top-left cluster.
- `style.css`: the cluster layout (desktop, narrow, and touch portrait/landscape), the badge ring, the blink animations, and the new pause button position. The old minimap-beside-boost rules and the compact-timer rules are removed.
- `main.js`: `updateHud` renders badges with their ring progress and an ending state. Badges keep their elements between refreshes, so the blink animation doesn't restart.
- `tests/browser/`: badge behaviour, and the layout tests updated for the new positions.
- `sw.js`: `VERSION` bump. No new files.
