# gameplay Specification

## Purpose
Core rules of a Wigglefeast match: how worms move, grow, boost, collide and die, and how food and power-ups work in the circular arena.

## Requirements

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
- **THEN** its radius grows past 62, its body grows less than twice as long, and it stays shorter than the circumference of a 30-bot arena (about 22,600)

#### Scenario: Camera follows a massive player
- **WHEN** the player's worm grows past mass 10,000
- **THEN** the view keeps zooming out as it thickens, so more of the arena around it stays visible

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

### Requirement: Collisions and death
A worm SHALL die when its head touches another worm's body. In a head-on collision (the other worm's first three segments) the worm with more mass survives. Worms never collide with themselves. A worm SHALL NOT die on a smaller worm's body where its own body, beyond its head and neck, already lies over that spot: it is on top there, as it is drawn. A dying worm SHALL leave 80% of its mass as food along its body, which fades after 45–60 seconds.

#### Scenario: Running into a body
- **WHEN** worm A's head touches worm B's body behind B's head
- **THEN** A dies, B is credited with a kill, and A's body turns into food

#### Scenario: Head-on collision
- **WHEN** two worms' heads collide and A has more mass than B
- **THEN** B dies and A survives

#### Scenario: On top of a smaller worm
- **WHEN** worm A coils a smaller worm B, and A's head touches B's body where A's own body already lies over it
- **THEN** A does not die

#### Scenario: Smaller head on a bigger body
- **WHEN** the smaller worm B's head touches A's body, whatever lies under it
- **THEN** B dies

### Requirement: Spawn shield
Newly spawned players SHALL be shielded for 2.5 seconds; shielded worms can neither kill nor be killed and are drawn semi-transparent.

#### Scenario: Spawning near another worm
- **WHEN** a shielded player's head passes through another worm's body
- **THEN** the player does not die

### Requirement: Power-ups
The arena SHALL contain power-ups that any worm (player or bot) can collect by touching them. A power-up within reach of a worm's head (just beyond its glow) SHALL slide toward the nearest such head, the way food does. Each lasts 16 seconds: magnet (pulls food and power-ups from much farther away), x2 and x5 (multiply the value of natural food, not of food dropped by worms; the higher one applies), speed (1.25× speed and boosting costs no mass), zoom (player camera zooms out), and tight turns (the worm turns twice as fast as normal for its size).

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

### Requirement: Magnet field
While a worm's magnet is active, the arena SHALL show waves rippling forward from its head: arcs about 110 degrees wide in front of the worm, alternating blue and red from one wave to the next, fading as they spread and ending at the edge of the magnet's food pull range. There SHALL be no full circle, and nothing SHALL be shown for a worm without an active magnet.

#### Scenario: Player picks up a magnet
- **WHEN** the player's magnet is active
- **THEN** arcs about 110 degrees wide ripple forward from the player's head, alternating blue and red, and fade out about as far as food is pulled in

#### Scenario: No magnet
- **WHEN** a worm has no active magnet
- **THEN** no field is drawn around it

### Requirement: Magnet field stays in the background
The magnet field SHALL be drawn beneath food, power-ups and worms, SHALL be fainter on bots than on the player, SHALL fade out over the magnet's last 3 seconds, and SHALL move with game time, so it is still while paused.

#### Scenario: Bot with a magnet
- **WHEN** a bot's magnet is active and its head is on screen
- **THEN** its field is shown, fainter than the player's would be

#### Scenario: Magnet running out
- **WHEN** a worm's magnet has less than 3 seconds left
- **THEN** its field fades, and it is gone when the magnet ends

#### Scenario: Paused
- **WHEN** the game is paused while a magnet is active
- **THEN** the field stays still until the game resumes

#### Scenario: Nothing hidden
- **WHEN** food or another worm lies inside a magnet field
- **THEN** it is drawn on top of the field

### Requirement: Draw order
Where worms' bodies overlap, a heavier worm's body SHALL be drawn over a lighter one's, the player's included, so a worm wrapping a smaller one is on top of it. Worms of equal mass SHALL keep a steady order. The player's head SHALL be drawn on top of every body.

#### Scenario: Wrapped by a bigger worm
- **WHEN** a worm circles a smaller worm and their bodies overlap
- **THEN** the circling worm's body is drawn over the smaller worm's

#### Scenario: Player beside smaller and bigger bots
- **WHEN** the player's body overlaps a lighter bot's body and a heavier bot's body
- **THEN** the player's body is drawn over the lighter bot's and under the heavier bot's

#### Scenario: Player's head
- **WHEN** a heavier worm's body lies across the player's head
- **THEN** the player's head is drawn on top of it
