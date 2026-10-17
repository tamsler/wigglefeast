# Proposal

## Why

It's hard to tell when a worm is boosting (tamsler/wigglefeast#37). The only sign today is a faint, translucent glow around the body in the worm's own colours. It's easy to miss on small worms or when zoomed out. So players can't easily confirm their own boost is working, for example when they're too small to boost, or spot a bot speeding toward them.

v1.3.0 shipped a speed trail at the tail as the indicator. Playtesting showed it sits at the wrong end of the worm (tamsler/wigglefeast#41): players watch the head, where the worm is going. So the indicator moves to the head.

## What Changes

- **Head arrows:** every boosting worm, player or bot, shows two chevron arrows just in front of its head, pointing the way it's moving. They're sized to the head and pulse gently forward. The v1.3.0 tail trail is removed, and the existing glow stays.
- **BOOST badge:** while the player's worm is boosting, a badge reading **BOOST** shows next to the score in the HUD.
- **When they show:** only while a worm is actually boosting, meaning boost is held and possible. Holding boost at too low a mass shows nothing. The ⚡ speed power-up on its own doesn't count, because it already has a HUD timer. Holding boost while ⚡ runs does count, since that is boosting.
- **Touch HUD:** stays free of overlaps with the badge showing.

### Out of scope

- Sound or vibration when boosting.
- A boost "fuel" meter or any change to how boosting works (speed, mass cost, dropped food).
- Showing the indicator for the ⚡ speed power-up alone.
- Different arrow styles per skin, or a setting to hide the arrows.
- Copying another game's artwork; the arrows are our own drawing.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `gameplay`: the Boosting requirement adds how boosting is shown: arrows in front of the head of every boosting worm, and the BOOST badge for the player. This follows the Spawn shield requirement, which already says how shielded worms are drawn.

## Impact

- `main.js`: head arrows drawn with each boosting worm (replacing the v1.3.0 trail code), and the badge shown or hidden every frame.
- `index.html` / `style.css`: badge markup and style inside the score line.
- `tests/browser/`: badge behaviour, the arrows, and the touch layout test with the badge showing.
- `sw.js`: `VERSION` bump. No new files.
- No change to the engine, saves or storage.
