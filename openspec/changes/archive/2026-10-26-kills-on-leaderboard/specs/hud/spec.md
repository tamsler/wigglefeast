# Spec Delta

## ADDED Requirements

### Requirement: Leaderboard rows
Each leaderboard row SHALL show the worm's rank, its name, its kills and its score, with the kills and the score in columns that are named by a header row ("Kills", "Score"). The columns SHALL have the same width on every row, so the numbers are aligned. The leaderboard SHALL list the top 10 worms. The player's own row SHALL be highlighted and, when the player is not in the top 10, shown below a gap.

#### Scenario: The player outside the top 10
- **WHEN** the player is ranked 14th
- **THEN** the top 10 are listed, then a gap, then the player's highlighted row with rank 14

#### Scenario: Numbers line up
- **WHEN** the leaderboard is shown with worms whose kills and scores have different numbers of digits
- **THEN** every row's kills end at the same position, every row's scores end at the same position, and the headers sit over them

### Requirement: Kills on the leaderboard
A leaderboard row SHALL show its worm's total number of kills as a plain number in the Kills column, with no icon. A worm that has never killed SHALL show 0, in a quieter colour. Kills SHALL NOT make the leaderboard wider or push the score out of its row: a long name is shortened first.

#### Scenario: A killer in the top 10
- **WHEN** a worm with three kills is in the top 10
- **THEN** its row shows 3 under the Kills header

#### Scenario: No kills yet
- **WHEN** a worm in the leaderboard has never killed
- **THEN** its row shows a quiet 0 under Kills

#### Scenario: The player's own row
- **WHEN** the player has two kills
- **THEN** their highlighted row shows 2 under Kills, whether it is in the top 10 or below the gap

#### Scenario: Long name with kills on a phone
- **WHEN** a worm with a long name and kills is listed on a 360×640 or 640×360 screen
- **THEN** its name is shortened with an ellipsis, and its kills and score are fully shown inside the leaderboard

### Requirement: Score area
During a run the score area in the bottom-left corner SHALL show the player's score, with its label, and the boost badge while they boost. It SHALL NOT repeat the player's rank or kills: their leaderboard row shows those.

#### Scenario: Only the score
- **WHEN** a run is in progress and the player has made kills
- **THEN** the bottom-left area shows the score and no "Rank" or "Kills" text, and the player's highlighted leaderboard row carries their rank and their kills

## MODIFIED Requirements

### Requirement: Reputation tags
In the arena, a worm other than the player's that has killed at least once SHALL show ⚔ and its total number of kills after its name. The player's own worm SHALL NOT show the tag: their leaderboard row shows their kills. The number SHALL only go up during the worm's life. A bot that is currently retaliating against the player SHALL show its name in red-orange instead of the usual colour. The kill count SHALL be kept when a world is saved and loaded; which bot is retaliating SHALL NOT be saved.

#### Scenario: Recent killer
- **WHEN** a worm has made two kills, one of them more than a minute ago, and its head is on screen
- **THEN** its name shows "⚔2" after it

#### Scenario: The player's own name
- **WHEN** the player has made two kills
- **THEN** their name over their head shows no ⚔ tag, and their kills show in their leaderboard row

#### Scenario: Tag fades
- **WHEN** a worm with kills dies
- **THEN** its tag goes with it, and the bot that replaces it starts with no tag

#### Scenario: Kills don't fade
- **WHEN** a minute passes without the worm making another kill
- **THEN** its tag still shows the same number

#### Scenario: No kills yet
- **WHEN** a worm has never killed
- **THEN** its name shows no ⚔ tag

#### Scenario: After loading
- **WHEN** a world is saved and loaded again
- **THEN** each worm's tag shows the same number of kills as before

#### Scenario: Someone is coming for you
- **WHEN** a bot holds a grudge against the player and is hunting them for it
- **THEN** that bot's name is drawn in red-orange while it does
