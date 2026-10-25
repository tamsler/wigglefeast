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

## How to play

- **Mouse**: steer toward the cursor
- **Hold click / Space / W / ↑**: boost (burns mass, drops food behind you); boosting worms show double arrows in front of their head, and a **BOOST** badge shows next to your score
- **A / D or ← / →**: keyboard steering
- **P / Esc**: pause
- **Touch**: drag to steer; hold the boost button (bottom right) or add a second finger to boost; the pause button is top right, beside the leaderboard

Run into another worm's body and you die. Make others run into yours and eat what they leave behind.
Head-on collisions are won by the bigger worm. The red ring is the arena edge. Bigger worms are drawn over smaller ones, so a worm wrapping another is on top of it, and a smaller worm's body under your own body can't hurt you: you're on top of it there. Your head always stays on top, so you can see what's right in front of you.

**Growing massive:** any worm that keeps winning can grow huge. Worms only start shedding mass above 10,000 (0.2% of the excess per second), and past that size they grow mostly thicker rather than longer; the camera zooms out as you thicken.

**Power-ups:** 🧲 magnet (blue and red waves ripple forward from the worm's head as far as it pulls food) · x2 / x5 food multiplier (arena food only, not what worms drop) · ⚡ free boost + speed · 🔭 zoom out · 🌀 tight turns (16s each).

**Special food:** nova crystals (+25), nebula diamonds (+50) and plasma spheres (+100) turn up at random, about 5 at a time in a 30-bot arena (more in bigger ones). Most are crystals; plasma spheres are the rarest (about 1 in 10). Each lasts 20 seconds, blinks for its last 4 and then vanishes if nobody has eaten it. They look the same in every food theme, the magnet pulls them in like food, and x2 / x5 don't apply to them. Bots go for them too.

## On screen

- **Score and rank** (bottom left), and the **leaderboard** (top right): the top 10, plus your own place if you're not in it.
- **Power-up badges** sit next to the minimap; a badge's ring drains as time runs out, and it blinks in the last 3 seconds.
- **Minimap** (top left): a density map that shades where other worms are crowded across the whole arena, without marking any single worm. You're the red-orange dot.
- **Names:** ⚔ and a count show how many worms a worm has killed, and a bot that's coming after you for cutting it off has its name in red-orange.
- **Messages** pop up for your kills, your power-ups, and when the #1 worm is taken down. After you die, the camera follows the worm that was on top until you play again (or until that worm dies).

## Menu

- **Name** and **skin**: 24 skins in eight finishes (stripes, gradients, neon, metallic, spots, scales, galaxy and pulse).
- **Bots** (5–150, default 30) and **difficulty** (easy, normal, hard). Changing either starts a new world.
- **Food:** pick how food looks: Classic dots, Halloween, Christmas, Snacks or Tech. **Auto** (the default) uses Halloween from 15–31 October, Christmas from 1–26 December and Classic otherwise. Themes only change how food looks.
- **Stats & high scores** (see Saving below).

## Bots and difficulty

The arena grows with the bot count: up to 60 bots its radius is 1800 + 60 per bot, and above that its area grows in step with the bots, so a big world is bigger, not more crowded.

**Difficulty:** Easy bots steer clumsily and rarely hunt. On harder levels bots see further, react faster and use more tactics: they predict where a turning worm is going, avoid heads about to cross their path, get out of the way of a cut-off, go head-on at smaller worms, and go for remains nobody else is closer to. They put a meal before a fight: they drop a chase, even a coil, when remains nearby are worth more than the kill. On **Hard** every bot also traps worms between other bodies, pins them against the wall and circles them, and works its way out when it's circled: it follows the inside of the loop instead of being squeezed in the middle, and slips out through any gap it can turn into, without boosting into the loop. Hard bots also shadow worms too big to hunt (up to four times their mass, you included): they run alongside, two at most, and cut in at the head when a clear cut opens, and two bots hunting the same worm cut in from opposite sides. They are sharp, too: they re-plan more often, look farther and check their path closely, weigh more ways out, notice cutters from farther away and steer clear of several at once. They also don't boost into a turn they can't make: a boosting worm turns wider. A third of them start large, up to mass 5,000. (Hard is what Expert was before there were three levels; saved Expert settings, worlds and scores carry over as Hard.)

Hard bots also **learn how you escape a cut-off**, across games: whether you usually turn away from the bot, turn toward it or keep straight, and whether you boost. A bot cutting you off then aims where you usually go and leads farther if you usually boost. They only watch what anyone could see (your worm's turns and boost), the effect grows slowly with evidence and is capped, and recent escapes count most, so changing your style beats them again within a few cut-offs. A small 🧠 by a bot's head shows it's watching how you escape. **Reset stats** makes them forget.

Bots that read other worms (some on Normal, all on Hard) keep their distance from a worm they just saw kill, and hold a grudge against one that tried to cut them off: they come after it if they can (never more than two at once), or keep away if it's too big. That includes you: cut a bot off and it may come after you for a while.

Bots only use what you could see on screen, never your steering input, and treat you like any other worm.

Difficulty and growth numbers live at the top of `engine.js` (`CFG`, `DIFFICULTY`, including each level's tactic shares). `node tools/balance.js` runs headless worlds and reports survival, kills (by the killer's tactic), bot sizes and time per tick for each level; `--set` tries other values without editing the engine (for example `--set hard.tactics.coil=0`). Each report prints its seed; `--seed` replays the same worlds, so two settings can be compared on identical runs.

## Saving

Everything is saved automatically in the browser's `localStorage`, so there's nothing to do by hand:

- **The world** (every worm, food, special food, power-ups, your current run) is saved every 10 seconds, whenever the tab is hidden, and when the tab is closed or reloaded. When you reopen the game you land on a paused "Welcome back" screen and can resume your run (with a 2-second shield) or end it.
- **Stats** (lifetime totals, best score per difficulty, top 10 runs, last 50 games) are saved whenever a run ends. Open them from **Stats & high scores** in the menu.
- **Your habits** (how you escape a cut-off, which Hard bots learn from) are saved with the world. They stay on the device: exports don't include them, imports leave them alone, and **Reset stats** clears them.
- **One window at a time:** if the game is open in two tabs or windows (say, the installed app and a browser tab), only one plays and saves. The other shows *"Wigglefeast is open in another window"*; **Play here** asks the active one to save, then continues there with the same run and stats, so neither copy can overwrite the other.
- **Export / Import** on the stats screen writes everything to a `.json` file and loads it back. Use it as a backup or to move to another browser/computer. Clearing your browser's site data erases the in-browser save.

Storage keys: `wormarena.world`, `wormarena.profile`, `wormarena.settings`, `wormarena.habits` (the prefix predates the rename and is kept so existing saves load).

## Files

- `engine.js`: simulation (worms, food, collisions, bot AI). No DOM, so it can run headless in Node.
- `main.js`: canvas rendering, camera, input, HUD and menus.
- `index.html`, `style.css`: page and UI.
- `manifest.webmanifest`, `sw.js`, `icons/`: installable app + offline support and release versioning.
- `tools/`: `balance.js` (headless balance report) and `make-icons.js` (draws the app icons). Not shipped with the game.
- `tests/`: engine and browser tests (see Tests).
- `openspec/`: specs and change plans (see Planning).

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

No dependencies: Node 22+ and Google Chrome (set `CHROME_PATH` if it isn't in the usual place).

CI splits the files into five parallel shards balanced by duration: `node tests/shard.js 2/5` runs shard 2 locally. Every file runs in exactly one shard, and a new file needs no setup. Add a slow one to `SECONDS` in `tests/shard.js` to keep the shards even.

- The engine tests run headlessly. `tests/simulation.test.js` runs whole worlds on every difficulty and at 150 bots. `tests/engine.test.js` covers save round trips and save validation, growth and shedding, food and power-ups. `tests/bots.test.js` tests each bot tactic in a hand-built scene, `tests/habits.test.js` learning the player's habits, and `tests/coil.test.js` coil escape. Shared helpers are in `tests/helpers/engine.js`.
- `tests/browser/` drives headless Chrome through the DevTools protocol:
  - imports and stored-data safety, and one window at a time
  - real keyboard, mouse and touch input, and boosting
  - menu and HUD layout on short screens, power-ups and their badges
  - skins, food themes, branding, difficulty and bot-count settings
  - the minimap, name tags and massive worms
  - frame times at up to 150 bots
  - offline play and the release update flow
- `tests/release.test.js` checks the release rules: versions only go up and are never reused.
- `tests/fixtures/save-v1.json` is a real save in the current format; it must keep loading.

The **Tests** workflow runs the suite on every PR that touches code. A PR that only changes docs and specs (top-level Markdown, `openspec/`, `.claude/`, `LICENSE`, `.gitignore`) skips the shards, and the required **Tests** check still passes (`.github/scripts/needs-tests.sh`). Pushes to `main` always run everything.

## Planning

Work is tracked in GitHub Issues. Feature-sized changes are planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec) under `openspec/` (`/opsx:propose`, `/opsx:apply`, `/opsx:archive` in Claude Code); `openspec/specs/` describes how the game currently behaves.

## License

[MIT](LICENSE) © 2026 Thomas Amsler
