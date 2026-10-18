# Proposal

## Why

Food is always a glowing dot. The user wants themed food to make the arena more fun and seasonal: holiday themes such as Halloween and Christmas, plus everyday themes such as snacks and tech items (tamsler/wigglefeast#64). They chose:
- a menu picker, with an **Auto** setting that follows the season
- items **drawn in code**, so they look the same on every device

## What Changes

- **Five food themes:**

  | Theme | Items |
  |---|---|
  | Classic | today's glowing dots |
  | Halloween | candy corn, wrapped candy, lollipop, pumpkin |
  | Christmas | candy cane, ornament, gingerbread, gift |
  | Snacks | cherry, cookie, donut, cake slice |
  | Tech | microchip, battery, floppy disk, gear |

- **Sizes:** small food shows the small items, medium food the medium one, and large food the large one. Each piece keeps the same item for its whole life.
- **Readable trails:** items sit on a soft glow in the food's own colour, so food dropped by a worm still shows that worm's colours.
- **Theme picker:** a new "Food" picker in the menu: Auto, Classic, Halloween, Christmas, Snacks, Tech. The choice is remembered.
  - **Auto** (the default) uses Halloween from 15 to 31 October, Christmas from 1 to 26 December, and Classic otherwise.
- **Gameplay is unchanged:** food values, sizes, pickup, power-ups and saves all stay the same. Only drawing changes.

### Out of scope

- New gameplay per theme (different values or effects), or themed power-ups, worms or backgrounds.
- More seasons (Easter, Lunar New Year), or downloadable or user-made themes.
- A separate settings screen; the picker lives in the menu. #13 can move it later.

## Capabilities

### New Capabilities
- `food-themes`: how food looks. The available themes, choosing one (including seasonal Auto), and how themed items map to food sizes.

### Modified Capabilities
<!-- none: gameplay rules for food are unchanged -->

## Impact

- `engine.js`: a pure `seasonalTheme(date)` helper (exported, headless-testable). No simulation change.
- `main.js`: a theme registry with code-drawn item sprites (cached per item), food drawing via the active theme, `settings.theme` (validated, default `auto`), and the menu picker.
- `index.html` / `style.css`: the Food picker row, and spacing so the menu still fits.
- `tests/`: an engine test for the season dates; browser tests for the picker, remembering the choice, rendering every theme, and the menu layout.
- `sw.js`: `VERSION` bump. No new files.
