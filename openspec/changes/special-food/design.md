# Design

## Context

- **Food** (`engine.js`):
  - `game.food` holds plain objects `{ x, y, v, r, c, life, ph, natural }`, indexed by `foodGrid` each tick.
  - `eatFood` pulls food toward a head within `r × 2.2 + 24` (+ `MAGNET_REACH` with the magnet) and eats it on contact. x2/x5 apply only when `natural`.
  - `cleanFood` counts `life` down.
  - Saves pack food as a flat array of 7 numbers per item.
- **Power-ups:** a small separate list `game.powerups`. It refills toward `powerupTarget` (area × density) with a rate-based chance per update (`1 - exp(-rate × dt)`), so the pace doesn't depend on the update rate (#48).
- **Bots** (`think` in `engine.js`): they pick food by `v × (1.3 + 0.7 × ahead) / (d + 40)` within `FR = 200 + 300 × skill`, and may boost toward food worth 6 or more.
- **Save validation:**
  - `validateSnapshot` checks every field `load()` uses.
  - It ignores fields it doesn't know.
  - The format version stays `v: 1` for backward compatibility.
- **Rendering** (`main.js`):
  - Food is drawn as a cached glow sprite plus, in themed arenas, a cached item sprite drawn in code (`itemSprite`).
  - Power-ups are drawn at about 110 units.
  - `feed(text, cls)` shows HUD messages.
- **Randomness:** everything draws from the world's seeded `rng`, so a world replays from its seed (#100).

## Goals / Non-Goals

**Goals:**
- Special food reuses the food pickup feel (drift-in, magnet reach) without touching the packed food format.
- Old releases can still open worlds saved by this one.
- Per-tick cost stays negligible at 150 bots.

**Non-Goals:**
- Using the food grid for special items. There are too few to need it.
- Telling special items apart in stats, the minimap or the leaderboard.

## Decisions

