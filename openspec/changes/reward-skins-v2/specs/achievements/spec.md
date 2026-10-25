# Spec Delta

## MODIFIED Requirements

### Requirement: Past play counts
When achievements first appear, and whenever a profile is loaded or imported, every achievement that the saved stats prove (best scores overall and by difficulty, totals, and the saved top and recent runs) SHALL be earned at once, without a pop-up. Stargazer and Top of the Board, which older stats can't prove, SHALL count from then on.

#### Scenario: Existing player
- **WHEN** a player whose saved best score is 6,000 with 120 total kills opens the new version
- **THEN** Snack Time, Big Noodle, First Bite and Apex are already earned, Holo and Ghost are unlocked, and no pop-ups appear

### Requirement: Achievement progress on the stats screen
The stats screen SHALL list every achievement with its name, goal and progress (for example 3,200 / 5,000), earned ones marked as earned with the date, and the skin each unlocks, if any.

#### Scenario: Viewing progress
- **WHEN** a player with a best score of 3,200 opens the stats screen
- **THEN** Big Noodle shows 3,200 / 5,000 and that it unlocks Holo

### Requirement: Skin rewards
Earning Big Noodle SHALL unlock Holo, First Bite Ghost, Hungry Hunter Inferno, Marathon Storm, Titan Crystal and Hard Survivor Galaxy Prime.

#### Scenario: Unlocking Dragon
- **WHEN** the player earns Hungry Hunter
- **THEN** Inferno can be picked in the skin picker from then on
