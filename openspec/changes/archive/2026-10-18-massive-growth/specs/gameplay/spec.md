# Spec Delta

## MODIFIED Requirements

### Requirement: Movement and growth
Worms SHALL move forward continuously, turn toward a target angle at a limited rate that decreases as they grow, and derive their radius and body length from their mass. New worms start at mass 15. Above mass 10,000 a worm SHALL grow mostly in thickness: its length grows more slowly than below 10,000, and its radius keeps growing up to 90.

#### Scenario: Eating food
- **WHEN** a worm's head reaches a food item
- **THEN** the food is removed and the worm gains the food's value, times its active multiplier if the food is natural (spawned by the arena, not dropped by a worm)

#### Scenario: Food is pulled in
- **WHEN** food is within a short radius of a worm's head
- **THEN** the food drifts toward the head before being eaten

#### Scenario: Very large worms shrink slowly
- **WHEN** a worm's mass is above 10,000
- **THEN** it loses 0.2% of the excess per second, and a worm at or below 10,000 loses nothing

#### Scenario: Massive worm
- **WHEN** a worm grows from mass 10,000 to 50,000
- **THEN** its radius grows past 62, its body grows less than twice as long, and it stays shorter than the edge of a 30-bot arena

#### Scenario: Camera follows a massive player
- **WHEN** the player's worm grows past mass 10,000
- **THEN** the view keeps zooming out as it thickens, so more of the arena around it stays visible
