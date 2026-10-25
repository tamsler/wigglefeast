# Proposal

## Why

Saved stats exist, but once a run ends there's nothing to work toward beyond a high score. Achievements give players goals across many runs, and unlockable skins give those goals a visible reward now that skins look good (#161). The owner approved the list of achievements, the rewards and the four new skins (seen in screenshots). Tracked in tamsler/wigglefeast#14.

## What Changes

- **14 achievements**, each with a goal and visible progress:

  | Achievement | Goal | Unlocks |
  |---|---|---|
  | Snack Time | Reach 1,000 | |
  | Big Noodle | Reach 5,000 | Rainbow |
  | Titan | Reach 25,000 | Royal |
  | First Bite | Eat your first worm | Lavender |
  | Hungry Hunter | 10 kills in one run | Dragon |
  | Apex | 100 kills in total | |
  | Hang In There | Survive 5 minutes in one run | |
  | Marathon | Survive 20 minutes in one run | Thunder |
  | Grazer | Eat 10,000 food in total | |
  | Dedicated | Play 50 games | |
  | Hard Mode | Reach 5,000 on Hard | |
  | Expert Survivor | Reach 10,000 on Expert | Cosmic |
  | Stargazer | Eat 25 special food | |
  | Top of the Board | Reach #1 on the leaderboard | |

- **Past play counts**: achievements that the existing stats can prove (best scores, totals, the saved top and recent runs) are unlocked as soon as this ships, without a pop-up. Stargazer and Top of the Board count from now on.
- **Six unlockable skins**: four new ones (Dragon: red and gold scales; Thunder: yellow neon; Royal: purple and gold metallic; Cosmic: magenta galaxy) and the two hidden skins, Rainbow and Lavender, which become rewards. The 24 current skins stay free. Bots never wear unlockable skins.
- **Skin picker**: unlockable skins show with a padlock until earned; picking a locked one shows what unlocks it instead of choosing it.
- **Stats screen**: an achievements section listing every achievement with a progress bar, unlocked ones marked with the date.
- **In game**: a short pop-up and a fanfare the moment an achievement is earned.
- **Saves**: achievements are stored with the stats profile, so export and import carry them; older profiles and exports still load. Resetting stats also resets achievements and locks the rewards again.

### Out of scope

- Hats, glasses and other accessories.
- Online leaderboards or sharing achievements.
- Changing scoring or gameplay to make goals easier or harder.

## Capabilities

### New Capabilities

- `achievements`: the achievement list and goals, how progress is measured (including past play), when and how unlocking is shown, and which skins each unlocks.

### Modified Capabilities

- `skins`: four new skins; Rainbow and Lavender become unlockable rewards; the picker shows locked skins with a padlock and what unlocks them.
- `persistence`: the profile holds achievements and the two new counters, carried by export and import and cleared by reset; older data keeps loading.
- `audio`: an achievement fanfare.

## Impact

- `engine.js`: four skins appended to `SKINS` (positions are saved, so only appended), each unlockable skin marked with the achievement that unlocks it and kept out of bots' choice.
- `main.js`: the achievement list and progress checks, past-play unlocking on load, live checks during a run with a pop-up, two new profile counters (special food eaten, times reaching #1), the profile cleaner accepting the new fields, the stats screen section, the locked skins in the picker.
- `audio.js`: an `achievement` sound.
- `index.html`, `style.css`: the achievements section, padlock swatches, the pop-up.
- `sw.js`: VERSION bump (minor). No new files.
- Tests: achievement progress and unlocking (past play, live, each kind of goal), saves and imports (including `tests/fixtures/save-v1.json` and an older export), reset, picker behaviour for locked skins, bots never wearing unlockable skins, the pop-up and sound.
