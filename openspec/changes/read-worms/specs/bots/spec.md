# Spec Delta

## MODIFIED Requirements

### Requirement: Tactics by difficulty
Each bot SHALL know a set of tactics fixed for its lifetime and drawn from its difficulty. Easy bots SHALL use no tactics. On normal, some bots SHALL use turn prediction, head anticipation, evasion, scavenging, head-on awareness and reading other worms. On hard, at least half the bots SHALL use each of those, and some SHALL also coil, pin against the edge and trap. On expert, every bot SHALL use every tactic, including flanking.

#### Scenario: Easy has no tactics
- **WHEN** a world is created on easy
- **THEN** no bot predicts turns, anticipates heads, evades, scavenges, seeks head-on contact, reads other worms, coils, pins, traps or flanks

#### Scenario: A bot keeps its tactics
- **WHEN** a world with a bot is saved and loaded again
- **THEN** that bot knows the same tactics as before

### Requirement: Fair information
Bots SHALL decide using only what a player could see: worms' positions, headings, sizes, how they have been turning, and visible food and power-ups. They SHALL NOT read any worm's steering target or input, and SHALL treat the player like any other worm when choosing prey. Bots MAY know which worm another bot is hunting, to coordinate. A bot MAY remember what it saw itself (kills that happened within its view, boosting, steering, and how a worm got away from its own hunts), but SHALL NOT know what happened outside its view.

#### Scenario: Player's intent stays hidden
- **WHEN** the player moves the pointer to steer the other way, but their worm has not started turning yet
- **THEN** no bot's prediction of the player's path changes

#### Scenario: Unseen kill
- **WHEN** a worm kills another far outside a bot's view
- **THEN** that bot's impression of the killer is unchanged

## ADDED Requirements

### Requirement: Reading other worms
A bot that reads other worms SHALL keep its own impression of worms it has seen recently: kills it saw them make (fading over about half a minute), how often they boost, how erratic their steering is, and how often they escaped its own hunts. When choosing prey it SHALL prefer worms that steer erratically and rarely escape, and avoid worms it saw kill unless they are much smaller. It SHALL give such worms more room by evading them from farther away. Impressions SHALL NOT be saved.

#### Scenario: Clumsy prey preferred
- **WHEN** a reading bot can choose between two equally close, equally sized worms, one steering erratically and one steering smoothly
- **THEN** it hunts the erratic one

#### Scenario: A worm that keeps escaping
- **WHEN** a worm has escaped a reading bot's hunts several times and another equally close worm has not
- **THEN** the bot hunts the other worm

#### Scenario: Seen killer gets room
- **WHEN** a reading bot saw a worm kill another worm within its view moments ago, and that worm's head approaches
- **THEN** the bot does not pick it as prey, and starts evading it from farther away than it would an unknown worm

#### Scenario: Impressions after loading
- **WHEN** a world is saved and loaded again
- **THEN** bots start with no impressions and form them again from what they see
