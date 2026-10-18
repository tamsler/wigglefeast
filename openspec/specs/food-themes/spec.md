# food-themes Specification

## Purpose
How food looks in the arena: the available food themes, how the player chooses one (including a seasonal Auto setting), and how themed items map to food sizes without changing gameplay.

## Requirements

### Requirement: Food themes
The game SHALL offer five food themes: Classic (glowing dots), Halloween (candy corn, wrapped candy, lollipop, pumpkin), Christmas (candy cane, ornament, gingerbread, gift), Snacks (cherry, cookie, donut, cake slice) and Tech (microchip, battery, floppy disk, gear). Themed items SHALL be drawn by the game itself, so they look the same on every device.

#### Scenario: Snacks theme
- **WHEN** the Snacks theme is active
- **THEN** food in the arena appears as cherries, cookies, donuts and cake slices instead of dots

#### Scenario: Classic theme
- **WHEN** the Classic theme is active
- **THEN** food looks exactly as it did before themes existed

### Requirement: Themed item sizes
In a themed arena, small food SHALL show one of the theme's two small items, medium food its medium item, and large food its large item. A piece of food SHALL keep the same item for as long as it exists. Each item SHALL sit on a soft glow in the food's own colour. Food values, sizes, pickup and saving SHALL be unchanged by the theme.

#### Scenario: Big food in Halloween
- **WHEN** a big worm dies in a Halloween arena and leaves large food
- **THEN** that food shows pumpkins glowing in the worm's colours, and eating them gives the same mass as before

#### Scenario: Same item for its life
- **WHEN** a piece of food is on screen for several seconds, or the world is saved and loaded
- **THEN** it keeps showing the same item

### Requirement: Choosing a theme
The menu SHALL let the player choose Auto, Classic, Halloween, Christmas, Snacks or Tech, and SHALL remember the choice. Auto SHALL be the default. Auto SHALL use Halloween from 15 to 31 October, Christmas from 1 to 26 December, and Classic on every other day, following the player's local date. Auto SHALL be listed first, and the theme Auto currently uses SHALL NOT be listed again, unless the player has chosen it explicitly.

#### Scenario: Picking a theme
- **WHEN** the player picks Tech and reloads the game
- **THEN** Tech is still selected and the arena shows tech items

#### Scenario: Auto in late October
- **WHEN** the theme is Auto and the local date is 20 October
- **THEN** the arena shows the Halloween theme

#### Scenario: Auto on an ordinary day
- **WHEN** the theme is Auto and the local date is 1 March
- **THEN** the arena shows the Classic theme

#### Scenario: No duplicate of Auto's theme
- **WHEN** the menu shows on 20 October and the player's choice is Auto
- **THEN** the picker lists Auto, Classic, Christmas, Snacks and Tech, without a separate Halloween button

#### Scenario: Explicit choice of the seasonal theme
- **WHEN** the player has chosen Halloween explicitly and the menu shows on 20 October
- **THEN** the Halloween button is listed and selected

#### Scenario: Remembered settings from before themes
- **WHEN** the player's remembered settings have no theme, or an unknown one
- **THEN** the theme is Auto
