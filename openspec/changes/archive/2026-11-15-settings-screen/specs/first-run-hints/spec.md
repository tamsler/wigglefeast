# Spec Delta

## MODIFIED Requirements

### Requirement: Show tips again
The Settings screen SHALL have a "Show tips again" button that forgets which hints were seen, so the next run shows all four again. The stats screen SHALL no longer have it.

#### Scenario: Showing tips again
- **WHEN** a player who has seen every hint presses "Show tips again" in Settings and starts a run
- **THEN** the steer hint shows again

#### Scenario: Not on the stats screen
- **WHEN** the player opens the stats screen
- **THEN** it has Export save, Import save and Reset stats, and no "Show tips again" button

#### Scenario: Reset stats leaves them alone
- **WHEN** a player who has pressed "Show tips again" resets their stats
- **THEN** the hints they have seen or not seen are unchanged, as before
