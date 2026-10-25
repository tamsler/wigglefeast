# Proposal

## Why

The game is completely silent, which is the biggest missing piece of game feel now that worms and the arena look the part. The owner listened to a prototype of generated sounds and approved it, with music on its own toggle and both on by default. Tracked in tamsler/wigglefeast#9.

## What Changes

- **Sound effects**, all generated in the browser (Web Audio), no audio files:
  - eating: a soft pop, higher for small food and deeper for big food, with a cap so a trail of food never turns into a buzz;
  - boosting: a whoosh that lasts while the player boosts;
  - power-up pickup: a rising chime; special food: a sparkly chime;
  - the player eating another worm: a chomp and a short fanfare; the player dying: a falling "wah";
  - menus: a tiny click on buttons and a swoosh when a run starts.
  Only the player's own actions make sounds; bots are silent.
- **Background music**: a soft looping tune while playing, generated too. It pauses with the game.
- **Two toggles**, both on by default and remembered between sessions: *sound* (everything; key **M**) and *music*. Small speaker and music buttons sit in the corner of the main menu and on the pause panel.
- **Browser rules**: audio starts after the player's first click, tap or key press (pressing Play counts), and goes quiet while the game is paused, standing by for another window, or hidden.

### Out of scope

- Volume sliders (with the settings screen, #13).
- Sounds for bots' actions, positional or stereo sound.
- Audio files of any kind.

## Capabilities

### New Capabilities

- `audio`: the game's sound effects and music, what triggers them, the sound and music toggles, and when audio is allowed to play.

### Modified Capabilities

- `controls`: the M key toggles sound.

## Impact

- New `audio.js` (the synthesizer and sound list), loaded by `index.html` before `main.js` and added to `FILES` in `sw.js` so it works offline.
- `engine.js`: an `eat` event when a worm eats food (worm and food size), alongside the existing `death`, `powerup` and `special` events. No change to game rules or saves.
- `main.js`: hooks the events to sounds for the player, boost start and stop, music while playing, the toggles, M key, saving the two booleans in settings.
- `index.html`, `style.css`: the two toggle buttons in the menu corner and on the pause panel.
- `sw.js`: VERSION bump (minor) and `audio.js` in `FILES`.
- Settings gain `sound` and `music` booleans; older settings without them load with both on. Exported saves are unchanged (they don't include settings).
- Tests: browser tests for the toggles, persistence, M key, which actions trigger which sounds (through a debug log, as headless Chrome can't be listened to), the autoplay rule and silence while paused; an engine test for the `eat` event.
