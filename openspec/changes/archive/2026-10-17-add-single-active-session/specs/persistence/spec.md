# Spec Delta

## ADDED Requirements

### Requirement: One active game at a time
When the game is open in several tabs or windows of the same browser, only one of them, the active window, SHALL play and write the world and stats to storage. Every other window SHALL show a panel saying the game is open in another window, with a Play here button, and SHALL NOT write the world or stats while that panel shows.

#### Scenario: Opening a second window
- **WHEN** the player opens the game while it is already open and active in another window
- **THEN** the new window shows the "open in another window" panel with Play here, and the saved world and stats stay exactly as the active window left them

#### Scenario: Play here during a run
- **WHEN** the player presses Play here while the other window has a run in progress
- **THEN** the other window saves and switches to the "open in another window" panel, and this window opens on the "Welcome back" panel with the same worm and score

#### Scenario: Previous window closed or not responding
- **WHEN** the window that was active has been closed, has crashed, or does not respond to Play here within about two seconds
- **THEN** this window takes over from the last save

#### Scenario: The game is reloaded
- **WHEN** the only open window is reloaded
- **THEN** it becomes active again straight away, without showing the panel

## MODIFIED Requirements

### Requirement: Stats and high scores
Each finished run (death or quit) SHALL be recorded with date, name, final and peak score, kills, food eaten, time survived, cause, difficulty and bot count. The profile SHALL keep lifetime totals, best peak score per difficulty, the top 10 runs by peak score and the 50 most recent runs, and SHALL be shown on the Stats & high scores screen. Recording a run SHALL add it to the profile as it is stored at that moment, so runs recorded by another window are kept.

#### Scenario: Personal best
- **WHEN** a run's peak score beats the previous best
- **THEN** the death screen says it is a new personal best and the stats screen shows it first in Top runs

#### Scenario: Runs from two windows
- **WHEN** the player finishes a run in one window, then switches to another window with Play here and finishes a run there
- **THEN** the stats show both runs and count both games
