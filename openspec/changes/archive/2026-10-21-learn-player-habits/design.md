# Design

## Context

See proposal.md for why. What the code does today (`engine.js`, `main.js`):

- **Tactics:**
  - `TACTICS` is an append-only list.
  - `knowsTactic` hashes a bot's id with the tactic's index, so appending keeps every bot's existing tactics.
  - Expert's share table is built from `TACTICS` itself (`TACTICS.map(k => [k, 1])`), so a new tactic is automatically on for every Expert bot and off (share 0) elsewhere.
- **Cutting off** (`botThink`, hunt block, `mode = 'cut'`):
  - `cutPoint(w, o, predict)` predicts the prey's head with `predictHead(o, t)`, which uses `o.speed`, and leads by `2r + 2r'`.
  - Then *pin*, *flank* and *trap* may shift the aim sideways by `4 × prey radius` via `shift(k, mode)`, toward the prey's +1 (left) or −1 side.
- **Randomness:** everything draws from the seeded `g.rng` (#100). Seeded worlds are compared byte for byte in tests.
- **Persistence (`main.js`):**
  - Settings, profile and world live under `wormarena.*` keys through `store`, and every write is gated by `isActive()` (#45).
  - `newGame(snapshot)` creates `new Game(settings)` or `new Game(null, snapshot)`.
  - `saveWorld` runs every 10 s and on hide/close.
  - *Reset stats* replaces the profile.
- **Balance tool:** the stand-in player is driven by the bot brain without tactics, so it has steady habits, which makes it a fair target for measuring learning.

## Goals / Non-Goals

**Goals:**
- One small, versioned habits record, owned by `main.js` and handed to the engine by reference. The engine never touches storage.
- Observation that draws no random numbers and doesn't change the world, so easy, normal and hard stay byte-identical.
- An effect that is capped, grows with evidence, and fades.

**Non-Goals:**
- Learning anything but the two habits.
- Bots learning about each other.
- A habits UI.

## Decisions

### 1. The record
`{ v: 1, away, toward, straight, boost, still }`: decayed counts, each finite and between 0 and 1e6.
- **Update per encounter:** multiply every count by `CFG.HABIT_DECAY` (**0.92**, a half-life of about 8 encounters), then add 1 to the side outcome (`away`, `toward` or `straight`) and 1 to the boost outcome (`boost` or `still`).
- *A new style* (spec) is checked against this: after about 10 encounters the other way, the new side outweighs the old one.

*Alternatives considered:*
- A sliding window of the last N outcomes. It needs a list, and old evidence would drop off a cliff instead of fading.
- Time-based decay. Encounters, not minutes, are the evidence.

### 2. Observing an encounter (`Game.update`, after bots think)
- **Start:** a bot with `ai.prey === player` in a cut mode (`cut`, `trap`, `flank`, `pin`, `learn`) whose head is within `CFG.HABIT_RANGE` (**300**) of the player's head and ahead of it (`cos(angle between the player's heading and the bot) > 0`). It records:
  - the bot's side `s` (+1 when the bot is on the player's left)
  - the player's heading
  - the start time
- **One encounter at a time,** with at least 1 s between encounters.
- **Watch for `CFG.HABIT_WINDOW`** (**0.6 s**) of game time: note whether the player boosted at any tick.
- **Outcome:** the player's net heading change `Δ`.
  - `|Δ| < 0.15` rad: `straight`
  - `sign(Δ) === s`: `toward`
  - otherwise: `away`
- **Ends early without a record** if the player or the bot dies, or the player is shielded.
- **Fairness:** heading and `boosting` (the arrows) are visible. `targetAngle` and `wantBoost` are never read, which *Habits come from movement only* tests directly.
- **No random draws.** The world snapshot doesn't include the record or the encounter, so every level's world stays byte-identical. Recording happens on every level: the player is the same person.

### 3. Using it (`botThink`, cut branch, bots that know `learn`, prey is the player)
- **Confidence:**
  - `n = away + toward`
  - `conf = min(CFG.HABIT_MAX, n / (n + CFG.HABIT_EVIDENCE))`, with `HABIT_EVIDENCE` **6** and `HABIT_MAX` **0.75**
- **Side:**
  - `bias = conf × (away − toward) / n`, between −0.75 and 0.75
  - The player's "away" turn is toward side `−s`, so the aim shifts by `−s × bias × 4 × prey radius` (`shift(…, 'learn')`). That's the same scale as *trap* and *flank*.
- **Precedence:** pin, then flank, then **learn** (if `|bias| ≥ 0.1`), then trap. A learned habit is better evidence than the trap's room estimate, and pin and flank are geometric certainties.
- **Boost lead:**
  - `pBoost = conf' × boost / (boost + still)`, where `conf'` is the same formula over `boost + still`
  - `cutPoint` predicts the player at speed `o.speed × (1 + pBoost × (BOOST_MULT − 1))` when the player isn't boosting already
  - It takes an optional speed factor, which is 1 everywhere else.
- **With no record** `bias = 0` and `pBoost = 0`, so the aim equals today's exactly (*No record*).
- **Prey choice is untouched** (*Prey choice unchanged*).

*Alternative:* bias the bot's own evasion or anticipation using the player's habits. That's more power but harder to test, and it isn't what the owner described (refining the attack).

### 4. Persistence (`main.js`)
- **Loading:** `loadHabits()` reads `wormarena.habits`. Anything invalid (wrong `v`, non-finite or out-of-range counts) gives a fresh record. Corrupt stored data never stops startup, as with #26.
- **Passing it in:** `newGame` passes it as `new Game(settings, snapshot, { habits })`. `Game` keeps `this.habits = opts.habits || freshHabits()`. Tests and the balance tool get a fresh one.
- **Saving:** `saveHabits()` runs inside `saveWorld()` and at run end, only when `isActive()`.
- **Reset and export:** *Reset stats* sets a fresh record and saves it. Export and import never touch it.
- **No save-format change.** `save-v1.json` loads as before.

### 5. Measuring
`tools/balance.js` on expert, careful profile, 30 bots, 12 runs × 4 min on two seeds, with `learn` on and with `--set expert.tactics.learn=0`. Report:
- careful survival
- deaths by tactic, including the new `learn` mode
- the stand-in's record at the end of a run (its `away`/`toward` split, to show it has a habit)

Easy, normal and hard must be identical with and without the change, apart from ms/tick.

## Risks / Trade-offs

- **[Learning makes Expert noticeably harder for a predictable player]** That's intended, and it's capped at 0.75 and fades. If playtests find it too strong, lower `HABIT_MAX`.
- **[The stand-in may not have a strong side habit]** Then the balance tool shows little effect. The engine tests (scripted encounters) prove the mechanism, and the owner's playtest judges the feel.
- **[Two windows]** Only the window that owns the session saves the record, so it can't be clobbered.
- **[Privacy]** The record stays on the device and is never exported. It's a handful of numbers.

## Migration Plan

Nothing to migrate. A missing `wormarena.habits` is an empty record. Rolling back is a normal higher-version release: older versions ignore the key.

## Open Questions

- Final `HABIT_DECAY`, `HABIT_EVIDENCE` and `HABIT_MAX`, tuned only if the measurement or the playtest calls for it.
