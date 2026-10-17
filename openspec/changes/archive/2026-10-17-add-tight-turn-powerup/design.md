# Design

## Context

- **Turning** (`Worm.update` in `engine.js`): each tick, the heading turns toward `targetAngle` by at most `turnRateFor(r) × dt`. It's ×0.85 while boosting. `turnRateFor` falls from 5.4 rad/s at radius 14 to about 2.6 rad/s at the maximum radius of 62.
- **Power-ups:** they are defined in one table, `POWERUP_WEIGHTS` (`magnet 30, x2 22, x5 5, speed 20, zoom 14`). That table drives spawning (`weighted()`), and save validation (`validateSnapshot` accepts exactly its keys for `pw` and for arena power-up types). Each worm's `pw` starts from a fixed default object.
- **Display** (`main.js`): `POWERUP_INFO` gives icon, label and colour, and is used for the arena sprites, the HUD timers and the feed.
- **HUD timers:** a column at top-left, about 34 px per timer. On touch screens it starts below the pause button. On a 640×360 phone, six timers plus the score block (with the #37 badge inline) would collide.

## Goals / Non-Goals

**Goals:**
- Add the power-up through the existing tables, so spawning, pickup, saving, the HUD and the feed work with no new code paths.
- Keep the touch HUD free of overlaps with every timer showing.

**Non-Goals:**
- Changing bot AI. Bots already detour to nearby power-ups of any type, and the faster turning applies to them through the same `Worm.update`.

## Decisions

### 1. Key `turn`, weight 14, a ×2 turn-rate multiplier in `CFG`
- **Table entry:** add `turn: 14` to `POWERUP_WEIGHTS`, the same rarity as zoom, so it is about 13% of spawns. Add `turn: 0` to the `pw` default object.
- **Turning:** `Worm.update` multiplies the maximum turn by `CFG.TURN_POWER_MULT` (2) while `pw.turn > 0`, on top of the boosting factor. Boosting with tight turns therefore turns 1.7× as fast as normal.
- **Steering input:** the player's keyboard turning (`input.keyAngle`, 4.2 rad/s) only sets the target heading. It is already faster than a small worm can turn, so the doubled rate shows up with both mouse and keyboard.

*Alternatives:*
- A fixed turn rate during the power-up: rejected because it would help small worms more than big ones, which the request doesn't want.
- 3×: rejected because the user chose 2×.

### 2. Icon 🌀, label "Tight turns", colour `#8ac926`
- **Look:** an emoji like 🧲 ⚡ 🔭, drawn with the existing emoji branch of the sprite code. Green isn't used by the other power-ups, so it stays distinct in the arena and the HUD.
- **Assets:** none. The emoji renders with system fonts, so `FILES` and `file://` are unaffected.

### 3. Compact timers on short touch screens
- **Rule:** inside `@media (pointer: coarse) and (max-height: 520px)`, `.pw` gets less padding and gap and a slightly smaller font, about 26 px per timer instead of 34. Six timers then end above the score block at 640×360.
- **Scope:** desktop and taller screens are unchanged.
- **Test:** `tests/browser/layout.test.js` turns on all six power-ups, plus the boost badge if #37 has landed.

### 4. Backward compatibility comes from the defaults
- **Old saves:** worms in old saves have no `turn` key. `Object.assign` with the default object fills in `turn: 0`, and validation accepts saves without it.
- **Tests:** the engine test loads `tests/fixtures/save-v1.json` and a hand-made save whose worm `pw` lacks `turn`. It also round-trips a save that contains an active `turn` timer and an arena `turn` power-up.

## Risks / Trade-offs

- **Rollback:** an older release rejects saves containing `turn`. → It starts a fresh world and leaves stats untouched, the existing behaviour for unreadable worlds. Rolling back is rare, and the proposal notes it.
- **Balance:** bots with tight turns become slightly harder to escape. → The effect is short, at zoom-like rarity, and the weight and multiplier are constants that are easy to tune after playtesting (#16).
- **Emoji rendering:** 🌀 may look different across platforms. → This is the same trade-off as the existing emoji icons.
- **Order with the boost indicator (#37):** both touch the HUD and the layout test. Whichever lands second keeps both the badge and all six timers in the overlap test.

## Migration Plan

No migration. Bump `VERSION` (minor) in `sw.js`. To roll back, publish the previous code under a higher version; worlds with the new power-up are replaced by a fresh world on the older release.
