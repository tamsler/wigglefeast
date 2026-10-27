# skins Specification

## Purpose
How worms look: the skins players and bots can wear, how each skin's body is drawn, and how skin choices stay compatible with saved games.

## Requirements

### Requirement: Skin finishes
Every skin SHALL have a finish that decides how its body is drawn: stripes (colour bands), gradient (a smooth blend from head to tail), neon (a dark body with a glowing outline and running lights), metallic (a shine that moves along the body), spots, scales (a diamond pattern down the spine), galaxy (twinkling stars), or pulse (glowing waves running toward the tail). The finish SHALL decide the body's colours and the markings drawn on top of its ridges. Every finish keeps the worm's eyes and size, and its dark outline, except a see-through finish (Ghost), whose body would show the outline through it (#187).

#### Scenario: Animated finishes
- **WHEN** a worm with the metallic, neon, galaxy or pulse finish is on screen while the game is running
- **THEN** its shine, lights, stars or glow move over time, and they stop moving while the game is paused

#### Scenario: Existing skins
- **WHEN** a worm wears one of the 14 original skins
- **THEN** its colour bands keep their colours and order

#### Scenario: Markings stay visible
- **WHEN** a worm wears a spots, scales, galaxy or neon skin
- **THEN** its spots, diamond scales, stars or running lights are drawn over the ridged body, not hidden by it

### Requirement: Ridged round body
Every worm's body SHALL look like a stack of thin round discs, one per segment, laid from the tail to the head: a smooth outline with a fine curved ridge across the body at each segment (the back edge of each disc, curving toward the tail) and a soft highlight along its length, so the body looks round. Ridges MAY be left out on worms only a few pixels wide on screen. The body SHALL keep its outline, width and length, so collisions still match what the player sees.

#### Scenario: Body looks ridged
- **WHEN** any worm, player or bot, is on screen at a normal size
- **THEN** its body shows fine curved ridges, one per segment, from head to tail instead of a flat tube

#### Scenario: Same size as before
- **WHEN** a worm of a given mass is drawn
- **THEN** its body is as wide and as long as before, and other worms die touching it exactly where they did before

#### Scenario: Long body partly on screen
- **WHEN** a massive worm's body crosses the screen while its head and tail are off screen
- **THEN** the visible part is drawn with its ridges and the game keeps running smoothly

### Requirement: Worm eyes
Every worm SHALL have two large round eyes near the front of its head, close together and facing the way it moves. Each eye SHALL have a large dark pupil that looks toward where the worm is steering, and a small white glint. Eyes SHALL stay on top of the worm's own body and keep showing while the worm is shielded or boosting.

#### Scenario: Pupils follow steering
- **WHEN** the player steers to one side of where their worm is heading
- **THEN** both pupils look toward that side while the worm turns

#### Scenario: Eyes on every skin
- **WHEN** a worm with any skin is drawn, including dark skins like Synthwave or Galaxy
- **THEN** its eyes are white with dark pupils and clearly visible

### Requirement: Boosting shows arrows only
While a worm boosts, it SHALL NOT be drawn with a glow around its body; the boost arrows in front of its head SHALL stay, placed far enough ahead to clear its eyes.

#### Scenario: Seeing a worm boost
- **WHEN** any worm boosts within view
- **THEN** two arrows show ahead of its head, clear of its eyes, and its body has no glow around it

### Requirement: Available skins
The player SHALL be able to choose from every skin that is not hidden: the 12 original visible skins plus Aurora, Sunset Drive, Synthwave, Toxic, Gold Rush, Chrome, Ladybug, Leopard, Viper, Galaxy, Magma and Abyss, and also from each unlockable skin they have unlocked. Each swatch in the skin picker SHALL show that skin's finish. New bots SHALL be given a random skin from the 24 free skins, never an unlockable or hidden one.

#### Scenario: Picking a new skin
- **WHEN** the player picks Galaxy and presses Play
- **THEN** their worm is drawn with the galaxy finish, and the choice is remembered next time

#### Scenario: Bots wear new skins
- **WHEN** a world is created
- **THEN** its bots wear skins from the 24 free skins, new skins included, and never a hidden or unlockable skin

### Requirement: Skin preview in the menu
The main menu SHALL show a preview of a worm wearing the selected skin, larger than the skin swatches, drawn the same way worms are drawn in the arena (ridged body, finish and eyes). The preview SHALL change to a newly picked skin straight away. It SHALL wiggle gently while the menu shows, and SHALL hold still when the player's system asks for reduced motion.

#### Scenario: Picking a skin
- **WHEN** the player picks Leopard in the skin picker
- **THEN** the preview immediately shows a Leopard worm, spots and eyes included

#### Scenario: Remembered hidden skin
- **WHEN** the menu opens with a remembered Ghost that the player has unlocked
- **THEN** the preview shows a Ghost worm

#### Scenario: Reduced motion
- **WHEN** the player's system is set to reduce motion
- **THEN** the preview shows the worm in a still pose

#### Scenario: Small screens
- **WHEN** the menu shows on a phone
- **THEN** the preview fits the menu's width without sideways scrolling

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

### Requirement: Reward skins
The game SHALL have six reward skins, each with an animated finish no free skin has: Ghost, Holo, Inferno, Storm, Crystal and Galaxy Prime. Each SHALL have a bright accent and food colours like the other skins, and its animation SHALL move with game time and stop while the game is paused. None SHALL be drawn with a glow around its body: the edge of the body is where another worm's head kills, like any other skin's (#190).

#### Scenario: The six looks
- **WHEN** the six rewards are drawn
- **THEN** Ghost is see-through; Holo has rainbow colours drifting along the body with a sweeping white shine and twinkles; Inferno is charred with molten veins and cracks pulsing toward the tail; Storm is dark blue with lightning bolts flickering across it; Crystal has icy facets with flashing sparkles; Galaxy Prime has drifting nebula clouds, stars and shooting stars

#### Scenario: Wearing Inferno
- **WHEN** the player has unlocked Inferno and plays with it
- **THEN** their worm has a charred body with glowing orange veins and cracks that pulse toward the tail, and drops orange food

#### Scenario: Wearing Ghost
- **WHEN** the player plays with Ghost
- **THEN** the arena floor shows through their body, which has no dark outline under it and no glow around it, and their eyes stay solid

#### Scenario: Picker swatches
- **WHEN** the player opens the menu
- **THEN** each reward's swatch shows its own finish, dimmed with a padlock while locked

#### Scenario: Paused
- **WHEN** the game is paused while a Storm, Inferno or Galaxy Prime worm is on screen
- **THEN** its lightning, cracks and stars stop moving

### Requirement: Locked skins in the picker
The skin picker SHALL show every unlockable skin, after the free ones: unlocked ones as normal swatches, locked ones dimmed with a padlock. Picking a locked skin SHALL NOT select it, and SHALL show which achievement unlocks it.

#### Scenario: Tapping a locked skin
- **WHEN** the player taps the locked Galaxy Prime swatch
- **THEN** the skin doesn't change, and the menu says "Reach 10,000 on Hard to unlock Galaxy Prime"

#### Scenario: After unlocking
- **WHEN** the player has earned Big Noodle and opens the menu
- **THEN** Holo shows as a normal swatch and can be picked

### Requirement: Readable skin colours
Each skin SHALL have a bright accent colour, used for its minimap dot and its boost arrows, and a set of food colours, used for the food it drops when boosting and when it dies. Accent and food colours SHALL stand out against the dark arena, even for skins whose body is dark.

#### Scenario: Dark-bodied skin
- **WHEN** a Synthwave worm dies
- **THEN** the food it leaves is in its bright pink and cyan, not its near-black body colour, and its minimap dot is pink
