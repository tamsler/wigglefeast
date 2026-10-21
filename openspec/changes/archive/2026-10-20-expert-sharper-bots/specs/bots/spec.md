# Spec Delta

## MODIFIED Requirements

### Requirement: Bot population
The world SHALL keep the configured number of bots (5–150). When a bot dies, a replacement spawns 1–3 seconds later at a spot away from other worms, at mass 15–40, with a name not currently in use.

#### Scenario: Bot dies
- **WHEN** a bot dies in a world configured for 30 bots
- **THEN** within about 3 seconds there are 30 bots again

#### Scenario: Initial world
- **WHEN** a new world is created
- **THEN** most bots start small (mass 15–200) and a few start large: about 10% (up to mass 1200) on easy, 15% (up to 2000) on normal, 20% (up to 2500) on hard and 35% (up to 5000) on expert

#### Scenario: Largest world
- **WHEN** the player sets 150 bots and presses Play
- **THEN** a world with 150 bots starts, and it is saved and restored like any other world

### Requirement: Difficulty
Each bot SHALL get a skill and aggression value drawn from the selected difficulty (easy, normal, hard, expert). Higher skill means faster re-planning, more candidate headings and farther look-ahead. The intended feel:
- **Easy**: a calm arena for learning. Few large worms, bots that steer clumsily, rarely hunt, and only go after worms smaller than themselves. A new player should survive for minutes.
- **Normal**: bots eat efficiently and hunt now and then; a careless player gets cut off.
- **Hard**: bots react fast, see far and hunt often, including worms somewhat bigger than themselves. Still beatable by a player who watches for cut-offs.
- **Expert**: bots play like experienced players: they read turns, coil, pin against the wall, trap and flank, and get out of danger. On top of the highest skills, they are sharper than any Hard bot: they react faster, see danger sooner and escape cut-offs better. More of them start large. For players who find Hard easy.

#### Scenario: Hard difficulty
- **WHEN** a world is created on hard
- **THEN** bots look farther ahead, react faster and hunt more than on easy

#### Scenario: Expert difficulty
- **WHEN** a world is created on expert
- **THEN** bots are at least as skilled and aggressive as on hard, every bot uses every tactic, and every bot has Expert sharpness

#### Scenario: Expert start
- **WHEN** a world is created on expert
- **THEN** about a third of its bots start large, some of them well above the largest starting bot on hard

## ADDED Requirements

### Requirement: Expert sharpness
Every bot on expert SHALL have Expert sharpness, a property of the difficulty rather than of the bot, so it needs nothing saved and applies to bots loaded from any save. Compared with a bot of the same skill on another level, a sharp bot SHALL:
- re-plan its heading more often;
- look farther ahead along each candidate heading, checking it closely enough that a body crossing anywhere along that distance is noticed;
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

#### Scenario: Two cutters at once
- **WHEN** two heads close in on an expert bot from different sides, each lining up to cut it off, and turning away from the nearer one alone would run into the other's path
- **THEN** the bot steers for a heading that clears both paths

#### Scenario: Loaded world
- **WHEN** an expert world saved before this change is loaded
- **THEN** it loads, and its bots play with Expert sharpness

#### Scenario: Other levels unchanged
- **WHEN** the balance tool runs the same seed on easy, normal and hard before and after this change
- **THEN** the reports are identical apart from time per tick
