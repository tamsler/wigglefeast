# Spec Delta

## MODIFIED Requirements

### Requirement: Boosting
A worm SHALL be able to boost to 2.1× speed while its mass is above 12, losing (1.5 + 0.5% of mass) mass per second and dropping 60% of the lost mass as food behind it. While a worm is boosting, it SHALL be drawn with two chevron arrows just in front of its head, pointing in the direction it moves, and while the player's worm is boosting, the HUD SHALL show a BOOST badge next to the score.

#### Scenario: Boost at low mass
- **WHEN** a worm with mass 12 or less tries to boost without the speed power-up
- **THEN** it does not boost

#### Scenario: Boost cost
- **WHEN** a worm of mass 3,000 boosts for one second without the speed power-up
- **THEN** it loses about 16.5 mass, and about 9.9 of it is dropped as food behind it

#### Scenario: Seeing a worm boost
- **WHEN** any worm, player or bot, boosts within view
- **THEN** two arrows show just in front of its head, pointing where it is heading, for as long as it boosts, and disappear when it stops

#### Scenario: Boost badge
- **WHEN** the player's worm is boosting
- **THEN** a BOOST badge shows next to the score, and it disappears when the worm stops boosting

#### Scenario: Boost held but not possible
- **WHEN** the player holds boost while their worm's mass is 12 or less and the speed power-up is not running
- **THEN** neither the badge nor the arrows show

#### Scenario: Speed power-up alone
- **WHEN** the speed power-up is running but the player is not holding boost
- **THEN** neither the badge nor the arrows show
