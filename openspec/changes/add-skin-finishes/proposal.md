# Proposal

## Why

Every skin is drawn the same way: flat colour bands every 3 body segments under the same white highlight. Only the palette changes, so no skin feels special, and several pastels wash out on the dark arena (tamsler/wigglefeast#58). The user reviewed live previews in the Skin Lab and approved the direction: new *finishes*, meaning new ways of painting the body, plus twelve skins that use them.

## What Changes

- **Finishes:** each skin has a finish that decides how its body is drawn.
  - **Stripes:** today's look, kept for the existing skins.
  - **New:** gradient, neon glow, metallic with a moving shine, spots, diamond scales, galaxy (twinkling stars), and pulsing glow.
- **Twelve new skins**, added after the existing ones:

  | Finish | Skins |
  |---|---|
  | Gradient | Aurora, Sunset Drive |
  | Neon glow | Synthwave, Toxic |
  | Metallic | Gold Rush, Chrome |
  | Spots | Ladybug, Leopard |
  | Diamond scales | Viper |
  | Galaxy | Galaxy |
  | Pulsing glow | Magma, Abyss |

- **Bots** are dressed from the same choice of skins as the player, so the arena shows the new finishes.
- **Rainbow and Lavender are hidden.** They're no longer offered in the skin picker or given to new bots, but saves and settings that use them keep working. Existing skins keep their position and look.
- **Readable colours for dark skins:** each skin has a bright accent colour for the minimap dot, boost arrows and glow, plus its own food colours for the food it drops. So a dark-bodied skin like Synthwave never leaves near-black food or a hidden minimap dot.
- **The skin picker** shows each skin's finish on its swatch, and stays compact enough that the menu still fits on the tested screen sizes.

### Out of scope

- Unlocking skins through play. That belongs to #14, achievements, which can build on finishes later.
- Removing or recolouring any existing skin, apart from hiding Rainbow and Lavender from the picker.
- Custom or player-made skins, or per-skin eyes, hats and other head accessories.
- The logo and app icon rebrand, which is a separate change (#59).

## Capabilities

### New Capabilities
- `skins`: how worms look. The choice of skins, finishes, hidden skins, the accent and food colours, and keeping saved skin choices compatible.

### Modified Capabilities
<!-- none: gameplay rules are unchanged -->

## Impact

- `engine.js`: the skin table gains `finish`, `accent`, `food` and `hidden` fields, plus the twelve new entries appended. `stripeColor` uses the skin's food colours, and `spawnBot` picks only skins that aren't hidden.
- `main.js`: a drawing routine per finish in `drawWorm`. The minimap, boost arrows and glow use the accent colour, and the picker skips hidden skins and draws finish swatches.
- `style.css`: a denser swatch grid.
- `tests/`: engine tests for compatibility and colours; browser tests for the picker, rendering every finish, menu layout and frame time.
- `sw.js`: `VERSION` bump. No new files.
- **Rollback:** a world containing a worm with one of the new skins can't be loaded by an older release, which starts a fresh world instead. Stats are kept. This is the same trade-off as the tight-turn power-up.
