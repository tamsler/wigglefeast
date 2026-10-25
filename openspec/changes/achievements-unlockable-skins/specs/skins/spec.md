# Spec Delta

## MODIFIED Requirements

### Requirement: Available skins
The player SHALL be able to choose from every skin that is not hidden: the 12 original visible skins plus Aurora, Sunset Drive, Synthwave, Toxic, Gold Rush, Chrome, Ladybug, Leopard, Viper, Galaxy, Magma and Abyss, and also from each unlockable skin they have unlocked. Each swatch in the skin picker SHALL show that skin's finish. New bots SHALL be given a random skin from the 24 free skins, never an unlockable or hidden one.

#### Scenario: Picking a new skin
- **WHEN** the player picks Galaxy and presses Play
- **THEN** their worm is drawn with the galaxy finish, and the choice is remembered next time

#### Scenario: Bots wear new skins
- **WHEN** a world is created
- **THEN** its bots wear skins from the 24 free skins, new skins included, and never a hidden or unlockable skin

### Requirement: Hidden skins stay compatible
Rainbow and Lavender SHALL be unlockable rewards: not offered in the picker until unlocked, and never given to new bots. Skins SHALL keep their position in the skin list, so a saved world or remembered setting that refers to any skin, hidden, locked or not, SHALL keep loading with that skin.

#### Scenario: Old save with a hidden skin
- **WHEN** a world saved with a Rainbow bot or player is loaded
- **THEN** that worm is still drawn as Rainbow

#### Scenario: Remembered hidden skin
- **WHEN** the player's remembered skin is Lavender and they haven't unlocked it
- **THEN** their worm keeps Lavender until they pick another skin, and the picker shows no swatch selected

## ADDED Requirements

### Requirement: New unlockable skins
The game SHALL have four new skins, each unlocked by an achievement: Dragon (scales: dark red with gold diamonds), Thunder (neon: near-black with a yellow glow and running lights), Royal (metallic: purple with a moving gold shine) and Cosmic (galaxy: magenta with twinkling stars). Each SHALL have a bright accent and food colours like the other skins.

#### Scenario: Wearing Thunder
- **WHEN** the player has unlocked Thunder and plays with it
- **THEN** their worm has a near-black body with a glowing yellow outline and running lights, and drops yellow food

### Requirement: Locked skins in the picker
The skin picker SHALL show every unlockable skin, after the free ones: unlocked ones as normal swatches, locked ones dimmed with a padlock. Picking a locked skin SHALL NOT select it, and SHALL show which achievement unlocks it.

#### Scenario: Tapping a locked skin
- **WHEN** the player taps the locked Cosmic swatch
- **THEN** the skin doesn't change, and the menu says "Reach 10,000 on Expert to unlock Cosmic"

#### Scenario: After unlocking
- **WHEN** the player has earned Big Noodle and opens the menu
- **THEN** Rainbow shows as a normal swatch and can be picked
