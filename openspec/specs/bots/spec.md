# bots Specification

## Purpose
AI-controlled worms that populate the arena, so the game is playable offline without other people.

## Requirements

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

### Requirement: Fair information
Bots SHALL decide using only what a player could see: worms' positions, headings, sizes, how they have been turning, and visible food and power-ups. They SHALL NOT read any worm's steering target or input, and SHALL treat the player like any other worm when choosing prey or a worm to shadow. Bots MAY know which worm another bot is hunting or shadowing, to coordinate. A bot MAY remember what it saw or experienced itself (kills that happened within its view, and worms that tried to cut it off), but SHALL NOT know what happened outside its view. As the one exception, bots MAY share a record of the player's habits, kept between games, built only from the player's visible movement when a bot moved in to cut them off (see *Learning the player's habits*).

#### Scenario: Player's intent stays hidden
- **WHEN** the player moves the pointer to steer the other way, but their worm has not started turning yet
- **THEN** no bot's prediction of the player's path changes

#### Scenario: Unseen kill
- **WHEN** a worm kills another far outside a bot's view
- **THEN** that bot's impression of the killer is unchanged

#### Scenario: Habits come from movement only
- **WHEN** a bot moves in to cut the player off and the player steers the other way, but their worm hasn't turned before the encounter ends
- **THEN** the record counts the encounter as the player keeping straight

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

### Requirement: Noticing a coil
A bot that escapes coils SHALL count itself circled when its own head is closed in by bodies in most directions and a clearly bigger worm nearby (at least half again its mass) is turning steadily on a circle that the bot's head lies inside. It SHALL decide this only from what a player could see: positions, sizes and observed turning, never which tactic the other worm uses.

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
- **WHEN** an escaping bot (on hard) is circled, and a straight line toward a gap is clear, but its turn toward that gap runs into the loop
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
Across many repeated coil encounters, hard bots that escape coils SHALL die clearly less often than the same bots without the tactic, both against a coiling bot and against a coiler that circles the way a person might, reacting late to a body cutting across.

#### Scenario: Against a coiling bot
- **WHEN** a mass-120 hard bot is coiled by a mass-3,000 coiling bot in several hundred seeded encounters, with and without coil escape
- **THEN** the trapped bot dies clearly less often with coil escape

#### Scenario: Against a person-like coiler
- **WHEN** the same encounters are run with a coiler that circles the trapped bot and reacts late to a body cutting across
- **THEN** with coil escape the trapped bot dies clearly less often

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

### Requirement: Shadowing a bigger worm
A bot that shadows SHALL, when it isn't hunting or eating remains, sometimes pick a nearby worm heavier than its level's prey limit but at most four times its own mass, and run alongside that worm's body, a little behind its head and clear of it. It SHALL NOT shadow a worm that two other bots already shadow, SHALL give up after about 15 seconds or when the worm pulls away, and SHALL put getting out of danger first.

#### Scenario: A big worm nearby
- **WHEN** a bot that shadows, with nothing to hunt or eat, has a worm three times its mass nearby
- **THEN** it may start shadowing it, heading for a point beside that worm's body rather than ahead of its head

#### Scenario: Two shadows already
- **WHEN** two other bots already shadow a big worm
- **THEN** a third bot does not start shadowing it

#### Scenario: Too big
- **WHEN** the only bigger worm nearby is more than four times the bot's mass
- **THEN** the bot does not shadow it

#### Scenario: Giving up
- **WHEN** a bot has shadowed a worm for about 15 seconds, or the worm gets far away
- **THEN** it stops shadowing it

#### Scenario: The player as the big worm
- **WHEN** the player is the big worm near a bot that shadows
- **THEN** the bot may shadow the player as it would any other worm

### Requirement: Cutting in from a shadow
A shadowing bot SHALL cut in at its target's head only when the cut-off point is in reach along a path it can actually take, clear of bodies, and it would get there before the target's head. It SHALL NOT go head-on at a bigger worm, and SHALL NOT boost into the cut unless the boosted path is clear.

#### Scenario: A cut opens up
- **WHEN** a shadowing bot is alongside its target near the head, and the point just ahead of the target's head is clear and reachable in time
- **THEN** it cuts in across the target's path

#### Scenario: Not in time
- **WHEN** a shadowing bot could only reach the cut-off point after the target's head has passed it, or its path there is blocked
- **THEN** it keeps shadowing instead of cutting in

### Requirement: Shadowing works
In seeded worlds on hard, shadowing bots SHALL kill worms, including ones heavier than their prey limit. Shadowing SHALL NOT make bots die clearly more often than without it.

#### Scenario: Same seed, before and after
- **WHEN** the balance tool runs the same seeds on hard with and without shadowing
- **THEN** kills by shadowing bots appear, and bot deaths per minute stay within about a tenth of without it

### Requirement: Scavenging
A bot that scavenges SHALL head for the remains of a worm that died nearby, weighted by how much of their food is still there and how far away they are, boosting when the remains are large. Remains SHALL count for as long as their food lies there, and only by the part of it not yet eaten. The bot SHALL skip remains that another worm's head is closer to.

A scavenging bot SHALL put a meal before a fight. When uncontested remains it can reach are worth more than the hunt it would start or is on, it SHALL NOT start that hunt and SHALL drop a hunt or coil it is on, and go for the remains. A hunt is worth what the kill would drop, less the chance of failing and the distance to the prey. Getting out of danger and a winning head-on SHALL still come before a meal. Bots that don't scavenge SHALL hunt as before.

#### Scenario: Big worm dies nearby
- **WHEN** a large worm dies near a scavenging bot that is not evading, and no other head is closer to the remains
- **THEN** the bot heads for the remains

#### Scenario: Remains already contested
- **WHEN** another worm's head is closer to the remains than the scavenging bot
- **THEN** the bot leaves those remains alone

#### Scenario: Hunting next to a big meal
- **WHEN** a scavenging bot is hunting a small worm and uncontested remains worth much more than that worm lie closer than the prey
- **THEN** the bot drops the hunt and heads for the remains

#### Scenario: Coiling next to a big meal
- **WHEN** a scavenging bot is coiling a small worm and uncontested remains worth much more than that worm lie within reach
- **THEN** the bot stops coiling and heads for the remains

#### Scenario: A meal before a new hunt
- **WHEN** a scavenging bot that is free to pick prey has uncontested remains within reach worth more than any worm it could hunt
- **THEN** it goes for the remains instead of starting a hunt

#### Scenario: A few leftovers
- **WHEN** a scavenging bot is hunting and the only remains within reach are worth less than the kill
- **THEN** it keeps hunting

#### Scenario: Remains outlast the first seconds
- **WHEN** a large worm died 20 seconds ago and most of its food still lies there
- **THEN** a scavenging bot nearby still counts those remains

#### Scenario: Remains eaten up
- **WHEN** other worms have eaten most of a worm's remains
- **THEN** a scavenging bot values those remains only by what is left, and forgets them once almost nothing is left

#### Scenario: Bots that don't scavenge
- **WHEN** a bot without the scavenging tactic is hunting next to a big meal
- **THEN** it keeps hunting, as before

### Requirement: Head-on awareness
Because the bigger worm wins a head-on collision, a bot with head-on awareness SHALL go for the head of a clearly smaller worm that is coming towards it, and SHALL keep treating a bigger worm's head as an obstacle.

#### Scenario: Smaller worm head-on
- **WHEN** a clearly smaller worm's head approaches a head-on-aware bot from the front
- **THEN** the bot steers into it instead of away

### Requirement: Seen kills
A bot that reads other worms SHALL stay wary, for about half a minute, of a worm it saw kill within its view. It SHALL NOT pick that worm as prey unless the worm has at most half its mass, and it SHALL start evading that worm from farther away than an unknown worm.

#### Scenario: Seen killer gets room
- **WHEN** a reading bot saw a worm kill another within its view moments ago, and that worm's head approaches
- **THEN** the bot does not pick it as prey, and starts evading it from farther away than it would an unknown worm

#### Scenario: Much smaller killer
- **WHEN** a reading bot saw a worm with less than half its mass make a kill
- **THEN** it may still hunt that worm

### Requirement: Grudges
A bot that reads other worms SHALL hold a grudge, fading over about 20 seconds, against a worm that tried to cut it off or killed a worm right next to it. If the culprit is within hunting range and light enough to hunt, the bot SHALL retaliate by hunting it in preference to nearer worms, unless two other bots are already retaliating against that worm. Otherwise it SHALL keep away from the culprit by evading it from farther. Impressions SHALL NOT be saved.

#### Scenario: Cut off, then retaliates
- **WHEN** a smaller worm tries to cut off a reading bot, and the bot is next free to pick prey
- **THEN** the bot hunts that worm rather than a nearer worm it holds no grudge against

#### Scenario: Bigger culprit
- **WHEN** a worm too heavy to hunt tries to cut off a reading bot
- **THEN** the bot does not hunt it, and evades it from farther away than an unknown worm

#### Scenario: No gang-ups
- **WHEN** two bots are already retaliating against a worm and a third bot holds a grudge against it
- **THEN** the third bot does not hunt it

#### Scenario: Impressions after loading
- **WHEN** a world is saved and loaded again
- **THEN** bots start with no impressions or grudges and form them again from what they see

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
