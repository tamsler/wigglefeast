# Proposal

## Why

The menu allows 5–60 bots (tamsler/wigglefeast#81). The owner wants busier arenas if performance allows. Two things stand in the way:

- **The arena grows too fast.** Its radius grows by 60 units per bot, so its *area* (and the food in it) grows with the square of the bot count. At 200 bots that's about 42,000 food (near the 50,000 limit), saves of 1.4 MB, and 4.5 ms per engine tick on a fast laptop.
- **Rendering already copes.** Drawing skips anything out of view, so its cost depends on what's on screen, not on the arena size.

If the arena's area grows *in proportion* to the bot count instead, each bot keeps the same space and the cost stays close to linear. Measured: 150 bots take 1.8 ms per tick with a 665 KB save.

## What Changes

- The bot count range becomes **5–150** (default stays 30).
- **Arena size:** unchanged up to 60 bots, so existing worlds and settings play exactly as before. Above 60, the area grows in proportion to the bot count: radius `5400 × √(bots / 60)`, for example 8,538 at 150. Food and power-up density stay the same as today.
- Saves and settings accept up to 150 bots.
- The menu slider goes up to 150.
- Rendering stays smooth at 150 bots, checked with frame times in the browser during the work, and on a real phone at the end.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bots`: the population range becomes 5–150.
- `gameplay`: the arena radius rule above 60 bots.

## Out of scope

- Graphics-quality settings, or reducing detail for weak devices (#13).
- Changing the density of bots, food or power-ups.
- Minimap changes (#80 handles crowded minimaps).
- Growth limits (#82).

## Impact

- `engine.js`: the arena radius formula and the save check's bot limit (60 → 150).
- `main.js` and `index.html`: settings validation and slider maximum.
- Saved data: worlds and settings up to 60 bots are unchanged. A world or setting above 60 is new data that older releases reject or reset (see the design).
- Tests: engine simulation and tick budget at 150 bots, save round-trip at 150, a browser test for the slider and settings, and a headless frame-time check. VERSION bump (minor).
