# Spec Delta

## MODIFIED Requirements

### Requirement: Skin finishes
Every skin SHALL have a finish that decides how its body is drawn: stripes (colour bands), gradient (a smooth blend from head to tail), neon (a dark body with a glowing outline and running lights), metallic (a shine that moves along the body), spots, scales (a diamond pattern down the spine), galaxy (twinkling stars), or pulse (glowing waves running toward the tail). The finish SHALL decide the body's colours and the markings drawn on top of its ridges. Every finish keeps the worm's outline, eyes and size.

#### Scenario: Animated finishes
- **WHEN** a worm with the metallic, neon, galaxy or pulse finish is on screen while the game is running
- **THEN** its shine, lights, stars or glow move over time, and they stop moving while the game is paused

#### Scenario: Existing skins
- **WHEN** a worm wears one of the 14 original skins
- **THEN** its colour bands keep their colours and order

#### Scenario: Markings stay visible
- **WHEN** a worm wears a spots, scales, galaxy or neon skin
- **THEN** its spots, diamond scales, stars or running lights are drawn over the ridged body, not hidden by it

## ADDED Requirements

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

### Requirement: Boosting shows arrows only
While a worm boosts, it SHALL NOT be drawn with a glow around its body; the boost arrows in front of its head SHALL stay, placed far enough ahead to clear its eyes.

#### Scenario: Seeing a worm boost
- **WHEN** any worm boosts within view
- **THEN** two arrows show ahead of its head, clear of its eyes, and its body has no glow around it

### Requirement: Worm eyes
Every worm SHALL have two large round eyes near the front of its head, close together and facing the way it moves. Each eye SHALL have a large dark pupil that looks toward where the worm is steering, and a small white glint. Eyes SHALL stay on top of the worm's own body and keep showing while the worm is shielded or boosting.

#### Scenario: Pupils follow steering
- **WHEN** the player steers to one side of where their worm is heading
- **THEN** both pupils look toward that side while the worm turns

#### Scenario: Eyes on every skin
- **WHEN** a worm with any skin is drawn, including dark skins like Synthwave or Galaxy
- **THEN** its eyes are white with dark pupils and clearly visible

### Requirement: Skin preview in the menu
The main menu SHALL show a preview of a worm wearing the selected skin, larger than the skin swatches, drawn the same way worms are drawn in the arena (ridged body, finish and eyes). The preview SHALL change to a newly picked skin straight away. It SHALL wiggle gently while the menu shows, and SHALL hold still when the player's system asks for reduced motion.

#### Scenario: Picking a skin
- **WHEN** the player picks Leopard in the skin picker
- **THEN** the preview immediately shows a Leopard worm, spots and eyes included

#### Scenario: Remembered hidden skin
- **WHEN** the menu opens with a remembered hidden skin such as Lavender
- **THEN** the preview shows a Lavender worm even though no swatch is selected

#### Scenario: Reduced motion
- **WHEN** the player's system is set to reduce motion
- **THEN** the preview shows the worm in a still pose

#### Scenario: Small screens
- **WHEN** the menu shows on a phone
- **THEN** the preview fits the menu's width without sideways scrolling
