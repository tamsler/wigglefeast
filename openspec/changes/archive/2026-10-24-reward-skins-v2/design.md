# Design

## Context

- Skins live in `SKINS` (`engine.js`), saved by position. The six rewards are `Rainbow` (index 3), `Lavender` (8) and the four appended after `Abyss` (Dragon, Thunder, Royal, Cosmic). Each has `hidden: true` and `unlock: '<achievement id>'`; bots only pick from `PICKABLE_SKINS`.
- `main.js` draws every worm through `paintBody`, which uses a `FINISH[skin.finish]` table of `{ color(skin, a, n, t), under?, marks?, soft? }`: a tube coloured per band, ridges and highlight, then markings. The picker swatches and the menu preview call the same code.
- A working scratch prototype of all six finishes exists (outside the repo); this change brings it into the game.

## Goals / Non-Goals

**Goals:** the six looks as the owner approved them; saves, unlocks and positions untouched; the same drawing path for arena, swatches and preview.

**Non-Goals:** reduced-motion variants; changing which achievement unlocks which skin.

## Decisions

### 1. Replace in place, by position
The six entries keep their index and `unlock` id and get new `name`, `finish`, `colors`, `accent` and `food`:

| Position | Was | Becomes | Unlock |
|---|---|---|---|
| 3 | Rainbow | Holo | noodle |
| 8 | Lavender | Ghost | firstbite |
| 26 | Dragon | Inferno | hunter |
| 27 | Thunder | Storm | marathon |
| 28 | Royal | Crystal | titan |
| 29 | Cosmic | Galaxy Prime | expert (Hard Survivor) |

Picker order stays Rainbow-slot, Lavender-slot, then the four, so Holo and Ghost come first. Saved worlds and settings referring to these positions keep loading and show the new look. The accent and food colours are the prototype's (Inferno orange/gold, Holo cyan/pink/yellow, Storm cyan/white, Crystal pale ice, Ghost aqua, Galaxy Prime pink/cyan/white).

### 2. Six finishes in the existing table
Added next to `galaxy`, `pulse` and the rest, using the prototype code:
- **Additive glows**: a small helper draws with `globalCompositeOperation = 'lighter'` and restores it, used for glows and bright marks.
- **inferno**: dark per-band colour; a pulsing orange glow under the body; cracks (jagged lines across the body, brightness travelling toward the tail, three brightness levels batched into three paths) plus two winding veins.
- **holo**: per-band colour from `hsl(hue)` shifting with position and time; a white sweep that travels the length; twinkling crosses.
- **storm**: dark blue bands with a soft blue glow; four bolt slots flashing for about half a second each, each a 7-segment zigzag stroked wide in blue and thin in white.
- **crystal**: pale ice bands with per-band shade; diamond facets outlined every 3 segments; sparkles flashing on the edges.
- **ghost**: `alpha: 0.38` so the tube, ridges and highlight are drawn see-through, a strong soft glow underneath; eyes drawn afterwards at full alpha.
- **galaxyprime**: slowly shifting nebula colours, the existing galaxy stars, drifting soft nebula clouds, and a shooting star every few seconds.

### 3. `paintBody` alpha
A finish may set `alpha`; `paintBody` multiplies the incoming alpha by it for the body, ridges and markings, applies `under` at the incoming alpha, and restores the incoming alpha at the end (so eyes and arrows are unaffected). Existing finishes don't set it and draw exactly as before.

### 4. Cost
Only the player wears rewards, so one worm per frame pays for them. Crack and bolt geometry is batched into a few paths; per-segment work is a few arithmetic ops. The 50,000-mass frame-time check runs with Inferno and Galaxy Prime as the player's skin.

## Risks / Trade-offs

- **[Old worlds change look]** → A saved bot or player in Rainbow now shows Holo. Intended by the owner's "replace", and invisible to bots in new worlds (bots never wear rewards).
- **[Neon-style contrast]** → Dark bodies (Inferno, Storm, Galaxy Prime) rely on glows to read against the dark floor; the prototype screenshots checked this, and the swatch test verifies each swatch isn't blank.
- **[Additive blending on busy arenas]** → Bright marks can look hot over bright food; accepted.

## Migration Plan

None: positions and ids are kept. Minor version bump; rollback by revert (older versions would show the old looks at the same positions).
