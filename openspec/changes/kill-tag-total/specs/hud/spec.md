# Spec Delta

## MODIFIED Requirements

### Requirement: Reputation tags
In the arena, a worm that has killed at least once SHALL show ⚔ and its total number of kills after its name. The number SHALL only go up during the worm's life. A bot that is currently retaliating against the player SHALL show its name in red-orange instead of the usual colour. The kill count SHALL be kept when a world is saved and loaded; which bot is retaliating SHALL NOT be saved.

#### Scenario: Recent killer
- **WHEN** a worm has made two kills, one of them more than a minute ago, and its head is on screen
- **THEN** its name shows "⚔2" after it

#### Scenario: Tag fades
- **WHEN** a worm with kills dies
- **THEN** its tag goes with it, and the bot that replaces it starts with no tag

#### Scenario: Kills don't fade
- **WHEN** a minute passes without the worm making another kill
- **THEN** its tag still shows the same number

#### Scenario: No kills yet
- **WHEN** a worm has never killed
- **THEN** its name shows no ⚔ tag

#### Scenario: After loading
- **WHEN** a world is saved and loaded again
- **THEN** each worm's tag shows the same number of kills as before

#### Scenario: Someone is coming for you
- **WHEN** a bot holds a grudge against the player and is hunting them for it
- **THEN** that bot's name is drawn in red-orange while it does
