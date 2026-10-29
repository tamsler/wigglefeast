# Spec Delta

## ADDED Requirements

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
