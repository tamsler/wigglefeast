# Proposal

## Why

Bots judge a nearby worm only by its size, position, heading and observed turning (tamsler/wigglefeast#83, follow-up to #78). To a bot, a clumsy beginner and a deadly hunter of the same size look identical. Experienced players don't play like that: they notice who just killed someone, who boosts recklessly, who steers erratically and who slipped away last time, and they pick their fights accordingly. Giving bots that judgement makes the harder levels feel smarter. It isn't a matter of faster reactions: bots stop wasting hunts on worms that keep escaping and stop blundering into proven killers.

## What Changes

- **Each bot forms its own impression** of the worms it sees, from four things a player could also see:
  - **kills it saw:** a worm dies near another, within the bot's view. The impression fades over about half a minute.
  - **boosting habit:** how often the worm is seen boosting.
  - **steering:** how jerky and erratic its turning is.
  - **escapes:** how often the worm got away when *this bot* hunted it.
- **Using it:**
  - When choosing prey, the bot prefers clumsy worms (jerky steering, rarely escapes) and avoids worms it has seen kill, unless they're much smaller.
  - When moving, it gives dangerous worms more room: it starts evading them earlier and allows a wider margin around their path.
- **A new tactic, "read",** added to the per-level tactic table (Normal some bots, Hard about half, Expert all; Easy none), like the #78 tactics.
- **Fair information:** a bot knows only what it saw itself. A kill on the other side of the arena is unknown to it. The player is judged by the same visible behaviour as any bot, never by their input.
- Impressions aren't saved. After loading a world, bots start fresh and build them up again.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bots`:
  - *Tactics by difficulty* gains "read".
  - *Fair information* explicitly allows a bot to remember what it saw.
  - A new requirement covers how impressions are formed and used.

## Out of scope

- Shared reputation between bots, or a global kill count visible to all.
- Showing impressions in the UI.
- Bots learning across runs or sessions.
- Changes to other tactics' rules, or to the levels' skill and aggression ranges.

## Impact

- `engine.js`:
  - a small per-bot memory (transient, at most 16 entries), updated when the bot thinks and when a worm dies within its view
  - prey scoring and evade range read it
  - `TACTICS` gains `read`, appended at the end, so existing bots' tactics don't change
- Saved data: none. The world format, its validation and the v1 fixture are unchanged.
- Performance: a few numbers per nearby worm per think, and a view check per bot on each death.
- Tests: engine tests for each signal and use, and `tools/balance.js` to confirm churn and hunting pressure stay in range. VERSION bump (minor).
