# Proposal

## Why

Four difficulty levels is more choice than a casual player needs, and today's Hard and Expert are close. The owner chose three levels, Easy / Normal / Hard, with Hard taking over today's Expert bots, so the top level keeps the bots that read turns, coil, trap, flank and learn the player's habits. Tracked in tamsler/wigglefeast#177.

## What Changes

- **Three levels**: the menu offers Easy, Normal and Hard.
  - Easy and Normal are unchanged.
  - **Hard plays exactly like today's Expert**: every tactic, Expert sharpness (now called Hard sharpness), about a third of bots starting large, habit learning (#135) and the learning cue (#138).
  - Today's Hard (between Normal and Expert) is removed.
- **Old data keeps loading**, with `expert` read as `hard` everywhere:
  - a remembered Expert choice becomes Hard; a remembered Hard choice stays Hard (and gets the new, tougher bots);
  - saved worlds on Expert or Hard load as Hard worlds;
  - recorded runs on Expert are shown as Hard; the Hard best becomes the higher of the old Hard and Expert bests;
  - imported exports from before the change load the same way.
- **Achievements**: Hard Mode stays "Reach 5,000 on Hard"; Expert Survivor becomes **Hard Survivor**, "Reach 10,000 on Hard", still unlocking Cosmic. Achievements already earned stay earned. The Cosmic hint reads "Reach 10,000 on Hard to unlock Cosmic".
- **Stats screen**: three best-by-difficulty tiles.

### Out of scope

- Retuning Easy or Normal, or adding a level between Normal and Hard.
- Changing what Hard bots do beyond what Expert bots do today.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bots`: three levels instead of four; Hard takes Expert's population, skills, tactics, sharpness and habit learning; old difficulty names load as Hard.
- `hud`: the learning cue shows on Hard.
- `persistence`: bests by difficulty for three levels; old runs and bests merge into Hard.
- `achievements`: Hard Mode and Hard Survivor both on the new Hard; Cosmic reward text.
- `skins`: the Cosmic unlock hint.

## Impact

- `engine.js`: `DIFFICULTY` keeps `easy` and `normal`, and `hard` takes Expert's settings (the old `hard` and the `expert` key go away); a `difficultyOf(name)` helper maps `expert` → `hard` for saved worlds (`validateSnapshot`, `Game` load); comments and `sharp` naming updated.
- `main.js`: settings load maps old names; `cleanProfile` maps run difficulties and merges bests; achievements `hard` / `expert` progress on `hard` (ids unchanged, so earned ones stay); learning cue keyed on `hard`.
- `index.html`: three difficulty buttons.
- `sw.js`: VERSION bump (minor). No new files.
- Tests: engine, bots, coil, habits and simulation tests that use `expert` move to `hard` (expectations for the old Hard removed or folded in); new tests for loading old settings, worlds, profiles and exports; achievements and picker hint tests updated; `tests/fixtures/save-v1.json` keeps loading.
