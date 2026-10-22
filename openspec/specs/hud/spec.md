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
In the arena, a worm that has killed at least once SHALL show ⚔ and its total number of kills after its name. The number SHALL only go up during the worm's life. A bot that is currently retaliating against the player SHALL show its name in red-orange instead of the usual colour. The kill count SHALL be kept when a world is saved and loaded; which bot is retaliating SHALL NOT be saved.

#### Scenario: Recent killer
- **WHEN** a worm has made two kills, one of them more than a minute ago, and its head is on screen
- **THEN** its name shows "⚔2" after it

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
On expert, while the game is watching a bot cut the player off to learn how they escape (see the bots spec, *Learning the player's habits*), that bot SHALL show a small brain beside its head. The brain SHALL fade out shortly after the watching ends. Only the bot being watched SHALL show it. Bots on easy, normal and hard SHALL never show it. The cue SHALL only be drawn and SHALL NOT change how any world plays out or what is saved.

#### Scenario: Being studied
- **WHEN** an expert bot moves in to cut the player off and the game starts watching how the player escapes
- **THEN** a small brain appears beside that bot's head, and no other bot shows one

#### Scenario: Done watching
- **WHEN** the watching ends
- **THEN** the brain fades out within about a second

#### Scenario: Other levels
- **WHEN** a bot cuts the player off on easy, normal or hard
- **THEN** no brain is shown

#### Scenario: Nothing else changes
- **WHEN** the same seeded world runs with and without the cue being drawn
- **THEN** the worlds are identical
