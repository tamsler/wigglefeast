// Coil escape (#94): the measuring scene from tools/coil.js is sound, and circled bots notice the
// coil, slip out or hug the loop. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { encounter } = require('../tools/coil.js');
require('../engine.js');
const { Game, DIFFICULTY, TACTICS, CFG, botThink, knowsTactic } = globalThis.WormEngine;
const { clone, scene, withTactics, ONLY } = require('./helpers/engine.js');

test('a coil encounter replays exactly from its seed (#94)', () => {
  for (const coiler of ['bot', 'scripted']) {
    const a = encounter({ seed: 7, coiler }), b = encounter({ seed: 7, coiler });
    assert.deepEqual({ ...a, modes: [...a.modes] }, { ...b, modes: [...b.modes] }, coiler);
  }
});

test('both coilers close a loop around the prey, as a live coil does (#94)', () => {
  for (const coiler of ['bot', 'scripted']) {
    let closed = 0;
    for (let i = 0; i < 10; i++) if (encounter({ seed: 100 + i, coiler }).loop >= 6) closed++;
    assert.ok(closed >= 7, `${coiler}: the loop closed in ${closed} of 10`);
  }
});

test('bots that escape coils die clearly less often in a fixed batch of live coils (#94)', () => {
  // 60 seeded coils per arm; the full measurement (300+ per arm) is `node tools/coil.js`.
  for (const [coiler, most] of [['scripted', 0.6], ['bot', 0.8]]) {
    const deaths = (arm) => {
      let n = 0;
      for (let i = 0; i < 60; i++) if (encounter({ seed: 500 + i, coiler, arm }).outcome === 'prey') n++;
      return n;
    };
    const before = deaths('baseline'), after = deaths('escape');
    assert.ok(after <= before * most, `${coiler} coiler: the trapped bot died ${after} times with the tactic, ${before} without`);
  }
});

// --- Coil escape in the engine (#94) ---------------------------------------------

test('escape is appended, on every hard bot; every bot keeps its other tactics (#94, #177)', () => {
  assert.equal(TACTICS[11], 'escape');
  for (const level of ['easy', 'normal']) assert.equal(DIFFICULTY[level].tactics.escape, 0, level);
  assert.equal(DIFFICULTY.hard.tactics.escape, 1);
  // Each bot's first eleven tactics, as bits, for ids 1-40, recorded before escape was added
  // (hard: what Expert knew, everything).
  const before = {
    normal: [537, 521, 3, 516, 8, 1, 7, 17, 512, 0, 526, 5, 17, 19, 6, 19, 517, 1, 5, 2, 16, 5, 7, 27, 16, 0, 21, 17, 22, 8, 518, 18, 3, 5, 515, 512, 514, 530, 0, 19],
    hard: Array(40).fill(2047),
  };
  for (const [level, masks] of Object.entries(before)) {
    const now = masks.map((_, i) => TACTICS.slice(0, 11).reduce((m, k, j) => m | (knowsTactic({ id: i + 1 }, level, k) ? 1 << j : 0), 0));
    assert.deepEqual(now, masks, level);
  }
});

// Coil escape (#94).
const { coilScene, withArm, sectors } = require('../tools/coil.js');
// A hand-laid coil: a mass-120 prey bot at (px, py) heading +x, its body bunched at its head, and a
// mass-3,000 coiler whose head sits on a circle of radius R round the origin at angle `at`, circling
// counter-clockwise (turnRate to match), its body the arc behind its head, `span` radians long.
// outer: radius of a full ring of another big worm's body (not turning), or 0. Call inside withTactics.
function laidCoil(level, { R = 150, at = -Math.PI / 2, span = 2 * Math.PI, outer = 0, px = 0, py = 0, extra = [] } = {}) {
  const worms = [
    { name: 'Prey', mass: 120, x: px, y: py, angle: 0, ai: {} },
    { name: 'Coiler', mass: 3000, x: R * Math.cos(at), y: R * Math.sin(at), angle: at + Math.PI / 2, turnRate: CFG.BASE_SPEED / R },
    ...(outer ? [{ name: 'Outer', mass: 3000, x: outer, y: 0, angle: Math.PI / 2 }] : []),
    ...extra,
  ];
  const s = scene(level, Object.assign(worms, { food: extra.food || [] }));
  const [p, c] = s.worms;
  for (let i = 0; i < p.sx.length; i++) { p.sx[i] = px; p.sy[i] = py; }
  const arc = (w, rad, from, len) => {
    const sp = w.r * 0.42, n = Math.ceil((len * rad) / sp);
    w.sx = []; w.sy = [];
    for (let i = 0; i <= n; i++) { const th = from - (i * sp) / rad; w.sx.push(rad * Math.cos(th)); w.sy.push(rad * Math.sin(th)); }
    w.updateBounds();
  };
  arc(c, R, at, span);
  if (outer) arc(s.worms[2], outer, 0, 2 * Math.PI);
  p.updateBounds();
  s.game.rebuildSegGrid();
  return { ...s, p, c };
}
const ESCAPE = ONLY('escape');