### 1. A separate `game.specials` list, not a flag on food
Each entry is `{ x, y, kind, life, ph, dead }`.
- **Why separate:** a new food field would mean an 8th packed number, a format change that older releases reject.
- **Saving:** a separate list saves as a new optional top-level `specials` field, which older releases ignore. Rollback then keeps the world and only drops the special items.
- **Gameplay side effects avoided:** keeping them out of `game.food` also keeps them out of the remains bookkeeping (#122), `naturalFood` counting, and the x2/x5 `natural` rule.
- *Alternative:* food with a `special` field. Rejected: it breaks the packed format and the rollback, and every food code path would need a special case.

### 2. One table and a few `CFG` constants in `engine.js`
- **Table:** `SPECIALS = { nova: { value: 25, weight: 60 }, nebula: { value: 50, weight: 30 }, plasma: { value: 100, weight: 10 } }`. It drives spawning (`weighted()`), eating and save validation, like `POWERUP_WEIGHTS`. Only append to it.
- **Constants:**
  - `SPECIAL_DENSITY = 5 / (π × 3600²)`, so a 30-bot world has 5 in all.
  - `SPECIAL_SPAWN_RATE = 0.06` per second for each unit of the target, so 0.3 per second (one about every 3 seconds) in a 30-bot world. Scaling the rate with the target lets large arenas fill as fast as small ones.
  - `SPECIAL_LIFE = 20` seconds.
  - `SPECIAL_BLINK = 4` seconds.
  - `SPECIAL_R = 16`, the pickup radius, a little under the largest food (20).
- **Target count:** `specialTarget = max(2, round(area × SPECIAL_DENSITY))`, shared by all kinds: 5 at 30 bots and about 28 at 150 bots.
- **Tuning:** the values sit with the other balance numbers and can be tuned with `tools/balance.js --set`.
- **Expected count:** spawning at 1.2 × target / 20 s, the arena sits at or near its target when nobody eats them, and never above it.
- *Alternative:* a separate target of 5 for each kind (15 in all). Rejected: it loses the rarity of plasma spheres, and adds three times the mass.

### 3. Spawning and expiry in `Game.update`, next to power-ups
- **Spawning:** while `specials.length < specialTarget`, one spawns with probability `1 - exp(-SPECIAL_SPAWN_RATE × specialTarget × dt)` at `randomInCircle(rng, R × 0.9)`, with a weighted random kind and a random phase, from the world `rng`. This keeps the pace independent of the update rate (#48) and replay from a seed exact (#100).
- **New and loaded worlds:** both start with no special items. They appear within seconds, which reads as "appearing" rather than being part of the initial layout.
- **Expiry:** `life -= dt` each update, and dead or expired items are filtered out.

### 4. Eating mirrors `eatFood`
- **The loop:** for each live worm, for each special item (a handful), it uses the same reach `A = r × 2.2 + 24 (+ MAGNET_REACH)`, the same drift step, and eats on `d < r × 0.9 + SPECIAL_R × 0.4`.
- **On eating:** `mass = min(MAX_MASS, mass + value)` with no multiplier, `eaten++`, and `emit('special', { worm, kind, value })`.
- **Cost:** at most ~150 worms × ~28 items (at 150 bots) of cheap distance checks per tick, about 4,000. That's negligible next to the food grid queries.
- **Order:** it runs right after `eatFood`, so a head that eats food and a special item in the same tick gets both, and `peak` tracking (#24) sees it.

### 5. Bots score special items inside the existing food choice
- **Scoring:** in `think`, after the food grid query, the same score formula runs over `g.specials` within `FR` and inside the edge margin.
- **Effect:** a 25–100 value usually wins over nearby regular food, and the existing `bv >= 6` boost rule applies.
- **Why reuse:** no new mode or tactic, so tactic order and shares are untouched.
- *Alternative:* a separate "treasure" mode with its own weight. Rejected as scope creep (see the proposal's out of scope).

### 6. Saving: an optional `specials` array
- **Format:** `toJSON` writes `specials: [{ x, y, kind, life, ph }]`, with rounding like power-ups and life to 0.1.
- **Validation:** when present, `validateSnapshot` requires:
  - an array of at most 200 items
  - `kind` an own key of `SPECIALS` (via `has()`, safe from prototype keys)
  - coordinates within bounds
  - `life` in `(0, SPECIAL_LIFE]`
  - `ph` in range
- **Load:** `load()` uses `snap.specials || []`.

### 7. Drawing: code-drawn sprites, the same in every theme
- **Info table:** `SPECIAL_INFO` in `main.js` gives each kind its label, a feed icon (💠, 💎, 🔮) and a `draw(g, s)` function:
  - nova: a cyan faceted crystal of polygons with light and dark facets
  - nebula: a violet-pink cut diamond with a crown and pavilion
  - plasma: a radial-gradient orb with a jagged electric core
- **Sprites:** each draw function renders once into a cached sprite with a soft halo, like `itemSprite`.
- **Drawing pass:** after food and before power-ups, each special item's sprite is drawn at about 130 units including its halo, with a gentle pulse. The item itself is then about 97 units across, larger than the largest themed food item (about 90 with its pulse), so it stands out. Its halo and the faceted or electric look keep it distinct from the round power-up badges.
- **Sparkle:** a small rotating four-point star twinkles over each item, drawn per frame with two short strokes.
- **Blink:** in the last `SPECIAL_BLINK` seconds, the alpha alternates at about 5 Hz, and the item fades out over the final 0.5 s.
- **Theme independence:** the theme check (`activeTheme`) isn't consulted.
- **Feed:** when the player eats one, `onSpecial` shows `${icon} ${label} +${value}` with class `good`.
- **Test hook:** `wigglefeastDebug` gains `specialSprites()` and `specialLook(kind)`, which returns the kind's look name, for browser tests.

## Risks / Trade-offs

- [Early game swing: a new worm (mass 15) that eats a plasma sphere grows sevenfold.] → This is the intended reward. The items are rare (about 5 in the whole arena, plasma spheres 1 in 10 of them) and each lasts only 20 seconds. The values, weights and count are `CFG`/table constants, easy to tune after playtesting.
- [Expert bots are better at reaching special items than the player.] → They only see items inside their normal food search range, the same as regular food. A balance run before and after (`node tools/balance.js`) checks survival doesn't shift noticeably.
- [Extra `rng` draws change the exact course of seeded worlds and may shift engine tests that depend on a particular seed.] → Determinism is kept. Any test pinned to a specific outcome gets re-checked during apply, and only its expectation is adjusted if it fails, never the behaviour it guards.
- [Emoji in feed text may look different across platforms.] → Only the feed uses emoji. The arena items are drawn in code.

## Migration Plan

No data migration. Bump `VERSION` to the next minor version in `sw.js`, with no new files. Old saves load with no special items. To roll back, publish the previous code under a higher version. Older releases ignore the `specials` field and keep the world.
