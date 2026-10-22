# Spec Delta

## MODIFIED Requirements

### Requirement: Export, import and reset
The stats screen SHALL export the profile and world to a JSON file, import such a file after confirmation (replacing profile and world), and reset stats after confirmation. Files with app id 'wigglefeast' or 'worm-arena' SHALL be accepted; anything else SHALL be rejected with a message. Exported files SHALL NOT include the record of the player's habits, and importing SHALL leave it unchanged. Resetting stats SHALL also clear that record.

#### Scenario: Importing a non-save file
- **WHEN** the player imports a JSON file that is not a Wigglefeast save
- **THEN** nothing changes and an error message is shown

#### Scenario: Reset forgets habits
- **WHEN** the player resets their stats
- **THEN** the record of their habits is empty afterwards

## ADDED Requirements

### Requirement: Player habits are remembered
The record of the player's habits SHALL be stored on the device, separately from the world and the stats, and SHALL carry over to every new or restored world. It SHALL be saved whenever the world is saved, and only by the window that owns the session. A missing or damaged record SHALL start empty without stopping the game.

#### Scenario: Habits carry over
- **WHEN** the player plays a game, closes the page and starts a new game later
- **THEN** the bots in the new game use the same record of the player's habits

#### Scenario: Damaged record
- **WHEN** the stored record of the player's habits is not valid
- **THEN** the game starts normally with an empty record
