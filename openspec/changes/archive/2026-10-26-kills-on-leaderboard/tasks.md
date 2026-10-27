# Tasks

Tracked in tamsler/wigglefeast#193. A feature: branch and PR with `Closes #193`, `pr-reviewer` before merge, version bump to 1.33.0 in `sw.js`.

## 1. The tag text and the head label

- [x] 1.1 Add one helper that returns `''` or `' ⚔️N'` (with U+FE0F) for a worm, and use it for the head label in `main.js`, skipping it for the player's own worm; verify with `tests/browser/tags.test.js`: a bot's label still reads `name ⚔️2` (existing tests) and the player's own label is just the name, with kills set on the player.
- [x] 1.2 Check the grudge colour and the yellow of the player's name are unchanged; verify the existing "retaliating" test in `tests/browser/tags.test.js` still passes.

## 2. The leaderboard columns

- [x] 2.1 `index.html` gets a header row (Kills, Score) over the list, and `row()` in `main.js` emits rank, name, kills and score cells, with a `z` class on a 0; verify with the browser test in `tests/browser/tags.test.js`: the header names the columns, the player's row shows 2 (in the top 10 and below the gap), a killer shows 7, a worm with none shows a quiet 0, and no row contains ⚔.
- [x] 2.2 `style.css`: each row is a grid with the same fixed columns, from one variable; the panel width is one variable (`--lb-w`) that the pause button follows; the compact phone panel keeps 160px with tighter columns; verify at desktop, 360×640 and 640×360 (with touch emulation, so the compact layout applies) that every row's kills end at the same x, every row's scores end at the same x, the headers sit over them, nothing overflows, and the panel is inside the screen.
- [x] 2.3 Look at it on screen at the three sizes and check the HUD doesn't overlap (the pause button clear of the minimap at 360px; the existing HUD layout tests in `tests/browser/layout.test.js` stay green).

## 3. The score area

- [x] 3.1 Remove the "Rank X of Y · Kills N" line from `#stats` in `index.html`, the three `#rank`/`#total`/`#kills` lines from `updateHud` in `main.js` and the `#stats .line` rule from `style.css`; verify with `grep -rn "'rank'\|'total'\|'kills')\|id=\"rank\"" main.js index.html style.css tests` that nothing still reads them.
- [x] 3.2 In the same browser test, with the player at 2 kills `#stats` contains the score and no "Rank" or "Kills", and the player's `#lb li.me` row shows their rank and 2; verify it fails on the old HUD.
- [x] 3.3 Run `tests/browser/layout.test.js` and `tests/browser/updates.test.js` (it reads `#score`) and verify both stay green, and look once at 1280×720 and 360×640 that the score sits alone in the bottom-left without a gap where the line was.

## 4. Spec, version and release

- [x] 4.1 Bump `VERSION` in `sw.js` to `1.33.0`; verify the *Release version bumped* check passes on the PR.
- [x] 4.2 Run `node --test "tests/**/*.test.js"` and verify it is green and `tests/fixtures/save-v1.json` still loads.

## Workflow follow-up

- The owner plays a minute with kills on a real run, to see their own name, the leaderboard, the lone score and a bot's tag together.
- Open the PR with `Closes #193`, run `pr-reviewer`, fix or dismiss each finding with a reason, then squash-merge once checks pass.
- After merge, run `/opsx:archive` (syncs the `hud` delta into `openspec/specs/`).
