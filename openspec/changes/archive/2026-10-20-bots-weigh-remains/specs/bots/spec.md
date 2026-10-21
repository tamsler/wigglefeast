# Spec Delta

## MODIFIED Requirements

### Requirement: Scavenging
A bot that scavenges SHALL head for the remains of a worm that died nearby, weighted by how much of their food is still there and how far away they are, boosting when the remains are large. Remains SHALL count for as long as their food lies there, and only by the part of it not yet eaten. The bot SHALL skip remains that another worm's head is closer to.

A scavenging bot SHALL put a meal before a fight. When uncontested remains it can reach are worth more than the hunt it would start or is on, it SHALL NOT start that hunt and SHALL drop a hunt or coil it is on, and go for the remains. A hunt is worth what the kill would drop, less the chance of failing and the distance to the prey. Getting out of danger and a winning head-on SHALL still come before a meal. Bots that don't scavenge SHALL hunt as before.

#### Scenario: Big worm dies nearby
- **WHEN** a large worm dies near a scavenging bot that is not evading, and no other head is closer to the remains
- **THEN** the bot heads for the remains

#### Scenario: Remains already contested
- **WHEN** another worm's head is closer to the remains than the scavenging bot
- **THEN** the bot leaves those remains alone

#### Scenario: Hunting next to a big meal
- **WHEN** a scavenging bot is hunting a small worm and uncontested remains worth much more than that worm lie closer than the prey
- **THEN** the bot drops the hunt and heads for the remains

#### Scenario: Coiling next to a big meal
- **WHEN** a scavenging bot is coiling a small worm and uncontested remains worth much more than that worm lie within reach
- **THEN** the bot stops coiling and heads for the remains

#### Scenario: A meal before a new hunt
- **WHEN** a scavenging bot that is free to pick prey has uncontested remains within reach worth more than any worm it could hunt
- **THEN** it goes for the remains instead of starting a hunt

#### Scenario: A few leftovers
- **WHEN** a scavenging bot is hunting and the only remains within reach are worth less than the kill
- **THEN** it keeps hunting

#### Scenario: Remains outlast the first seconds
- **WHEN** a large worm died 20 seconds ago and most of its food still lies there
- **THEN** a scavenging bot nearby still counts those remains

#### Scenario: Remains eaten up
- **WHEN** other worms have eaten most of a worm's remains
- **THEN** a scavenging bot values those remains only by what is left, and forgets them once almost nothing is left

#### Scenario: Bots that don't scavenge
- **WHEN** a bot without the scavenging tactic is hunting next to a big meal
- **THEN** it keeps hunting, as before
