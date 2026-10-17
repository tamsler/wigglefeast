# Tasks

## 1. Speed trail

Shipped in v1.3.0, then replaced by the head arrows in section 4 (#41).

- [x] 1.1 In `main.js`, add the pooled trail: emit sparks from the tail of every boosting worm inside the view (with margin), advance and fade them in `updateTrails(dt)` while not paused, cap the pool at 600, and draw them between power-ups and worms using the worm's drawing alpha; verify visually with headless screenshots of the player boosting, then stopped
- [x] 1.2 Expose the read-only `window.wigglefeastDebug.trailSparks()` count and add a browser test (`tests/browser/boost.test.js`): sparks appear while the player boosts (mass raised so boost is possible), stop being emitted and drain to zero after boost is released, and none appear when boost is held at mass 12 or less

## 2. BOOST badge

- [x] 2.1 Add the `#boostBadge` pill inside `#stats .score` (`index.html`, `style.css`) and `syncBoostBadge()` in `frame()`, shown only while `game.player.boosting`; verify with browser tests that it shows while boosting (keyboard and, with a coarse pointer, the touch boost button), hides on release, stays hidden when boost is held at mass 12 or less, stays hidden while only the ⚡ speed power-up runs, and is hidden in the menu and after death
- [x] 2.2 Show the badge in the touch HUD layout test (`tests/browser/layout.test.js`: hold boost with mass raised during measurement) so the overlap checks cover it at every phone size; verify the layout tests pass
- [x] 2.3 Mention the trail and badge in the README controls section next to boosting; verify the text matches the behaviour

## 3. Release and integration

- [x] 3.1 Bump `VERSION` in `sw.js` to the next minor version (no new files, so `FILES` unchanged); verify `.github/scripts/check-version.sh main` passes after committing
- [x] 3.2 Run `node --test "tests/**/*.test.js"`; verify every test passes
- 3.3 (superseded by 4.5: the tail trail was replaced before this check happened)

## 4. Head arrows instead of the tail trail (#41)

- [x] 4.1 Remove the trail from `main.js` (spark pool, `updateTrails`, `drawTrails`, the WeakMap and the clearing in `newGame`) and draw two chevron arrows in front of the head of every boosting worm in `drawWorm()`, along `w.angle`, sized to the head, with the staggered forward pulse and the worm's drawing alpha; verify with headless screenshots of the player and a bot boosting
- [x] 4.2 Replace the test hook with `window.wigglefeastDebug.boostArrows()` (worms whose arrows were drawn last frame) and update `tests/browser/boost.test.js`: arrows while the player boosts, none after release, none when boost is held at mass 12 or less, none for ⚡ alone, arrows for ⚡ plus boost; verify the tests pass
- [x] 4.3 Update the README controls line to describe the arrows instead of the trail; verify the text matches the behaviour
- [x] 4.4 Bump `VERSION` in `sw.js` to 1.5.0 and run `node --test "tests/**/*.test.js"`; verify every test passes and `.github/scripts/check-version.sh main` passes after committing
- [x] 4.5 Manual check in a real browser on desktop and on a touch device: the arrows are clearly visible in front of the head on the player and on bots, point where the worm is going, the badge tracks boosting, and the frame rate stays smooth with several bots boosting; verify by noting the result in the PR
  - Checked by the user in their browser on 2026-10-17: works well. A touch device was not separately confirmed.

## Workflow follow-up

- Open a PR that closes tamsler/wigglefeast#37, run the `pr-reviewer` agent, address its findings, and merge once checks pass (done: #39).
- Open a PR that closes tamsler/wigglefeast#41 for section 4, with the same review and merge steps.
- Archive the change with `/opsx:archive` after merge.
