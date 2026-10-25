# Proposal

## Why

Since the worms got rounder and bolder (#161), the arena around them looks small and busy: the floor's hexagons are tiny, food items are hard to make out, and a big worm fills too much of the screen because the camera barely pulls back as it grows. The owner asked for bigger hexagons and food, and more zoom-out as the worm grows, and approved a prototype. Tracked in tamsler/wigglefeast#163.

## What Changes

- **Bigger floor hexagons.** The floor's hexagons are about 1.75× wider (80 world units from centre to corner, from 46), separated by dark grooves with a faint light edge, with a soft shadow toward each hexagon's edge and a faint fine honeycomb texture inside.
- **Bigger food.** Food is drawn about a third larger in every theme: themed items and their glow, and Classic's glowing dots. Only the drawing changes: food values, sizes in the engine, pickup reach and the drift toward heads stay the same.
- **More zoom-out as the worm grows.** The camera zooms out faster with the worm's thickness: unchanged for a new worm, about 10% further out at mass 1,000, about 17% at 10,000 and about 22% at 50,000. The zoom power-up still zooms out a further 38% on top, and the menu's spectating camera is unchanged.

### Out of scope

- Food values, how close a worm must get to eat, and how food drifts in.
- Arena size, the arena edge and the out-of-bounds area, the minimap.
- Worm drawing (done in #161).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `gameplay`: new requirements for the arena floor's look and for how far the camera zooms out as the player's worm grows.
- `food-themes`: a new requirement that food is drawn larger on screen, in every theme, without changing gameplay.

## Impact

- `main.js`: `makeHexPattern` (new floor tile), the food drawing sizes in `render`, `targetZoom`.
- `sw.js`: VERSION bump (minor: visible change). No new files.
- Tests: a browser test for the camera zoom at several masses, a test for the drawn food size, and checks that the floor pattern tile is the new size; existing massive-worm, theme and frame-time tests keep passing.
- No engine, save or settings changes. Bots don't use the camera, so their behaviour is unchanged.
