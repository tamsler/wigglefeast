# gameplay Specification

## Purpose
Core rules of a Wigglefeast match: how worms move, grow, boost, collide and die, and how food and power-ups work in the circular arena.

## Requirements

### Requirement: Arena
The arena SHALL be a circle whose radius is 1800 + 60 × bot count world units, with natural food and power-up counts scaled to keep the same density at every size.

#### Scenario: Arena scales with bot count
- **WHEN** a world is created with 30 bots
- **THEN** the arena radius is 3600 units

#### Scenario: Leaving the arena
- **WHEN** a worm's head crosses the arena edge
- **THEN** the worm dies with no killer credited

### Requirement: Movement and growth
Worms SHALL move forward continuously, turn toward a target angle at a limited rate that decreases as they grow, and derive their radius and body length from their mass. New worms start at mass 15.

#### Scenario: Eating food
- **WHEN** a worm's head reaches a food item
- **THEN** the food is removed and the worm gains the food's value times its active multiplier

#### Scenario: Food is pulled in
- **WHEN** food is within a short radius of a worm's head
- **THEN** the food drifts toward the head before being eaten

#### Scenario: Very large worms shrink slowly
- **WHEN** a worm's mass is above 1500
- **THEN** it loses 0.4% of the excess per second

### Requirement: Boosting
A worm SHALL be able to boost to 2.1× speed while its mass is above 12, losing (3 + 1% of mass) mass per second and dropping 60% of the lost mass as food behind it.

#### Scenario: Boost at low mass
- **WHEN** a worm with mass 12 or less tries to boost without the speed power-up
- **THEN** it does not boost

### Requirement: Collisions and death
A worm SHALL die when its head touches another worm's body. In a head-on collision (the other worm's first three segments) the worm with more mass survives. Worms never collide with themselves. A dying worm SHALL leave 80% of its mass as food along its body, which fades after 45–60 seconds.

#### Scenario: Running into a body
- **WHEN** worm A's head touches worm B's body behind B's head
- **THEN** A dies, B is credited with a kill, and A's body turns into food

#### Scenario: Head-on collision
- **WHEN** two worms' heads collide and A has more mass than B
- **THEN** B dies and A survives

### Requirement: Spawn shield
Newly spawned players SHALL be shielded for 2.5 seconds; shielded worms can neither kill nor be killed and are drawn semi-transparent.

#### Scenario: Spawning near another worm
- **WHEN** a shielded player's head passes through another worm's body
- **THEN** the player does not die

### Requirement: Power-ups
The arena SHALL contain power-ups that any worm (player or bot) can collect by touching them. Each lasts 16 seconds: magnet (pulls food from much farther away), x2 and x5 (multiply food value; the higher one applies), speed (1.25× speed and boosting costs no mass), and zoom (player camera zooms out).

#### Scenario: Collecting a power-up
- **WHEN** a worm's head touches a power-up
- **THEN** the power-up disappears and its effect runs on that worm for 16 seconds
