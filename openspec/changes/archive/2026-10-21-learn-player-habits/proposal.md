# Proposal

## Why

The owner asked whether bots can learn from watching them play and refine their strategy (tamsler/wigglefeast#135). Today every game starts from zero. The bots' *read* tactic remembers kills and cut-offs for about 30 s per bot, and nothing carries across games. A player who always escapes a cut-off the same way can keep using that move forever. The owner chose option 1 of three: bots learn the player's **visible habits** and use them, rather than tuning bots by simulation or imitating the player with a neural network.

## What Changes

- **Learning the player's habits (record):** whenever a bot moves in to cut the player off, the game records what the player visibly did next:
  - turned toward the cutter's side, turned away from it, or kept straight
  - boosted or not

  The record covers the player only and is shared by all bots. Old encounters fade, so recent play counts most. It's built on every level, because it's the same player.
- **New `learn` tactic (Expert only):** appended to the tactic list, so existing bots keep their tactics. An Expert bot cutting the player off uses the record:
  - it aims at the side the player usually escapes to
  - it leads farther when the player usually boosts
- **Capped and fading:** the effect grows with evidence, and even a very consistent habit only moves the aim part of the way. A player who changes style wins again after a few encounters.
- **Fair, with a stated exception:** the record is built only from the player's movement (turning, boost arrows), never from steering input. Bots still pick the player as prey no more often than any other worm. *Fair information* gets an explicit clause allowing this shared, saved record of the player.
- **Kept between games:**
  - a separate local record, not part of the world save or the export file, so `save-v1.json` and imports are unaffected
  - *Reset stats* also clears it
  - a damaged record starts fresh
- **Measured:** `tools/balance.js` on Expert with `learn` on and off, same seeds. The careful stand-in player has steady habits of its own, so learning should show up as more deaths and more kills by the `learn` cut. Easy, Normal and Hard must report identically.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bots`:
  - *Fair information*: an explicit allowance for the shared, saved record of the player's visible habits.
  - *Tactics by difficulty*: learning is an Expert-only tactic.
  - New requirement *Learning the player's habits*.
- `persistence`:
  - *Export, import and reset*: reset also clears the habits, and exports don't include them.
  - New requirement *Player habits are remembered*.

## Out of scope

- Option 2 (tuning bots by simulation) and option 3 (imitating the player with a neural network).
- Learning other habits, such as how the player escapes a coil. That comes after #94, and the record is built so more habits can be added.
- Bots learning about each other.
- Any UI beyond what's needed: no habits screen and no separate "forget" button (*Reset stats* covers it).
- Normal and Hard bots using the record.

## Impact

- `engine.js`:
  - `TACTICS` gets `learn` appended.
  - `Game` takes a habits record (`opts.habits`), observes cut-off encounters with the player, and decays and updates the record.
  - `botThink`'s cut-off code (aim side, lead) changes for bots that know `learn`.
  - New `CFG` constants.
- `main.js`:
  - loads and validates `wormarena.habits`, passes it to new and restored games, and saves it with the world
  - *Reset stats* clears it
- Tests:
  - `tests/engine.test.js`: observation, decay and cap, aim side, boost lead, prey choice unchanged, other levels byte-identical, the input-not-read rule
  - `tests/browser/`: the record survives a reload, reset clears it, export leaves it out, a damaged record starts fresh
- `README.md` (difficulty paragraph) and `sw.js` (`VERSION`, minor).
- Saves: the world and export formats don't change. One new localStorage key, still under the `wormarena.` prefix.
