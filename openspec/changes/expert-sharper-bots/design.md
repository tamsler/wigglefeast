# Design

## Context

How `botThink` (`engine.js`) works today, for a bot of skill `s` and radius `r`:
- **Re-planning:** every `ai.interval × rand(0.8, 1.2)` s, set in `Game.update`. `ai.interval = 0.32 − 0.22·s` is drawn at spawn and **saved per bot**, and validation requires it to be ≥ 0.05. At s = 1 that's 0.10 s.
- **Look-ahead:** `L = (80 + 240·s)·(boosting ? 1.6 : 1) + 3r`. Each candidate heading is checked at only 4 points, `SAMPLE_T = [0.15, 0.35, 0.62, 1]·L`, with danger weights `[12, 6, 3, 1.5]` and clearance `rad = r + 4 + 6·s`. The first hit ends the check. At s = 1 and r = 13 the gaps between points are about 72, 97 and 137 px. A thin body (detected within `rad + o.r` ≈ 32 px) can lie between the farther points without being seen.
- **Headings:** `N = 2·round(4 + 6·s) + 1` (21 at s = 1) spread over `π(0.6 + 0.35·s)`, plus the goal heading.
- **Heads:** up to the **8** nearest within `L + 300`. Evasion range `ER = 250 + 150·s`. Evasion fires on the **first** head whose predicted path crosses ours first and sets the goal at a right angle to that head's line (`goalW = 3`).
- **Randomness:** everything draws from the world's seeded `g.rng` (#100). Any extra or missing draw on a level changes everything after it, which is how "other levels unchanged" can be checked exactly.
- **Cost:** profiling a 30-bot Expert run shows `botThink` at about **19%** of `Game.update` time. About 7.6% of that is `hitAt` checks for headings. Grid rebuilds take about 8%. The current Expert tick is about 0.32 ms.
- **Data:** see the proposal. The stand-in player in `tools/balance.js` thinks as an Easy bot without tactics, so changes to Expert bots don't change the stand-in.

## Goals / Non-Goals

**Goals:**
- Sharpness as **settings of the difficulty**, read when a bot thinks, with each part switchable from `tools/balance.js --set` so it can be A/B tested.
- **Byte-identical behavior on Easy, Normal and Hard:** the same random draws in the same order, and the same arithmetic.
- At most about **25%** more ms/tick on Expert.

**Non-Goals:**
- Retuning Expert's skill, aggression, tactic shares, prey limit or starting sizes.
- Any change to the stand-in player in `tools/balance.js`.

## Decisions

### 1. A `sharp` block on Expert, absent elsewhere
`DIFFICULTY.expert.sharp = { think, look, dense, headings, sense, heads, escape }`. The starting values below get tuned in task 3.

| key | meaning | start | off |
|---|---|---|---|
| `think` | re-plan interval multiplier | 0.6 → **0.7** (final) | 1 |
| `look` | look-ahead `L` multiplier | 1.25 | 1 |
| `dense` | dense verification of the chosen heading (Decision 3) | 1 | 0 |
| `headings` | candidate count multiplier | 1.5 → **1.3** (final) | 1 |
| `sense` | evasion range `ER` and head-gathering radius multiplier | 1.4 | 1 |
| `heads` | max heads tracked | 12 | 8 |
| `escape` | multi-threat escape (Decision 4) | 1 | 0 |

`botThink` reads `diff.sharp`. When it's missing (every other level), every expression takes today's branch, with no multiplications by 1 and no added draws. `--set expert.sharp.think=1` already works because `balance.js` writes `DIFFICULTY[a][b][c]`.

*Alternatives:*
- **Raise Expert skill above 1.** Rejected: save validation caps skill at 1, skill also scales boost chances and food range (which changes more than sharpness), and saves with skill > 1 wouldn't load in older versions.
- **A new per-bot field.** Rejected: it would need saving, and loaded Expert worlds from before the change would lack it.

### 2. Faster re-planning at think time
`Game.update` sets `w.thinkT = w.ai.interval * (sharp ? sharp.think : 1) * rand(...)`, branched so other levels compute exactly as today. The saved `ai.interval` stays the base value, so validation and old saves are untouched, and a loaded Expert world gets the faster rate automatically. Floor: never below 0.04 s (about every 2–3 updates at 60 Hz). At s = 1 the start value gives 0.06 s.

