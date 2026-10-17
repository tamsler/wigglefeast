# Tasks

## 1. Test support for touch screens

- [x] 1.1 Add a helper in `tests/helpers/browser.js` that switches a page to a coarse pointer (touch emulation, or `Emulation.setEmulatedMedia` with `pointer: coarse` if emulation alone doesn't switch the media feature); verify with a test that asserts `matchMedia('(pointer: coarse)').matches` is true after the call and false before it

## 2. Boost and pause buttons

- [ ] 2.1 Add `#touchControls` with the boost and pause buttons (inline SVG icons, `aria-label`s) inside `#hud` in `index.html`, styled in `style.css` so they show only under `@media (pointer: coarse)`, with `pointer-events: auto`, `touch-action: none` and `-webkit-touch-callout: none`; verify in headless Chrome that both are displayed during a run with a coarse pointer and not displayed with a fine pointer
- [x] 2.2 In `main.js`, show `#touchControls` only while `mode === 'playing'` and a player exists, and clear the button boost whenever they are hidden; verify with a browser test that the buttons are hidden in the menu, on the pause panel and on the death screen
- [x] 2.3 Add `input.buttonBoost`: set on boost-button `pointerdown` (with pointer capture), cleared on `pointerup`/`pointercancel`/`lostpointercapture` and window `blur`, ignore `contextmenu`, and include it in `wantBoost`; verify with a browser test that holding the button boosts, lifting stops it, lifting after sliding off the button stops it, and a second finger dragging on the game steers while the button is held
- [x] 2.4 Wire the pause button's `click` to `setPaused(true)`; verify with a browser test that tapping it shows the pause panel, game time stops advancing, and Resume continues the run
- [ ] 2.5 Update the menu's touch help line to mention the boost and pause buttons (keeping the two-finger hint), and the Controls section of `README.md`; verify the line shows with a coarse pointer and stays hidden with a fine pointer

## 3. Touch HUD layout

- [ ] 3.1 Under `@media (pointer: coarse)`, place the boost button bottom-right and the pause button top-left inside the safe areas, move the power-up timers below the pause button, stack the minimap above the boost button in portrait and put it left of the boost button in landscape, and limit the leaderboard to the top 5 rows plus the player's row on short landscape screens; verify visually with headless screenshots at 390×844, 360×640, 844×390, 667×375 and 640×360
- [ ] 3.2 Add a browser layout test that, with a coarse pointer and three power-ups active, checks at 390×844, 360×640, 844×390, 667×375 and 640×360 that the boost button, pause button, score, leaderboard, minimap and power-up timers are inside the viewport, that the buttons are at least 44px in each dimension, and that no two of these elements overlap (feed excluded); verify the test fails if the minimap is moved back to its desktop position
- [ ] 3.3 Confirm desktop is unchanged: the existing layout and input tests pass with a fine pointer, and a new assertion checks that `#touchControls` is not displayed at 1280×713 and 1440×900

## 4. Release and integration

- [ ] 4.1 Bump `VERSION` in `sw.js` (no new files, so `FILES` is unchanged); verify `.github/scripts/check-version.sh main` passes
- [ ] 4.2 Run `node --test "tests/**/*.test.js"`; verify every test passes
- [ ] 4.3 Manual check on a real iPhone home-screen install, in portrait and landscape (on the deployed site after merge, or on a local server reachable from the phone): buttons clear the notch and home bar, holding boost for several seconds and sliding off it never opens a menu, selects text or zooms, pause and resume work, and nothing overlaps; verify by noting the result in the PR or issue

## Workflow follow-up

- Open a PR that closes tamsler/wigglefeast#11, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- Archive the change with `/opsx:archive` after merge.
