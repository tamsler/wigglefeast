# Spec Delta

## MODIFIED Requirements

### Requirement: Bot population
The world SHALL keep the configured number of bots (5–150). When a bot dies, a replacement spawns 1–3 seconds later at a spot away from other worms, at mass 15–40, with a name not currently in use.

#### Scenario: Bot dies
- **WHEN** a bot dies in a world configured for 30 bots
- **THEN** within about 3 seconds there are 30 bots again

#### Scenario: Initial world
- **WHEN** a new world is created
- **THEN** most bots start small (mass 15–200) and a few start large: about 10% (up to mass 1200) on easy, 15% (up to 2000) on normal and 35% (up to 5000) on hard, apart from the starting giants

#### Scenario: Largest world
- **WHEN** the player sets 150 bots and presses Play
- **THEN** a world with 150 bots starts, and it is saved and restored like any other world

## ADDED Requirements

### Requirement: Starting giants
A new world SHALL start with giants: 3 bots, or one for every 10 bots in the world if that is more, and never more than the bot count minus 2. Each giant SHALL start at a random mass from 20,000 up to 35,000 on easy, 55,000 on normal and 80,000 on hard. The other bots SHALL start as before.

#### Scenario: Default world
- **WHEN** a new world is created with 30 bots on normal
- **THEN** exactly 3 bots start between 20,000 and 55,000 mass, and no other bot starts above 2000

#### Scenario: Bigger on harder levels
- **WHEN** many new worlds are created on easy, normal and hard
- **THEN** every giant is at least 20,000, no giant is above 35,000 on easy, 55,000 on normal or 80,000 on hard, and the highest giants seen are higher on each harder level

#### Scenario: Small world
- **WHEN** a new world is created with 5 bots
- **THEN** 3 of them are giants and 2 start as ordinary bots

#### Scenario: Large world
- **WHEN** a new world is created with 150 bots
- **THEN** 15 of them are giants

#### Scenario: Replacements are small
- **WHEN** a giant dies and its replacement spawns
- **THEN** the replacement starts at mass 15–40, and no new giant is added

#### Scenario: Resuming a save
- **WHEN** a saved world is loaded
- **THEN** its bots keep the masses they were saved with, and no giants are added

### Requirement: Giants start with a body that fits the arena
A giant SHALL start with its whole body inside the arena, even when its full length would not fit, and its body SHALL reach its full length as the giant moves, as any growing worm's does.

#### Scenario: Giant in a small arena
- **WHEN** a new world with 5 bots on hard starts with a giant of 80,000 mass
- **THEN** every part of its body starts inside the arena, and after it has moved for a minute its body is the length its mass calls for

#### Scenario: Giant at the start
- **WHEN** a new world starts
- **THEN** a giant is as thick as its mass calls for from the first moment, and the player's spawn point is not inside any giant's body
