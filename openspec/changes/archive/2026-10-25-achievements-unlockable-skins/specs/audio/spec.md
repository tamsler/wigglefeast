# Spec Delta

## ADDED Requirements

### Requirement: Achievement fanfare
Earning an achievement SHALL play a short, bright fanfare, distinct from the other sounds, following the same sound toggle and browser rules as every other effect.

#### Scenario: Earning an achievement with sound on
- **WHEN** the player earns an achievement during a run with sound on
- **THEN** the achievement fanfare plays

#### Scenario: Sound off
- **WHEN** the player earns an achievement with sound off
- **THEN** the pop-up shows and no fanfare plays
