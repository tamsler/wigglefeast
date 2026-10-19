# Spec Delta

## ADDED Requirements

### Requirement: Magnet field
While a worm's magnet is active, the arena SHALL show waves rippling outward from its head as rings, red on one side of the worm and blue on the other, fading as they spread and ending at the edge of the magnet's food pull range. The field SHALL be drawn beneath food, power-ups and worms, SHALL be fainter on bots than on the player, SHALL fade out over the magnet's last 3 seconds, and SHALL not be shown when the magnet is not active. It SHALL move with game time, so it is still while paused.

#### Scenario: Player picks up a magnet
- **WHEN** the player's magnet is active
- **THEN** red and blue waves ripple out from the player's head and reach about as far as food is pulled in

#### Scenario: No magnet
- **WHEN** a worm has no active magnet
- **THEN** no field is drawn around it

#### Scenario: Bot with a magnet
- **WHEN** a bot's magnet is active and its head is on screen
- **THEN** its field is shown, fainter than the player's would be

#### Scenario: Magnet running out
- **WHEN** a worm's magnet has less than 3 seconds left
- **THEN** its field fades, and it is gone when the magnet ends

#### Scenario: Paused
- **WHEN** the game is paused while a magnet is active
- **THEN** the field stays still until the game resumes

#### Scenario: Nothing hidden
- **WHEN** food or another worm lies inside a magnet field
- **THEN** it is drawn on top of the field
