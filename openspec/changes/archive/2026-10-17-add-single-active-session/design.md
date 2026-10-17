# Design

## Context

- **What gets saved, and when** (`main.js`): the world (`wormarena.world`) is written by `saveWorld()` every 10 s, on `visibilitychange` to hidden, on `pagehide`, on `beforeunload`, after a death, before an update reload, and on export. The profile (`wormarena.profile`) is written whole from the in-memory `profile` by `recordRun`, import and reset. Settings are written when Play is pressed.
- **Load happens once:** both world and profile are read once at startup, and nothing tells one tab about another tab's writes.
- **Storage access:** goes through `store.get` / `store.set` (with the `wormarena.` prefix) plus a few direct `localStorage` calls.
- **Constraints:** no build step and no dependencies; it must work from `file://`; existing keys and the v1 save format are unchanged.
- **Browser behaviour:**
  - The `storage` event fires in other same-origin documents when a key changes. Whether it does between `file://` tabs varies by browser, so the design must not depend on it alone.
  - Hidden tabs have their timers throttled: about 1/s, and as little as 1/min after several minutes hidden in Chrome.

## Goals / Non-Goals

**Goals:**
- **No silent overwrites:** at most one window writes the world and profile at any moment, and a window that is not active never writes them.
- **Hand over without losing progress:** in the normal case the active window saves right before handing over. In the worst case, a stuck or crashed window, at most the progress since its last save is lost.
- **Work everywhere the game works:** http(s), `file://`, and with storage unavailable (no saving at all, so no coordination is needed).

**Non-Goals:**
- Real-time sync of a running world between windows.
- Merging two worlds.

## Decisions

### 1. Ownership is a heartbeat record in localStorage
- **Record:** `wormarena.session = { id, at }`. `id` is random per page load; `at` is a timestamp.
- **Heartbeat:** the active window rewrites it every second, and removes it on `pagehide` after its final save.
- **At startup, a window becomes active** when there is no session record, the record is its own, or the heartbeat is stale (older than 3 s, because the owner closed or crashed). Otherwise it starts in **standby**.
- **Why not BroadcastChannel or Web Locks:** localStorage is the one coordination point that exists wherever saving works, including `file://`. BroadcastChannel and Web Locks are not reliable on `file://` across browsers.

### 2. Every write checks ownership first
`saveWorld()`, `saveProfile()` and the settings write all go through `isActive()`, which re-reads `wormarena.session` and compares the `id`.
- **If another window owns the session,** the write is skipped and this window drops to standby at once.
- **Why:** this is the safety net. Even if an event is missed or a timer is throttled, a window that has lost ownership can never overwrite the new owner's data.

### 3. Handover goes through a request key, answered by event or polling
1. **Request:** Play here writes `wormarena.handover = { to: id, at }`.
2. **Owner answers:** it reacts to the `storage` event for that key, or notices the key on its next heartbeat. It saves the world and profile, writes `wormarena.session = { id: to, at }`, and drops to standby.
3. **Claimant waits:** it polls for up to 2 s for the session record to name it. If the owner doesn't answer in time (hidden and heavily throttled, or gone), the claimant takes the session itself.
   - A hidden owner already saved when it was hidden, so normally nothing is lost.
   - If that late owner wakes up, its ownership check (decision 2) stops it from writing.
4. **Claimant loads:** it re-reads the world and profile from storage, builds the game with `newGame` / `restoreWorld`, and shows "Welcome back" if a live run was saved, or the menu otherwise.

The handover key is removed once it has been answered or has timed out.

### 4. Standby is a panel over a paused world
- **Panel:** `#standby` reuses `.overlay` and `.panel`. It says "Wigglefeast is open in another window" and has a **Play here** button.
- **Game state:** the game loop keeps rendering but does not advance (a mode `standby`, handled like `paused`). Input is ignored, the HUD and touch buttons are hidden, and autosave is skipped (decision 2).
- **When it appears:** on startup when another window is active, and whenever ownership is lost.
- **Reload exception:** a page that reloads finds its own stale or absent record and becomes active again, so the only open window never sees the panel.

### 5. Recording a run reads before it writes
- **What changes:** `recordRun` reloads the stored profile with `cleanProfile(store.get('profile'), true)` and adds the new run to that copy. It falls back to the in-memory profile if the stored one is missing or unreadable, then saves it and updates the in-memory copy.
- **Same for import and reset:** they keep replacing the profile, and they also only run in the active window.
- **Why:** this protects stats even in a window that wrongly believes it's active for a moment, for example two tabs opened at exactly the same instant.

## Risks / Trade-offs

- **Two tabs opened in the same instant** could both see no session record and both become active. → Each writes its own `id` and re-reads it after a short random delay (50–150 ms); the window that doesn't see its own `id` goes to standby. Decision 5 covers any stats written in between.
- **Clock jumps or `Date.now` differences** between windows. → All windows share one browser clock, and a 3 s stale threshold tolerates small skews.
- **Heavily throttled owner** (hidden for minutes). → The claimant's 2 s timeout takes over. The owner saved when it was hidden, so normally nothing is lost; in the worst case, the progress since its last save.
- **Storage events on `file://`.** → Not relied on; polling (decision 3) and ownership checks (decision 2) cover it. A task verifies the behaviour in Chrome from disk.
- **One write per second** for the heartbeat. → Negligible, but it keeps the active window's record fresh even when the window is idle in the menu.

## Migration Plan

- **Existing saves:** no migration needed. The first window to start after the update finds no `wormarena.session` and becomes active.
- **Release:** bump `VERSION` (minor).
- **Rollback:** a higher version without this code simply ignores the extra key.
