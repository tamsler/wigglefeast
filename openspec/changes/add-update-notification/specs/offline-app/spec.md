# Spec Delta

## MODIFIED Requirements

### Requirement: Updates
Each release SHALL be identified by a single version and downloaded as a complete set of game files, fetched fresh from the network rather than from the browser's HTTP cache, into storage of its own. A running game SHALL keep using one release's files until it reloads onto the next, and storage from older releases SHALL be deleted once a newer release takes over.

#### Scenario: New version deployed
- **WHEN** a new version is deployed and an installed player opens the app
- **THEN** the new release downloads in the background while the current release keeps running, and the player can switch by reloading or relaunching

#### Scenario: No mixed releases
- **WHEN** a launch happens while a new release is only partly downloaded
- **THEN** the game runs entirely on the previous release's files

#### Scenario: Old release cleaned up
- **WHEN** a newer release takes over
- **THEN** the previous release's cached files are deleted
