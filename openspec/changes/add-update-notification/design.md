# Design

## Context

Today `sw.js` precaches the game files under a fixed cache name (`wigglefeast-v1`), calls `skipWaiting()` on install, and serves every request stale-while-revalidate: the cached file is returned immediately and refreshed from the network in the background, file by file. Consequences:

- There is no moment at which "the new release is ready", so the page cannot offer an update.
- One launch can combine files from two releases if the app closes mid-refresh.
- GitHub Pages sends `Cache-Control: max-age=600`, so a background refresh within ~10 minutes of a deploy can still receive the old file from the browser's HTTP cache.

Constraints: no build step, the game must still run from `file://` (no service worker there), and saves must stay compatible (see `openspec/specs/persistence`). Motivation is in proposal.md.

## Goals / Non-Goals

**Goals:**
- A release is all-or-nothing on a device: one cache per version, filled completely before use.
- One place to bump the version, with CI catching a forgotten bump.
- The player decides when to switch; switching never loses the run.

**Non-Goals:**
- Background sync, push notifications, or update checks while the app is closed.
- Showing release notes.
- Coordinating several open game windows beyond what the browser already does (see Risks).

## Decisions

### 1. The version lives in `sw.js` and nowhere else
`sw.js` declares `const VERSION = '1.1.0'` and names its cache `wigglefeast-<VERSION>`. Browsers decide whether a service worker changed by comparing the bytes of the `sw.js` file itself, bypassing the HTTP cache. A version string inside that file is therefore the most reliable update trigger in every browser.

The page learns the version by asking the service worker with a message, rather than keeping a second copy in another file.
- *Alternative:* a separate `version.js` loaded by both the page and the worker (via `importScripts`). This was rejected for two reasons. Whether imported scripts trigger an update is less consistent across browsers, especially older Safari. And the page would read the cached `version.js` anyway, so it gains nothing.
- *Alternative:* a version in `index.html` plus one in `sw.js`. Rejected: two places to keep in sync.
- When opened from `file://`, there is no worker, so the menu shows "local".

### 2. Atomic precache, then cache-first serving
- On `install`, the worker downloads every file in its list into the new versioned cache. Each request uses `cache: 'reload'`, so the HTTP cache (and its 10-minute window) is skipped. If any download fails, the install fails and the old release keeps running. The browser retries on its next update check.
- `fetch` serves from the worker's own cache only, and falls back to the network for anything not in the list. Navigation requests map to the cached `index.html`.
- *Alternative:* keep stale-while-revalidate or switch to network-first. Rejected: both can mix releases, and network-first slows launches on bad connections.

### 3. No automatic takeover; the page asks for it
- The new worker does **not** call `skipWaiting()` on install. It waits until the page sends it a `skipWaiting` message, which happens when the player presses Reload, or until every game window has closed.
- On `activate`, it deletes every other `wigglefeast-*` cache and calls `clients.claim()`, so the very first visit is controlled and works offline without a reload.
- *Alternative:* `skipWaiting()` on install plus forcing a reload. Rejected: it would interrupt runs.

### 4. Page-side update flow (`main.js`)
- **Registration:** register only over http(s). If `reg.waiting` already exists and a controller is present, an update is ready. Otherwise listen for `updatefound`, then for the installing worker reaching `installed` while `navigator.serviceWorker.controller` exists. A missing controller means this is the first install, not an update.
- **Update checks:** call `reg.update()` at load, on `visibilitychange` to visible (at most once every 5 minutes), and every 30 minutes on a timer. Errors are ignored, which covers being offline.
- **Showing the banner:** a small `syncUpdateBanner()` runs each frame. It shows the banner when an update is ready, the player hasn't dismissed it, and `mode !== 'playing'`. It is checked every frame because the game mode changes in many places.
- **Reload:** call `saveWorld()`, set `reloading = true`, and post `skipWaiting` to the waiting worker. On `controllerchange`, reload the page only if `reloading` is set. That guard keeps the first install's `clients.claim()` from causing a reload. The reloaded page restores the world through the existing resume flow.
- **Banner text:** the banner asks the waiting worker for its version, e.g. "Version 1.2.0 is ready".

### 5. CI check on pull requests (`.github/workflows/version-check.yml`)
- On `pull_request` to `main`, compare the changed files against the base branch.
- Any changed path counts as a shipped file unless it matches `README.md`, `openspec/**`, `.github/**`, `.claude/**` or `.gitignore`. A deny-list means a new game file is covered automatically.
- If shipped files changed but the `const VERSION = '...'` line in `sw.js` matches the base branch, the job fails with "Bump VERSION in sw.js".
- *Alternative:* a pre-commit hook. Rejected: it isn't enforced, and edits made in GitHub's web editor skip it.

### 6. Versioning scheme
Semantic version strings starting at `1.1.0` (the release already deployed is treated as 1.0.0). A version is never reused, so a rollback is published as a new, higher version.

## Risks / Trade-offs

- [Forgetting to bump means players never get the change] → the CI check in Decision 5, plus a release note in the README and the OpenSpec project context.
- [A file missing from the precache list is fetched from the network each time and breaks offline play] → the precache list sits next to `VERSION` in `sw.js`, and the verification task checks offline play with every file present.
- [Migration from the current worker: it calls `skipWaiting()` and refreshes files one by one, so during the first update an old page can receive the new `main.js`] → this only happens once. The new `main.js` works with either worker, and the new worker deletes the old cache when it activates.
- [Two game windows open: Reload in one switches both to the new worker while the other keeps running old code] → that window has already loaded everything it needs and keeps working. Both windows already share one world save, which is an existing limitation, not a new one.
- [A partially failed install] → the install fails as a whole, the old release stays active, and the next update check retries.
- [The precache downloads every file again on each release] → about 300 KB per release. Acceptable.

## Migration Plan

1. Merge the PR. Pages deploys the new `sw.js` with `VERSION = '1.1.0'`.
2. Existing installs detect the changed `sw.js` on their next launch. The new worker installs alongside the old one and takes over on the following launch (old pages show no banner), then deletes `wigglefeast-v1`.
3. From 1.1.0 onward, players see the banner for each new release.

Rollback: revert the PR and publish it with a higher version number. The previous worker code then installs as a newer release through the same mechanism.
