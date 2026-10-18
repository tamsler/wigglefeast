# Design

## Context

- **Sizes** (`engine.js`): `radiusFor(m) = min(62, 9 + 2.2·m^0.3)`, `lengthFor(m) = 40 + 9·m^0.72`, segment spacing `0.42·r`, and turn rate `5.4 / (1 + (r − 14)/45)`.
- **Shedding:** `CFG.SHED_ABOVE = 1500`, `CFG.SHED_RATE = 0.004` per second of the excess. The shed mass simply disappears.
- **Camera** (`main.js`): `targetZoom = baseZoom / (1 + (r − 14)/55)`, so it zooms out with the radius and stops when the radius stops at 62.
- **Drawing:** `drawWorm` skips a worm whose bounding box is off-screen. Otherwise it draws every segment.
- **Save limits:** `MAX_MASS` 1e6, `MAX_SEGMENTS` 20,000. A 100,000-mass worm under the new curve is about 17,250 long at spacing about 33, roughly 520 segments, well inside the limits.
- **Headless runs** (12 min, careful stand-in): relaxing shedding barely changes the median top bot (Normal about 7–8k, Expert about 3.6k), because bots die first. The maximum rises (Normal 14k → 23k).

## Goals / Non-Goals

**Goals:**
- A worm that keeps winning can reach and hold tens of thousands of mass.
- A massive worm looks massive (thick) without filling the arena with body.
- Sizes below mass 10,000 don't change.

**Non-Goals:**
- Scaling the arena with the biggest worm.

## Decisions

### 1. Shedding: above 10,000 at 0.2% per second
Holding mass *m* takes an intake of `0.002·(m − 10000)` per second: 20 a second at 20,000, 80 at 50,000. Holding 50,000 means steadily eating big worms, which is "massive if good" and still bounded.

*Alternative:* removing shedding altogether. Mass would only ever go up for a survivor, and saves and leaderboards would drift toward absurd numbers.

### 2. Shape above 10,000: length `L(10000)·(m/10000)^0.4`, radius cap 90
- Both curves are continuous at 10,000, so nothing below changes.
- Length: 50,000 → about 13,100 (was 21,800); 100,000 → about 17,250.
- Radius: same formula with the cap raised to 90, so 66 at 50,000 and 79 at 100,000.
- Turning slows with the radius as today (2.2 rad/s at r 79, a turning circle of about 104). Big worms stay big and slow.

*Alternative:* a hard length cap. It would make growth invisible past the cap.

### 3. Camera
`targetZoom` already scales with `r`, so raising the radius cap lets it keep zooming out (about 0.55× of today's maximum zoom-out at r 79). No formula change is needed, only a check that the view still feels right at r 80–90.

### 4. Draw only the visible part of long bodies
`drawWorm` walks the body and draws only runs of segments whose points (plus `r`) intersect the view. The existing per-worm box check stays as the fast path. This keeps drawing proportional to what's on screen when a 500-segment worm crosses it.

*Alternative:* leaving it. 500 segments isn't much, but several massive worms at 150 bots (#81) add up.

### 5. Measuring
- `tools/balance.js`: top-bot sizes stay in the same range as today. Bots are limited by survival.
- An engine test grows a scripted worm by feeding it, to confirm it can hold 30,000+ with enough intake.
- A browser check times frames with the player at 50,000 mass.

## Risks / Trade-offs

- [A massive bot dominates the arena] → bots rarely get there, because they die first. The thicker-not-longer shape limits how much arena any worm can wall off. `tools/balance.js` checks the top-bot share stays near 0.16–0.18.
- [Old high scores become easy to beat] → accepted: bigger worms are the point.
- [Existing worlds with worms above 10,000 change shape on load] → their size is derived from mass, so they just look a little thicker and shorter. Nothing breaks.
- [Massive worms' head-on advantage] → unchanged rule: the bigger worm wins head-on. A massive worm turns slowly, so it's still vulnerable to cut-offs.

## Migration Plan

Ships as one minor release. There's no data migration.
