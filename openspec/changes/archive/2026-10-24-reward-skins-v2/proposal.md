# Proposal

## Why

The six achievement rewards look like recolours of free skins, so earning them isn't exciting. The owner asked for much cooler skins, and approved a prototype of six animated, effect-based looks that no free skin has. Tracked in tamsler/wigglefeast#180. (The prototype was only a scratch copy; none of it is in the game yet.)

## What Changes

- **Six new reward looks**, each with its own animated finish:
  - **Ghost** (First Bite): see-through with a soft glow, the floor showing through.
  - **Holo** (Big Noodle): rainbow colours drifting along the body, a white shine sweeping over it, twinkles.
  - **Inferno** (Hungry Hunter): charred body with molten veins and glowing cracks pulsing toward the tail.
  - **Storm** (Marathon): dark blue body with lightning bolts flickering across it.
  - **Crystal** (Titan): icy facets with sparkles flashing on the edges.
  - **Galaxy Prime** (Hard Survivor): drifting nebula clouds, stars and the odd shooting star.
- **They replace the old rewards in place**: Rainbow → Holo, Lavender → Ghost, Dragon → Inferno, Thunder → Storm, Royal → Crystal, Cosmic → Galaxy Prime. Skins are saved by position, so every saved world, setting and unlock keeps working; achievements and their unlocks are unchanged (same ids, same goals). A saved world with a Rainbow worm shows a Holo worm, and so on.
- The picker, the locked padlocks, the menu preview and the stats screen show the new names and finishes.

### Out of scope

- New achievements, changing goals, or reordering rewards.
- Reduced-motion variants of the effects (free skins animate too).
- Free skins, bots (they never wear rewards).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `skins`: the reward skins' names and looks (replacing the four added in #14 and the two hidden ones), and the texts that name them.
- `achievements`: which skin each achievement unlocks, by its new name.

## Impact

- `engine.js`: the six reward entries get new names, finishes, colours, accents and food colours (positions unchanged).
- `main.js`: six new finishes (`ghost`, `holo`, `inferno`, `storm`, `crystal`, `galaxyprime`) next to the existing ones, with `paintBody` supporting see-through bodies and additive glows; swatches reuse them.
- `sw.js`: VERSION bump (minor). No new files.
- Tests: engine skin-list test (names, finishes, unlock ids), skins and achievements browser tests that name old rewards, a render test per finish, frame-time smoke tests unchanged.
- No save, settings or profile changes.
