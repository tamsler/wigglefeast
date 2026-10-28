# Spec Delta

## ADDED Requirements

### Requirement: Large scores fit
Scores up to 99,999,999 SHALL fit in the score area, the leaderboard's score column, the game-over summary and the stats and high-score tables, written in full with thousands separators, without being clipped, overlapping a neighbouring column or moving other columns. This SHALL hold at every window size the game supports, including the narrow layout.

#### Scenario: Seven-digit score in the score area
- **WHEN** the player's score is 1,234,567
- **THEN** the score area shows "1,234,567" in full

#### Scenario: Leaderboard with millions
- **WHEN** the leaderboard lists worms with scores of 12, 4,567 and 12,345,678
- **THEN** every row's scores end at the same position, the widest score is not clipped, and no score touches the kills column or a name

#### Scenario: Player's row with a 3-digit rank and a big score
- **WHEN** the player is ranked 120th with a score of 8,765,432
- **THEN** their row below the gap shows the rank, the name, the kills and the full score without overlap

#### Scenario: Narrow layout
- **WHEN** the leaderboard is shown in the narrow (phone) layout with a score of 12,345,678
- **THEN** the score is shown in full and the name column gives up room, not the score

#### Scenario: Game over and stats
- **WHEN** a run ends with a score of 3,456,789
- **THEN** the summary, the personal best and the high-score table show it in full
