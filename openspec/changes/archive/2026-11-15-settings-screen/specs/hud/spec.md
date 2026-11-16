# Spec Delta

## ADDED Requirements

### Requirement: Bot labels can be hidden
With Show bot names off, no bot SHALL have a label over its head: no name, no ⚔ kill tag and no red-orange "coming for you" colour. The player's own name, the leaderboard and everything else SHALL be unchanged.

#### Scenario: Names off
- **WHEN** Show bot names is off and bots are on screen
- **THEN** no bot has a name over its head, and the player's own name still shows in its usual colour

#### Scenario: A killer or a grudge
- **WHEN** Show bot names is off and a bot with kills, or one hunting the player for revenge, is on screen
- **THEN** it shows no ⚔ tag and no red-orange name

#### Scenario: The leaderboard
- **WHEN** Show bot names is off
- **THEN** the leaderboard still lists every worm by name, with its kills and score

#### Scenario: Back on
- **WHEN** Show bot names is turned on again
- **THEN** bot names, kill tags and the red-orange colour return at once
