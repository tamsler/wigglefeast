# Spec Delta

## ADDED Requirements

### Requirement: Sound toggle key
Pressing M SHALL turn all sound off or on, in the menus and during play, and SHALL briefly confirm the new state on screen during play. It SHALL NOT act while the player is typing in a text field, such as the nickname.

#### Scenario: Muting during play
- **WHEN** the player presses M during a run with sound on
- **THEN** sound turns off and a short "Sound off" message shows

#### Scenario: Typing a nickname
- **WHEN** the player types an "m" in the nickname field
- **THEN** the letter is typed and sound is unchanged
