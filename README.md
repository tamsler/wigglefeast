# Wigglefeast

A single-player snake-style .io game you can play offline. Eat, grow, and outsmart AI worms; there's no server.

## Play

**Online:** https://tamsler.github.io/wigglefeast/

**Install it as an app** (works offline afterwards):
- Chrome / Edge (Mac, Windows, Linux): click the install icon in the address bar
- Safari on Mac: File → Add to Dock
- iPhone / iPad: Share → Add to Home Screen
- Android: Chrome menu → Install app

**Locally:** open `index.html` in a browser (double-click works, nothing to build). Offline/install support needs it served over http(s), e.g. `python3 -m http.server`.

- **Mouse**: steer toward the cursor
- **Hold click / Space / W / ↑**: boost (burns mass, drops food behind you)
- **A / D or ← / →**: keyboard steering
- **P / Esc**: pause
- **Touch**: drag to steer, add a second finger to boost

Run into another worm's body and you die. Make others run into yours and eat what they leave behind.
Head-on collisions are won by the bigger worm. The red ring is the arena edge.

Power-ups: 🧲 magnet · x2 / x5 food multiplier · ⚡ free boost + speed · 🔭 zoom out (16s each).

## Saving

Everything is saved automatically in the browser's `localStorage`, so there's nothing to do by hand:

- **The world** (every worm, food, power-ups, your current run) is saved every 10 seconds, whenever the tab is hidden, and when the tab is closed or reloaded. When you reopen the game you land on a paused "Welcome back" screen and can resume your run (with a 2-second shield) or end it.
- **Stats** (lifetime totals, best score per difficulty, top 10 runs, last 50 games) are saved whenever a run ends. Open them from **Stats & high scores** in the menu.
- **Export / Import** on the stats screen writes everything to a `.json` file and loads it back. Use it as a backup or to move to another browser/computer. Clearing your browser's site data erases the in-browser save.

Storage keys: `wormarena.world`, `wormarena.profile`, `wormarena.settings` (the prefix predates the rename and is kept so existing saves load).

## Files

- `engine.js`: simulation (worms, food, collisions, bot AI). No DOM, so it can run headless in Node.
- `main.js`: canvas rendering, camera, input, HUD and menus.
- `index.html`, `style.css`: page and UI.
- `manifest.webmanifest`, `sw.js`, `icons/`: installable app + offline support. Bump `CACHE` in `sw.js` if you ever need to force every installed copy to drop its cache.

Bot count (5–60) and difficulty (easy/normal/hard) are set in the menu. The arena size scales with the bot count.
