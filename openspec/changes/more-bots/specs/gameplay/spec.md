# Spec Delta

## MODIFIED Requirements

### Requirement: Arena
The arena SHALL be a circle whose radius is 1800 + 60 × bot count world units for up to 60 bots, and 5400 × √(bot count / 60) above that, so each bot beyond 60 adds the same area. Natural food and power-up counts SHALL scale to keep the same density at every size.

#### Scenario: Arena scales with bot count
- **WHEN** a world is created with 30 bots
- **THEN** the arena radius is 3600 units

#### Scenario: Large arena
- **WHEN** a world is created with 150 bots
- **THEN** the arena radius is about 8538 units, and food and power-ups are as dense as in a 30-bot world

#### Scenario: Leaving the arena
- **WHEN** a worm's head crosses the arena edge
- **THEN** the worm dies with no killer credited
