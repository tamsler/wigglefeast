# Design

## Context

`botThink(w, g)` in `engine.js` runs every `0.32 − 0.22·skill` s per bot. It has two stages:

1. **Goal**: wander point (weight 0.5) → best food by value ÷ distance (1) → first power-up in range (1.5) → prey cut-off point (2). Each later goal overrides the earlier ones. A prey is picked with chance `aggro × 0.2` per think: the nearest unshielded worm within `300 + 350·aggro` and lighter than `preyRatio ×` own mass. The bot aims at the prey's head plus `2r + 2r_prey + 0.6·d` along the prey's *current heading*.
2. **Heading**: `N = 2·round(4 + 6·skill) + 1` headings fanned around the current one, plus the goal heading. Each is checked at 4 points along a look-ahead line with `hitAt` (bodies in the segment grid, plus the arena edge). Score = `−danger + goalW·cos(off-goal) − 0.25·|turn|`.

Facts that shape the tactics:
- Running into your own body is harmless (`checkCollisions` and `hitAt` skip it). That is why coiling works.
- In a head-on collision the bigger worm wins: a head touching another's first 3 segments survives if its mass ≥ theirs.
- Turn rate is `5.4 / (1 + (r − 14)/45)` rad/s. At base speed 230 the turning radius is about 43 px (r 14) to 64 px (r 37), so bots can make tight circles.
- Bot state is saved as `{skill, aggro, interval, wx, wy, prey, huntUntil}` and validated strictly (`validateSnapshot`). Skill and aggro must stay in 0–1.
- After #16, `DIFFICULTY[level]` holds `skill`, `aggro`, `preyRatio`, `bigShare` and `bigMax`, and `tools/balance.js` reports survival, kills and bot sizes per level.

## Goals / Non-Goals

**Goals:**
- Each tactic is a small, separately testable function that `botThink` calls. A test can build a scene, run one think, and check the chosen mode and heading.
- No change to the world save format or its validation.
- Bot thinking stays well inside the simulation test's per-tick budget at 60 bots on Expert.

**Non-Goals:**
- Planning more than one think ahead (search trees, path planning), or shared team plans beyond "who hunts whom".
- Changing how the player's worm moves or collides.

## Decisions

### 1. Tactics are fixed per bot, derived from its id (not saved)
`DIFFICULTY[level].tactics` maps each tactic to the share of bots that know it. A bot knows tactic *k* when `hash(w.id, k) < share`. `hash` is a small integer hash that maps to [0, 1).

| tactic | easy | normal | hard | expert |
|---|---|---|---|---|
| predict (turn-aware cut-off) | 0 | 0.5 | 1 | 1 |
| anticipate (heads about to cross) | 0 | 0.3 | 0.7 | 1 |
| evade | 0 | 0.3 | 0.6 | 1 |
| headOn | 0 | 0.2 | 0.5 | 1 |
| scavenge | 0 | 0.3 | 0.5 | 1 |
| trap | 0 | 0 | 0.4 | 1 |
| pin | 0 | 0 | 0.4 | 1 |
| coil | 0 | 0 | 0.3 | 1 |
| flank | 0 | 0 | 0 | 1 |

Ids are saved, so a loaded bot keeps its tactics (spec: "A bot keeps its tactics") without new save fields.
*Alternative:* store a tactic bitmask in `ai`. That changes the save format, `validateSnapshot` and the v1 fixture handling, and an older release would reject such saves. Rejected.
*Alternative:* derive tactics from skill thresholds. That ties tactics to steering quality, so Hard couldn't have "some bots coil" independently of skill. Rejected.

The shares are starting values to tune with `tools/balance.js`. The spec only fixes which tactics each level can use.

