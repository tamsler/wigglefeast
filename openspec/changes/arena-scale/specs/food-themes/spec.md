# Spec Delta

## ADDED Requirements

### Requirement: Food drawn large enough to read
Food SHALL be drawn about a third larger than its pickup size suggests, in every theme: a themed item is drawn 5.4 times the food's radius across on a glow 6.5 times its radius, and a Classic dot's glow 6.5 times its radius. Food values, sizes in the game, pickup reach and the drift toward a nearby head SHALL be unchanged.

#### Scenario: Themed food
- **WHEN** a piece of food of radius 10 is on screen in the Halloween theme
- **THEN** its item is drawn 54 world units across on a glow 65 units across

#### Scenario: Classic food
- **WHEN** a piece of food of radius 10 is on screen in the Classic theme
- **THEN** its glowing dot is drawn 65 world units across

#### Scenario: Pickup unchanged
- **WHEN** a worm's head passes a piece of food
- **THEN** it is pulled in and eaten from exactly the same distance as before this change
