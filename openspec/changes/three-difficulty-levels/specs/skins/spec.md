# Spec Delta

## MODIFIED Requirements

### Requirement: Locked skins in the picker
The skin picker SHALL show every unlockable skin, after the free ones: unlocked ones as normal swatches, locked ones dimmed with a padlock. Picking a locked skin SHALL NOT select it, and SHALL show which achievement unlocks it.

#### Scenario: Tapping a locked skin
- **WHEN** the player taps the locked Cosmic swatch
- **THEN** the skin doesn't change, and the menu says "Reach 10,000 on Hard to unlock Cosmic"

#### Scenario: After unlocking
- **WHEN** the player has earned Big Noodle and opens the menu
- **THEN** Rainbow shows as a normal swatch and can be picked
