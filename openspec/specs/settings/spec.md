# settings Specification

## Purpose
The Settings screen: where players change how the game looks and what it shows, how it is opened and closed from the menu and the pause panel, and how those preferences are remembered between sessions.

## Requirements

### Requirement: Opening and closing Settings
The main menu and the pause panel SHALL each have a Settings button that opens the Settings screen. Back SHALL return to the screen it was opened from. Opening Settings from the pause panel SHALL leave the run paused and unchanged.

#### Scenario: From the main menu
- **WHEN** the player presses Settings on the main menu and then Back
- **THEN** the Settings screen opens and Back returns to the main menu with its choices unchanged

#### Scenario: From the pause panel
- **WHEN** the player pauses a run, opens Settings, changes a setting and presses Back
- **THEN** the pause panel is shown again, the run is still paused with the same score, and Resume continues it

#### Scenario: Escape closes Settings first
- **WHEN** Settings is open over the pause panel and the player presses Esc or P
- **THEN** Settings closes and the pause panel is shown; the run does not resume until the player resumes it

#### Scenario: Another window takes over
- **WHEN** Settings is open and another window takes the game
- **THEN** this window shows the "open in another window" panel instead, and no settings are written from it

### Requirement: Graphics quality setting
The Settings screen SHALL offer a graphics quality of High or Low. High SHALL be the default and SHALL look exactly as the game did before this setting existed. A change SHALL take effect at once, without reloading the page.

#### Scenario: Default
- **WHEN** a player who has never changed it opens Settings
- **THEN** High is selected and the game looks as before

#### Scenario: Switching while paused
- **WHEN** the player pauses a run, opens Settings, switches to Low and goes back
- **THEN** the paused arena is drawn in Low quality at once, with the same worms, food and score

### Requirement: Low graphics draw less
In Low quality, food SHALL be drawn as a plain dot without its glow halo, worm bodies SHALL be drawn without the soft highlight and light rim along them, and the game SHALL be drawn at no more than one canvas pixel per CSS pixel.

#### Scenario: Food without a glow
- **WHEN** Low is selected and food is on screen
- **THEN** each piece of food is a plain dot in its own colour with no halo around it

#### Scenario: Worms without a highlight
- **WHEN** Low is selected and a worm is on screen
- **THEN** its body has no highlight or light rim, but still has its outline, ridges, markings and eyes

#### Scenario: Fewer pixels on a sharp screen
- **WHEN** Low is selected on a screen with a device pixel ratio of 2
- **THEN** the game canvas is as many pixels wide and high as the window is in CSS pixels, a quarter of the pixels High uses

#### Scenario: Screens that are not sharp
- **WHEN** Low is selected on a screen with a device pixel ratio of 1
- **THEN** the canvas has the same pixel size as in High

### Requirement: Low graphics change nothing but the look
Graphics quality SHALL affect only how the arena is drawn. Worlds, collisions, scores, bots, saves and the sizes at which things are drawn SHALL be identical in High and Low.

#### Scenario: Same world either way
- **WHEN** the same seeded world runs for the same time in High and in Low
- **THEN** both worlds end in the same state

#### Scenario: Where things are hit
- **WHEN** a worm's head touches another worm's body or a piece of food in Low
- **THEN** the same kill or meal happens as in High

### Requirement: Show bot names setting
The Settings screen SHALL have a Show bot names setting, on by default. How the arena looks with it off is specified in the HUD.

#### Scenario: Default
- **WHEN** a player who has never changed it opens Settings
- **THEN** Show bot names is on and bots are labelled as before

#### Scenario: Switching it off
- **WHEN** the player turns Show bot names off
- **THEN** bots lose their labels at once, also while the game is paused behind Settings

### Requirement: Settings are remembered
Every setting SHALL be saved as soon as it changes, by the window that has the game, together with the existing menu settings, and SHALL be restored when the game starts again, also after an update. Settings saved by earlier releases SHALL load with every new setting at its default and every older setting kept.

#### Scenario: After reloading
- **WHEN** the player sets Low graphics, hides bot names, lowers a volume and reloads the page
- **THEN** all three are still set, in Settings and in the arena

#### Scenario: Settings from an earlier release
- **WHEN** the game loads settings saved before the Settings screen existed, with a name, skin, bot count, difficulty, mode and theme
- **THEN** quality is High, bot names are shown, every volume is 100%, and every older setting is kept

#### Scenario: A damaged value
- **WHEN** a stored setting holds a value that is not valid, such as a quality of "ultra" or a volume of 5
- **THEN** that one setting falls back to its default, the others are kept, and the game starts normally

#### Scenario: Another window changed them
- **WHEN** another window changes a setting and this window takes the game over
- **THEN** this window shows and uses the changed setting

### Requirement: Settings fit small screens
The Settings screen SHALL show every control on a phone-sized screen without sideways scrolling, scrolling up and down if it must, and every control SHALL be usable with touch.

#### Scenario: A small phone
- **WHEN** Settings is opened on a 360 by 640 pixel screen
- **THEN** every control can be reached and used, and the page does not scroll sideways
