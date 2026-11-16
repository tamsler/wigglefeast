# Design

## Context

See proposal.md for why. What the code looks like today:

- **Settings** live in one `settings` object in `main.js`, rebuilt from checked fields by `loadSettings()` and saved whole to `wormarena.settings` by the window that owns the session (`isActive()` before every write, #45). It already holds name, skin, bot count, difficulty, mode, theme, sound and music.
- **Overlays** are `.overlay` blocks in `index.html` (menu, death, paused, standby, stats), shown and hidden with the `hidden` class. `mode` (`menu | playing | dead | paused | standby`) decides whether the world ticks. The stats screen is opened from the menu and goes back with `showMenu()`.
- **Pause keys**: `P` and `Esc` both call `setPaused(mode === 'playing')`; `M` toggles sound.
- **Drawing**: `resize()` sizes the canvas at `DPR = min(2, devicePixelRatio)`. `render()` draws food as a glow sprite (`foodSprite`, a 64 px radial gradient drawn at `r * 6.5` world units), `paintBody()` paints tube, ridges, a light rim and a soft highlight, and the names loop labels every worm. `paintBody` is also used for menu previews and swatches.
- **Audio** (`audio.js`): recipes connect to one `master` gain (0.7 when sound is on); the music loop plays into a `musicBus` that is faded 0 to 1 and rebuilt whenever the music stops.
- The skin spec forbids any glow around the body, so "worm highlight" means only the soft highlight stroke and the light rim inside the ridges.

## Goals / Non-Goals

**Goals:**
- A Settings overlay that works the same from the menu and from the pause panel, without ever advancing or ending the run.
- A Low quality that cuts real per-frame work (pixels filled, large gradient draws, long strokes) and nothing else.
- Everything stored in the existing settings value, old values loading unchanged.

**Non-Goals:**
- No change to the engine (`engine.js`): quality and names are drawing-only, volumes are audio-only.
- No automatic quality choice and no frame-rate meter in the game.

## Decisions

**1. Settings is its own overlay, opened over the menu or the pause panel.** A new `#settingsScreen` overlay with a `settingsFrom` variable (`'menu'` or `'paused'`). Opening hides the source overlay and shows Settings; Back does the reverse. `mode` is not touched, so a paused run stays paused (nothing ticks, music stays quiet) and the menu keeps its state. `P`/`Esc` while Settings is open close it instead of resuming, and `goStandby()` hides it with the others. *Alternative: a panel inside the menu and the pause panel.* Rejected: two copies of the controls, and the pause panel is small.

**2. Quality is a `settings.quality` of `'high'` or `'low'`; one flag drives three cuts.**
- *Resolution*: `resize()` uses `min(low ? 1 : 2, devicePixelRatio)` and runs again when the setting changes. Everything that reads `DPR` (the world transform, `paintBody`'s pixel scale, the minimap) follows. On a 2x phone this is a quarter of the pixels, the largest saving.
- *Food*: Low draws a `dotSprite(color)`: just the white-to-colour core of the glow sprite, drawn at about 0.4 of the glow size, so the plain dot is the same size as today's dot and there is no large transparent halo to blend. In a themed arena the glow under the item is skipped as well.
- *Worm highlight*: `paintBody` gets an optional `flat` argument. `drawWormBody` passes it in Low and the function skips the light rim and the highlight stroke (the two extra long paths per worm). Ridges, outline, markings and eyes stay. Menu previews and swatches never pass it, so the menu looks the same in both.
*Alternatives:* dropping the ridges too, or a quality scale instead of a flag. Rejected: ridges are what make the body read as round, and two levels are what the issue asks for.

**3. Names are skipped in the names loop.** `render()` skips any worm that is not the player when `settings.botNames` is false, so labels, kill tags and the retaliation colour all go with one `continue`. The leaderboard is HUD markup and is untouched.

**4. Volumes are three levels in the audio module.** `audio.js` gets `setVolumes({ master, effects, music })` (each 0 to 1). A new `sfx` gain sits between the recipes and `master` (recipes and the boost whoosh connect to it instead of `master`); `master.gain` is `soundOn ? MASTER * master : 0`; the music bus fades to `musicLevel` instead of 1. The Sound and Music buttons keep meaning "muted", so muted stays silent at any level and unmuting returns to the set level. The audio state reports the levels so tests can read them. *Alternative: one master level.* Rejected with the owner: the issue lists master, effects and music.

**5. A short effect plays when an Effects slider is released** (an eating pop), so a level can be judged without leaving Settings. It uses the normal effect path, so it respects mute and the audio unlock rule.

**6. Settings are saved and loaded like the existing ones.** New keys `quality`, `botNames`, `volume`, `sfxVolume`, `musicVolume`. `loadSettings()` starts from the defaults and takes each stored value only if it is valid (`'high'`/`'low'`, a boolean, a finite number from 0 to 1), so settings from older releases and damaged values behave as in the spec. Saved at once by the window that owns the session; `loadSettings()` already re-runs when a window takes over (#45), so it re-applies quality, names and volumes too. No save or profile format changes: settings are not in exports and `tests/fixtures/save-v1.json` is untouched.

**7. "Show tips again" moves.** The button and its handler (`#showTips`) go into Settings; the stats screen keeps Export, Import and Reset. The handler already guards with `isActive()`.

**8. Layout.** Settings uses the existing `.panel` style with the segmented control (`.seg`) for quality and names and range sliders like the bot-count slider, one setting per row so it fits a 360 px phone and scrolls vertically if it must.

## Risks / Trade-offs

- [Low graphics change the look and some players dislike it] → High stays the default and is exactly today's look; Low is opt-in.
- [The frame-rate gain depends on the device, and headless Chrome has no GPU] → Automated tests check what Low *does* (canvas size, food drawn without the halo, no highlight strokes, same world) and that Low is no slower under CPU throttling; the real-device gain is measured by hand on a phone, as the issue's acceptance asks, and recorded in the PR.
- [A slider drag saves settings on every move] → Save when the slider is released (`change`), update the audio live on `input`.
- [Esc and P both close Settings, but they also pause] → While Settings is open the key handler only closes it; it cannot start or resume a run.
- [Moving "Show tips again" breaks the existing hints test and any muscle memory] → The test moves with the button; the spec says so.

## Migration Plan

Ships as 1.37.0 with a `VERSION` bump in `sw.js`; no new files. Nothing to migrate: old settings load with defaults. Rollback is a release with a higher version that removes the screen; the extra stored keys are ignored by older code.
