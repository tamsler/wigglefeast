# Proposal

## Why

The `⚔N` reputation tag over the player's own head repeats the kills the HUD already shows in the bottom-left corner, and the leaderboard, the place players look to compare themselves with others, shows no kills at all (tamsler/wigglefeast#193). The bottom-left line "Rank X of Y · Kills N" in turn repeats what the player's gold leaderboard row shows (their rank and, with this change, their kills). The tag over *other* worms still has a job: the leaderboard lists only 10 worms, and the tag is the only way to see that the worm next to you is dangerous (bot grudges are tied to it).

## What Changes

- **The player's own worm shows no `⚔N` tag.** Their name stays over their head in the same yellow style.
- **The leaderboard gets columns.** Each row shows rank, name, **Kills** and **Score**, with a small header row naming the two number columns; the numbers are right-aligned and line up on every row, with no icons (an earlier idea, `⚔N` after the name, looked janky and unaligned on screen). A worm with no kills shows a quiet 0. The panel keeps its widths (220px, 160px on phones); the name gives way first.
- **The bottom-left score area keeps only the big score** (and its SCORE label and Boost badge). The second line "Rank X of Y · Kills N" is removed, not hidden: the player's rank and kills are shown by their gold leaderboard row, which is always there while they are alive (in the top 10, or below the gap).
- **Other worms are unchanged**: the `⚔N` tag over their heads, and the red-orange name of a bot holding a grudge, stay as they are.
- The leaderboard rows have no requirement today, so the rows (rank, name, kills, score, own row highlighted) are written down.

### Out of scope

- A threshold for the tag over other worms (for example only 3+ kills); a possible follow-up if it still feels noisy.
- Sorting by kills, or any new stat on the leaderboard.
- The death screen and the stats screen, which keep their own kills and rank numbers.
- The "of N" total (how many worms are alive) is dropped with the line; nothing replaces it.
- Anything saved: kill counts are already saved with a world and nothing is added.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `hud`: *Reputation tags* no longer applies to the player's own worm; new requirements *Leaderboard rows*, *Kills on the leaderboard* and *Score area* describe what a row shows (including the kills) and that the score area shows only the score.

## Impact

- `main.js`: the name labels skip the `⚔` suffix for the player's own worm; `row()` adds the kills; `updateHud` no longer fills `#rank`, `#total` and `#kills`.
- `index.html`: the "Rank X of Y · Kills N" line is removed from `#stats`.
- `style.css` and `index.html`: the leaderboard rows become a grid with a header row (Kills, Score); the panel width is one variable that the pause button follows; the `#stats .line` rule goes; the compact phone leaderboard gets tighter columns.
- `tests/browser/tags.test.js`: the player's own label has no tag even with kills; the leaderboard shows the kills; the panel doesn't overflow at phone sizes.
- `sw.js`: VERSION bump to 1.33.0 (a visible feature).
- Nothing saved changes; `tests/fixtures/save-v1.json` is unaffected.
