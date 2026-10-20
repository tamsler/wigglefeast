# Proposal

## Why

Expert isn't hard to play (tamsler/wigglefeast#110). In play, bots are easy to kill, they don't come after you, growing is easy, and once you're big you're safe. A seeded balance run backs this up. A cautious stand-in player that only eats survives a median **234 s** on Expert and peaks at **10,717** mass, against 53 s and 1,468 on Hard. Expert bots already draw near-top skill (0.85–1.0) and know every tactic, so the existing knobs are close to their cap. Expert needs a lever of its own. The owner chose **sharper bots**: bots that react faster, see danger sooner and get out of trouble better, so they die less, grow larger, and leave less food lying around for a careful player.

## What Changes

- **Expert-only sharpness**, a setting of the difficulty rather than of each bot. It's applied when a bot thinks and isn't stored on the bot, so saves don't change:
  - **Faster re-planning:** Expert bots re-plan more often than a Hard bot of the same skill.
  - **Farther, denser look-ahead:** they look farther along each candidate heading and check it closely enough that a thin body can't slip between the checks.
  - **More candidate headings,** so they find narrow gaps.
  - **Wider danger sensing:** they notice threatening heads from farther away and track more of them at once.
  - **Better escapes:** when a cut-off is coming, an Expert bot weighs every threatening head, not just the nearest, and picks the clearest way out instead of always turning at a right angle to one threat's line.
- **Bigger worms on Expert (owner's addition):** an Expert world starts with more large bots, and larger ones, than today's 25% up to mass 3,000. The starting point is 35% up to 5,000, tuned by measurement. A careful player starts further down the food chain, and big bots are on the board from the first second.
- **Measured, not guessed.** Each part can be switched off with `tools/balance.js --set`. A part stays only if seeded balance runs show it helps. Where it doesn't, it's dropped (the #94 lesson).
- **Easy, Normal and Hard are unchanged.** The same seed gives the same balance report as before this change.
- **Fair information still applies.** Sharper bots see more of what's visible, never anything hidden.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bots`:
  - *Difficulty*: Expert's description and scenario say what makes it harder than Hard beyond skill and tactics.
  - *Bot population*: the *Initial world* scenario gets Expert's new share and size of large bots.
  - New requirement: *Expert sharpness* (faster re-planning, denser and farther look-ahead, more headings, wider danger sensing, multi-threat escapes, other levels unchanged).

## Out of scope

- **Bots hunting much bigger worms,** such as going after the leader. Today a bot only hunts worms lighter than its level's prey limit (2× its mass on Expert), which is why a big player is left alone. This is the natural follow-up if sharper bots aren't enough.
- **Less food or slower growth** on Expert.
- **Changes to Easy, Normal or Hard,** to the levels' skill and aggression ranges, or to the tactic share table.
- **Coil escape** (#94, parked). Expert's better escapes deal with cut-offs, not with being circled.
- Any UI change. The difficulty picker and its labels stay as they are.

## Impact

- `engine.js`: the `DIFFICULTY` table (a `sharp` block on Expert, Expert's `bigShare` and `bigMax`), `botThink` (look-ahead, headings, sensing, evasion) and the re-plan timer in `Game.update`.
- `tools/balance.js`: nothing new is needed. `--set expert.sharp.<key>=…` already reaches the new settings.
- `tests/engine.test.js`: new engine tests. Seeded reports for the other levels are compared before and after.
- Performance: more checks per think cost tick time. The budget is about 25% more ms/tick on Expert (an estimated +19% comes from faster re-planning and more headings alone).
- Saves: no format change. `save-v1.json` keeps loading.
- `README.md` (difficulty paragraph) and `sw.js` (`VERSION`, minor).
