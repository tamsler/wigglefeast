# Proposal

## Why

Boosting burns too much mass (tamsler/wigglefeast#125, owner's playtest). It costs **(3 + 1% of mass) per second**, and only 60% of that comes back as food behind the worm. A mass-3,000 worm loses 33 a second, so 5 s of boosting costs 165. Boosting is the main way to cut someone off or escape, and at that price it's hardly worth it.

## What Changes

- **Halve the boost cost to (1.5 + 0.5% of mass) per second** (owner's choice). A worm can boost about twice as long for the same mass.
- **The dropped share stays 60%,** so a boost trail holds half as much food as before.
- **Applies to every worm,** player and bots alike. Bots don't weigh the cost when deciding to boost, so they keep boosting as often but shed half as much.
- **The two numbers move into `CFG`,** so `tools/balance.js --set` can try other values.
- **Measured:** `tools/balance.js` before and after on the same seeds, per level, reported in the PR. There's no tuning gate: the owner chose the value.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `gameplay`: *Boosting*. The mass lost per second becomes (1.5 + 0.5% of mass).

## Out of scope

- The minimum mass to boost (12), the boost speed (2.1×), the dropped share (60%) and how long boost-trail food lasts (18 s).
- When bots choose to boost.
- The ⚡ speed power-up, which still boosts for free.

## Impact

- `engine.js`: `Worm.update` drain, plus `CFG.BOOST_COST_BASE` and `CFG.BOOST_COST_SHARE`.
- `tests/engine.test.js`: a test for the new cost.
- `README.md` (controls line), `sw.js` (`VERSION`, minor).
- Saves: no change.
