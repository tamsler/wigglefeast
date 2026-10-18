# Spec Delta

## MODIFIED Requirements

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
