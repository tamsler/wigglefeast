# achievements Specification

## Purpose
Long-term goals across many runs: the achievements, how progress toward them is measured (past play included), how earning one is shown, and the skins they unlock.

## Requirements

### Requirement: Growth achievements
The game SHALL have these achievements for size, each earned when the player's worm reaches the given score (peak mass) in a run: Snack Time (1,000), Big Noodle (5,000), Titan (25,000), Hard Mode (5,000 on Hard difficulty) and Hard Survivor (10,000 on Hard difficulty). Hard Survivor was called Expert Survivor before there were three levels; earning it under either name counts.

#### Scenario: Reaching 5,000
- **WHEN** the player's worm reaches a score of 5,000 for the first time, on any difficulty
- **THEN** Snack Time and Big Noodle are earned (Snack Time if not already)

#### Scenario: Difficulty goals
- **WHEN** the player reaches 5,000 on Normal
- **THEN** Hard Mode is not earned, because it needs Hard

#### Scenario: Earned as Expert Survivor
- **WHEN** a player who earned Expert Survivor before this change opens the game
- **THEN** Hard Survivor shows as earned, and Galaxy Prime stays unlocked

### Requirement: Hunting achievements
The game SHALL have these achievements for eating other worms: First Bite (eat one worm), Hungry Hunter (eat 10 worms in one run) and Apex (eat 100 worms in total across all runs).

#### Scenario: Ten in one run
- **WHEN** the player eats a tenth worm in the same run
- **THEN** Hungry Hunter is earned

#### Scenario: Total across runs
- **WHEN** the player's kills across all runs reach 100
- **THEN** Apex is earned, however they were spread over runs

### Requirement: Survival and play achievements
The game SHALL have these achievements for time and games: Hang In There (survive 5 minutes in one run), Marathon (survive 20 minutes in one run) and Dedicated (finish 50 games).

#### Scenario: Surviving 20 minutes
- **WHEN** the player's run lasts 20 minutes of play
- **THEN** Hang In There and Marathon are earned; time spent paused doesn't count

### Requirement: Food and leaderboard achievements
The game SHALL have these achievements: Grazer (eat 10,000 pieces of food in total), Stargazer (eat 25 special food items in total) and Top of the Board (be first on the leaderboard during a run).

#### Scenario: First place
- **WHEN** the player's worm becomes first on the leaderboard
- **THEN** Top of the Board is earned

### Requirement: Past play counts
When achievements first appear, and whenever a profile is loaded or imported, every achievement that the saved stats prove (best scores overall and by difficulty, totals, and the saved top and recent runs) SHALL be earned at once, without a pop-up. Stargazer and Top of the Board, which older stats can't prove, SHALL count from then on.

#### Scenario: Existing player
- **WHEN** a player whose saved best score is 6,000 with 120 total kills opens the new version
- **THEN** Snack Time, Big Noodle, First Bite and Apex are already earned, Holo and Ghost are unlocked, and no pop-ups appear

### Requirement: Earning an achievement
The moment an achievement is earned during a run, the game SHALL show a short pop-up with its name and play a fanfare, and SHALL remember it straight away, even if the run is not finished. Each achievement SHALL be earned only once.

#### Scenario: Earned mid-run
- **WHEN** the player reaches 1,000 for the first time and then closes the page before dying
- **THEN** Snack Time was shown as earned and is still earned after reopening

#### Scenario: Only once
- **WHEN** the player reaches 1,000 again in a later run
- **THEN** no pop-up appears

### Requirement: Achievement progress on the stats screen
The stats screen SHALL list every achievement with its name, goal and progress (for example 3,200 / 5,000), earned ones marked as earned with the date, and the skin each unlocks, if any.

#### Scenario: Viewing progress
- **WHEN** a player with a best score of 3,200 opens the stats screen
- **THEN** Big Noodle shows 3,200 / 5,000 and that it unlocks Holo

### Requirement: Skin rewards
Earning Big Noodle SHALL unlock Holo, First Bite Ghost, Hungry Hunter Inferno, Marathon Storm, Titan Crystal and Hard Survivor Galaxy Prime.

#### Scenario: Unlocking Dragon
- **WHEN** the player earns Hungry Hunter
- **THEN** Inferno can be picked in the skin picker from then on
