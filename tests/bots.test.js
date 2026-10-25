// Bot tests: tactics, reading other worms, sharpness, meals and reachable paths. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../engine.js');
const { Game, Worm, SKINS, DIFFICULTY, DIFFICULTIES, TACTICS, CFG, radiusFor, botThink, knowsTactic, predictHead, reachPath, reachAt, validateSnapshot, angleDiff } = globalThis.WormEngine;
const { clone, withFood, scene, sideOf, withTactics, hunt, ONLY, memo, pickPrey } = require('./helpers/engine.js');

// --- Bot tactics (#78) --------------------------------------------------------

test('every level has a full tactic table: none on easy, all on hard (#78, #177)', () => {
  assert.deepEqual(DIFFICULTIES, ['easy', 'normal', 'hard']);
  for (const level of DIFFICULTIES) assert.deepEqual(Object.keys(DIFFICULTY[level].tactics).sort(), TACTICS.slice().sort(), level);
  assert.ok(TACTICS.every((k) => DIFFICULTY.easy.tactics[k] === 0), 'easy knows nothing');
  assert.ok(TACTICS.every((k) => DIFFICULTY.hard.tactics[k] === 1), 'hard knows everything');
  assert.equal(DIFFICULTY.normal.tactics.coil + DIFFICULTY.normal.tactics.flank, 0, 'normal bots never coil or flank');
  const masses = [];
  for (let i = 0; i < 6; i++) masses.push(...new Game({ botCount: 60, difficulty: 'hard' }).worms.map((w) => w.mass));
  const big = masses.filter((m) => m >= 400).length / masses.length;
  assert.ok(Math.abs(big - DIFFICULTY.hard.bigShare) < 0.08, `${(big * 100).toFixed(0)}% of hard bots start big`);
  assert.ok(Math.max(...masses) <= DIFFICULTY.hard.bigMax);
});

test('a bot keeps its tactics for life, and levels hand them out in their shares (#78)', () => {
  const g = new Game({ botCount: 40, difficulty: 'normal' });
  const known = (w) => TACTICS.filter((k) => knowsTactic(w, 'normal', k)).join();
  const before = new Map(g.worms.map((w) => [w.id, known(w)]));
  const g2 = new Game(null, clone(g));
  for (const w of g2.worms) assert.equal(known(w), before.get(w.id), `bot ${w.name} kept its tactics`);
  // Over 600 ids, the share knowing each tactic is near the table value.
  for (const k of TACTICS) {
    const share = DIFFICULTY.normal.tactics[k];
    let n = 0;
    for (let id = 1; id <= 600; id++) if (knowsTactic({ id }, 'normal', k)) n++;
    assert.ok(Math.abs(n / 600 - share) < 0.07, `normal ${k}: ${(n / 6).toFixed(0)}% know it, table says ${share * 100}%`);
  }
  assert.equal(knowsTactic({ id: 7 }, 'easy', 'evade'), false);
  assert.equal(knowsTactic({ id: 7 }, 'hard', 'flank'), true);
});

test('worms track how they turn, and predictions follow the turning, not the steering target (#78)', () => {
  const g = { addFood() {} };
  const w = new Worm({ name: 'Turner', skin: SKINS[0], mass: 100, x: 0, y: 0, angle: 0, worldR: 5000 });
  for (let i = 0; i < 40; i++) { w.targetAngle = w.angle + 0.5; w.update(1 / 60, g); }
  assert.ok(w.turnRate > 1, `steady turn toward +angle is observed (${w.turnRate.toFixed(2)} rad/s)`);
  const p = predictHead(w, 0.5);
  assert.ok(p.a > w.angle + 0.5, 'the predicted heading keeps turning');
  const side = Math.cos(w.angle) * (p.y - w.y) - Math.sin(w.angle) * (p.x - w.x);
  assert.ok(side > 0, 'the predicted head lies on the side it turns toward');
  // Steering the other way changes nothing until the worm actually turns (Fair information).
  w.targetAngle = w.angle - 2;
  assert.deepEqual(predictHead(w, 0.5), p);
  // A worm going straight is predicted straight ahead at its speed.
  const s = new Worm({ name: 'Straight', skin: SKINS[0], mass: 100, x: 0, y: 0, angle: 0, worldR: 5000 });
  const q = predictHead(s, 1);
  assert.ok(Math.abs(q.x - s.speed) < 1e-9 && Math.abs(q.y) < 1e-9);
});

test('the game remembers remains while their food lasts, without saving them (#78, #122)', () => {
  const g = new Game({ botCount: 5, difficulty: 'hard' });
  const victim = g.worms[0];
  g.kill(victim, null);
  const t0 = g.time;
  const mine = () => g.recentDeaths.filter((d) => d.time === t0);
  assert.equal(mine().length, 5, 'five points along the body');
  assert.ok(Math.abs(mine().reduce((a, d) => a + d.mass, 0) - Math.max(10, victim.mass * 0.8)) < 1e-6, 'they share what was dropped');
  const snap = clone(g);
  assert.ok(!('recentDeaths' in snap));
  assert.doesNotThrow(() => validateSnapshot(snap));
});

test('remains count while their food lies there, by what is left of it (#122)', () => {
  // A lone big worm dies; nothing else is around to eat its remains.
  const { game, worms: [big] } = scene('hard', [{ name: 'Big', mass: 2000, x: 0, y: 0, angle: 0 }], 30);
  game.kill(big, null);
  const dropped = Math.max(10, 2000 * 0.8);
  const total = () => game.recentDeaths.reduce((a, d) => a + d.value, 0);
  const run = (secs) => { for (let i = 0; i < secs * 60; i++) game.update(1 / 60); };
  run(20);
  // Remains outlast the first seconds: 20 s on, all five points still count, worth about what was
  // dropped (neighbouring points may share a pellet at their edges).
  assert.equal(game.recentDeaths.length, 5, 'still remembered after 20 s');
  assert.ok(total() > 0.9 * dropped && total() < 1.5 * dropped, `worth what was dropped: ${total().toFixed(0)} of ${dropped}`);
  // Remains eaten up: others eat most of the food; the remains are worth only what is left...
  const pellets = game.food.filter((f) => !f.natural && !f.dead);
  pellets.slice(0, Math.floor(pellets.length * 0.8)).forEach((f) => { f.dead = true; });
  run(0.5);
  assert.ok(total() < 0.5 * dropped, `worth what is left: ${total().toFixed(0)} of ${dropped}`);
  // ...and are forgotten once almost nothing is left.
  game.food.forEach((f) => { if (!f.natural) f.dead = true; });
  run(0.5);
  assert.equal(game.recentDeaths.length, 0, 'forgotten once eaten up');
});