test('a bot notices a live coil closing round it (#94)', () => {
  let circled = 0;
  for (let i = 0; i < 10; i++) {
    withArm('escape', 'hard', () => {
      const { p, c, tick } = coilScene({ seed: 200 + i, coiler: 'scripted' });
      for (let k = 0; k < 3 * 60 && !p.dead && !c.dead; k++) {
        tick();
        if (!p.dead && p.ai.circledBy === c && p.ai.mode === 'escape') { circled++; break; }
      }
    });
  }
  assert.ok(circled >= 8, `circled in ${circled} of 10 live coils`);
});

test('a bot does not count itself circled by a worm passing by, circling elsewhere, or a loose loop (#94)', () => {
  const think = (worms, fix) => withTactics('hard', ESCAPE, () => {
    const s = scene('hard', [{ name: 'Prey', mass: 120, x: 0, y: 0, angle: 0, ai: {} }, ...worms]);
    if (fix) fix(s);
    botThink(s.worms[0], s.game);
    return s.worms[0].ai;
  });
  const passing = think([{ name: 'Big', mass: 3000, x: 0, y: 150, angle: 0 }]);
  assert.ok(!passing.circledBy, 'straight past');
  const elsewhere = think([{ name: 'Big', mass: 3000, x: 800, y: 0, angle: Math.PI / 2, turnRate: 1.5 }]);
  assert.ok(!elsewhere.circledBy, 'circling a point far away');
  const loose = withTactics('hard', ESCAPE, () => {
    const s = laidCoil('hard', { span: Math.PI / 2 });
    botThink(s.p, s.game);
    return s.p.ai;
  });
  assert.ok(!loose.circledBy, 'a quarter loop leaves most ways open');
  assert.notEqual(loose.mode, 'escape');
  const closed = withTactics('hard', ESCAPE, () => {
    const s = laidCoil('hard');
    botThink(s.p, s.game);
    return s;
  });
  assert.equal(closed.p.ai.circledBy, closed.c, 'a closed loop does');
  // Nothing about it is saved, and the world saves and loads as before.
  closed.game.settings.botCount = 5; // a scene counts only its own bots
  for (const w of closed.game.worms) if (!w.ai) w.isPlayer = w === closed.c; // a save holds bots and one player
  closed.game.worms = closed.game.worms.filter((w) => w.ai || w.isPlayer);
  const snap = clone(closed.game);
  assert.deepEqual(Object.keys(snap.worms[0].ai).sort(), ['aggro', 'huntUntil', 'interval', 'prey', 'skill', 'wx', 'wy']);
  assert.doesNotThrow(() => new Game(null, snap));
});

test('coil escape decides only from what is visible, and draws no random numbers (#94)', () => {
  const run = (setCoiler, shares = ESCAPE) => withTactics('hard', shares, () => {
    const s = laidCoil('hard');
    setCoiler(s.c, s.p);
    let calls = 0;
    s.game.rng = () => { calls++; return 0.5; };
    botThink(s.p, s.game);
    return { a: s.p.targetAngle, move: s.p.ai.escape, mode: s.p.ai.mode, calls };
  });
  const asCoiler = run((c, p) => { c.ai = { skill: 1, aggro: 1, interval: 0.1, wx: 0, wy: 0, prey: p, huntUntil: 1e9, mode: 'coil', coilDir: 1 }; });
  const asWanderer = run((c) => { c.ai = { skill: 1, aggro: 0, interval: 0.1, wx: 0, wy: 0, prey: null, huntUntil: 0, mode: 'wander' }; });
  const asPlayer = run((c) => { c.isPlayer = true; });
  assert.equal(asCoiler.mode, 'escape');
  assert.deepEqual(asWanderer, asCoiler, 'a bot doing something else');
  assert.deepEqual(asPlayer, asCoiler, 'the player');
  assert.equal(run(() => {}, ONLY(null)).calls, asCoiler.calls, 'the same random draws as without the tactic');
});

