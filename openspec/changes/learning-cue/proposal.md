# Proposal

## Why

Since v1.22.0 (tamsler/wigglefeast#135), Expert bots learn how the player escapes a cut-off, but nothing on screen shows it. The owner asked for a simple sign of it: a small brain or cogs by a worm's head while it's learning (tamsler/wigglefeast#138). Seeing it helps the player notice they're being studied, which is the cue to change their style, and it helps playtests check the feature works.

## What Changes

- **Learning cue:** a small 🧠 drawn beside the head of an Expert bot while the game is watching it cut the player off, which is when the record of the player's habits is being updated. That's 0.6 s of watching; the brain then fades out over about half a second so it's noticeable.
- **Expert only:** on other levels the record is still kept, but those bots don't use it, so they show no brain.
- **Drawing only:** the engine doesn't change, so every world plays out exactly as before. Nothing new is saved.
- A read-only test hook counts the brains drawn in the last frame, like the boost-arrow hook.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `hud`: new requirement *Learning cue*.

## Out of scope

- A cue when a bot *uses* what it learned (aiming at the player's escape side). The owner asked for "while it's learning"; this can be added later with the same icon if playtests want it.
- A death message ("… read your escape"), a habits line on the stats screen, or any other UI.
- Cogs or other icon choices. The plan uses 🧠, the same emoji approach as the ⚔ kill tag; swapping the glyph later is a one-line change.
- Any setting to hide the cue.

## Impact

- `main.js`: draw the cue in the names pass, near `drawBoostArrows` and the reputation tags. It reads `game.encounter` and the level, plus a per-bot fade timer kept on the drawing side. The test hook goes in `window.wigglefeastDebug`.
- Tests: a browser test in `tests/browser/` (the cue shows for the watched Expert bot only, not on hard, and fades after the encounter ends).
- `README.md` (the Expert learning paragraph) and `sw.js` (`VERSION`, minor). No new files, so `FILES` doesn't change.
- Saves: unchanged.
