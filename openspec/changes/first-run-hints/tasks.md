# Tasks

Tracked in tamsler/wigglefeast#10. A feature: branch and PR with `Closes #10`, `pr-reviewer` before merge, version bump to 1.34.0 in `sw.js`.

## 1. Seen hints in the profile

- [x] 1.1 Add `tips` to `emptyProfile()` and `cleanProfile()` in `main.js`: known ids with a valid time are kept; a profile without the field gets every hint marked seen (time 0) when `totals.games > 0` and none when it is 0; verify with a browser test (`tests/browser/hints.test.js`) that loads `tests/fixtures/save-v1.json` (2 games) and checks all four are seen, and a zero-game profile checks none.
- [x] 1.2 Marking a hint seen re-reads the stored profile, unions the seen hints, and saves only when this window is the active one; Reset stats keeps the seen hints; import carries them; verify with browser tests for: reset keeps them, an export then import round-trips two seen hints, and damaged entries (unknown id, negative time, a string) are dropped without rejecting the profile.

## 2. The hint controller and the pill

- [x] 2.1 Add the pill to `index.html` (`role="status"`, `aria-live="polite"`, `.desk` and `.touch` spans) and its CSS in `style.css` (bottom centre, above the touch buttons on touch screens, no pointer events, fade, none under reduced motion); verify at 1280×720, 360×640 and 640×360 by screenshots and by `tests/browser/hints.test.js` rect checks against the other HUD elements and the middle of the screen.
- [x] 2.2 Add the controller to `main.js`: one hint at a time in the order steer, boost, danger, power-ups, skipping seen ones; the end rules and the 2.5 s minimum from the spec; progress only while `mode === 'playing'` and the player is alive; state reset per run; a seen hint is stored when it ends; expose `wigglefeastDebug.tips()`; verify with browser tests that drive the game state (heading, boosting, a power-up event, game time): a new profile shows steer first and the others follow in order, a hint stays at least 2.5 s, the danger hint ends after 6 s, a player who never boosts keeps the boost hint, and pausing freezes it and resuming restores it.
- [x] 2.3 Wording and touch: the exact texts from the spec for desktop and touch (`coarsePointer`); verify that the touch screen's first hint reads "Drag to steer" and a desktop's "Move the mouse to steer".
- [x] 2.4 Input is untouched: the pill has `pointer-events: none` and a click or tap at its centre reaches what is under it (`elementFromPoint` is not the pill), and Space and the arrow keys work while it is up (the chain test turns and boosts with it showing); verify.

## 3. Show tips again

- [x] 3.1 Add the "Show tips again" button to the stats screen and its handler (clear `tips`, save, brief confirmation on the button); verify with a browser test: a player who has seen everything presses it, starts a run and sees the steer hint; and that the stats screen's button row still fits at 360×640 (the existing layout tests).

## 4. Version and release

- [x] 4.1 Bump `VERSION` in `sw.js` to `1.34.0`; verify the *Release version bumped* check passes on the PR.
- [x] 4.2 Run `node --test "tests/**/*.test.js"` and verify it is green and `tests/fixtures/save-v1.json` still loads.

## Workflow follow-up

- The owner plays a first run with a fresh profile (a private window) on desktop and, if possible, a phone, to see the four hints in order and that none gets in the way.
- Open the PR with `Closes #10`, run `pr-reviewer`, fix or dismiss each finding with a reason, then squash-merge once checks pass.
- After merge, run `/opsx:archive` (syncs the `first-run-hints` and `persistence` deltas into `openspec/specs/`).
