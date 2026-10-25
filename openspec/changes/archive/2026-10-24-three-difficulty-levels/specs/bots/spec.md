# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Expert sharpness`
- TO: `### Requirement: Hard sharpness`

## MODIFIED Requirements

### Requirement: Bot population
The world SHALL keep the configured number of bots (5–150). When a bot dies, a replacement spawns 1–3 seconds later at a spot away from other worms, at mass 15–40, with a name not currently in use.

#### Scenario: Bot dies
- **WHEN** a bot dies in a world configured for 30 bots
- **THEN** within about 3 seconds there are 30 bots again

#### Scenario: Initial world
- **WHEN** a new world is created
- **THEN** most bots start small (mass 15–200) and a few start large: about 10% (up to mass 1200) on easy, 15% (up to 2000) on normal and 35% (up to 5000) on hard

#### Scenario: Largest world
- **WHEN** the player sets 150 bots and presses Play
- **THEN** a world with 150 bots starts, and it is saved and restored like any other world

### Requirement: Bot behaviour
Each bot SHALL re-plan its heading several times per second, choosing among candidate headings by its goal (nearby food weighted by value and distance, power-ups, a hunted worm, fresh remains, or a wander point) and rejecting headings that lead into other worms' bodies, the path a nearby head is about to cover (for bots that anticipate), or the arena edge.

#### Scenario: Obstacle ahead
- **WHEN** another worm's body lies across a bot's path
- **THEN** the bot turns toward a heading that is clear, if one exists

#### Scenario: Hunting
- **WHEN** an aggressive bot is near a worm lighter than its difficulty's prey limit (1× its own mass on easy, 1.3× on normal, 2× on hard)
- **THEN** it may steer ahead of that worm's head to cut it off, boosting when close

### Requirement: Difficulty
Each bot SHALL get a skill and aggression value drawn from the selected difficulty (easy, normal, hard). Higher skill means faster re-planning, more candidate headings and farther look-ahead. The intended feel:
- **Easy**: a calm arena for learning. Few large worms, bots that steer clumsily, rarely hunt, and only go after worms smaller than themselves. A new player should survive for minutes.
- **Normal**: bots eat efficiently and hunt now and then; a careless player gets cut off.
- **Hard**: bots play like experienced players: they read turns, coil, pin against the wall, trap and flank, and get out of danger. On top of the highest skills, they have Hard sharpness: they react faster, see danger sooner and escape cut-offs better. More of them start large. For players who find Normal easy.

A difficulty saved under an older name SHALL load as its current level: "expert" and "hard" both load as hard.

#### Scenario: Hard difficulty
- **WHEN** a world is created on hard
- **THEN** bots look farther ahead, react faster and hunt more than on normal

#### Scenario: Expert difficulty
- **WHEN** a world is created on hard (the level that was Expert)
- **THEN** every bot uses every tactic, and every bot has Hard sharpness

#### Scenario: Expert start
- **WHEN** a world is created on hard (the level that was Expert)
- **THEN** about a third of its bots start large, some of them up to mass 5000

#### Scenario: Old difficulty names
- **WHEN** a world or remembered setting from before this change says "expert" or "hard"
- **THEN** it loads as hard, and its bots play as hard bots

### Requirement: Hard sharpness
Every bot on hard SHALL have Hard sharpness, a property of the difficulty rather than of the bot, so it needs nothing saved and applies to bots loaded from any save. Compared with a bot of the same skill without it, a sharp bot SHALL:
- re-plan its heading more often;
- look farther ahead along each candidate heading, checking it closely enough that a body crossing anywhere along that distance is noticed;
- before boosting, check the path the boost would actually take toward its chosen heading (turning toward it no faster than it can while boosting, which is wider than at normal speed, then going straight), as far as a boost carries it, and not boost if a body lies on that path;
- consider more candidate headings;
- notice threatening heads from farther away and keep track of more of them at once;
- when one or more heads are lining up to cut it off, steer for the heading that best clears all of them, rather than turning away from the nearest one alone.

Sharp bots SHALL follow the *Fair information* rule like any other bot. Bots on easy and normal SHALL NOT have it.

#### Scenario: Faster reactions
- **WHEN** two bots of equal skill, one with Hard sharpness and one without, play for the same time
- **THEN** the sharp bot re-plans its heading more times

#### Scenario: A thin body far ahead
- **WHEN** a thin worm's body crosses a hard bot's path between two points where a bot of the same skill without sharpness would check its heading
- **THEN** the hard bot treats that heading as blocked

#### Scenario: Turning wider while boosting
- **WHEN** a hard bot wants to boost and a body lies where its wider boosting turn toward the best heading would carry it, but not on its normal-speed turn
- **THEN** it still turns toward that heading, but does not boost

#### Scenario: Two cutters at once
- **WHEN** two heads close in on a hard bot from different sides, each lining up to cut it off, and turning away from the nearer one alone would run into the other's path
- **THEN** the bot steers for a heading that clears both paths

#### Scenario: Loaded world
- **WHEN** a world saved on expert or hard before this change is loaded
- **THEN** it loads as a hard world, and its bots play with Hard sharpness

#### Scenario: Other levels unchanged
- **WHEN** the balance tool runs the same seed on easy and normal with and without hard's sharpness settings changed
- **THEN** the reports are identical apart from time per tick

