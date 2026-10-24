# Proposal

## Why

Two attack ideas from the owner (tamsler/wigglefeast#150):

- **A worm busy coiling is a good target.** It circles one spot, keeps turning the same way, boosts, and its attention is on its prey. Today a bigger bot only coils it if it happens to be the nearest light-enough worm. In seeded Expert worlds (30 bots, 3 × 8 min), a bigger bot that could coil the coiler was in reach for 10% of all coiling time, and was already hunting it in a quarter of those moments. On Hard it's 3%.
- **Big worms are rarely attacked.** No bot goes after a worm heavier than its level's prey limit (2× its own mass on Expert, 1.6× on Hard), so a big player is safe from cut-offs in the late game. #110 deferred this as the "late-game threat" (#120). A smaller worm that shadows a bigger one, running alongside its body, can cut in at its head when a safe cut opens. It's also near when the big worm dies.

Measured today: worms of mass 1,000+ die about 20 times a minute in a 30-bot Expert world, with a smaller bot within 600 three times out of four. Being first to the remains is a small extra, not the point of shadowing.

## What Changes

- **New tactic: coil the coiler** (`overcoil`, appended to the tactic list). A bot that knows it, and also knows how to coil, prefers a worm that is visibly coiling a smaller one when it picks prey. It then circles the whole knot (coiler and its prey) from outside and tightens, instead of circling the coiler's head. The coiler's own loop is inside the new one, so it runs out of room.
- **New tactic: shadowing** (`shadow`, appended). A bot that knows it may pick a nearby worm *bigger* than its prey limit, up to 4× its own mass, and run alongside its body.
  - It cuts in at the big worm's head when a cut-off is in reach along a path it can actually take, clear of bodies, and never head-on.
  - It gives up after a while, or when the target pulls away.
  - At most two bots shadow the same worm at once.
  - The player is shadowed like any other worm.
- **Levels.** Hard: some bots know each tactic. Expert: every bot. Easy and Normal: none, and they play exactly as before.
- **Measurement.** `tools/balance.js` reports kills by shadowing bots (`shadow`) and coilers killed by a bigger coiling bot. A seeded before/after run on every level goes in the PR.

## Out of scope

- Other #120 ideas: committed attack phases, personalities, the smaller-cutter check.
- New prey limits for ordinary hunting. Only shadowing goes after worms above the level's prey limit.
- A cue for the player that a bot is shadowing them.
- The head shot for a coiled worm (#94).
- Anything saved: tactics come from the id hash, and shadow and knot state isn't saved.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `bots`: *Tactics by difficulty* adds the two tactics. *Fair information* lets bots know which worm another bot is shadowing, like hunting. New requirements cover coiling a coiler, shadowing, cutting in from a shadow, and the measured result.

## Impact

- `engine.js`:
  - `TACTICS` gets `overcoil` and `shadow` appended, with their shares in `DIFFICULTY.hard` and `DIFFICULTY.expert`.
  - In `botThink`: the prey choice (`pickPrey`) and coiling (`coilPrey`) handle coilers, and a new shadowing step picks and follows a big worm and hands over to the existing cut-off.
  - A shared helper for "visibly coiling" (with `coilCircle`).
- `tests/bots.test.js`: scene tests for each behaviour, fairness, limits, tactic order and unchanged levels.
- `tools/balance.js`: new kill causes.
- `README.md`: difficulty paragraph.
- `sw.js`: `VERSION` minor bump, no new game files.
- Saves: no change; `tests/fixtures/save-v1.json` keeps loading.
