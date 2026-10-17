# Tasks

## 1. Test support for two tabs

- [x] 1.1 Add a helper in `tests/helpers/browser.js` to open a second tab in the same browser (shared profile and storage) and drive it like a `Page`; verify with a test that a value written to localStorage in one tab is read in the other, over the local http server and from `file://`, and record whether the `storage` event fires between `file://` tabs in Chrome

## 2. Session ownership and safe writes

- [x] 2.1 In `main.js`, add the `wormarena.session` record (random id per load, 1 s heartbeat, removal on `pagehide` after the final save), the startup decision (active if absent, own or older than 3 s; otherwise standby), and the simultaneous-start tie-break; verify with browser tests that a first tab becomes active, a reload becomes active again without the panel, and a second tab opened while the first is active starts in standby
- [x] 2.2 Route `saveWorld()`, `saveProfile()` and the settings write through `isActive()`, dropping to standby when ownership is lost; verify with a browser test that a standby tab's autosave, `pagehide`, `visibilitychange` and settings paths leave `wormarena.world`, `wormarena.profile` and `wormarena.settings` byte-for-byte unchanged

## 3. Standby panel and handover

- [x] 3.1 Add the `#standby` panel (`index.html`, `style.css`) and a `standby` mode that freezes the world, hides the HUD and touch buttons, and ignores gameplay input; verify with a browser test that the panel shows in the second tab and the world there does not advance
- [x] 3.2 Implement Play here: `wormarena.handover` request, the owner answering via the `storage` event or its heartbeat poll (save world and profile, hand the session over, drop to standby), the claimant's 2 s wait-then-take-over, and reloading world and profile from storage; verify with browser tests that pressing Play here during a run in the other tab opens "Welcome back" with the same worm name and score and puts the other tab on the panel, and that a stale or unresponsive owner (a session record with an old heartbeat, or one that never answers) is taken over from the last save

## 4. Stats are added, not overwritten

- [x] 4.1 Make `recordRun` read the stored profile, add the run and save it (falling back to the in-memory profile when the stored one is unreadable); verify with browser tests that runs finished in two tabs, handing over between them, both appear in the stats and the totals count both games, and that a run recorded after another writer changed the stored profile keeps that writer's run

## 5. Release and integration

- [x] 5.1 Update the README "Saving" section to describe the one-active-window behaviour; verify the text matches the behaviour
- [x] 5.2 Bump `VERSION` in `sw.js` to the next minor version (no new files); run `node --test "tests/**/*.test.js"` and verify every test passes, including the existing persistence, import and update tests, and that `.github/scripts/check-version.sh main` passes after committing
- [ ] 5.3 Manual check: an installed app window plus a browser tab of the deployed site, and two tabs opened from disk: the second copy shows the panel, Play here hands over a run in progress, and stats from both copies survive; verify by noting the result in the PR

## Workflow follow-up

- Open a PR that closes tamsler/wigglefeast#45, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- Archive the change with `/opsx:archive` after merge.
