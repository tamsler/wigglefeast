# Tasks

## 1. Engine: special items exist, spawn and expire

- [x] 1.1 Add the `SPECIALS` table (nova 25/60, nebula 50/30, plasma 100/10) and `CFG.SPECIAL_DENSITY`, `SPECIAL_SPAWN_RATE`, `SPECIAL_LIFE`, `SPECIAL_BLINK`, `SPECIAL_R` to `engine.js`, plus `game.specials` and `game.specialTarget`. Export the table on `WormEngine`. Verify with an engine test that a 30-bot world's target is 5 and a 150-bot world's is about 28, the same density.
- [x] 1.2 Spawn special items in `Game.update` with the rate-based chance while below the target, at random spots within `R × 0.9`, with a weighted kind, using the world `rng`. Count their `life` down and remove them at 0. Verify with engine tests (with no worms near the items, so none get eaten) that:
  - After a simulated minute a 30-bot world holds 3 to 5 items and never more than 5, all inside the arena.
  - An item nobody eats is gone after 20 seconds.
  - The arena refills within a few seconds after one is removed.
  - Kinds drawn over many spawns follow the 60/30/10 weights.
  - Spawning happens at the same pace at 30 and 120 updates per second (like the #48 test).
  - A world still replays exactly from its seed (#100 test passes).
- [x] 1.3 Add `eatSpecials` (same reach, drift and contact rule as `eatFood`, value with no x2/x5) right after `eatFood`, emitting `special` with `{ worm, kind, value }`. Verify with engine tests that:
  - A worm gains exactly 25, 50 and 100 from each kind.
  - A worm with x5 gains 100 from a plasma sphere, not 500.
  - A worm with the magnet pulls in an item about 200 units away while one without leaves it.
  - The event fires once per item eaten.

## 2. Engine: bots and saving

- [x] 2.1 Score special items in bot `think` alongside food (same formula, within `FR` and the edge margin). Verify with an engine test that a bot with a plasma sphere and a cluster of regular food both within its range heads for the sphere. Then run the bot simulation health checks in `tests/engine.test.js` and `tests/browser/bots.test.js`, and check time per tick in a 150-bot world with `node tools/balance.js` stays about the same.
- [x] 2.2 Save special items as an optional `specials` array in `toJSON`, validate it in `validateSnapshot` (array of at most 200 items, `kind` an own key of `SPECIALS`, coordinates in bounds, `life` in `(0, SPECIAL_LIFE]`, finite phase), and load it in `load()` with `snap.specials || []`. Verify with engine tests that:
  - A save with a nebula diamond at 12 seconds round-trips with the same kind, position and remaining life.
  - `tests/fixtures/save-v1.json` and a save without `specials` load with none.
  - Saves with an unknown kind (including `__proto__`), an oversize array, or out-of-range life are rejected.
  - A world loaded from a valid save keeps producing valid saves (#31 test).
- [x] 2.3 Run `node tools/balance.js` on normal and expert with the same `--seed` before and after the change, and note in the PR any shift in survival and bot sizes. Verify the report runs and the numbers stay in the same range.

## 3. Display and docs

- [x] 3.1 Add `SPECIAL_INFO` (label, feed icon, code-drawn `draw`) and cached special sprites to `main.js`. Draw items after food and before power-ups at about 130 units including the halo (the item about 97), with pulse, a twinkling sparkle, and blinking in the last 4 seconds, the same under every theme. Expose `specialSprites()` and `specialLook(kind)` on `wigglefeastDebug`. Verify with a browser test (`tests/browser/specials.test.js`) that with a special item placed in view, each theme (Classic, Halloween, Christmas, Snacks, Tech) draws it with the same look and builds the sprite only once.
- [x] 3.2 Show `${icon} ${label} +${value}` in the feed when the player eats a special item. Verify in the same browser test that placing a nebula diamond on the player's head shows "Nebula diamond +50" and raises the score by 50.
- [x] 3.3 Add a "Special food" line to the README's How to play section (names, values, rarity, about 5 at a time, 20-second life, blinking, every theme, x2/x5 don't apply), and mention the `specials` field in the README's Saving section if it lists world contents. Verify the text matches the constants in `engine.js`.

## 4. Release and integration

- [x] 4.1 Bump `VERSION` in `sw.js` to the next minor version (no new files, so `FILES` doesn't change). Verify `.github/scripts/check-version.sh main` passes after committing.
- [x] 4.2 Run `node --test "tests/**/*.test.js"`. Verify every test passes, including the save fixture, the seed replay and the bot simulation health checks.
- [ ] 4.3 Manual check in a real browser, desktop and phone:
  - Special items appear, sparkle, blink and vanish.
  - Eating one grows the worm and shows the feed message.
  - They look the same in every theme.
  - Bots go for them.
  
  Verify by noting the result in the PR.

## Workflow follow-up

- Open a PR that closes tamsler/wigglefeast#143, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- Archive the change with `/opsx:archive` after merge.
