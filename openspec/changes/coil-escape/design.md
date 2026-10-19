# Design

## Context

- **Coiling** (`botThink`, #78): the coiler circles its prey's predicted head at radius `R`, which shrinks from `max(120, 4·r_prey + 2·r)` toward `2·r_prey + 2·r`. It boosts if its mass is over 150. Its body forms the loop, and its observed `turnRate` (smoothed actual turning, #78) is high and steady while it circles.
- **What a bot sees:** each think, a bot gathers up to 8 nearby heads (within `L + 300`), and `predictHead(o, t)` extrapolates a head along its observed arc. `freedom(g, o, hunter, 0)` gives the share of 8 directions clear for 250 units around a head.
- **Evasion** turns perpendicular to a threat's line, which inside a loop often points into the loop.
- **Tactics** are drawn by a hash of the bot id and the tactic's index. New tactics are appended (as `read` was in #83).
- **Baseline:** 40 coils of a 120-mass Expert bot (all current tactics) by a 3,000-mass coiler, 6 s each. The prey died in 11, escaped in 29, and the coiler died in 0.

## Goals / Non-Goals

**Goals:**
- A circled bot that knows `escape` actively tries to kill its coiler, or at least get out, using only visible information.
- Cheap: the extra work only runs when a candidate coiler is near.

**Non-Goals:**
- Perfect escapes. It should be a fair fight, not a guaranteed win.

## Decisions

### 1. Detecting a coil (visible signals only)
A head `o` among the gathered heads is a **coiler** of bot `w` when all of these hold:
- `o.mass ≥ 1.5 × w.mass` (clearly bigger)
- `|o.turnRate| ≥ 1.2` rad/s (turning steadily; coilers turn at about 1.5–3 rad/s)
- its turning circle (radius `ρ = o.speed / |o.turnRate|`, centre `c` a distance `ρ` to its turning side) is no larger than `ρ ≤ 500` and centred near `w`, with `|c − w.head| < 0.6·ρ`
- `w`'s head is closed in: `freedom(g, w, null, 0) ≤ 0.5`. The freedom check only runs once a candidate passes the cheaper tests.

It never reads `o.ai` (spec: *Only what's visible*).

### 2. Counter-cut
For `t` in `[0.2, 0.35, 0.5, 0.65, 0.8]` s:
- take `P = predictHead(o, t)`, the coiler's head position `t` from now
- our time to reach it is `τ = |P − w.head| / s`, where `s` is the boost speed if `w.mass > 40` (we'll boost) and the base speed otherwise
- the first `t` with `τ ≤ t − 0.1` wins: we get there with a 0.1 s margin, so our body lies across the coiler's way when its head arrives

Then:
- set the goal toward `P`, with weight 3.5 (above evasion's 3)
- set `mode = 'escape'`, `ai.aim = P`, `boost = w.mass > 40`
- set `ignore = o`, so anticipation doesn't treat the coiler's predicted path, which we mean to cross first, as an obstacle

The ordinary body-danger check still applies to every heading, so we won't steer into the loop itself.

### 3. Gap fallback
If no `t` works, look along 16 directions. For each, take the distance (up to 400) to the first body hit (the coiler and other worms, using `hitAt` at 50-unit steps). Head for the most open direction with weight 3.5 and `mode = 'escape'`, boosting if mass allows.

### 4. Priority
The escape check runs after hunting and before ordinary evasion, and overrides both. A circled bot has nothing better to do. `heads` is gathered when the bot knows `escape` as well (today it's gathered only for anticipate, evade and headOn).

### 5. Tactic table
Append `escape` to `TACTICS`. Shares: easy 0, normal 0, hard 0.5, expert 1. Existing bots' tactics don't change, because the hash uses each tactic's index.

## Risks / Trade-offs

- [False positives: a big worm turning near a bot in a crowd] → all four conditions must hold, including being boxed in and the turning circle centred on the bot. Engine tests cover a passing worm and a worm circling elsewhere.
- [Crossing ahead of a bigger head can end in a head-on loss] → the cut needs a 0.1 s margin. The head-on rule only applies to the first 3 segments, which the coiler's head reaches after we've passed.
- [Escaping bots make coils pointless on Expert] → measured with the repeated-encounter test and `tools/balance.js`. The aim is a fair fight: fewer coil kills, some coiler deaths, coils still dangerous.
- [Cost] → the coiler test is a few arithmetic checks per gathered head. `freedom` and the counter-cut only run for an actual candidate.

## Migration Plan

Ships as one minor release. Nothing is saved, so nothing to migrate.
