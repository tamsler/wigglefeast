# hud Specification

## Purpose
The in-game heads-up display: where the minimap, power-up badges, leaderboard and score sit, and how active power-ups show their remaining time.

## Requirements

### Requirement: HUD layout
During a run the HUD SHALL show the minimap in the top-left corner with the active power-up badges beside it (or directly below it when the screen is too narrow), the leaderboard in the top-right corner, and the score in the bottom-left corner, all inside the screen's safe area. HUD elements SHALL NOT overlap each other at desktop sizes and at phone sizes down to 360×640 and 640×360, with every power-up active.

#### Scenario: Desktop with power-ups
- **WHEN** a run is played at 1280×713 with all six power-ups active
- **THEN** the minimap and six badges sit together in the top-left, and nothing overlaps

#### Scenario: Narrow phone
- **WHEN** a run is played on a 360×640 screen with all six power-ups active
- **THEN** the badges sit below the minimap and nothing overlaps

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

### Requirement: Power-up badges
Each active power-up on the player's worm SHALL show as a round badge with its icon and colour, inside a ring showing how much of its 16 seconds is left. A badge SHALL blink during its last 3 seconds, blink faster during its last second, and disappear when the power-up ends. Badges SHALL keep a fixed order, so they don't jump around as power-ups come and go.

#### Scenario: Fresh power-up
- **WHEN** the player collects the magnet
- **THEN** a magnet badge appears with a full ring that drains as time passes

#### Scenario: About to expire
- **WHEN** a power-up has 3 seconds or less left
- **THEN** its badge blinks, faster once less than a second is left, and it disappears when the power-up ends

#### Scenario: Collected again
- **WHEN** the player collects a power-up that is already running
- **THEN** its ring is full again and it stops blinking

### Requirement: Minimap shows worm density
The minimap SHALL show the arena edge, the player's position as a red-orange dot, and a density map of how densely other worms' bodies cover each part of the whole arena, in one colour whose strength grows with density and fine enough to tell nearby crowds apart. It SHALL NOT show a rectangle for the current view. It SHALL NOT show individual worms: no per-worm markers, no worm colours, and nothing that singles out large or leading worms. The player's own body SHALL NOT add to the shading.

#### Scenario: Crowded and empty areas
- **WHEN** many worms' bodies lie in one part of the arena and none in another
- **THEN** the minimap is clearly shaded over the crowded part and unshaded over the empty part

#### Scenario: Big worms are not singled out
- **WHEN** the biggest worm on the leaderboard is alone in an otherwise empty area
- **THEN** the minimap shows it only as shading in the same colour as any other worm's body, with no marker or skin colour

#### Scenario: Nearby crowds stay apart
- **WHEN** two crowds of worms lie about 900 units apart with empty space between them
- **THEN** the minimap shows two shaded areas with a clearly dimmer gap between them

#### Scenario: Player still sees where they are
- **WHEN** a run is in progress
- **THEN** the minimap shows the player as a red-orange dot on top of the shading, with no view rectangle, and the player's body adds no shading

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

### Requirement: Learning cue
On hard, while the game is watching a bot cut the player off to learn how they escape (see the bots spec, *Learning the player's habits*), that bot SHALL show a small brain beside its head. The brain SHALL fade out shortly after the watching ends. Only the bot being watched SHALL show it. Bots on easy and normal SHALL never show it. The cue SHALL only be drawn and SHALL NOT change how any world plays out or what is saved.

#### Scenario: Being studied
- **WHEN** a hard bot moves in to cut the player off and the game starts watching how the player escapes
- **THEN** a small brain appears beside that bot's head, and no other bot shows one

#### Scenario: Done watching
- **WHEN** the watching ends
- **THEN** the brain fades out within about a second

#### Scenario: Other levels
- **WHEN** a bot cuts the player off on easy or normal
- **THEN** no brain is shown

#### Scenario: Nothing else changes
- **WHEN** the same seeded world runs with and without the cue being drawn
- **THEN** the worlds are identical

### Requirement: Large scores fit
Scores up to 99,999,999 SHALL fit in the score area, the leaderboard's score column, the game-over summary and the stats and high-score tables, written in full with thousands separators, without being clipped, overlapping a neighbouring column or moving other columns. This SHALL hold at every window size the game supports, including the narrow layout.

#### Scenario: Seven-digit score in the score area
- **WHEN** the player's score is 1,234,567
- **THEN** the score area shows "1,234,567" in full

#### Scenario: Leaderboard with millions
- **WHEN** the leaderboard lists worms with scores of 12, 4,567 and 12,345,678
- **THEN** every row's scores end at the same position, the widest score is not clipped, and no score touches the kills column or a name

#### Scenario: Player's row with a 3-digit rank and a big score
- **WHEN** the player is ranked 120th with a score of 8,765,432
- **THEN** their row below the gap shows the rank, the name, the kills and the full score without overlap

#### Scenario: Narrow layout
- **WHEN** the leaderboard is shown in the narrow (phone) layout with a score of 12,345,678
- **THEN** the score is shown in full and the name column gives up room, not the score

#### Scenario: Game over and stats
- **WHEN** a run ends with a score of 3,456,789
- **THEN** the summary, the personal best and the high-score table show it in full

### Requirement: Mode clock
In Timed and Survival the HUD SHALL show one clock element: in Timed, the time remaining (minutes and seconds); in Survival, the elapsed time and the current level. Classic SHALL show no clock element. The clock SHALL sit inside the screen's safe area and SHALL NOT overlap any other HUD element, at desktop sizes and at phone sizes down to 360×640 and 640×360.

#### Scenario: Classic has no clock
- **WHEN** a Classic run is in progress
- **THEN** no clock element is shown

#### Scenario: Timed on a desktop
- **WHEN** a Timed match is played at 1280×713 with all six power-ups active
- **THEN** the clock shows the remaining time and nothing overlaps

#### Scenario: Survival on a narrow phone
- **WHEN** a Survival run is played on a 360×640 screen with all six power-ups active
- **THEN** the clock shows the elapsed time and the level, and nothing overlaps

#### Scenario: Crowded HUD
- **WHEN** the clock is shown with all six power-ups active, the player ranked outside the top 10, a first-run hint showing and the touch buttons visible
- **THEN** the clock overlaps none of the minimap, badges, leaderboard, score area, hint or buttons

#### Scenario: Landscape phone
- **WHEN** a Timed match is played on a 640×360 screen with the touch buttons shown
- **THEN** the clock does not overlap the leaderboard, the minimap, the badges or the buttons
