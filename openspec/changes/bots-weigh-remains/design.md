# Design

## Context

How remains and hunts work today (`engine.js`). See proposal.md for why this needs to change.

- **Remains memory:** `Game.die` pushes **5 points** along the dead body into `game.recentDeaths`, each `{ x, y, mass: total / 5, time }`, where `total = max(10, 0.8 × mass)` is what the death drops. `Game.update` drops points older than `CFG.REMAINS_TIME` = **6 s**. The memory isn't saved.
- **Remains food:** the death drops `count = clamp(round(total / 2.5), 5, segments)` pellets spread up to `0.7 r` around evenly spaced body points. They live **45–60 s**. Boost trails drop pellets that live **18 s**. Both kinds are `natural: false`, and natural food is `natural: true`.
- **`botThink` goal layering:** later layers override earlier ones. The order is food (radius `FR = 200 + 300 s`), power-up, **scavenge**, head-on, **hunt** (prey acquisition, then cut, coil or pin), then evade.
  - **Scavenge** (bots knowing `scavenge`) scores each remains point within `SR = FR + 400` as `mass / (d + 200)`. It skips points another head is closer to, and wins only if it beats the best food score.
  - **Prey acquisition** happens only when the bot has no prey, with probability `aggro × 0.2` per think, among worms lighter than `preyRatio × mass` within `300 + 350 × aggro`.
  - **A hunt lasts until `huntUntil`** (1.5–4.5 s, or 6 s once a coil starts). It ends early only on prey death or distance > 900.
- **Grids:** `foodGrid` is rebuilt at the end of `Game.update`, so it's current when bots think at the start of the next tick.
- **Randomness:** everything draws from the seeded `g.rng` (#100). Scavenging draws nothing. Prey acquisition draws once per think (the `aggro` roll), plus once more for `huntUntil` when it picks a target.

## Goals / Non-Goals

**Goals:**
- Remains valued by their **live** food and remembered as long as it lasts.
- One comparable score for a meal and for a hunt, so "meal before fight" is a single comparison in two places: prey acquisition and hunt continuation.
- **Easy byte-identical:** the same seed gives the same world, because Easy bots have no tactics and valuing remains draws no random numbers.
- Expert ms/tick at 150 bots within +5%.

**Non-Goals:**
- Changing the plain food search, the head-on or evade layers, or how a hunt is executed (cut, coil, pin geometry).
- Coordinating several scavengers beyond today's *contested* rule.

## Decisions

### 1. Remains records with a live value
`recentDeaths` entries become `{ x, y, reach, mass, value, time }`:
- **`reach`:** the radius around the point that counts as these remains, `max(40, gap / 2 + 0.7 r)`, where `gap` is the body length between two of the 5 points. Together the 5 points cover the whole body.
- **`value`:** the summed `v` of live, non-natural food within `reach`, refreshed by `Game.update` every **0.25 s** of game time, right after `rebuildFoodGrid()`. It starts as `mass` (the share dropped).
- **Pruned** when `value < max(2, 0.1 × mass)` (eaten up) or when older than `CFG.REMAINS_TIME`, raised from 6 s to **60 s** (the longest a remains pellet lives).

Scavenge scoring uses `value` instead of `mass`.

*Alternatives:*
- Tag remains pellets with the death they came from. That needs a new food field, which would be saved or need special handling on save and load.
- Cluster food each tick. That's more work and harder to make deterministic.

Counting non-natural food near the point is cheap and good enough. A boost trail passing through the pile adds to it, which is fine: it's food too.

### 2. One score for meals and hunts
- **Meal score** (best uncontested remains in `SR`, computed as now): `value / (d + 200)`.
- **Hunt score** for prey `o` at head distance `d`: `CFG.HUNT_ODDS × 0.8 × o.mass / (d + 200)`. `0.8 × mass` is exactly what the kill drops. `HUNT_ODDS` (starting value **0.5**) discounts for hunts that fail or get cut short. It lives in `CFG` so that `tools/balance.js --set HUNT_ODDS=…` reaches it for tuning.

Using the same distance form keeps the comparison fair for near and far targets.

*Alternative:* a fixed threshold, such as "remains worth more than X". That's simpler, but it ignores how far away and how big the prey is, so a tiny nearby meal could pull a bot off a huge, nearly finished kill, or the reverse.

### 3. Where the comparison happens
Only for bots that know `scavenge`. The meal score is `0` when there's no uncontested remains in range.
- **Prey acquisition:** a candidate whose hunt score is ≤ the meal score is left out. If none are left, no hunt starts, so the `huntUntil` draw is skipped, but the `aggro` roll stays.
- **Hunt continuation:** at the top of the `if (ai.prey)` block, if the meal score > the hunt score for the current prey, call `endHunt(ai)`. The scavenge goal set earlier stays the goal. This covers cut, pin and **coil**.
- **Layer order is unchanged:** head-on and evade still override the meal.

Dropping a hunt clears `retaliating` as any ended hunt does. A grudge stays in memory, so the bot can retaliate later.

*Alternative:* keep the hunt but steer through the meal. That's attractive, but the coil geometry and the cut point fight the meal's direction, and it's much harder to test.

### 4. No flip-flopping
After a bot drops a hunt, the meal's score only rises as the bot approaches it. A new hunt needs both the random `aggro` roll and to beat the meal. Once the remains are eaten or contested, the bot hunts as usual. No extra hysteresis state is needed, so nothing new goes into `ai` or the save.

### 5. Measurement
`tools/balance.js` on seeds 100+ (3 runs × 2 min) at 30 and 150 bots, levels normal, hard and expert, profile careful, before and after. It reports:
- player survival (median and p25)
- deaths by tactic, especially coil and cut
- bots hunting the player at a time
- top-bot and >1000 bot counts
- ms/tick

Tune `HUNT_ODDS` (0.3–0.8) if a level's player survival moves by more than about ±25%. Easy must report identically.

## Risks / Trade-offs

- **[Bots grow bigger, so the game gets harder]** → That's partly the point (they eat instead of fight). Measure, and tune `HUNT_ODDS` down if Hard or Expert survival drops too far.
- **[Fewer kills, so less remains, so less to eat]** → This is self-limiting. Measure bot deaths per minute.
- **[More remains records to scan per think]** (up to 60 s instead of 6 s) → Pruning drops eaten piles fast in busy areas. If the 150-bot budget is exceeded, bucket the records on the existing grid cell size.
- **[A boost trail through an area looks like remains]** → Only counted near a death point. Acceptable.
- **[Prey near remains is protected]** → A small worm eating remains next to a scavenging hunter is safer. That fits "meal before fight". The player can use it as a refuge, and it's visible play.

## Migration Plan

Nothing to migrate: remains memory isn't saved, and loaded worlds start with none (as today). Rolling back is a normal release with a higher version.

## Open Questions

- ~~The final `HUNT_ODDS`.~~ Settled at **0.5**. Measurement showed it barely moves the balance (see tasks.md, 4.2 outcome).
