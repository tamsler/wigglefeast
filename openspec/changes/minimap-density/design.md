# Design

## Context

`renderMinimap()` in `main.js` runs every frame. It clears the minimap canvas (110 or 160 CSS px, times the device pixel ratio), draws the arena disc and edge ring, then a dot per bot head from `game.leaderboard` (the top 10 larger and in `skin.accent`), then the player marker and view rectangle. The engine keeps each worm's body as `sx`/`sy` arrays and its radius `r`. A world has about 1,000–5,000 body segments at 30–60 bots, and more with #81.

## Goals / Non-Goals

**Goals:**
- Density only, one colour, soft-looking, readable at 110 px.
- Cost independent of frame rate, and small at the highest bot count #81 allows.

**Non-Goals:**
- Exact coverage. This is a hint at a glance, not a measurement.

## Decisions

### 1. A coarse grid of covered area, refreshed every 250 ms
A 40 × 40 grid covers the arena's bounding square. Every 250 ms (and once when a run starts), each segment of every live worm except the player adds its covered area (`2 · r · spacing`, about the body area that segment stands for) to the cell under it. Each cell's total is then divided by the cell's area, giving a coverage fraction.

The cost is one pass over all segments four times a second: about 5,000 additions at 60 bots, and well under a millisecond even with #81's larger worlds.

*Alternative:* plotting every segment as a translucent blob on the minimap canvas each frame. It looks good, but the cost grows with segments every frame, and overlapping blobs saturate unevenly.

**Changed during apply:** the grid is **24 × 24**, and each cell is averaged with its neighbours (1-2-1 weights in both directions) before drawing. Looking at real minimaps, a 40 × 40 grid traced each worm's body as a recognisable squiggle, which goes against "no individual worms". The coarser, smoothed grid reads as soft clouds. The coverage drawn at full strength (`C`) was tuned to **0.18** by eye at 5, 30 and 60 bots, at 160 px and 110 px.

### 2. Draw the grid as a smoothed image, clipped to the arena circle
The grid is written into a 40 × 40 offscreen canvas as `ImageData`. Every pixel gets the same colour (a light cyan, `#7fdcff`), with alpha = `min(1, sqrt(coverage / C))`. `C` is the coverage that counts as "full", about 0.25 to start, tuned by eye during apply. The square root lifts sparse areas so a lone small worm still shows faintly.

Each frame, the offscreen canvas is drawn scaled up to the minimap with image smoothing on, which gives the soft look for free. It's clipped to the arena circle, over the dark disc and under the edge ring, player marker and view rectangle.

*Alternative:* a Gaussian blur filter on the canvas. `ctx.filter` isn't supported everywhere (Safari), and it's slower.

### 3. Player excluded, everything else equal
The player's own body is skipped (spec). Every other worm counts the same per unit of body area. Size only shows because a big worm covers more area, never through colour or a marker.

### 4. Test hooks
The shading is read straight from the minimap canvas in a browser test. It uses `getImageData` on `#minimap` to compare a crowded quadrant with an empty one, and checks that the shaded pixels are close to the single shading colour (no skin colours). The test builds the crowd through `window.__game`, as other browser tests do, and waits past the 250 ms refresh.

## Risks / Trade-offs

- [Too faint or too strong at some bot counts] → `C` is tuned by eye at 5, 30 and 60 bots on both minimap sizes during apply. It can be retuned after #81.
- [Up to 250 ms lag] → a minimap hint doesn't need to be live. Positions only move about 60 px (world units) in that time, which is under a minimap pixel at default sizes.
- [Players miss spotting the leader] → intended (owner's request). The leaderboard still names the leaders.

## Migration Plan

Ships as one release (minor bump). There's nothing to migrate.
