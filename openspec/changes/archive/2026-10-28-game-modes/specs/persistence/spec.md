# Spec Delta

## MODIFIED Requirements

### Requirement: New world on settings change
Pressing Play with a bot count, difficulty or mode different from the current world's SHALL create a new world, replacing the saved one. In Timed and Survival, pressing Play SHALL always create a new world. Stats are not affected.

#### Scenario: Changing difficulty
- **WHEN** the player switches from normal to hard and presses Play
- **THEN** a new hard world is created

#### Scenario: Changing mode
- **WHEN** the player switches from Classic to Timed and presses Play
- **THEN** a new Timed world is created, replacing the saved Classic one

#### Scenario: Playing Timed again with the same settings
- **WHEN** the player finishes a Timed match and presses Play again without changing any setting
- **THEN** a new world is created, not the old one continued

#### Scenario: Playing Classic again with the same settings
- **WHEN** the player dies in Classic and presses Play again without changing any setting
- **THEN** the existing world continues, as before modes existed

### Requirement: Stats and high scores
Each finished run (death, quit or the end of a Timed match) SHALL be recorded with date, name, final and peak score, kills, food eaten, time survived, cause, difficulty, bot count, mode and, for a Timed match that ended by the clock, its final rank. The profile SHALL keep lifetime totals, best peak score per difficulty (easy, normal, hard), the top 10 runs by peak score and the 50 most recent runs, and SHALL be shown on the Stats & high scores screen. The profile SHALL also keep a best per mode, shown on the stats screen: Classic's is its best peak score, Timed's is its best final score in a match that ended by the clock, and Survival's is its longest time survived. Recording a run SHALL add it to the profile as it is stored at that moment, so runs recorded by another window are kept. The run tables SHALL show each run's mode, difficulty and bot count.

#### Scenario: Personal best
- **WHEN** a run's peak score beats the previous best
- **THEN** the death screen says it is a new personal best and the stats screen shows it first in Top runs

#### Scenario: Runs from two windows
- **WHEN** the player finishes a run in one window, then switches to another window with Play here and finishes a run there
- **THEN** the stats show both runs and count both games

#### Scenario: Expert best
- **WHEN** the player finishes a run on hard (the level that was Expert)
- **THEN** the stats screen shows that run's peak as the Hard best (if it beats it), next to the Easy and Normal bests, and lists the run with difficulty "hard"

#### Scenario: Profile from before Expert
- **WHEN** a profile saved or exported before the Expert level existed is loaded or imported
- **THEN** it loads with all its runs and bests

#### Scenario: Profile from before three levels
- **WHEN** a profile with Expert runs and an Expert best is loaded or imported
- **THEN** its Expert runs are listed as "hard", and the Hard best is the higher of its old Hard and Expert bests

#### Scenario: Best by mode
- **WHEN** the player has finished a Classic run with a peak of 8,000, a Timed match ended by the clock with a score of 1,200, and a Survival run of 6 minutes 10 seconds
- **THEN** the stats screen shows 8,000 for Classic, 1,200 for Timed and 6:10 for Survival

#### Scenario: Timed death does not set the Timed best
- **WHEN** the player is eaten during a Timed match with a peak of 3,000
- **THEN** the run is listed and counts toward the totals, but the Timed best is unchanged

#### Scenario: A Timed run is remembered after the next run
- **WHEN** the player finishes a Timed match ranked #2 and then finishes a Classic run
- **THEN** the Timed run still shows its mode and rank in the run tables, and the Timed best is still there

#### Scenario: Mode in the run tables
- **WHEN** the stats screen lists a Timed run on normal with 30 bots
- **THEN** its row shows the mode Timed along with normal and 30

## ADDED Requirements

### Requirement: Mode in saved worlds
A saved world SHALL record its mode, and restoring it SHALL restore that mode with its clock or level, derived from the world's own time and the player's start. A snapshot without a mode SHALL be restored as Classic. A snapshot with a mode that is not Classic, Timed or Survival SHALL be refused as an invalid save. The bot count in a snapshot SHALL always be the configured count; a Survival world's extra bots are not part of it, and a snapshot of a Survival world at its bot cap SHALL be accepted.

#### Scenario: Resuming a Timed match
- **WHEN** a Timed world is saved with 2:10 remaining and restored
- **THEN** the match resumes in Timed mode with 2:10 remaining

#### Scenario: Save from before modes
- **WHEN** `tests/fixtures/save-v1.json`, or any save written by an earlier release, is loaded
- **THEN** it restores as a Classic world, exactly as before

#### Scenario: Unknown mode
- **WHEN** a snapshot names a mode that does not exist
- **THEN** it is refused as an invalid save, like any other out-of-range value

#### Scenario: Survival world at its cap
- **WHEN** a Survival world with the maximum number of extra bots is saved and restored
- **THEN** the restored world is valid and holds the same bots

### Requirement: Profiles from before game modes
Profiles and exported files saved before modes existed SHALL keep loading: all their runs count as Classic, their best peak score is the Classic best, and the Timed and Survival bests start empty. New run fields (mode, rank) and the per-mode bests SHALL be kept when a profile is loaded again, stored, exported and imported, and SHALL NOT be dropped when another run is recorded. A run with an unknown mode SHALL be treated as Classic.

#### Scenario: Old export
- **WHEN** the player imports an export made before modes existed
- **THEN** it loads with all its runs and bests, every run listed as Classic

#### Scenario: Export and import with modes
- **WHEN** a profile with a Timed run (rank #2) and a Survival best is exported and imported
- **THEN** the Timed run still shows its mode and rank, and the Survival best is still there

#### Scenario: Reset stats
- **WHEN** the player resets their stats
- **THEN** the per-mode bests are empty afterwards
