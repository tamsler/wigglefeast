# Design

## Context

See proposal.md for why. What exists today:

- **Profile** (`main.js`): `emptyProfile()`, `cleanProfile()` (rebuilds a profile from checked fields; optional fields such as `ach` default when missing and damaged entries are dropped; `PROFILE_VERSION` stays), `loadProfile()`, `saveProfile()` (only the active window writes), `recordRun()` and `checkAchievements()` (both re-read the stored profile and merge so another window's data survives, #45), export/import (`importSave`, `cleanProfile(data.profile)`), and `resetStats` (`profile = emptyProfile()`). The player's habits are separate (`wormarena.habits`, never exported).
- **Input**: mouse (`input.mx/my`), keys (`heldKeys`), touch (drag steers, a second finger or the boost button boosts). All of them end up as `p.targetAngle` and `p.wantBoost` in `applyInput`, and the engine sets `p.angle` and `p.boosting`.
- **Frame loop** (`frame()`): the game steps only when `mode` is not `paused` or `standby`; the HUD updates each frame. `mode` is `menu | playing | dead | paused | standby`.
- **Transient messages**: `#feed` (top centre, kill and power-up messages) and `#achToast` (top centre, achievements) take no clicks; the learning cue (#138) is drawn on the canvas.
- **Layout**: the HUD areas are fixed by the HUD layout requirement and `tests/browser/layout.test.js` (minimap top-left, leaderboard top-right, score bottom-left, touch buttons bottom-right and top-right, feed top centre). The player's head is held at the middle of the screen by the camera.
- **Menu help**: `.help .desk` and `.help .touch` lines switch by `(pointer: coarse)` in CSS.
- There is **no settings screen** (#13 is open); the stats screen has the export, import and reset buttons.

## Goals / Non-Goals

**Goals:**
- A new player learns steer, boost, the danger rule and power-ups in their first run without a modal.
- Hints can't get in the way: no input taken, none over the head, none overlapping the HUD, none while paused.
- Backward-compatible profile: old saves and `save-v1.json` load; nobody who has played sees hints.

**Non-Goals:**
- A settings screen, hints for later features, any change to controls, difficulty, bots or the engine.

## Decisions

### D1. Four hints, one at a time, in a fixed order

Steer, boost, danger, power-ups; the next starts only when the current one has ended. One pill at a time keeps the screen calm and the order teaches in the order a player needs it.

Alternatives: *all four at once* (clutter, covers more of the screen); *a fixed timeline* (a slow player misses a hint before doing the thing, a fast one waits). Rejected.

### D2. A hint ends by the player doing the thing, or by being read

| Hint | Ends when | Also ends after |
|---|---|---|
| Steer | the worm has turned a quarter turn in total (π/2 radians of change in its heading) | nothing: a player who never turns is probably not playing |
| Boost | the worm has been boosting for 0.5 s in total | nothing: it waits for the player to try |
| Danger | on screen for 6 s | (that is its rule) |
| Power-ups | the player collects a power-up | 6 s on screen |

Every hint stays at least 2.5 s so it can be read even if the player acts at once. A hint counts as seen when it ends. The triggers read the running game each frame (`p.angle`, `p.boosting`, the power-up event for the player), not mouse, key or touch events, so one rule covers all three input methods, and a hint that needs the boost button on touch is satisfied by the button, a second finger or Space alike.

"Shown for N seconds" alone was considered for all four; rejected for steer and boost because the point is that the player *tries* it.

### D3. A small controller in the frame loop, only while playing

State: the current hint, how long it has been visible, the heading it started from, the turn so far, the boost time so far. It advances in `frame()` only when `mode === 'playing'` and the player is alive, using the frame's `dt`, so pausing (`mode === 'paused'`), the menu, the death screen and another active window (`standby`) freeze it. The pill is hidden outside `playing` and comes back with its state. State resets per run (a hint not yet ended starts over on the next run), since the player may have died halfway.

### D4. Seen hints live in the profile as an optional field

`profile.tips`: a map of hint id → time seen, like `ach`. `PROFILE_VERSION` is unchanged, so old files load, older app versions ignore the field, and the export carries it as the issue asks. `emptyProfile()` has `tips: {}`; `cleanProfile()` keeps only known ids with a valid time. When the field is missing, an old profile with `totals.games > 0` is treated as having seen every hint (stamped 0), one with none as having seen none: "a profile with runs means they have played". That rule applies to imports as well. Marking a hint seen re-reads the stored profile and unions the seen hints (as `checkAchievements` does for achievements) before saving, so another window's data isn't lost, and only the active window writes.

Reset stats keeps `tips` (the player has learned the game; "Show tips again" is the explicit way back). Import replaces the profile as a whole, tips included. A separate storage key like the habits was considered and rejected: the issue asks for the profile, and the habits are never exported, which would lose the setting on a move to a new device.

### D5. No dismiss control

Hints take no pointer or key input, so they can't swallow a steering drag or a boost press (the acceptance criterion). A ✕ or tap-to-dismiss would have to take a tap, a hidden key would be undiscoverable, and Escape already pauses. Instead each hint goes away by itself within seconds: when the player does the thing, or after 6 s. Hints are on only until seen, so a player who doesn't want them is done with them after the first run or two.

### D6. Placement and look

A pill at the bottom centre (`position: absolute; left: 50%`) with `width: max-content` (a `left: 50%` box would otherwise be capped at half the screen and wrap needlessly) and `max-width: min(80vw, 380px)`. On a mouse screen it sits 72 px above the bottom, which is above the score row; on touch screens 100 px up, above the 76 px boost button and the safe area. `pointer-events: none`, `role="status"` with `aria-live="polite"`, a fade of about 0.25 s, and no transition under `prefers-reduced-motion: reduce`. On screens under 420 px tall it is one line of 13 px text (up to 460 px wide) so that it stays below the head. The camera keeps the head in the middle of the screen, so the pill doesn't cover it; the body may pass under the pill, which is translucent and takes no input. Top centre is already used by the feed and the achievement toast.

A mouse window under 420 px tall (for example 640×360 on a desktop) has no room: the leaderboard there is ten rows tall, as high as the screen allows beside the pill. The pill is hidden by CSS (`display: none`) and the controller treats a hidden pill as "not shown", so no hint counts as seen there. Touch screens use the short leaderboard (top five), so they are not affected.

### D7. Wording and touch

Two spans per hint, `.desk` and `.touch`, switched by `(pointer: coarse)` like the menu's controls line (the same rule the menu uses, so a touch laptop behaves as the menu does). The wording is in the spec. The boost hint says "costs a little size" because boosting spends mass.

### D8. "Show tips again" on the stats screen

A ghost button in the stats screen's button row ("Show tips again"). It clears `profile.tips`, saves, and shows a short confirmation on the button ("Tips on for your next run"). No confirm dialog: it is harmless.

### D9. Test hook

`window.wigglefeastDebug.tips()` returns the current hint id (or null) and the seen ids, read-only, like the other hooks.

## Risks / Trade-offs

- **A hint is still on screen when the player dies or pauses** → state is kept per D3; a death starts the hint over next run.
- **The pill overlaps the body of a worm** → it is translucent and takes no input; the spec only promises that it stays off the head and the HUD. Checked at 360×640 and 640×360 where the space is tightest.
- **A player never boosts, so the later hints never show** → they appear in a later run, once boost is tried; the first two are the ones that matter for playing.
- **Players with a profile but no games (e.g. a fresh import with zero games)** → they get the hints; that is intended.
- **Test timing** (2.5 s minimum per hint) → tests drive the hint controller through the game state (set the heading, set boosting, advance game time) instead of waiting in real time.

## Migration Plan

Ships as 1.34.0. No data migration (the field is optional and derived on first load). Rollback is a normal release with a higher version; profiles written with `tips` still load in an older build, which ignores the field.

## Open Questions

- The exact bottom offset on touch screens (about 112 px) is confirmed on screenshots at 360×640 and 640×360 while building; it changes only a CSS number.