test('anticipating bots avoid the path a head is about to cross; others do not see it (#78)', () => {
  // The bot heads for food along +x. Another head is about to cross that line at x=150,
  // half a second before the bot gets there; no body lies on the line yet.
  const run = (level) => {
    const { game, worms: [bot] } = scene(level, withFood([
      { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Crosser', mass: 100, x: 150, y: -120, angle: Math.PI / 2 },
    ], [{ x: 400, y: 0 }]));
    botThink(bot, game);
    return bot;
  };
  const sees = withTactics('hard', { evade: 0 }, () => run('hard'));
  assert.equal(sees.ai.mode, 'food');
  assert.ok(Math.abs(sees.targetAngle) > 0.2, `anticipating bot turns off the line (${sees.targetAngle.toFixed(2)})`);
  const blind = run('easy');
  assert.ok(Math.abs(blind.targetAngle) < 0.05, `bot without the tactic keeps going for the food (${blind.targetAngle.toFixed(2)})`);
});

test('evading bots turn away from a head lining up to cut them off (#78)', () => {
  const { game, worms: [bot, threat] } = scene('hard', withFood([
    { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
    { name: 'Cutter', mass: 100, x: 200, y: 150, angle: Math.atan2(-150, 40) },
  ], [{ x: 400, y: 0 }]));
  botThink(bot, game);
  assert.equal(bot.ai.mode, 'evade');
  const now = sideOf(threat, 0, 0);
  const next = sideOf(threat, Math.cos(bot.targetAngle) * 100, Math.sin(bot.targetAngle) * 100);
  assert.ok(Math.sign(next) === Math.sign(now) && Math.abs(next) > Math.abs(now) + 30, `moves away from the cutter's line (${now.toFixed(0)} -> ${next.toFixed(0)})`);
  // Without the tactic the bot keeps chasing the food.
  const { game: g2, worms: [plain] } = scene('easy', withFood([
    { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
    { name: 'Cutter', mass: 100, x: 200, y: 150, angle: Math.atan2(-150, 40) },
  ], [{ x: 400, y: 0 }]));
  botThink(plain, g2);
  assert.equal(plain.ai.mode, 'food');
});

test('head-on aware bots meet smaller heads and keep away from bigger ones (#78)', () => {
  const meet = (otherMass) => scene('hard', [
    { name: 'Bot', mass: 400, x: 0, y: 0, angle: 0, ai: {} },
    { name: 'Other', mass: otherMass, x: 180, y: 10, angle: Math.PI },
  ]);
  const small = meet(100);
  botThink(small.worms[0], small.game);
  assert.equal(small.worms[0].ai.mode, 'headOn');
  assert.ok(Math.abs(small.worms[0].targetAngle - Math.atan2(10, 180)) < 0.3, 'steers into the smaller head');
  // Run it: the smaller worm dies on contact, the bot lives.
  let killer = null;
  small.game.on('death', (e) => { if (e.victim === small.worms[1]) killer = e.killer; });
  for (let i = 0; i < 90 && !killer; i++) small.game.update(1 / 60);
  assert.equal(killer, small.worms[0]);
  assert.equal(small.worms[0].dead, false);

  const big = meet(1000);
  botThink(big.worms[0], big.game);
  assert.notEqual(big.worms[0].ai.mode, 'headOn');
  assert.ok(Math.abs(big.worms[0].targetAngle) > 0.3, `turns away from the bigger head (${big.worms[0].targetAngle.toFixed(2)})`);
});

test('predicting hunters aim where a turning prey is going, not straight ahead of it (#78)', () => {
  // The prey heads +y and has been turning toward -x (its +1 side), toward the hunter.
  const aimAngle = (level) => withTactics('hard', ONLY('predict'), () => {
    const { game, worms: [h] } = hunt(level, { mass: 400, x: 0, y: 0, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2, turnRate: 1.5 });
    botThink(h, game);
    assert.equal(h.ai.mode, 'cut');
    return { angle: Math.atan2(h.ai.aim.y, h.ai.aim.x), aim: h.ai.aim };
  });
  const predicted = aimAngle('hard'), straight = aimAngle('easy');
  assert.ok(Math.abs(straight.aim.x - 300) < 1e-6, 'without prediction: straight ahead of the prey');
  assert.ok(predicted.aim.x < 300 - 40, `with prediction: on the prey's curve (x ${predicted.aim.x.toFixed(0)})`);
  assert.ok(predicted.angle > straight.angle + 0.15, 'so the hunter aims further round');
});

test('trapping hunters prefer the prey boxed in by other bodies (#78)', () => {
  // Two prey 300 px from the hunter: one in open space (listed first), one between two
  // long bodies too big to hunt.
  const pick = (level) => {
    const { game, worms: [h] } = scene(level, [
      { name: 'Hunter', mass: 400, x: 0, y: 0, angle: Math.PI / 2, ai: { aggro: 1 } },
      { name: 'Open', mass: 100, x: 300, y: 0, angle: 0 },
      { name: 'Boxed', mass: 100, x: -300, y: 0, angle: 0 },
      { name: 'Wall A', mass: 1500, x: -150, y: 80, angle: 0 },
      { name: 'Wall B', mass: 1500, x: -150, y: -80, angle: 0 },
    ], 30);
    for (let i = 0; i < 300 && !h.ai.prey; i++) botThink(h, game);
    return h.ai.prey && h.ai.prey.name;
  };
  assert.equal(pick('hard'), 'Boxed');
  assert.equal(pick('easy'), 'Open');
});

test('pinning hunters cut in on the arena side of a prey running along the wall (#78)', () => {
  const s = withTactics('hard', ONLY('pin'), () => {
    const s = hunt('hard', { mass: 400, x: 1500, y: -150, angle: Math.PI / 2 }, { mass: 100, x: 1850, y: 0, angle: Math.PI / 2 });
    botThink(s.worms[0], s.game);
    return s;
  });
  const [h, prey] = s.worms;
  assert.equal(h.ai.mode, 'pin');
  assert.ok(Math.hypot(h.ai.aim.x, h.ai.aim.y) < Math.hypot(prey.x, prey.y) - prey.r, 'aims inside the prey, on the arena side');
  assert.ok(h.ai.aim.y > prey.y, 'ahead of the prey');
  // The same chase away from the wall is a plain cut-off.
  const mid = withTactics('hard', ONLY('pin'), () => {
    const m = hunt('hard', { mass: 400, x: -350, y: -150, angle: Math.PI / 2 }, { mass: 100, x: 0, y: 0, angle: Math.PI / 2 });
    botThink(m.worms[0], m.game);
    return m.worms[0].ai.mode;
  });
  assert.equal(mid, 'cut');
});

test('flanking hunters cut in from the side opposite another hunter (#78)', () => {
  // The prey heads +y. Another bot already hunts it from its +1 side (-x).
  const s = withTactics('hard', ONLY('flank'), () => {
    const s = hunt('hard', { mass: 400, x: 500, y: -200, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2 },
      [{ name: 'First', mass: 400, x: 150, y: 50, angle: Math.PI / 2, ai: { huntUntil: 1e9 } }]);
    s.worms[2].ai.prey = s.worms[1];
    botThink(s.worms[0], s.game);
    return s;
  });
  const [h, prey, first] = s.worms;
  assert.ok(sideOf(prey, first.x, first.y) > 0, 'the first hunter is on the +1 side');
  assert.equal(h.ai.mode, 'flank');
  assert.ok(sideOf(prey, h.ai.aim.x, h.ai.aim.y) < -2 * prey.r, 'the flanker aims at the -1 side');
});

test('coiling hunters circle a small worm and close the loop; short ones cannot (#78)', () => {
  const { game, worms: [h, prey] } = withTactics('hard', ONLY('coil'), () =>
    hunt('hard', { mass: 3000, x: 600, y: 200, angle: 0 }, { mass: 100, x: 600, y: 0, angle: 0 }, [], 30));
  let died = false;
  game.on('death', (e) => { if (e.victim === prey) died = true; });
  const modes = new Set();
  const covered = () => {
    const sectors = new Set();
    for (let i = 0; i < h.sx.length; i++) {
      const dx = h.sx[i] - prey.x, dy = h.sy[i] - prey.y;
      if (dx * dx + dy * dy < 400 * 400) sectors.add(Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 8) % 8);
    }
    return sectors.size;
  };
  let best = 0;
  withTactics('hard', ONLY('coil'), () => {
    for (let i = 0; i < 4 * 60 && !died; i++) {
      game.update(1 / 60);
      modes.add(h.ai.mode);
      best = Math.max(best, covered());
    }
  });
  assert.ok(modes.has('coil'), `coils (modes seen: ${[...modes]})`);
  // A plain cut-off often kills this straight-moving prey too, but never surrounds it (<= 4 sectors).
  assert.ok(best >= 6, `the loop closes around the prey (sectors covered: ${best}, prey died: ${died})`);
  assert.equal(h.dead, false);

  const short = withTactics('hard', ONLY('coil'), () => {
    const s = hunt('hard', { mass: 300, x: 0, y: 200, angle: 0 }, { mass: 100, x: 0, y: 0, angle: 0 });
    botThink(s.worms[0], s.game);
    return s.worms[0].ai.mode;
  });
  assert.equal(short, 'cut', 'too short to circle the prey');
});

test('scavenging bots head for the remains of a big worm that just died (#78)', () => {
  const think = (level) => {
    const { game, worms: [bot, big] } = scene(level, [
      { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Big', mass: 2000, x: 300, y: 300, angle: 0 },
    ], 30);
    game.kill(big, null);
    game.rebuildFoodGrid();
    botThink(bot, game);
    return { bot, game };
  };
  const { bot, game } = think('hard');
  assert.equal(bot.ai.mode, 'scavenge');
  const toward = game.recentDeaths.some((d) => Math.abs(Math.atan2(d.y, d.x) - bot.targetAngle) < 0.3);
  assert.ok(toward, 'heads for the remains');
  assert.equal(bot.wantBoost, true, 'boosts for large remains');
  assert.equal(think('easy').bot.ai.mode, 'food', 'bots without the tactic just eat what is near');

  // Remains another head is already closer to are left alone (a race there gets bots killed).
  const contested = (withRival) => {
    const worms = [
      { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Small', mass: 400, x: 300, y: 300, angle: 0 },
    ];
    if (withRival) worms.push({ name: 'Rival', mass: 100, x: -50, y: 330, angle: Math.PI });
    const { game, worms: [b, small, rival] } = scene('hard', worms, 30);
    game.kill(small, null);
    if (rival) for (const d of game.recentDeaths) assert.ok(Math.hypot(rival.x - d.x, rival.y - d.y) < Math.hypot(d.x, d.y), 'rival is closer to every point');
    game.rebuildFoodGrid();
    botThink(b, game);
    return b.ai.mode;
  };
  assert.equal(contested(false), 'scavenge', 'uncontested, these remains are worth it');
  assert.notEqual(contested(true), 'scavenge');
});

// --- Reading other worms (#83) ---------------------------------------------------

test('the read tactic is appended, so existing bots keep their other tactics (#83)', () => {
  assert.deepEqual(TACTICS.slice(0, 9), ['predict', 'anticipate', 'evade', 'headOn', 'scavenge', 'trap', 'pin', 'coil', 'flank']);
  assert.equal(TACTICS[9], 'read');
  assert.deepEqual(TACTICS.map((k) => DIFFICULTY.easy.tactics[k]), TACTICS.map(() => 0), 'easy knows nothing');
  for (let id = 1; id <= 200; id++) assert.equal(knowsTactic({ id }, 'hard', 'read'), true);
  let normal = 0;
  for (let id = 1; id <= 600; id++) if (knowsTactic({ id }, 'normal', 'read')) normal++;
  assert.ok(Math.abs(normal / 600 - 0.2) < 0.07, `${(normal / 6).toFixed(0)}% of normal bots read`);
});

// A reading bot (hard), a killer and its victim, laid out by distance from the bot.
function killScene(victimAt, extra = []) {
  const s = scene('hard', [
    { name: 'Reader', mass: 400, x: 0, y: 0, angle: 0, ai: {} },
    { name: 'Killer', mass: 300, x: victimAt + 60, y: 200, angle: Math.PI, ai: {} },
    { name: 'Victim', mass: 100, x: victimAt, y: 200, angle: 0 },
    ...extra,
  ], 30);
  s.game.kill(s.worms[2], s.worms[1]);
  return s;
}

test('readers remember kills they saw, and a grudge for a kill right next to them (#83)', () => {
  const near = killScene(100);
  const m = near.worms[0].ai.seen.get(near.worms[1].id);
  assert.equal(m.kills, 1);
  assert.equal(m.grudge, 1, 'a kill within 300 also makes a grudge');
  const inView = killScene(700);
  assert.equal(inView.worms[0].ai.seen.get(inView.worms[1].id).kills, 1);
  assert.equal(inView.worms[0].ai.seen.get(inView.worms[1].id).grudge, 0);
  const far = killScene(2000);
  assert.ok(!far.worms[0].ai.seen || !far.worms[0].ai.seen.has(far.worms[1].id), 'a kill far out of view is unknown (Unseen kill)');
  const easy = scene('easy', [
    { name: 'Reader', mass: 400, x: 0, y: 0, angle: 0, ai: {} },
    { name: 'Killer', mass: 300, x: 160, y: 200, angle: Math.PI },
    { name: 'Victim', mass: 100, x: 100, y: 200, angle: 0 },
  ], 30);
  easy.game.kill(easy.worms[2], easy.worms[1]);
  assert.ok(!easy.worms[0].ai.seen, 'easy bots do not read');
});

test("a bot's memory stays small (#83)", () => {
  const { game, worms: [reader] } = scene('hard', [{ name: 'Reader', mass: 400, x: 0, y: 0, angle: 0, ai: {} }], 30);
  for (let i = 0; i < 25; i++) {
    const [k, v] = ['K', 'V'].map((n, j) => new Worm({ name: n + i, skin: SKINS[0], mass: 100, x: 200 + j * 60, y: 100, angle: 0, worldR: game.R }));
    game.worms.push(k, v);
    game.time += 0.1;
    game.kill(v, k);
  }
  assert.ok(reader.ai.seen.size <= 16, `${reader.ai.seen.size} worms remembered`);
});

test('readers hold a grudge against a worm that tried to cut them off, once a second at most (#83)', () => {
  const s = scene('hard', withFood([
    { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
    { name: 'Cutter', mass: 100, x: 200, y: 150, angle: Math.atan2(-150, 40) },
  ], [{ x: 400, y: 0 }]));
  const [bot, cutter] = s.worms;
  botThink(bot, s.game);
  assert.equal(bot.ai.mode, 'evade');
  assert.equal(bot.ai.seen.get(cutter.id).grudge, 1);
  botThink(bot, s.game);
  assert.equal(bot.ai.seen.get(cutter.id).grudge, 1, 'the same dodge is not counted twice');
});

test('impressions and grudges are not saved (#83)', () => {
  const s = killScene(100);
  s.worms[0].ai.retaliating = s.worms[1];
  s.game.settings.botCount = 30; // the scene lowers it so no bots respawn; a save needs a real setting
  const snap = clone(s.game);
  assert.doesNotThrow(() => validateSnapshot(snap));
  const loaded = new Game(null, snap);
  for (const w of loaded.worms) if (w.ai) { assert.ok(!w.ai.seen); assert.ok(!w.ai.retaliating); }
});

test('kill counts, shown on name tags, survive a save and load; new bots start at none (#126)', () => {
  const g = new Game({ botCount: 10, difficulty: 'normal' }, null, { seed: 5 });
  g.worms.forEach((w, i) => { w.kills = i; });
  const loaded = new Game(null, clone(g));
  assert.deepEqual(loaded.worms.map((w) => w.kills), g.worms.map((w) => w.kills), 'same kills after loading');
  // Tag fades: a bot with kills dies, and its replacement starts with none.
  const victim = loaded.worms.find((w) => w.ai && w.kills > 0);
  loaded.kill(victim, null);
  const fresh = () => loaded.worms.filter((w) => w.ai && w.born > 0);
  for (let i = 0; i < 4 * 60 && !fresh().length; i++) loaded.update(1 / 60);
  assert.ok(fresh().length > 0, 'a replacement spawned');
  for (const w of fresh()) assert.equal(w.kills, 0, `a new bot starts with no kills (${w.name})`);
});

test('readers leave a worm they saw kill alone, unless it is much smaller (#83)', () => {
  assert.equal(pickPrey({ mass: 300 }, { mass: 300 }, () => {}).prey, 'Near', 'nearest by default');
  assert.equal(pickPrey({ mass: 300 }, { mass: 300 }, (s) => memo(s, 'Near', 1.5, 0)).prey, 'Far', 'Seen killer gets room');
  assert.equal(pickPrey({ mass: 150 }, { mass: 300 }, (s) => memo(s, 'Near', 1.5, 0)).prey, 'Near', 'Much smaller killer');
});

test('one real kill keeps a reader wary for about half a minute (#83)', () => {
  // A real kill seen by the reader, then later thinks (review: a single kill used to fade below the
  // old >= 1 threshold before the next think).
  const after = (seconds) => pickPrey({ mass: 300 }, { mass: 300 }, (s) => {
    const near = s.worms.find((w) => w.name === 'Near');
    const victim = new Worm({ name: 'Victim', skin: SKINS[0], mass: 100, x: 300, y: 60, angle: 0, worldR: s.game.R });
    s.game.worms.push(victim);
    s.game.kill(victim, near);
    s.game.time += seconds;
  }).prey;
  assert.equal(after(0.5), 'Far', 'half a second later the killer is left alone');
  assert.equal(after(20), 'Far', 'still wary after 20 s');
  assert.equal(after(35), 'Near', 'forgotten after about half a minute');
});

test('one real cut-off is enough to retaliate, for about 20 seconds (#83)', () => {
  // The cutter from the evasion scene, then a later prey choice among it and a nearer worm.
  const run = (seconds) => withTactics('hard', { ...ONLY('read'), evade: 1 }, () => {
    const s = scene('hard', [
      { name: 'Bot', mass: 400, x: 0, y: 0, angle: 0, ai: { aggro: 1 } },
      { name: 'Cutter', mass: 100, x: 200, y: 150, angle: Math.atan2(-150, 40) },
    ], 30);
    const [bot, cutter] = s.worms;
    botThink(bot, s.game);
    assert.equal(bot.ai.mode, 'evade');
    // Afterwards: a neutral worm nearer than the cutter.
    const neutral = new Worm({ name: 'Neutral', skin: SKINS[0], mass: 100, x: -120, y: 0, angle: Math.PI, worldR: s.game.R });
    s.game.worms.push(neutral);
    for (const w of [bot, cutter]) { w.sx.fill(w.sx[0]); w.sy.fill(w.sy[0]); }
    cutter.sx[0] = cutter.sx[0] + 100; cutter.angle = Math.PI / 2; // now heading away, just a candidate
    s.game.rebuildSegGrid();
    s.game.time += seconds;
    bot.ai.prey = null;
    for (let i = 0; i < 300 && !bot.ai.prey; i++) botThink(bot, s.game);
    return bot.ai.prey && bot.ai.prey.name;
  });
  assert.equal(run(2), 'Cutter', 'retaliates against the cutter rather than the nearer worm');
  assert.equal(run(25), 'Neutral', 'the grudge is gone after about 20 s');
});

test('readers retaliate against a worm they hold a grudge against, two at most (#83)', () => {
  const r = pickPrey({ mass: 300 }, { mass: 300 }, (s) => memo(s, 'Far', 0, 2));
  assert.equal(r.prey, 'Far', 'Cut off, then retaliates (over a nearer worm)');
  assert.equal(r.retaliating, 'Far');
  // Bigger culprit: too heavy to hunt (hard prey limit 2x), so not prey.
  assert.equal(pickPrey({ mass: 300 }, { mass: 900 }, (s) => memo(s, 'Far', 0, 2)).prey, 'Near', 'Bigger culprit');
  // No gang-ups: two other bots already retaliate against Far.
  const crowd = [1, 2].map((i) => ({ name: 'Other' + i, mass: 400, x: -900, y: 900 * i, angle: 0, ai: {} }));
  const g = pickPrey({ mass: 300 }, { mass: 300 }, (s) => {
    memo(s, 'Far', 0, 2);
    const far = s.worms.find((w) => w.name === 'Far');
    for (const o of s.worms.filter((w) => w.name.startsWith('Other'))) o.ai.retaliating = far;
  }, crowd);
  assert.equal(g.prey, 'Near', 'No gang-ups');
  // A hunt that ends clears the retaliation.
  const [h] = r.s.worms;
  r.s.game.time = h.ai.huntUntil + 1;
  withTactics('hard', ONLY('read'), () => botThink(h, r.s.game));
  assert.ok(!h.ai.retaliating || h.ai.retaliating === h.ai.prey, 'retaliation ends with the hunt');
});

test('readers evade worms they are wary of from farther away (#83)', () => {
  // A head 470 away, beyond the usual evade range (400 at skill 1), crossing our path ahead.
  // Without Hard sharpness, which senses threats from farther anyway (#110).
  const run = (otherMass, setup) => withSharp(NO_SHARP, () => withTactics('hard', { ...ONLY('read'), evade: 1 }, () => {
    const s = scene('hard', [
      { name: 'Bot', mass: 400, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Other', mass: otherMass, x: 400, y: 250, angle: Math.atan2(-250, -150) },
    ], 30);
    setup(s);
    botThink(s.worms[0], s.game);
    return s.worms[0].ai.mode;
  }));
  assert.notEqual(run(100, () => {}), 'evade', 'an unknown worm at that distance is ignored');
  assert.equal(run(100, (s) => memo(s, 'Other', 1, 0)), 'evade', 'a seen killer is evaded from farther');
  assert.equal(run(1000, (s) => memo(s, 'Other', 0, 1)), 'evade', 'a bigger culprit is kept away from');
});

// --- Hard sharpness (#110; Expert sharpness until #177) --------------------------
function withSharp(patch, fn) {
  const saved = { ...DIFFICULTY.hard.sharp };
  Object.assign(DIFFICULTY.hard.sharp, patch);
  try { return fn(); } finally { Object.assign(DIFFICULTY.hard.sharp, saved); }
}
// Every sharpness setting at its "off" value: a hard bot that plays like one of the same skill
// without sharpness (what the old Hard level was for these tests).
const NO_SHARP = { think: 1, look: 1, dense: 0, headings: 1, sense: 1, heads: 8, escape: 0, reach: 0 };
// Re-plans of each bot over `secs`: its think timer jumps up whenever it re-plans.
function replans(game, bots, secs) {
  const n = new Map(bots.map((b) => [b, 0])), prev = new Map(bots.map((b) => [b, b.thinkT]));
  for (let i = 0; i < secs * 60; i++) {
    game.update(1 / 60);
    for (const b of bots) { if (b.thinkT > prev.get(b)) n.set(b, n.get(b) + 1); prev.set(b, b.thinkT); }
  }
  return n;
}

test('only hard is sharp, and only hard starts with more and bigger large bots (#110, #177)', () => {
  assert.deepEqual(Object.keys(DIFFICULTY.hard.sharp).sort(), ['dense', 'escape', 'headings', 'heads', 'look', 'reach', 'sense', 'think']);
  assert.deepEqual(Object.keys(NO_SHARP).sort(), Object.keys(DIFFICULTY.hard.sharp).sort(), 'NO_SHARP covers every setting');
  for (const level of ['easy', 'normal']) assert.equal(DIFFICULTY[level].sharp, undefined, level);
  const big = DIFFICULTIES.map((l) => [DIFFICULTY[l].bigShare, DIFFICULTY[l].bigMax]);
  assert.deepEqual(big, [[0.1, 1200], [0.15, 2000], [0.35, 5000]]);
  const masses = [];
  for (let seed = 1; seed <= 6; seed++) masses.push(...new Game({ botCount: 60, difficulty: 'hard' }, null, { seed }).worms.map((w) => w.mass));
  const share = masses.filter((m) => m >= 400).length / masses.length;
  assert.ok(Math.abs(share - 0.35) < 0.08, `${(share * 100).toFixed(0)}% start large`);
  assert.ok(Math.max(...masses) <= 5000 && Math.max(...masses) > 3000, `largest ${Math.round(Math.max(...masses))}`);
});

test('sharp bots re-plan more often than bots of the same skill without sharpness; the saved interval is unchanged (#110)', () => {
  const count = (sharp) => withSharp(sharp, () => {
    const { game, worms: [bot] } = scene('hard', [{ name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} }]);
    return replans(game, [bot], 10).get(bot);
  });
  const plain = count(NO_SHARP), sharp = count({});
  assert.ok(sharp > plain * 1.25, `sharp ${sharp} vs plain ${plain} re-plans in 10 s`);
  // A loaded hard world re-plans at the sharp rate too, from the unchanged saved interval.
  const g = new Game({ botCount: 10, difficulty: 'hard' }, null, { seed: 3 });
  for (let i = 0; i < 60; i++) g.update(1 / 60);
  const snap = JSON.parse(JSON.stringify(g.toJSON()));
  for (const d of snap.worms.filter((d) => d.ai)) assert.ok(Math.abs(d.ai.interval - (0.32 - 0.22 * d.ai.skill)) < 0.01, 'saved interval is the base one');
  const loaded = new Game(null, snap, { seed: 3 });
  const bots = loaded.worms.filter((w) => w.ai);
  const n = replans(loaded, bots, 5);
  // A bot that dies stops re-planning, so only bots alive throughout count (#125 changed who dies).
  const alive = bots.filter((b) => !b.dead);
  assert.ok(alive.length >= 5, `enough bots lived through the 5 s (${alive.length})`);
  for (const b of alive) {
    const base = 5 / (b.ai.interval * 1.2); // fewest re-plans at the base rate
    assert.ok(n.get(b) > base * 1.25, `${b.name}: ${n.get(b)} re-plans in 5 s, base rate gives at least ${Math.round(base)}`);
  }
});

test('sharp bots see a thin body that slips between a plain bot\'s look-ahead points (#110)', () => {
  const r = radiusFor(100), plainL = 320 + 3 * r, sharpL = 320 * DIFFICULTY.hard.sharp.look + 3 * r;
  // A thin worm's body across the path at x, ahead of the bot heading for food along +x.
  const run = (level, x, sharp = {}) => withSharp(sharp, () => withTactics(level, ONLY(null), () => {
    const { game, worms: [bot] } = scene(level, withFood([
      { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Thin', mass: 15, x, y: 50, angle: Math.PI / 2 },
    ], [{ x: 480, y: 0 }]));
    botThink(bot, game);
    return bot.targetAngle;
  }));
  // Midway between a plain bot's last two points: the plain bot doesn't see it, the sharp one does.
  const gapP = plainL * 0.81;
  assert.ok(Math.abs(run('hard', gapP, NO_SHARP)) < 0.02, 'plain bot keeps its line');
  assert.ok(Math.abs(run('hard', gapP)) > 0.05, 'sharp bot turns off its line');
  // Midway between a sharp bot's own last two sparse points: only the close check finds it.
  const gapS = sharpL * 0.81;
  assert.ok(Math.abs(run('hard', gapS, { dense: 0 })) < 0.02, 'sparse points alone miss it');
  assert.ok(Math.abs(run('hard', gapS)) > 0.05, 'the close check of the winning heading finds it');
});

test('sharp bots notice a cutter from farther than a plain bot of the same skill (#110)', () => {
  // A head 470 away (plain evade range at skill 1: 400), crossing ahead.
  const run = (level, sharp = {}) => withSharp(sharp, () => withTactics(level, ONLY('evade'), () => {
    const s = scene(level, [
      { name: 'Bot', mass: 400, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Other', mass: 100, x: 400, y: 250, angle: Math.atan2(-250, -150) },
    ], 30);
    botThink(s.worms[0], s.game);
    return s.worms[0].ai.mode;
  }));
  assert.notEqual(run('hard', NO_SHARP), 'evade');
  assert.equal(run('hard'), 'evade');
  assert.notEqual(run('hard', { sense: 1 }), 'evade', 'it is the wider sensing');
});

test('hard bots steer clear of two cutters at once (#110)', () => {
  const { game, worms: [bot, a, b] } = scene('hard', withFood([
    { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
    { name: 'A', mass: 100, x: 200, y: 150, angle: Math.atan2(-150, 40) },
    { name: 'B', mass: 100, x: -250, y: -150, angle: Math.PI / 3 },
  ], [{ x: 400, y: 0 }]));
  // Does heading `h` from the bot's head meet worm o's coming head within a second?
  const meets = (o, h) => {
    for (let k = 1; k <= 30; k++) {
      const t = k / 30, x = Math.cos(h) * bot.speed * t, y = Math.sin(h) * bot.speed * t;
      for (let j = 1; j <= 20; j++) { const p = predictHead(o, j / 20); if (Math.hypot(x - p.x, y - p.y) < bot.r + o.r) return true; }
    }
    return false;
  };
  // Turning away from A's line alone would run into B.
  const away = a.angle + (sideOf(a, 0, 0) >= 0 ? 1 : -1) * Math.PI / 2;
  assert.ok(meets(b, away), 'scene: escaping A alone meets B');
  botThink(bot, game);
  assert.equal(bot.ai.mode, 'evade');
  assert.ok(!meets(a, bot.targetAngle) && !meets(b, bot.targetAngle), `heading ${bot.targetAngle.toFixed(2)} clears both`);
});

test('sharpness comes only from a level\'s own settings (#110)', () => {
  // Byte-identical easy/normal runs against the previous engine are checked with seeded
  // balance reports (see the #110 PR); here: a level without a sharp block gets no sharpness,
  // and the same block given to normal does change how its bots play.
  const run = () => {
    const g = new Game({ botCount: 12, difficulty: 'normal' }, null, { seed: 77 });
    g.spawnPlayer('You', 0);
    for (let i = 0; i < 60 * 20; i++) g.update(1 / 60);
    const snap = g.toJSON();
    delete snap.savedAt;
    return JSON.stringify(snap);
  };
  const plain = run();
  DIFFICULTY.normal.sharp = DIFFICULTY.hard.sharp;
  try { assert.notEqual(run(), plain, 'a sharp block changes normal bots'); } finally { delete DIFFICULTY.normal.sharp; }
  assert.equal(run(), plain, 'and without one they play as before');
});

test('a sharp bot going head-on still avoids a loop of its target\'s body across the way (#110)', () => {
  const { game, worms: [bot, other] } = scene('hard', [
    { name: 'Bot', mass: 400, x: 0, y: 0, angle: 0, ai: {} },
    { name: 'Other', mass: 100, x: 180, y: 10, angle: Math.PI },
  ]);
  // The tail end of the target's body crosses the line between the two heads at x = 100.
  const n = other.sx.length, from = n - 24;
  for (let i = from; i < n; i++) { other.sx[i] = 100; other.sy[i] = -90 + (i - from) * 7.5; }
  other.updateBounds();
  game.rebuildSegGrid();
  botThink(bot, game);
  assert.equal(bot.ai.mode, 'headOn');
  assert.ok(Math.abs(bot.targetAngle) > 0.2, `does not drive through the loop (${bot.targetAngle.toFixed(2)})`);
});

test('a sharp bot boxed in by a loop of body takes the way out, not a heading it never checked closely (#118)', () => {
  // The bot heads for food along +x inside a loop of a big worm's body, open only around +90°.
  // The loop lies between the sparse look-ahead points, so only the close check sees it, and the
  // headings toward the food all fail it: more than the four the close check used to try.
  const { game, worms: [bot, loop] } = withTactics('hard', ONLY(null), () => scene('hard', withFood([
    { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
    { name: 'Loop', mass: 1000, x: 0, y: 3000, angle: 0 },
  ], [{ x: 1000, y: 0 }])));
  const L = 320 * DIFFICULTY.hard.sharp.look + 3 * bot.r, R = 0.485 * L;
  loop.sx = []; loop.sy = [];
  for (let k = 0; k < 320; k++) {
    const a = (2 * Math.PI * k) / 320;
    if (Math.abs(a - Math.PI / 2) < 0.75) continue;
    loop.sx.push(R * Math.cos(a)); loop.sy.push(R * Math.sin(a));
  }
  loop.updateBounds();
  game.rebuildSegGrid();
  withTactics('hard', ONLY(null), () => botThink(bot, game));
  // How close the chosen ray, out to the look-ahead, comes to the loop; a head dies within 0.78 (r + r').
  const c = Math.cos(bot.targetAngle), s = Math.sin(bot.targetAngle);
  let clearance = Infinity;
  for (let i = 0; i < loop.sx.length; i++) {
    const t = Math.max(0, Math.min(L, loop.sx[i] * c + loop.sy[i] * s));
    clearance = Math.min(clearance, Math.hypot(loop.sx[i] - c * t, loop.sy[i] - s * t));
  }
  const lethal = 0.78 * (bot.r + loop.r);
  assert.ok(clearance > lethal, `heading ${bot.targetAngle.toFixed(2)} passes ${clearance.toFixed(1)} from the loop (lethal: ${lethal.toFixed(1)})`);
});

test('a third bot holding a grudge leaves a ganged-up worm alone, even as the nearest or only prey (#119)', () => {
  // Two other bots already retaliate against `name`, and the reader holds a grudge against it.
  const ganged = (name) => (s) => {
    memo(s, name, 0, 2);
    const culprit = s.worms.find((w) => w.name === name);
    for (const o of s.worms.filter((w) => w.name.startsWith('Other'))) o.ai.retaliating = culprit;
  };
  const crowd = [1, 2].map((i) => ({ name: 'Other' + i, mass: 400, x: -900, y: 900 * i, angle: 0, ai: {} }));
  // Nearest: hunts the other worm instead.
  assert.equal(pickPrey({ mass: 300 }, { mass: 300 }, ganged('Near'), crowd).prey, 'Far', 'nearest');
  // Only candidate (the other worm out of hunting range): hunts nothing.
  assert.equal(pickPrey({ mass: 300 }, { mass: 300, y: 3000 }, ganged('Near'), crowd).prey, null, 'only candidate');
  // Easiest for a trapping bot: the culprit is boxed in, yet it hunts the other worm.
  const boxed = (s) => {
    ganged('Near')(s);
    const near = s.worms.find((w) => w.name === 'Near');
    s.worms.push(...[-1, 1].map((side) => {
      const wall = new Worm({ name: 'Wall', skin: SKINS[0], mass: 2000, x: 250 + side * 60, y: 200, angle: -Math.PI / 2, worldR: s.game.R });
      for (let i = 0; i < wall.sx.length; i++) { wall.sx[i] = near.sx[0] + side * 60; wall.sy[i] = near.sy[0] + 200 - i * 8; }
      wall.updateBounds();
      return wall;
    }));
    s.game.worms = s.worms;
    s.game.rebuildSegGrid();
  };
  assert.equal(pickPrey({ mass: 300 }, { mass: 300 }, boxed, crowd, { read: 1, trap: 1 }).prey, 'Far', 'trap pick');
});

// --- A meal before a fight (#122) ----------------------------------------------
// A hunter at the origin after a small worm; a big worm (mass 3000) lies off to the side, its head
// at (-200, 0) and its body stretching away along -x, nearer the hunter than the prey.
const BIG_AWAY = { name: 'Big', mass: 3000, x: -200, y: 0, angle: 0 };
const SMALL_AWAY = { name: 'Small', mass: 30, x: -200, y: 0, angle: 0 };
function huntBeside(shares, dead, hunter = { mass: 400, x: 0, y: 0, angle: 0 }, prey = { mass: 100, x: 300, y: 0, angle: Math.PI / 2 }) {
  return withTactics('hard', shares, () => {
    const s = hunt('hard', hunter, prey, dead ? [dead] : [], 30);
    if (dead) s.game.kill(s.worms[2], null);
    s.game.rebuildFoodGrid();
    botThink(s.worms[0], s.game);
    return s.worms[0];
  });
}

test('a scavenging hunter drops the hunt for a much bigger meal nearby, not for a few leftovers (#122)', () => {
  const scav = ONLY('scavenge');
  const plain = huntBeside(scav, null);
  assert.equal(plain.ai.mode, 'cut', 'hunts with no remains around');
  // Hunting next to a big meal.
  const fed = huntBeside(scav, BIG_AWAY);
  assert.equal(fed.ai.prey, null, 'drops the hunt');
  assert.equal(fed.ai.mode, 'scavenge', 'heads for the remains');
  assert.ok(Math.cos(fed.targetAngle - Math.PI) > Math.cos(0.6), `toward the remains (${fed.targetAngle.toFixed(2)})`);
  // A few leftovers: a small worm's remains are worth less than the kill.
  const crumbs = huntBeside(scav, SMALL_AWAY);
  assert.ok(crumbs.ai.prey, 'keeps the hunt');
  assert.equal(crumbs.ai.mode, 'cut');
  // Bots that don't scavenge keep hunting next to the big meal, as before.
  const blind = huntBeside(ONLY(null), BIG_AWAY);
  assert.ok(blind.ai.prey, 'a bot without the tactic keeps hunting');
  assert.equal(blind.ai.mode, 'cut');
});

test('a scavenging coiler leaves its coil for a much bigger meal nearby (#122)', () => {
  const shares = { ...ONLY('scavenge'), coil: 1 };
  const coiler = { mass: 3000, x: 600, y: 200, angle: 0 }, prey = { mass: 100, x: 600, y: 0, angle: 0 };
  assert.equal(huntBeside(shares, null, coiler, prey).ai.mode, 'coil', 'coils with no remains around');
  // A big worm's body along y = 450, nearer the coiler than the prey.
  const h = huntBeside(shares, { name: 'Big', mass: 3000, x: 1000, y: 450, angle: 0 }, coiler, prey);
  assert.equal(h.ai.prey, null, 'drops the coil');
  assert.equal(h.ai.mode, 'scavenge');
});

test('a scavenging bot free to pick prey goes for a big meal instead of starting a hunt (#122)', () => {
  const picks = (dead) => withTactics('hard', ONLY('scavenge'), () => {
    const worms = [
      { name: 'Hunter', mass: 400, x: 0, y: 0, angle: 0, ai: { aggro: 1 } },
      { name: 'Prey', mass: 100, x: 250, y: 0, angle: Math.PI / 2 },
    ];
    if (dead) worms.push(dead);
    const s = scene('hard', worms, 30);
    if (dead) s.game.kill(s.worms[2], null);
    s.game.rebuildFoodGrid();
    const [h] = s.worms;
    for (let i = 0; i < 300 && !h.ai.prey; i++) botThink(h, s.game);
    return h;
  });
  assert.equal(picks(null).ai.prey && picks(null).ai.prey.name, 'Prey', 'hunts with no remains around');
  const h = picks(BIG_AWAY);
  assert.equal(h.ai.prey, null, 'starts no hunt');
  assert.equal(h.ai.mode, 'scavenge');
});

test('weighing meals against hunts leaves easy worlds unchanged (#122)', () => {
  // Easy bots don't scavenge, so how much a hunt is worth against a meal can't matter there.
  const world = (odds) => {
    const saved = CFG.HUNT_ODDS;
    CFG.HUNT_ODDS = odds;
    try {
      const g = new Game({ botCount: 30, difficulty: 'easy' }, null, { seed: 4242 });
      g.spawnPlayer('P', 0);
      for (let i = 0; i < 20 * 60; i++) g.update(1 / 60);
      const j = clone(g);
      delete j.savedAt;
      return JSON.stringify(j);
    } finally { CFG.HUNT_ODDS = saved; }
  };
  assert.equal(world(0), world(1e9));
});

test('a scavenger that has reached spread-out remains eats them instead of circling their middle (#141)', () => {
  // A scavenger 60 px from the middle of remains whose food lies 110-260 px around it, as a dead
  // worm's body leaves it. Aiming at the middle point, it circled it, boosting, and left 105-146 of
  // 240 in 8 s; eating the food itself, it leaves 5-80 (median 25, #146).
  const { game, worms: [bot] } = withTactics('hard', ONLY('scavenge'), () => scene('hard', [{ name: 'Bot', mass: 300, x: 0, y: 0, angle: 0, ai: {} }]));
  const C = { x: 60, y: 0 }, reach = 300;
  let total = 0;
  for (let k = 0; k < 48; k++) {
    const a = k * 2.39996, d = 110 + (k % 6) * 30;
    game.food.push({ x: C.x + Math.cos(a) * d, y: C.y + Math.sin(a) * d, v: 5, r: 8, c: '#fff', life: 60, ph: 0, dead: false, natural: false });
    total += 5;
  }
  game.recentDeaths.push({ x: C.x, y: C.y, reach, mass: total, value: total, time: 0 });
  game.rebuildFoodGrid();
  // Nothing else to go for: respawning power-ups, special food or food could pull the bot away and
  // leave it short of time, which isn't what this tests (#146).
  Object.assign(game, { powerupTarget: 0, specialTarget: 0, foodTarget: 0 });
  let boosting = 0;
  withTactics('hard', ONLY('scavenge'), () => {
    for (let i = 0; i < 8 * 60; i++) {
      game.update(1 / 60);
      // Only boosting in the remains counts. A bot may leave them for a pickup and boost back in from
      // outside, which is fine; just past their edge is covered by the #146 test.
      if (bot.boosting && bot.ai.mode === 'scavenge' && Math.hypot(bot.x - C.x, bot.y - C.y) < reach) boosting++;
    }
  });
  const left = game.food.filter((f) => !f.dead && !f.natural).reduce((s, f) => s + f.v, 0);
  assert.ok(left <= total * 0.4, `ate the remains (${Math.round(left)} of ${total} left)`);
  assert.equal(boosting, 0, `no boosting in the remains (${(boosting / 60).toFixed(1)} s)`);
});

test('a scavenger that overshoots the remains\' edge doesn\'t boost back in (#146)', () => {
  // Remains of 240 spread 110-260 px around (0, 0), reach 300. A bot that was in them and is now
  // 30 px past the edge, heading outward after a pellet there, used to count as "not there yet",
  // aim for the middle and boost.
  const think = (path) => withTactics('hard', ONLY('scavenge'), () => {
    const { game, worms: [bot] } = scene('hard', [{ name: 'Bot', mass: 300, x: path[0], y: 0, angle: 0, ai: {} }]);
    let total = 0;
    for (let k = 0; k < 48; k++) {
      const a = k * 2.39996, d = 110 + (k % 6) * 30;
      game.food.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, v: 5, r: 8, c: '#fff', life: 60, ph: 0, dead: false, natural: false });
      total += 5;
    }
    game.recentDeaths.push({ x: 0, y: 0, reach: 300, mass: total, value: total, time: 0 });
    game.rebuildFoodGrid();
    for (const x of path) { // think at each place along the way
      const dx = x - bot.sx[0];
      for (let i = 0; i < bot.sx.length; i++) bot.sx[i] += dx;
      botThink(bot, game);
    }
    return bot;
  });
  const out = think([200, 330]);
  assert.equal(out.ai.mode, 'scavenge');
  assert.equal(out.wantBoost, false, 'no boost just past the edge, having been in');
  assert.ok(Math.abs(angleDiff(0, out.targetAngle)) > Math.PI / 2, 'turns back toward the remains\' food');
  // Approaching from outside is as before: at the same spot, never having been in, it boosts in for
  // a big meal (#122), and so it does once more than 100 px past the edge.
  assert.equal(think([330]).wantBoost, true, 'approaching: boosts in');
  assert.equal(think([200, 420]).wantBoost, true, 'well clear of the remains: approaching again');
});

// Reachable paths (#149).
// Runs fn with hard's reach switched to `on` (1/0).
function withReach(on, fn) {
  const saved = DIFFICULTY.hard.sharp.reach;
  DIFFICULTY.hard.sharp.reach = on;
  try { return fn(); } finally { DIFFICULTY.hard.sharp.reach = saved; }
}

test('a reachable path is where the worm actually goes when it steers for that heading (#149)', () => {
  const { game } = scene('hard', []);
  for (const deg of [0, 45, 90, 170, -45, -90, -170]) {
    for (const boosted of [false, true]) {
      for (const turn of [0, 10]) {
        const w = new Worm({ name: 'W', skin: SKINS[0], mass: 120, x: 0, y: 0, angle: 0.3, worldR: game.R, pw: { turn } });
        const a = 0.3 + (deg * Math.PI) / 180, p = reachPath(w, a, boosted);
        w.targetAngle = a; w.wantBoost = boosted; w.boosting = boosted;
        for (let i = 1; i <= 60; i++) {
          w.update(1 / 60, game);
          if (i !== 30 && i !== 60) continue;
          const q = reachAt(p, (p.v * i) / 60), off = Math.hypot(q.x - w.sx[0], q.y - w.sy[0]);
          // The game turns in 1/60 s steps, a little ahead of the smooth arc: a few units at most.
          assert.ok(off < 10, `${deg}°, boost ${boosted}, turn ${turn}, ${i / 60} s: ${off.toFixed(1)} off`);
        }
      }
    }
  }
});

test('a hard bot does not boost when only its wider boosting turn meets a body (#149)', () => {
  // The bot goes for a big pellet 250 away, about 110° to its left, and its boost roll always passes.
  // A body runs alongside that line, 170 to its right: clear of the straight line and of the normal
  // turn (about 63 out at 110°), but on the wider boosting turn (about 154 out, and farther as it
  // carries on past the pellet).
  const a = (110 * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), nx = sa, ny = -ca; // right of the line
  const think = (reach) => withReach(reach, () => withTactics('hard', ONLY(null), () => {
    const { game, worms: [bot, body] } = scene('hard', withFood([
      { name: 'Bot', mass: 120, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Body', mass: 2000, x: ca * 800 + nx * 170, y: sa * 800 + ny * 170, angle: a },
    ], [{ x: ca * 250, y: sa * 250 }]));
    game.rng = () => 0;
    const L = 320 * DIFFICULTY.hard.sharp.look + 3 * bot.r, rad = bot.r + 10;
    botThink(bot, game);
    // How close the bot's path along its chosen heading comes to the body, out to `far`.
    const gap = (boosted, far) => {
      const p = reachPath(bot, bot.targetAngle, boosted);
      let m = Infinity;
      for (let t = 0; t <= far; t += 5) {
        const q = reachAt(p, t);
        for (let i = 0; i < body.sx.length; i++) m = Math.min(m, Math.hypot(body.sx[i] - q.x, body.sy[i] - q.y) - rad - body.r);
      }
      return m;
    };
    return { bot, normal: gap(false, L), boosted: gap(true, 1.6 * L) };
  }));
  const off = think(0), on = think(1);
  assert.equal(off.bot.ai.mode, 'food');
  assert.equal(off.bot.wantBoost, true, 'without reach it boosts');
  assert.ok(Math.abs(on.bot.targetAngle - a) < 0.2, `with reach it still heads for the food (${on.bot.targetAngle.toFixed(2)})`);
  assert.ok(on.normal > 0, `its normal turn there is clear (by ${on.normal.toFixed(0)})`);
  assert.ok(on.boosted < 0, `its boosting turn there meets the body (${on.boosted.toFixed(0)})`);
  assert.equal(on.bot.wantBoost, false, 'so it does not boost');
});

test('reachable paths change nothing on easy and normal (#149)', () => {
  const run = (level, reach) => withReach(reach, () => {
    const g = new Game({ botCount: 30, difficulty: level }, null, { seed: 4242 });
    for (let i = 0; i < 600; i++) g.update(1 / 60);
    return JSON.stringify(g.worms.map((w) => [w.id, w.mass, w.sx[0], w.sy[0], w.angle]));
  });
  for (const level of ['easy', 'normal']) assert.equal(run(level, 1), run(level, 0), level);
  assert.notEqual(run('hard', 1), run('hard', 0), 'hard does change');
});

// --- Shadowing bigger worms (#150) ---------------------------------------------------

test('shadow is appended: every hard bot; every bot keeps its other tactics (#150, #177)', () => {
  assert.deepEqual(TACTICS.slice(11), ['escape', 'shadow']);
  for (const level of ['easy', 'normal']) assert.equal(DIFFICULTY[level].tactics.shadow, 0, level);
  assert.equal(DIFFICULTY.hard.tactics.shadow, 1);
  // Each bot's first twelve tactics, as bits, for ids 1-40, recorded before shadow was added
  // (hard: what Expert knew, everything).
  const before = {
    normal: [537, 521, 3, 516, 8, 1, 7, 17, 512, 0, 526, 5, 17, 19, 6, 19, 517, 1, 5, 2, 16, 5, 7, 27, 16, 0, 21, 17, 22, 8, 518, 18, 3, 5, 515, 512, 514, 530, 0, 19],
    hard: Array(40).fill(4095),
  };
  for (const [level, masks] of Object.entries(before)) {
    const now = masks.map((_, i) => TACTICS.slice(0, 12).reduce((m, k, j) => m | (knowsTactic({ id: i + 1 }, level, k) ? 1 << j : 0), 0));
    assert.deepEqual(now, masks, level);
  }
});

// A mass-300 bot at `at` heading `angle`, free to act (its rolls always pass), and a bigger worm with
// its head at (300, 0) heading +y, its body trailing down along x = 300.
function shadowScene(shares, { bigMass = 900, at = [0, 0], angle = 0, player = false, extra = [], level = 'hard' } = {}) {
  return withTactics(level, shares, () => {
    const s = scene(level, [
      { name: 'Bot', mass: 300, x: at[0], y: at[1], angle, ai: { aggro: 1 } },
      { name: 'Big', mass: bigMass, x: 300, y: 0, angle: Math.PI / 2 },
      ...extra,
    ]);
    if (player) s.worms[1].isPlayer = true;
    s.game.rng = () => 0;
    return { ...s, bot: s.worms[0], big: s.worms[1], think: () => withTactics(level, shares, () => botThink(s.worms[0], s.game)) };
  });
}
const SHADOW = ONLY('shadow');

test('a bot shadows a worm too big to hunt, beside its body, within the limits (#150)', () => {
  const s = shadowScene(SHADOW);
  s.think();
  assert.equal(s.bot.ai.shadow, s.big, 'shadows the worm three times its mass');
  assert.equal(s.bot.ai.mode, 'shadow');
  assert.ok(s.bot.targetAngle < 0, `heads for beside its body, behind its head (${s.bot.targetAngle.toFixed(2)})`);
  const crowded = shadowScene(SHADOW, { extra: [{ name: 'S1', mass: 300, x: -3000, y: 0, angle: 0, ai: {} }, { name: 'S2', mass: 300, x: -3000, y: 900, angle: 0, ai: {} }] });
  crowded.worms[2].ai.shadow = crowded.big; crowded.worms[3].ai.shadow = crowded.big;
  crowded.think();
  assert.ok(!crowded.bot.ai.shadow, 'two shadows already');
  const huge = shadowScene(SHADOW, { bigMass: 1300 });
  huge.think();
  assert.ok(!huge.bot.ai.shadow, 'more than four times its mass');
  const player = shadowScene(SHADOW, { player: true });
  player.think();
  assert.equal(player.bot.ai.shadow, player.big, 'the player like any worm');
  // A bot that doesn't know the tactic draws exactly as many random numbers with a worm to shadow
  // nearby as without one.
  const draws = (bigAt) => {
    const s2 = shadowScene(ONLY(null));
    for (let i = 0; i < s2.big.sx.length; i++) s2.big.sx[i] += bigAt;
    s2.big.updateBounds(); s2.game.rebuildSegGrid();
    let n = 0;
    s2.game.rng = () => { n++; return 0; };
    s2.think();
    return n;
  };
  assert.equal(draws(0), draws(5000));
});

test('a shadowing bot gives up after 15 seconds or when its worm gets far, and evades a threat first (#150)', () => {
  const late = shadowScene(SHADOW);
  late.think();
  late.game.rng = () => 0.99; // no new pick
  late.game.time += 16;
  late.think();
  assert.ok(!late.bot.ai.shadow, 'after 15 s');
  const far = shadowScene(SHADOW);
  far.think();
  far.game.rng = () => 0.99;
  for (let i = 0; i < far.big.sx.length; i++) far.big.sx[i] += 2000;
  far.big.updateBounds(); far.game.rebuildSegGrid();
  far.think();
  assert.ok(!far.bot.ai.shadow, 'beyond 900');
  // A head lining up to cut it off (as in the evasion test): it evades.
  const threat = shadowScene({ ...SHADOW, evade: 1 }, { extra: [{ name: 'Cutter', mass: 100, x: 200, y: -150, angle: Math.atan2(150, 40) }] });
  threat.think();
  assert.equal(threat.bot.ai.mode, 'evade');
});

test('a shadow cuts in only with a clear, in-time cut from beside its worm, never from in front (#150)', () => {
  // Shadowers on hard all predict turns, which times the cut-off point ahead of the head.
  const CUTTER = { ...SHADOW, predict: 1 };
  // Beside the big worm's head, going its way: the cut is clear and in time.
  const cut = shadowScene(CUTTER, { at: [230, 30], angle: Math.PI / 2 });
  cut.bot.ai.shadow = cut.big; cut.bot.ai.shadowUntil = 1e9;
  cut.think();
  assert.equal(cut.bot.ai.prey, cut.big, 'hands over to a cut-off');
  assert.equal(cut.bot.ai.fromShadow, true);
  assert.ok(['cut', 'trap', 'flank', 'pin', 'learn'].includes(cut.bot.ai.mode), cut.bot.ai.mode);
  // Far behind its head: too late, so it keeps shadowing.
  const behind = shadowScene(CUTTER, { at: [230, -300], angle: Math.PI / 2 });
  behind.bot.ai.shadow = behind.big; behind.bot.ai.shadowUntil = 1e9;
  behind.think();
  assert.ok(!behind.bot.ai.prey, 'not in time');
  assert.equal(behind.bot.ai.mode, 'shadow');
  // A body across the way to the cut: it keeps shadowing.
  const blocked = shadowScene(CUTTER, { at: [230, 30], angle: Math.PI / 2, extra: [{ name: 'Wall', mass: 2000, x: 280, y: 110, angle: 0 }] }); // its body runs along y = 110, across the way
  blocked.bot.ai.shadow = blocked.big; blocked.bot.ai.shadowUntil = 1e9;
  blocked.think();
  assert.ok(!blocked.bot.ai.prey, 'path blocked');
  // In front of its head: that would be a head-on, so no cut.
  const front = shadowScene(CUTTER, { at: [380, 120], angle: Math.PI / 2 });
  front.bot.ai.shadow = front.big; front.bot.ai.shadowUntil = 1e9;
  front.think();
  assert.ok(!front.bot.ai.prey, 'never from in front');
});
