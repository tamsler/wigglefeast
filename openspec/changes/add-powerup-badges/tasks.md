# Tasks

## 1. Badges

- [x] 1.1 Build `#powerups` once as one `.badge` per power-up type (icon, colour, title) and add `syncBadges()` to `frame()` (hidden when not running, `--left` ring value, `ending` at ≤ 3 s, `ending-fast` at ≤ 1 s); remove the bar markup from `updateHud`; style the ring (conic gradient), the blink animations and the reduced-motion outline in `style.css`; verify with a browser test (update `tests/browser/powerups.test.js`) that collecting a power-up shows its badge with a full ring, that 2.5 s left adds `ending` and 0.8 s adds `ending-fast`, that the badge hides when the power-up ends, that badges keep `POWERUP_INFO` order, and that re-collecting refills the ring and clears the ending classes

## 2. Top-left cluster and touch buttons

- [x] 2.1 Wrap `#minimap` and `#powerups` in a top-left `#cluster` (row on wide screens, column with badges in rows of three under 600 px), move the touch pause button to the top-right beside the leaderboard (below it if the narrow-portrait test needs that), and remove the old minimap-near-boost and compact-timer rules; verify with headless screenshots at 1280×800, 390×844 and 844×390 with all six power-ups active
- [x] 2.2 Update `tests/browser/layout.test.js`: all six power-ups active at every size (selector updated to the badges), and the same no-overlap check at 1280×713 and 1440×900 with a mouse (touch buttons excluded); verify the layout tests pass and fail if the minimap is put back bottom-right on touch screens

## 3. Release and integration

- [x] 3.1 Update the touch-controls help line if it mentions the pause position; bump `VERSION` in `sw.js` to the next minor version; run `node --test "tests/**/*.test.js"` and verify every test passes and `.github/scripts/check-version.sh main` passes after committing
- [ ] 3.2 Manual check on desktop and a phone: the cluster reads well, badges blink before running out, and nothing overlaps in portrait or landscape; verify by noting the result in the PR

## Workflow follow-up

- Open a PR that closes tamsler/wigglefeast#63, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- Archive the change with `/opsx:archive` after merge.
