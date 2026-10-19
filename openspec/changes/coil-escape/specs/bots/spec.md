# Spec Delta

## MODIFIED Requirements

### Requirement: Tactics by difficulty
Each bot SHALL know a set of tactics fixed for its lifetime and drawn from its difficulty. Easy bots SHALL use no tactics. On normal, some bots SHALL use turn prediction, head anticipation, evasion, scavenging, head-on awareness and reading other worms. On hard, at least half the bots SHALL use each of those, and some SHALL also coil, pin against the edge, trap and escape coils. On expert, every bot SHALL use every tactic, including flanking.

#### Scenario: Easy has no tactics
- **WHEN** a world is created on easy
- **THEN** no bot predicts turns, anticipates heads, evades, scavenges, seeks head-on contact, reads other worms, coils, pins, traps, escapes coils or flanks

#### Scenario: A bot keeps its tactics
- **WHEN** a world with a bot is saved and loaded again
- **THEN** that bot knows the same tactics as before

## ADDED Requirements

### Requirement: Coil escape
A bot that escapes coils SHALL recognise that it is being circled when a clearly bigger worm nearby is turning steadily around it and its own head is closed in by bodies, using only positions, sizes and observed turning. It SHALL then counter-attack by heading for a point on the coiler's predicted path, just ahead of the coiler's head, that it can reach first, boosting if it can afford to. If it can reach no such point in time, it SHALL head for the clearest way out.

#### Scenario: Circled by a bigger worm
- **WHEN** an escaping bot is closed in and a worm at least half again its mass is circling around it
- **THEN** it heads to cross the coiler's path just ahead of the coiler's head

#### Scenario: Coiler runs into the trapped worm
- **WHEN** an escaping bot repeatedly faces a long bot coiling it
- **THEN** across many encounters the coiler dies by running into the trapped worm noticeably more often, and the trapped worm dies less often, than when the trapped bot does not know the tactic

#### Scenario: No reachable cut
- **WHEN** an escaping bot is being circled but cannot reach any point on the coiler's path ahead of its head before the coiler does
- **THEN** it heads for the clearest gap out of the loop instead

#### Scenario: Not circled
- **WHEN** a bigger worm passes by in a straight line, or circles somewhere else, while the bot has open space around it
- **THEN** the bot does not switch to escaping

#### Scenario: Only what's visible
- **WHEN** a worm circles an escaping bot
- **THEN** the bot's decision depends on that worm's positions, size and observed turning, not on which tactic the worm is using
