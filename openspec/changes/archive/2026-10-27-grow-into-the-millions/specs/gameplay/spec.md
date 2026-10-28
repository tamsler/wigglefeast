# Spec Delta

## MODIFIED Requirements

### Requirement: Movement and growth
Worms SHALL move forward continuously, turn toward a target angle at a limited rate that decreases as they grow, and derive their radius and body length from their mass. New worms start at mass 15. Above mass 10,000 a worm SHALL grow mostly in thickness: its length grows more slowly than below 10,000, and above mass 100,000 more slowly still. Its radius keeps growing on the same slow curve up to 300. Worms SHALL NOT lose mass to shedding below 2,000,000.

#### Scenario: Eating food
- **WHEN** a worm's head reaches a food item
- **THEN** the food is removed and the worm gains the food's value, times its active multiplier and its size bonus if the food is natural (spawned by the arena, not dropped by a worm)

#### Scenario: Food is pulled in
- **WHEN** food is within a short radius of a worm's head
- **THEN** the food drifts toward the head before being eaten

#### Scenario: Very large worms shrink slowly
- **WHEN** a worm's mass is above 2,000,000
- **THEN** it loses 0.2% of the excess per second, and a worm at or below 2,000,000 loses nothing

#### Scenario: Massive worm
- **WHEN** a worm grows from mass 10,000 to 50,000
- **THEN** its radius grows past 62, its body grows less than twice as long, and it stays shorter than the circumference of a 30-bot arena (about 22,600)

#### Scenario: Worm in the millions
- **WHEN** a worm grows from mass 100,000 to 1,000,000
- **THEN** its radius grows from about 79 to about 148, its body grows less than 25% longer, and it stays shorter than the circumference of a 30-bot arena (about 22,600)

#### Scenario: Camera follows a massive player
- **WHEN** the player's worm grows past mass 10,000
- **THEN** the view keeps zooming out as it thickens, so more of the arena around it stays visible

#### Scenario: A worm no longer stops growing at 10,000
- **WHEN** a worm at mass 200,000 eats food dropped by a dead worm and nothing else changes
- **THEN** its mass rises by the food's value and it does not shed any

### Requirement: Camera zoom follows worm size
The camera SHALL zoom out as the player's worm thickens: by the factor 1 + (r − 14) / 35 of the starting zoom, r being the worm's radius, so relative to a new worm (mass 15) the zoom at mass 1,000 is about 0.74, at 10,000 about 0.54, at 50,000 about 0.41, and at 1,000,000 about 0.21. The zoom power-up SHALL zoom out a further 38% on top, and the camera SHALL keep easing smoothly to its new zoom.

#### Scenario: New worm
- **WHEN** the player spawns
- **THEN** the camera zoom is the same as before this change

#### Scenario: Big worm
- **WHEN** the player's worm reaches mass 10,000 and the camera has settled
- **THEN** the zoom is about 0.54 of a new worm's, so more of the arena around it is visible than before (about 0.65)

#### Scenario: Worm in the millions
- **WHEN** the player's worm reaches mass 1,000,000 and the camera has settled
- **THEN** the zoom is about 0.21 of a new worm's, and the worm's head and the arena around it are still on screen

#### Scenario: Zoom power-up
- **WHEN** a player of mass 1,000 has the zoom power-up
- **THEN** the zoom is 0.62 times what it would be without it

### Requirement: Boosting
A worm SHALL be able to boost to 2.1× speed while its mass is above 12, losing (1.5 + 0.25% of mass) mass per second, at most 150 per second, and dropping 60% of the lost mass as food behind it. While a worm is boosting, it SHALL be drawn with two chevron arrows just in front of its head, pointing in the direction it moves, and while the player's worm is boosting, the HUD SHALL show a BOOST badge next to the score.

#### Scenario: Boost at low mass
- **WHEN** a worm with mass 12 or less tries to boost without the speed power-up
- **THEN** it does not boost

#### Scenario: Boost cost
- **WHEN** a worm of mass 3,000 boosts for one second without the speed power-up
- **THEN** it loses about 9 mass, and about 5.4 of it is dropped as food behind it

#### Scenario: Boost cost of a giant
- **WHEN** a worm of mass 1,000,000 boosts for one second without the speed power-up
- **THEN** it loses 150 mass, and 90 of it is dropped as food behind it

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

