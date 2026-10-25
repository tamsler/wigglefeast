# controls Specification

## Purpose
How the player steers, boosts, pauses and toggles sound on desktop and touch devices.

## Requirements

### Requirement: Steering
The player's worm SHALL steer toward the mouse pointer (relative to the worm's head on screen). Keyboard steering with A/D or Left/Right SHALL rotate the target heading, and takes over until the mouse moves again. On touch screens the first finger steers.

#### Scenario: Mouse steering
- **WHEN** the player moves the mouse to the right of their worm
- **THEN** the worm turns toward the right

### Requirement: Boosting input
Holding the mouse button, Space, W or Up SHALL boost. On touch screens, holding the on-screen boost button SHALL boost, and placing a second finger on the game SHALL also boost.

#### Scenario: Release boost
- **WHEN** the player releases all boost inputs
- **THEN** the worm stops boosting

#### Scenario: Boost button while steering
- **WHEN** on a touch screen the player holds the boost button with one finger and drags another finger across the game
- **THEN** the worm boosts and turns toward the dragging finger
- **AND** lifting the finger from the boost button stops the boost, even if it slid off the button first

### Requirement: Pause
P or Esc SHALL pause and resume during play. On touch screens, tapping the on-screen pause button SHALL pause. The game SHALL pause automatically when the window loses focus. While paused the world does not advance.

#### Scenario: Switching windows
- **WHEN** the game window loses focus during play
- **THEN** the game pauses and shows the pause panel

#### Scenario: Pause button
- **WHEN** on a touch screen the player taps the pause button during play
- **THEN** the game pauses and shows the pause panel, and Resume continues the run

### Requirement: Sound toggle key
Pressing M SHALL turn all sound off or on, in the menus and during play, and SHALL briefly confirm the new state on screen during play. It SHALL NOT act while the player is typing in a text field, such as the nickname.

#### Scenario: Muting during play
- **WHEN** the player presses M during a run with sound on
- **THEN** sound turns off and a short "Sound off" message shows

#### Scenario: Typing a nickname
- **WHEN** the player types an "m" in the nickname field
- **THEN** the letter is typed and sound is unchanged

### Requirement: On-screen touch buttons
On devices whose main pointer is coarse (a touch screen), the HUD SHALL show the boost and pause buttons only while a run is being played: not in the menu, on the death screen, or while paused. On devices whose main pointer is fine (mouse or trackpad) the buttons SHALL never show. Hiding the buttons SHALL stop any boost they were giving.

#### Scenario: Phone during a run
- **WHEN** a run is being played on a touch screen
- **THEN** the boost button shows in the bottom-right corner and the pause button in the top-right corner, beside the leaderboard

#### Scenario: Not playing
- **WHEN** the player is in the menu, on the death screen or on the pause panel
- **THEN** neither button shows

#### Scenario: Desktop
- **WHEN** a run is being played on a device with a mouse or trackpad as its main pointer
- **THEN** neither button shows and the HUD looks as it did before

### Requirement: Touch button layout
On touch screens, the boost and pause buttons SHALL be at least 44 CSS pixels in each dimension. They SHALL stay inside the screen's safe area. They SHALL NOT overlap each other, the score, the leaderboard, the minimap or the power-up badges, in portrait or landscape at phone sizes down to 360×640 and 640×360.

#### Scenario: Phone in portrait
- **WHEN** a run is played on a 390×844 touch screen with power-ups active
- **THEN** both buttons are fully visible and no HUD element overlaps another

#### Scenario: Phone in landscape
- **WHEN** a run is played on an 844×390 or 667×375 touch screen with power-ups active
- **THEN** both buttons are fully visible and no HUD element overlaps another
