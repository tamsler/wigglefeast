# release-updates Specification

## Purpose
Lets players of an installed or hosted copy find out that a new Wigglefeast release is ready, switch to it without losing their run, and see which release they are running.

## Requirements

### Requirement: Update available banner
When a newer release has finished downloading in the background, the game SHALL show an "Update available" banner with a Reload button and a dismiss button. The banner SHALL NOT appear while a run is actively being played.

#### Scenario: Update downloads while in the menu
- **WHEN** a newer release finishes downloading while the player is on the main menu
- **THEN** the "Update available" banner appears

#### Scenario: Update downloads during a run
- **WHEN** a newer release finishes downloading while the player is actively playing
- **THEN** no banner appears until the player pauses, dies, or returns to the menu

#### Scenario: Update was already downloaded at launch
- **WHEN** the game launches and a newer release is already downloaded and waiting
- **THEN** the banner appears as soon as the player is not actively playing

### Requirement: Reload to update
Choosing Reload SHALL save the world, switch to the new release, and reload the game. A run that was in progress SHALL resume through the existing "Welcome back" panel.

#### Scenario: Reload with a run in progress
- **WHEN** the player is paused mid-run and chooses Reload on the banner
- **THEN** the game reloads on the new release and shows the "Welcome back" panel with the same worm and score

#### Scenario: Reload from the menu
- **WHEN** the player chooses Reload from the main menu
- **THEN** the game reloads on the new release and shows the main menu with stats intact

### Requirement: Deferred update
If the player dismisses or ignores the banner, the current release SHALL keep running unchanged, and the new release SHALL take over the next time the game starts after all of its windows have been closed.

#### Scenario: Dismissing the banner
- **WHEN** the player dismisses the banner
- **THEN** the banner hides and the game keeps running the current release for the rest of the session

#### Scenario: Relaunch after ignoring
- **WHEN** the player closes every game window and launches the game again
- **THEN** the new release runs

### Requirement: Update checks
The game SHALL check for a newer release when it launches, when its tab becomes visible again (at most once every 5 minutes), and at least every 30 minutes while it stays open, provided it is served over http(s) and online.

#### Scenario: Game left open
- **WHEN** a new release is deployed while the game has been open for an hour
- **THEN** the release is downloaded and the banner is offered without the player relaunching

#### Scenario: Offline
- **WHEN** the device is offline
- **THEN** update checks fail silently and the game keeps working

#### Scenario: Returning to the tab
- **WHEN** the player returns to the game's tab
- **THEN** it checks for a newer release, unless it already checked in the last 5 minutes

### Requirement: Version display
The main menu SHALL show the version of the release that is running. When the game is opened from disk, it SHALL show "local" instead.

#### Scenario: Installed copy
- **WHEN** the player opens the main menu of an installed copy running release 1.1.0
- **THEN** the menu shows "v1.1.0"

#### Scenario: Opened from disk
- **WHEN** index.html is opened directly from disk
- **THEN** the menu shows "local"

### Requirement: Release version rule
Every pull request that changes a shipped game file SHALL also change the release version, and an automated check on the pull request SHALL fail when it does not.

#### Scenario: Forgotten version bump
- **WHEN** a pull request changes main.js but not the release version
- **THEN** the pull request check fails with a message saying to bump the version

#### Scenario: Docs-only change
- **WHEN** a pull request changes only README.md or files under openspec/
- **THEN** the check passes without a version bump
