# Proposal

## Why

While the 🧲 magnet runs, food and power-ups slide toward a worm from much farther away: 230 units beyond the normal pull. But nothing in the arena shows it, only the HUD badge (tamsler/wigglefeast#103). Players can't see how far their own magnet reaches, or that a nearby bot is sweeping up food with one. The owner asked for an animated **magnetic field** around the worm, red and blue like a magnet's two poles.

## What Changes

- **While a worm's magnet is active,** waves ripple outward from its head across the arena floor. Each wave is a ring, half red and half blue (one colour on each side of the worm, like a magnet's poles). The waves fade as they spread, and stop at the edge of the food pull range, so the effect shows how far the magnet reaches.
- **Subtle:** drawn on the floor, beneath food, power-ups and worms, so nothing is hidden.
- **Every worm** with a magnet shows it (visible information, fair to show for bots), fainter on bots than on the player.
- **Over the magnet's last 3 seconds,** the field fades out, alongside the badge's blink. It's gone when the magnet ends.
- **The animation runs on game time,** so it freezes while paused, like skins and food.
- **Our own design,** drawn in code. No assets or branding from other games.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `gameplay`: a new requirement for showing an active magnet in the arena (next to the existing *Power-ups* requirement).

## Out of scope

- Effects for the other power-ups.
- Streaks on food being pulled in (possible follow-up).
- Changing the magnet's reach or duration.
- Sound (#9).

## Impact

- `main.js`: a small draw step in `render`, after the arena floor and before food, for each worm in view with an active magnet. It uses a few arc strokes per worm and no new sprites or files.
- No engine, save or settings changes.
- Tests: a browser test (rings drawn only while the magnet runs, red and blue, reaching the pull range, fainter on bots, fading at the end, frozen while paused) and a frame-time check with many magnet worms. VERSION bump (minor).
