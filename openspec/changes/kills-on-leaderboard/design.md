# Design

## Context

See proposal.md for why. Today:

- **Head labels** (`main.js`, the "Names" pass in the draw loop): each worm on screen gets `name`, or `name ⚔️N` when `w.kills > 0`, filled yellow for the player, red-orange for a bot holding a grudge, and white otherwise. The emoji form (U+2694 U+FE0F) is used because the plain glyph is tiny at name size.
- **Leaderboard** (`updateHud` and `row()` in `main.js`, `#leaderboard` / `#lb` in `style.css`): a row is `rank`, `name` (flexible, with an ellipsis) and `score`. The panel is 220px wide, 160px under 600px wide and in phone landscape, where only the top 5 and the player's own row show. `updateHud` rebuilds the list every 0.15 s and adds the player's row below a gap when they are not in the top 10.
- The bottom-left `#stats` block has the big score (`#score`, with its label and the Boost badge) and a second line `Rank <b id="rank"> of <b id="total"> · Kills <b id="kills">`, filled by three lines in `updateHud`. Nothing else reads those three elements: no test, no aria label; the death screen has its own `dKills`/score elements.
- `w.kills` is already saved and restored with a world.

## Goals / Non-Goals

**Goals:**
- Kills visible on the leaderboard for everyone listed, in the same `⚔N` form as over heads.
- No tag over the player's own worm.
- The panel never grows; a long name gives way first.
- The bottom-left area shows just the score: rank and kills live in the player's gold row.

**Non-Goals:**
- Any change to the tag over other worms, the grudge colour, what counts as a kill, or what is saved.

## Decisions

### D1. The kills sit between the name and the score, and only when there are some

The row becomes `rank · name · ⚔N · score`, with the `⚔N` span left out when `kills` is 0. This matches the head tag (no kills, no tag) and keeps rows of non-killers exactly as they are.

Alternatives considered:
- *A fixed kills column on every row.* Lines the numbers up, but takes about 30px from every name: on the 160px compact panel that leaves roughly 45px for the name, too little. Rejected.
- *Kills after the score.* Pushes the score, the thing the list is sorted by, away from the right edge. Rejected.

The name is the flexible item and already truncates; the kills span is `flex: none` so it is never the one that shrinks, and `min-width: 0` on the name keeps a long one from forcing the row wider. The panel's width is fixed, so it can't grow whatever the row holds.

### D2. Same text form as over heads, built in one place

The `⚔️N` text (with U+FE0F, for the same reason) comes from one small helper used by both the head label and the leaderboard row, so the two can't drift apart. It takes the worm and returns `''` or `' ⚔️N'`.

### D3. The player is excluded from the head label by identity

The label code already knows the player (it colours that label yellow), so it skips the suffix for `w === player`. A spectated or dead player isn't drawn, so there is nothing else to handle. The bottom-left HUD and the leaderboard row cover the player's kills.

### D4. The "Rank · Kills" line is removed, not hidden

`#rank`, `#total` and `#kills` are removed from `index.html`, their three lines from `updateHud`, and the `#stats .line` rule from `style.css`. Hiding it would leave dead markup and work every 0.15 s. The player's own row is always in the leaderboard while they are alive: in the top 10, or below the gap (the compact phone leaderboard hides rows 6+ except the player's own, `.me`). Two things are lost on purpose: the "of N" total (nobody was asked for it), and a visible "0" for kills, since a row shows `⚔N` only from the first kill, as over a head. The big score stays where the eyes are, because it is what moves as the player eats.

### D5. The dead player

After death the leaderboard no longer lists the player (existing behaviour: `updateHud` adds their row only while they are alive), and the bottom-left score keeps showing their last score under the death screen, which has its own kills and stats. Not changed by this.

### D6. The dead player's row (was D4, unchanged)

No change: `updateHud` shows the player's own row only while they are alive and outside the top 10, and the death screen has its own kills. Not touched.

## Risks / Trade-offs

- **A killer's name is shortened more on a phone** (about 22px less for `⚔3`) → the name already truncates with an ellipsis, and the 360×640 and 640×360 checks assert nothing overflows. The kills are the more useful thing to keep.
- **The emoji ⚔️ renders larger or in colour on some platforms** → it already does over heads; the row uses the same glyph, and a size is set so it doesn't change the row height (checked at both leaderboard sizes).
- **Players who liked their own tag lose it** → their kills are at the bottom left and in their leaderboard row.

## Migration Plan

Ships as 1.33.0. No data migration. Rollback is a normal release with a higher version.
