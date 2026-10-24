# Design

## Context

- **Bot brain** (#153): `botThink` runs steps in order on one plan object `t`: `seekFood`, `seekPowerups`, `gatherHeads`, `seekRemains`, `seekHeadOn`, `pickPrey`, `chasePrey` (→ `coilPrey` / `cutOff`), `noticeCoil`, `evadeCutters`, `planGhosts`, `steer`. Later steps override earlier goals. The `g.rng()` draws must stay in the same sequence for any bot whose tactics don't change, so that Easy and Normal worlds replay identically.
- **Prey choice** (`pickPrey`): on a roll of `aggro × 0.2`, the candidates are worms lighter than `preyRatio × mass` (Expert 2, Hard 1.6) within `300 + 350·aggro`. A grudge comes first, then `trap` (fewest ways out), then the nearest.
- **Coiling** (`coilPrey`): prey at most half our mass, a body long enough (`lengthFor(mass) ≥ 2π·R0·1.3`), and close. The bot circles `predictHead(prey, 0.3)` at a radius shrinking by 0.85 per second from `R0 = max(120, 4·r_prey + 2·r)`.
- **Visible circling** (`coilCircle`, #94): from `turnRate` (at least 1.2 rad/s) and speed, `ρ = speed / |turnRate|` (at most 500), with the centre on the turning side. Coil escape uses it to tell when a bot is being circled itself.
- **Cut-off** (`cutOff`): aims at `cutPoint` with pin, flank, learning or trap shifts. Anticipation ghosts already let a bot cross a head's path ahead of that head, since `ghostHit` skips points the head reaches later than we do.
- **Measured** (see proposal): on Expert, a coil-capable bigger bot is in reach for 10% of coiling time. Big-worm deaths are frequent, with smaller bots nearby.

## Goals / Non-Goals

**Goals:**
- Shadowing uses only visible signals. Its random draws happen only for bots that know it, so Easy and Normal replay identically.
- Shadowing is a careful attack: run alongside, cut in only when a reachable, clear, in-time cut exists, and never go head-on with a bigger worm.

**Non-Goals:**
- Changing ordinary prey limits or hunting. Only a shadow's cut-in goes after a worm above the prey limit.
- Committed multi-phase attacks (#120). A cut-in is an ordinary short hunt.

## Decisions

### 1–3. Coil the coiler (built, measured, removed)
The first version added three things:
- `knotOf(g, o)`: a worm's turn circle with the head of a worm of at most half its mass inside it.
- A preference for such worms in `pickPrey`.
- Circling the knot in `coilPrey`: centred on the coiler's circle, starting at `knot.rho + o.r + 2r + 20`, and shrinking at 0.85 per second down to the coiler's own circle.

It needed a 0.5 s hold on the knot. Without it, the coiler's wobbling turn restarted the circle at full size, and it never tightened. With the hold, scene tests showed the bot staying outside the knot and tightening.

In seeded Expert worlds (6 × 8 min), coilers killed while coiling by a coiling bot went from 11 to 8. With chances in only about 10% of coiling time, coils lasting about 6 s, and laps round a knot taking about 4 s, it can't show an effect. The owner chose to drop it, and the code and tests were removed.

### 4. Shadowing: picking a target
A new step, `seekShadow(t)`, runs after `pickPrey` and before `chasePrey`. It runs only for a bot that knows `shadow`, with
- no prey,
- no meal (`t.meal === 0`),
- `mode` not `headOn`,
- `w.mass > 30`,
- no current shadow,
- and a roll of `g.rng() < aggro × 0.1`.

Candidates must
- be alive and unshielded;
- weigh more than `preyRatio × mass` and at most `4 × mass`;
- be within 600;
- have fewer than two other bots shadowing them (`ai.shadow === o`, coordination as for hunting);
- for readers, not be a worm they saw kill (`kills ≥ SEEN_MIN`).

The bot takes the nearest and sets `ai.shadow = o`, `ai.shadowUntil = time + 15`. Neither is saved.

### 5. Shadowing: following
While shadowing, `seekShadow` drops the target if
- it's dead,
- its time is up,
- it's more than 900 away,
- or we got prey or a meal.

Otherwise it steers for a point beside the target's body:
- along its body, about `3·(o.r + r) + 60` behind its head;
- `o.r + r + 50` out to the side we're already on, judged from its heading.

Goal weight 1.6, mode `'shadow'`, no boost. Evasion and coil escape come later and override it, so danger still comes first. Body checks keep it off the target's body.

### 6. Shadowing: cutting in
Each think while shadowing, the bot cuts in when all of these hold:
- our head is within 350 of the target's head;
- we're not in front of it: `(our head − its head) · its heading < 2·o.r`;
- our heading is within 60° of its heading;
- the cut point `cutPoint(w, o, predict)` is reachable along `reachPath` with no body hit (bodies and the wall, `hitAt` at a `2·rad` step);
- we arrive at least 0.1 s before its head would (our path length ÷ our speed, against its distance ÷ its speed). The bot tries normal speed first, then, if it can afford a boost (mass over 60), the boosted path. At equal speed, a bot beside the head can only win this race from a narrow band ahead of the head, so most cut-ins are boosted, as ordinary cut-offs are. A boosted cut sets `ai.shadowBoost`; `cutOff` then boosts, and `steer` checks the boosted path again (decision 6's boost rule applies to every cut from a shadow, on any level).

Then it hands over to the existing cut-off: `ai.prey = o`, `ai.huntUntil = time + 2`, `ai.fromShadow = true`, and the shadow ends. `chasePrey` → `cutOff` steers the cut next. Prey limits only apply when picking prey, so the hunt continues.

`endHunt` clears `fromShadow`. Cut modes stay `cut`, `pin`, `flank` and so on, so habit learning and its tests see a normal cut-off.

*Alternative:* a separate "shadow cut" steering. Rejected: the cut-off already handles prediction, pinning, flanking and learning.

### 7. Tactic table
Append `shadow` to `TACTICS` (index 12). Shares: Hard 0.4, Expert 1, others 0. A test pins `TACTICS.slice(0, 12)` and the earlier tactics' masks for ids 1–40.

### 8. Measuring
`tools/balance.js`:
- `cause()` reports `shadow` for a kill by a bot in `shadow` mode or with `fromShadow`;
- it adds one line: bots that died while shadowing.

The PR shows the before/after report on the task-1 seed for every level. The ship gate is the spec's *Shadowing works*:
- on Hard and Expert, `shadow` kills appear;
- bot deaths per minute stay within about ±10% of before;
- easy and normal are identical apart from ms/tick.

If shadowers die clearly more, tune the side distance and the cut-in conditions before shipping; if that doesn't help, go back to the owner.

## Risks / Trade-offs

- [Shadowers get cut off by their big target] → the side offset, evasion first, giving up after 15 s, and the shadower-death line in the balance report.
- [Big players feel hounded] → at most two shadowers per worm, a 15 s limit, a roll of `aggro × 0.1`, and cut-ins only when clear and in time. The stand-in player's deaths in the balance report show the effect, and a playtest decides.
- [Cost] → the shadow pick runs only on its roll; following is one segment lookup and the cut test a handful of `hitAt` calls per think for shadowers.

## Migration Plan

One minor release (1.26.0). Nothing new is saved. Rollback is a later version with both shares set to 0; the tactic indices stay reserved.

## Open Questions

- The exact side offset, cut-in distance, roll rate and give-up time get tuned with the balance tool during apply. Their values don't change the spec or the task list.
