# Proposal

## Why

Bots judge a nearby worm only by its size, position, heading and observed turning (tamsler/wigglefeast#83, follow-up to #78). To a bot, a worm that just killed two others looks the same as a harmless one, and a bot forgets instantly that someone tried to cut it off. Experienced players remember both. They also read other players at a glance, and players should be able to read bots the same way. This change gives bots a short memory of what they saw and lived through, and gives the player visible reputations, so rivalries become something you can feel and see.

## What Changes

- **Seen kills:** a bot that sees a worm kill another within its view stays wary of that killer for about half a minute. It won't hunt the killer unless the killer is much smaller, and it starts evading the killer from farther away.
- **Grudges:** a bot holds a grudge, fading over about 20 seconds, against a worm that **tried to cut it off** (its evasion fired against that worm) or **killed a worm right next to it**.
  - If the culprit is light enough to hunt, the bot **retaliates**: it goes after that worm in preference to nearer ones.
  - If the culprit is too big, the bot **keeps away**, evading it from farther.
  - **No gang-ups:** at most two bots retaliate against the same worm at a time. Others with a grudge just keep away.
- **Readable reputations** (on screen):
  - A worm that has killed in the last minute shows **⚔N** after its name (N = recent kills).
  - A bot currently retaliating against *you* shows its name in **red-orange**, so you know who's coming.
- **A new tactic, "read",** covers seen kills and grudges. It's added to the per-level tactic table (Normal some bots, Hard about half, Expert all; Easy none), like the #78 tactics.
- **Fair information:** a bot knows only what it saw or experienced itself. A kill far outside its view means nothing to it. The player is treated like any other worm. Cutting a bot off can earn you a grudge, exactly as a bot would.
- Impressions and tags aren't saved. After loading a world they start fresh.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bots`:
  - *Tactics by difficulty* gains "read".
  - *Fair information* lets a bot remember what it saw or experienced itself.
  - New requirements: *Seen kills* and *Grudges*.
- `hud`: a new requirement for reputation tags on worm names.

## Out of scope

- A bounty on the leaderboard's #1 (possible follow-up).
- Judging worms by steering style, boosting habit or escape counts (dropped: biased by input device, or too rarely observed).
- Shared reputation between bots, or learning across runs.
- Changes to other tactics' rules, or to the levels' skill and aggression ranges.

## Impact

- `engine.js`:
  - a small per-bot memory (transient, at most 16 worms), updated when the bot evades and when a worm dies within its view
  - prey choice and evade range read the memory
  - a transient per-worm list of recent kill times for the tags
  - `TACTICS` gains `read`, appended at the end, so existing bots' tactics don't change
- `main.js`: name drawing adds the ⚔N tag, and the red-orange name for bots retaliating against the player.
- Saved data: none. The world format, its validation and the v1 fixture are unchanged.
- Tests: engine tests for seen kills, grudges and the gang-up cap; a browser test for the tags; `tools/balance.js` to confirm churn and hunting pressure stay in range. VERSION bump (minor).
