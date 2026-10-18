# Spec Delta

## MODIFIED Requirements

### Requirement: Stats and high scores
Each finished run (death or quit) SHALL be recorded with date, name, final and peak score, kills, food eaten, time survived, cause, difficulty and bot count. The profile SHALL keep lifetime totals, best peak score per difficulty (easy, normal, hard, expert), the top 10 runs by peak score and the 50 most recent runs, and SHALL be shown on the Stats & high scores screen. Recording a run SHALL add it to the profile as it is stored at that moment, so runs recorded by another window are kept.

#### Scenario: Personal best
- **WHEN** a run's peak score beats the previous best
- **THEN** the death screen says it is a new personal best and the stats screen shows it first in Top runs

#### Scenario: Runs from two windows
- **WHEN** the player finishes a run in one window, then switches to another window with Play here and finishes a run there
- **THEN** the stats show both runs and count both games

#### Scenario: Expert best
- **WHEN** the player finishes a run on expert
- **THEN** the stats screen shows that run's peak as the Expert best (if it beats it), next to the Easy, Normal and Hard bests, and lists the run with difficulty "expert"

#### Scenario: Profile from before Expert
- **WHEN** a profile saved or exported before the Expert level existed is loaded or imported
- **THEN** it loads with all its runs and bests, and the Expert best shows 0
