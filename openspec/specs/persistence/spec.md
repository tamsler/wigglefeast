# persistence Specification

## Purpose
Keeping the world, the current run and the player's stats between sessions, entirely in the browser.

## Requirements

### Requirement: World autosave
The full world (worms, bodies, bot state, food, power-ups, current run) SHALL be saved to localStorage every 10 seconds, when the tab becomes hidden, and when the page is closed or reloaded. If the save does not fit in storage, the stale world save SHALL be removed rather than left behind.

#### Scenario: Closing the tab mid-run
- **WHEN** the player closes the tab while playing
- **THEN** the world, including the player's worm, is saved

### Requirement: Resume
On load, a saved world SHALL be restored. If the player's worm was alive, the game SHALL open paused on a "Welcome back" panel offering Resume or End run, and the player SHALL get a 2-second shield on resume. If no player was alive, the restored world runs behind the main menu.

#### Scenario: Reopening after closing mid-run
- **WHEN** the player reopens the game after closing it mid-run
- **THEN** the "Welcome back" panel shows their worm's name and score, and Resume continues the run

#### Scenario: Ending a run from the pause panel
- **WHEN** the player chooses End run
- **THEN** the run is recorded with cause "Quit", the worm turns into food, and the main menu shows

### Requirement: New world on settings change
Pressing Play with a bot count or difficulty different from the current world's SHALL create a new world, replacing the saved one. Stats are not affected.

#### Scenario: Changing difficulty
- **WHEN** the player switches from normal to hard and presses Play
- **THEN** a new hard world is created

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

### Requirement: Export, import and reset
The stats screen SHALL export the profile and world to a JSON file, import such a file after confirmation (replacing profile and world), and reset stats after confirmation. Files with app id 'wigglefeast' or 'worm-arena' SHALL be accepted; anything else SHALL be rejected with a message. Exported files SHALL NOT include the record of the player's habits, and importing SHALL leave it unchanged. Resetting stats SHALL also clear that record.

#### Scenario: Importing a non-save file
- **WHEN** the player imports a JSON file that is not a Wigglefeast save
- **THEN** nothing changes and an error message is shown

#### Scenario: Reset forgets habits
- **WHEN** the player resets their stats
- **THEN** the record of their habits is empty afterwards

### Requirement: Backward compatibility
Saved data SHALL keep loading across releases: localStorage keys keep the 'wormarena.' prefix, and world snapshots carry a format version (currently 1).

#### Scenario: Save from before the rename
- **WHEN** a save created under the old name is loaded
- **THEN** it restores normally

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

### Requirement: Player habits are remembered
The record of the player's habits SHALL be stored on the device, separately from the world and the stats, and SHALL carry over to every new or restored world. It SHALL be saved whenever the world is saved, and only by the window that owns the session. A missing or damaged record SHALL start empty without stopping the game.

#### Scenario: Habits carry over
- **WHEN** the player plays a game, closes the page and starts a new game later
- **THEN** the bots in the new game use the same record of the player's habits

#### Scenario: Damaged record
- **WHEN** the stored record of the player's habits is not valid
- **THEN** the game starts normally with an empty record