test('a circled bot takes a way out it can turn into (#94)', () => {
  // A loop of radius 100 open ahead of the coiler's head, from -120° round to +45°: straight ahead
  // (+x) is the way out.
  const open = { R: 100, at: (-2 * Math.PI) / 3, span: (195 / 180) * Math.PI };
  const out = withTactics('hard', ESCAPE, () => { const s = laidCoil('hard', open); botThink(s.p, s.game); return s.p; });
  assert.equal(out.ai.escape, 'out');
  assert.ok(Math.abs(out.targetAngle) < 0.5, `heads out through the gap (${out.targetAngle.toFixed(2)})`);
  assert.ok(Math.hypot(out.ai.aim.x, out.ai.aim.y) > 100 + 34 + out.r, 'its path ends outside the loop');
  // With a second ring beyond the gap there's no way out: it hugs the loop instead.
  const held = withTactics('hard', ESCAPE, () => { const s = laidCoil('hard', { ...open, outer: 320 }); botThink(s.p, s.game); return s.p; });
  assert.equal(held.ai.escape, 'hug', 'blocked beyond: no way out');
});

test('a circled bot does not go for a gap it cannot turn into (#94)', () => {
  // A closed loop of radius 150 but for a gap of ±28° straight below the prey, which sits 40 below
  // the middle heading +x. A straight line down through the gap is clear; every turn down into it
  // swings into the loop's edge.
  const gap = (28 / 180) * Math.PI;
  const s = withTactics('hard', ESCAPE, () => {
    const s = laidCoil('hard', { R: 150, at: -Math.PI / 2 - gap, span: 2 * Math.PI - 2 * gap, py: -40 });
    botThink(s.p, s.game);
    return s;
  });
  let ray = Infinity; // how close the straight line down passes the loop, beyond the probe's reach
  for (let i = 0; i < s.c.sx.length; i++) if (s.c.sy[i] < -40) ray = Math.min(ray, Math.abs(s.c.sx[i]));
  assert.ok(ray > s.p.r + 10 + s.c.r, `the straight line down is clear (${ray.toFixed(0)})`);
  assert.equal(s.p.ai.mode, 'escape');
  assert.notEqual(s.p.ai.escape, 'out');
});

test('with no way out, a circled bot hugs the loop its coiler\'s way round and survives (#94)', () => {
  withTactics('hard', ESCAPE, () => {
    const s = laidCoil('hard');
    s.c.update = () => {}; // the loop holds still
    botThink(s.p, s.game);
    s.p.thinkT = 0; // a bot in a coil has been thinking all along
    assert.equal(s.p.ai.escape, 'hug');
    let turned = 0, dist = 0, n = 0, prev = Math.atan2(s.p.sy[0], s.p.sx[0]);
    for (let i = 0; i < 180 && !s.p.dead; i++) {
      s.game.update(1 / 60);
      const a = Math.atan2(s.p.sy[0], s.p.sx[0]);
      if (i > 30) { turned += angleDiffTest(prev, a); dist += Math.hypot(s.p.sx[0], s.p.sy[0]); n++; }
      prev = a;
    }
    assert.equal(s.p.dead, false, 'alive after 3 s');
    assert.ok(turned > Math.PI, `goes round counter-clockwise, like the coiler (${turned.toFixed(1)} rad)`);
    const edge = 150 - s.c.r - dist / n; // from its head to the body's inside edge
    assert.ok(edge < dist / n, `nearer the loop's body (${edge.toFixed(0)}) than its middle (${(dist / n).toFixed(0)})`);
  });
});
const angleDiffTest = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

test('a circled bot boosts only along a boosting path that leads cleanly out, with or without Hard sharpness (#94)', () => {
  // Without sharpness: every setting at its off value (what the old Hard level was here, #177).
  const NO_SHARP = { think: 1, look: 1, dense: 0, headings: 1, sense: 1, heads: 8, escape: 0, reach: 0 };
  for (const [label, sharp] of [['sharp', {}], ['plain', NO_SHARP]]) {
    const level = 'hard', saved = { ...DIFFICULTY.hard.sharp };
    Object.assign(DIFFICULTY.hard.sharp, sharp);
    try {
    // A big pellet ahead and a boost roll that always passes: it would boost, if it weren't circled.
    const think = (opts, shares) => withTactics(level, shares, () => {
      const s = laidCoil(level, { ...opts, extra: Object.assign([], { food: [{ x: 60, y: 0, v: 20 }] }) });
      s.game.rng = () => 0;
      botThink(s.p, s.game);
      return s.p;
    });
    const gap = { R: 100, at: (-2 * Math.PI) / 3, span: (195 / 180) * Math.PI };
    assert.equal(think(gap, ONLY(null)).wantBoost, true, `${label}: boosts for the pellet through the gap without the tactic`);
    const tight = think({}, ESCAPE);
    assert.equal(tight.ai.mode, 'escape');
    assert.equal(tight.wantBoost, false, `${label}: not inside a closed loop`);
    const open = think(gap, ESCAPE);
    assert.equal(open.ai.escape, 'out');
    assert.equal(open.wantBoost, true, `${label}: straight out through the gap at speed`);
    } finally { Object.assign(DIFFICULTY.hard.sharp, saved); }
  }
});
