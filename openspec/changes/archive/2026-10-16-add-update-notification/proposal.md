# Proposal

## Why

Installed copies of Wigglefeast pick up a new release one launch *after* it downloads, with no sign that an update is waiting and no way to see which version a device runs (tamsler/wigglefeast#1). The current service worker also refreshes each file independently in the background, so a launch can briefly mix files from two releases. Now that the game is public and installable, every merge to `main` reaches players, so releases need to arrive predictably and visibly.

## What Changes

- Releases become **versioned and atomic**: a single version string in `sw.js` names the release, and each release is downloaded as a complete set into its own cache before it is used. Clients keep running one consistent release until they switch.
- When a newer release has finished downloading, the game shows an **"Update available" banner** with a **Reload** button (and a dismiss option). The banner never appears during an active run; it waits until the player is in the menu, on the death screen, or paused.
- **Reload saves the world first**, then switches to the new release, so a run in progress resumes on the existing "Welcome back" panel.
- If the player ignores the banner, the new release takes over on the next launch once all game windows are closed.
- The game **checks for updates** at launch, when the tab becomes visible again, and periodically while open.
- The main menu shows the **running version** (or "local" when opened from disk).
- A **GitHub Actions check** fails a pull request that changes shipped game files without bumping the version, since an un-bumped release would never reach installed players.
- **BREAKING (release process only)**: changes to shipped files no longer reach players unless the version in `sw.js` is bumped. Players and saves are unaffected.

### Out of scope

- Changing the save format or storage keys; existing saves must keep loading.
- Release notes / changelog inside the game.
- Automatic version bumping or tagging; bumping stays a one-line manual edit enforced by the PR check.
- Changes to how the game runs from `file://` beyond showing "local" as the version.

## Capabilities

### New Capabilities
- `release-updates`: how players learn about and switch to a new release — the update banner, reload behaviour, update checks, version display, and the release-version rule enforced on pull requests.

### Modified Capabilities
- `offline-app`: the "Updates" requirement changes from per-file background refresh (new version appears on the following launch) to versioned, atomic release caches that switch only on reload or relaunch.

## Impact

- `sw.js`: rewritten caching strategy (versioned cache, full precache bypassing the HTTP cache, cache-first serving, no automatic takeover, version reply to the page).
- `main.js`: service-worker registration, update detection, banner logic tied to game mode, save-before-reload, version request.
- `index.html` / `style.css`: banner markup and styles; version label in the menu.
- New `.github/workflows/version-check.yml` for the pull-request check.
- `README.md`: release process (bump the version).
- Existing installs on the current service worker migrate automatically: the new worker installs alongside, takes over on the next launch, and deletes the old cache.
