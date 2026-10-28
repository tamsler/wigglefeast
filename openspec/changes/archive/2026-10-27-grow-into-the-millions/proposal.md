# Proposal

## Why

Worms can't realistically grow past a few tens of thousands (the largest bot after 30 simulated minutes is about 11,000 to 34,000): mass sheds 0.2%/s above 10,000, the radius stops growing at 90, boosting bleeds 0.5% of mass per second, and saves reject any worm above 1,000,000 mass. In the classic .io games, a long run ends with a worm in the millions, a huge trophy that every other worm hunts. Wigglefeast has no such late game. This change opens one up, for the player and the bots alike (tamsler/wigglefeast#204). The target is worms in the hundreds of thousands in a long run, with the millions possible but rare; balance runs showed that lifting the limits alone leaves the largest bot under about 120,000, so big worms also get more out of arena food.

## What Changes

- **Shedding moves out of the way.** The slow loss of mass above 10,000 moves up to 2,000,000, so a worm grows unchecked through the hundreds of thousands and only meets a soft ceiling in the millions.
- **Big worms get more out of arena food.** Above mass 1,000, natural food is worth its value times (mass / 1,000)^0.6: 4x at 10,000 and 16x at 100,000 (bots too). Food dropped by worms and special food are never scaled, so no mass is made out of corpses. This is what lets a worm that keeps surviving snowball.
- **Richer natural food.** The largest natural pellet changes from 8 to 10 mass and becomes more common (tiers 1, 2, 4 and 10), so a meal is worth more at every size.
- **New x10 power-up.** Multiplies the value of natural food by 10, above x5 and rarer than it. Like x2 and x5 it never multiplies food dropped by worms (the #16 rule stays).
- **Boosting is cheaper for big worms.** The mass share of the boost cost is halved (0.5% to 0.25%) and the cost is capped at 150 mass per second, so a million-mass worm doesn't lose 5,000 mass per second (and drop 3,000 of it as food) just by speeding up. Small worms barely notice.
- **Worms keep thickening.** The radius cap rises from 90 to 300 on the same slow curve (about 148 at 1,000,000 mass), and the camera keeps zooming out with it.
- **Length is held back past 100,000.** Above 100,000 mass the body grows much more slowly in length, so a million-mass worm is about as long as today's 50,000-mass one and doesn't wall off the arena.
- **Big corpses stay readable.** A dying worm leaves 80% of its mass as food as before, but the biggest pellets are drawn larger (the food radius cap rises from 20) so a 2,000-mass pellet from a giant doesn't look like a snack.
- **Seven-digit numbers fit.** The score, leaderboard, game-over screen and stats show values up to the tens of millions without clipping or misaligned columns.
- **A new world starts with giants.** At least 3 bots (one per 10 bots in bigger worlds) start at 20,000 to 35,000 / 55,000 / 80,000 mass on Easy / Normal / Hard, so there is something huge to look up to and hunt from the first minute. Their bodies start short enough to fit the arena and reach full length as they move.
- **Save limits move.** The save validator's mass ceiling rises from 1,000,000 to 100,000,000. Old saves and `tests/fixtures/save-v1.json` still load; a save with an x10 power-up does not load in an older version of the app.

Out of scope: scaling special food or dropped food, replacement bots (they start small as today), the player's starting mass, new achievements or skins for the millions (the existing ones keep their thresholds), abbreviated numbers such as "1.2M", changes to special food values or to the arena size, new bot tactics, per-difficulty tuning of the new numbers, and any change to how kills are credited or how dropped food is valued.

## Capabilities

### New Capabilities
<!-- None: this extends existing behavior. -->

### Modified Capabilities
- `gameplay`: movement and growth (shedding threshold, size curves, radius cap), camera zoom scenarios, boosting cost, power-ups (adds x10), natural food values, and the food a dead worm leaves.
- `hud`: the score and leaderboard show seven- and eight-digit scores without clipping or misaligned columns; the power-up badge for x10.
- `bots`: a new world starts with giants, and a giant's body starts inside the arena.
- `persistence`: the largest mass a save may hold, and loading saves written before the x10 power-up.

## Impact

- `engine.js`: `CFG` (SHED_ABOVE, BOOST_COST_SHARE, new BOOST_COST_MAX), `radiusFor`, `lengthFor`, `foodRadius`, natural food weights in `spawnNaturalFood`, `POWERUP_WEIGHTS` and `Worm.multiplier` (x10), `MAX_MASS` and the snapshot validator.
- `engine.js` (more): `spawnBot` and `DIFFICULTY` (giants), and how `Worm` lays out a new long body.
- `engine.js` (more): the size bonus on eating natural food (`CFG.GROWTH_FROM`, `CFG.GROWTH_POWER`).
- `main.js`: `POWERUP_INFO` (x10 badge), HUD sizing for long numbers, food sprite choice (`itemIndex`) if the new radii need it.
- `style.css`: leaderboard and score column widths.
- `tests/`: engine and bot tests for the starting giants, engine tests for the new curves, shedding, boost cost and x10; browser tests for layout with 8-digit scores, camera zoom at 1,000,000, and frame time with a giant on screen; `tools/balance.js` runs to tune and confirm the economy.
- `sw.js`: `VERSION` bump (minor).
- Seeded worlds (#100): adding a power-up type and changing the natural food table changes what a given seed spawns, so tests that pin a seed's exact outcome may need updated expectations.
- Balance risk: the size bonus mints mass for big worms, so its exponent is the main lever: in 30-minute Hard runs 0.4 left the largest bot near 100,000, 0.6 gave 150,000 to 350,000, and 0.8 ran away to the mass cap. The design sets 0.6 and a simulation bar; the numbers are expected to need a last tuning on every level.
