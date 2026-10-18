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
- **Hold click / Space / W / ↑**: boost (burns mass, drops food behind you); boosting worms show double arrows in front of their head, and a **BOOST** badge shows next to your score
- **A / D or ← / →**: keyboard steering
- **P / Esc**: pause
- **Touch**: drag to steer; hold the boost button (bottom right) or add a second finger to boost; the pause button is top right, beside the leaderboard

The **minimap** (top left) shades where other worms are crowded, without showing any single worm; your own position and view are marked on it.

**Growing massive:** any worm that keeps winning can grow huge. Worms only start shedding mass above 10,000 (0.2% of the excess per second), and past that size they grow mostly thicker rather than longer; the camera zooms out as you thicken.

Run into another worm's body and you die. Make others run into yours and eat what they leave behind.
Head-on collisions are won by the bigger worm. The red ring is the arena edge.

**Food themes:** pick how food looks in the menu: Classic dots, Halloween, Christmas, Snacks or Tech. **Auto** (the default) uses Halloween from 15–31 October, Christmas from 1–26 December and Classic otherwise. Themes only change how food looks.

Power-ups: 🧲 magnet · x2 / x5 food multiplier (arena food only, not what worms drop) · ⚡ free boost + speed · 🔭 zoom out · 🌀 tight turns (16s each). Active power-ups show as badges next to the minimap (top left); a badge's ring drains as time runs out, and it blinks in the last 3 seconds.

## Saving

Everything is saved automatically in the browser's `localStorage`, so there's nothing to do by hand:

- **The world** (every worm, food, power-ups, your current run) is saved every 10 seconds, whenever the tab is hidden, and when the tab is closed or reloaded. When you reopen the game you land on a paused "Welcome back" screen and can resume your run (with a 2-second shield) or end it.
- **Stats** (lifetime totals, best score per difficulty, top 10 runs, last 50 games) are saved whenever a run ends. Open them from **Stats & high scores** in the menu.
- **One window at a time:** if the game is open in two tabs or windows (say, the installed app and a browser tab), only one plays and saves. The other shows *"Wigglefeast is open in another window"*; **Play here** asks the active one to save, then continues there with the same run and stats, so neither copy can overwrite the other.
- **Export / Import** on the stats screen writes everything to a `.json` file and loads it back. Use it as a backup or to move to another browser/computer. Clearing your browser's site data erases the in-browser save.

Storage keys: `wormarena.world`, `wormarena.profile`, `wormarena.settings` (the prefix predates the rename and is kept so existing saves load).

## Files

- `engine.js`: simulation (worms, food, collisions, bot AI). No DOM, so it can run headless in Node.
- `main.js`: canvas rendering, camera, input, HUD and menus.
- `index.html`, `style.css`: page and UI.
- `manifest.webmanifest`, `sw.js`, `icons/`: installable app + offline support and release versioning.

Bot count (5–150) and difficulty (easy/normal/hard/expert) are set in the menu. The arena grows with the bot count: up to 60 bots its radius is 1800 + 60 per bot, and above that its area grows in step with the bots, so a big world is bigger, not more crowded.

**Difficulty:** Easy bots steer clumsily and rarely hunt. On harder levels bots see further, react faster and use more tactics: they predict where a turning worm is going, avoid heads about to cross their path, get out of the way of a cut-off, go head-on at smaller worms, and rush to fresh remains nobody else is closer to. On Hard some also trap worms between other bodies, pin them against the wall, or circle them. On **Expert** every bot does all of that, and two bots hunting the same worm cut in from opposite sides. Bots only use what you could see on screen, never your steering input, and treat you like any other worm.

Difficulty and growth numbers live at the top of `engine.js` (`CFG`, `DIFFICULTY`, including each level's tactic shares). `node tools/balance.js` runs headless worlds and reports survival, kills (by the killer's tactic), bot sizes and time per tick for each level; `--set` tries other values without editing the engine (for example `--set expert.tactics.coil=0`).

## Releasing

`main` is protected: every change lands through a pull request, and the **Tests** and **Release version bumped** checks (the *Tests* and *Version check* workflows) must pass before it can merge. Merging to `main` deploys to GitHub Pages, but installed copies only pick up a release whose version changed:

1. Bump `VERSION` at the top of `sw.js` (e.g. `'1.1.0'` → `'1.2.0'`) in the same PR as the change. The **Version check** on the PR fails with "Bump VERSION in sw.js" if you change a game file without doing this. Changes to `README.md`, `LICENSE`, `openspec/`, `.github/`, `.claude/`, `tests/` and `tools/` don't need a bump.
2. Merge. The **Tag release** workflow tags the commit `v<VERSION>` and publishes a [GitHub Release](https://github.com/tamsler/wigglefeast/releases) with notes generated from the merged PRs (versions with a suffix like `1.2.0-beta.1` are marked pre-release). Players get the new release downloaded in the background and see an **Update available → Reload** banner (never mid-run). Ignoring it is fine; it takes over on the next launch.
3. Never reuse or lower a version: the PR check rejects a version that already has a tag or isn't higher than the one on `main` (SemVer order, so `1.6.0-beta.1` < `1.6.0`). To roll back, publish the old code under a **higher** version.

When a release adds a new file the game loads, add it to `FILES` in `sw.js` too, or it won't work offline.

You can run the checks locally: `.github/scripts/check-version.sh main` and `DRY_RUN=1 .github/scripts/release-tag.sh`.

### App icons

The icons in `icons/` (192 and 512 px, Apple touch icon, favicon) are drawn in the brand colours by a script: run `node tools/make-icons.js` (it needs Google Chrome, like the tests) and commit the PNGs it writes, with a `VERSION` bump. Keep the file names: the manifest and service worker refer to them. Chrome and Android pick up a new icon with the update; iOS keeps the old home-screen icon until the app is removed and added again.

## Tests

```sh
node --test "tests/**/*.test.js"
```

No dependencies: Node 22+ and Google Chrome (set `CHROME_PATH` if it isn't in the usual place). `tests/engine.test.js` runs the simulation, save round trips and save validation headlessly; `tests/browser/` drives headless Chrome through the DevTools protocol for imports and stored-data safety, real keyboard/mouse/touch input, menu layout on short screens, and offline play plus the release update flow. `tests/fixtures/save-v1.json` is a real save in the current format; it must keep loading. The **Tests** workflow runs the suite on every PR.

## Planning

Work is tracked in GitHub Issues. Feature-sized changes are planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec) under `openspec/` (`/opsx:propose`, `/opsx:apply`, `/opsx:archive` in Claude Code); `openspec/specs/` describes how the game currently behaves.

## License

[MIT](LICENSE) © 2026 Thomas Amsler
