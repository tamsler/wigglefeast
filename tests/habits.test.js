// Tests for learning the player's habits (#135). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../engine.js');
const { Game, DIFFICULTY, TACTICS, CFG, botThink, knowsTactic, freshHabits, validHabits, recordHabit, habitBias, habitBoost, angleDiff } = globalThis.WormEngine;
const { scene, sideOf, withTactics, hunt, ONLY, pickPrey } = require('./helpers/engine.js');
const habits = (o) => Object.assign(freshHabits(), o);
const sides = (h) => h.away + h.toward + h.straight;

test('a habits record starts empty, rejects anything invalid, and fades one encounter at a time (#135)', () => {
  const h = freshHabits();
  assert.deepEqual(h, { v: 1, away: 0, toward: 0, straight: 0, boost: 0, still: 0 });
  assert.equal(validHabits(h), true);
  for (const bad of [null, [], 'x', 1, { ...h, v: 2 }, { ...h, v: undefined }, { ...h, away: -1 }, { ...h, toward: NaN },
    { ...h, boost: Infinity }, { ...h, still: 2e6 }, { ...h, straight: '3' }, { v: 1, away: 0, toward: 0, straight: 0, boost: 0 }]) {
    assert.equal(validHabits(bad), false, JSON.stringify(bad));
  }
  const r = habits({ away: 2, toward: 1, straight: 0.5, boost: 1, still: 3 });
  recordHabit(r, 'away', true);
  const d = CFG.HABIT_DECAY;
  assert.equal(d, 0.92);
  assert.deepEqual(r, { v: 1, away: 2 * d + 1, toward: d, straight: 0.5 * d, boost: d + 1, still: 3 * d });
  recordHabit(r, 'straight', false);
  assert.equal(r.straight, (0.5 * d) * d + 1);
  assert.equal(r.still, 3 * d * d + 1);
});

// The player heads +x from the origin; a bot alongside, ahead on the player's +1 side (+y),
// is cutting it off and doesn't re-plan during the test.
function cutOff(record = freshHabits(), bot = { x: 150, y: 120, angle: 0 }) {
  const s = scene('hard', [{ name: 'You', mass: 15, x: 0, y: 0, angle: 0 }, { name: 'Cutter', mass: 100, ai: { huntUntil: 1e9 }, ...bot }]);
  const [p, b] = s.worms;
  p.isPlayer = true;
  s.game.player = p;
  s.game.habits = record;
  Object.assign(b.ai, { prey: p, mode: 'cut' });
  b.thinkT = 1e9;
  const run = (secs, each = () => {}) => { for (let i = 0; i < Math.round(secs * 60); i++) { each(i); s.game.update(1 / 60); } };
  return { game: s.game, p, b, run };
}

test('a cut-off records whether the player turned away, toward the cutter or kept straight, and boosted (#135)', () => {
  const outcome = (turn, boost = false) => {
    const { game, p, run } = cutOff();
    run(0.8, () => { p.targetAngle = turn; p.wantBoost = boost; });
    assert.ok(!p.dead, 'the player survives');
    return game.habits;
  };
  assert.deepEqual(outcome(-0.5), habits({ away: 1, still: 1 }), 'turning to -1, away from a cutter on +1');
  assert.deepEqual(outcome(0.5), habits({ toward: 1, still: 1 }));
  assert.deepEqual(outcome(0), habits({ straight: 1, still: 1 }));
  assert.deepEqual(outcome(0.05), habits({ straight: 1, still: 1 }), 'a slight drift is keeping straight');
  assert.deepEqual(outcome(-0.5, true), habits({ away: 1, boost: 1 }));
  // A cutter behind the player, or too far ahead, doesn't count.
  for (const bot of [{ x: -150, y: 120, angle: 0 }, { x: 400, y: 120, angle: 0 }]) {
    const { game, run } = cutOff(freshHabits(), bot);
    run(0.8);
    assert.deepEqual(game.habits, freshHabits(), JSON.stringify(bot));
  }
  // Only a bot hunting the player and moving in counts.
  for (const ai of [{ mode: 'food' }, { mode: 'coil' }, { prey: null }]) {
    const { game, b, run } = cutOff();
    Object.assign(b.ai, ai);
    run(0.8);
    assert.deepEqual(game.habits, freshHabits(), JSON.stringify(ai));
  }
});

