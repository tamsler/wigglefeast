# Proposal

## Why

Bots judge each candidate heading as a straight line from the head, but a worm can't turn instantly. A mass-120 worm turns on a circle of radius about 47, and about 115 while boosting. A heading that is clear as a straight line can be one the bot can't reach, or reaching it can mean swinging through a body (tamsler/wigglefeast#149).

This is also why the first coil-escape attempt failed (tamsler/wigglefeast#94). A trapped bot dashing across the coiler's path while boosting died more often (45–48 of 80 encounters) than one that did nothing (25–42 of 120). It turned too wide and ran into the next loop of the coil. A circled bot should get out, or at least not be squeezed to death. It can only do that safely if it judges its moves by the path it can actually take.

## What Changes

- **Reachable paths.** A *reachable path* is the move a worm can really make toward a heading: turn toward it at its own turn rate (slower while boosting, faster with the tight-turn power-up), then go straight. Two things use it:
  - **Boosting** (Expert sharpness). Before boosting, an Expert bot checks the path the boost would really take, which turns wider. If a body lies on it, the bot doesn't boost.
  - **Coil-escape moves** (below), on any level.

  Bots still judge candidate headings along straight lines. Judging them along reachable paths was built and measured during apply. Expert bot deaths fell by about 70%, the top bots grew to nearly twice the mass, and trapped bots died more often in coils (35% → 50%). The boost check alone is mild (Expert bot deaths about 13% lower) and makes no difference in coils.
- **New tactic: coil escape** (`escape`, appended to the tactic list). A bot that knows it notices when it is being circled. Its own head is closed in, and a clearly bigger worm nearby is turning steadily around it. The bot sees this only from positions, sizes and observed turning. While circled it:
  - **hugs the inside edge** of the loop, turning the same way as the coiler, with its head just clear of the coiler's body. It uses the room inside the loop instead of being squeezed into the middle. It keeps circling, which a single "turn, then go straight" path can't describe, so hugging steers the way coiling does and keeps the usual heading checks;
  - **slips out** when a reachable path leads clear of the loop;
  - **doesn't boost inside the loop**, unless the boosted path is clear all the way out.
- **Levels.** Hard: half the bots know coil escape. Expert: every bot. Easy and Normal: none. Easy, Normal and Hard bots without the tactic play exactly as before.
- **No head shot.** A head shot (crossing just ahead of the coiler's head so it runs into the trapped bot's body) was built and measured. None landed, because a coiler steers round its prey's head: as the prey crosses, the coil moves with it. Dropping the move left survival within noise, so it was taken out, and tamsler/wigglefeast#94 stays open for a new approach.
- **Measurement tool.** `tools/coil.js` runs many seeded coil encounters. There are two coilers: a bot, and a scripted coiler that reacts late to bodies cutting across, like a person might. It reports prey deaths, escapes and coiler deaths, with and without the tactic and reachable paths.

## Out of scope

- The other ideas in tamsler/wigglefeast#120: committed attack phases, hunting much bigger worms, bot personalities, and the check on smaller cutters.
- The head shot (see above; tamsler/wigglefeast#94 keeps it).
- Judging every candidate heading along reachable paths (measured and rejected, see above; the numbers go on tamsler/wigglefeast#149).
- Reachable paths for aiming a hunt (`cutPoint`, intercept timing).
- Changing how bots coil: boosting less to circle tighter, and accounting for power-ups (raised in #94's W2 note). That's a separate balance change.
- A cue telling the player they are being circled.
- Anything saved: tactics come from the id hash and nothing new is stored.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `bots`: *Expert sharpness* adds the reachable-path check before boosting. *Tactics by difficulty* adds coil escape on Hard and Expert. New requirements cover noticing a coil, hugging, slipping out, boosting inside a coil, and the measured result.

## Impact

- `engine.js`: a reachable-path helper; the pre-boost check in `botThink` uses it for Expert bots and circled bots; the coil detection and escape moves in `botThink`; `TACTICS` gets `escape` appended; `DIFFICULTY.hard` and `DIFFICULTY.expert` get its shares; `DIFFICULTY.expert.sharp` gets `reach`.
- `tests/engine.test.js`: tests for reachable paths, coil detection, each escape move, fairness, tactic order and levels left unchanged.
- `tools/coil.js` (new, not shipped, ignored by the release check) and `tools/balance.js` (reports kills made by a bot escaping a coil as their own cause, `escape`).
- `README.md`: difficulty paragraph.
- `sw.js`: `VERSION` minor bump. No new game files.
- Saves: no change, and `tests/fixtures/save-v1.json` keeps loading. Frame time at 150 bots must stay within the existing test limit.
