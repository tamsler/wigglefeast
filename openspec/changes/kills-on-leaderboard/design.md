# Design

## Context

See proposal.md for why. Today:

- **Head labels** (`main.js`, the "Names" pass in the draw loop): each worm on screen gets `name`, or `name ⚔️N` when `w.kills > 0`, filled yellow for the player, red-orange for a bot holding a grudge, and white otherwise. The emoji form (U+2694 U+FE0F) is used because the plain glyph is tiny at name size.
- **Leaderboard** (`updateHud` and `row()` in `main.js`, `#leaderboard` / `#lb` in `style.css`): a row is `rank`, `name` (flexible, with an ellipsis) and `score`. The panel is 220px wide, 160px under 600px wide and in phone landscape, where only the top 5 and the player's own row show. `updateHud` rebuilds the list every 0.15 s and adds the player's row below a gap when they are not in the top 10.
- The bottom-left `#stats` block has the big score (`#score`, with its label and the Boost badge) and a second line `Rank <b id="rank"> of <b id="total"> · Kills <b id="kills">`, filled by three lines in `updateHud`. Nothing else reads those three elements: no test, no aria label; the death screen has its own `dKills`/score elements.
- `w.kills` is already saved and restored with a world.

## Goals / Non-Goals

**Goals:**
- Kills visible on the leaderboard for everyone listed, as a plain, aligned column under a header.
- No tag over the player's own worm.
- The panel never grows; a long name gives way first.
- The bottom-left area shows just the score: rank and kills live in the player's gold row.

**Non-Goals:**
- Any change to the tag over other worms, the grudge colour, what counts as a kill, or what is saved.

## Decisions

### D1. Kills and score are columns with headers, one number each, no icons

The leaderboard becomes a grid: rank, name, **Kills**, **Score**, with a small header row naming the two number columns. Every row uses the same fixed column widths (a CSS grid on each row, widths from one variable), so the numbers are right-aligned and line up from the first row to the last, and the headers sit over them. Every row shows its kills as a plain number; `0` is shown quietly (dimmed) rather than left out, since an empty cell would make the column ragged. No ⚔ in the leaderboard.

Widths: the panel keeps its 220px on desktop and tablets (a wider one pushes the touch pause button into the minimap's badges at 760px), with columns `18px / name / 30px / 50px`; the pause button's offset follows the panel width through one variable (`--lb-w`) instead of three copies of the number. The compact phone panel keeps its 160px (a wider one pushes the pause button onto the minimap at 360px) with tighter columns `14px / name / 24px / 46px`, a smaller header and 8px padding. The name is the only flexible column and truncates with an ellipsis. Scores up to about 50,000 fit the phone columns.

Alternatives considered:
- *`⚔N` after the name, only for killers* (the first version of this plan). The owner saw it on screen: the icon renders in a different font, sits off the baseline, and the numbers don't line up. Rejected.
- *A kills column without a header, or the ⚔ as the header.* The header words are clearer than an icon, and cost one small row.
- *Kills after the score.* Pushes the score, the thing the list is sorted by, away from the right edge. Rejected.

### D2. The head tag keeps its own text form

Over other worms' heads the tag stays `name ⚔️N` (U+FE0F so it reads at name size), built by one small helper, for killers only. The leaderboard doesn't use it.

### D3. The player is excluded from the head label by identity

The label code already knows the player (it colours that label yellow), so it skips the suffix for `w === player`. A spectated or dead player isn't drawn, so there is nothing else to handle. The bottom-left HUD and the leaderboard row cover the player's kills.

### D4. The "Rank · Kills" line is removed, not hidden

`#rank`, `#total` and `#kills` are removed from `index.html`, their three lines from `updateHud`, and the `#stats .line` rule from `style.css`. Hiding it would leave dead markup and work every 0.15 s. The player's own row is always in the leaderboard while they are alive: in the top 10, or below the gap (the compact phone leaderboard hides rows 6+ except the player's own, `.me`). Two things are lost on purpose: the "of N" total (nobody was asked for it), and the visible "0" for kills in the score area; the leaderboard rows still show it, quietly (D1). The big score stays where the eyes are, because it is what moves as the player eats.

### D5. The dead player

After death the leaderboard no longer lists the player (existing behaviour: `updateHud` adds their row only while they are alive and below the top 10, and `lb` holds living worms only), and the bottom-left score keeps showing their last score under the death screen, which has its own kills and stats. Not changed by this.

## Risks / Trade-offs

- **Names are shorter on a phone** (the kills column takes about 30px) → the name truncates with an ellipsis; the owner can see whole names on desktop. The kills are the more useful thing to keep.
- **A very big score overflows the phone column** (the 46px column fits up to about 50,000; 100,000 is a pixel too wide) → scores that high are practically unreachable (mass sheds above 10,000), and the test pins the 50,000 case.
- **Less room for the name** (about 80px on desktop, 50px on phones) → names truncate with an ellipsis; the layout tests check nothing overlaps at desktop, tablet and phone sizes.
- **Players who liked their own tag lose it** → their kills are at the bottom left and in their leaderboard row.

## Migration Plan

Ships as 1.33.0. No data migration. Rollback is a normal release with a higher version.
