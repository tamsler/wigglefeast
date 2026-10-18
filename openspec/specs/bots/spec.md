# bots Specification

## Purpose
AI-controlled worms that populate the arena, so the game is playable offline without other people.

## Requirements

### Requirement: Bot population
The world SHALL keep the configured number of bots (5–60). When a bot dies, a replacement spawns 1–3 seconds later at a spot away from other worms, at mass 15–40, with a name not currently in use.

#### Scenario: Bot dies
- **WHEN** a bot dies in a world configured for 30 bots
- **THEN** within about 3 seconds there are 30 bots again

#### Scenario: Initial world
- **WHEN** a new world is created
- **THEN** most bots start small (mass 15–200) and a few start large: about 10% (up to mass 1200) on easy, 15% (up to 2000) on normal, 20% (up to 2500) on hard and 25% (up to 3000) on expert

### Requirement: Bot behaviour
Each bot SHALL re-plan its heading several times per second, choosing among candidate headings by its goal (nearby food weighted by value and distance, power-ups, a hunted worm, fresh remains, or a wander point) and rejecting headings that lead into other worms' bodies, the path a nearby head is about to cover (for bots that anticipate), or the arena edge.

#### Scenario: Obstacle ahead
- **WHEN** another worm's body lies across a bot's path
- **THEN** the bot turns toward a heading that is clear, if one exists

#### Scenario: Hunting
- **WHEN** an aggressive bot is near a worm lighter than its difficulty's prey limit (1× its own mass on easy, 1.3× on normal, 1.6× on hard, 2× on expert)
- **THEN** it may steer ahead of that worm's head to cut it off, boosting when close

### Requirement: Difficulty
Each bot SHALL get a skill and aggression value drawn from the selected difficulty (easy, normal, hard, expert). Higher skill means faster re-planning, more candidate headings and farther look-ahead. The intended feel:
- **Easy**: a calm arena for learning. Few large worms, bots that steer clumsily, rarely hunt, and only go after worms smaller than themselves. A new player should survive for minutes.
- **Normal**: bots eat efficiently and hunt now and then; a careless player gets cut off.
- **Hard**: bots react fast, see far and hunt often, including worms somewhat bigger than themselves. Still beatable by a player who watches for cut-offs.
- **Expert**: bots play like experienced players: they read turns, coil, pin against the wall, trap and flank, and get out of danger. For players who find Hard easy.

#### Scenario: Hard difficulty
- **WHEN** a world is created on hard
- **THEN** bots look farther ahead, react faster and hunt more than on easy

#### Scenario: Expert difficulty
- **WHEN** a world is created on expert
- **THEN** bots are at least as skilled and aggressive as on hard, and every bot uses every tactic

### Requirement: Tactics by difficulty
Each bot SHALL know a set of tactics fixed for its lifetime and drawn from its difficulty. Easy bots SHALL use no tactics. On normal, some bots SHALL use turn prediction, head anticipation, evasion, scavenging and head-on awareness. On hard, most bots SHALL use those, and some SHALL also coil, pin against the edge and trap. On expert, every bot SHALL use every tactic, including flanking.

#### Scenario: Easy has no tactics
- **WHEN** a world is created on easy
- **THEN** no bot predicts turns, anticipates heads, evades, scavenges, seeks head-on contact, coils, pins, traps or flanks

#### Scenario: A bot keeps its tactics
- **WHEN** a world with a bot is saved and loaded again
- **THEN** that bot knows the same tactics as before

### Requirement: Fair information
Bots SHALL decide using only what a player could see: worms' positions, headings, sizes, how they have been turning, and visible food and power-ups. They SHALL NOT read any worm's steering target or input, and SHALL treat the player like any other worm when choosing prey. Bots MAY know which worm another bot is hunting, to coordinate.

#### Scenario: Player's intent stays hidden
- **WHEN** the player moves the pointer to steer the other way, but their worm has not started turning yet
- **THEN** no bot's prediction of the player's path changes

### Requirement: Turn-aware interception
A bot that predicts turns SHALL aim its cut-off at where its prey will be if the prey keeps turning at its recently observed rate, not at the prey's straight-line path.

#### Scenario: Prey circling
- **WHEN** a predicting bot hunts a worm that has been turning steadily left
- **THEN** the bot aims at a point on the prey's curving path to the left, not straight ahead of the prey's head

### Requirement: Head anticipation
A bot that anticipates SHALL treat the short path a nearby head is about to cover as an obstacle, as long as it would reach that path after the head does.

#### Scenario: Head about to cross
- **WHEN** another worm's head is about to cross the anticipating bot's straight-ahead path, with no body there yet
- **THEN** the bot picks a heading that avoids the crossing

### Requirement: Evasion
A bot that evades SHALL notice a nearby head lining up to cut it off and turn toward open space away from it, boosting if it can afford to.

#### Scenario: Being cut off
- **WHEN** another worm's head is closing in and aiming ahead of an evading bot
- **THEN** the bot stops chasing food and turns away from the threat's path

### Requirement: Coiling
A bot that coils SHALL, when its body is long enough to circle a nearby prey that is much smaller, circle the prey's head and tighten the circle, relying on its own body as the trap.

#### Scenario: Big bot meets small worm
- **WHEN** a coiling bot whose body is long enough to circle a small worm is close to that worm
- **THEN** it circles the small worm's head at a shrinking radius until the worm dies, escapes past the circle, or the hunt times out

### Requirement: Edge pinning
A bot that pins SHALL, when its prey runs roughly along the arena edge, shadow the prey on the inside and cut in between the prey and open space, ahead of the prey.

#### Scenario: Prey along the wall
- **WHEN** a pinning bot hunts a worm moving along the arena edge
- **THEN** the bot approaches from the arena side and cuts in ahead of it, leaving the wall as the prey's only way forward

### Requirement: Trapping
A bot that traps SHALL prefer prey with few clear escape directions, and among cut-off points SHALL prefer the one where other worms' bodies or the edge block the prey's way out.

#### Scenario: Prey between two bodies
- **WHEN** a trapping bot can choose between two equally close worms, one in open space and one with bodies on both sides
- **THEN** it hunts the one with bodies on both sides

### Requirement: Flanking
A bot that flanks SHALL, when another bot already hunts the same prey, cut in from the side opposite that bot.

#### Scenario: Second hunter
- **WHEN** a flanking bot starts hunting a worm that another bot is cutting off from the left
- **THEN** the flanking bot aims at the prey's right side

### Requirement: Scavenging
A bot that scavenges SHALL head for the remains of a worm that died nearby within the last few seconds, weighted by how much was dropped and how far away it is, boosting when the remains are large. It SHALL skip remains that another worm's head is closer to.

#### Scenario: Big worm dies nearby
- **WHEN** a large worm dies near a scavenging bot that is not hunting or evading, and no other head is closer to the remains
- **THEN** the bot heads for the remains

#### Scenario: Remains already contested
- **WHEN** another worm's head is closer to the remains than the scavenging bot
- **THEN** the bot leaves those remains alone

### Requirement: Head-on awareness
Because the bigger worm wins a head-on collision, a bot with head-on awareness SHALL go for the head of a clearly smaller worm that is coming towards it, and SHALL keep treating a bigger worm's head as an obstacle.

#### Scenario: Smaller worm head-on
- **WHEN** a clearly smaller worm's head approaches a head-on-aware bot from the front
- **THEN** the bot steers into it instead of away
