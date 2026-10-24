# Spec Delta

## MODIFIED Requirements

### Requirement: Tactics by difficulty
Each bot SHALL know a set of tactics fixed for its lifetime and drawn from its difficulty. Easy bots SHALL use no tactics. On normal, some bots SHALL use turn prediction, head anticipation, evasion, scavenging, head-on awareness and reading other worms. On hard, at least half the bots SHALL use each of those, and some SHALL also coil, pin against the edge, trap and shadow bigger worms; half SHALL escape coils. On expert, every bot SHALL use every tactic, including flanking, escaping coils, shadowing and learning the player's habits. Learning the player's habits SHALL be used on expert only. Adding a tactic SHALL NOT change which of the earlier tactics any bot knows.

#### Scenario: Easy has no tactics
- **WHEN** a world is created on easy
- **THEN** no bot predicts turns, anticipates heads, evades, scavenges, seeks head-on contact, reads other worms, coils, pins, traps, flanks, escapes coils or shadows

#### Scenario: A bot keeps its tactics
- **WHEN** a world with a bot is saved and loaded again
- **THEN** that bot knows the same tactics as before

#### Scenario: Coil escape by level
- **WHEN** worlds are created on each level
- **THEN** no bot escapes coils on easy or normal, about half the bots do on hard, and every bot does on expert

#### Scenario: Shadowing by level
- **WHEN** worlds are created on each level
- **THEN** no bot shadows on easy or normal, some bots do on hard, and every bot does on expert

#### Scenario: Earlier tactics kept
- **WHEN** a bot with a given id is created before and after a tactic was added
- **THEN** it knows the same earlier tactics in both cases

#### Scenario: Easy and normal unchanged
- **WHEN** the same seeded world runs on easy or normal before and after a tactic was added
- **THEN** the worlds are identical

### Requirement: Fair information
Bots SHALL decide using only what a player could see: worms' positions, headings, sizes, how they have been turning, and visible food and power-ups. They SHALL NOT read any worm's steering target or input, and SHALL treat the player like any other worm when choosing prey or a worm to shadow. Bots MAY know which worm another bot is hunting or shadowing, to coordinate. A bot MAY remember what it saw or experienced itself (kills that happened within its view, and worms that tried to cut it off), but SHALL NOT know what happened outside its view. As the one exception, bots MAY share a record of the player's habits, kept between games, built only from the player's visible movement when a bot moved in to cut them off (see *Learning the player's habits*).

#### Scenario: Player's intent stays hidden
- **WHEN** the player moves the pointer to steer the other way, but their worm has not started turning yet
- **THEN** no bot's prediction of the player's path changes

#### Scenario: Unseen kill
- **WHEN** a worm kills another far outside a bot's view
- **THEN** that bot's impression of the killer is unchanged

#### Scenario: Habits come from movement only
- **WHEN** a bot moves in to cut the player off and the player steers the other way, but their worm hasn't turned before the encounter ends
- **THEN** the record counts the encounter as the player keeping straight

## ADDED Requirements

### Requirement: Shadowing a bigger worm
A bot that shadows SHALL, when it isn't hunting or eating remains, sometimes pick a nearby worm heavier than its level's prey limit but at most four times its own mass, and run alongside that worm's body, a little behind its head and clear of it. It SHALL NOT shadow a worm that two other bots already shadow, SHALL give up after about 15 seconds or when the worm pulls away, and SHALL put getting out of danger first.

#### Scenario: A big worm nearby
- **WHEN** a bot that shadows, with nothing to hunt or eat, has a worm three times its mass nearby
- **THEN** it may start shadowing it, heading for a point beside that worm's body rather than ahead of its head

#### Scenario: Two shadows already
- **WHEN** two other bots already shadow a big worm
- **THEN** a third bot does not start shadowing it

#### Scenario: Too big
- **WHEN** the only bigger worm nearby is more than four times the bot's mass
- **THEN** the bot does not shadow it

#### Scenario: Giving up
- **WHEN** a bot has shadowed a worm for about 15 seconds, or the worm gets far away
- **THEN** it stops shadowing it

#### Scenario: The player as the big worm
- **WHEN** the player is the big worm near a bot that shadows
- **THEN** the bot may shadow the player as it would any other worm

### Requirement: Cutting in from a shadow
A shadowing bot SHALL cut in at its target's head only when the cut-off point is in reach along a path it can actually take, clear of bodies, and it would get there before the target's head. It SHALL NOT go head-on at a bigger worm, and SHALL NOT boost into the cut unless the boosted path is clear.

#### Scenario: A cut opens up
- **WHEN** a shadowing bot is alongside its target near the head, and the point just ahead of the target's head is clear and reachable in time
- **THEN** it cuts in across the target's path

#### Scenario: Not in time
- **WHEN** a shadowing bot could only reach the cut-off point after the target's head has passed it, or its path there is blocked
- **THEN** it keeps shadowing instead of cutting in

### Requirement: Shadowing works
In seeded worlds on hard and expert, shadowing bots SHALL kill worms, including ones heavier than their prey limit, which no bot did before. Shadowing SHALL NOT make bots die clearly more often than before.

#### Scenario: Same seed, before and after
- **WHEN** the balance tool runs the same seeds on hard and expert before and after this change
- **THEN** kills by shadowing bots appear, and bot deaths per minute stay within about a tenth of before