### Requirement: Tactics by difficulty
Each bot SHALL know a set of tactics fixed for its lifetime and drawn from its difficulty. Easy bots SHALL use no tactics. On normal, some bots SHALL use turn prediction, head anticipation, evasion, scavenging, head-on awareness and reading other worms. On hard, every bot SHALL use every tactic, including coiling, pinning, trapping, flanking, escaping coils, shadowing and learning the player's habits. Learning the player's habits SHALL be used on hard only. Adding a tactic SHALL NOT change which of the earlier tactics any bot knows.

#### Scenario: Easy has no tactics
- **WHEN** a world is created on easy
- **THEN** no bot predicts turns, anticipates heads, evades, scavenges, seeks head-on contact, reads other worms, coils, pins, traps, flanks, escapes coils or shadows

#### Scenario: A bot keeps its tactics
- **WHEN** a world with a bot is saved and loaded again
- **THEN** that bot knows the same tactics as before

#### Scenario: Coil escape by level
- **WHEN** worlds are created on each level
- **THEN** no bot escapes coils on easy or normal, and every bot does on hard

#### Scenario: Shadowing by level
- **WHEN** worlds are created on each level
- **THEN** no bot shadows on easy or normal, and every bot does on hard

#### Scenario: Earlier tactics kept
- **WHEN** a bot with a given id is created before and after a tactic was added
- **THEN** it knows the same earlier tactics in both cases

#### Scenario: Easy and normal unchanged
- **WHEN** the same seeded world runs on easy or normal before and after a tactic was added
- **THEN** the worlds are identical

### Requirement: Slipping out of a coil
A circled bot that escapes coils SHALL take a path out of the loop when a path it can actually take (turning toward a heading no faster than it can, then going straight) leads clear of the coiler's loop with no body in the way, whatever its level.

#### Scenario: A gap opens
- **WHEN** an escaping bot is circled and part of the loop is still open, with a path it can take through it clear of bodies
- **THEN** the bot heads out through the gap

#### Scenario: A gap it can't turn into
- **WHEN** an escaping bot (on hard) is circled, and a straight line toward a gap is clear, but its turn toward that gap runs into the loop
- **THEN** it does not head for that gap

### Requirement: Coil escape works
Across many repeated coil encounters, hard bots that escape coils SHALL die clearly less often than the same bots without the tactic, both against a coiling bot and against a coiler that circles the way a person might, reacting late to a body cutting across.

#### Scenario: Against a coiling bot
- **WHEN** a mass-120 hard bot is coiled by a mass-3,000 coiling bot in several hundred seeded encounters, with and without coil escape
- **THEN** the trapped bot dies clearly less often with coil escape

#### Scenario: Against a person-like coiler
- **WHEN** the same encounters are run with a coiler that circles the trapped bot and reacts late to a body cutting across
- **THEN** with coil escape the trapped bot dies clearly less often

### Requirement: Shadowing works
In seeded worlds on hard, shadowing bots SHALL kill worms, including ones heavier than their prey limit. Shadowing SHALL NOT make bots die clearly more often than without it.

#### Scenario: Same seed, before and after
- **WHEN** the balance tool runs the same seeds on hard with and without shadowing
- **THEN** kills by shadowing bots appear, and bot deaths per minute stay within about a tenth of without it

### Requirement: Learning the player's habits
The game SHALL keep one record of the player's habits, on every level. Each time a bot moves in to cut the player off, the record SHALL note what the player's worm visibly did in the next moment:
- whether it turned toward the cutter's side, turned away from it, or kept straight;
- whether it boosted.

Older encounters SHALL count for less than recent ones, so the record follows a change of style within a few encounters. A hard bot cutting the player off SHALL use the record:
- aim toward the side the player usually turns to;
- lead farther ahead when the player usually boosts.

The effect SHALL grow with the number of encounters and be capped, so even a perfectly consistent habit only shifts the aim part of the way. With no record, the bot SHALL cut off the player exactly as without learning. The record SHALL NOT make any bot choose the player as prey more often. Bots on easy and normal SHALL play exactly as without the record.

#### Scenario: Escaping the same way every time
- **WHEN** the player has turned away from the cutter in most of their recent cut-offs, and a hard bot moves in to cut them off
- **THEN** the bot aims further toward the side away from it than a hard bot with no record would

#### Scenario: Boosting out of trouble
- **WHEN** the player has boosted in most of their recent cut-offs, and a hard bot moves in to cut them off
- **THEN** the bot aims further ahead of the player than a hard bot with no record would

#### Scenario: A new style
- **WHEN** the player, after many escapes away from the cutter, escapes toward it in about ten cut-offs in a row
- **THEN** the record shows the player now mostly turns toward the cutter

#### Scenario: Little evidence
- **WHEN** the record holds only one or two encounters
- **THEN** a hard bot's aim moves only a little from where it would be with no record

#### Scenario: No record
- **WHEN** the record is empty
- **THEN** a hard bot cuts the player off exactly as it would without the learning tactic

#### Scenario: Prey choice unchanged
- **WHEN** a hard bot picks prey with and without a record of the player's habits
- **THEN** it picks the same worm

#### Scenario: Other levels unchanged
- **WHEN** the same seeded world runs on easy or normal with and without a record of the player's habits
- **THEN** the worlds are identical
