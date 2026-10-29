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

### Requirement: Export, import and reset
The stats screen SHALL export the profile and world to a JSON file, import such a file after confirmation (replacing profile and world), and reset stats after confirmation. Files with app id 'wigglefeast' or 'worm-arena' SHALL be accepted; anything else SHALL be rejected with a message. Exported files SHALL NOT include the record of the player's habits, and importing SHALL leave it unchanged. Resetting stats SHALL also clear that record. Earned achievements are part of the profile: exporting SHALL include them, importing SHALL replace them with the file's (plus any its stats prove), and resetting stats SHALL clear them and lock the skins they unlocked.

#### Scenario: Importing a non-save file
- **WHEN** the player imports a JSON file that is not a Wigglefeast save
- **THEN** nothing changes and an error message is shown

#### Scenario: Reset forgets habits
- **WHEN** the player resets their stats
- **THEN** the record of their habits is empty afterwards

#### Scenario: Achievements travel with a save
- **WHEN** a player exports a save with Top of the Board earned and imports it on another device
- **THEN** Top of the Board is earned there too

#### Scenario: Reset clears achievements
- **WHEN** the player resets their stats
- **THEN** no achievement is earned and every unlockable skin is locked again

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

### Requirement: Older profiles without achievements
Profiles and exported files saved before achievements existed SHALL keep loading; their achievements SHALL be worked out from their stats, and the new counters (special food eaten, times first on the leaderboard) SHALL start at zero.

#### Scenario: Old export
- **WHEN** the player imports `save-v1.json`-style data from before achievements
- **THEN** it loads, and the achievements its stats prove are earned

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
