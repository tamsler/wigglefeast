# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
