# Design

## Context

All three changes are drawing-only and live in `main.js`:

- **Floor:** `makeHexPattern()` draws one 138×80 tile of flat-top hexagons (46 units from centre to corner) on an offscreen canvas once at start-up; `render` fills the visible world rectangle with it as a `CanvasPattern` under the world transform, so it moves and scales with the camera.
- **Food:** `render` draws each piece of food at `f.r × 5` (Classic dot sprite) or, in a themed arena, a glow at `f.r × 4.8` with the item at `f.r × 4`, both pulsing ±12%.
- **Camera:** `targetZoom(p) = baseZoom() / (1 + (p.r − 14) / 55) × (zoom power-up ? 0.62 : 1)`, eased each frame in `updateCamera`.

The owner approved a prototype (scratch copy) with the values below, compared against v1.27.1 at mass 15, 1,000 and 10,000.

## Goals / Non-Goals

**Goals:**
- Match the approved prototype exactly.
- Keep each change testable without reading pixels where a value can be checked directly.

**Non-Goals:**
- Changing the engine (food radius, pickup reach, drift, arena size).
- Making the floor themeable or animated.

## Decisions

### 1. Floor tile: big hexagons with grooves and a fine honeycomb
The tile becomes 240×139 px (world units): flat-top hexagons with S = 80 from centre to corner; the vertical radius is stretched by 139 / 138.56 so the tile repeats exactly (the current tile does the same at 80 / 79.7). Drawn in this order on a `#0e1424` base:
1. A fine honeycomb of hexagons S/8 = 10 across the whole tile, stroked 1 px in `rgba(120,140,190,0.12)`. Because 8 divides both tile sides, it tiles seamlessly.
2. Inside each big hexagon, a radial shadow from transparent at 0.4 S to 28% black at its edge.
3. Each big hexagon's outline as a 7 px groove in `#070b15`, then a 1.5 px light edge (`rgba(140,160,210,0.10)`) at 0.955 S.

The tile is still built once; filling the floor costs the same as today.

- Alternative: draw the big grid and the fine texture as two patterns. Two fills per frame and two tiles to keep aligned, with no visual gain.

### 2. Food sizes in one helper
`foodSizes(f, pulse)` returns `{ glow, item }`: Classic `glow = f.r × 6.5 × pulse`; themed `glow = f.r × 6.5 × pulse`, `item = f.r × 5.4 × pulse`. `render` uses it, and the debug hook exposes the factors, so a test can check them without sampling pixels. Special food (#143) and power-ups keep their sizes.

- Why no engine change: food already drifts toward any head within 2.2 r + 24, much farther than the new drawn size, so the bigger look doesn't change when food seems "touched".

### 3. Zoom divisor 35
`targetZoom` uses `1 + (p.r − 14) / 35`. A new worm (mass 15, r ≈ 13.95) gets the same zoom as today; relative to it the zoom is about 0.74 at mass 1,000, 0.54 at 10,000, 0.41 at 50,000 and 0.36 at 100,000 (from 0.81, 0.65, 0.52 and 0.46). The worm eats as it plays, so the test checks each settled zoom against the formula for the worm's radius at that moment. The zoom power-up factor, the easing and the menu's spectate zoom are unchanged.

- Alternatives: a divisor of 45 (barely noticeable at 10,000) or 25 (the worm stops growing on screen past about 1,000). 35 is what the owner approved.
- The existing *camera keeps zooming out past 10,000* test still holds: 50,000 vs 10,000 is 0.75 (needs < 0.9), 100,000 vs 50,000 is 0.87 (needs < 0.95).

## Risks / Trade-offs

- **[More world on screen at large sizes]** → More worms and food are drawn when big. At 50,000 the visible area is about 1.8× today's. Mitigation: worm span culling (#82) and the ridge size cut-off (#161) keep this bounded; the 50,000-mass frame-time smoke test and the GPU benchmark are rerun.
- **[Fine texture shimmer when zoomed far out]** → At zoom 0.3 the 10-unit honeycomb is 3 px and its 12% lines can shimmer. Acceptable at that faintness; if it shows on a real device, fade the texture out below a zoom threshold (a follow-up, not in this change).
- **[Bigger food overlapping]** → Dense food clusters (a dead worm's drop) overlap more. They already overlapped; items are still distinct at normal zoom in the prototype.

## Migration Plan

Drawing only; ships as a minor version bump. Rollback is a normal higher-version revert.
