# Spec Delta

## Purpose

The game's sound: which of the player's actions make which sound effects, the background music, the sound and music toggles, and when the browser lets audio play.

## ADDED Requirements

### Requirement: Sound effects for the player's actions
The game SHALL play generated sound effects for the player's own actions: a pop when eating food (higher for small food, deeper for big food), a whoosh for as long as the player boosts, a chime when picking up a power-up, a sparkle when eating special food, a chomp and short fanfare when eating another worm, and a falling tone when dying. Bots' actions SHALL make no sound.

#### Scenario: Eating
- **WHEN** the player's worm eats a piece of food
- **THEN** a pop plays, lower in pitch for bigger food

#### Scenario: Boosting
- **WHEN** the player starts boosting and later stops
- **THEN** a whoosh starts with the boost and fades out when it stops

#### Scenario: Pickups
- **WHEN** the player picks up a power-up, or eats special food
- **THEN** the power-up chime, or the special-food sparkle, plays

#### Scenario: Kill and death
- **WHEN** the player eats another worm, or the player's worm dies
- **THEN** the chomp and fanfare, or the falling tone, plays

#### Scenario: Bots are silent
- **WHEN** a bot eats food, boosts, picks up a power-up or dies by itself
- **THEN** no sound plays

### Requirement: Eating sounds stay pleasant
Eating pops SHALL be limited to at most 12 per second; food eaten beyond that in the same moment SHALL make no extra pop, so following a trail of food never becomes a continuous buzz.

#### Scenario: Eating a dense trail
- **WHEN** the player eats 40 pieces of food within one second
- **THEN** at most 12 pops play in that second

### Requirement: Menu sounds
Buttons in the menus SHALL make a short click, and starting a run SHALL make a rising swoosh.

#### Scenario: Pressing Play
- **WHEN** the player presses Play
- **THEN** the start swoosh plays

### Requirement: Background music
A soft generated music loop SHALL play while a run is being played, and SHALL stop while the game is paused, after the player dies, in the menus, while another window has the game, and while the page is hidden.

#### Scenario: Playing a run
- **WHEN** a run is being played with music on
- **THEN** the music loop plays

#### Scenario: Pausing
- **WHEN** the player pauses
- **THEN** the music stops, and starts again on resume

### Requirement: Sound and music toggles
The player SHALL be able to turn all sound off and on, and the music alone off and on, from buttons in the main menu and on the pause panel. Both SHALL be on by default and SHALL be remembered between sessions. Turning sound off SHALL silence effects and music; turning music off SHALL leave effects playing. Settings saved before this change SHALL load with both on.

#### Scenario: Muting
- **WHEN** the player turns sound off
- **THEN** no effects or music play until it is turned on again, also after reloading the page

#### Scenario: Music off
- **WHEN** the player turns music off and keeps sound on
- **THEN** effects still play and the music stays off, also after reloading the page

#### Scenario: Older settings
- **WHEN** the game loads settings saved before sound existed
- **THEN** sound and music are both on and every other setting is kept

### Requirement: Audio follows browser rules
Audio SHALL only start after the player's first click, tap or key press on the page, and SHALL go quiet while the game is paused, standing by for another window, or hidden. The game SHALL keep working without errors where audio isn't available, including when opened from disk.

#### Scenario: Before any interaction
- **WHEN** the page has loaded and the player hasn't clicked, tapped or pressed a key yet
- **THEN** no audio plays and no audio error is shown

#### Scenario: No audio support
- **WHEN** the browser has no Web Audio
- **THEN** the game plays normally, silently, with no errors
