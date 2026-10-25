# Spec Delta

## ADDED Requirements

### Requirement: Arena floor
The arena floor SHALL be a grid of large hexagons, 80 world units from centre to corner (about six times a new worm's width across), separated by dark grooves with a faint light edge, each darkening softly toward its edge and carrying a faint fine honeycomb texture inside. The floor SHALL move and scale with the camera, as part of the world.

#### Scenario: Start of a run
- **WHEN** the player starts a run
- **THEN** the floor shows large hexagons, each several times wider than the player's worm, with dark grooves between them and a fine honeycomb texture inside

#### Scenario: Floor scales with the camera
- **WHEN** the camera zooms out as the player grows
- **THEN** the hexagons look smaller on screen in proportion, so a big worm looks big against the floor

### Requirement: Camera zoom follows worm size
The camera SHALL zoom out as the player's worm thickens: by the factor 1 + (r − 14) / 35 of the starting zoom, r being the worm's radius, so relative to a new worm (mass 15) the zoom at mass 1,000 is about 0.74, at 10,000 about 0.54, and at 50,000 about 0.41. The zoom power-up SHALL zoom out a further 38% on top, and the camera SHALL keep easing smoothly to its new zoom.

#### Scenario: New worm
- **WHEN** the player spawns
- **THEN** the camera zoom is the same as before this change

#### Scenario: Big worm
- **WHEN** the player's worm reaches mass 10,000 and the camera has settled
- **THEN** the zoom is about 0.54 of a new worm's, so more of the arena around it is visible than before (about 0.65)

#### Scenario: Zoom power-up
- **WHEN** a player of mass 1,000 has the zoom power-up
- **THEN** the zoom is 0.62 times what it would be without it