test('one cut-off is watched at a time, and a new one starts at least a second after the last (#135)', () => {
  const { game, run } = cutOff();
  run(0.3);
  assert.ok(game.encounter, 'watching');
  const start = game.encounter.start;
  run(0.62);
  assert.equal(game.encounter, null);
  assert.equal(sides(game.habits), 1, 'one recorded');
  run(1.0 - (game.time - start) - 0.05); // the cutter is still alongside, but it's too soon
  assert.equal(game.encounter, null);
  run(0.1);
  assert.ok(game.encounter && game.encounter.start - start >= CFG.HABIT_GAP - 1e-9, 'the next one starts after a second');
  run(0.7);
  assert.equal(game.habits.straight, CFG.HABIT_DECAY + 1, 'two recorded');
});

test('habits come from movement only: steering the other way too late to turn counts as straight (#135)', () => {
  const { game, p, run } = cutOff();
  let steered = false, left = 0;
  run(0.8, () => {
    if (steered && !left) left = Math.abs(angleDiff(p.angle, p.targetAngle)); // when the window closed
    const e = game.encounter;
    // On the last tick of the window, steer hard away: the worm can't turn far in one tick.
    if (e && game.time + 1 / 60 - e.start >= CFG.HABIT_WINDOW - 1e-9) { p.targetAngle = p.angle - 2; steered = true; }
  });
  assert.ok(steered && left > 1.5, `the player was steering away, ${left.toFixed(2)} rad still to turn`);
  assert.deepEqual(game.habits, habits({ straight: 1, still: 1 }));
});

test('nothing is recorded while the player is shielded, or when they or the cutter die mid-way (#135)', () => {
  const cases = {
    shielded: (s) => { s.p.shield = 5; },
    'shielded mid-way': (s, i) => { if (i === 10) s.p.shield = 1; },
    'player dies': (s, i) => { if (i === 10) s.game.kill(s.p, null); },
    'cutter dies': (s, i) => { if (i === 10) s.game.kill(s.b, null); },
  };
  for (const [name, fn] of Object.entries(cases)) {
    const s = cutOff();
    s.run(0.8, (i) => fn(s, i));
    assert.deepEqual(s.game.habits, freshHabits(), name);
    assert.equal(s.game.encounter, null, name);
  }
});

