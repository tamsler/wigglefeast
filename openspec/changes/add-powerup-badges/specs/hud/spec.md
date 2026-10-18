# Spec Delta

## Purpose

The in-game heads-up display: where the minimap, power-up badges, leaderboard and score sit, and how active power-ups show their remaining time.

## ADDED Requirements

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
