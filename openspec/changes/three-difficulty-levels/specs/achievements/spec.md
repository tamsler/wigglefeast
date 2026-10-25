# Spec Delta

## MODIFIED Requirements

### Requirement: Growth achievements
The game SHALL have these achievements for size, each earned when the player's worm reaches the given score (peak mass) in a run: Snack Time (1,000), Big Noodle (5,000), Titan (25,000), Hard Mode (5,000 on Hard difficulty) and Hard Survivor (10,000 on Hard difficulty). Hard Survivor was called Expert Survivor before there were three levels; earning it under either name counts.

#### Scenario: Reaching 5,000
- **WHEN** the player's worm reaches a score of 5,000 for the first time, on any difficulty
- **THEN** Snack Time and Big Noodle are earned (Snack Time if not already)

#### Scenario: Difficulty goals
- **WHEN** the player reaches 5,000 on Normal
- **THEN** Hard Mode is not earned, because it needs Hard

#### Scenario: Earned as Expert Survivor
- **WHEN** a player who earned Expert Survivor before this change opens the game
- **THEN** Hard Survivor shows as earned, and Cosmic stays unlocked

### Requirement: Skin rewards
Earning Big Noodle SHALL unlock Rainbow, First Bite Lavender, Hungry Hunter Dragon, Marathon Thunder, Titan Royal and Hard Survivor Cosmic.

#### Scenario: Unlocking Dragon
- **WHEN** the player earns Hungry Hunter
- **THEN** Dragon can be picked in the skin picker from then on
