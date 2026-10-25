# Spec Delta

## MODIFIED Requirements

### Requirement: Hidden skins stay compatible
Holo and Ghost (formerly Rainbow and Lavender) SHALL be unlockable rewards: not offered in the picker until unlocked, and never given to new bots. Skins SHALL keep their position in the skin list, so a saved world or remembered setting that refers to any skin SHALL keep loading; a skin whose look was replaced is drawn with its new look. A locked reward SHALL NOT be worn: when the chosen skin is locked (on load, after Reset stats, after importing a save, or when another window takes over), the choice SHALL fall back to the first free skin, Cherry Pop, and a run in progress in a locked skin SHALL continue in that free skin (#178).

#### Scenario: Old save with a hidden skin
- **WHEN** a world saved with a Rainbow bot or player (position of Holo) is loaded
- **THEN** that worm is drawn as Holo

#### Scenario: Remembered hidden skin
- **WHEN** the player's remembered skin is Ghost and they haven't unlocked it
- **THEN** the menu shows Cherry Pop selected, and the next run is in Cherry Pop

#### Scenario: Reset stats with a reward chosen
- **WHEN** the player has Holo chosen and resets their stats
- **THEN** Holo is locked again, Cherry Pop is chosen instead, and the next run is in Cherry Pop

### Requirement: Locked skins in the picker
The skin picker SHALL show every unlockable skin, after the free ones: unlocked ones as normal swatches, locked ones dimmed with a padlock. Picking a locked skin SHALL NOT select it, and SHALL show which achievement unlocks it.

#### Scenario: Tapping a locked skin
- **WHEN** the player taps the locked Galaxy Prime swatch
- **THEN** the skin doesn't change, and the menu says "Reach 10,000 on Hard to unlock Galaxy Prime"

#### Scenario: After unlocking
- **WHEN** the player has earned Big Noodle and opens the menu
- **THEN** Holo shows as a normal swatch and can be picked

## REMOVED Requirements

### Requirement: New unlockable skins
**Reason**: Replaced by *Reward skins*, which covers all six rewards with new looks.
**Migration**: The four skins' positions in the skin list are kept and now hold Inferno, Storm, Crystal and Galaxy Prime.

## ADDED Requirements

### Requirement: Reward skins
The game SHALL have six reward skins, each with an animated finish no free skin has: Ghost, Holo, Inferno, Storm, Crystal and Galaxy Prime. Each SHALL have a bright accent and food colours like the other skins, and its animation SHALL move with game time and stop while the game is paused.

#### Scenario: The six looks
- **WHEN** the six rewards are drawn
- **THEN** Ghost is see-through and softly glowing; Holo has rainbow colours drifting along the body with a sweeping white shine and twinkles; Inferno is charred with molten veins and cracks pulsing toward the tail; Storm is dark blue with lightning bolts flickering across it; Crystal has icy facets with flashing sparkles; Galaxy Prime has drifting nebula clouds, stars and shooting stars

#### Scenario: Wearing Inferno
- **WHEN** the player has unlocked Inferno and plays with it
- **THEN** their worm has a charred body with glowing orange veins and cracks that pulse toward the tail, and drops orange food

#### Scenario: Wearing Ghost
- **WHEN** the player plays with Ghost
- **THEN** the arena floor shows through their body, which glows softly, and their eyes stay solid

#### Scenario: Picker swatches
- **WHEN** the player opens the menu
- **THEN** each reward's swatch shows its own finish, dimmed with a padlock while locked

#### Scenario: Paused
- **WHEN** the game is paused while a Storm, Inferno or Galaxy Prime worm is on screen
- **THEN** its lightning, cracks and stars stop moving
