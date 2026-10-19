# Design

## Context

- **Magnet** (`engine.js`): `pw.magnet` counts down from 16 s. Food is pulled from `2.2·r + 24 + CFG.MAGNET_REACH` (230) around the head, and power-ups from `r + POWERUP_REACH + MAGNET_REACH`.
- **`render`** (`main.js`) draws, in order:
  1. the arena floor and edge
  2. food
  3. power-ups (animated with `t`)
  4. worms: the player's body, other worms, then the player's head (#102)
  5. names
- **Clocks:** skin finishes animate with `game.time`, which stops while paused. The HUD badge blinks in the last 3 s of a power-up.
- **Badge colours:** the magnet badge is `#ff4d6d` (red), and the speed badge uses a cyan-blue `#4cc9f0`.

## Goals / Non-Goals

**Goals:**
- Readable at a glance: you can see you have a magnet and how far it reaches.
- Never hides food or worms.
- Cheap: a handful of strokes per magnet worm on screen.

**Non-Goals:**
- Exact particle physics of a magnetic field.

## Decisions

### 1. Where it's drawn
A `drawMagnetField(w, time)` step runs in `render` **after the arena floor and edge, before food**, for every live worm with `pw.magnet > 0` whose head is within view, padded by the field radius. Everything else is drawn over it (spec: *Nothing hidden*).

### 2. The waves
- **Field radius:** `A = 2.2·r + 24 + CFG.MAGNET_REACH`, the food pull range.
- **Rings:** 3 rings at once, each expanding from radius `r` to `A` over a 1.4 s period, offset by a third of a period, using `game.time`.
- **Ring alpha:** `base × (1 − p)²`, where `p` is the ring's progress from 0 to 1, so rings fade as they spread. `base` is 0.45 for the player and 0.22 for bots.
- **Ring width:** `max(2, 0.12·r)` world units.
- **Colours:** each ring is two half-arcs split along the worm's heading. Red `#ff4d6d` (the magnet badge's colour) on the left of the direction of travel, blue `#4cc9f0` on the right, like a magnet's two poles.
- **Faint inner glow:** a radial gradient from the head to `0.35·A`, at `base × 0.25`, so a magnet worm reads as charged even between waves.

*Alternative:* a field-lines drawing (curved lines from pole to pole). It's more "physics", but harder to read at small zoom, and more strokes.

### 3. Fading at the end
Everything is multiplied by `min(1, pw.magnet / 3)`, so it fades linearly over the last 3 seconds, the same window in which the badge blinks.

### 4. Paused
It uses `game.time` (spec: *Paused*), like the skin finishes.

### 5. Testing hooks
The browser test records `arc` calls and `strokeStyle` on the game canvas (as the decorations and tags tests do). From those it can tell the field rings apart (radius between `r` and `A`, red or blue stroke) and check their colours, maximum radius and alpha via `globalAlpha` at the time of the stroke.

## Risks / Trade-offs

- [Visual noise when many bots have magnets] → bots draw at half strength. There are about 26 power-ups per 30-bot arena and magnets are 30% of them, so only a few magnet worms are on screen at once.
- [Cost at 150 bots] → about 7 draw calls per magnet worm in view. Checked with the frame-time test with every bot given a magnet.
- [Red is close to the arena edge's pink-red] → the waves are thin and fading, and live around worms rather than on the edge line.

## Migration Plan

Ships as one minor release. Nothing to migrate.