### Requirement: Power-ups
The arena SHALL contain power-ups that any worm (player or bot) can collect by touching them. A power-up within reach of a worm's head (just beyond its glow) SHALL slide toward the nearest such head, the way food does. Each lasts 16 seconds: magnet (pulls food and power-ups from much farther away), x2, x5 and x10 (multiply the value of natural food, not of food dropped by worms; the highest one applies; x10 is rarer than x5), speed (1.25× speed and boosting costs no mass), zoom (player camera zooms out), and tight turns (the worm turns twice as fast as normal for its size).

#### Scenario: Collecting a power-up
- **WHEN** a worm's head touches a power-up
- **THEN** the power-up disappears and its effect runs on that worm for 16 seconds

#### Scenario: Passing close by
- **WHEN** a worm's head passes beside a power-up, close enough to brush its glow
- **THEN** the power-up slides to the head and is collected without the worm steering at it

#### Scenario: Magnet pulls power-ups
- **WHEN** a worm with the magnet passes about 200 units from a power-up
- **THEN** the power-up is pulled in and collected, while a worm without the magnet leaves it where it is

#### Scenario: Tight turns
- **WHEN** a worm with the tight-turn power-up steers toward a heading behind it
- **THEN** it turns at twice the rate of an identical worm without the power-up, boosting or not, until the 16 seconds run out

#### Scenario: Saves from before tight turns
- **WHEN** a save written before the tight-turn power-up existed is loaded
- **THEN** it loads normally and its worms start without the tight-turn effect

#### Scenario: Food x10
- **WHEN** a worm of mass 100 with x10 eats a natural pellet worth 4
- **THEN** it gains 40, and the same worm gains only the pellet's own value from food dropped by a dead worm

#### Scenario: Highest multiplier wins
- **WHEN** a worm of mass 100 has x2, x5 and x10 running at once
- **THEN** natural food is multiplied by 10

#### Scenario: x10 badge
- **WHEN** the player collects x10
- **THEN** a badge labelled x10 appears with a full ring that drains over 16 seconds, in the fixed badge order

#### Scenario: x10 is rare
- **WHEN** many power-ups have spawned
- **THEN** x10 is the rarest type, rarer than x5

#### Scenario: Saves from before x10
- **WHEN** a save written before the x10 power-up existed is loaded
- **THEN** it loads normally and its worms start without the x10 effect

## ADDED Requirements

### Requirement: Big worms get more out of arena food
A worm above mass 1,000 SHALL gain from natural food (spawned by the arena) its value, times its active multiplier, times (its mass ÷ 1,000) to the power 0.6: about 4 times the value at mass 10,000 and 16 times at 100,000. A worm at or below 1,000 SHALL gain no bonus. Food dropped by worms and special food SHALL NOT get the bonus. Bots SHALL get it on the same terms.

#### Scenario: Small worm
- **WHEN** a worm of mass 1,000 or less eats a natural pellet worth 4
- **THEN** it gains 4

#### Scenario: Big worm
- **WHEN** a worm of mass 10,000 eats a natural pellet worth 4
- **THEN** it gains about 15.9

#### Scenario: Bonus and multiplier together
- **WHEN** a worm of mass 10,000 with x2 eats a natural pellet worth 4
- **THEN** it gains about 31.8

#### Scenario: Dropped food and special food
- **WHEN** a worm of mass 100,000 eats food dropped by a dead worm worth 100, or a plasma sphere
- **THEN** it gains exactly 100 from the dropped food and exactly 100 from the plasma sphere

#### Scenario: Bots
- **WHEN** a bot of mass 10,000 eats a natural pellet worth 4
- **THEN** it gains about 15.9, as the player would

#### Scenario: Bots reach six figures
- **WHEN** worlds on easy, normal and hard run for 30 simulated minutes
- **THEN** in most runs the largest bot passes 100,000 mass, and it passes 1,000,000 only rarely

### Requirement: Natural food values
Natural food SHALL come in four sizes worth 1, 2, 4 and 10 mass, spawning in the ratio 52 : 30 : 12 : 6. A bigger pellet SHALL be drawn larger, and a pellet worth 50 or more, such as the pieces of a dead giant, SHALL keep growing slowly with its value up to a radius of 60, so it stays clearly bigger than ordinary food.

#### Scenario: Pellet sizes
- **WHEN** many natural pellets have spawned
- **THEN** about 52% are worth 1, 30% worth 2, 12% worth 4 and 6% worth 10, and none is worth 8

#### Scenario: A giant's remains
- **WHEN** a worm of mass 1,000,000 dies
- **THEN** its body leaves food worth 800,000 in total, in pieces each worth thousands, drawn with a radius of more than 40, and no more than one piece per body segment

#### Scenario: Ordinary food looks as before
- **WHEN** a pellet worth less than 50 is drawn
- **THEN** its size is the same as before this change
