# special-food Specification

## Purpose
Rare, high-value food items (nova crystals, nebula diamonds and plasma spheres) that appear briefly at random places in the arena, whatever food theme is chosen, and give worms short-lived prizes to race for.

## Requirements

### Requirement: Special food items
The arena SHALL have three kinds of special food, worth far more than regular food:
- nova crystal: 25 mass, the most common
- nebula diamond: 50 mass
- plasma sphere: 100 mass, the rarest

#### Scenario: Value of each item
- **WHEN** a worm without any power-up eats a nova crystal, a nebula diamond and a plasma sphere
- **THEN** it gains 25, 50 and 100 mass respectively

#### Scenario: Rarity
- **WHEN** many special items have spawned
- **THEN** about 60% are nova crystals, 30% nebula diamonds and 10% plasma spheres

### Requirement: Special food appears at random
Special food SHALL appear at random places inside the arena, up to about 5 at a time in a 30-bot world, counting all three kinds together. Their number SHALL scale with the arena's area like food and power-ups. While fewer than that are in the arena, new ones SHALL keep appearing every few seconds on average, at the same pace at any update rate.

#### Scenario: A new world
- **WHEN** a 30-bot world has run for a minute and nobody has eaten any special food
- **THEN** about 5 special items, never more than 5, are in the arena at random places inside its edge

#### Scenario: Refilling
- **WHEN** a special item is eaten or disappears in a 30-bot world that had 5
- **THEN** another one appears somewhere in the arena within a few seconds

#### Scenario: Larger arena
- **WHEN** a 150-bot world has run for a minute
- **THEN** it holds more special items than a 30-bot world, at about the same density

### Requirement: Special food disappears if not eaten
Each special item SHALL last 20 seconds from when it appears. It SHALL blink during its last 4 seconds. If no worm has eaten it by then, it SHALL disappear.

#### Scenario: Nobody eats it
- **WHEN** a special item has been in the arena for 20 seconds without being eaten
- **THEN** it disappears

#### Scenario: About to vanish
- **WHEN** a special item has less than 4 seconds left
- **THEN** it blinks until it is eaten or disappears

### Requirement: Eating special food
Any worm, player or bot, SHALL eat a special item the way it eats food. Near the head the item drifts in and is eaten. A worm with the magnet pulls it in from as far as the magnet pulls food. The x2 and x5 power-ups SHALL NOT multiply its value. When the player eats one, the feed SHALL show its name and value.

#### Scenario: Player eats a nebula diamond
- **WHEN** the player's worm reaches a nebula diamond
- **THEN** it disappears, the worm gains 50 mass, and the feed shows "Nebula diamond +50"

#### Scenario: Magnet
- **WHEN** a worm with the magnet passes a special item at the distance the magnet pulls food from
- **THEN** the item is pulled in and eaten

#### Scenario: Multiplier does not apply
- **WHEN** a worm with x5 eats a plasma sphere
- **THEN** it gains 100 mass, not 500

#### Scenario: Bots go for special food
- **WHEN** a bot looking for food sees a special item within its food search range
- **THEN** it rates the item as food of that value and usually heads for it over nearby regular food

### Requirement: Special food looks the same in every theme
Each special item SHALL have its own look, drawn by the game itself, and SHALL look the same in every food theme, Classic included:
- nova crystal: a cyan faceted crystal
- nebula diamond: a violet-pink cut diamond
- plasma sphere: a glowing orb with an electric core

Special items SHALL be drawn larger than any regular food and SHALL sparkle, so they stand out.

#### Scenario: Halloween theme
- **WHEN** the Halloween theme is active and a plasma sphere is on screen
- **THEN** it shows as a glowing plasma orb, not as Halloween candy

#### Scenario: Classic theme
- **WHEN** the Classic theme is active
- **THEN** special items show their crystal, diamond and orb looks, while regular food stays plain dots

### Requirement: Special food is saved with the world
Special items SHALL be saved with the world, with their kind, position and the time they have left. Saves without special items SHALL keep loading.

#### Scenario: Save and reload
- **WHEN** the world is saved while a nebula diamond has 12 seconds left, and is then loaded
- **THEN** the diamond is in the same place and disappears about 12 seconds later if not eaten

#### Scenario: Save from before special food
- **WHEN** a save written before special food existed is loaded
- **THEN** it loads normally, and special items start appearing as the world runs
