# Spec Delta

## MODIFIED Requirements

### Requirement: Expert sharpness
Every bot on expert SHALL have Expert sharpness, a property of the difficulty rather than of the bot, so it needs nothing saved and applies to bots loaded from any save. Compared with a bot of the same skill on another level, a sharp bot SHALL:
- re-plan its heading more often;
- look farther ahead along each candidate heading, checking it closely enough that a body crossing anywhere along that distance is noticed;
- before boosting, check the path the boost would actually take toward its chosen heading (turning toward it no faster than it can while boosting, which is wider than at normal speed, then going straight), as far as a boost carries it, and not boost if a body lies on that path;
- consider more candidate headings;
- notice threatening heads from farther away and keep track of more of them at once;
- when one or more heads are lining up to cut it off, steer for the heading that best clears all of them, rather than turning away from the nearest one alone.

Sharp bots SHALL follow the *Fair information* rule like any other bot. Bots on easy, normal and hard SHALL behave exactly as before this requirement.

#### Scenario: Faster reactions
- **WHEN** two bots of equal skill, one in a hard world and one in an expert world, play for the same time
- **THEN** the expert bot re-plans its heading more times

#### Scenario: A thin body far ahead
- **WHEN** a thin worm's body crosses an expert bot's path between two points where a bot of the same skill on hard would check its heading
- **THEN** the expert bot treats that heading as blocked

#### Scenario: Turning wider while boosting
- **WHEN** an expert bot wants to boost and a body lies where its wider boosting turn toward the best heading would carry it, but not on its normal-speed turn
- **THEN** it still turns toward that heading, but does not boost

#### Scenario: Two cutters at once
- **WHEN** two heads close in on an expert bot from different sides, each lining up to cut it off, and turning away from the nearer one alone would run into the other's path
- **THEN** the bot steers for a heading that clears both paths

#### Scenario: Loaded world
- **WHEN** an expert world saved before this change is loaded
- **THEN** it loads, and its bots play with Expert sharpness

#### Scenario: Other levels unchanged
- **WHEN** the balance tool runs the same seed on easy, normal and hard with and without expert's sharpness settings changed
- **THEN** the reports are identical apart from time per tick

### Requirement: Tactics by difficulty
Each bot SHALL know a set of tactics fixed for its lifetime and drawn from its difficulty. Easy bots SHALL use no tactics. On normal, some bots SHALL use turn prediction, head anticipation, evasion, scavenging, head-on awareness and reading other worms. On hard, at least half the bots SHALL use each of those, and some SHALL also coil, pin against the edge and trap; half SHALL escape coils. On expert, every bot SHALL use every tactic, including flanking, escaping coils and learning the player's habits. Learning the player's habits SHALL be used on expert only. Adding a tactic SHALL NOT change which of the earlier tactics any bot knows.

#### Scenario: Easy has no tactics
- **WHEN** a world is created on easy
- **THEN** no bot predicts turns, anticipates heads, evades, scavenges, seeks head-on contact, reads other worms, coils, pins, traps, flanks or escapes coils

#### Scenario: A bot keeps its tactics
- **WHEN** a world with a bot is saved and loaded again
- **THEN** that bot knows the same tactics as before

#### Scenario: Coil escape by level
- **WHEN** worlds are created on each level
- **THEN** no bot escapes coils on easy or normal, about half the bots do on hard, and every bot does on expert

#### Scenario: Earlier tactics kept
- **WHEN** a bot with a given id is created before and after coil escape was added
- **THEN** it knows the same earlier tactics in both cases

#### Scenario: Easy and normal unchanged
- **WHEN** the same seeded world runs on easy or normal before and after coil escape was added
- **THEN** the worlds are identical

## ADDED Requirements

### Requirement: Noticing a coil
A bot that escapes coils SHALL count itself circled when its own head is closed in by bodies in most directions and a clearly bigger worm nearby (at least half again its mass) is turning steadily on a circle centred near the bot's head. It SHALL decide this only from what a player could see: positions, sizes and observed turning, never which tactic the other worm uses.

#### Scenario: Circled by a bigger worm
- **WHEN** an escaping bot's head is closed in by a loop of a worm three times its mass, and that worm's head is circling around it
- **THEN** the bot counts itself circled

#### Scenario: A big worm passes by
- **WHEN** a much bigger worm passes an escaping bot in a straight line, or circles a point far from the bot
- **THEN** the bot does not count itself circled

#### Scenario: Open space around
- **WHEN** a bigger worm circles near an escaping bot whose head still has open space in most directions
- **THEN** the bot does not count itself circled

#### Scenario: Only what's visible
- **WHEN** the same loop around an escaping bot is made by a coiling bot, by a bot doing something else, or by the player
- **THEN** the bot decides the same way in each case

### Requirement: Hugging the loop
While circled, and with no way out available, a bot that escapes coils SHALL follow the inside edge of the coiler's loop, turning the same way round as the coiler, with its head kept just clear of the coiler's body, rather than staying in the middle of the loop. Its headings SHALL be checked against bodies as usual.

#### Scenario: Waiting inside the loop
- **WHEN** an escaping bot is circled and no path it can take leads out of the loop
- **THEN** it moves round the loop in the coiler's direction, nearer the coiler's body than the loop's middle, without touching it

### Requirement: Slipping out of a coil
A circled bot that escapes coils SHALL take a path out of the loop when a path it can actually take (turning toward a heading no faster than it can, then going straight) leads clear of the coiler's loop with no body in the way, whatever its level.

#### Scenario: A gap opens
- **WHEN** an escaping bot is circled and part of the loop is still open, with a path it can take through it clear of bodies
- **THEN** the bot heads out through the gap

#### Scenario: A gap it can't turn into
- **WHEN** an escaping bot (on hard or expert) is circled, and a straight line toward a gap is clear, but its turn toward that gap runs into the loop
- **THEN** it does not head for that gap

### Requirement: No boosting inside a coil
A circled bot that escapes coils SHALL NOT boost unless its boosting path, at boost speed and its wider boosting turn, leads clear of the loop with no body in the way, whatever its level.

#### Scenario: Tight loop
- **WHEN** an escaping bot is circled and its boosting path would meet the loop
- **THEN** it does not boost

#### Scenario: Straight out at speed
- **WHEN** an escaping bot is circled and its boosting path leads cleanly out through a gap
- **THEN** it may boost out

### Requirement: Coil escape works
Across many repeated coil encounters, expert bots that escape coils SHALL die clearly less often than the same bots without the tactic, both against a coiling bot and against a coiler that circles the way a person might, reacting late to a body cutting across.

#### Scenario: Against a coiling bot
- **WHEN** a mass-120 expert bot is coiled by a mass-3,000 coiling bot in several hundred seeded encounters, with and without coil escape
- **THEN** the trapped bot dies clearly less often with coil escape

#### Scenario: Against a person-like coiler
- **WHEN** the same encounters are run with a coiler that circles the trapped bot and reacts late to a body cutting across
- **THEN** with coil escape the trapped bot dies clearly less often
