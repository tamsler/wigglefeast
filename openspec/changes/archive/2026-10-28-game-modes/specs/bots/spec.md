# Spec Delta

## MODIFIED Requirements

### Requirement: Bot population
The world SHALL keep the configured number of bots (5–150), except in Survival, where it keeps the configured number plus the extra bots of the current level (see game-modes). When a bot dies, a replacement spawns 1–3 seconds later at a spot away from other worms, at mass 15–40, with a name not currently in use.

#### Scenario: Bot dies
- **WHEN** a bot dies in a world configured for 30 bots
- **THEN** within about 3 seconds there are 30 bots again

#### Scenario: Initial world
- **WHEN** a new world is created
- **THEN** most bots start small (mass 15–200) and a few start large: about 10% (up to mass 1200) on easy, 15% (up to 2000) on normal and 35% (up to 5000) on hard, apart from the starting giants

#### Scenario: Largest world
- **WHEN** the player sets 150 bots and presses Play
- **THEN** a world with 150 bots starts, and it is saved and restored like any other world

#### Scenario: Even start
- **WHEN** a Timed or Survival world is created
- **THEN** every bot starts small (mass 15–200), with no large bots and no starting giants

#### Scenario: Survival grows the population
- **WHEN** a Survival run with 30 configured bots reaches level 4 and a bot dies
- **THEN** within about 3 seconds there are 39 bots, not 30

#### Scenario: Survival is capped
- **WHEN** a Survival run's level would call for more than twice the configured bots, or more than 150
- **THEN** the population stays at the lower of those two limits
