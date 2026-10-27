# Spec Delta

## ADDED Requirements

### Requirement: Seen hints are remembered
The profile SHALL remember which first-run hints the player has seen. Profiles and exported files saved before hints existed SHALL keep loading: one with at least one game played SHALL count as having seen every hint, and one with none SHALL count as having seen none. Reset stats SHALL keep the seen hints, Show tips again SHALL clear them, and export and import SHALL carry them. Unknown or damaged entries SHALL be dropped without rejecting the profile.

#### Scenario: Old profile of someone who has played
- **WHEN** the game loads a profile saved before hints existed, with games played
- **THEN** no hint is shown on their next run

#### Scenario: Old profile of a new player
- **WHEN** the game loads a profile saved before hints existed, with no games played
- **THEN** all four hints are still to be shown

#### Scenario: Reset stats
- **WHEN** a player who has seen all hints resets their stats
- **THEN** they still see no hints on their next run

#### Scenario: Export and import
- **WHEN** a save exported after seeing two hints is imported
- **THEN** those two hints count as seen and the other two do not

#### Scenario: Two windows
- **WHEN** a hint is seen in the active window while the stored profile has other seen hints
- **THEN** all of them are kept
