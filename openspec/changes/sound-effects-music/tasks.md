# Tasks

## 1. Audio module

- [x] 1.1 Create `audio.js` with `window.WormAudio` (design decision 1): unlock, `play` with the prototype's recipes (`eat`, `powerup`, `special`, `kill`, `death`, `click`, `start`), `boost(on)`, `music(on)` scheduled on the audio clock (decision 5), `setSound`, `setMusic`, `quiet`, `log()` and `state()`, the 12-per-second eat limit (decision 3), and a no-op fallback without Web Audio. Load it in `index.html` before `main.js` and add it to `FILES` in `sw.js`. Verify with a browser test that before any interaction `state().unlocked` is false and `play` logs nothing; after a click it is unlocked and `play('powerup')` is logged; and that with `AudioContext` removed the game starts and plays with no exceptions.
- [x] 1.2 Add a browser test of the eat limit: 40 `play('eat')` calls within one second log at most 12 pops. Verify it passes.

## 2. Engine event

- [x] 2.1 Emit `eat` with `{ worm, r }` from `eatFood` for the player's worm only. Verify with an engine test that the player eating food emits one `eat` per piece with its radius, a bot eating emits none, and special food still emits only `special`. Verify `node --test tests/engine.test.js tests/simulation.test.js` passes (tick budget unchanged).

## 3. Hooking sounds to the game

- [x] 3.1 In `main.js`, call `unlock()` on the first pointer/touch/key gesture and wire the events (decision 4): eat, power-up, special food, kill, death (not on quit), boost start/stop from the frame loop, music while playing, `quiet` while paused/standby/hidden, menu clicks and the start swoosh. Add `sounds()` and `audioState()` to `window.wigglefeastDebug`. Verify with browser tests (debug log) that: eating food logs `eat`; picking up a power-up logs `powerup`; special food logs `special`; the player killing a bot logs `kill`; the player dying logs `death`; boosting starts and stops the boost sound; a bot eating, boosting or dying logs nothing; music plays during a run and stops while paused and after death; pressing Play logs `start`.

## 4. Toggles, settings and the M key

- [x] 4.1 Add `sound` and `music` to settings (default on, booleans only, decision 6), saved immediately on toggle. Add the two corner buttons to the main menu and pause panels (decision 7) with `aria-pressed`, and the M key with the in-game feed line. Verify with browser tests that: both start on; turning sound off silences effects and music (nothing logged) and survives a reload; turning music off leaves effects on and survives a reload; M toggles sound in the menu and during play, but typing "m" in the nickname doesn't; settings saved before this change (no `sound`/`music`) load with both on and keep the other fields; the menu still fits the phone sizes in `tests/browser/layout.test.js`.

## 5. Docs

- [x] 5.1 Add M (sound) to the keyboard hints in the menu, keeping it on one line where it fits, and verify the phone layout test still passes (touch phones hide those hints).

## 6. Release and integration

- [x] 6.1 Run `node --test tests/browser/massive.test.js tests/simulation.test.js` with audio unlocked during the frame-time check, and verify the smoke limits pass.
- [x] 6.2 Bump `VERSION` in `sw.js` to 1.29.0 (with `audio.js` in `FILES`). Run `node --test "tests/**/*.test.js"` and verify everything passes, including `tests/fixtures/save-v1.json` loading and the offline-app tests seeing `audio.js` cached.
- [ ] 6.3 Check on a real phone (iPhone if possible): sound starts after Play, the boost whoosh follows the boost button, music pauses with the game and when switching apps, and the mute buttons work.

## Workflow follow-up

- Open the PR with `Closes #9`, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- After merge, run `/opsx:archive` to sync the `audio` and `controls` specs and archive this change.
