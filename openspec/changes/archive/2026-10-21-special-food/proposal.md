# Proposal

## Why

All arena food is worth 1 to 8 mass. It's spread evenly and never moves, so there's nothing worth racing for until a worm dies. tamsler/wigglefeast#143 asks for rare special food items: nova crystals, nebula diamonds and plasma spheres. They're worth much more than regular food, turn up at random, and vanish if nobody eats them in time. That gives the player, and the bots, short-lived prizes to go after and fight over.

## What Changes

- **Three special food items**, the same in every food theme:
  - Nova crystal: 25 mass, the most common (about 60%).
  - Nebula diamond: 50 mass (about 30%).
  - Plasma sphere: 100 mass, the rarest (about 10%).
- **Spawning:** at random places in the arena, up to about 5 at a time in a 30-bot world. The count scales with the arena's area, like food and power-ups. While the arena is below that count, a new one appears every few seconds.
- **Short life:** each one lasts 20 seconds. It blinks for its last 4 seconds, then disappears if nobody has eaten it.
- **Eating:** any worm, player or bot, eats one the way it eats food. It's pulled in near the head, from farther away with the magnet. The x2/x5 multipliers don't apply to it.
- **Bots** see special items when they look for food and go after them like very valuable food.
- **Look:** each item is drawn by the game in its own shape and colours:
  - Nova crystal: cyan, a faceted crystal.
  - Nebula diamond: violet-pink, a cut diamond.
  - Plasma sphere: a glowing orb with an electric core.
  
  All three get a sparkle. They look the same whatever theme is chosen, Classic included, and are drawn larger than regular food so they stand out.
- **Feedback:** when the player eats one, the feed shows its name and value, for example "💎 Nebula diamond +50".
- **Saving:** special items are saved with the world, with the time they have left. Older saves have none and load normally.
- **Docs:** README "How to play" mentions special food.

### Out of scope

- Showing special items on the minimap, or pointing to them off screen.
- Sounds or particle bursts when one is eaten.
- Theme-specific versions of the items (for example a pumpkin-shaped crystal at Halloween).
- New bot tactics built around special items, such as guarding or contesting them. Bots only score them as food.
- Counting special items in stats or high scores.
- Changing regular food, power-ups or the x2/x5 multipliers.

## Capabilities

### New Capabilities
- `special-food`: rare, high-value, short-lived food items that appear across all food themes. Covers which items exist, their values, spawning and expiry, eating, how they look, and saving them.

### Modified Capabilities
<!-- none: regular food, food themes, power-ups and saving keep their current requirements -->

## Impact

- `engine.js`:
  - Item table and tuning in `CFG`.
  - Spawning, expiry and eating for a new `specials` collection.
  - Bots score special items as food.
  - Save, load and validation of an optional `specials` field (world format stays `v: 1`).
  - A new `special` event.
- `main.js`: item sprites drawn in code and the feed message.
- `README.md`: how-to-play line.
- `tests/`:
  - Engine tests: spawning, expiry, eating, magnet pull, no multiplier, saves with and without special items, and replay from a seed.
  - A browser test that the items draw under every theme and that eating one shows the feed message.
- `sw.js`: minor `VERSION` bump. No new files, so `FILES` doesn't change.
- **Rollback:** older releases ignore the unknown `specials` field, so a world saved with special items still loads there, just without them.
