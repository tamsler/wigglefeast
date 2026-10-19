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
Bots SHALL decide using only what a player could see: worms' positions, headings, sizes, how they have been turning, and visible food and power-ups. They SHALL NOT read any worm's steering target or input, and SHALL treat the player like any other worm when choosing prey. Bots MAY know which worm another bot is hunting, to coordinate. A bot MAY remember what it saw or experienced itself (kills that happened within its view, and worms that tried to cut it off), but SHALL NOT know what happened outside its view.

#### Scenario: Player's intent stays hidden
- **WHEN** the player moves the pointer to steer the other way, but their worm has not started turning yet
- **THEN** no bot's prediction of the player's path changes

#### Scenario: Unseen kill
- **WHEN** a worm kills another far outside a bot's view
- **THEN** that bot's impression of the killer is unchanged

## ADDED Requirements

### Requirement: Seen kills
A bot that reads other worms SHALL stay wary, for about half a minute, of a worm it saw kill within its view. It SHALL NOT pick that worm as prey unless the worm has at most half its mass, and it SHALL start evading that worm from farther away than an unknown worm.

#### Scenario: Seen killer gets room
- **WHEN** a reading bot saw a worm kill another within its view moments ago, and that worm's head approaches
- **THEN** the bot does not pick it as prey, and starts evading it from farther away than it would an unknown worm

#### Scenario: Much smaller killer
- **WHEN** a reading bot saw a worm with less than half its mass make a kill
- **THEN** it may still hunt that worm

### Requirement: Grudges
A bot that reads other worms SHALL hold a grudge, fading over about 20 seconds, against a worm that tried to cut it off or killed a worm right next to it. If the culprit is within hunting range and light enough to hunt, the bot SHALL retaliate by hunting it in preference to nearer worms, unless two other bots are already retaliating against that worm. Otherwise it SHALL keep away from the culprit by evading it from farther. Impressions SHALL NOT be saved.

#### Scenario: Cut off, then retaliates
- **WHEN** a smaller worm tries to cut off a reading bot, and the bot is next free to pick prey
- **THEN** the bot hunts that worm rather than a nearer worm it holds no grudge against

#### Scenario: Bigger culprit
- **WHEN** a worm too heavy to hunt tries to cut off a reading bot
- **THEN** the bot does not hunt it, and evades it from farther away than an unknown worm

#### Scenario: No gang-ups
- **WHEN** two bots are already retaliating against a worm and a third bot holds a grudge against it
- **THEN** the third bot does not hunt it

#### Scenario: Impressions after loading
- **WHEN** a world is saved and loaded again
- **THEN** bots start with no impressions or grudges and form them again from what they see
