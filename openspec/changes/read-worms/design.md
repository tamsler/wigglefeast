# Design

## Context

- `botThink` (`engine.js`) runs every `0.32 − 0.22·skill` s per bot.
- **Heads:** it gathers up to 8 nearby heads.
- **New prey:** it picks a new prey with chance `aggro·0.2` from candidates within `300 + 350·aggro` and lighter than `preyRatio ×` its mass. It takes the nearest, or with `trap` the lowest `distance × (0.5 + freedom)` among the 3 nearest.
- **Evasion:** among heads within `250 + 150·skill`, it fires on the first whose predicted path crosses ours first. It sets `goal`, `mode = 'evade'` and stops looking.
- **Tactics** come from `TACTICS` plus a per-level share table, decided by a hash of the bot id and the tactic's *index*. So a new tactic must be appended.
- **Deaths:** `Game.die` handles every death with the victim and killer. `recentDeaths` already keeps death positions for 6 s.
- **Names:** `render` in `main.js` draws a name above every head in view, the player's in yellow and others in white.
- **Save:** bot state is saved as a fixed field list (`toJSON` writes only those), so extra `ai` and worm fields are transient.

## Goals / Non-Goals

**Goals:**
- Memory per bot, built only from what that bot saw or experienced.
- Rivalries the player can notice: tags on names, and bots that come back after you cut them off.
- No pile-ons: at most two retaliators per target.

**Non-Goals:**
- Perfect judgement, or long memories.

## Decisions

### 1. Per-bot memory, transient
`ai.seen` is a `Map` from worm id to `{ kills, grudge, at }`.
- It's created on demand. Values decay lazily: each is multiplied by `0.5^(Δt / halfLife)` whenever it's read or written, and `at` is the last update time.
- Entries below 0.05 on both values are dropped, and the map keeps at most 16 entries (the oldest `at` dropped first).
- It's not saved. A loaded bot starts empty.
- Half-lives: kills 15 s, so about a quarter is left after 30 s. Grudge 10 s, so it's mostly gone after about 20 s.

*Alternative:* one shared reputation per worm. It's cheaper, but a bot would know about kills it never saw.

### 2. Signals
- **Seen kill:** in `Game.die`, for each living bot that knows `read` and whose head is within **900** of the victim's head, add 1 to `seen[killer].kills`. If the bot's head is within **300**, also add 1 to `seen[killer].grudge` (a kill right next to it). A bot never records itself.
- **Cut-off attempt:** when a reading bot's evasion fires against worm X, add 1 to `seen[X].grudge`. This adds at most once per second per X, so one long dodge isn't counted many times.

### 3. Uses (bots that know `read`)
- **Wariness:** `wary(X) = kills + grudge` (after decay).
- **Prey choice:**
  - Candidates are unchanged (range and prey limit).
  - Drop candidates with `kills ≥ 1` unless their mass is ≤ 0.5× the bot's.
  - If any candidate has `grudge ≥ 1` and **fewer than two other bots have `ai.retaliating === X`**, pick the one with the highest grudge, set `ai.retaliating = X`, and hunt it with the usual hunting modes.
  - Otherwise use the existing choice (nearest, or `trap`).
  - `ai.retaliating` clears when that hunt ends.
- **Keep away:** the evade range for a head is multiplied by `1 + 0.5·min(2, wary(X))`.

### 4. Reputation tags (UI)
- Each worm keeps a transient `killTimes` array. `Game.die` appends the time to the killer's array, and entries older than 60 s are dropped when read.
- `render` appends `" ⚔N"` to the name when `N ≥ 1`.
- It draws the name in red-orange (`#ff5a1f`, the minimap dot colour) when `w.ai && w.ai.retaliating === game.player`.
- The tags are transient (not in `toJSON`), so after a load they start empty.

### 5. Tactic table
Append `read` to `TACTICS`. Shares: easy 0, normal 0.2, hard 0.5, expert 1. Existing bots' other tactics don't change, because the hash uses each tactic's index.

## Risks / Trade-offs

- [The player gets chased after every cut-off] → that's intended: it's the rivalry. The grudge fades in about 20 s, at most two bots retaliate at once, and only bots with `read` hold grudges (none on Easy, 20% on Normal). The balance tool checks hunting pressure on the stand-in.
- [Retaliation increases churn] → retaliation doesn't add hunts: it only changes *which* worm a bot hunts when it was going to hunt anyway (same `aggro·0.2` chance). Checked with `tools/balance.js`.
- [Cost] → a view check over all bots per death (about 150 × about 100 a minute), and at most 16 map entries per bot. Negligible.
- [Rendering cost of tags] → one `killTimes` filter per name drawn, and only for heads in view.

## Migration Plan

Ships as one minor release. Nothing to migrate.
