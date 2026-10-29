# Spec Delta

## Purpose

The ways a run can be played: open-ended Classic, a fixed-length Timed match that ends with a rank, and Survival, which gets harder the longer the player lasts. Covers choosing a mode, how each mode starts, runs and ends, and what it shows the player.

## ADDED Requirements

### Requirement: Mode picker
The main menu SHALL offer three modes, Classic, Timed and Survival, as a single choice with a one-line description of the chosen mode. Classic SHALL be the default. The choice SHALL be remembered with the other menu settings. The bot count and difficulty settings SHALL apply in every mode.

#### Scenario: First visit
- **WHEN** the player opens the game with no saved settings
- **THEN** the menu shows Classic selected, and Play starts a Classic run exactly as before this change

#### Scenario: Choice is remembered
- **WHEN** the player selects Timed, presses Play, then reloads the page and opens the menu
- **THEN** Timed is still selected

#### Scenario: Settings from before modes
- **WHEN** the game loads settings saved before modes existed
- **THEN** Classic is selected and the other settings are unchanged

#### Scenario: Phone-sized menu
- **WHEN** the menu is shown on a 360×640 or 640×360 screen
- **THEN** all three mode buttons are visible and tappable, and Play is still reachable

### Requirement: Classic mode
Classic SHALL play as it did before modes: no clock, no levels, the configured bot count at all times, and the world reused between runs while its bot count and difficulty are unchanged.

#### Scenario: Classic is unchanged
- **WHEN** the player plays a run in Classic
- **THEN** there is no clock or level on screen, the run ends only when the worm dies or the player quits, and the world starts with its giants as before

### Requirement: Timed match clock
In Timed mode a match SHALL last 5 minutes (300 seconds) of game time, starting when the player's worm spawns. The clock SHALL NOT run while the game is paused, shows the "open in another window" panel, or is hidden. The remaining time SHALL be shown in the HUD as minutes and seconds.

#### Scenario: Starting a match
- **WHEN** the player presses Play in Timed mode
- **THEN** the HUD clock shows 5:00 and counts down once per second

#### Scenario: Pausing
- **WHEN** the player pauses at 3:20 remaining and resumes 30 seconds later
- **THEN** the clock shows 3:20 again on resume

#### Scenario: Closing the tab mid-match
- **WHEN** the player closes the tab with 2:10 remaining and reopens the game later
- **THEN** the "Welcome back" panel shows, and after Resume the clock continues from 2:10

#### Scenario: Last seconds
- **WHEN** 10 seconds or fewer remain
- **THEN** the clock is highlighted so it is noticed

### Requirement: Timed match result
When the clock reaches zero while the player's worm is alive, the match SHALL end. The player's score SHALL be their worm's mass at that moment, and their final rank SHALL be their position among all worms in the arena by that measure, the same order as the leaderboard. A result screen SHALL show the rank out of the number of worms, the score, the kills and Play again / Main menu. The run is recorded with the cause "Time up" and the rank.

#### Scenario: Finishing in the middle of the field
- **WHEN** the clock reaches zero and the player's worm is third by mass among 31 worms
- **THEN** the result screen says the player finished #3 of 31, with their score and kills

#### Scenario: Winning
- **WHEN** the clock reaches zero and the player's worm has the highest mass
- **THEN** the result screen says the player won, finishing #1

#### Scenario: Rank is taken before the worm is removed
- **WHEN** the match ends
- **THEN** the rank shown is the one the player held when the clock reached zero, not a rank after their worm has turned to food

#### Scenario: Recorded run
- **WHEN** a Timed match ends by the clock
- **THEN** the run is added to the stats with mode Timed, its rank, and "Time up" as how it ended

### Requirement: Dying in a Timed match
If the player's worm dies before the clock reaches zero, the match SHALL end as a Classic run ends: the death screen shows who ate the player. There SHALL be no respawn. The run is recorded with mode Timed and no rank.

