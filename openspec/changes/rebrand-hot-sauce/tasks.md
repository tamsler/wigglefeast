# Tasks

## 1. Brand colours in the UI

- [x] 1.1 Add the brand tokens to `style.css` and use them for the wordmark "feast", `button.primary` and `#updateReload` (dark text, brand pressed shadow); verify with a browser test that the wordmark's and the Play button's computed `background-image` contain `rgb(255, 46, 136)` and `rgb(255, 159, 28)` and none of the old rainbow colours, and visually with a headless screenshot of the menu at desktop and phone sizes

## 2. App icons

- [x] 2.1 Add `tools/make-icons.js` (headless Chrome via `tests/helpers/browser.js`, canvas drawing as in the design) and exempt `tools/` in `.github/scripts/check-version.sh`; verify the release test covers a `tools/`-only change passing without a bump
- [x] 2.2 Generate and commit `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png` and `icons/favicon-64.png`; verify with a test that each PNG has its expected size (from the PNG header), and visually that the worm stays inside the 80% maskable circle and reads at favicon size
- [x] 2.3 Document regenerating the icons in the README (and that iOS keeps an old home-screen icon until it is re-added); verify the documented command runs

## 3. Release and integration

- [ ] 3.1 Bump `VERSION` in `sw.js` to the next minor version (`FILES` unchanged); run `node --test "tests/**/*.test.js"` and verify every test passes and `.github/scripts/check-version.sh main` passes after committing
- [ ] 3.2 Manual check: the menu, buttons and update banner in the new colours on desktop and a phone, and a fresh install showing the new icon (Chrome/Android, plus iOS if available); verify by noting the result in the PR

## Workflow follow-up

- Open a PR that closes tamsler/wigglefeast#59, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- Archive the change with `/opsx:archive` after merge.
