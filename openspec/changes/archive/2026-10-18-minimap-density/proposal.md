# Proposal

## Why

The minimap picks out individual worms: every bot's head is a dot, and the 10 biggest are drawn larger in their own skin colour (tamsler/wigglefeast#80). That gives away exactly where each big worm is, and with more bots (#81) it turns into a cloud of dots. The owner wants the minimap to show only *where worms are crowded*: a sense of busy and quiet parts of the arena, without tracking anyone.

## What Changes

- The minimap shows a soft **density shading** of other worms' bodies (how much of each part of the arena is covered by worms), in one neutral colour.
- No individual worms: no head dots, no skin colours, no larger dots for the leaderboard's top 10.
- Unchanged: the arena edge ring, the player's own marker, and the rectangle showing the current view.
- The player's own body is left out of the shading, so the shading shows only other worms.
- The shading refreshes a few times a second, not every frame, so it stays cheap at any bot count.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `hud`: gains a requirement for what the minimap shows. Its layout requirement is unchanged.

## Out of scope

- Showing food, power-ups or remains on the minimap.
- Changing the minimap's size, position or shape.
- Any option to switch back to the old dot view.
- More bots (#81) and growth (#82). This change only has to keep working when those land.

## Impact

- `main.js`: `renderMinimap` and a small density buffer refreshed on a timer. No engine, save or settings changes.
- Tests: a browser test that reads the minimap's pixels. VERSION bump (minor, since what players see changes).