#### Scenario: Eaten at 1:30 remaining
- **WHEN** a bot eats the player with 1:30 on the clock
- **THEN** the death screen shows, the run is recorded as a Timed run without a rank, and Play again starts a new 5:00 match

### Requirement: Survival levels
In Survival mode the run SHALL be divided into levels of one minute of game time each, starting at level 1 when the player's worm spawns, and the HUD SHALL show the elapsed time and the current level. The score of a Survival run is the time survived. There is no time limit: the run ends when the worm dies or the player quits.

#### Scenario: Reaching level 3
- **WHEN** the player's worm has survived 2 minutes and 5 seconds
- **THEN** the HUD shows level 3 and the elapsed time 2:05

#### Scenario: Paused time does not count
- **WHEN** the player pauses for a minute during level 2
- **THEN** the level and elapsed time are the same after resuming

#### Scenario: Reload keeps the level
- **WHEN** the player closes the tab at level 4 and resumes later
- **THEN** the run resumes at level 4 with the same elapsed time

### Requirement: Survival escalation
In Survival mode, each level after the first SHALL add bots to the world, up to a cap, and bots spawned from then on SHALL be sharper and more aggressive. The extra bots per level SHALL be 10% of the configured bot count, at least one, and the total number of bots SHALL never exceed twice the configured count or 150, whichever is lower. The arena SHALL stay the size set by the configured bot count. Bots already in the world SHALL keep their traits.

#### Scenario: More bots each level
- **WHEN** a Survival run with 30 configured bots reaches level 3
- **THEN** the world soon holds 36 bots

#### Scenario: Cap
- **WHEN** a Survival run with 30 configured bots reaches level 20
- **THEN** the world holds 60 bots and no more are added

#### Scenario: Cap at the maximum bot count
- **WHEN** a Survival run is configured with 150 bots
- **THEN** no extra bots are ever added, and bots spawned at higher levels are still tougher

#### Scenario: Tougher replacements
- **WHEN** a bot dies at level 6 and its replacement spawns
- **THEN** the replacement's skill and aggression are higher than a level-1 bot's at the same difficulty, and never above their maximum

#### Scenario: Saving at the cap
- **WHEN** a Survival world is at its bot cap and is saved and then restored
- **THEN** it restores with the same level, elapsed time and bots, and the save is accepted

### Requirement: Survival result
When a Survival run ends, the death screen SHALL show the time survived and the level reached as its headline. The run's "score" for Survival is its time.

#### Scenario: Death in Survival
- **WHEN** the player dies after 7 minutes 42 seconds in Survival
- **THEN** the death screen shows 7:42 survived and level 8 reached, along with the usual score and kills

### Requirement: Fresh, even start for Timed and Survival
Every Timed or Survival run SHALL start in a newly created world, even when the previous world has the same settings. In such a world every bot SHALL start between mass 15 and 200: no starting giants and no large starting bots. Classic worlds SHALL be created and reused exactly as before.

#### Scenario: Play again after a Timed match
- **WHEN** the player finishes a Timed match and presses Play again
- **THEN** a new world is created in which every bot is small, and the clock starts at 5:00

#### Scenario: No giants
- **WHEN** a Timed or Survival world is created with 30 bots on hard
- **THEN** no bot has more than 200 mass at the start

#### Scenario: Classic keeps its giants
- **WHEN** a Classic world is created
- **THEN** it starts with its giants and large bots as in the gameplay and bots specs

### Requirement: Runs in every mode count
A finished run in any mode SHALL feed the lifetime totals, the best score per difficulty and the achievements, using the run's peak, kills, food eaten and time survived, exactly as a Classic run does.

#### Scenario: Surviving a whole Timed match
- **WHEN** the player's worm is alive when a 5:00 Timed match ends
- **THEN** Hang In There (survive 5 minutes in one run) is earned

#### Scenario: Hunting in Survival
- **WHEN** the player eats 10 worms in one Survival run
- **THEN** Hungry Hunter is earned
