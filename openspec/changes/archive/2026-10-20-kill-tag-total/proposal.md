# Proposal

## Why

The ⚔ number after a worm's name counts kills in the **last 60 seconds** (HUD spec, *Reputation tags*, from #83), so it counts down as kills age out. In play it read as a bug: 6, 5, 4, 3… (tamsler/wigglefeast#126). The owner wants it to show how dangerous a worm is overall.

## What Changes

- **⚔N shows the worm's total kills in its life** (owner's choice). The number only goes up, and the worm loses it when it dies.
- The tag shows on any worm with at least one kill, player or bot.
- **Kept as today:** a bot retaliating against the player still shows its name in red-orange.
- **The kill count comes from what's already saved,** so tags survive save and load. Today they start empty after a load.
- **Removed:** the 60-second kill window (`killTimes`, `recentKills`). Nothing else uses it: the bots' *read* tactic keeps its own memory of seen kills.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `hud`: *Reputation tags*. ⚔ shows the worm's total kills, not kills in the last minute. The tag comes back after a load.

## Out of scope

- The player's HUD kill counter and the stats screen, which already show total kills.
- What bots know about kills (their *read* tactic memory).
- The colour or style of the tag.

## Impact

- `main.js`: the name-tag label uses `w.kills`.
- `engine.js`: remove `killTimes`/`recentKills`.
- Tests:
  - `tests/browser/tags.test.js`: the tag shows the total and doesn't drop after a minute.
  - `tests/engine.test.js`: the "name tags start empty" check goes, and loaded worms keep their kills.
- `README.md` (Names line), `sw.js` (`VERSION`, minor).
- Saves: no format change. `kills` is already saved, and `save-v1.json` keeps loading.
