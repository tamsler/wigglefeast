# Spec Delta

## MODIFIED Requirements

### Requirement: Export, import and reset
The stats screen SHALL export the profile and world to a JSON file, import such a file after confirmation (replacing profile and world), and reset stats after confirmation. Files with app id 'wigglefeast' or 'worm-arena' SHALL be accepted; anything else SHALL be rejected with a message. Exported files SHALL NOT include the record of the player's habits, and importing SHALL leave it unchanged. Resetting stats SHALL also clear that record. Earned achievements are part of the profile: exporting SHALL include them, importing SHALL replace them with the file's (plus any its stats prove), and resetting stats SHALL clear them and lock the skins they unlocked.

#### Scenario: Importing a non-save file
- **WHEN** the player imports a JSON file that is not a Wigglefeast save
- **THEN** nothing changes and an error message is shown

#### Scenario: Reset forgets habits
- **WHEN** the player resets their stats
- **THEN** the record of their habits is empty afterwards

#### Scenario: Achievements travel with a save
- **WHEN** a player exports a save with Top of the Board earned and imports it on another device
- **THEN** Top of the Board is earned there too

#### Scenario: Reset clears achievements
- **WHEN** the player resets their stats
- **THEN** no achievement is earned and every unlockable skin is locked again

## ADDED Requirements

### Requirement: Older profiles without achievements
Profiles and exported files saved before achievements existed SHALL keep loading; their achievements SHALL be worked out from their stats, and the new counters (special food eaten, times first on the leaderboard) SHALL start at zero.

#### Scenario: Old export
- **WHEN** the player imports `save-v1.json`-style data from before achievements
- **THEN** it loads, and the achievements its stats prove are earned
