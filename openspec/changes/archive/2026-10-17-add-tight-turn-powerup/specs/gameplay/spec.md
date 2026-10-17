# Spec Delta

## MODIFIED Requirements

### Requirement: Power-ups
The arena SHALL contain power-ups that any worm (player or bot) can collect by touching them. A power-up within reach of a worm's head (just beyond its glow) SHALL slide toward the nearest such head, the way food does. Each lasts 16 seconds: magnet (pulls food and power-ups from much farther away), x2 and x5 (multiply food value; the higher one applies), speed (1.25× speed and boosting costs no mass), zoom (player camera zooms out), and tight turns (the worm turns twice as fast as normal for its size).

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
