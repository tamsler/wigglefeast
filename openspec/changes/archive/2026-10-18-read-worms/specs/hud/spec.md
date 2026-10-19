# Spec Delta

## ADDED Requirements

### Requirement: Reputation tags
In the arena, a worm that has killed in the last 60 seconds SHALL show ⚔ and its number of kills in that time after its name. A bot that is currently retaliating against the player SHALL show its name in red-orange instead of the usual colour. Tags SHALL NOT be saved.

#### Scenario: Recent killer
- **WHEN** a worm has made two kills in the last minute and its head is on screen
- **THEN** its name shows "⚔2" after it

#### Scenario: Tag fades
- **WHEN** 60 seconds pass without the worm making another kill
- **THEN** the tag disappears

#### Scenario: Someone is coming for you
- **WHEN** a bot holds a grudge against the player and is hunting them for it
- **THEN** that bot's name is drawn in red-orange while it does
