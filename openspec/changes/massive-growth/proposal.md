# Proposal

## Why

The owner wants worms to be able to grow massive, and decided that **any worm can get big if it plays well**, bots and player alike, earned by eating and kills (tamsler/wigglefeast#82). Today growth is capped from two sides:

- **Shedding:** above mass 1,500 a worm loses 0.4% of the excess every second. A 10,000-mass worm loses 34 a second, a 20,000-mass worm 74. A player who keeps winning still can't hold much more than about 10,000.
- **Shape:** a worm's radius stops growing at 62 (about mass 40,000), but its length keeps growing. A 50,000-mass worm would be about 21,800 units long, longer than the whole edge of a 30-bot arena. It would wall off the arena rather than look big.

Headless runs show bots rarely get past 7–8k (Normal) or 3.5k (Expert), because they die first, not because of shedding. So relaxing shedding mainly lets *skilled, long-lived* worms grow. That's the intent.

## What Changes

- **Shedding starts later and is gentler:** above mass **10,000** (was 1,500), at **0.2%** of the excess per second (was 0.4%). A 20,000-mass worm loses 20 a second (was 74), a 50,000-mass worm 80 (was 194). Growth stays bounded.
- **Massive worms grow thicker, not endlessly longer:**
  - Below mass 10,000, sizes are unchanged.
  - Above it, length grows more slowly (a 50,000-mass worm is about 13,000 long instead of 21,800).
  - The radius keeps growing past today's cap of 62, up to 90 (66 at mass 50,000, 79 at 100,000).
- **The camera keeps zooming out** as the player's worm thickens (it already follows the radius), so a massive worm stays playable.
- **Drawing very long worms stays cheap:** only the visible part of a worm's body is drawn.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `gameplay`: the *Movement and growth* requirement changes: the shedding threshold and rate, and how size follows mass above 10,000.

## Out of scope

- Arena size (#81) and the number of bots.
- Food or multiplier rules (#16 settled them).
- Any growth help reserved for the player.
- New visuals for massive worms beyond their size (crowns, effects).

## Impact

- `engine.js`: `CFG.SHED_ABOVE` / `SHED_RATE`, `lengthFor` / `radiusFor` above 10,000, and the save check's limits (unchanged, but re-checked against the new sizes).
- `main.js`: `drawWorm` skips off-screen stretches of a body, and the camera zoom follows the larger radius.
- Saved data: the format is unchanged. Worms above 10,000 in existing saves get a little thicker and shorter after loading, because their size is derived from mass.
- Stats: higher scores become possible, so old bests become easier to beat.
- Tests: engine tests for shedding and size curves; a browser frame-time check with a massive player. VERSION bump (minor).
