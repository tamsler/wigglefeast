# Spec Delta

## ADDED Requirements

### Requirement: Minimap shows worm density
The minimap SHALL show the arena edge, the player's position and the current view, and a shading of how densely other worms' bodies cover each part of the arena, in one colour whose strength grows with density. It SHALL NOT show individual worms: no per-worm markers, no worm colours, and nothing that singles out large or leading worms. The player's own body SHALL NOT add to the shading.

#### Scenario: Crowded and empty areas
- **WHEN** many worms' bodies lie in one part of the arena and none in another
- **THEN** the minimap is clearly shaded over the crowded part and unshaded over the empty part

#### Scenario: Big worms are not singled out
- **WHEN** the biggest worm on the leaderboard is alone in an otherwise empty area
- **THEN** the minimap shows it only as shading in the same colour as any other worm's body, with no marker or skin colour

#### Scenario: Player still sees where they are
- **WHEN** a run is in progress
- **THEN** the minimap shows the player's own marker and the view rectangle on top of the shading, and the player's body adds no shading
