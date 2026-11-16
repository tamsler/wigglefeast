# audio Specification

## Purpose
The game's sound: which of the player's actions make which sound effects, the background music, the sound and music toggles, and when the browser lets audio play.

## Requirements

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

### Requirement: Achievement fanfare
Earning an achievement SHALL play a short, bright fanfare, distinct from the other sounds, following the same sound toggle and browser rules as every other effect.

#### Scenario: Earning an achievement with sound on
- **WHEN** the player earns an achievement during a run with sound on
- **THEN** the achievement fanfare plays

#### Scenario: Sound off
- **WHEN** the player earns an achievement with sound off
- **THEN** the pop-up shows and no fanfare plays

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
Audio SHALL only start after the player's first click, tap or key press on the page, and SHALL go quiet while the game is paused, standing by for another window, or hidden, except that effects SHALL be heard while Settings is open over the pause panel, so a volume can be judged. The game SHALL keep working without errors where audio isn't available, including when opened from disk.

#### Scenario: Before any interaction
- **WHEN** the page has loaded and the player hasn't clicked, tapped or pressed a key yet
- **THEN** no audio plays and no audio error is shown

#### Scenario: No audio support
- **WHEN** the browser has no Web Audio
- **THEN** the game plays normally, silently, with no errors

#### Scenario: Paused
- **WHEN** the player pauses a run and does not open Settings
- **THEN** all sound stops, and the music starts again on resume

#### Scenario: Settings over the pause panel
- **WHEN** the player opens Settings from the pause panel and releases the Effects slider above 0%
- **THEN** the sample effect plays, the music stays off, and the game is quiet again when Settings is closed

### Requirement: Volume levels
The Settings screen SHALL have Master, Effects and Music volume sliders from 0% to 100%, all at 100% by default. 100% on all three SHALL be exactly as loud as sound was before volume existed. Master SHALL scale effects and music together; Effects and Music SHALL each scale only their own.

#### Scenario: Master volume
- **WHEN** the player sets Master to 50%
- **THEN** effects and music are both half as loud as at 100%

#### Scenario: Effects volume
- **WHEN** the player sets Effects to 0% and keeps Music at 100%
- **THEN** no effects are heard and the music plays at its usual level

#### Scenario: Music volume
- **WHEN** the player sets Music to 25%
- **THEN** the music is quieter and effects keep their level

#### Scenario: Hearing the level
- **WHEN** the player releases the Effects slider above 0%
- **THEN** one short effect plays at the chosen level, so the player can judge it

### Requirement: Volume and the mute buttons
The Sound and Music buttons and the M key SHALL stay quick mutes: a muted sound stays silent whatever its volume, and unmuting SHALL bring it back at the volume the player set. Volumes SHALL be remembered between sessions and SHALL be 100% when settings saved before volume existed are loaded.

#### Scenario: Muted at any volume
- **WHEN** sound is turned off with the M key while Master is at 80%
- **THEN** nothing plays, and turning it on again plays at 80%

#### Scenario: Sliders don't unmute
- **WHEN** the player moves the Music slider while music is muted
- **THEN** music stays muted and the new level applies when it is unmuted

#### Scenario: Remembered
- **WHEN** the player sets Master to 40% and reloads the page
- **THEN** Master is still 40%, in Settings and in what is heard

#### Scenario: Settings from before volume
- **WHEN** settings saved before volume existed are loaded
- **THEN** all three volumes are 100% and the Sound and Music buttons keep their saved state
