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
Each finished run (death or quit) SHALL be recorded with date, name, final and peak score, kills, food eaten, time survived, cause, difficulty and bot count. The profile SHALL keep lifetime totals, best peak score per difficulty, the top 10 runs by peak score and the 50 most recent runs, and SHALL be shown on the Stats & high scores screen.

#### Scenario: Personal best
- **WHEN** a run's peak score beats the previous best
- **THEN** the death screen says it is a new personal best and the stats screen shows it first in Top runs

### Requirement: Export, import and reset
The stats screen SHALL export the profile and world to a JSON file, import such a file after confirmation (replacing profile and world), and reset stats after confirmation. Files with app id 'wigglefeast' or 'worm-arena' SHALL be accepted; anything else SHALL be rejected with a message.

#### Scenario: Importing a non-save file
- **WHEN** the player imports a JSON file that is not a Wigglefeast save
- **THEN** nothing changes and an error message is shown

### Requirement: Backward compatibility
Saved data SHALL keep loading across releases: localStorage keys keep the 'wormarena.' prefix, and world snapshots carry a format version (currently 1).

#### Scenario: Save from before the rename
- **WHEN** a save created under the old name is loaded
- **THEN** it restores normally