### 2. Expert level
`expert: { skill: [0.85, 1], aggro: [0.6, 1], preyRatio: 2, bigShare: 0.25, bigMax: 3000, tactics: all 1 }`. Skill stays within 0–1, so saves stay valid. Expert is harder because of the tactics and the higher aggression floor, not through skill above 1 (which the formulas and validation don't allow). The name "Expert" is a placeholder the user can change before apply.

### 3. Observed turn rate, not intent
`Worm.update` keeps `w.turnRate`, an exponentially smoothed `Δangle/dt` (time constant ≈ 0.3 s) of the *actual* heading change. It is not saved and starts at 0 after load. Bots predict with it and never with `targetAngle`, which for the player is the pointer direction (spec: Fair information).

### 4. Path prediction helper
`predictHead(o, t)` moves a head along an arc for time `t` at its current speed and `turnRate`, clamped to ±π of total turn. Three users:
- **Cut-off** (predict): solve for the meeting time with 3 fixed-point iterations (`t = dist(me, predictHead(o, t)) / mySpeed`), then aim at `predictHead(o, t)` plus a lead of `2r + 2r_prey` along the predicted heading.
- **Anticipation**: once per think, gather heads within `L + 300` (at most 8, nearest first) and sample `predictHead(o, t)` at t = 0.25, 0.5, 0.75 s. In heading scoring, a sample point at distance `s` (reached at `s / mySpeed`) is in danger when it's within `rad + o.r` of a predicted head point the other head reaches *earlier*, because that point is body by the time we get there.
- **Evasion** threat test (below).

*Alternative:* treat other heads as moving discs to dodge. That misses the real danger, which is the body a head lays down behind it.

### 5. One mode per think, in priority order
`botThink` picks a mode and records it in `ai.mode` (transient, not saved; used by tests and the balance tool):
1. **evade**: some head within `250 + 150·skill`, closing in, with its predicted path passing within `3·r` ahead of our predicted path in the next second. Goal: the clearest of the sampled headings, away from the threat's path. Weight 3. Boost if mass > 60 and the threat is within 200.
2. **hunt** (existing prey): sub-mode chosen each think:
   - **coil**: prey mass ≤ 0.5× own, own body length ≥ `2π·R₀·1.3` with `R₀ = max(120, 4·r_prey + 2·r)`, and prey within 350. Orbit the prey's predicted head at radius `R`, which shrinks by 15%/s down to `2·r_prey + 2·r`. The heading is the circle's tangent plus a radial correction. The direction (`ai.coilDir`) comes from the cross product when the coil starts. Boost while coiling if mass > 150. Stop when the prey gets more than `1.5·R` from the centre (escaped) or `huntUntil` passes (hunts last up to 6 s while coiling).
   - **pin**: prey head within 450 of the edge and moving mostly along it (|radial component of heading| < 0.5). Aim at a point ahead of the prey on its predicted path, moved inward by `3·r_prey`, approaching from the inside so the wall is the prey's only way forward.
   - **flank**: another bot with the same prey is cutting from side `s` (sign of its lateral offset from the prey's heading). Aim at the cut-off point moved `4·r_prey` to side `−s`.
   - **cut** (default): cut-off point from decision 4 (or the old straight lead without `predict`). With `trap`, compare the cut-off moved −1, 0, +1 × `4·r_prey` sideways and pick the one where the prey has the fewest clear directions (see trap).
3. **headOn**: a head of a worm with mass < 0.85× own, within 220, coming towards us (angle between headings > 120°). Aim at its predicted head. Weight 2.5. While this mode runs, the first 3 segments of worms under 0.85× own mass don't count as danger in `hitAt`.
4. **scavenge**: `g.recentDeaths` (transient list of `{x, y, mass, time}`, kept 6 s) within `FR + 400`. Score = `mass / (d + 200)`. Go when the score beats the best food score. Weight 1.3. Boost if mass dropped > 300 and the remains are within 500.
5. Otherwise the existing power-up / food / wander goals.

Caution rules added during apply, after profiling bot deaths (most hunters that die are killed by their own prey, usually while boosting):
- Hunters that know `predict` boost only when the prey is more than `150 + 2(r + r_prey)` away and not heading toward them.
- Bots that know `anticipate` only start a boost if the boosted look-ahead (`1.6 L`) on the chosen heading is clear.
- Scavengers only go for remains no other worm's head is closer to. With every Expert bot racing to the same remains, scavenging alone added about 30 bot deaths a minute and kept bots small; switching it off one tactic at a time showed this.
- Tried and dropped: hunters giving up when the prey turns toward them. It didn't reduce deaths, and it cut cut-off kills on Hard by about 85%.

New prey is chosen as today. With `trap`, the bot instead scores up to 3 nearest candidates by `distance × (0.5 + freedom)`, where **freedom** is the share of 8 rays (3 points each, out to 250 px) from the prey's head that `hitAt` finds clear, ignoring the hunter itself.

### 6. Keep it all in `engine.js`
The tactics need `hitAt`, the grids, `DIFFICULTY` and the size curves, which are private to the engine's closure. A separate `bots.js` would need those exported, a new `<script>` tag, an entry in `FILES` in `sw.js`, and load-order care for `file://`. Tactics go in a clearly marked "Bot tactics" section next to `botThink`. Tests reach them through `botThink` plus `ai.mode`.

### 7. Difficulty list in one place
The engine exports `DIFFICULTIES = ['easy', 'normal', 'hard', 'expert']`. `main.js` uses it wherever it lists difficulties today: settings validation, profile run validation, `bestByDiff` defaults, and the stats tiles. `index.html` gains an "Expert" button. The stats grid uses the existing `.grid.four` class (2 columns on small screens). Profile `v` stays the same: `bestByDiff.expert` is optional and defaults to 0.

### 8. Measuring
`tools/balance.js` adds `expert` to its defaults and reports kills by the killer's `ai.mode` (including `body`, for kills by a worm that wasn't hunting). Acceptance (revised during apply, with the owner's approval): over both stand-ins together, the share of stand-in deaths caused by tactics and the number of bots hunting it rise from Easy to Expert, and Easy stays within noise of #16. Stand-in survival is not used: the stand-in mostly dies by running into bodies, so it survives *least* on Easy, where bots grow biggest. Measured at the end of apply (careful + novice, 6 × 8 min each): tactic share of deaths 15% / 28% / 43% / 56%, bots hunting it 0.03 / 0.07 / 0.15 / 0.18 (Easy / Normal / Hard / Expert). Whether Expert *feels* harder is for the playtest.

## Risks / Trade-offs

- [Bots get much better at surviving: less churn, so fewer corpses, slower growth and fewer free kills for the player] → compare bot deaths/min and top-bot size with `tools/balance.js`. Easy has no tactics and doesn't change. On Hard, lower the anticipate/evade shares if the arena gets too quiet.
- [Coiling and flanking feel unfair ("the bots gang up on me")] → bots treat the player like any other worm. Flanking is Expert-only, and coils time out after 6 s.
- [CPU cost of anticipation at 60 bots] → at most 8 heads × 3 points per think, gathered once per think. The simulation test's 25 ms/tick limit covers it, and the balance tool's ms/tick is checked on Expert with 60 bots.
- [Scavenging crowds bots at death sites, causing chain deaths] → it's intended to look like a feeding frenzy. If bots die there in bulk, tune the scavenging weight and boost threshold.
- [Forward compatibility: an older release (for example after a rollback) sees "expert"] → it falls back to Normal in settings, rejects an Expert world save (starting a new world, as with any invalid save), and drops Expert runs and the Expert best from the profile the next time it records a run. Rollbacks are rare and the loss is limited to Expert stats. This is noted in the PR.
- [Tests depend on randomness] → scenes give bots `aggro: 1` on Expert (all tactic shares 1) and repeat thinks until a mode is chosen, as the #16 prey-limit test does. Assertions check the mode and heading direction, not exact angles.

## Migration Plan

Ships as one minor release (VERSION 1.12.0 or the next free minor after #16). There's no data migration: existing worlds keep their difficulty, and their bots pick up tactics by id on load. Rollback means publishing the old code under a higher version (see the forward-compatibility risk).

## Open Questions

- Final tactic shares for Normal and Hard, set with `tools/balance.js` and a playtest during apply. They don't change the specs or tasks.
