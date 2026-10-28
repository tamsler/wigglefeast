# Spec Delta

## MODIFIED Requirements

### Requirement: Backward compatibility
Saved data SHALL keep loading across releases: localStorage keys keep the 'wormarena.' prefix, and world snapshots carry a format version (currently 1). A worm in a snapshot SHALL be allowed any mass up to 100,000,000, and saves written before that limit rose SHALL load unchanged. A snapshot SHALL still be refused if a worm's mass is above that limit.

#### Scenario: Save from before the rename
- **WHEN** a save created under the old name is loaded
- **THEN** it restores normally

#### Scenario: Save from before the millions
- **WHEN** `tests/fixtures/save-v1.json`, or any save written by an earlier release, is loaded
- **THEN** it restores normally and its worms keep their mass

#### Scenario: Resuming a giant
- **WHEN** a world is saved while the player's worm has a mass of 3,000,000 and then resumed
- **THEN** the world resumes with the worm at the same mass, and its body, radius and zoom match that mass

#### Scenario: A mass beyond the limit
- **WHEN** a snapshot holds a worm with a mass of 200,000,000
- **THEN** it is refused as an invalid save, like any other out-of-range value

#### Scenario: High scores in the millions
- **WHEN** a run ends with a score of 2,500,000
- **THEN** it is recorded in the high scores, the personal best and the stats, and survives export and import
