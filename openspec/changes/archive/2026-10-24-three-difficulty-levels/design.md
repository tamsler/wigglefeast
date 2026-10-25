# Design

## Context

- `engine.js` defines `DIFFICULTY` with four entries (`easy`, `normal`, `hard`, `expert`) and `DIFFICULTIES = Object.keys(DIFFICULTY)`. Each entry holds skill and aggression ranges, the prey ratio, the share and size of large starting bots, and per-tactic shares; `expert` also has `sharp` (#110). `knowsTactic` hashes a bot's id with a tactic's index against the level's share, so tactic sets need nothing saved. Learning the player's habits (#135) is the `learn` tactic, which only `expert` has; the learning cue (#138) follows `knowsTactic(..., 'learn')`.
- Difficulty is saved in three places: settings (`wormarena.settings.difficulty`), world snapshots (`settings.difficulty`, checked by `validateSnapshot`), and the profile (each run's `diff`, plus `totals.bestByDiff`). Exports carry the profile and the world.
- `main.js` validates settings and profile runs against `DIFFICULTIES`; the achievements `hard` and `expert` (#14) read `bestByDiff.hard` / `.expert`.

## Goals / Non-Goals

**Goals:**
- Hard behaves exactly like today's Expert: same seeded world, same bots, same results.
- Every saved form of the old names keeps loading, with one mapping rule in one place.
- Older versions of the game can still read what the new version writes.

**Non-Goals:**
- Rebalancing Easy or Normal; keeping the old Hard reachable.

## Decisions

### 1. Rename, keyed `hard`, with an alias for `expert`
`DIFFICULTY` becomes `{ easy, normal, hard }`, where `hard` is today's `expert` entry unchanged (including `sharp` and every tactic at share 1). The old `hard` entry is deleted. A single helper, exported from the engine:

```js
const LEGACY_DIFFICULTY = { expert: 'hard' };
const difficultyOf = (name) => (has(DIFFICULTY, name) ? name : LEGACY_DIFFICULTY[name] || null);
```

- Alternative: keep the `expert` key and only relabel the button "Hard". Fewer code edits, but the key and the label would disagree forever, and the old `hard` key would still have to be remapped (it would mean Normal-plus in old saves but "Hard" on screen). Renaming keeps the code honest.
- Why `hard` for both old names: a player who picked Hard asked for a challenge; the new Hard is the closest level. Their worlds load with tougher bots, which the proposal accepts.
- Older versions reading new data: they know `hard` (as the old Hard), so new saves still load there, just with the old Hard's bots.

### 2. Where the mapping is applied
- **Settings**: `loadSettings` stores `difficultyOf(s.difficulty)` when it isn't null.
- **Worlds**: `validateSnapshot` accepts any name `difficultyOf` knows; `Game` normalizes `settings.difficulty` with it on create and load, so everything downstream only ever sees `easy` / `normal` / `hard`. Saved worlds are rewritten with the new name at the next autosave.
- **Profile** (`cleanProfile`): each run's `diff` goes through `difficultyOf` (runs with unknown names are dropped as today); `bestByDiff.hard = max(old hard, old expert)`, and the cleaned profile has only the three keys.
- **Exports/imports**: covered by the profile and world rules above.

### 3. Achievements keep their ids
The achievement ids `hard` and `expert` stay as they are, so earned ones stay earned and Cosmic stays unlocked. `hard` (Hard Mode) reads `bestOn('hard')` vs 5,000 as before; `expert` is renamed **Hard Survivor**, "Reach 10,000 on Hard", reading `bestOn('hard')` vs 10,000. The Cosmic hint follows from the goal text.

- Trade-off: old Hard bests now count toward Hard goals, which were set with the tougher bots in mind. A player with an old-Hard 5,000+ gets Hard Mode (they already had it), and an old-Hard 10,000+ now earns Hard Survivor. Acceptable: few runs, and they were the most demanding level a player could pick at the time.

### 4. UI
Three difficulty buttons (`data-v="easy" | "normal" | "hard"`); the best-by-difficulty tiles follow `DIFFICULTIES`, so they become three on their own. Comments and names in code that say "expert" for the top level say "hard" (e.g. "Hard sharpness"), apart from the alias.

### 5. Tests
Tests that create `expert` worlds switch to `hard`; tests that pinned the old Hard's numbers (half the bots escape coils, some shadow, 20% large starters, prey ratio 1.6) are removed or folded into the Hard expectations. New tests cover the alias in every saved form. Worlds created as `expert` and as `hard` from the same seed must be identical, which proves Hard plays exactly like the old Expert.

## Risks / Trade-offs

- **[Big test churn]** → Many bot tests name `expert`; a mechanical rename plus removing old-Hard-only checks. Run the full suite and `node tools/balance.js` on hard before/after (hard after = expert before) to confirm identical reports.
- **[Players used to the old Hard]** → Their next run is tougher. Accepted by the owner; Normal is one click away.
- **[Normal → Hard gap]** → Bigger than before. Out of scope here; can be tuned later if players find Hard too big a step.

## Migration Plan

No data migration: names are mapped on load and rewritten at the next save. Minor version bump. Rollback: older versions read `hard` as the old Hard and can't name `expert` any more, which only matters for worlds saved after this change (they load as the old Hard).
