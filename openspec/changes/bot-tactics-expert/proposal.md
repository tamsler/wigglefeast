# Proposal

## Why

Bots know a single attack: they aim at a point in front of a nearby worm's head, along its *current* heading (tamsler/wigglefeast#78). They never coil around a worm, pin it against the wall, use other bodies to trap it, or work together. A worm that simply turns escapes. They also only avoid bodies where they are right now, so they keep running into heads that cross their path; headless runs from #16 show bots living only 17–32 s on average. Hard bots have already reached the top of the skill scale (0.7–1.0), so a harder game can't come from bigger numbers alone. It needs bots that play better.

## What Changes

- **Turn-aware interception**: hunters predict the prey's curved path from how it has been turning, not just its straight-line heading.
- **Head-crossing anticipation**: when choosing a heading, bots treat the path a nearby head is about to lay down as an obstacle, not only today's bodies.
- **Evasion**: a bot that sees a head lining up to cut it off turns away toward open space, and boosts out when it can afford to.
- **Coiling**: a bot much longer than its prey circles the prey's head and tightens the loop. Its own body is the trap.
- **Edge pinning**: a worm running along the arena wall gets shadowed on the inside and cut off against the wall.
- **Trapping with other bodies**: hunters prefer prey with few escape routes and cut-off points where other worms' bodies block the way out.
- **Flanking**: when two bots hunt the same worm, the second one cuts in from the opposite side.
- **Scavenging**: bots rush to fresh remains from a nearby death.
- **Head-on awareness**: since the bigger worm wins a head-on collision, bots go for head-on contact with clearly smaller worms instead of avoiding it, and keep away from bigger heads.
- **Tactics per difficulty**: Easy uses none (it stays as calm as #16 left it), Normal uses a few some of the time, Hard most of them often, and a new fourth level uses all of them.
- **New difficulty "Expert"** (the name can change before implementation). It sits above Hard in the menu and gets its own best score on the Stats screen. Its bots have top skill, high aggression, and every tactic.
- **Fairness rule** made explicit: bots only use what a player could see (positions, headings, observed turning, sizes). They never read the player's input or steering target, and they never single out the player.
- `tools/balance.js` covers Expert and counts kills per tactic, so each level's tactics can be measured.

## Capabilities

### New Capabilities

_None._ The tactics are bot behaviour and belong in the existing `bots` capability.

### Modified Capabilities

- `bots`: the behaviour requirement gains the tactics, head-crossing anticipation and the fairness rule. The difficulty requirement gains the Expert level and which tactics each level uses.
- `persistence`: stats keep a best score for Expert alongside the other levels, and switching to Expert starts a new world like any difficulty change.

## Out of scope

- Changes to collision, growth, shedding or power-up rules (tuned in #16).
- Bots that single out or "rubber-band" against the player, or learn from the player's habits.
- Showing bot intent in the UI (debug overlays, labels for a bot that is coiling).
- Per-bot personalities chosen in the menu, or tuning tactics per bot from settings.
- Re-tuning Easy beyond keeping it free of tactics.

## Impact

- `engine.js`: `botThink` is split into goal choice, tactic choice and heading scoring. Worms track their observed turn rate. The game keeps a short list of recent deaths. `DIFFICULTY` gains `expert` and a per-level tactic table. None of this is saved: the world save format and its validation stay the same, and a saved bot simply re-picks its tactic after loading.
- `main.js`, `index.html`, `style.css`: a fourth difficulty button, a fourth "best by difficulty" tile, and the profile/settings checks that list the difficulties.
- Saved data: existing saves, settings and profiles load unchanged (missing Expert best = 0). A world, settings or profile that mentions Expert is new data that older releases don't understand (see design: risks).
- Performance: more checks per bot re-plan. These must stay within the simulation test's per-tick budget.
- Tests: engine tests per tactic with hand-built scenes; a browser test for the fourth button and stats tile. `sw.js` VERSION bump (minor).
