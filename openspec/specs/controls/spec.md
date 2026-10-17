# controls Specification

## Purpose
How the player steers, boosts and pauses on desktop and touch devices.

## Requirements

### Requirement: Steering
The player's worm SHALL steer toward the mouse pointer (relative to the worm's head on screen). Keyboard steering with A/D or Left/Right SHALL rotate the target heading, and takes over until the mouse moves again. On touch screens the first finger steers.

#### Scenario: Mouse steering
- **WHEN** the player moves the mouse to the right of their worm
- **THEN** the worm turns toward the right

### Requirement: Boosting input
Holding the mouse button, Space, W or Up SHALL boost. On touch screens, placing a second finger SHALL boost.

#### Scenario: Release boost
- **WHEN** the player releases all boost inputs
- **THEN** the worm stops boosting

### Requirement: Pause
P or Esc SHALL pause and resume during play. The game SHALL pause automatically when the window loses focus. While paused the world does not advance.

#### Scenario: Switching windows
- **WHEN** the game window loses focus during play
- **THEN** the game pauses and shows the pause panel
