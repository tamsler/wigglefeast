# Design

## Context

See proposal.md for why. What exists today:
- **Engine (#135):** `game.encounter` is `{ bot, start, … }` while a cut-off on the player is being watched (0.6 s, `CFG.HABIT_WINDOW`), otherwise `null`. It's a plain field, not saved, and runs on every level. Only Expert bots know the `learn` tactic (`knowsTactic(bot, level, 'learn')`).
- **Drawing (`main.js`):** the names pass draws every on-screen worm's name above its head, after all bodies, so text sits on top. The ⚔ kill tag is an emoji drawn with `fillText`. `drawBoostArrows` counts what it draws for the test hook `window.wigglefeastDebug.boostArrows()`.

## Goals / Non-Goals

**Goals:**
- Drawing only. `engine.js` doesn't change, so worlds and saves are untouched.
- Cheap: nothing extra per worm per frame beyond one lookup.

**Non-Goals:**
- Any engine event or new saved state.
- Animating the brain beyond a soft pulse and the fade.

## Decisions

### 1. Who shows it and when
- A bot shows the brain while it is `game.encounter.bot`, the level is one where it knows `learn` (Expert), and it is on screen.
- Drawing keeps a small `Map` from worm to "last seen learning" time, using the page clock (`t`). When the encounter ends, the brain fades from full to nothing over 0.5 s, then the entry is dropped. A dead bot's entry is dropped right away.
- A fresh world (`newGame`) clears the map.

*Alternative:* add a "learning until" time to the engine's encounter. Rejected: it would touch the engine for a purely visual need, and the page clock is what the fade should follow anyway (it keeps fading even while the game is paused, which is fine for 0.5 s).

### 2. Where and how it looks
- 🧠 emoji, drawn with `fillText` in the names pass, so it's on top of bodies like the names are.
- Placed just beside the head, on the side away from its heading, at about the head's height: `head + normal × (r + size)`. The size scales with zoom like the names (`18 / z` px, at least the worm's radius), so it stays readable at every size.
- A soft pulse (alpha 0.75–1, about 3 Hz) while watching, then the fade.
- Not part of the name label, so the ⚔ tag and the red-orange retaliation colour stay as they are.

*Alternatives:* cogs (⚙): less clear as "learning", and the owner said brain or cogs, so either is fine; 🧠 was picked. A drawn vector brain: more code for no gain, since emoji already work offline (#83's ⚔).

### 3. Test hook
- `window.wigglefeastDebug.learningCues()` returns how many brains the last frame drew, and `learningCue(id)` returns that bot's current alpha (0 when none). Read-only, like `boostArrows()`.

## Risks / Trade-offs

- **[The window is short (0.6 s), so the brain could be missed]** → the 0.5 s fade makes it last about 1.1 s. If playtests still find it too brief, lengthen the fade. That's a drawing constant, not a spec change.
- **[Emoji look differs by platform]** → the same is true of ⚔ today, and it has been fine.
- **[A busy screen]** → only one bot at a time can show it (one encounter at a time, at least 1 s apart).

## Migration Plan

Nothing to migrate. Rollback is a normal higher-version release.
