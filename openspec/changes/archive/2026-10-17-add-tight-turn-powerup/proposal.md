# Proposal

## Why

Players asked for a power-up that lets their worm turn very tightly (tamsler/wigglefeast#38). Turning slows as a worm grows: a full-size worm turns at less than half the rate of a new one. So a short burst of tight turning is useful for escaping, cutting other worms off and circling food, and it gives big worms something to look forward to. It also adds variety to the five existing power-ups.

## What Changes

- **New power-up "Tight turns"** (🌀): for 16 seconds, the worm turns twice as fast as normal for its size, so its circles are about half as wide.
- **Spawning:** it appears in the arena like the other power-ups, at a similar rarity to the 🔭 zoom power-up.
- **Who can collect it:** any worm, bots included, through the same touch-or-pull-in pickup as the others. Bots already head for nearby power-ups and benefit automatically.
- **Feedback:** like the others, it gets a HUD timer, a "🌀 Tight turns!" feed message and a README entry.
- **Touch HUD:** stays free of overlaps with all six power-up timers showing, so the timer list gets more compact on short touch screens.
- **Saves stay backward compatible:** saves without the new power-up keep loading.

### Out of scope

- Changing the turn rate without the power-up, or any other power-up.
- Teaching bots to seek this power-up specifically, or to steer more aggressively with it.
- Stacking: collecting it again restarts the 16 seconds, as with every other power-up.
- A dedicated sound or animation.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `gameplay`: the Power-ups requirement adds the tight-turn power-up and its effect.

## Impact

- `engine.js`: the new power-up type and its spawn weight, its default timer on every worm, and the turn rate doubled while it runs. Save validation accepts the new key automatically, because it checks against the power-up table.
- `main.js`: icon, label and colour for the arena sprite, HUD timer and feed.
- `style.css`: compact power-up timers on short touch screens.
- `README.md`: power-up list.
- `tests/`: an engine test of the turn rate and of old saves loading; the HUD timer; the touch layout test with six timers.
- `sw.js`: `VERSION` bump. No new files.
- **Rollback:** a save containing the new power-up won't load in an older release. The older release starts a fresh world; stats are stored separately and stay safe.
