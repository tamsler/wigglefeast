# Design

## Context

- `botThink` (`engine.js`) runs every `0.32 − 0.22·skill` s per bot.
- **Heads:** it gathers up to 8 nearby heads (within `L + 300`) for the defensive tactics.
- **New prey:** it picks a new prey with chance `aggro·0.2` from candidates within `300 + 350·aggro`. It takes the nearest, or with `trap` the lowest `distance × (0.5 + freedom)` among the 3 nearest.
- **Hunt end:** a hunt ends when the prey dies, `huntUntil` passes, or the prey gets more than 900 away.
- **Evasion** looks at heads within `250 + 150·skill`.
- **Tactics** come from `TACTICS` plus a per-level share table, decided by a hash of the bot id and the tactic's *index*. So a new tactic must be appended, or every bot's existing tactics would reshuffle.
- **Deaths:** `Game.die` handles every death and knows the victim and killer. Worms carry `boosting` and a smoothed `turnRate`.
- **Save:** bot state is saved as a fixed list of fields (`toJSON` writes only those). Extra `ai` fields are transient.

## Goals / Non-Goals

**Goals:**
- Each signal is observable, per bot, and cheap.
- A reading bot's choices change measurably in hand-built scenes (tests), without making the arena much bloodier.

**Non-Goals:**
- Perfect judgement. The impressions are rough on purpose.

## Decisions

### 1. Per-bot memory, transient
`ai.seen` is a `Map` from worm id to `{ kills, killsAt, boost, wobble, lastTurn, lastAt, escapes, caught }`.
- It's created on demand. Entries not refreshed for 30 s are dropped, and the map is capped at 16 entries (least recently seen dropped).
- It's not saved: `toJSON` already writes only the defined fields. A loaded bot starts empty (spec: *Impressions after loading*).

*Alternative:* one shared reputation per worm. Cheaper, but a bot would "know" kills it never saw, which breaks *Fair information*.

### 2. Signals
- **Seen kills:** in `Game.die`, for each living bot that reads, if the victim's head is within its **view** (900 units of its head, about half a default screen's diagonal), add 1 to `seen[killer].kills`. Decay is lazy: the stored value is multiplied by `0.5^(Δt/15)` (half-life 15 s, so it's mostly gone after about half a minute) whenever it's read or written.
- **Boosting and steering:** for each head the bot already gathers each think, update EMAs with weight `0.15 + 0.25·skill`. Boost uses `o.boosting ? 1 : 0`. Wobble uses `|o.turnRate − lastTurn| / Δt`, the change in turning per second between this bot's looks.
- **Escapes:** when the bot's own hunt ends, record `escapes++` if the prey is still alive, `caught++` if it died.

### 3. Derived judgements
- `danger(o) = kills + 0.5·boost`
- `weakness(o) = 0.5·min(1, wobble / W0) + 0.5·(1 − (escapes + 1) / (escapes + caught + 2))`
  - `W0` is tuned during apply from measured wobble of low- and high-skill bots (expected around 5–10 rad/s²).
  - The escape term is a smoothed rate, so one escape doesn't decide everything.
- An unknown worm gets `danger = 0` and `weakness = 0.5`.

### 4. Uses
- **Prey choice** (bots that read): among candidates (the 3 nearest, the same pool as `trap`):
  - Skip any with `danger ≥ 1` unless its mass is at most half the bot's.
  - Score `distance × (1 + danger) / (0.5 + weakness)`, combined multiplicatively with `trap`'s freedom term when both apply. Lowest wins.
- **Room:** for a reading bot, the evade range for a head is multiplied by `1 + 0.5·min(2, danger)`. A worm it just saw kill twice is evaded from up to twice as far.

### 5. Tactic table
Append `read` to `TACTICS`. Shares: easy 0, normal 0.2, hard 0.5, expert 1. The `tactics()` helper fills the key on every level. Existing bots' other tactics are unchanged, because the hash uses each tactic's index and `read` takes a new one.

## Risks / Trade-offs

- [Bots gang up on the weakest worm, often the player while learning] → impressions are per bot, not shared. Prey still has to be among the 3 nearest. The prey-limit and hunt-chance rules are unchanged. `tools/balance.js` checks that hunting pressure on the stand-in barely moves on Normal and Hard.
- [Wobble also flags worms dodging in a crowd] → the rough judgement is accepted, and it's weighted only half.
- [Cost] → at most 8 map updates per think, plus a view check over all bots per death. That's about 150 bots × about 100 deaths a minute, a few thousand cheap checks a second.

## Migration Plan

Ships as one minor release. Nothing to migrate.
