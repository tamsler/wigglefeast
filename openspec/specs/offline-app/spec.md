# offline-app Specification

## Purpose
Letting players install Wigglefeast as an app and play without a network connection, while it still runs when opened straight from disk.

## Requirements

### Requirement: Installable
The site SHALL provide a web app manifest (name Wigglefeast, standalone display, 192 and 512 px icons including a maskable icon) and Apple home-screen metadata, so supporting browsers offer to install it.

#### Scenario: Installing in Chrome
- **WHEN** a player visits the site in Chrome
- **THEN** the browser offers to install Wigglefeast as an app

### Requirement: Offline play
When served over http(s), a service worker SHALL cache all game files on install so the game loads with no network. It SHALL NOT be registered when the page is opened from file://. The game SHALL ask the browser for persistent storage.

#### Scenario: Launching offline
- **WHEN** an installed player opens the app with no network connection
- **THEN** the game loads and plays normally

#### Scenario: Opening from disk
- **WHEN** index.html is opened directly from disk
- **THEN** the game runs without a service worker

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
