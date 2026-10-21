# Worm Attack and Defense Review

Date: 2026-10-20  
Reviewed release: 1.18.0  
Reviewed commit: `31489681b21de48a599907f6095715a9f41a7f19`

## Purpose and Scope

This is an independent-evaluation handoff, not an approved implementation plan.
Evaluate the findings and proposed changes before implementing them. No game
files were changed during the review.

The review covered target selection, interception, coiling, pinning, trapping,
flanking, scavenging, head-on decisions, anticipation, evasion, and movement and
collision constraints. It compared the engine with the bots and gameplay specs,
existing engine tests, and GitHub issues #94 and #110.

Primary sources:

- [Engine](../engine.js)
- [Bots specification](../openspec/specs/bots/spec.md)
- [Gameplay specification](../openspec/specs/gameplay/spec.md)
- [Engine tests](../tests/engine.test.js)
- [Balance tool](../tools/balance.js)
- [Coil-defense issue #94](https://github.com/tamsler/wigglefeast/issues/94)
- [Completed Expert-sharpness issue #110](https://github.com/tamsler/wigglefeast/issues/110)

## Overall Assessment

The attack repertoire is already substantial. Expert now has faster reactions,
longer look-ahead, more candidate headings, dense path checking, and multi-threat
evasion. Do not recommend those as missing features.

Prioritize reliable, physically achievable choices and counterplay before adding
more aggression. Preserve fair information: no reading opponents' steering
targets or inputs, and no player-specific targeting advantage.

## Confirmed Findings

### F1: Expert Can Select a Heading That Never Passed Dense Checking

Severity: P2. Reproduced in an isolated static planning scene.

At [engine.js:891](../engine.js#L891), dense checking inspects at most four
promising candidates. The final selection at
[engine.js:905](../engine.js#L905) considers all candidates, including those that
only passed sparse checks. After four failures, an unchecked candidate can win.

Reproduction setup:

1. Create an Expert scene with a mass-100 bot at `(0, 0)`, heading zero,
   skill 1, aggression 0, and wander goal `(1000, 0)`; remove food and power-ups.
2. Disable tactic shares temporarily, retaining Expert sharpness, to isolate the
   steering planner. Restore shares after the probe.
3. Place a mass-1000 opponent's body on an open circular loop centered on the bot.
   Use radius `(400 + 3 * bot.r) * 0.485`; sample 320 angles around the circle,
   omitting angles within 0.75 radians of `Math.PI / 2` to leave an exit.
4. Rebuild the segment and food grids, then call `botThink(bot, game)`.
5. Measure the minimum distance from each segment to the selected forward ray.

Observed result:

- Selected heading: `0.4591558493708156` radians.
- Selected ray's minimum body clearance: about 1.66 units.
- Actual lethal center-distance threshold: about 34.50 units.
- Clearance toward the open exit at 90 degrees: about 152.37 units.
- The planner's own conservative safety threshold: about 54.23 units.

This proves unsafe path selection, not an observed death in a natural match.
The synthetic loop isolates the checking-budget defect; nearby sampled headings
also lead into the exit.

Recommendation: require the final selected candidate to pass dense validation.
Keep a bounded checking budget, but never treat unvalidated alternatives as
equivalent to validated-safe ones. Define a conservative fallback if none pass.

Acceptance: add a regression with several sparse-clear/dense-blocked candidates
ahead of a genuinely clear candidate. Check the selected path, not merely that
the bot turned away from its original heading.

### F2: Ordinary Hunting Can Bypass the Retaliation Limit

Severity: P2. Reproduced with a deterministic prey-acquisition probe.

At [engine.js:701](../engine.js#L701), the nearest candidate is selected before
the grudge-specific two-retaliator check. Rejecting a third retaliation does not
exclude that same worm from ordinary hunting or trap-based selection.

Reproduction setup:

1. Put an Expert reader of mass 400 at `(0, 0)`, with aggression and skill 1.
2. Put a mass-100 culprit at `(300, 0)`, heading zero. Give the reader a current
   memory entry for that culprit with `kills: 0` and `grudge: 1`.
3. Put two other bots at `(1500, 1000)` and `(1500, -1000)`. Set both bots'
   `ai.prey` and `ai.retaliating` to the culprit.
4. Make prey acquisition deterministic with `game.rng = () => 0`, and call
   `botThink` for the reader.

Observed result: the reader hunts the culprit, its `ai.retaliating` is false,
and three bots now have the culprit as prey.

This contradicts the bots spec's explicit scenario that a third bot holding a
grudge does not hunt a worm already facing two retaliators. It does not imply
that the current spec imposes a global two-hunter limit on every kind of hunt.

Recommendation: filter the ineligible grudge target before every prey-selection
path. Evaluate any broader global hunting cap separately as a balance change.

Acceptance: test the culprit as the nearest candidate, the only candidate, and
the candidate favored by trapping. The current test places a neutral worm nearer
than the culprit, which does not expose this fallback.

## Tactical Weaknesses Requiring Evaluation

### W1: Head-On Awareness Discounts Smaller Crossing Threats Too Broadly

At [engine.js:800](../engine.js#L800), evasion skips every opponent below 85% of
the bot's mass when it knows head-on awareness. Winning head contact does not
make the opponent's body safe to cross.

An isolated Expert scene used a mass-400 bot at `(0, 0)`, heading zero, and a
mass-100 cutter at `(200, 150)`, heading `Math.atan2(-150, 40)`. With head-on
awareness enabled, the bot selected `wander`; with only that awareness disabled,
it selected `evade`. Other settings were unchanged.

Anticipation can still steer the bot away, so this is not proof of a collision
or a measured survival regression. Verify outcomes before assigning bug severity.

Recommendation: distinguish a favorable head meeting from a crossing that leaves
lethal body segments in the bot's future path. Retain head-on aggression without
blanket immunity from threat detection.

### W2: Boosting Conflicts With Tight Coil Geometry

[Coiling](../engine.js#L740) shrinks the target radius while requesting boost
for worms above mass 150. From the actual speed and turn-rate formulas, a
mass-3000 hunter without power-ups has approximately:

| Quantity | Radius in World Units |
| --- | ---: |
| Minimum normal-speed turning radius | 60.9 |
| Minimum boosted turning radius | 150.4 |
| Initial coil target around mass-100 prey | 137.6 |
| Coil target floor around that prey | 102.1 |

For a stationary center, the boosted worm cannot maintain those requested coil
radii. Moving prey and repeated replanning complicate actual outcomes; this does
not establish that coiling is ineffective. The balance sample recorded many coil
kills.

Recommendation: boost during approach or loop establishment, then slow down to
tighten. Account for tight-turn and speed power-ups when deciding feasible radius.
Measure enclosure, overshoot, escape rate, and hunter survival against moving prey.

## Recommended Changes, in Priority Order

### 1. Evaluate Reachable Trajectories Instead of Instant Heading Changes

The [heading evaluator](../engine.js#L861) checks straight rays, but
[movement](../engine.js#L378) limits turning and changes speed and turning while
boosting. A clear ray is not necessarily a clear route to that ray.

Simulate short candidate steering trajectories with the same movement rules.
Compare boost and non-boost options, including current power-ups. Use this for
both defensive steering and [interception](../engine.js#L509), whose travel-time
estimate does not currently simulate the hunter's turn to the intercept.

Use collision risk as a constraint before food or aggression preferences. When no
safe option exists, prefer the longest time to collision and a viable escape
corridor. Bound work and benchmark at 30, 60, and 150 bots.

### 2. Add Active Coil Defense Through Existing Issue #94

Prefer an open gap before attempting a counterattack. If enclosed, attempt a
timed body cut ahead of the coiler's head, not a losing head-on collision.
Detect the closing loop early enough to act, using visible geometry and observed
turning rather than the coiler's private AI mode.

Use paired seeded scenarios against adaptive coilers. Measure escape and survival
against the same scenarios without the tactic; choosing a counterattack aim alone
is insufficient evidence of improvement.

### 3. Make Attack Commitment Explicit

Use lightweight approach, cut, escape, and recovery phases. Reassess a hunt when
the target grows, gains a relevant power-up, changes direction, or escapes the
interception geometry. Avoid both arbitrary target switching and blind pursuit.

For flanking, evaluate complementary interception positions and arrival times.
Choosing the opposite side of the first hunter is a useful baseline, but does
not ensure coordinated timing or safe paths for both hunters.

### 4. Provide Bounded Late-Game Threats

[Expert prey acquisition](../engine.js#L692) excludes worms at or above twice a
hunter's mass. Large players can consequently become ineligible targets for most
bots. This is intentional current behavior, not a spec violation.

Consider occasional opportunity-based attacks against larger worms when a safe
body cut is reachable. Do not simply remove the mass limit or make every bot chase
the leader. Apply the same rule to large bots, limit concurrent pressure, and
preserve escape opportunities. Issue #110 explicitly deferred this direction.

### 5. Add Variety and Readable Counterplay Before More Tactics

Give bots stable tendencies such as cautious scavenger, opportunistic cutter,
and patient coiler, while keeping abilities appropriate to difficulty. Vary
commitment and risk tolerance rather than granting hidden information.

Make attack execution legible through consistent movement and boost timing. Avoid
instantaneous tactical reversals that are technically possible for AI but give
players no practical response window. Any extra visual cue should be subtle and
evaluated separately, including on mobile.

## Architecture Recommendation

Keep the plain-JavaScript, dependency-free engine and disk-open workflow. Do not
introduce a framework or a large behavior-tree system for this work.

Separate three responsibilities within the existing engine first:

- Perception: bounded nearby bodies, heads, resources, and decaying memories.
- Tactical choice: a small explicit state and candidate intentions.
- Trajectory evaluation: reachable movement, time-dependent collision risk,
  intercept feasibility, and boost decisions.

Share pure movement calculations with the simulation to prevent planner drift.
Keep new tactical state transient unless persistence is demonstrably necessary.
Append any new tactic identifiers; existing tactic ordering affects bot identity.

## Verification Already Performed

All 28 selected engine tests passed:

```sh
node --test --test-name-pattern='tactic|predict|anticipat|evad|head-on|hunt|coil|pin|trap|flank|scaveng|readers|sharp|expert|Expert' tests/engine.test.js
```

A bounded, reproducible balance sample was run:

```sh
node tools/balance.js --minutes 2 --runs 3 --bots 30 --diff hard,expert --profile careful --seed 100
```

| Metric | Hard | Expert |
| --- | ---: | ---: |
| Proxy lives / deaths | 6 / 3 | 7 / 4 |
| Reported median life | 100 s | 49 s |
| Average active hunters targeting proxy | 0.09 | 0.30 |
| Bot deaths per simulated minute | 76.17 | 89.00 |
| Engine milliseconds per tick on review machine | 0.32 | 0.36 |

These are small samples, not human difficulty estimates. The proxy has no tactics,
and the reported lifetime distribution includes unfinished lives. Death attribution
uses the killer's current mode, not a complete causal history. Do not infer precise
tactic effectiveness or statistically established balance from this table.

No full browser suite or human playtest was run for this focused review. The
temporary Node probes changed only process-local state, not repository files.

## Independent Evaluator Checklist

- Reproduce F1 and F2 before accepting the proposed severity or fixes.
- Distinguish current-spec bugs from optional balance changes.
- Test combined tactics as well as isolated ones, especially head-on awareness
  with anticipation/evasion and coiling with boost.
- Test real outcomes against adaptive opponents and use paired seeds for
  comparisons. Include larger prey, simultaneous cutters, wall pins, power-ups,
  and failed attacks that must recover safely.
- Measure performance at maximum population before increasing planning work.
- Preserve v1 saves, deterministic seeded runs, and fair information.
- Follow the repository workflow for implementation: issues and PRs, approved
  OpenSpec plans for features, regression tests for bugs, release-version bumps
  for shipped changes, and the required full test run and independent PR review.

Suggested sequence: fix F1 and F2; evaluate W1; introduce reachable trajectory
planning and speed-aware coiling; implement #94; then evaluate late-game threats
and personality variety with playtesting.