### 3. Farther look-ahead, with dense verification of the winner
- `L` is multiplied by `look`.
- Candidates are scored as today with the 4 sparse points, which keeps the cost near today's per candidate.
- When `dense` is on, the candidates are visited best score first. The top one is checked at points spaced **at most 2·rad apart** along the whole `L`. Any point on the path is then within `rad` of a check, so a body segment crossing the path is detected (detection radius `rad + o.r`).
- If the dense check finds a hit, that candidate's danger is set from the interpolated weight at the hit's fraction of `L` (piecewise-linear through today's `(SAMPLE_T, SAMPLE_W)` points), it's re-scored, and the next best is tried. At most 4 dense checks per think; after that the best re-scored candidate wins.

*Alternative:* dense sampling for every candidate. Rejected: about 3–4× the heading-check cost, which would blow the budget on its own.

### 4. Multi-threat escape
With `escape` on, evasion doesn't stop at the first threat. Every head in range whose predicted path crosses ours (the existing `EVADE_T` test) counts as a threat, with range `ER × sense`, still scaled by wariness for readers (#83).
- **Goal:** the direction of `Σ (today's sideways escape from that threat's line, as a unit vector) / d`, so nearer threats weigh more. With one threat this is exactly today's escape. *(Changed during implementation: the first draft summed "away from the threat's predicted head", which would have changed the single-threat case for no measured gain.)* `goalW = 3`, `mode = 'evade'`, and the boost rule is unchanged.
- **Obstacles:** each threat's predicted head positions at `EVADE_T` (radius `o.r + r`) join the candidate check as obstacles. Unlike anticipation's ghosts, these don't depend on who gets there first. So the chosen heading must clear every threat's path, not just aim away from the centroid.
- Readers still record a grudge per threatening worm, at most once per second each (#83).
- If the summed escapes nearly cancel (cutters on opposite sides), the goal falls back to the nearest cutter's escape. That happens when `|Σ| · d_nearest < 0.25`. *(Added in review.)*

*Alternative:* keep the first threat but pick its side by clearance. Rejected: it's still blind to a second cutter, which is exactly the scenario the spec names.

### 4b. Head-on targets don't block their own approach (added during implementation)
A bot going head-on already ignores the target's first 3 segments, since the bigger worm wins head-on. With Expert's longer look-ahead and close checks, the rest of the target's body (trailing behind the oncoming head) started to block the heading straight at the head. Sharp bots pushed their aim about 0.4 rad off, so they missed. A sharp bot going head-on now ignores two parts of the target: its body beyond the head's distance, and the stretch right behind the head (`ceil(2·(rad + r) / spacing)` segments, about 100 px). Any other part of the target, such as a loop of its body across the approach, still counts. The first draft ignored the whole target; the review caught that. The bot re-plans every ~0.07 s and only keeps the head-on goal while the target still comes straight at it. Other levels keep today's check.

### 5. Bigger worms on Expert
Expert's `bigShare` goes from 0.25 to **0.35** and `bigMax` from 3000 to **5000** (starting values). This uses the existing spawn code, so the number of random draws doesn't change, and other levels are untouched. In the Decision 6 arms it counts as one more part ("big"; off = 0.25 / 3000), switched with `--set expert.bigShare=…,expert.bigMax=…`.

*Alternative:* bigger bots throughout the game, by growing respawned bots too. Rejected: respawns at mass 15–40 keep the population turning over. Big bots from the start, plus sharper bots that live longer and grow, give the same pressure without breaking that.

### 6. Measure each part; keep only what helps
- **Arms:** baseline (all `sharp` parts off and today's big-worm settings, which equals today's Expert), all parts on, and each part (including "big") switched off on its own.
- **Runs:** `tools/balance.js --diff expert --profile careful,skilled --minutes 4 --runs 12 --seed <S>` with the same seeds for every arm (paired). Also two baseline runs on different seeds, to see the noise.
- **Metrics:**
  - *careful:* survival median and peak median.
  - *skilled:* deaths per minute alive.
  - *bots:* deaths per minute from `body`, and deaths caused by the player.
  - ms/tick.
- **Keep a part** when switching it off makes the careful survival or peak worse than the noise band. Drop it (and its code) when it doesn't.
- **Gate:** if all parts together don't bring Expert / careful survival and peak median down to Hard's on the same seeds, stop and report the numbers to the owner before merging. The likely next lever is hunting bigger worms (out of scope).

### 7. Outcome of the measurement (added after task 3.1)
- **The stand-ins couldn't tell.** On two seeds × 12 runs × 4 min, Expert with everything on vs before gave careful-stand-in deaths per minute alive of 0.92 vs 0.80, and skilled 2.36 vs 2.24. Seed-to-seed noise for one setting is up to ±0.25. Switching single parts off moved the numbers both ways with no consistent pattern. Bot deaths from bodies barely changed: every bot got sharper at once, so better attackers and better dodgers cancel out. Hard's careful stand-in: 1.05.
- **The balance-tool gate didn't hold up.** "Expert / careful at or below Hard" was already roughly true before the change: with 12 runs, the issue's 234 s survival turned out to be noise from a 6-life sample. The stand-in also doesn't play like a person, and rarely tries the cut-offs the owner found too easy. The spec scenario that relied on it became *Expert start*.
- **Owner's playtest decided:** "it's better". All parts are kept as playtested.
- **Tick budget:** with everything on, the cost was +29% at 30 bots and +34% at 150 bots, both over budget. The owner chose to trim: `think` 0.7 and `headings` 1.3 give +20% at 30 bots (0.33 → 0.40 ms) and +23% at 150 bots (1.92 → 2.37 ms). Measured one at a time, nothing else running.

## Risks / Trade-offs

- **[Sharper bots alone may not close the gap.]** A careful player may still grow safely, since nothing hunts a worm more than 2× a bot's mass. → The Decision 6 gate stops and reports to the owner. The follow-up is already named in the proposal.
- **[Big worms feed the player.]** A large bot that dies leaves a lot of food. → Measured: the "big" arm is kept only if careful survival and peak drop.
- **[Tick cost.]** Re-planning 1.67× as often with 1.5× the headings is an estimated +19% on its own. Bots that live longer also grow larger, which means more segments. → Dense checks only on the winner, ms/tick is measured in every arm, and `think` and `headings` get tuned down first if it runs over.
- **[Bots look twitchy]** when re-planning faster. → Turning is still limited by `turnRate`, so heading changes stay smooth. Check by eye in a playtest.
- **[Noise hides small effects]** (±8 per 120 encounters in #94). → Paired seeds, 12 runs per arm and a measured noise band. Parts with no clear effect get dropped rather than argued for.
- **[An accidental change to other levels]** through a shared helper or an extra random draw. → A seeded before/after report diff on Easy, Normal and Hard, plus an engine test.

## Migration Plan

- No data migration: saves are unchanged, and Expert sharpness applies to loaded worlds.
- Ships as a minor `VERSION` bump. Rollback is a revert released under a higher version.

## Open Questions

- The final numbers in Decision 1's table. Task 3 sets them; they don't change the approach or the specs.
