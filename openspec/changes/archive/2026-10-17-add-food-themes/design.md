# Design

## Context

- **Food records:** food is `{ x, y, v, r, c, life, ph, natural }`. `ph` is a random phase set when the food is created; it's saved and restored with the world, and only used today for the pulse.
- **Values:** natural food is worth 1, 2, 4 or 8. Boost drops are about 1.5 and up. Death drops are about 1.4 to a few hundred at most (#46 bounds them).
- **Current drawing** (`main.js`): `render()` draws each food in view as `foodSprite(f.c)`, a 64-pixel radial-glow canvas cached per colour, at a size of `f.r × 5`, with a slight pulse.
- **Settings:** settings are `{ name, skin, botCount, difficulty }`, rebuilt from checked fields by `loadSettings()` and written when Play is pressed.
- **Menu height:** the menu must fit without scrolling at 1280×713 (layout test). The skins change already grew it by a swatch row.

## Goals / Non-Goals

**Goals:**
- **Drawing only:** themes change no simulation, no save data, and no food behaviour.
- **Same cost as dots:** at most two cached `drawImage` calls per visible food, and no per-frame canvas creation.
- **Consistent look:** items look the same everywhere, and read at small sizes.

**Non-Goals:**
- Animated items, themed power-ups, or themed backgrounds.

## Decisions

### 1. A render-side theme registry with cached, code-drawn item sprites
- **Registry:** `main.js` has `FOOD_THEMES = { classic, halloween, christmas, snacks, tech }`. Each themed entry lists four items as `{ name, tier, draw(g, s) }`, with `tier` ∈ small, small, medium, large.
- **Drawing:** each `draw` paints its item into an `s × s` canvas with bold, flat canvas shapes (fills, strokes, a highlight) in the item's own colours, with a dark outline so it reads on the navy floor.
- **Caching:** sprites are made on first use at 96 px and cached as `theme:item`. That's 16 canvases at most, created once.

*Alternatives:*
- Emoji: rejected, because the user chose drawn items for a consistent look.
- Inline SVG images: rejected, because they need async image decoding and add no benefit over canvas drawing here.

### 2. Item choice from value and the saved phase
- **Tier:** value under 3 is small, under 7 is medium, otherwise large.
- **Which small item:** of the two small items, `f.ph` picks one (`ph` below π gives the first).
- **Stable:** `ph` is fixed at creation and saved, so a piece of food keeps its item across frames and across save and load, with no new state.

### 3. Drawing order: a colour glow, then the item
- **Each themed food draws twice:**
  1. the existing `foodSprite(f.c)` glow at reduced alpha (0.55) and size `f.r × 4.8`
  2. the item sprite at `f.r × 4`, with the same gentle pulse. This was raised from 3.2 after screenshots showed the small items were too small to read; the glow went from 4.2 to 4.8 to match.
- **Why:** the glow keeps the worm-colour signal of dropped food and the arena's sparkle.
- **Classic:** draws exactly as today.
- **Fading food:** it fades both layers, as now.

### 4. The setting and seasonal Auto
- **Stored setting:** `settings.theme` ∈ `auto | classic | halloween | christmas | snacks | tech`, default `auto`, validated in `loadSettings()`. Unknown or missing values become `auto`.
- **Season helper:** the date rule lives in `engine.js` as a pure `seasonalTheme(date)` (local month and day: 15–31 October gives Halloween, 1–26 December gives Christmas, otherwise Classic), exported for an engine test.
- **Active theme:** `main.js` resolves it once at load, whenever the picker changes, and when a new run starts. That covers a session that crosses midnight into a new season the next time Play is pressed.

### 5. The menu picker: one compact row
- **Markup:** a "Food" label, showing the resolved name, for example "Auto · Halloween", above one row of six small round buttons.
- **Buttons:** each button shows its theme's large item sprite. Classic shows a glowing dot, and Auto shows the current season's item with a small "A" badge. Each has a `title` and `aria-label`.
- **Selection:** the current choice is highlighted, like the skin swatches.
- **No duplicate of Auto's theme** (#67): the button for the theme Auto currently resolves to is hidden, since Auto already shows it, unless it's the player's explicit choice. The row is a flex row, so the remaining buttons share its width evenly.
- **Height:** the row is about 40 px. If the 1280×713 layout test starts to scroll, the existing `max-height: 760px` tightening rule gets one more step: smaller gaps and labels. The test decides.

## Risks / Trade-offs

- **The menu could get too tall** on laptop screens. → A single 40-pixel row, plus the layout tests at all four sizes. Moving the picker to a settings screen later is #13's job.
- **Readability of tiny items:** small natural food is about 5 units across, about 18 px on screen. → Flat shapes with a dark outline and the colour glow underneath. A manual check covers it.
- **Item art takes effort:** 16 small drawings. → Each is a short function with no assets. Headless screenshots of every theme are part of the tasks.
- **Seasonal dates are fixed and local**, with no locale-specific holidays. → Out of scope; the dates are easy to change in one helper.

## Migration Plan

No data migration: old settings get `auto`. Bump `VERSION` (minor). To roll back, publish the previous code under a higher version; the extra settings field is simply ignored.
