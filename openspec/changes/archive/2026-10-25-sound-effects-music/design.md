# Design

## Context

The game has no audio. Game events already exist for `death` (victim, killer, cause), `powerup` (worm, type) and `special` (worm, kind, value), emitted by `Game` and handled in `main.js`; there is no event for eating food. Settings are a small object in `localStorage` (`wormarena.settings`), rebuilt field by field on load (#26) and saved when a run starts. The frame loop in `main.js` knows the mode (`menu`, `playing`, `paused`, `dead`, `standby`) and the player. The page must work from `file://` and offline; every file the game loads is listed in `FILES` in `sw.js`.

A standalone prototype (scratch page) with the sounds below was approved by the owner.

## Goals / Non-Goals

**Goals:**
- All sounds generated with Web Audio: no files, nothing to license, works offline.
- Audio code in its own file with a tiny API, so `main.js` only says *what happened*.
- Testable in headless Chrome without listening: every sound that plays is also recorded in a short debug log.

**Non-Goals:**
- Volume controls (with #13), stereo/positional sound, sounds for bots.

## Decisions

### 1. `audio.js` with a small API
A new `audio.js` defines `window.WormAudio`, loaded before `main.js`:
- `unlock()`: creates the `AudioContext` (or resumes it) on the first user gesture; until then every call is a no-op.
- `play(name, opts)`: one-shot effects `eat` (opts.size 0–1), `powerup`, `special`, `kill`, `death`, `click`, `start`.
- `boost(on)`, `music(on)`: start/stop the two continuous sounds, with short fades.
- `setSound(on)`, `setMusic(on)`, `quiet(on)`: the toggles, and a flag for paused/standby/hidden.
- `log()`: the last 50 sounds that actually played (`{ name, at }`), and `state()`, for tests and the debug hook.

All voices go through one master gain (about 0.7); the sound toggle sets it to 0 with a short ramp, so nothing is cut off with a click. If `AudioContext` doesn't exist, `WormAudio` is the same API with every method a no-op and `state().available === false`.

The synth helpers (`tone`, `burst`, a shared one-second noise buffer) and the sound recipes are the prototype's, unchanged.

- Alternative: inline it in `main.js`. It is already ~1,900 lines; a separate file keeps the audio testable and lets `main.js` stay about the game.

### 2. An `eat` event for the player only
`eatFood` emits `eat` with `{ worm, r }` when a worm eats food, but only for the player's worm (`w.isPlayer`), so 150 bots eating never cost an event call. Food eaten is otherwise unchanged. Special food keeps its own `special` event.

### 3. Pops limited to 12 per second
`play('eat')` keeps a token bucket (12 tokens, refilling 12 per second); a pop without a token is skipped (not queued), and isn't logged. Pitch comes from the food's radius (`size = (r − 3) / 17`, the range of `foodRadius`) with ±6% random variation so a trail doesn't sound mechanical.

### 4. Who calls what (`main.js`)
- `eat` → `play('eat', { size })`; `powerup` / `special` for the player → chime / sparkle; `death` with `killer.isPlayer` → `kill`; `victim.isPlayer` (not `cause === 'quit'`) → `death`.
- Boost: each frame, while `mode === 'playing'`, `boost(player.boosting)`; anything else → `boost(false)`. `WormAudio` ignores repeated calls with the same value.
- Music: each frame, `music(mode === 'playing' && settings.music)`.
- Quiet: `quiet(mode === 'paused' || mode === 'standby' || document.hidden)`: suspends the `AudioContext`, so effects and music stop together; resuming continues the music loop where it left off.
- Clicks: one delegated `click` listener on overlay buttons plays `click`, except Play / Play again / Resume, which play `start` (Resume plays a click).
- Unlock: `pointerdown`, `touchstart` and `keydown` listeners on the window call `unlock()` (once it succeeds they stay but do nothing).

### 5. Music scheduling on the audio clock
The prototype used `setInterval`. The real loop schedules notes on the `AudioContext` clock with a 0.2 s look-ahead, from a 100 ms timer, so timer jitter (busy frames, background throttling) never makes the beat stumble. The pattern is the prototype's: an 8-note pentatonic arpeggio over a 4-note bass line at 96 bpm, very quiet (0.05 / 0.08 gain).

### 6. Settings and toggles
`settings.sound` and `settings.music` are booleans, default `true`; `loadSettings` takes them only when they are booleans, so older or corrupted settings load as on. Toggling saves settings at once (when this window is the active one, #45), not only at Play. Turning music off doesn't reload anything; no new world is ever started by these settings.

### 7. Buttons and the M key
Two small round icon buttons (speaker, music note; inline SVG, crossed out when off) sit absolutely positioned in the top-right corner of the main menu panel and of the pause panel, so they add no height (the menu fits phones, #165). They have `aria-pressed` and labels ("Sound", "Music"). The music button is dimmed while sound is off. The M key (ignored in text fields) toggles sound; during play a feed line confirms "🔇 Sound off" / "🔊 Sound on".

## Risks / Trade-offs

- **[Headless Chrome can't be listened to]** → Tests check the debug log and state (what played, when, rate limit, muting), not the audio itself. The owner's listening test covered the sounds.
- **[iOS Safari audio quirks]** → Unlocking inside `touchstart`/`pointerdown`, resuming on every gesture if the context was interrupted (e.g. by a phone call), and checking on a real iPhone (task 6.3).
- **[CPU on low-end phones]** → Each sound is a handful of short-lived nodes; the music schedules about 5 notes per beat pair. Negligible next to drawing; the frame-time smoke test runs with audio unlocked.
- **[Annoyance]** → Music on by default could put some players off; the toggle is one click away and remembered.

## Migration Plan

New file `audio.js` added to `FILES` (cached for offline) and a minor version bump. Settings without the new fields load with both on. Rollback is a higher-version revert; stored `sound`/`music` fields are ignored by older versions (they only read known fields).
