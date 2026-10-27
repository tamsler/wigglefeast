# Tasks

Tracked in tamsler/wigglefeast#193. A feature: branch and PR with `Closes #193`, `pr-reviewer` before merge, version bump to 1.33.0 in `sw.js`.

## 1. The tag text and the head label

- [x] 1.1 Add one helper that returns `''` or `' ⚔️N'` (with U+FE0F) for a worm, and use it for the head label in `main.js`, skipping it for the player's own worm; verify with `tests/browser/tags.test.js`: a bot's label still reads `name ⚔️2` (existing tests) and the player's own label is just the name, with kills set on the player.
- [x] 1.2 Check the grudge colour and the yellow of the player's name are unchanged; verify the existing "retaliating" test in `tests/browser/tags.test.js` still passes.

## 2. The leaderboard rows

- [x] 2.1 `row()` in `main.js` adds a `.k` span with the same helper's text between the name and the score when the worm has kills; verify with a new browser test: set kills on two bots in the top 10 and on the player, then read the `#lb` rows: killers show `⚔️N`, a non-killer's row has no `.k`, and the player's own row (placed below the gap by lowering their mass) shows theirs.
- [x] 2.2 `style.css`: `.k` is `flex: none`, tabular, with no extra row height; the name gets `min-width: 0`; verify with a browser test at 360×640 and 640×360 (compact leaderboard) and 1280×720: a worm with a very long name and 99 kills has every row's `scrollWidth` within the panel, the score fully visible, and the panel's width unchanged from a run with no kills.
- [x] 2.3 Look at it once on screen at the three sizes (desktop, portrait phone, landscape phone) and check the HUD doesn't overlap (the existing HUD layout tests in `tests/browser/layout.test.js` stay green).

## 3. The score area

- [x] 3.1 Remove the "Rank X of Y · Kills N" line from `#stats` in `index.html`, the three `#rank`/`#total`/`#kills` lines from `updateHud` in `main.js` and the `#stats .line` rule from `style.css`; verify with `grep -rn "'rank'\|'total'\|'kills')\|id=\"rank\"" main.js index.html style.css tests` that nothing still reads them.
- [x] 3.2 Add a browser test (`tests/browser/tags.test.js`): during a run with the player at 2 kills, `#stats` text contains the score and no "Rank" or "Kills", and the player's `#lb li.me` row shows their rank and `⚔️2`; verify it fails on the old HUD.
- [x] 3.3 Run `tests/browser/layout.test.js` and `tests/browser/updates.test.js` (it reads `#score`) and verify both stay green, and look once at 1280×720 and 360×640 that the score sits alone in the bottom-left without a gap where the line was.

## 4. Spec, version and release

- [x] 4.1 Bump `VERSION` in `sw.js` to `1.33.0`; verify the *Release version bumped* check passes on the PR.
- [x] 4.2 Run `node --test "tests/**/*.test.js"` and verify it is green and `tests/fixtures/save-v1.json` still loads.

## Workflow follow-up

- The owner plays a minute with kills on a real run, to see their own name, the leaderboard, the lone score and a bot's tag together.
- Open the PR with `Closes #193`, run `pr-reviewer`, fix or dismiss each finding with a reason, then squash-merge once checks pass.
- After merge, run `/opsx:archive` (syncs the `hud` delta into `openspec/specs/`).
