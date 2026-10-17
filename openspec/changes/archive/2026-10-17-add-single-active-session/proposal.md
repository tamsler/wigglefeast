# Proposal

## Why

Two open copies of the game overwrite each other's saves (tamsler/wigglefeast#45). Each tab or window loads the world and stats once and writes them back whole to the same storage:
- **World:** an idle tab sitting in the menu replaces another tab's resumable run.
- **Stats:** a tab with stale stats erases the runs finished in the other.

An installed app window and a browser tab count as two copies, so this can happen in normal use, and it's the only known way to lose a run or stats.

## What Changes

- **One active window:** only one copy of the game plays and saves at a time.
- **Standby panel:** a second tab or window opens on a panel saying *"Wigglefeast is open in another window"*, with a **Play here** button. It never writes the world or stats while it waits.
- **Clean handover:** **Play here** asks the active window to save first. This window then continues from the latest world and stats: a live run opens on the usual "Welcome back" panel. The other window switches to the standby panel without saving again.
- **Recovering from a closed or crashed window:** if the active window was closed, crashed, or doesn't answer within a couple of seconds, the new window takes over anyway, from the last save.
- **Runs are added, not overwritten:** finishing a run adds it to the stats as they are in storage at that moment, so runs recorded elsewhere are never lost.
- **Fallbacks:** it works over http(s) and when opened from disk (`file://`). Without storage, nothing is saved, so every window simply plays.

### Out of scope

- Playing in two windows at the same time, or syncing a live run between them.
- Syncing between devices or browsers (there's no server).
- Merging two different worlds. The world from the window that last played wins, through the handover.
- Changes to the save format, storage keys or import/export.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `persistence`:
  - **New requirement:** one active game at a time, with the standby panel and the handover.
  - **Stats and high scores:** finished runs are added to the stored profile rather than overwriting it.

## Impact

- `main.js`: session ownership (a heartbeat key in localStorage, plus handover requests through `storage` events with a polling fallback). Saves are guarded so only the active window writes. The standby panel and Play here are wired up, and `recordRun` reads before it writes.
- `index.html` / `style.css`: the standby panel, reusing the existing overlay and panel styles.
- `tests/helpers/browser.js`: open a second tab in the same browser.
- `tests/browser/`: tests for two tabs, the handover, stale owners and stats merging.
- `sw.js`: `VERSION` bump. No new files.
- **Storage:** one new key, `wormarena.session` (owner ID and heartbeat). Existing keys and the save format are unchanged.
