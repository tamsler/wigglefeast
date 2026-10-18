# Design

## Context

- **Arena:** `Game` sets `R = 1800 + 60 · botCount`. Food and power-up targets are area × a fixed density. The segment and food grids are sized from `R`.
- **Engine cost** is dominated by food (grid rebuild and eating each tick) and by bot thinking. Measured on a fast laptop (Expert, with the player):

  | Bots | Arena rule | ms per tick | Food | Save |
  |---|---|---|---|---|
  | 60 | today | 0.7 | about 7,900 | 277 KB |
  | 200 | today | 4.5 | about 42,700 | 1.4 MB |
  | 150 | proportional area (this change) | 1.8 | about 19,100 | 665 KB, serialized in 6 ms |
  | 200 | proportional area (this change) | 2.8 | — | — |

- **Rendering** (`main.js`) skips food, power-ups and worms outside the view, and names are drawn only for heads in view. Its cost depends on what's on screen, not on the arena or bot count. The minimap draws a dot per bot today; #80 replaces that with a density grid.
- **Limits:** `validateSnapshot` rejects `botCount > 60`, and `loadSettings` resets a stored `botCount > 60` to 30.

## Goals / Non-Goals

**Goals:**
- 150 bots stay smooth on a laptop and a recent phone.
- Worlds with 60 bots or fewer are unchanged in every number.

**Non-Goals:**
- An automatic cap based on measured device speed.

## Decisions

### 1. Arena area proportional to bots above 60
`R = bc ≤ 60 ? 1800 + 60·bc : 5400·√(bc/60)`. The two formulas meet at 60 (both 5400). Above that, each bot adds the same area as the 60th one did, so bot density stays where it is at 60 bots, and food, segments and save size grow linearly.

*Alternative:* keep the linear radius. The quadratic food growth is what made 200 bots expensive.

### 2. Maximum 150
Engine cost at 150 is about 2.5× that at 60. A phone that runs 60 bots comfortably at 0.7 ms × (3–5) per tick should manage 150 at about 6–9 ms. That leaves room for rendering in a 16.7 ms frame. 200 bots would leave too little.

The number is confirmed during apply:
- frame times in headless Chrome at 30, 60 and 150 bots, with the engine and rendering timed separately
- a playtest on the owner's phone

### 3. Limits and validation
- `validateSnapshot` and `loadSettings` accept 5–150.
- The slider's `max` becomes 150.

The leaderboard already shows only the top worms, so it needs no change.

### 4. Measuring render cost in the browser
A browser test starts runs at 30, 60 and 150 bots. It wraps `window.__game.update` with timing and measures whole frames with `requestAnimationFrame` deltas over about 3 seconds each, and fails if the engine's average share exceeds a loose bound. Headless Chrome uses software rendering, so absolute frame times are only a smoke check; the phone playtest decides.

## Risks / Trade-offs

- [Phones struggle at 150] → the owner's phone playtest is part of the tasks. If it stutters, lower the maximum (100–120) before merging. That only changes one constant and a spec number.
- [Saves of about 700 KB every 10 s] → serializing takes about 6 ms on a laptop, maybe 20–30 ms on a phone, about once every 10 s. That's a small hitch, and the existing save also runs when the tab is hidden. localStorage's roughly 5 MB budget isn't at risk.
- [Forward compatibility] → an older release rejects a saved world with more than 60 bots (it starts a new world, as with any invalid save) and resets such a bot-count setting to 30. Only relevant on a rollback.
- [Bots spread thinner on screen than players expect from "more bots"] → bot density is unchanged by design. A bigger arena means more bots overall, not a more crowded screen.

## Migration Plan

Ships as one minor release. Existing worlds (60 bots or fewer) keep their size. Nothing to migrate.
