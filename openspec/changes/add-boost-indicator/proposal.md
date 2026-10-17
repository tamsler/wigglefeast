# Proposal

## Why

It's hard to tell when a worm is boosting (tamsler/wigglefeast#37). The only sign today is a faint, translucent glow around the body in the worm's own colours. It's easy to miss on small worms or when zoomed out. So players can't easily confirm their own boost is working, for example when they're too small to boost, or spot a bot speeding toward them.

## What Changes

- **Speed trail:** every boosting worm, player or bot, shows a speed trail of short-lived sparks in its own colours streaming from its tail. The existing glow stays.
- **BOOST badge:** while the player's worm is boosting, a badge reading **BOOST** shows next to the score in the HUD.
- **When they show:** only while a worm is actually boosting, meaning boost is held and possible. Holding boost at too low a mass shows nothing. The ⚡ speed power-up on its own doesn't count, because it already has a HUD timer. Holding boost while ⚡ runs does count, since that is boosting.
- **Touch HUD:** stays free of overlaps with the badge showing.

### Out of scope

- Sound or vibration when boosting.
- A boost "fuel" meter or any change to how boosting works (speed, mass cost, dropped food).
- Showing the indicator for the ⚡ speed power-up alone.
- Different trail styles per skin, or a setting to turn the trail off.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `gameplay`: the Boosting requirement adds how boosting is shown: a speed trail on every boosting worm, and the BOOST badge for the player. This follows the Spawn shield requirement, which already says how shielded worms are drawn.

## Impact

- `main.js`: a render-only trail of sparks for boosting worms in view, and the badge shown or hidden every frame.
- `index.html` / `style.css`: badge markup and style inside the score line.
- `tests/browser/`: badge behaviour, trail presence, and the touch layout test with the badge showing.
- `sw.js`: `VERSION` bump. No new files.
- No change to the engine, saves or storage.
