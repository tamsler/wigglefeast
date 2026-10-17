# Tasks

## 1. Versioned service worker

- [ ] 1.1 Rewrite `sw.js` with `const VERSION = '1.1.0'`, cache name `wigglefeast-<VERSION>`, and a precache list fetched with `cache: 'reload'` that does not call `skipWaiting()` on install; verify by serving the site locally and confirming in headless Chrome that a single `wigglefeast-1.1.0` cache holds every listed file
- [ ] 1.2 Serve only from the worker's own cache (navigation → cached `index.html`, unlisted requests → network) and on `activate` delete other `wigglefeast-*` caches and claim clients; verify the game loads with the local server stopped after the first visit
- [ ] 1.3 Handle `skipWaiting` and `version` messages from the page; verify the page receives the version string from the active worker

## 2. Update flow in the game

- [ ] 2.1 In `main.js`, register the worker only over http(s), detect a waiting update (already waiting at load, or installed while a controller exists), and run update checks at load, on becoming visible (throttled to 5 minutes) and every 30 minutes; verify no errors appear when opened from `file://` or when offline
- [ ] 2.2 Add the "Update available" banner markup and styles (`index.html`, `style.css`) showing the waiting release's version, with Reload and dismiss buttons and safe-area-aware positioning; verify it renders at desktop and phone widths
- [ ] 2.3 Show the banner only when an update is ready, not dismissed, and the game is not in active play; verify it stays hidden during a run and appears on pause, death and menu
- [ ] 2.4 Make Reload save the world, ask the waiting worker to take over, and reload only on that requested controller change; verify a paused mid-run reload comes back on the "Welcome back" panel with the same score, and that a first-ever visit does not reload itself
- [ ] 2.5 Show the running version in the main menu ("local" from `file://`); verify both cases

## 3. Release safeguards and docs

- [ ] 3.1 Add `.github/workflows/version-check.yml` that fails a PR when files other than `README.md`, `openspec/**`, `.github/**`, `.claude/**` or `.gitignore` change without a change to the `VERSION` line in `sw.js`; verify by running its check script locally against a branch with and without a bump
- [ ] 3.2 Document the release process (bump `VERSION`, never reuse one, roll back as a higher version) in `README.md` and add the bump rule to the OpenSpec project context; verify the README steps match the workflow's failure message

## 4. Integration verification

- [ ] 4.1 Headless end-to-end check on a local server: install release A, change the version to B on the server, relaunch with the same browser profile, confirm the banner shows B, click Reload, and confirm the menu shows B and only B's cache remains
- [ ] 4.2 Manual check in a real browser (Chrome desktop, plus an iPhone home-screen install if available) on the deployed site after merge: banner appears for the next release and Reload keeps the run and stats
- [ ] 4.3 Run the headless engine checks (`sim` and save round-trip) to confirm nothing regressed, even though `engine.js` is not expected to change

## Workflow follow-up

- Open a PR that closes tamsler/wigglefeast#1; merge after the CI check passes and the manual check in 4.2 is done on the preview or after deploy.
- Archive the change with `openspec archive add-update-notification` so `release-updates` and the updated `offline-app` spec become the main specs.
