# Tasks

## 1. Skins

- [x] 1.1 Append Dragon, Thunder, Royal and Cosmic to `SKINS` in `engine.js` (design decision 1) and mark all six rewards `hidden: true` with `unlock: '<id>'` (Rainbow: noodle, Lavender: firstbite, Dragon: hunter, Thunder: marathon, Royal: titan, Cosmic: expert). Verify with engine tests that the skin list keeps every existing position, `PICKABLE_SKINS` is still the 24 free skins, a 150-bot world never gives a bot an unlockable skin, and `tests/fixtures/save-v1.json` loads.

## 2. Profile and achievements

- [x] 2.1 Extend `cleanProfile` and `emptyProfile` with `ach` and `totals.specials` / `totals.firsts` (decision 3). Verify with browser tests that an old profile (and `save-v1.json` imported) loads with empty `ach` and zero counters, a profile with valid `ach` keeps it, and invalid `ach` entries (unknown id, negative or non-number time) are dropped without rejecting the profile.
- [x] 2.2 Add `ACHIEVEMENTS` with progress functions (decision 2) and `checkAchievements(live)`, saving newly earned ones at once with the merge rule (decision 4). Run it silently on load and after import. Verify with browser tests that a stored profile with best 6,000, 120 kills, a 12-kill run and a 21-minute run earns exactly Snack Time, Big Noodle, First Bite, Apex, Hungry Hunter, Hang In There and Marathon on load, with no pop-up, and that bestByDiff on Hard / Expert drives Hard Mode / Expert Survivor.
- [x] 2.3 Check during play every 0.5 s with the live run, count special food and the first-place flag, add them to the totals in `recordRun`. Verify with browser tests that: reaching 1,000 mid-run earns Snack Time with a pop-up and survives a reload before the run ends; it isn't shown again in a later run; the 10th kill in a run earns Hungry Hunter; eating the 25th special food (with 24 stored) earns Stargazer; becoming first on the leaderboard earns Top of the Board; time while paused doesn't count toward Hang In There.

## 3. Pop-up and fanfare

- [x] 3.1 Add the `achievement` sound to `audio.js` (decision 6) and the toast (decision 5), queuing several. Verify with browser tests that earning an achievement shows the toast with its name (and "Rainbow unlocked!" for Big Noodle), logs `achievement` in the sound log with sound on and nothing with sound off, and two achievements earned at once show one after the other.

## 4. Picker and stats screen

- [x] 4.1 Show the six rewards in the skin picker after the free skins, locked ones dimmed with a padlock and "(locked)" label; clicking a locked one keeps the current skin and shows its unlock hint. Verify with browser tests that a fresh profile shows 30 swatches with 6 locked, clicking locked Cosmic keeps the skin and shows "Reach 10,000 on Expert to unlock Cosmic", after earning Big Noodle Rainbow is pickable and plays as Rainbow, and a remembered locked Lavender still loads as Lavender. Verify the phone menu still fits (`tests/browser/layout.test.js`) with the fifth row of swatches, adjusting spacing if needed.
- [x] 4.2 Add the achievements section to the stats screen (decision 5). Verify with a browser test that it lists 14 achievements with "Achievements (n / 14)", shows 3,200 / 5,000 for Big Noodle with best 3,200 and that it unlocks Rainbow, and marks earned ones with a date.

## 5. Export, import, reset

- [x] 5.1 Verify with browser tests that exporting includes `ach` and the counters; importing a save with Top of the Board earned keeps it; importing an older export earns what its stats prove; Reset stats clears achievements and locks the rewards again (a picked reward stays worn until another skin is picked).

## 6. Release and integration

- [x] 6.1 Bump `VERSION` in `sw.js` to 1.30.0 (no new files). Run `node --test "tests/**/*.test.js"` and verify everything passes, including `tests/fixtures/save-v1.json` loading.
- [ ] 6.2 Take screenshots of the picker with locked skins, the stats section and a pop-up (desktop and phone) for the PR. Check on a real phone that the picker and stats section look right and the pop-up doesn't block play.

## Workflow follow-up

- Open the PR with `Closes #14`, run the `pr-reviewer` agent, address its findings, and merge once checks pass.
- After merge, run `/opsx:archive` to sync the specs and archive this change.
