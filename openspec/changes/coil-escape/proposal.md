# Proposal

## Why

Coiling (#78) lets a big bot circle a smaller worm and close the loop with its own body. A bot caught in a coil has no answer beyond its ordinary evasion, which steers sideways and often into the loop. The owner wants a circled worm to fight its way out (tamsler/wigglefeast#94). That means going for a **head shot**: cutting across the coiler's path just ahead of its head, so the coiler's head runs into the trapped worm's body. A worm that is bigger and longer is not automatically safe, and getting circled becomes a fight rather than a waiting game.

A quick baseline (40 coils of a 120-mass Expert bot by a 3,000-mass coiler, 6 seconds each) shows how coils go today. The prey died in 11, and the coiler never died.

## What Changes

- **Detecting a coil from what's visible:** a bot notices it's being circled when a clearly bigger worm nearby is turning steadily around it (its turning circle is centred near the bot) while the bot's own head is closed in by bodies. The bot never reads another worm's internal state.
- **Counter-attack:** the circled bot aims at a point on the coiler's predicted path, just ahead of its head, that it can reach first. Its body then lies across the coiler's way and the coiler's head runs into it. It boosts if it can afford to.
- **Slip out:** if no such point can be reached in time, it heads for the clearest gap out of the loop.
- **A new tactic, "escape",** appended to the tactic table: Hard about half of bots, Expert all, Easy and Normal none.
- **Fair:** detection uses only positions, sizes and observed turning, the same information as the other tactics.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bots`:
  - *Tactics by difficulty* gains coil escape on Hard and Expert.
  - A new requirement covers detecting a coil and countering it.

## Out of scope

- A cue for the player that they are being circled (possible follow-up).
- Changing how coiling itself works, or its share per level.
- Escaping other traps (edge pinning, flanking).

## Impact

- `engine.js`:
  - `TACTICS` gains `escape`, appended at the end, so existing bots keep their tactics
  - `botThink` gets a coil check and an escape mode, ranked above hunting and ordinary evasion
- Saved data: none. The escape mode is transient.
- Tests:
  - engine tests for detection, the counter-cut, the gap fallback and fairness
  - a repeated coil scenario showing more coiler deaths and fewer prey deaths with the tactic
  - `tools/balance.js` to confirm coil kills drop on Hard and Expert and churn stays in range
- VERSION bump (minor).
