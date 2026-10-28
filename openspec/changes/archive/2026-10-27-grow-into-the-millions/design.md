# Design

## Context

Every size in the engine derives from `mass` (`radiusFor`, `lengthFor`, `spacingFor`, `turnRateFor`). Four things stop a worm short of the millions today (see proposal.md for why that matters):

- `Worm.update` sheds `(mass − SHED_ABOVE) × SHED_RATE` per second, with `SHED_ABOVE = 10000`.
- `radiusFor` is capped at 90, reached at about 167,000 mass.
- Boosting costs `1.5 + 0.5% of mass` per second. At 1,000,000 that is 5,000 per second, 3,000 of it dropped as food.
- `validateSnapshot` rejects `mass > MAX_MASS` (1e6).

Natural food is the only source of new mass: about 2,600 pellets in a 30-bot arena (average value 1.87) refilled at about 600 per second, so the whole arena earns on the order of 1,000 mass per second. Dead worms drop 80% of their mass, valued exactly as eaten (x2/x5 never apply to them, the #16 rule). Balance runs (`tools/balance.js`, 30 simulated minutes, Hard, 3 seeds, largest bot at the end) showed that lowering the barriers alone is not enough: the old rules gave 11,000 to 34,000; the planned limits, giants and food changes gave 72,000 to 121,000; free boosting made no difference (75,000 to 121,000), nor did 3x denser food (58,000 to 74,000) or 10x denser food with boosting capped at 20 per second (76,000 to 96,000). The largest bots keep getting hunted and killed (about 64 bot deaths a minute on Hard), each death loses 20% of the victim and spreads the rest around, so nothing outgrows the pool. Decision 11 adds a size-scaled reward.

Other facts that bound the design:

- A worm's body is about 350 segments at any large size: the segment count is `length / (0.42 × radius)` and length is capped by the arena (below). `MAX_SEGMENTS` (20,000) is nowhere near.
- `die()` drops one pellet per segment at most (`count ≤ n`), so a giant's 800,000 mass becomes about 340 pellets worth about 2,350 each. `MAX_FOOD` (50,000) is not an issue.
- The renderer draws only the visible stretch of long bodies (#82), and collision grids query by `r + maxR`, so a larger radius costs only a larger query window.
- `tests/fixtures/save-v1.json` must keep loading, and saved food and power-ups carry no schema beyond their fields.

## Goals / Non-Goals

**Goals:**
- The largest bot passes 100,000 mass in most 30-simulated-minute runs on every difficulty level, and passes 1,000,000 only rarely; a worm that keeps winning can reach the millions, for bots as well as the player.
- Nothing breaks at that size: arena room, camera, rendering speed, HUD numbers, saves.
- Every number that carries the economy is a named `CFG` constant that `tools/balance.js --set` can override.

**Non-Goals:**
- Guaranteeing that every run reaches the millions. Most runs should not.
- New bot tactics, abbreviated numbers, new achievements (see proposal.md, Out of scope).
- Changing how much a kill pays. Corpses stay 80% of the victim's mass and stay unmultiplied.

## Decisions

### 1. Move the shedding threshold instead of removing it
`SHED_ABOVE` goes from 10,000 to 2,000,000 and `SHED_RATE` stays 0.2%/s. Below 2,000,000 a worm never shrinks on its own; above it, holding mass costs `0.2% × excess` per second (a worm at 3,000,000 loses 2,000 per second), so mass settles near a soft ceiling in the low millions.

- *Alternative: remove shedding.* A bot that snowballs would then grow without a bound that the simulation can reason about. Keeping a far-off ceiling costs nothing in normal play and keeps `MAX_MASS` a hard backstop rather than the thing that stops growth.
- *Alternative: a gentler rate from 10,000.* Even 0.05% of the excess at 1,000,000 is 500 mass per second, more than the arena earns in natural food over a moment; it would still cap growth in the hundreds of thousands, which is the problem.

### 2. Radius: lift the cap, keep the curve
`radiusFor` keeps `9 + 2.2 × m^0.3` and the cap moves from 90 to 300 (reached around 12,000,000, past the shedding ceiling, so it only guards against odd inputs). That gives about 79 at 100,000, 148 at 1,000,000 and 202 at 3,000,000. The camera zoom rule `1 + (r − 14)/35` already follows the radius, so it gives about 0.21 at 1,000,000 with no change; the change to the spec is only the new scenario.

- *Alternative: a steeper curve.* A giant that is six times wider than a 50,000-mass worm leaves the rest of the arena tiny on screen. The existing curve already gives the right order of magnitude, and a 300-unit cap is only a guard.

### 3. Length: a second, much flatter segment above 100,000
`lengthFor` is continuous and piecewise: unchanged up to 10,000, `× (m/10,000)^0.4` up to 100,000 (about 17,250), then `× (m/100,000)^0.08` above. At 1,000,000 that is about 20,700, still under the 30-bot circumference (about 22,600), which the existing spec says a massive worm must stay below so it cannot wall off the arena. At 3,000,000 it is about 22,000. The smaller 150-bot arena scaling only makes the circumference bigger.

- *Alternative: let length grow with the existing 0.4 exponent.* A 1,000,000-mass worm would be about 43,000 units long, almost twice the circumference of the default arena.

### 4. Boost cost: a smaller share and a ceiling
Boost cost becomes `min(BOOST_COST_BASE + BOOST_COST_SHARE × mass, BOOST_COST_MAX)` per second, with `BOOST_COST_SHARE = 0.0025` (was 0.005) and a new `BOOST_COST_MAX = 150`. A worm of 3,000 pays 9 per second (was 16.5), the cap is reached at about 59,400, and a giant pays 150 per second (60% of it, 90 per second, is dropped as food behind it). Small worms pay up to half what they paid; this is the owner's "don't shed as much food when going fast".

- *Alternative: change only the drop share (60% to, say, 30%).* That makes boosting free of consequence for the mass, not for the food: a giant would still lose 5,000 per second. The loss is the problem for giants.
- *Alternative: keep the cost as is below 20,000 and cap above.* Easier to defend against a small-worm balance change, but the owner asked for less shedding while boosting in general, and one formula is easier to explain. `tools/balance.js` decides if early boosting becomes too cheap for bots; if so, move to this one.

### 5. Natural food: replace the 8 tier with 10, and weight it up
`spawnNaturalFood` uses `{1: 52, 2: 30, 4: 12, 10: 6}` instead of `{1: 55, 2: 30, 4: 12, 8: 3}`. Average value rises from 1.87 to 2.2, a 17% increase in what the arena pays out. The owner's "1, 2 and 10 point items" is read as "keep a small, medium and big natural pellet, with 10 as the big one", and the 4 tier stays so the table still has a gradual shape. The sprite chosen in `itemIndex` (`v<3`, `v<7`, else) already gives 10 the biggest sprite; no new art.

- *Alternative: only three tiers, `{1, 2, 10}`.* Drops the middle tier, makes the average value (about 3.4) jump by 80%, and makes the early game feel quite different.

### 6. x10 power-up
`POWERUP_WEIGHTS` gets `x10: 2` appended (x5 is 5, total from 105 to 107). `Worm.multiplier` returns 10 when `pw.x10 > 0`. It multiplies natural food only, like x2 and x5, so a worm cannot mint mass out of a corpse. `main.js` gets a `POWERUP_INFO.x10` entry (label "Food x10", a distinct colour, placed after x5 so the badge order stays fixed). `validateSnapshot` already derives its allowed power-up keys from `POWERUP_WEIGHTS`, so new saves with x10 load in this version; a worm's `pw` defaults to 0 for keys a save lacks, so old saves load too. Old *app versions* refuse a save with an x10 key; that is acceptable for a game that only ever upgrades (the service worker updates every copy).

- Appending a key changes `weighted()`'s total, and so what a given seed spawns. That is accepted; tests that pin a seed's outcome are re-checked (task 3.4).

### 7. Food radius keeps growing slowly after 50
`foodRadius(v)` stays `min(20, 3 + 2.4√v)` for `v < 50` (so it is exactly as before), and above 50 it becomes `min(60, 20 + 18 × log10(v / 50))`, which gives about 49 for a 2,000-mass pellet and 60 for anything over about 10,000. Pickup uses `f.r × 0.4` and the pull-in range uses the worm's radius, so a larger pellet is a slightly easier target; at those sizes the eater is tens to hundreds of units wide, so it does not matter. The glow drawn around a pellet is derived from `f.r` (`main.js` view culling uses `f.r × 3.7 − 40`), so the culling margin follows automatically.

### 8. Save limit
`MAX_MASS` becomes `1e8` (it clamps eating, 4 places in `engine.js`, and is checked in `validateSnapshot`). Loosening the validator cannot break old saves. `MAX_SEGMENTS` and `MAX_FOOD` stay. `cleanProfile`'s `num()` only checks "finite and ≥ 0", so profile scores need no change.

### 9. HUD numbers
The leaderboard score column is a fixed 50 px (46 px on phones), enough for "99,999". Widen to fit "99,999,999" (10 characters at the leaderboard's tabular numerals), in both layouts and in `--lb-cols-big`, and take the room from the name column, which is `minmax(0, 1fr)` and already ellipsises. The score area, game-over summary, and stats tables render through `toLocaleString()` and should already fit, but they are covered by a layout test with 8-digit values instead of assuming.

- *Alternative: abbreviate (1.2M) past a threshold.* Rejected for now (out of scope): full numbers are what every record and the current UI use, and the leaderboard fits them after widening.

### 10. Starting giants
`spawnBot(initial)` gets a giant count of `min(botCount − 2, max(3, round(botCount / 10)))` (3 in the default 30-bot world, 15 at 150 bots, 3 at the minimum of 5), and the first that many initial bots are giants: a uniform random mass from `CFG.GIANT_MIN_MASS` (20,000) to a per-difficulty `giantMax` in `DIFFICULTY` (35,000 / 55,000 / 80,000). The remaining bots roll `bigShare` and start as today. Replacements and loaded saves are untouched, so a giant is a start-of-world gift, not a spawn rule. Giants are normal bots otherwise: same AI, same tactics.

A giant's full body is too long to lay out at spawn: 80,000 mass is about 15,800 units, longer than the whole edge of a 5-bot arena (about 13,200), and the current layout curls the body behind the head, which would pile it into a dense ball or push it outside the wall. So the constructor lays out at most `CFG.BODY_LAYOUT_MAX` (5,000 units) of body, which every ordinary worm up to about 6,000 mass already fits in and which fits any arena and `Worm.update` already pushes missing segments onto the tail when the target length is longer, so the body unfolds to full length as the giant moves. The collision body is thus short at first and grows; the radius is full from the first moment.

- *Alternative: raise `bigShare` and `bigMax` instead.* Gives random, not guaranteed, giants: a world can still start with none, which is what the owner wants to avoid.
- *Alternative: coil the full body in the arena.* A ball of overlapping segments is a trap that kills anything touching it and looks odd.
- *Alternative: one giant count for every size of world.* A 150-bot world would feel as empty of giants as a 5-bot one; one per 10 bots keeps the density.

### 11. Size bonus on arena food
Eating natural food gives `value × multiplier × growthBonus(mass)`, with `growthBonus(m) = 1` up to `CFG.GROWTH_FROM` (1,000) and `(m / GROWTH_FROM) ^ CFG.GROWTH_POWER` above it, with `GROWTH_POWER = 0.6`: 4x at 10,000, 16x at 100,000 and 63x at 1,000,000. Food dropped by worms, special food and boost drops are not scaled, so the #16 rule (nothing minted from corpses) holds. The pull of a worm on food grows as its radius to the power 0.3 and its bonus as mass to the power 0.6, so income grows about as mass to the 0.9: close to exponential, with the soft ceiling from shedding (2,000,000) and `MAX_MASS` as backstops.

Sweep (largest bot after 30 simulated minutes, Hard, 3 seeds): exponent 0.4: 70,000 / 93,000 / 138,000; **0.6: 147,000 / 202,000 / 347,000**; 0.8: 1,046,000 / 14,159,000 / 100,000,000 (the cap). With `GROWTH_FROM` 300 at exponent 0.6: 387,000 / 472,000 / 1,685,000. The owner asked for the hundred thousands, so 0.6 from 1,000 is chosen: a clear step above 100,000, and well away from the runaway at 0.8. It is a pair of `CFG` constants, so the last tuning is a `--set`.

- *Alternative: a kill bonus (the killer gains a share of the victim's mass on top of the food).* Concentrates growth in fighting, which Hard bots already do a lot, and makes a kill worth more than the corpse, which the #16 rule was written to avoid. The food bonus rewards surviving and eating, which is what a player controls.
- *Alternative: scale all food, dropped food included.* Makes mass out of corpses: a big worm eating its victim's remains would grow without limit (#16).
- *Alternative: scale from a lower mass (300).* Reaches the millions in half the runs, so it is too strong for the stated target.

## Risks / Trade-offs

- **The bonus speeds up the early and middle game** → A 1,000-mass worm is unchanged and a 5,000-mass worm eats 2.6x faster. Early-game feel is intact (below 1,000 nothing changes), and the balance run checks the stand-in player's survival and the bots' size over time on every level.
- **A runaway leader** → 0.8 reaches the cap in one run in three; 0.6 did not in 6 runs. Shedding above 2,000,000 and `MAX_MASS` are backstops; the balance run records the largest bot per run and the share of runs above 1,000,000.

- **Giants are dangerous to a new player** → The player spawns at least 450 units from every body point, has a 2.5 s shield, and giants hunt like other bots. The balance run measures the stand-in player's survival with giants; the lower end of each range (20,000) and the Easy/Normal/Hard scaling are the first things to retune.
- **Economy may not reach the hundred thousands, or may reach the millions too easily** → The constants (`SHED_ABOVE`, `BOOST_COST_*`, the food table, the x10 weight) live in `CFG`/tables so `tools/balance.js --set` can sweep them. Task 8.1 applies the acceptance bar (see Migration Plan); the starting values here are a best estimate, not a result.
- **A runaway bot** (nobody can kill a 500,000-mass bot) → A giant bot is a trophy by design, but one that nobody can kill would stall the late game. The balance run records the largest bot at each minute; if one regularly dominates, shedding starts lower or bots get a mass ceiling (a small follow-up).
- **Cheaper boosting speeds up small worms' growth and dropping** → The same balance run compares survival time and top-bot size before and after; boost cost for small worms is the first thing to retune.
- **Huge worms hide the arena** → A 296-unit-wide body at zoom 0.21 is about 62 screen units wide; the head stays visible. A browser test checks the head and some arena around it are on screen at 1,000,000.
- **Thick worms are harder to dodge in the 3600-radius arena** → Collision uses `(r + o.r) × 0.78`, so two giants collide when their bodies are about 460 units apart. The default arena is 7,200 across; a giant is not impossible to avoid, but the largest arena is more comfortable. Accepted; it is also a reason a giant is a juicy target.
- **Frame time with giants** → Covered by the existing massive-worm browser test (frames stay fast at 50,000); extend it to 1,000,000 with the player and a second giant on screen.
- **Older app versions cannot open a save that has an x10 worm or a mass above 1,000,000** → Acceptable; saves from older versions open fine here.

## Migration Plan

1. Land the change as one minor release (bump `VERSION` in `sw.js`). Nothing is added to `FILES`; no new game files.
2. Before the PR, once the starting giants and the size bonus are in: run `tools/balance.js` at the starting values on Easy, Normal and Hard (all three profiles, several seeds), compare the largest worm after 30 simulated minutes to the numbers today, and tune within the constants above. The bar: the largest bot passes 100,000 in most 30-minute runs on every level, passes 1,000,000 only rarely, and not regularly before the 20-minute mark; the stand-in player's survival time is not lower than today by more than a few percent.
   **Result** (final values: `GROWTH_POWER` 0.6 from 1,000, starting giants, boost cost 0.25% capped at 150, food 1/2/4/10; 30 simulated minutes, 30 bots, 6 seeds per row, stand-in profiles skilled and careful). Largest bot at the end: Easy 158,000 to 834,000, Normal 104,000 to 283,000, Hard 99,000 to 347,000, so 35 of 36 runs pass 100,000 and none passes 1,000,000 (the old rules: 11,000 to 34,000). Stand-in survival (median seconds), `main` then now, skilled: Easy 13.5 then 10, Normal 14 then 10, Hard 19 then 13; careful: Easy 20.5 then 15, Normal 21 then 16.5, Hard 23.5 then 22. **The survival bar (within a few percent) is missed**, by 21% to 32% except Hard careful (6%). With the giants switched off, skilled survival was Easy 10, Normal 12, Hard 14.5, so the giants cost little and the size bonus is the cause: every bot is bigger, so the stand-in meets deadlier bots. This is the intended effect of the change; the stand-in is a crude proxy (it dies within 10 to 25 seconds in every setup, `tools/balance.js` says so itself), so the shortfall is recorded and left for playtesting rather than tuned away, which would also cut the largest bots back under 100,000. Giants matter at the top: on Hard without them 5 of 6 runs end under 100,000.
3. No data migration. Rollback is a higher `VERSION` with the old constants; saves written meanwhile either load (mass ≤ 1e6, no x10) or are refused by the older engine's validator.

## Open Questions

- Starting values for `GROWTH_POWER`, `GROWTH_FROM`, `SHED_ABOVE`, `BOOST_COST_SHARE`/`BOOST_COST_MAX` and the food weights are estimates until the final balance run on every level, and may change by the numbers in the tests and specs without changing the approach.
