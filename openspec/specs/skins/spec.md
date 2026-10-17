# skins Specification

## Purpose
How worms look: the skins players and bots can wear, how each skin's body is drawn, and how skin choices stay compatible with saved games.

## Requirements

### Requirement: Skin finishes
Every skin SHALL have a finish that decides how its body is drawn: stripes (colour bands), gradient (a smooth blend from head to tail), neon (a dark body with a glowing outline and running lights), metallic (a shine that moves along the body), spots, scales (a diamond pattern down the spine), galaxy (twinkling stars), or pulse (glowing waves running toward the tail). Every finish keeps the worm's outline, eyes and size.

#### Scenario: Animated finishes
- **WHEN** a worm with the metallic, neon, galaxy or pulse finish is on screen while the game is running
- **THEN** its shine, lights, stars or glow move over time, and they stop moving while the game is paused

#### Scenario: Existing skins
- **WHEN** a worm wears one of the 14 original skins
- **THEN** it is drawn with stripes exactly as before

### Requirement: Available skins
The player SHALL be able to choose from every skin that is not hidden: the 12 original visible skins plus Aurora, Sunset Drive, Synthwave, Toxic, Gold Rush, Chrome, Ladybug, Leopard, Viper, Galaxy, Magma and Abyss. Each swatch in the skin picker SHALL show that skin's finish. New bots SHALL be given a random skin from the same choice.

#### Scenario: Picking a new skin
- **WHEN** the player picks Galaxy and presses Play
- **THEN** their worm is drawn with the galaxy finish, and the choice is remembered next time

#### Scenario: Bots wear new skins
- **WHEN** a world is created
- **THEN** its bots wear skins from the same choice the player has, new skins included, and never a hidden skin

### Requirement: Hidden skins stay compatible
Rainbow and Lavender SHALL be hidden: not offered in the picker and not given to new bots. Skins SHALL keep their position in the skin list, so a saved world or remembered setting that refers to any skin, hidden or not, SHALL keep loading with that skin.

#### Scenario: Old save with a hidden skin
- **WHEN** a world saved with a Rainbow bot or player is loaded
- **THEN** that worm is still drawn as Rainbow

#### Scenario: Remembered hidden skin
- **WHEN** the player's remembered skin is Lavender
- **THEN** their worm keeps Lavender until they pick another skin, and the picker shows no swatch selected

### Requirement: Readable skin colours
Each skin SHALL have a bright accent colour, used for its minimap dot and its boost arrows, and a set of food colours, used for the food it drops when boosting and when it dies. Accent and food colours SHALL stand out against the dark arena, even for skins whose body is dark.

#### Scenario: Dark-bodied skin
- **WHEN** a Synthwave worm dies
- **THEN** the food it leaves is in its bright pink and cyan, not its near-black body colour, and its minimap dot is pink
