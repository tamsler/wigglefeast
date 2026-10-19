# Spec Delta

## ADDED Requirements

### Requirement: Magnet field
While a worm's magnet is active, the arena SHALL show waves rippling forward from its head: arcs about 110 degrees wide in front of the worm, alternating blue and red from one wave to the next, fading as they spread and ending at the edge of the magnet's food pull range. There SHALL be no full circle, and nothing SHALL be shown for a worm without an active magnet.

#### Scenario: Player picks up a magnet
- **WHEN** the player's magnet is active
- **THEN** arcs about 110 degrees wide ripple forward from the player's head, alternating blue and red, and fade out about as far as food is pulled in

#### Scenario: No magnet
- **WHEN** a worm has no active magnet
- **THEN** no field is drawn around it

### Requirement: Magnet field stays in the background
The magnet field SHALL be drawn beneath food, power-ups and worms, SHALL be fainter on bots than on the player, SHALL fade out over the magnet's last 3 seconds, and SHALL move with game time, so it is still while paused.

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
