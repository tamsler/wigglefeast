# Design

## Context

- **Skin table** (`engine.js`): `SKINS` is an array of `{ name, colors }`. A worm holds its skin object. Saves and remembered settings store the skin's **index** (`toJSON` writes `SKINS.indexOf(w.skin)`, `load()` reads `SKINS[d.skin]`, and `validateSnapshot` requires `0 ≤ skin < SKINS.length`).
- **How skins are used:**
  - `spawnBot` uses `pick(SKINS)`.
  - `Worm.stripeColor(i)` picks food colours from `colors`.
  - `main.js` draws the body as runs of 3 segments, each one `colors[c % n]`, then a white gloss and the eyes.
  - The minimap dot, boost glow and boost arrows all use `colors[0]`.
- **Picker:** a 7-column grid of round CSS-gradient swatches, one per skin.
- **Body proportions:** segments sit `0.42 × r` apart, so a big worm has a few hundred segments. Up to about 60 worms can be on screen at once.
- **Preview code:** the Skin Lab preview implemented every finish with plain canvas strokes. Its routines are the starting point.

## Goals / Non-Goals

**Goals:**
- **Same draw cost as stripes:** every finish costs about the same number of canvas calls per worm as stripes, with no shadow blur and no offscreen canvases.
- **Saves stay compatible:** every saved skin index keeps meaning the same skin.
- **One source of truth:** the swatches use the same drawing code as the arena, so a preview can never drift from what the player gets.

**Non-Goals:**
- Unlocks, rarity or skin selection by bots per difficulty.

## Decisions

### 1. The skin table gains optional fields; existing entries keep their index and look
- **Fields:** each entry becomes `{ name, colors, finish = 'stripes', accent = colors[0], food = colors, hidden = false }`.
- **Existing skins:** the 14 existing entries change only by Rainbow and Lavender gaining `hidden: true`.
- **New skins:** the twelve new skins are appended at indices 14–25, with the colours from the Skin Lab. Dark-bodied skins (Synthwave, Toxic, Galaxy, Magma, Abyss) set a bright `accent` and `food`.
- **Engine exports:** `PICKABLE_SKINS` (the visible ones). `spawnBot` picks from it, and `stripeColor` reads `skin.food`.

*Alternative:* replacing Rainbow and Lavender in place. Rejected: their index is in existing saves and settings, and a different skin would appear.

### 2. A drawing routine per finish, dispatched from `drawWorm`
- **Shared parts:** `drawWorm` keeps the cull check, the shield alpha, the outline, the gloss (skipped for neon and galaxy, whose dark bodies look better without it), the eyes and the boost arrows. In between it calls `FINISH[skin.finish](w, r, t)`.
- **Smooth-colour finishes** (gradient, metallic, pulse, galaxy's background) compute one colour per run of 3 segments and stroke that run, so they make the same number of stroke calls as stripes. Colours are interpolated with a small cached hex→rgb helper.
- **Neon:** two wide translucent strokes of the full body for the glow, the dark body, then a thin core line. That's four full-body strokes, plus a light dot every 7 segments.
- **Patterns** (spots, scales, galaxy stars) are spaced in body lengths, not segments: about 2.8 × r for spots, 2.1 × r for scales, and stars on every other segment. That keeps them the same size on big and small worms. Galaxy star positions come from a hash of the segment index, so they don't flicker.
- **Animation clock:** animated finishes use `game.time`, not the wall clock. They therefore freeze while paused and in standby, as the spec requires.

*Alternatives:*
- Canvas `shadowBlur` for the glows: rejected as too slow with many worms.
- Pre-rendered sprite textures along the body: rejected as complex with curved bodies, and memory-heavy.

### 3. Accent and food colours replace `colors[0]` where colour must read on the arena
The minimap dot, the boost glow outline and the boost arrows use `skin.accent`. Dropped food uses `skin.food`. For the original skins these equal `colors[0]` and `colors`, so nothing changes for them.

### 4. Swatches are tiny canvases drawn by the same finish code
- **Drawing:** each picker button holds a 40-pixel canvas showing a short, straight piece of worm body drawn by `FINISH[...]` at time 0. It's drawn once, when the menu is built.
- **Hidden skins:** they're skipped. Each button stores its skin's real index.
- **Layout:** the grid goes to 8 columns, so the 24 visible skins fill 3 rows. The layout tests decide whether the swatch size or gap needs trimming on short screens.
- **Remembered hidden skin:** if the remembered skin is hidden, no swatch is highlighted, and the name label still shows it.

## Risks / Trade-offs

- **Frame rate with a full arena of neon or galaxy worms.** → Draw calls per worm stay close to stripes (decision 2). A browser test renders every finish and checks for errors, and a manual check measures a 60-bot arena on desktop and a phone.
- **Swatches might be too small to read the finish.** → They're drawn at device pixel ratio. The manual check confirms they're distinguishable.
- **Rollback:** an older release can't load a world containing skin indices 14–25. → It starts a fresh world, and stats are untouched (noted in the proposal).
- **Order with the rebrand (#59):** the rebrand changes button and logo colours, not skins, so they can land in either order. Hiding Rainbow here supports the rebrand.

## Migration Plan

No data migration. Bump `VERSION` (minor). To roll back, publish the previous code under a higher version (see the risk above).
