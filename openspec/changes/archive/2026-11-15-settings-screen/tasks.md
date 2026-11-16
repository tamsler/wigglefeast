# Tasks

## 1. Settings values and the Settings screen

- [x] 1.1 In `loadSettings()` add `quality` (`'high'`/`'low'`, default high), `botNames` (boolean, default true), `volume`, `sfxVolume` and `musicVolume` (finite numbers 0 to 1, default 1), each taken from storage only if valid. Verify with a browser test: a settings value from before this change (name, skin, bot count, difficulty, mode, theme, sound, music) loads with the defaults and every older field kept, and `tests/fixtures/save-v1.json` still imports; damaged values (`"ultra"`, a volume of 5, a string for a boolean) fall back one by one without stopping startup.
- [x] 1.2 Add the `#settingsScreen` overlay to `index.html` with a Settings button on the main menu and on the pause panel, and a Back button. Open and close it with `settingsFrom` (`'menu'` or `'paused'`) without touching `mode`; `P` and `Esc` close it first; `goStandby()` hides it. Verify with browser tests: menu to Settings and back; pause, Settings, Back leaves the run paused with the same score and Resume continues it; `Esc` and `P` inside Settings close it and do not resume; another window taking over shows the standby panel and writes nothing.
- [x] 1.3 Move the "Show tips again" button and its handler from the stats screen into Settings (keep `#showTips`). Verify by moving the button in `tests/browser/hints.test.js` (it still turns hints back on and Reset stats leaves them alone) and a test that the stats screen has Export, Import and Reset stats and no tips button.
- [x] 1.4 Save on change: every control writes `wormarena.settings` through the same `isActive()` guard, and `loadSettings()` re-applies all new settings when a window takes over. Verify with a browser test that a change survives a reload and that a standby window does not write.
- [x] 1.5 Add read-only debug hooks for tests (current settings, canvas size, whether food and worms are drawn flat). Verify they are used by the tests in the later groups.

## 2. Show bot names

- [x] 2.1 Add the Show bot names control (on/off) to Settings, bound to `settings.botNames`, and skip every non-player worm in the names loop in `render()` when it is off. Verify with a browser test that reads the drawn labels (through a debug counter): bots labelled by default; with names off no bot is labelled, a bot with kills shows no tag, a retaliating bot shows no red-orange name, the player's own name is still drawn in its colour, and the leaderboard still lists every worm; turning it on again brings them back at once.

## 3. Graphics quality

- [x] 3.1 Add the High/Low control to Settings, bound to `settings.quality`; `resize()` caps the pixel ratio at 1 in Low (2 in High) and runs again on change. Verify with a browser test at a device pixel ratio of 2: canvas is twice the window size in High and the window size in Low, switching takes effect without a reload, and at a ratio of 1 both match.
- [x] 3.2 Low food: add `dotSprite(color)` (the core of the glow sprite) and draw it at the dot's size instead of the glow sprite, and skip the glow under themed items. Verify with a browser test (pixels read back from a paused arena with one piece of food): the pixel just outside the dot is arena floor in Low and tinted by the halo in High, and the dot itself is still food-coloured.
- [x] 3.3 Low worms: give `paintBody` an optional `flat` argument that skips the light rim and the highlight stroke, passed only from `drawWormBody` in Low (menu previews and swatches never pass it). Verify with a browser test that Low draws no highlight (a debug counter of highlight strokes) while ridges, outline and eyes are still drawn, and that the menu skin preview is identical in High and Low.
- [x] 3.4 Prove Low changes only the look: run the same seeded world for the same time in High and Low and compare the engine state; check a collision and a meal happen the same in both. Verify with an engine or browser test.
- [x] 3.5 Measure the gain: in a browser test, with CPU throttling on (4x) at a device pixel ratio of 2, compare the median frame time of a busy arena in High and Low and assert Low is clearly faster (under 0.8 of High). Verify the test passes; it records the frame times as a diagnostic. (The measurement on a real older phone is part of 5.3.)

## 4. Volume

- [x] 4.1 In `audio.js` add an effects bus between the recipes and `master`, `setVolumes({ master, effects, music })`, and make the music fade to the music level; report the levels in `state()`. Verify with browser tests that read the audio state: Master scales effects and music together, Effects scales only effects, Music only the music, 100% on all three equals the old levels, and muted stays silent at any level.
- [x] 4.2 Add the three sliders to Settings: update the audio live while dragging, save on release, and play one short effect when the Effects slider is released above 0%. Verify with a browser test: moving each slider changes the matching level, mute buttons and the `M` key still mute and unmute at the set level, moving a slider while muted does not unmute, the choice survives a reload, and older settings load at 100%.
- [x] 4.3 Keep the test browser silent: run the new audio checks with the existing fake audio output and mute flags. Verify the new tests pass in `tests/browser/audio.test.js` (or a new file) with no real audio device opened.

## 5. Layout and release

- [x] 5.1 Style the Settings screen in `style.css`: one setting per row, the segmented controls and sliders, touch-sized targets. Verify with a layout test at 1280 by 713, 360 by 640 and 640 by 360: every control is visible or reachable by scrolling, the page does not scroll sideways, and nothing overlaps.
- [x] 5.2 Bump `VERSION` in `sw.js` from 1.36.1 to 1.37.0 (no new files, so `FILES` stays). Verify with the *Version check* script and `tests/release.test.js`.
- [ ] 5.3 Run `node --test "tests/**/*.test.js"` and confirm every test passes, including `tests/fixtures/save-v1.json`. Check the screen by hand on a touch phone (menu, pause, sliders, Low graphics, offline reload), and time High against Low on an older phone for the issue's "measurably improves frame rate" acceptance, writing the frame times in the PR description.

## Workflow follow-up

- Open the PR with `Closes #13`, run the `pr-reviewer` agent, address its findings, merge once checks pass.
- After the merge, run `/opsx:archive` so the `settings` spec is created and the `audio`, `first-run-hints` and `hud` specs are updated.
