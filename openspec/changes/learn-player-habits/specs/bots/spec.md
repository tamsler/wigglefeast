# Spec Delta

## MODIFIED Requirements

### Requirement: Fair information
Bots SHALL decide using only what a player could see: worms' positions, headings, sizes, how they have been turning, and visible food and power-ups. They SHALL NOT read any worm's steering target or input, and SHALL treat the player like any other worm when choosing prey. Bots MAY know which worm another bot is hunting, to coordinate. A bot MAY remember what it saw or experienced itself (kills that happened within its view, and worms that tried to cut it off), but SHALL NOT know what happened outside its view. As the one exception, bots MAY share a record of the player's habits, kept between games, built only from the player's visible movement when a bot moved in to cut them off (see *Learning the player's habits*).

#### Scenario: Player's intent stays hidden
- **WHEN** the player moves the pointer to steer the other way, but their worm has not started turning yet
- **THEN** no bot's prediction of the player's path changes

#### Scenario: Unseen kill
- **WHEN** a worm kills another far outside a bot's view
- **THEN** that bot's impression of the killer is unchanged

#### Scenario: Habits come from movement only
- **WHEN** a bot moves in to cut the player off and the player steers the other way, but their worm hasn't turned before the encounter ends
- **THEN** the record counts the encounter as the player keeping straight

### Requirement: Tactics by difficulty
Each bot SHALL know a set of tactics fixed for its lifetime and drawn from its difficulty. Easy bots SHALL use no tactics. On normal, some bots SHALL use turn prediction, head anticipation, evasion, scavenging, head-on awareness and reading other worms. On hard, at least half the bots SHALL use each of those, and some SHALL also coil, pin against the edge and trap. On expert, every bot SHALL use every tactic, including flanking and learning the player's habits. Learning the player's habits SHALL be used on expert only.

#### Scenario: Easy has no tactics
- **WHEN** a world is created on easy
- **THEN** no bot predicts turns, anticipates heads, evades, scavenges, seeks head-on contact, reads other worms, coils, pins, traps or flanks

#### Scenario: A bot keeps its tactics
- **WHEN** a world with a bot is saved and loaded again
- **THEN** that bot knows the same tactics as before

## ADDED Requirements

### Requirement: Learning the player's habits
The game SHALL keep one record of the player's habits, on every level. Each time a bot moves in to cut the player off, the record SHALL note what the player's worm visibly did in the next moment:
- whether it turned toward the cutter's side, turned away from it, or kept straight;
- whether it boosted.

Older encounters SHALL count for less than recent ones, so the record follows a change of style within a few encounters. An expert bot cutting the player off SHALL use the record:
- aim toward the side the player usually turns to;
- lead farther ahead when the player usually boosts.

The effect SHALL grow with the number of encounters and be capped, so even a perfectly consistent habit only shifts the aim part of the way. With no record, the bot SHALL cut off the player exactly as without learning. The record SHALL NOT make any bot choose the player as prey more often. Bots on easy, normal and hard SHALL play exactly as without the record.

#### Scenario: Escaping the same way every time
- **WHEN** the player has turned away from the cutter in most of their recent cut-offs, and an expert bot moves in to cut them off
- **THEN** the bot aims further toward the side away from it than an expert bot with no record would

#### Scenario: Boosting out of trouble
- **WHEN** the player has boosted in most of their recent cut-offs, and an expert bot moves in to cut them off
- **THEN** the bot aims further ahead of the player than an expert bot with no record would

#### Scenario: A new style
- **WHEN** the player, after many escapes away from the cutter, escapes toward it in about ten cut-offs in a row
- **THEN** the record shows the player now mostly turns toward the cutter

#### Scenario: Little evidence
- **WHEN** the record holds only one or two encounters
- **THEN** an expert bot's aim moves only a little from where it would be with no record

#### Scenario: No record
- **WHEN** the record is empty
- **THEN** an expert bot cuts the player off exactly as it would without the learning tactic

#### Scenario: Prey choice unchanged
- **WHEN** an expert bot picks prey with and without a record of the player's habits
- **THEN** it picks the same worm

#### Scenario: Other levels unchanged
- **WHEN** the same seeded world runs on easy, normal or hard with and without a record of the player's habits
- **THEN** the worlds are identical
