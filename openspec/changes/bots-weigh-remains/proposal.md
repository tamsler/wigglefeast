# Proposal

## Why

In play, bots fight more than they eat (tamsler/wigglefeast#122). A bot chasing or coiling a worm ignores a big pile of remains right next to it, though eating the pile would make it bigger sooner and more safely than the kill. Two things cause this:
- **Hunting always wins.** In `botThink`, once a bot has prey, the hunt (cut, coil, pin) overrides scavenging, however large the remains.
- **Remains are forgotten fast.** They are remembered for only 6 s, though the food lasts 45–60 s.

A seeded run (40 bots, 3 × 2 min) found more dropped food within 400 than the kill would drop in about **15%** of hunting moments on Hard and Expert, coils included.

## What Changes

- **Remains are meals that last.** A worm's remains are remembered for as long as their food lies there, not just 6 s. Each one is valued by **how much of its food is still there**, so remains that others have eaten up stop drawing bots in.
- **Meal before fight.** A bot that scavenges compares the best remains it can reach (uncontested: no other head closer) with what its hunt would win (0.8 × the prey's mass, discounted for distance and for the chance the hunt fails). When the meal is worth more, the bot:
  - **doesn't start** a hunt;
  - **drops** a hunt it is on, coils included, and goes for the meal.
- **Small remains don't distract.** A meal has to be worth more than the kill, so a few leftover pellets never pull a bot off a good hunt.
- **Gated like scavenging.** Only bots with the *scavenge* tactic weigh meals: none on Easy, 30% on Normal, 50% on Hard, all on Expert. Getting out of danger (evade) and a winning head-on still come first.
- **Measured.** `tools/balance.js` before and after, on the same seeds: bot growth, kills by tactic, how many bots are on the player at once, and player survival. If a level's difficulty moves too far, retune the meal weighting, not the tactic table.
- **A way out of a coil.** A coiler that leaves for a meal frees its prey. This complements, and doesn't replace, #94.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bots`: *Scavenging*. Remains are remembered while their food lasts and valued by what's left. A scavenging bot prefers a better uncontested meal to starting or continuing a hunt or coil.

## Out of scope

- **The tactic share table:** who knows *scavenge* on each level stays as it is.
- **Bots without *scavenge*,** Easy included. They keep today's behaviour; their plain food search still picks up dropped food when they aren't hunting.
- **Coil-escape tactics for the prey** (#94).
- **Food amounts, food lifetimes, and what a death drops.**
- **Saves:** remains memory stays unsaved, as today.
- **UI:** no change.

## Impact

- `engine.js`:
  - `Game`: remains memory (`recentDeaths`), its lifetime, the per-remains live value and pruning.
  - `botThink`: scavenging, prey selection, and hunt and coil continuation.
- `tests/engine.test.js`: engine tests for meal-before-fight, coil abandonment, small remains, eaten-up remains, remains lasting, and Easy unchanged.
- `tools/balance.js`: no new options are expected. It is used for before and after reports.
- Performance: valuing remains costs a food-grid query per remembered remains a few times a second, and a bot thinking loops over more remembered remains. Budget: Expert ms/tick at 150 bots within +5%.
- Saves: no format change. `save-v1.json` keeps loading.
- `README.md` (difficulty paragraph) and `sw.js` (`VERSION`, minor bump).
