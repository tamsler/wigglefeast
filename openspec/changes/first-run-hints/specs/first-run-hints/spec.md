# Spec Delta

## Purpose

Teaches a new player the basics during their first runs with a few short hints, shown one at a time over the running game, so the core rules are explained without a tutorial screen.

## ADDED Requirements

### Requirement: Hints on the first runs
During a run the game SHALL show a new player four hints, one at a time and in this order: steer, boost, danger, power-ups. A hint SHALL NOT start until the one before it has ended. A hint the player has already seen SHALL be skipped, and a player who has seen all four SHALL see none.

#### Scenario: A brand new player
- **WHEN** a player with no games played starts a run
- **THEN** the steer hint shows first, and the boost, danger and power-up hints follow one at a time as each ends

#### Scenario: Skipping what was seen
- **WHEN** a player who has seen the steer and boost hints starts a run
- **THEN** the first hint shown is the danger hint

#### Scenario: Seen them all
- **WHEN** a player who has seen all four hints starts a run
- **THEN** no hint appears

### Requirement: When a hint ends
The steer hint SHALL end when the player's worm has turned by about a quarter turn in total, the boost hint when it has boosted for about half a second, and the power-up hint when the player collects a power-up. The danger and power-up hints SHALL also end after 6 seconds on screen. Every hint SHALL stay on screen for at least 2.5 seconds, so it can be read, and SHALL count as seen when it ends.

#### Scenario: Steering right away
- **WHEN** the player turns within a second of the steer hint appearing
- **THEN** the hint stays until it has been on screen for 2.5 seconds and then ends

#### Scenario: Never boosting
- **WHEN** the player never boosts
- **THEN** the boost hint stays on screen until they do, and the danger and power-up hints wait

#### Scenario: Reading the danger hint
- **WHEN** the danger hint has been on screen for 6 seconds
- **THEN** it ends and counts as seen

### Requirement: Hints only while playing
Hints SHALL appear and count time only while a run is in progress and not paused. Pausing SHALL hide the hint and stop its timers, and resuming SHALL bring it back where it was. A hint SHALL NOT appear in the menu, on the death screen or while another window is active.

#### Scenario: Pausing
- **WHEN** the player pauses with a hint on screen and resumes 20 seconds later
- **THEN** the hint comes back with the time it had left, and has not ended meanwhile

### Requirement: Where hints sit
A hint SHALL be a small rounded pill at the bottom centre of the screen, above the touch buttons on touch screens, and SHALL NOT overlap any other HUD element at desktop sizes and phone sizes down to 360×640 and 640×360. It SHALL take no clicks or taps and no key presses, so steering and boosting work exactly as without it, and it SHALL be announced politely to screen readers. It SHALL fade in and out, with no movement when the system asks for reduced motion.

#### Scenario: Phone
- **WHEN** a hint shows on a 360×640 or 640×360 touch screen
- **THEN** it does not overlap the score, the boost button, the pause button, the leaderboard or the minimap, and a drag that starts under it still steers

#### Scenario: Under the worm's head
- **WHEN** a hint is on screen
- **THEN** it is outside the area around the player's head, which stays in the middle of the screen

### Requirement: No room, no hint
A window with a mouse that is shorter than about 420 pixels has no room for a hint beside the leaderboard, so it SHALL show no hints, and none SHALL count as seen there. Touch screens, whose leaderboard is shorter, SHALL always show them.

#### Scenario: A very short window
- **WHEN** a new player runs the game in a mouse window 360 pixels tall
- **THEN** no hint appears, even if they steer and boost, and all four are still to be shown in a taller window

### Requirement: Hint wording
The hints SHALL read: steer, "Move the mouse to steer" (touch: "Drag to steer"); boost, "Hold click or Space to boost: it costs a little size" (touch: "Hold the boost button to boost: it costs a little size"); danger, "Don't hit other worms with your head. Make them hit yours."; power-ups, "Grab the glowing power-ups for a boost." The touch wording SHALL show on touch screens, like the controls line in the menu.

#### Scenario: Touch wording
- **WHEN** a new player starts a run on a touch screen
- **THEN** the first hint reads "Drag to steer"

### Requirement: Show tips again
The stats screen SHALL have a "Show tips again" button that forgets which hints were seen, so the next run shows all four again.

#### Scenario: Showing tips again
- **WHEN** a player who has seen every hint presses "Show tips again" and starts a run
- **THEN** the steer hint shows again
