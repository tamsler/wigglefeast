# bots Specification

## Purpose
AI-controlled worms that populate the arena, so the game is playable offline without other people.

## Requirements

### Requirement: Bot population
The world SHALL keep the configured number of bots (5–60). When a bot dies, a replacement spawns 1–3 seconds later at a spot away from other worms, at mass 15–40, with a name not currently in use.

#### Scenario: Bot dies
- **WHEN** a bot dies in a world configured for 30 bots
- **THEN** within about 3 seconds there are 30 bots again

#### Scenario: Initial world
- **WHEN** a new world is created
- **THEN** bots start at varied sizes, mostly small with a few large ones

### Requirement: Bot behaviour
Each bot SHALL re-plan its heading several times per second, choosing among candidate headings by its goal (nearby food weighted by value and distance, power-ups, a hunted worm, or a wander point) and rejecting headings that lead into other worms' bodies or the arena edge.

#### Scenario: Obstacle ahead
- **WHEN** another worm's body lies across a bot's path
- **THEN** the bot turns toward a heading that is clear, if one exists

#### Scenario: Hunting
- **WHEN** an aggressive bot is near a worm with less than 1.6× its mass
- **THEN** it may steer ahead of that worm's head to cut it off, boosting when close

### Requirement: Difficulty
Each bot SHALL get a skill and aggression value drawn from the selected difficulty (easy, normal, hard). Higher skill means faster re-planning, more candidate headings and farther look-ahead.

#### Scenario: Hard difficulty
- **WHEN** a world is created on hard
- **THEN** bots look farther ahead, react faster and hunt more than on easy
