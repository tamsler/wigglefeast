# Spec Delta

## MODIFIED Requirements

### Requirement: Learning cue
On hard, while the game is watching a bot cut the player off to learn how they escape (see the bots spec, *Learning the player's habits*), that bot SHALL show a small brain beside its head. The brain SHALL fade out shortly after the watching ends. Only the bot being watched SHALL show it. Bots on easy and normal SHALL never show it. The cue SHALL only be drawn and SHALL NOT change how any world plays out or what is saved.

#### Scenario: Being studied
- **WHEN** a hard bot moves in to cut the player off and the game starts watching how the player escapes
- **THEN** a small brain appears beside that bot's head, and no other bot shows one

#### Scenario: Done watching
- **WHEN** the watching ends
- **THEN** the brain fades out within about a second

#### Scenario: Other levels
- **WHEN** a bot cuts the player off on easy or normal
- **THEN** no brain is shown

#### Scenario: Nothing else changes
- **WHEN** the same seeded world runs with and without the cue being drawn
- **THEN** the worlds are identical