test('the record leaves easy, normal and hard worlds exactly as they were (#135)', () => {
  const world = (diff, record, seed) => {
    const g = new Game({ botCount: 30, difficulty: diff }, null, { seed, habits: record });
    g.spawnPlayer('P', 0);
    for (let i = 0; i < 20 * 60; i++) {
      if (!g.player && i % 120 === 0) g.spawnPlayer('P', 0);
      if (g.player) { g.player.targetAngle = g.player.angle + Math.sin(i / 40) * 0.8; g.player.wantBoost = i % 200 < 30; }
      g.update(1 / 60);
    }
    const s = g.toJSON();
    delete s.savedAt;
    return JSON.stringify(s);
  };
  const strong = () => habits({ away: 12, boost: 12 });
  // Seeds until one has a cut-off on the player, so the comparison covers recording (#141 and #143
  // changed which seeds do); every seed tried must give identical worlds.
  for (const diff of ['easy', 'normal']) {
    let recorded = false;
    for (const seed of [99, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const rec = strong();
      assert.equal(world(diff, rec, seed), world(diff, freshHabits(), seed), `${diff}, seed ${seed}`);
      if ((recorded = JSON.stringify(rec) !== JSON.stringify(strong()))) break;
    }
    assert.ok(recorded, `${diff}: a run recorded cut-offs`);
  }
});

test('learn is appended and hard-only; every bot keeps its other tactics (#135, #177)', () => {
  assert.equal(TACTICS[10], 'learn');
  for (const level of ['easy', 'normal']) assert.equal(DIFFICULTY[level].tactics.learn, 0, level);
  assert.equal(DIFFICULTY.hard.tactics.learn, 1);
  for (let id = 1; id <= 200; id++) {
    assert.equal(knowsTactic({ id }, 'hard', 'learn'), true);
    assert.equal(knowsTactic({ id }, 'normal', 'learn'), false);
  }
  // Each bot's first ten tactics, as bits, for ids 1-40, recorded before learn was added
  // (hard: what Expert knew, everything).
  const before = {
    normal: [537, 521, 3, 516, 8, 1, 7, 17, 512, 0, 526, 5, 17, 19, 6, 19, 517, 1, 5, 2, 16, 5, 7, 27, 16, 0, 21, 17, 22, 8, 518, 18, 3, 5, 515, 512, 514, 530, 0, 19],
    hard: Array(40).fill(1023),
  };
  for (const [level, masks] of Object.entries(before)) {
    const now = masks.map((_, i) => TACTICS.slice(0, 10).reduce((m, k, j) => m | (knowsTactic({ id: i + 1 }, level, k) ? 1 << j : 0), 0));
    assert.deepEqual(now, masks, level);
  }
});

// A hard hunter at the origin cutting off the player, who heads +y 300 px to its right. The
// hunter is on the player's +1 side, so the player turning away goes to -1 (+x).
function learnHunt(record, shares = ONLY('learn'), prey = {}) {
  return withTactics('hard', shares, () => {
    const s = hunt('hard', { mass: 400, x: 0, y: 0, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2, ...prey });
    const [h, p] = s.worms;
    p.isPlayer = true;
    s.game.player = p;
    s.game.habits = record;
    botThink(h, s.game);
    return { h, p, aim: h.ai.aim, mode: h.ai.mode };
  });
}

test('a hard bot aims at the side the player usually escapes to, a little at first (#135)', () => {
  const none = learnHunt(freshHabits()), without = learnHunt(habits({ away: 12 }), ONLY('none'));
  assert.equal(none.mode, 'cut');
  assert.deepEqual(none.aim, without.aim, 'no record: exactly the cut of a bot without learn');
  const away = learnHunt(habits({ away: 12 }));
  assert.equal(away.mode, 'learn');
  assert.ok(sideOf(away.p, away.aim.x, away.aim.y) < sideOf(none.p, none.aim.x, none.aim.y) - 2 * away.p.r, 'aims further to the away side');
  const toward = learnHunt(habits({ toward: 12 }));
  assert.ok(sideOf(toward.p, toward.aim.x, toward.aim.y) > sideOf(none.p, none.aim.x, none.aim.y) + 2 * toward.p.r, 'or toward the hunter');
  // Even a perfect habit shifts the aim at most HABIT_MAX of a full sideways shift.
  const perfect = learnHunt(habits({ away: 1e6 }));
  const full = 4 * perfect.p.r;
  assert.ok(Math.abs(Math.hypot(perfect.aim.x - none.aim.x, perfect.aim.y - none.aim.y) - CFG.HABIT_MAX * full) < 1e-6, 'capped');
  // Little evidence: after one or two escapes, under a third of the cap.
  const rec = freshHabits();
  for (let n = 1; n <= 2; n++) {
    recordHabit(rec, 'away', false);
    const a = learnHunt(habits(rec)).aim;
    const moved = Math.hypot(a.x - none.aim.x, a.y - none.aim.y);
    assert.ok(moved > 0 && moved < (CFG.HABIT_MAX * full) / 3, `${n} encounter(s): moved ${moved.toFixed(1)}`);
  }
  // Only the player's habits: the same record means nothing against another worm.
  const bot = withTactics('hard', ONLY('learn'), () => {
    const s = hunt('hard', { mass: 400, x: 0, y: 0, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2 });
    s.game.habits = habits({ away: 12 });
    botThink(s.worms[0], s.game);
    return s.worms[0].ai;
  });
  assert.equal(bot.mode, 'cut');
  assert.deepEqual(bot.aim, none.aim);
});

test('pin and flank come before a learned habit, which comes before trap (#135)', () => {
  // Along the wall, pin wins.
  const pin = withTactics('hard', { ...ONLY('learn'), pin: 1 }, () => {
    const s = hunt('hard', { mass: 400, x: 1500, y: -150, angle: Math.PI / 2 }, { mass: 100, x: 1850, y: 0, angle: Math.PI / 2 });
    s.worms[1].isPlayer = true; s.game.player = s.worms[1]; s.game.habits = habits({ away: 12 });
    botThink(s.worms[0], s.game);
    return s.worms[0].ai.mode;
  });
  assert.equal(pin, 'pin');
  // With another hunter on the player's +1 side, flank wins.
  const flank = withTactics('hard', { ...ONLY('learn'), flank: 1 }, () => {
    const s = hunt('hard', { mass: 400, x: 500, y: -200, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2 },
      [{ name: 'First', mass: 400, x: 150, y: 50, angle: Math.PI / 2, ai: { huntUntil: 1e9 } }]);
    s.worms[2].ai.prey = s.worms[1];
    s.worms[1].isPlayer = true; s.game.player = s.worms[1]; s.game.habits = habits({ toward: 12 });
    botThink(s.worms[0], s.game);
    return s.worms[0].ai.mode;
  });
  assert.equal(flank, 'flank');
  // With trap known too, the habit still decides.
  assert.equal(learnHunt(habits({ away: 12 }), { ...ONLY('learn'), trap: 1 }).mode, 'learn');
});

test('a hard bot leads farther ahead of a player who usually boosts out (#135)', () => {
  for (const shares of [ONLY('learn'), { ...ONLY('learn'), predict: 1 }]) {
    const none = learnHunt(freshHabits(), shares), boosts = learnHunt(habits({ boost: 12 }), shares);
    assert.equal(boosts.mode, 'cut', 'no side habit, no shift');
    assert.ok(Math.abs(boosts.aim.x - none.aim.x) < 1e-6, 'straight ahead of the player either way');
    assert.ok(boosts.aim.y > none.aim.y + 20, `further ahead (${none.aim.y.toFixed(0)} -> ${boosts.aim.y.toFixed(0)})`);
    assert.deepEqual(learnHunt(habits({ still: 12 }), shares).aim, none.aim, 'a player who never boosts: no extra lead');
  }
  const boosting = (rec) => withTactics('hard', ONLY('learn'), () => {
    const s = hunt('hard', { mass: 400, x: 0, y: 0, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2 });
    const p = s.worms[1];
    p.isPlayer = true; s.game.player = p; s.game.habits = rec; p.boosting = true; p.speed = CFG.BASE_SPEED * CFG.BOOST_MULT;
    botThink(s.worms[0], s.game);
    return s.worms[0].ai.aim;
  });
  assert.deepEqual(boosting(habits({ boost: 12 })), boosting(freshHabits()), 'already boosting: no extra lead');
});

test('a new style wins: ten escapes toward the cutter outweigh twenty older ones away (#135)', () => {
  const h = freshHabits();
  for (let i = 0; i < 20; i++) recordHabit(h, 'away', false);
  assert.ok(habitBias(h) > 0.5);
  for (let i = 0; i < 10; i++) recordHabit(h, 'toward', false);
  assert.ok(h.toward > h.away, `toward ${h.toward.toFixed(2)} vs away ${h.away.toFixed(2)}`);
  assert.ok(habitBias(h) < 0);
  assert.ok(habitBoost(h) === 0);
});

test('the record never makes a bot pick the player as prey (#135)', () => {
  // The player near and another worm far, then the other way round; with every hard tactic.
  for (const [near, far] of [[{ name: 'You' }, { name: 'Other' }], [{ name: 'Other' }, { name: 'You' }]]) {
    const picks = [freshHabits(), habits({ away: 12, boost: 12 })].map((rec) =>
      pickPrey({ mass: 100, ...near }, { mass: 100, ...far }, (s) => {
        const p = s.worms.find((w) => w.name === 'You');
        p.isPlayer = true; s.game.player = p; s.game.habits = rec;
      }, [], DIFFICULTY.hard.tactics).prey);
    assert.equal(picks[0], picks[1], `${near.name} near`);
    assert.equal(picks[0], near.name);
  }
});
