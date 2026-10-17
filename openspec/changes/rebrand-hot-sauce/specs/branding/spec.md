# Spec Delta

## Purpose

The game's visual identity: the brand gradient, where it's used, and the app icon, so the game looks like one product everywhere.

## ADDED Requirements

### Requirement: Brand gradient
The game's brand gradient SHALL be Hot Sauce, from pink #ff2e88 to orange #ff9f1c. The "feast" part of the menu wordmark and every primary action button (Play, Play again, Resume, Back, Play here, and the update banner's Reload) SHALL use it, with dark text. The logo SHALL NOT use a rainbow gradient. The browser theme colour SHALL stay the arena navy, #0b0f1c.

#### Scenario: Main menu
- **WHEN** the main menu shows
- **THEN** "feast" in the wordmark is drawn in the pink-to-orange gradient, and the Play button uses the same gradient

#### Scenario: Status bar
- **WHEN** the game runs as an installed app
- **THEN** the status bar or title bar is the arena navy

### Requirement: App icon
The installable app icons (192 and 512 px, including the maskable icon), the Apple touch icon and the favicon SHALL show the game's curled worm in the brand gradient, on the arena navy. The worm SHALL stay inside the maskable safe zone (the central circle of 80% of the icon's width), so platform icon masks never cut it. The icons SHALL be reproducible from a script in the repository.

#### Scenario: Installing the app
- **WHEN** the player installs the game or adds it to the home screen
- **THEN** its icon is the pink-to-orange curled worm on navy, with no rainbow

#### Scenario: Round icon mask
- **WHEN** a platform crops the maskable icon to a circle
- **THEN** the whole worm, including its eyes, is still visible
