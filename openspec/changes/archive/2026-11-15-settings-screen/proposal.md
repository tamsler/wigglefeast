# Proposal

## Why

Wigglefeast has no place for preferences. Issue tamsler/wigglefeast#13 asks for a Settings screen because older phones can struggle with full-quality rendering, sound can only be switched on or off (no volume), bot names can't be hidden, and the "Show tips again" button is tucked away on the Stats screen. Players who want a calmer, lighter or quieter game have nothing to adjust.

## What Changes

- A **Settings** screen, opened from a button on the main menu and on the pause panel. From the menu, Back returns to the menu; from the pause panel, Back returns to the paused game (the run stays paused). Esc or P closes it first.
- **Graphics quality: High / Low.** High is exactly today's look. Low draws food as a plain dot with no glow halo, leaves off the soft highlight and light rim on worm bodies, and caps the canvas at one pixel per CSS pixel (on a 2x phone that is about a quarter of the pixels). Gameplay, collisions, ridges, outlines and eyes do not change.
- **Sound**: three sliders, **Master**, **Effects** and **Music** volume. 100% on all three is today's loudness. The corner Sound and Music buttons and the M key stay as quick mutes, and keep their meaning.
- **Show bot names**: on (default) or off. Off hides the name, kill tag and red-orange "coming for you" colour over bots. The player's own name stays, and the leaderboard still lists every name.
- **Show tips again** moves from the Stats screen to Settings (the Stats screen keeps Export, Import and Reset stats).
- All of it is remembered between sessions in the existing `wormarena.settings` value. Settings saved by older releases load with every new setting at its default, so nothing changes for existing players until they open Settings.
- Release: `VERSION` in `sw.js` goes from 1.36.1 to 1.37.0. No new game files.

Decisions made with the owner for this plan:
- Sound gets three sliders (master, effects, music), not a single volume.
- Low graphics drops food glow, body highlight and canvas resolution; ridges stay.
- "Show tips again" moves to Settings rather than being duplicated.
- Bot names off hides bot labels only, not the player's own.

Out of scope:
- Choosing the graphics quality automatically, or detecting a slow device.
- More quality tiers than High and Low, a frame-rate counter, or a resolution picker.
- Changes to the skins, food themes or difficulty pickers (they stay on the main menu).
- Keyboard or touch control remapping, languages, accessibility modes.
- Putting settings in exported save files (exports keep holding the profile and world only).
- Changing the sound effects or music themselves.

## Capabilities

### New Capabilities
- `settings`: the Settings screen: how it is opened and closed from the menu and the pause panel, the graphics quality setting and what Low changes, the show-bot-names setting, and how all settings are remembered and loaded from older saves.

### Modified Capabilities
- `audio`: adds master, effects and music volume levels, set in Settings; the corner buttons and the M key stay as mutes.
- `first-run-hints`: the "Show tips again" button moves from the Stats screen to the Settings screen.
- `hud`: a worm's name label and reputation tag are not shown over bots when bot names are off.

## Impact

- `index.html`: a Settings button on the menu and pause panel, the Settings overlay; "Show tips again" leaves the Stats buttons.
- `main.js`: load and save the new settings with checked fields; the open, close and back handling; Low graphics in `resize()` (canvas resolution), `render()` (food sprites) and `paintBody()` (highlight and rim); skipping bot labels; volume wiring; the debug hook for tests.
- `audio.js`: an effects bus and levels for master, effects and music.
- `style.css`: the Settings overlay, sliders and the segmented control.
- `sw.js`: `VERSION` bump.
- Tests: `tests/browser/` for the screen, each setting, persistence and old-settings loading; `tests/browser/hints.test.js` moves the button; `tests/fixtures/save-v1.json` must keep loading.
- Specs: new `settings`; deltas for `audio`, `first-run-hints` and `hud`.
