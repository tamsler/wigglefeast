# Tasks

## 1. Season rule and setting

- [x] 1.1 Add the pure `seasonalTheme(date)` to `engine.js` and export it; verify with an engine test at the boundaries: 14 Oct and 1 Nov give Classic, 15 and 31 Oct give Halloween, 30 Nov and 27 Dec give Classic, 1 and 26 Dec give Christmas, and 1 Mar gives Classic
- [x] 1.2 Add `settings.theme` (default `auto`, validated in `loadSettings`, saved with the other settings); verify with a browser test that missing or unknown stored themes load as Auto

## 2. Themed items

- [x] 2.1 Add the `FOOD_THEMES` registry with code-drawn item sprites (Halloween: candy corn, wrapped candy, lollipop, pumpkin; Christmas: candy cane, ornament, gingerbread, gift; Snacks: cherry, cookie, donut, cake slice; Tech: microchip, battery, floppy disk, gear) cached per item, and draw themed food as a colour glow plus the item chosen by value tier and `ph`, leaving Classic exactly as today; verify with headless screenshots of each theme in the arena (small, medium and large food visible), and with a browser test that every theme renders with no page errors and creates at most 16 item sprites
- [x] 2.2 Verify the stable item rule with a browser test: a food's item (exposed through the read-only debug hook) is the same across frames and after a save and load

## 3. Menu picker

- [x] 3.1 Add the Food picker row to the menu (six buttons with item icons, Auto showing the current season, label with the resolved name) and keep the menu within the layout tests; verify with browser tests that picking Tech changes the arena and is remembered after a reload, and that the menu layout tests still pass at every size

## 4. Release and integration

- [x] 4.1 Mention food themes in the README; bump `VERSION` in `sw.js` to the next minor version (no new files); run `node --test "tests/**/*.test.js"` and verify every test passes and `.github/scripts/check-version.sh main` passes after committing
- [ ] 4.2 Manual check on desktop and a phone: every theme's items are recognisable at small and large sizes, the picker is easy to use, and frame rate is unchanged; verify by noting the result in the PR

## Workflow follow-up

- Open a PR that closes tamsler/wigglefeast#64, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- Archive the change with `/opsx:archive` after merge.
