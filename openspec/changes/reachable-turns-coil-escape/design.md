# Design

## Context

- **Steering** (`Worm.update`): each tick the heading turns toward `targetAngle` by at most `turnRateFor(r) · dt`. That's ×0.85 while boosting and ×2 with the tight-turn power-up. There's no turning momentum, so a worm turns at full rate the shortest way until it faces the target, then goes straight. Speed is `BASE_SPEED`, ×1.25 with the speed power-up and ×2.1 while boosting.
- **Turning circles**: a mass-120 worm (r ≈ 18.3, 4.93 rad/s) turns on a radius of about 47 at normal speed and about 115 while boosting. An Expert bot's probe radius is r + 10 ≈ 28. So for a 90° turn, the straight line and the real path are farther apart than the probe is wide.
- **Heading choice** (`botThink`): N candidate headings within ±`spread` of the current heading, plus the goal. Each is probed by `blocked()` at four distances along a straight line (`SAMPLE_T × L`). Sharp bots then check the best clear headings closely, every `2·rad` (#110, #118). Anticipating bots also check the chosen heading as a straight line out to `1.6·L` before boosting.
- **Coiling** (#78): the coiler circles the prey's predicted head on a shrinking radius and boosts above mass 150. A boosting coiler can't hold the radius it aims for (about 150 against a target of 102–138), so there is room inside the loop.
- **What the parked prototype taught** (#94, branch `coil-escape-94`): boosting inside the loop kills the trapped bot. A dash across the coiler's path lands in the next, older loop. Bot coilers never die, because every bot scores headings against bodies. Results are noisy (about ±8 per 120 encounters). And a hand-built static spiral passed unit tests while real play got worse.
- **Saves**: only `skill, aggro, interval, wx, wy, prey, huntUntil` of `ai` are saved, and tactics come from `hash01(id, index)`. New per-bot state is never saved.

## Goals / Non-Goals

**Goals:**
- Reachable paths that turn off completely: with them off, the code takes exactly today's straight-line checks, so Easy and Normal (and Hard bots without the tactic) don't change.
- Coil-escape work only runs for bots that know the tactic and have a coiler candidate nearby.
- Measured success against live coils, not static scenes.

**Non-Goals:**
- Simulating re-planning, other worms' reactions or food inside the look-ahead. The path is our own turn-then-straight move, checked against bodies where they are now (and the ghosts/threat paths that already exist).
- Making coilers die. The aim is the trapped bot surviving (see decision 4.2).

## Decisions

### 1. Reachable path: closed-form turn, then straight
`reachPath(w, a, boosted)` describes the move toward heading `a`, and `reachAt(path, s)` returns the point at path distance `s` along it:
- `Δ = angleDiff(w.angle, a)`. The turn rate is `ω = turnRateFor(w.r) · (boosted ? 0.85 : 1) · (w.pw.turn > 0 ? TURN_POWER_MULT : 1)`. The speed `v` comes from the power-ups and `boosted`. The turn radius is `k = v / ω` and the arc length is `s₁ = k·|Δ|`.
- For `s ≤ s₁`, the point is on the arc at turn `θ = sign(Δ)·s/k`, using the same formula as `predictHead`. Beyond that, it's the arc's end plus `(s − s₁)` along `a`.
- `reachPath` computes `Δ`, the turn side, `s₁` and the arc's end once. Each `reachAt` is then one `sin`/`cos` on the arc, or a multiply-add on the straight part. It's measured against `Worm.update` to within 8 units, because the game turns in 1/60 s steps.

The time to a point is still `s / v`, so the ghost timing in `blocked(px, py, t, speed)` works unchanged.

*Alternatives:* stepping the move tick by tick costs about 30× more for the same answer, since there's no turning momentum. Widening the probe radius instead would close off narrow gaps that are reachable.

### 2. Where the path is used
- **Before boosting** (Expert, `sharp.reach > 0`), the bot checks its chosen heading along the *boosted* path out to `1.6·L`, at the close step. It does this whether or not it's boosting already, not only for anticipating bots. If the path is blocked, `wantBoost = false`. This covers the spec's *Turning wider while boosting* scenario. Bots without reach keep today's straight two-point check.
- **Circled bots** that know `escape` use the same boosted-path check before any boost (*No boosting inside a coil*), whatever their level, and judge the *out* move along reachable paths (decision 4).
- **Candidate headings stay straight lines** for every bot. The sample points and the close check are unchanged, and so is `L`.

*Measured and rejected during apply:* judging every candidate heading along its normal-speed reachable path (the first version of this decision). On the task 1.1 seed, Expert bot deaths per minute fell from 71–73 to 20–22, and kills by cut-offs from about 170 to about 10. The top bot's median mass rose from about 5,200 to about 9,000, and ms/tick from 0.40 to 0.49. In `tools/coil.js` the trapped bot died more often: 35% → 50% against a bot coiler. Inside a loop, a bot survives by turning continuously, and a single "turn, then straight" path ranks those moves worse. The boost check alone cost Expert bot deaths about 13% (62–64 per minute) and changed nothing in coils.

Candidates lie within ±0.95π of the current heading, so the shortest turn, which the model assumes, is also the way the worm will turn. The goal candidate can lie outside the spread, but `angleDiff` still picks the shortest way, as `Worm.update` does.

### 3. Noticing a coil (visible signals only)
Bots that know `escape` gather `heads` too (today only `anticipate`, `evade` and `headOn` bots do). A head `o` is a coiler candidate when:
- `o.mass ≥ 1.5 · w.mass`;
- `|o.turnRate| ≥ 1.2` rad/s and its circle `ρ = o.speed / |o.turnRate| ≤ 500`, centred at `c`, a distance `ρ` from its head on its turning side;
- our head is inside that circle: `|c − head| < ρ − o.r`. The prototype required `< 0.6·ρ`, which a bot hugging the edge would break.

Then the costly test: `freedom(g, w, null, 0) ≤ 0.5`. A bot that passes counts itself circled and keeps `ai.circledBy = o` until `g.time + 0.5`, so one wobble in the coiler's turning doesn't flip it in and out. It drops this early if `o` dies or its head moves more than `2·ρ` away. `ai.circledBy` and its end time are not saved, like `remainsIn`.

Detection reads only `mass, turnRate, speed, r`, head positions and bodies, never `o.ai`. It draws nothing from `g.rng`.

*Alternative:* reading `o.ai.mode === 'coil'` breaks *Fair information* and wouldn't work against the player.

### 4. Escape moves, in priority order
The escape check runs after hunting and before evasion. While circled, a bot ends any hunt (`endHunt`), skips head-on and evasion, and leaves the coiler out of anticipation ghosts (not through `ignore`, which would also make sharp bots skip part of its body). Other worms' ghosts still count. `mode = 'escape'`, and `ai.escape` is `'out' | 'hug'` for tests and tools.

1. **Out.** Among the candidate headings, take those whose normal-speed reachable path is clear at the close step out to `L`, and whose end point lies outside the loop (`|p − c| > ρ + o.r + r`). Pick the one closest to the current heading. Goal weight 3.5. If its boosted path out to `1.6·L` is also clear and outside, `boost = true`. Then the ordinary heading choice picks the goal. Its straight-line check doesn't overrule a goal the reachable check has already cleared, because the goal candidate's danger is taken from this check while escaping.
2. **Head shot (built, measured, removed).** For each candidate, the bot walked its path against the coiler's predicted head `predictHead(o, t)` for `t` up to 1 s. It went for the earliest point it could cover at least 0.15 s before the head got there, along a clear path, with its own head staying `(w.r + o.r)` from the coiler's head. In `tools/coil.js` about a fifth of encounters tried a shot and none landed, even against a coiler blind to every body (median miss about 60 beyond lethal range). A coiler steers round its prey's *head*, so when the prey crosses its path, the coil moves with the prey and the head leaves the predicted arc. Variants made no difference: 0.1–0.2 s margins, a looser head clearance, a 1.5 s window, committing to a shot, and only taking shots that land within 0.3 s. Without the move, survival stayed within noise (Expert vs bot coiler: 15% with it, 19% without, about 1.3 standard errors). It's out of this change; #94 keeps the idea.
3. **Hug.** Circle the centre `c` the way the coiler turns (`dir = sign(o.turnRate)`) at the target radius `ρₕ = max(minTurn, ρ − o.r − w.r − m)`. `minTurn` is our normal-speed turning radius and `m = w.r` is the clearance. Steer with the same formula coiling uses: `goal = φ + dir · (π/2 + clamp((dist − ρₕ)/ρₕ, −0.5, 0.8))`. Goal weight 2.5. The ordinary straight-line heading check keeps the head off the coiler's body. Re-planning several times a second makes that a continuous turn, which survives a loop better than a single turn-then-straight path (decision 2).

Whatever move is taken, `boost` is false unless move 1 set it. This overrides every other reason to boost.

*Why hug the same way round:* going against the coiler's direction meets its head often, and head-ons are lost. Going the same way, the coiler's head comes up from behind, slowly, at the difference of the two speeds.

*Alternatives tried and measured in #94:* a dash without reachable paths (worse while boosting, even without), and running alongside then cutting outward (no better). Both are kept as arms of the measurement tool for comparison.

### 5. Tactic table
Append `escape` to `TACTICS` (index 11). Shares: hard 0.5, expert 1, others 0. `DIFFICULTY.expert.sharp` gets `reach: 1`. Existing bots keep their earlier tactics, because the hash uses each tactic's index. A test pins `TACTICS.slice(0, 11)`.

### 6. Measuring: `tools/coil.js`
- `encounter({ seed, coiler: 'bot' | 'scripted', arm, prey, dist })` builds a two-worm world in the default 30-bot arena (Game with `opts.seed`, no food, no power-ups, no respawns). It places a mass-3,000 coiler about 400 from a mass-120 prey, on the prey's front half and clear of its body, with a seeded angle and heading. Worm ids are seeded too, so Hard prey get varied tactics. It runs up to 6 s.
  - The **bot coiler** is an ordinary bot of the prey's level, given the prey to hunt. At this distance its baseline (about a third of prey killed) matches #94's.
  - The **scripted coiler** steers each tick by the coil formula around the prey's predicted head and boosts like a coiling bot. It steers around the prey's body but not its newest 0.3 s of body, like a person reacting late. A coiler that ignored bodies entirely ran into the prey's tail in most encounters.
  - The result is `'prey' | 'coiler' | 'free' | 'held'`. `'free'` means the prey is alive at the end with `freedom > 0.5`.
- The CLI runs `--n 300` encounters per arm. The arms are baseline, reach only, and reach + escape. It prints counts with 95% intervals, and `--seed` replays a run. It's exported for tests, which run a small fixed batch. (The two #94 strategies aren't rebuilt as arms. #94 has their numbers.)
- `tools/balance.js`: `cause()` reports `escape` when the killer's `ai.mode === 'escape'`.

### 7. Ship gate
Coil escape ships only if the tool shows the spec's *Coil escape works* outcome with intervals that don't overlap the baseline. If it doesn't, stop and go back to the owner. Reachable paths alone could then ship if Expert's balance report holds, but that's a re-plan, not a silent cut.

## Risks / Trade-offs

- [The escape still doesn't beat doing nothing, as in #94] → the gate in decision 7, 300+ encounters per arm, and live coils only. The reach-only arm is the baseline the escape arm has to beat.
- [The boost check makes Expert bots harder to kill] → measured as mild (bot deaths per minute about 13% lower, top bot a little bigger). The PR records the before/after balance report on the same seed.
- [Frame time] → the boost check adds about 13 grid queries to a think that boosts. The escape check runs only for circled bots: about 27 candidate paths checked closely out to `L`. The 150-bot test must stay under its 25 ms limit, and the PR lists ms/tick before and after (0.40 → 0.41–0.42 for the boost check).
- [False "circled" in crowds] → four conditions, including `freedom` and our head inside the coiler's circle, plus tests with a straight-passing worm, a worm circling far away and a loose loop.
- [Hugging too close kills the bot] → clearance `m = w.r` on top of the probe radius, with the reachable check as the final guard. A test checks that the hugging bot survives a few seconds inside a held loop.

## Migration Plan

One minor release (1.25.0). Nothing new is saved, and old saves load with the same bots and tactics. Rollback is a later higher version that sets the `escape` shares and `sharp.reach` to 0. The tactic index stays reserved.

## Open Questions

- The hug clearance and the goal weights can be tuned later with `tools/coil.js`. Their values don't change the spec or the task list.
