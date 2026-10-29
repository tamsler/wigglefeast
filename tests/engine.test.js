// Engine tests: the world, saves, food, power-ups and growth. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../engine.js');
const { Game, Worm, SKINS, PICKABLE_SKINS, DIFFICULTY, DIFFICULTIES, difficultyOf, MAX_BOTS, arenaRadius, giantCount, SPECIALS, CFG, radiusFor, lengthFor, botThink, validateSnapshot, foodRadius } = globalThis.WormEngine;
const { clone, fixture, simulate, withFood, scene, hunt, withTactics } = require('./helpers/engine.js');

test('a saved world restores and keeps running', () => {
  const { g } = simulate(30, 'normal', 30);
  const snap = clone(g);
  const g2 = new Game(null, snap);
  assert.equal(g2.worms.length, g.worms.length);
  assert.equal(g2.food.length, g.food.length);
  assert.equal(g2.powerups.length, g.powerups.length);
  assert.equal(g2.player && g2.player.name, g.player && g.player.name);
  // Re-saving gives the same worms, apart from two known, harmless differences:
  // peak catching up with mass gained this tick, and bots dropping a prey that died.
  const again = clone(g2);
  snap.worms.forEach((w, i) => {
    for (const k of Object.keys(w)) {
      if (k === 'peak') continue;
      const a = k === 'ai' && w.ai ? { ...w.ai, prey: 0 } : w[k];
      const b = k === 'ai' && again.worms[i].ai ? { ...again.worms[i].ai, prey: 0 } : again.worms[i][k];
      assert.deepEqual(b, a, `worm ${w.name} field ${k} changed after restore`);
    }
  });
  for (let i = 0; i < 30 * 60; i++) g2.update(1 / 60);
  assert.ok(g2.worms.every((w) => Number.isFinite(w.mass)));
});

test('the committed v1 save fixture still loads', () => {
  const save = fixture();
  assert.doesNotThrow(() => validateSnapshot(save.world));
  const g = new Game(null, save.world);
  assert.ok(g.player, 'fixture has a live player');
  const legacy = clone(save.world);
  legacy.app = 'worm-arena';
  assert.doesNotThrow(() => new Game(null, legacy), 'saves from before the rename (worm-arena) load');
});

test('real saves pass validation and malformed ones are rejected', () => {
  for (const [bc, diff] of [[5, 'easy'], [60, 'hard']]) {
    const snap = clone(simulate(bc, diff, 30).g);
    assert.doesNotThrow(() => new Game(null, snap), `real ${bc}-bot ${diff} save`);
    const bad = {
      'wrong app': (s) => { s.app = 'not-a-save'; },
      'prototype key as difficulty': (s) => { s.settings.difficulty = '__proto__'; },
      'huge bot count': (s) => { s.settings.botCount = 9999; },
      'non-numeric time': (s) => { s.time = 'x'; },
      'worm name not a string': (s) => { s.worms[0].name = { a: 1 }; },
      'skin out of range': (s) => { s.worms[0].skin = 99; },
      'body missing': (s) => { delete s.worms[0].sx; },
      'body with a string': (s) => { s.worms[0].sx[1] = 'boom'; },
      'zero mass': (s) => { s.worms[0].mass = 0; },
      'unknown power-up key': (s) => { s.worms[0].pw.constructor = 5; },
      'bot state junk': (s) => { s.worms.find((w) => w.ai).ai.skill = '<img>'; },
      'two players': (s) => { s.worms[0].isPlayer = true; s.worms[1].isPlayer = true; },
      'colour with markup': (s) => { s.palette[0] = 'red"><img>'; },
      'food array length': (s) => { s.food.push(1); },
      'negative food value': (s) => { s.food[2] = -5; },
      'unknown power-up type': (s) => { s.powerups[0] = { x: 0, y: 0, ph: 0, type: 'constructor' }; },
      'worms not an array': (s) => { s.worms = {}; },
      // Finite but extreme values (#31)
      'heading that overflows to NaN': (s) => { s.worms[0].angle = 1e308; s.worms[0].targetAngle = -1e308; },
      'body far outside the arena': (s) => { s.worms[0].sx[0] = 1e300; },
      'mass that outgrows the body limit': (s) => { s.worms[0].mass = 2e8; },
      'huge dropAcc': (s) => { s.worms[0].dropAcc = 2e6; },
      'bot skill out of range': (s) => { s.worms.find((w) => w.ai).ai.skill = 1e6; },
      'bot thinking every step': (s) => { s.worms.find((w) => w.ai).ai.interval = 0; },
      'bot wander point far away': (s) => { s.worms.find((w) => w.ai).ai.wx = 1e300; },
      'food far outside the arena': (s) => { s.food[0] = 1e300; },
      'duplicate worm ids': (s) => { s.worms[1].id = s.worms[0].id; },
      'worm id zero': (s) => { s.worms[0].id = 0; },
      'fractional nextId': (s) => { s.nextId = 1.5; },
      'bot without a brain': (s) => { s.worms.find((w) => w.ai).ai = null; },
      // Inconsistent, or would not survive being saved again (#46)
      'run born after the save': (s) => { s.worms[0].born = s.time + 60; },
      'negative kills': (s) => { s.worms[0].kills = -1; },
      'fractional food eaten': (s) => { s.worms[0].eaten = 1.5; },
      'time that overflows when saved': (s) => { s.time = 1e308; },
      'food value that rounds to zero': (s) => { s.food[2] = 0.001; },
      'food life that overflows': (s) => { s.food[4] = 1e308; },
      'huge power-up timer': (s) => { s.worms[0].pw.magnet = 1e308; },
      'negative power-up timer': (s) => { s.worms[0].pw.magnet = -5; },
      'huge peak': (s) => { s.worms[0].peak = 1e308; },
      'negative shield': (s) => { s.worms[0].shield = -1; },
      'power-up phase that overflows': (s) => { s.powerups[0].ph = 1e308; },
      'respawn time that overflows': (s) => { s.respawnQueue = [1e308]; },
    };
    for (const [name, mutate] of Object.entries(bad)) {
      const s = clone(snap);
      mutate(s);
      assert.throws(() => new Game(null, s), /Invalid Wigglefeast save/, `should reject: ${name}`);
    }
  }
});

test('peak score includes food eaten on the tick of death (#24)', () => {
  const game = new Game({ botCount: 5 });
  game.worms = []; game.food = []; game.powerups = [];
  const player = new Worm({ name: 'Player', skin: SKINS[0], mass: 15, x: 0, y: 0, angle: 0, worldR: game.R, isPlayer: true });
  const blocker = new Worm({ name: 'Body', skin: SKINS[0], mass: 200, x: 120, y: 0, angle: 0, worldR: game.R });
  blocker.sx = blocker.sx.map((p, i) => 120 - i * blocker.r * 0.42);
  blocker.sy = blocker.sy.map(() => 0);
  game.worms = [player, blocker];
  game.player = player;
  game.addFood(4, 0, 100, '#ffffff', 60);
  game.rebuildFoodGrid();
  game.rebuildSegGrid();
  let victim = null;
  game.on('death', (e) => { victim = e.victim; });
  game.update(1 / 60);
  assert.ok(victim, 'player died');
  assert.equal(Math.round(victim.mass), 115);
  assert.ok(victim.peak >= victim.mass, `peak ${victim.peak} < final score ${victim.mass}`);
});

test('a world loaded from a valid save keeps producing valid saves (#31)', () => {
  // Food at the limit: natural respawns and death drops must not push it over.
  const full = fixture().world;
  const extra = 50000 - full.food.length / 7;
  for (let i = 0; i < extra; i++) full.food.push(0, 0, 1, 0, 50, 0, 0);
  const g = new Game(null, full);
  g.worms.find((w) => w.ai).mass = 3000; // dies on the next tick, dropping food
  g.kill(g.worms.find((w) => w.ai), null);
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  assert.doesNotThrow(() => validateSnapshot(clone(g)), 'food stays within the limit');

  // Mass at the limit: eating more must not grow the worm past it.
  const big = fixture().world;
  const p = big.worms.find((w) => w.isPlayer);
  p.mass = 1e8;
  p.pw.x5 = 10;
  p.shield = 10;
  big.food.push(p.sx[0], p.sy[0], 1e7, 0, -1, 0, 1);
  const g2 = new Game(null, big);
  for (let i = 0; i < 5; i++) g2.update(1 / 60);
  assert.ok(g2.player && g2.player.mass <= 1e8, 'mass capped');
  assert.doesNotThrow(() => validateSnapshot(clone(g2)), 'big worm still saves');
});

test('worms loaded without nextId never share an id with new worms (#31)', () => {
  // Ids are per world, so aim just ahead of the next one a fresh world would hand out.
  const upcoming = new Game({ botCount: 5 }).spawnBot(false).id + 1;
  const snap = fixture().world;
  snap.worms[0].id = upcoming + 3;
  delete snap.nextId;
  const g = new Game(null, snap);
  for (let i = 0; i < 20; i++) g.spawnBot(false);
  const ids = g.worms.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('power-ups slide toward a passing head, from much farther with the magnet (#35)', () => {
  // A lone shielded worm drives straight along +x past a power-up beside its path.
  // No refill (#105): a power-up spawned at random, rarely a magnet on the worm's path,
  // would change the result. Fixed seeds keep the run repeatable; 1818 and 3436 are two
  // where the refill did drop a magnet in the way, so they fail if the refill comes back.
  const pass = (offset, magnet, seed) => {
    const game = new Game({ botCount: 5 }, null, { seed });
    game.worms = []; game.food = []; game.powerups = [];
    game.powerupTarget = 0;
    const w = new Worm({ name: 'Player', skin: SKINS[0], mass: 15, x: 0, y: 0, angle: 0, worldR: game.R, isPlayer: true, shield: 1e9 });
    w.pw.magnet = magnet ? 10 : 0;
    game.worms = [w];
    game.player = w;
    const p = { x: 150, y: offset, type: 'x2', ph: 0, dead: false };
    game.powerups = [p];
    game.rebuildFoodGrid();
    game.rebuildSegGrid();
    for (let i = 0; i < 50; i++) game.update(1 / 60);
    return { collected: p.dead && w.pw.x2 > 0, moved: p.x !== 150 || p.y !== offset };
  };
  for (const seed of [1, 1818, 3436]) {
    // Beside the path, close enough to brush the glow: it used to need head radius + 24 (~38).
    assert.equal(pass(55, false, seed).collected, true, `seed ${seed}`);
    // Far beside the path: left alone without the magnet, pulled in with it.
    assert.deepEqual(pass(200, false, seed), { collected: false, moved: false }, `seed ${seed}`);
    assert.equal(pass(200, true, seed).collected, true, `seed ${seed}`);
  }
});

test('the tight-turn power-up doubles the turn rate for 16 seconds (#38)', () => {
  const g = { addFood() {} };
  const pair = () => ['a', 'b'].map((name) => {
    const w = new Worm({ name, skin: SKINS[0], mass: 300, x: 0, y: 0, angle: 0, worldR: 5000 });
    w.targetAngle = 3; // nearly behind: keeps turning at the maximum rate
    return w;
  });
  const turned = (w, ticks) => { const a0 = w.angle; for (let i = 0; i < ticks; i++) w.update(1 / 60, g); return w.angle - a0; };

  for (const boost of [false, true]) {
    const [plain, tight] = pair();
    tight.pw.turn = 16;
    plain.wantBoost = tight.wantBoost = boost;
    const a = turned(plain, 5), b = turned(tight, 5);
    assert.ok(a > 0.1, `turning at all (boost ${boost})`);
    assert.ok(Math.abs(b / a - 2) < 1e-9, `2:1 turn rate with boost ${boost}: ${b} vs ${a}`);
  }

  // The effect ends with the timer: afterwards both turn at the same rate.
  const [plain, tight] = pair();
  tight.pw.turn = 0.04; // runs out within three ticks
  turned(plain, 3); turned(tight, 3);
  assert.equal(tight.pw.turn, 0);
  assert.ok(Math.abs(turned(tight, 3) - turned(plain, 3)) < 1e-9, 'same rate once the timer runs out');
});

test('saves from before the tight-turn power-up load, and saves with it round-trip (#38)', () => {
  const old = fixture().world;
  assert.ok(old.worms.every((w) => !('turn' in w.pw)), 'fixture predates the power-up');
  const g = new Game(null, old);
  assert.ok(g.worms.every((w) => w.pw.turn === 0), 'loaded worms start without the effect');

  const snap = fixture().world;
  snap.worms[0].pw.turn = 9.5;
  snap.powerups.push({ x: 10, y: 20, type: 'turn', ph: 1 });
  assert.doesNotThrow(() => validateSnapshot(snap));
  const again = clone(new Game(null, snap));
  assert.doesNotThrow(() => validateSnapshot(again));
  assert.equal(again.worms.find((w) => w.id === snap.worms[0].id).pw.turn, 9.5);
  assert.ok(again.powerups.some((p) => p.type === 'turn'));
});

test('simultaneous deaths: the player run is recorded after all kills of the tick are credited (#47)', () => {
  // P's head hits K's body while V's head hits P's body, all in one collision pass.
  const straight = (name, x, y, angle, mass, isPlayer) => {
    const w = new Worm({ name, skin: SKINS[0], mass, x, y, angle, worldR: 5000, isPlayer });
    const sp = w.r * 0.42;
    w.sx = w.sx.map((v, i) => x - Math.cos(angle) * i * sp);
    w.sy = w.sy.map((v, i) => y - Math.sin(angle) * i * sp);
    w.updateBounds();
    return w;
  };
  for (const order of [['P', 'V', 'K'], ['V', 'P', 'K'], ['K', 'V', 'P']]) {
    const game = new Game({ botCount: 5 });
    game.food = []; game.powerups = [];
    const worms = {
      P: straight('Player', 0, 0, 0, 15, true), // heading +x, body along -x
      K: straight('Killer', 5, 200, Math.PI / 2, 200), // body crosses just in front of P's head
      V: straight('Victim', -50, 3, Math.PI / 2, 15), // head lands on P's body
    };
    game.worms = order.map((k) => worms[k]);
    game.player = worms.P;
    game.maxR = Math.max(...game.worms.map((w) => w.r));
    game.rebuildFoodGrid();
    game.rebuildSegGrid();
    let recordedKills = null;
    const seen = [];
    game.on('death', (e) => {
      seen.push(e.victim.name);
      if (e.victim === worms.P) recordedKills = worms.P.kills; // what main.js records for the run
    });
    game.checkCollisions();
    assert.deepEqual(seen.sort(), ['Player', 'Victim'], `order ${order}: both die`);
    assert.equal(recordedKills, 1, `order ${order}: the player's kill is counted when the run is recorded`);
  }
});

test('skins: originals keep their place, new skins are complete, hidden ones are never handed out (#58)', () => {
  const { PICKABLE_SKINS } = globalThis.WormEngine;
  // Saves store skins by position, so the original 14 must never move or change.
  const ORIGINAL = [
    ['Cherry Pop', ['#ff595e', '#ffca3a']], ['Lagoon', ['#4cc9f0', '#4361ee', '#3a0ca3']], ['Lime Ocean', ['#8ac926', '#1982c4']],
    ['Holo', null], ['Candy Cane', ['#ffffff', '#ef233c']], // Rainbow's slot, now a reward (#180)
    ['Bumblebee', ['#2b2b2b', '#ffd60a']], ['Neon Night', ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0']],
    ['Mint', ['#2ec4b6', '#cbf3f0']], ['Ghost', null], // Lavender's slot, now a reward (#180)
    ['Sailor', ['#e63946', '#f1faee', '#a8dadc', '#457b9d']], ['Tangerine', ['#ff9f1c', '#ffbf69', '#fff3e0']],
    ['Emerald', ['#06d6a0', '#118ab2']], ['Grape', ['#6a4c93', '#f15bb5']], ['Lava', ['#d00000', '#ffba08', '#dc2f02']],
  ];
  ORIGINAL.forEach(([name, colors], i) => {
    assert.equal(SKINS[i].name, name, `skin ${i}`);
    if (!colors) return; // the two reward slots: new look, same position
    assert.deepEqual(SKINS[i].colors, colors, `${name} colours`);
    assert.equal(SKINS[i].finish, 'stripes', `${name} finish`);
    assert.deepEqual(SKINS[i].food, colors, `${name} drops its own colours, as before`);
  });
  assert.deepEqual(SKINS.slice(14).map((s) => s.name), ['Aurora', 'Sunset Drive', 'Synthwave', 'Toxic', 'Gold Rush', 'Chrome', 'Ladybug', 'Leopard', 'Viper', 'Galaxy', 'Magma', 'Abyss', 'Inferno', 'Storm', 'Crystal', 'Galaxy Prime']); // rewards appended (#14, renamed #180)
  const hex = /^#[0-9a-f]{6}$/i;
  for (const s of SKINS) {
    assert.ok(['stripes', 'gradient', 'neon', 'metallic', 'spots', 'scales', 'galaxy', 'pulse', 'holo', 'ghost', 'inferno', 'storm', 'crystal', 'galaxyprime'].includes(s.finish), `${s.name} finish`);
    assert.ok([...s.colors, s.accent, ...s.food].every((c) => hex.test(c)), `${s.name} colours are #rrggbb`);
  }
  assert.deepEqual(SKINS.filter((s) => s.hidden).map((s) => s.name), ['Holo', 'Ghost', 'Inferno', 'Storm', 'Crystal', 'Galaxy Prime']); // the rewards (#14, #180)
  assert.equal(PICKABLE_SKINS.length, 24);

  const game = new Game({ botCount: 5 });
  for (let i = 0; i < 2000; i++) assert.ok(!game.spawnBot(false).skin.hidden, 'bots never get a hidden skin');

  const synth = new Worm({ name: 'S', skin: SKINS.find((s) => s.name === 'Synthwave'), mass: 300, x: 0, y: 0, angle: 0, worldR: game.R });
  game.worms = [synth]; game.food = [];
  game.kill(synth, null);
  assert.ok(game.food.length > 0 && game.food.every((f) => ['#ff2e88', '#2de2e6'].includes(f.c)), 'death food is bright, not the dark body colour');
});

test('Auto food theme follows the season, by local date (#64)', () => {
  const { seasonalTheme } = globalThis.WormEngine;
  const on = (m, d) => seasonalTheme(new Date(2026, m - 1, d, 12));
  assert.equal(on(10, 14), 'classic');
  assert.equal(on(10, 15), 'halloween');
  assert.equal(on(10, 31), 'halloween');
  assert.equal(on(11, 1), 'classic');
  assert.equal(on(11, 30), 'classic');
  assert.equal(on(12, 1), 'christmas');
  assert.equal(on(12, 26), 'christmas');
  assert.equal(on(12, 27), 'classic');
  assert.equal(on(3, 1), 'classic');
});

test('a new world starts mostly small, with fewer big bots on easier levels (#16)', () => {
  const bigShare = {};
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const masses = [];
    for (let i = 0; i < 6; i++) masses.push(...new Game({ botCount: 60, difficulty }).worms.map((w) => w.mass).filter((m) => m < CFG.GIANT_MIN_MASS)); // not the starting giants (#204)
    masses.sort((a, b) => a - b);
    const big = masses.filter((m) => m >= 400).length / masses.length;
    const { bigShare: want, bigMax } = DIFFICULTY[difficulty];
    // 360 bots per level: the share of big bots lands well within +-0.08 of the setting.
    assert.ok(Math.abs(big - want) < 0.08, `${difficulty}: ${(big * 100).toFixed(0)}% start big, expected about ${want * 100}%`);
    const median = masses[Math.floor(masses.length / 2)];
    assert.ok(median < 200, `${difficulty}: median start mass ${median.toFixed(0)}`);
    assert.ok(masses[masses.length - 1] <= bigMax, `${difficulty}: a bot started above ${bigMax}`);
    bigShare[difficulty] = want;
  }
  assert.ok(bigShare.easy < bigShare.normal && bigShare.normal < bigShare.hard);
});

test('a new world starts with giants: 3, or one per 10 bots, bigger on harder levels (#204)', () => {
  assert.deepEqual([5, 10, 30, 60, 150].map(giantCount), [3, 3, 3, 6, 15]);
  const giants = (bots, difficulty, seed) => new Game({ botCount: bots, difficulty }, null, { seed }).worms.filter((w) => w.ai && w.mass >= CFG.GIANT_MIN_MASS);
  for (const [bots, want] of [[5, 3], [30, 3], [150, 15]]) {
    for (const difficulty of ['easy', 'normal', 'hard']) assert.equal(giants(bots, difficulty, 5).length, want, `${bots} bots on ${difficulty}`);
  }
  const top = {};
  for (const difficulty of DIFFICULTIES) {
    let max = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const w of giants(30, difficulty, seed)) {
        assert.ok(w.mass >= 20000 && w.mass <= DIFFICULTY[difficulty].giantMax, `${difficulty}: a giant of ${Math.round(w.mass)}`);
        max = Math.max(max, w.mass);
      }
    }
    top[difficulty] = max;
  }
  assert.deepEqual(DIFFICULTIES.map((d) => DIFFICULTY[d].giantMax), [35000, 55000, 80000]);
  assert.ok(top.easy < top.normal && top.normal < top.hard, JSON.stringify(top));
  // Everyone else starts as before, the player included, and replacements are small.
  const g = new Game({ botCount: 30, difficulty: 'normal' }, null, { seed: 3 });
  assert.ok(g.worms.filter((w) => w.ai && w.mass < CFG.GIANT_MIN_MASS).every((w) => w.mass <= DIFFICULTY.normal.bigMax));
  const initial = new Set(g.worms.map((w) => w.id));
  g.kill(g.worms.find((w) => w.ai && w.mass >= CFG.GIANT_MIN_MASS), null);
  for (let i = 0; i < 5 * 60; i++) g.update(1 / 60);
  const fresh = g.worms.filter((w) => !initial.has(w.id));
  assert.ok(fresh.length > 0, 'a replacement spawned');
  assert.ok(fresh.every((w) => w.mass < 200), 'replacements are small, never giants');
  // A saved world keeps what it had: loading adds no giants.
  const saved = clone(new Game({ botCount: 30, difficulty: 'normal' }, null, { seed: 4 }));
  for (const w of saved.worms) if (w.ai) w.mass = 100;
  const back = new Game(null, saved);
  assert.equal(back.worms.filter((w) => w.ai && w.mass >= CFG.GIANT_MIN_MASS).length, 0);
});

test('a giant starts with a body that fits the arena and grows to full length as it moves (#204)', () => {
  const g = new Game({ botCount: 5, difficulty: 'hard' }, null, { seed: 2 });
  const giant = g.worms.find((w) => w.ai && w.mass >= CFG.GIANT_MIN_MASS);
  assert.ok(giant, 'a giant');
  for (let i = 0; i < giant.sx.length; i++) assert.ok(Math.hypot(giant.sx[i], giant.sy[i]) <= g.R, `segment ${i} is inside the arena`);
  assert.ok(giant.sx.length * (giant.r * 0.42) <= CFG.BODY_LAYOUT_MAX + giant.r, 'a short body at first');
  assert.equal(giant.r, radiusFor(giant.mass), 'as thick as its mass calls for from the start');
  giant.shield = 1e9;
  for (let i = 0; i < 60 * 60; i++) g.update(1 / 60);
  const full = Math.ceil(lengthFor(giant.mass) / (giant.r * 0.42));
  assert.ok(Math.abs(giant.sx.length - full) <= 2, `${giant.sx.length} segments, want ${full}`);
  // Ordinary worms are laid out as before: the whole length, curled behind the head.
  const w = new Worm({ name: 'Plain', skin: SKINS[0], mass: 3000, x: 0, y: 0, angle: 0, worldR: 3600 });
  assert.equal(w.sx.length, Math.ceil(lengthFor(3000) / (radiusFor(3000) * 0.42)));
});

test('the player never spawns inside a giant, and a 150-bot world with 15 giants starts fast (#204)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const g = new Game({ botCount: 5 + (seed % 3) * 30, difficulty: 'hard' }, null, { seed });
    const p = g.spawnPlayer('Tester', 0);
    for (const o of g.worms) {
      if (o === p) continue;
      for (let i = 0; i < o.sx.length; i++) assert.ok(Math.hypot(o.sx[i] - p.sx[0], o.sy[i] - p.sy[0]) > p.r + o.r, `seed ${seed}: ${o.name} at ${Math.round(o.mass)}`);
    }
  }
  const t0 = Date.now();
  const big = new Game({ botCount: 150, difficulty: 'hard' }, null, { seed: 1 });
  assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0} ms to start`);
  assert.equal(big.worms.filter((w) => w.mass >= CFG.GIANT_MIN_MASS).length, 15);
});

test('x2 and x5 multiply natural food only, not food dropped by worms (#16)', () => {
  const eat = (natural) => {
    const game = new Game({ botCount: 5 });
    game.worms = []; game.powerups = [];
    const w = new Worm({ name: 'Eater', skin: SKINS[0], mass: 100, x: 0, y: 0, angle: 0, worldR: game.R, shield: 1e9 });
    w.pw.x5 = 10;
    game.worms = [w];
    game.food = [];
    if (natural) game.food.push({ x: 0, y: 0, v: 4, r: 5, c: '#fff', life: Infinity, ph: 0, dead: false, natural: true });
    else game.addFood(0, 0, 4, '#fff', 30);
    game.rebuildFoodGrid();
    game.eatFood(1 / 60);
    assert.equal(game.food[0].dead, true, 'the food was eaten');
    return w.mass - 100;
  };
  assert.equal(eat(true), 20);
  assert.equal(eat(false), 4);
});

// --- Growing into the millions (#204) --------------------------------------------------

// A one-worm world: a shielded eater of the given mass and power-ups, and no other food.
function eater(mass, pw = {}) {
  const game = emptyWorld(1, 5);
  game.specialTarget = 0;
  const w = new Worm({ name: 'Eater', skin: SKINS[0], mass, x: 0, y: 0, angle: 0, worldR: game.R, shield: 1e9 });
  Object.assign(w.pw, pw);
  game.worms = [w];
  return { game, w };
}

test('x10 multiplies natural food only, beats x5 and x2, and is the rarest power-up (#204)', () => {
  const eat = (pw, natural) => {
    const { game, w } = eater(100, pw);
    if (natural) game.food.push({ x: 0, y: 0, v: 4, r: 5, c: '#fff', life: Infinity, ph: 0, dead: false, natural: true });
    else game.addFood(0, 0, 4, '#fff', 30);
    game.rebuildFoodGrid();
    game.eatFood(1 / 60);
    assert.equal(game.food[0].dead, true, 'the food was eaten');
    return w.mass - 100;
  };
  assert.equal(eat({ x10: 10 }, true), 40);
  assert.equal(eat({ x10: 10 }, false), 4, 'dropped food is not multiplied');
  assert.equal(eat({ x2: 10, x5: 10, x10: 10 }, true), 40, 'the highest multiplier applies');
  assert.equal(eat({ x2: 10, x5: 10 }, true), 20, 'without x10, x5 still applies');

  const game = new Game({ botCount: 5 }, null, { seed: 7 });
  const n = {};
  for (let i = 0; i < 20000; i++) { game.powerups = []; game.spawnPowerup(); const t = game.powerups[0].type; n[t] = (n[t] || 0) + 1; }
  assert.ok(n.x10 > 0, 'x10 spawns');
  assert.ok(Object.entries(n).every(([k, c]) => k === 'x10' || c > n.x10), `x10 is the rarest: ${JSON.stringify(n)}`);
  assert.ok(n.x10 < n.x5, 'rarer than x5');
});

test('big worms get more out of natural food only: (mass / 1000) ^ 0.6 above 1,000 (#204)', () => {
  assert.equal(CFG.GROWTH_FROM, 1000);
  assert.equal(CFG.GROWTH_POWER, 0.6);
  const gain = (mass, pw, kind, v = 4) => {
    const { game, w } = eater(mass, pw);
    if (kind === 'natural') game.food.push({ x: 0, y: 0, v, r: 5, c: '#fff', life: Infinity, ph: 0, dead: false, natural: true });
    else if (kind === 'dropped') game.addFood(0, 0, v, '#fff', 30);
    game.rebuildFoodGrid();
    if (kind === 'special') { game.specials.push({ x: 0, y: 0, kind: 'plasma', life: 20, ph: 0, dead: false }); game.eatSpecials(1 / 60); } else game.eatFood(1 / 60);
    return w.mass - mass;
  };
  assert.equal(gain(15, {}, 'natural'), 4);
  assert.equal(gain(1000, {}, 'natural'), 4, 'no bonus at 1,000');
  assert.ok(Math.abs(gain(10000, {}, 'natural') - 4 * Math.pow(10, 0.6)) < 1e-9, `${gain(10000, {}, 'natural')}`);
  assert.ok(Math.abs(gain(10000, {}, 'natural') - 15.9) < 0.05);
  assert.ok(Math.abs(gain(10000, { x2: 10 }, 'natural') - 31.8) < 0.1, 'stacks with x2');
  assert.ok(Math.abs(gain(100000, {}, 'natural') - 4 * Math.pow(100, 0.6)) < 1e-9);
  assert.equal(gain(100000, {}, 'dropped', 100), 100, 'dropped food is not scaled');
  assert.equal(gain(100000, { x10: 10 }, 'dropped', 100), 100);
  assert.equal(gain(100000, {}, 'special'), SPECIALS.plasma.value, 'special food is not scaled');
  // Bots get it on the same terms: it is a rule of eating, not of the player.
  const g = new Game({ botCount: 5 }, null, { seed: 2 });
  const bot = g.worms.find((w) => w.ai);
  Object.assign(g, { worms: [bot], food: [], specials: [], powerups: [] });
  bot.mass = 10000; bot.shield = 1e9;
  g.food.push({ x: bot.sx[0], y: bot.sy[0], v: 4, r: 5, c: '#fff', life: Infinity, ph: 0, dead: false, natural: true });
  g.rebuildFoodGrid();
  g.eatFood(1 / 60);
  assert.ok(Math.abs(bot.mass - 10000 - 15.9) < 0.05, `${bot.mass}`);
});

test('saves from before x10 load, and saves with it round-trip (#204)', () => {
  const old = fixture().world;
  assert.ok(old.worms.every((w) => !('x10' in w.pw)), 'fixture predates the power-up');
  const g = new Game(null, old);
  assert.ok(g.worms.every((w) => w.pw.x10 === 0 && w.multiplier <= 5), 'loaded worms start without the effect');

  const snap = fixture().world;
  snap.worms[0].pw.x10 = 7.5;
  snap.powerups.push({ x: 10, y: 20, type: 'x10', ph: 1 });
  assert.doesNotThrow(() => validateSnapshot(snap));
  const again = clone(new Game(null, snap));
  assert.doesNotThrow(() => validateSnapshot(again));
  assert.equal(again.worms.find((w) => w.id === snap.worms[0].id).pw.x10, 7.5);
  assert.ok(again.powerups.some((p) => p.type === 'x10'));
});

test('natural food comes in 1, 2, 4 and 10, in the ratio 52 : 30 : 12 : 6 (#204)', () => {
  const game = new Game({ botCount: 5 }, null, { seed: 11 });
  game.food = [];
  game.naturalFood = 0;
  const N = 40000;
  for (let i = 0; i < N; i++) game.spawnNaturalFood();
  const share = {};
  for (const f of game.food) share[f.v] = (share[f.v] || 0) + 1;
  assert.deepEqual(Object.keys(share).map(Number).sort((a, b) => a - b), [1, 2, 4, 10], 'no pellet is worth 8');
  for (const [v, want] of [[1, 52], [2, 30], [4, 12], [10, 6]]) {
    const got = (100 * share[v]) / N;
    assert.ok(Math.abs(got - want) < 1.5, `${v}: ${got.toFixed(1)}% (want ${want}%)`);
  }
});

test('big pellets are drawn bigger, small ones exactly as before (#204)', () => {
  for (const v of [0.5, 1, 2, 4, 10, 25, 49.9]) assert.equal(foodRadius(v), Math.min(20, 3 + Math.sqrt(v) * 2.4), `value ${v}`);
  assert.ok(foodRadius(2000) >= 48 && foodRadius(2000) <= 50, `2,000: ${foodRadius(2000).toFixed(1)}`);
  assert.equal(foodRadius(10000), 60);
  assert.equal(foodRadius(1e6), 60);
  assert.ok(foodRadius(50) >= 19.9 && foodRadius(50) <= 20.1, 'continuous at 50');
  for (let v = 1; v < 20000; v *= 1.3) assert.ok(foodRadius(v * 1.3) >= foodRadius(v), `grows at ${v}`);
});

test('a worm of 200,000 only grows when it eats, and a million-mass worm leaves 80% as big pieces (#204)', () => {
  const { game, w } = eater(200000);
  for (let i = 0; i < 600; i++) game.update(1 / 60);
  assert.ok(Math.abs(w.mass - 200000) < 1e-6, `no shedding (${w.mass})`);
  game.food.push({ x: w.sx[0], y: w.sy[0], v: 8, r: 8, c: '#fff', life: Infinity, ph: 0, dead: false, natural: false });
  game.rebuildFoodGrid();
  game.eatFood(1 / 60);
  assert.equal(w.mass, 200008, 'food dropped by a worm is worth its value, with no size bonus');

  const giant = eater(1e6);
  const g = giant.game, big = giant.w;
  g.update(1 / 60); // the body grows to its length
  for (let i = 0; i < 60; i++) g.update(1 / 60);
  const mass = big.mass, segs = big.sx.length;
  g.food = [];
  g.kill(big, null);
  const dropped = g.food.reduce((t, f) => t + f.v, 0);
  assert.ok(Math.abs(dropped - 0.8 * mass) < 0.8 * mass * 0.05, `drops about 80% (${dropped.toFixed(0)} of ${mass.toFixed(0)})`);
  assert.ok(g.food.length <= segs && g.food.length <= 50000, `${g.food.length} pieces for ${segs} segments`);
  assert.ok(g.food.every((f) => f.v > 1000 && f.r > 40), 'each piece is worth thousands and drawn big');
});

test('a world with a 3,000,000-mass player saves and resumes with the same size (#204)', () => {
  const snap = fixture().world;
  const p = snap.worms.find((w) => w.isPlayer);
  p.mass = 3e6;
  p.peak = 3e6;
  assert.doesNotThrow(() => validateSnapshot(snap));
  const g = new Game(null, snap);
  Object.assign(g, { food: [], naturalFood: 0, foodTarget: 0 }); // nothing to eat: the size bonus would move the mass
  g.rebuildFoodGrid();
  for (let i = 0; i < 90; i++) g.update(1 / 60);
  const w = g.worms.find((x) => x.isPlayer);
  assert.ok(w && !w.dead);
  assert.ok(Math.abs(w.mass - 3e6) < 10000, `mass ${w.mass.toFixed(0)}`);
  assert.ok(Math.abs(w.r - radiusFor(w.mass)) < 0.1);
  const back = clone(g);
  assert.doesNotThrow(() => validateSnapshot(back));
  const again = new Game(null, back).worms.find((x) => x.isPlayer);
  assert.ok(Math.abs(again.mass - w.mass) < 1);
  assert.equal(again.sx.length, w.sx.length);
  const bad = clone(g);
  bad.worms.find((x) => x.isPlayer).mass = 2e8;
  assert.throws(() => validateSnapshot(bad), /Invalid Wigglefeast save/);
});

// #163 draws food a third larger; how close a head must get stays the same: eaten within
// r * 0.9 + f.r * 0.4, pulled in from up to 2.2 r + 24, left alone beyond that.
test('food pickup distance is unchanged by its drawn size (#163)', () => {
  const at = (d) => {
    const game = new Game({ botCount: 5 });
    game.powerups = [];
    const w = new Worm({ name: 'Eater', skin: SKINS[0], mass: 100, x: 0, y: 0, angle: 0, worldR: game.R, shield: 1e9 });
    game.worms = [w];
    // Straight above the head, so the worm's heading doesn't matter.
    game.food = [{ x: w.sx[0], y: w.sy[0] - d, v: 4, r: 10, c: '#fff', life: Infinity, ph: 0, dead: false, natural: true }];
    game.rebuildFoodGrid();
    game.eatFood(1 / 60);
    const f = game.food[0];
    return { eaten: f.dead, moved: Math.hypot(f.x - w.sx[0], f.y - w.sy[0]) < d - 0.01 };
  };
  const r = radiusFor(100), eat = r * 0.9 + 10 * 0.4, reach = r * 2.2 + 24;
  assert.equal(at(eat - 0.5).eaten, true, 'eaten just inside the pickup distance');
  const near = at(eat + 2);
  assert.equal(near.eaten, false, 'not eaten just outside it');
  assert.equal(near.moved, true, 'but pulled toward the head');
  const far = at(reach + 5);
  assert.deepEqual(far, { eaten: false, moved: false }, 'left alone beyond the pull reach');
});

// #9: the eating sound listens for 'eat', emitted for the player's worm only.
test('eating food emits eat for the player only (#9)', () => {
  const game = new Game({ botCount: 5 });
  game.powerups = []; game.specials = [];
  const p = new Worm({ name: 'Me', skin: SKINS[0], mass: 100, x: 0, y: 0, angle: 0, worldR: game.R, shield: 1e9, isPlayer: true });
  const b = new Worm({ name: 'Bot', skin: SKINS[0], mass: 100, x: 1000, y: 0, angle: 0, worldR: game.R, shield: 1e9 });
  game.worms = [p, b];
  const food = (x, y, r) => ({ x, y, v: 4, r, c: '#fff', life: Infinity, ph: 0, dead: false, natural: true });
  game.food = [food(p.sx[0], p.sy[0], 5), food(p.sx[0] + 2, p.sy[0], 9), food(b.sx[0], b.sy[0], 7)];
  game.rebuildFoodGrid();
  const eats = [], specials = [];
  game.on('eat', (e) => eats.push(e));
  game.on('special', (e) => specials.push(e));
  game.eatFood(1 / 60);
  assert.ok(game.food.every((f) => f.dead), 'all three pieces eaten');
  assert.deepEqual(eats.map((e) => [e.worm.name, e.r]).sort(), [['Me', 5], ['Me', 9]], 'one eat per piece the player ate, none for the bot');
  game.specials = [{ x: p.sx[0], y: p.sy[0], kind: 'nova', life: 10, ph: 0, dead: false }];
  eats.length = 0;
  game.eatSpecials(1 / 60);
  assert.equal(specials.length, 1, 'special food emits special');
  assert.equal(eats.length, 0, 'and not eat');
});

// #14: skins are saved by position, so rewards are appended; bots pick only the 24 free skins.
test('unlockable skins are appended and never worn by bots (#14)', () => {
  const before = ['Cherry Pop', 'Lagoon', 'Lime Ocean', 'Holo', 'Candy Cane', 'Bumblebee', 'Neon Night', 'Mint', 'Ghost', 'Sailor',
    'Tangerine', 'Emerald', 'Grape', 'Lava', 'Aurora', 'Sunset Drive', 'Synthwave', 'Toxic', 'Gold Rush', 'Chrome', 'Ladybug', 'Leopard',
    'Viper', 'Galaxy', 'Magma', 'Abyss'];
  assert.deepEqual(SKINS.slice(0, before.length).map((s) => s.name), before, 'every existing skin keeps its position');
  assert.deepEqual(SKINS.slice(before.length).map((s) => s.name), ['Inferno', 'Storm', 'Crystal', 'Galaxy Prime']);
  const rewards = Object.fromEntries(SKINS.filter((s) => s.unlock).map((s) => [s.name, s.unlock]));
  assert.deepEqual(rewards, { Holo: 'noodle', Ghost: 'firstbite', Inferno: 'hunter', Storm: 'marathon', Crystal: 'titan', 'Galaxy Prime': 'expert' });
  assert.ok(SKINS.filter((s) => s.unlock).every((s) => s.hidden), 'rewards are hidden until unlocked');
  assert.equal(PICKABLE_SKINS.length, 24);
  assert.ok(PICKABLE_SKINS.every((s) => !s.unlock && !s.hidden));
  const game = new Game({ botCount: 150 });
  assert.ok(game.worms.every((w) => !w.skin.unlock), 'no bot wears an unlockable skin');
  for (let i = 0; i < 300; i++) game.spawnBot(false);
  assert.ok(game.worms.every((w) => !w.skin.unlock), 'nor do respawned bots');
});

// #177: three levels; Hard is what was Expert, and old names keep loading.
test('three difficulty levels; Expert and Hard load as Hard (#177)', () => {
  assert.deepEqual(DIFFICULTIES, ['easy', 'normal', 'hard']);
  assert.equal(DIFFICULTY.hard.preyRatio, 2, 'Hard has what was Expert');
  assert.ok(DIFFICULTY.hard.sharp, 'including its sharpness');
  assert.deepEqual([difficultyOf('expert'), difficultyOf('hard'), difficultyOf('normal'), difficultyOf('nightmare'), difficultyOf('__proto__')], ['hard', 'hard', 'normal', null, null]);
  assert.equal(new Game({ botCount: 5, difficulty: 'expert' }).settings.difficulty, 'hard');
  for (const old of ['expert', 'hard']) {
    const snap = JSON.parse(JSON.stringify(new Game({ botCount: 5, difficulty: 'normal' })));
    snap.settings.difficulty = old;
    validateSnapshot(snap);
    const g = new Game(null, snap);
    assert.equal(g.settings.difficulty, 'hard', `a world saved on ${old} loads on hard`);
    assert.equal(JSON.parse(JSON.stringify(g)).settings.difficulty, 'hard', 'and is saved as hard');
  }
  const snap = JSON.parse(JSON.stringify(new Game({ botCount: 5 })));
  snap.settings.difficulty = 'nightmare';
  assert.throws(() => validateSnapshot(snap), /settings/, 'unknown names are still rejected');
});

test('a world created as expert plays exactly like one created as hard (#177)', () => {
  const run = (difficulty) => {
    const g = new Game({ botCount: 30, difficulty }, null, { seed: 31337 });
    for (let i = 0; i < 60 * 60; i++) g.update(1 / 60);
    const snap = JSON.parse(JSON.stringify(g));
    delete snap.savedAt; // the only thing that depends on the clock
    return snap;
  };
  assert.deepEqual(run('expert'), run('hard'));
});

test('bots hunt only worms lighter than their difficulty allows (#16)', () => {
  // A very aggressive bot thinks repeatedly next to one other worm: it may pick that worm
  // as prey only when the worm is lighter than preyRatio times the bot's mass.
  const hunts = (difficulty, preyMass) => {
    const game = new Game({ botCount: 5, difficulty });
    const bot = new Worm({ name: 'Hunter', skin: SKINS[0], mass: 200, x: 0, y: 0, angle: 0, worldR: game.R,
      ai: { skill: 1, aggro: 1, interval: 0.1, wx: 0, wy: 0, prey: null, huntUntil: 0 } });
    const other = new Worm({ name: 'Other', skin: SKINS[1], mass: preyMass, x: 250, y: 200, angle: 0, worldR: game.R });
    game.worms = [bot, other]; game.food = []; game.powerups = [];
    game.rebuildFoodGrid();
    game.rebuildSegGrid();
    for (let i = 0; i < 200 && !bot.ai.prey; i++) botThink(bot, game);
    return bot.ai.prey === other;
  };
  // Shadowing (#150) is the one way a bot goes after a worm above the limit, so it is off here.
  for (const difficulty of ['easy', 'normal', 'hard']) withTactics(difficulty, { shadow: 0 }, () => {
    const ratio = DIFFICULTY[difficulty].preyRatio;
    assert.equal(hunts(difficulty, 200 * ratio * 0.95), true, `${difficulty}: hunts a worm just under ${ratio}x`);
    assert.equal(hunts(difficulty, 200 * ratio * 1.05), false, `${difficulty}: leaves a worm just over ${ratio}x alone`);
  });
  assert.ok(DIFFICULTY.easy.preyRatio <= 1, 'easy bots never chase worms heavier than themselves');
});

// --- More bots (#81) ----------------------------------------------------------

test('the arena keeps its size up to 60 bots and grows by area above that (#81)', () => {
  for (let bots = 5; bots <= 60; bots++) assert.equal(arenaRadius(bots), 1800 + 60 * bots, `${bots} bots`);
  assert.equal(new Game({ botCount: 30 }).R, 3600);
  assert.ok(Math.abs(arenaRadius(150) - 8538) < 1, `150 bots: ${arenaRadius(150).toFixed(0)}`);
  for (let bots = 61; bots <= MAX_BOTS; bots++) {
    assert.ok(arenaRadius(bots) > arenaRadius(bots - 1), 'keeps growing');
    // Each bot beyond 60 adds the same area as the 60th did.
    const perBot = (Math.PI * arenaRadius(bots) ** 2) / bots;
    assert.ok(Math.abs(perBot / ((Math.PI * 5400 ** 2) / 60) - 1) < 1e-9, `${bots} bots: area per bot`);
  }
  // Food and power-ups are as dense in a 150-bot world as in a 30-bot one.
  const small = new Game({ botCount: 30 }), big = new Game({ botCount: 150 });
  const density = (g, n) => n / (Math.PI * g.R * g.R);
  assert.ok(Math.abs(density(big, big.foodTarget) / density(small, small.foodTarget) - 1) < 0.01, 'food density');
  assert.ok(Math.abs(density(big, big.powerupTarget) / density(small, small.powerupTarget) - 1) < 0.02, 'power-up density');
  assert.equal(big.worms.filter((w) => w.ai).length, 150);
});

test('a 150-bot world saves, validates and restores; 151 bots is rejected (#81)', () => {
  const g = new Game({ botCount: MAX_BOTS, difficulty: 'normal' });
  for (let i = 0; i < 120; i++) g.update(1 / 60);
  const snap = clone(g);
  assert.doesNotThrow(() => validateSnapshot(snap));
  const g2 = new Game(null, snap);
  assert.equal(g2.R, g.R);
  assert.equal(g2.worms.length, g.worms.length);
  assert.doesNotThrow(() => validateSnapshot(clone(g2)), 'and saves again');
  const tooMany = clone(snap);
  tooMany.settings.botCount = MAX_BOTS + 1;
  assert.throws(() => validateSnapshot(tooMany), /settings/);
});

// --- Massive growth (#82) -------------------------------------------------------

test('worms shed only above 2,000,000 mass, at 0.2% of the excess per second (#82, #204)', () => {
  const g = { addFood() {} };
  const shedOver = (mass, seconds) => {
    const w = new Worm({ name: 'Big', skin: SKINS[0], mass, x: 0, y: 0, angle: 0, worldR: 1e5 });
    for (let i = 0; i < seconds * 60; i++) w.update(1 / 60, g);
    return mass - w.mass;
  };
  assert.ok(Math.abs(shedOver(3000000, 1) - 2000) < 5, `3,000,000 loses about 2,000 a second (${shedOver(3000000, 1).toFixed(2)})`);
  assert.equal(shedOver(2000000, 2), 0);
  assert.equal(shedOver(1000000, 2), 0, 'a million-mass worm keeps its mass');
  assert.equal(shedOver(20000, 2), 0, 'worms that used to shed above 10,000 keep their mass');
  assert.equal(shedOver(5000, 2), 0, 'mid-size worms keep their mass');
});

test('above 10,000 worms grow mostly thicker; sizes below are unchanged (#82)', () => {
  // Below 10,000: the curves from before #82.
  for (const m of [15, 100, 1500, 5000, 9999, 10000]) {
    assert.equal(radiusFor(m), Math.min(62, 9 + 2.2 * Math.pow(m, 0.3)), `radius at ${m}`);
    assert.equal(lengthFor(m), 40 + 9 * Math.pow(m, 0.72), `length at ${m}`);
  }
  // Continuous and increasing above it.
  assert.ok(Math.abs(lengthFor(10000.001) - lengthFor(10000)) < 0.01);
  for (let m = 10000; m < 200000; m += 5000) {
    assert.ok(lengthFor(m + 5000) > lengthFor(m) && radiusFor(m + 5000) >= radiusFor(m), `grows at ${m}`);
  }
  assert.ok(radiusFor(50000) > 62, `radius at 50,000 is ${radiusFor(50000).toFixed(1)}`);
  assert.ok(lengthFor(50000) < 2 * lengthFor(10000), 'less than twice as long as at 10,000');
  assert.ok(lengthFor(50000) < 2 * Math.PI * new Game({ botCount: 30 }).R, "shorter than a 30-bot arena's edge");
});

test('worms in the millions keep thickening and barely lengthen (#204)', () => {
  const edge = 2 * Math.PI * new Game({ botCount: 30 }).R;
  const near = (v, want, tol, what) => assert.ok(Math.abs(v - want) <= tol, `${what} is ${v.toFixed(1)}, want about ${want}`);
  near(radiusFor(1e5), 79, 1, 'radius at 100,000');
  near(radiusFor(1e6), 148, 1, 'radius at 1,000,000');
  near(radiusFor(3e6), 202, 2, 'radius at 3,000,000');
  assert.equal(radiusFor(1e12), 300, 'capped at 300');
  // Unchanged up to 100,000, then flat-ish and continuous.
  near(lengthFor(1e5), (40 + 9 * Math.pow(1e4, 0.72)) * Math.pow(10, 0.4), 0.01, 'length at 100,000 (as before #204)');
  near(lengthFor(1e6), 20700, 100, 'length at 1,000,000');
  assert.ok(Math.abs(lengthFor(1e5 + 0.001) - lengthFor(1e5)) < 0.01, 'continuous at 100,000');
  assert.ok(lengthFor(1e6) < 1.25 * lengthFor(1e5), `less than 25% longer from 100,000 to 1,000,000 (${(lengthFor(1e6) / lengthFor(1e5)).toFixed(3)})`);
  assert.ok(lengthFor(1e6) < edge, `a 1,000,000 worm (${lengthFor(1e6).toFixed(0)}) is shorter than a 30-bot arena's edge (${edge.toFixed(0)})`);
  for (let m = 1e5; m < 1e7; m *= 1.5) assert.ok(lengthFor(m * 1.5) > lengthFor(m) && radiusFor(m * 1.5) > radiusFor(m), `grows at ${m}`);
});

test('a 100,000-mass worm stays within the save limits and round-trips (#82)', () => {
  const g = new Game({ botCount: 30, difficulty: 'normal' });
  const big = g.worms.find((w) => w.ai);
  big.mass = 100000;
  big.shield = 1e6; // can't die during the test
  for (let i = 0; i < 60; i++) g.update(1 / 60); // the body grows to its new length
  assert.equal(big.dead, false);
  const snap = clone(g);
  assert.doesNotThrow(() => validateSnapshot(snap));
  const saved = snap.worms.find((w) => w.id === big.id);
  const back = new Game(null, snap).worms.find((w) => w.id === big.id);
  assert.ok(Math.abs(back.mass - saved.mass) < 1);
  assert.ok(back.sx.length > 400 && back.sx.length < 2000, `${back.sx.length} segments`);
});

test('a worm that keeps eating can hold massive size (#82)', () => {
  // A steady intake of 60 mass a second, balanced only by shedding.
  const g = { addFood() {} };
  const w = new Worm({ name: 'Feeder', skin: SKINS[0], mass: 30000, x: 0, y: 0, angle: 0, worldR: 1e6 });
  for (let i = 0; i < 60 * 60; i++) { w.mass += 1; w.update(1 / 60, g); }
  assert.ok(w.mass > 30000, `holds ${w.mass.toFixed(0)} after a minute (the old shedding left it near 16,500)`);
});

test('a world replays exactly from its seed, and the seed is not saved (#100)', () => {
  const run = (seed) => {
    const g = new Game({ botCount: 12, difficulty: 'hard' }, null, { seed });
    g.spawnPlayer('You', 0);
    for (let i = 0; i < 60 * 20; i++) g.update(1 / 60); // 20 simulated seconds: bots think, fight, die and respawn
    const snap = g.toJSON();
    delete snap.savedAt;
    return JSON.stringify(snap);
  };
  const a = run(1234);
  assert.equal(run(1234), a, 'same seed, same world');
  assert.notEqual(run(1235), a, 'another seed, another world');
  // Worlds in one process don't disturb each other: interleaving two keeps both on their seed.
  const g1 = new Game({ botCount: 8 }, null, { seed: 7 }), g2 = new Game({ botCount: 8 }, null, { seed: 7 });
  new Game({ botCount: 8 }); // an unseeded world in between
  for (let i = 0; i < 600; i++) { g1.update(1 / 60); g2.update(1 / 60); }
  const strip = (g) => { const s = g.toJSON(); delete s.savedAt; return JSON.stringify(s); };
  assert.equal(strip(g1), strip(g2));
  assert.ok(!('seed' in new Game({ botCount: 5 }, null, { seed: 9 }).toJSON()));
});

test('a worm built outside a world never shares an id with the world\'s own worms (#100)', () => {
  const game = new Game({ botCount: 5 }, null, { seed: 3 });
  game.worms.push(new Worm({ name: 'Extra', skin: SKINS[0], mass: 15, x: 0, y: 0, angle: 0, worldR: game.R, isPlayer: true }));
  for (let i = 0; i < 5; i++) game.spawnBot(false);
  const ids = game.worms.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.doesNotThrow(() => validateSnapshot(JSON.parse(JSON.stringify(game.toJSON()))), 'still saves');
});

test('boosting costs (1.5 + 0.25% of mass) a second, at most 150, and 60% of it drops as food (#125, #204)', () => {
  let dropped = 0;
  const g = { rng: Math.random, addFood(x, y, v) { dropped += v; } };
  const w = new Worm({ name: 'B', skin: SKINS[0], mass: 3000, x: 0, y: 0, angle: 0, worldR: 5000 });
  w.wantBoost = true;
  for (let i = 0; i < 60; i++) w.update(1 / 60, g);
  const lost = 3000 - w.mass;
  assert.ok(w.boosting, 'boosting');
  assert.ok(Math.abs(lost - 9) < 0.1, `loses about 9 a second at mass 3000 (lost ${lost.toFixed(2)})`);
  assert.ok(Math.abs(dropped + w.dropAcc - 0.6 * lost) < 1e-6, `drops 60% of it (${(dropped + w.dropAcc).toFixed(2)})`);
  // Small worms pay the base: 1.5 + 0.05 a second at mass 20.
  const s = new Worm({ name: 'S', skin: SKINS[0], mass: 20, x: 0, y: 0, angle: 0, worldR: 5000 });
  s.wantBoost = true;
  for (let i = 0; i < 60; i++) s.update(1 / 60, g);
  assert.ok(Math.abs(20 - s.mass - 1.55) < 0.01, `about 1.55 a second at mass 20 (lost ${(20 - s.mass).toFixed(3)})`);
  // A giant pays the ceiling, not 0.25% of its mass.
  dropped = 0;
  const gi = new Worm({ name: 'G', skin: SKINS[0], mass: 1e6, x: 0, y: 0, angle: 0, worldR: 1e5 });
  gi.wantBoost = true;
  for (let i = 0; i < 60; i++) gi.update(1 / 60, g);
  const gLost = 1e6 - gi.mass;
  assert.ok(Math.abs(gLost - 150) < 0.5, `loses 150 a second at mass 1,000,000 (lost ${gLost.toFixed(2)})`);
  assert.ok(Math.abs(dropped + gi.dropAcc - 0.6 * gLost) < 1e-6, `drops 90 of it (${(dropped + gi.dropAcc).toFixed(2)})`);
  // A worm too small to boost still can't.
  const t = new Worm({ name: 'T', skin: SKINS[0], mass: 12, x: 0, y: 0, angle: 0, worldR: 5000 });
  t.wantBoost = true;
  t.update(1 / 60, g);
  assert.equal(t.boosting, false);
});

// --- Special food (#143) ---------------------------------------------------------------
// A world with nothing in it but special food, so nothing gets eaten and nobody respawns.
function emptyWorld(seed, botCount = 30) {
  const game = new Game({ botCount }, null, { seed });
  Object.assign(game, { worms: [], respawnQueue: [], food: [], powerups: [], naturalFood: 0, foodTarget: 0, powerupTarget: 0, player: null });
  game.settings.botCount = 0;
  game.rebuildFoodGrid();
  return game;
}

test('special food: about 5 in a 30-bot world, scaled to the arena (#143)', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(SPECIALS).map(([k, s]) => [k, s.value])), { nova: 25, nebula: 50, plasma: 100 });
  const small = new Game({ botCount: 30 }), big = new Game({ botCount: 150 });
  assert.equal(small.specialTarget, 5);
  assert.ok(big.specialTarget >= 27 && big.specialTarget <= 29, `150 bots: ${big.specialTarget}`);
  const density = (g) => g.specialTarget / (Math.PI * g.R * g.R);
  assert.ok(Math.abs(density(big) / density(small) - 1) < 0.05, 'same density');
  assert.equal(small.specials.length, 0, 'a new world starts without special food');
});

test('special food spawns inside the arena, never above the target, and vanishes after 20 s (#143)', () => {
  const game = emptyWorld(7);
  let most = 0;
  for (let i = 0; i < 60 * 60; i++) {
    game.update(1 / 60);
    most = Math.max(most, game.specials.length);
    for (const p of game.specials) assert.ok(Math.hypot(p.x, p.y) <= game.R * 0.9 + 1e-6, 'inside the arena');
  }
  assert.ok(most <= 5, `never more than 5 (saw ${most})`);
  assert.ok(game.specials.length >= 3 && game.specials.length <= 5, `${game.specials.length} after a minute`);
  assert.ok(game.specials.every((p) => p.life > 0 && p.life <= CFG.SPECIAL_LIFE));

  // One nobody eats is gone 20 seconds after it appeared, and the arena refills within seconds.
  const lone = emptyWorld(8);
  lone.specialTarget = 0;
  lone.spawnSpecial();
  const p = lone.specials[0];
  for (let i = 0; i < 19.9 * 60; i++) lone.update(1 / 60);
  assert.ok(lone.specials.includes(p), 'still there just before 20 s');
  for (let i = 0; i < 0.2 * 60; i++) lone.update(1 / 60);
  assert.ok(!lone.specials.includes(p), 'gone after 20 s');

  const refill = emptyWorld(12);
  for (let i = 0; i < 30 * 60; i++) refill.update(1 / 60);
  const before = refill.specials.length;
  assert.ok(before >= 4, `filled up (${before})`);
  refill.specials.shift();
  let waited = 0;
  while (refill.specials.length < before && waited < 30) { refill.update(1 / 60); waited += 1 / 60; }
  assert.ok(waited < 15, `refilled after ${waited.toFixed(1)} s`);
});

test('special food kinds follow the 60/30/10 split (#143)', () => {
  const game = emptyWorld(11);
  const n = 20000, count = { nova: 0, nebula: 0, plasma: 0 };
  for (let i = 0; i < n; i++) game.spawnSpecial();
  for (const p of game.specials) count[p.kind]++;
  assert.ok(Math.abs(count.nova / n - 0.6) < 0.02, `nova ${count.nova}`);
  assert.ok(Math.abs(count.nebula / n - 0.3) < 0.02, `nebula ${count.nebula}`);
  assert.ok(Math.abs(count.plasma / n - 0.1) < 0.02, `plasma ${count.plasma}`);
});

test('special food spawns at the same pace at any update rate (#143, #48)', () => {
  // A target of 50 spawns 3 a second, far from full within 5 seconds, and none expire yet.
  const pace = (hz) => {
    let total = 0;
    for (let s = 0; s < 40; s++) {
      const game = emptyWorld(100 + s);
      game.specialTarget = 50;
      for (let i = 0; i < hz * 5; i++) game.update(1 / hz);
      total += game.specials.length;
    }
    return total / 40;
  };
  for (const hz of [30, 60, 120]) {
    const p = pace(hz);
    assert.ok(p > 12.5 && p < 17.5, `${hz} updates/s: ${p.toFixed(1)} in 5 s, expected about 15`);
  }
});

function eatingScene(kind, opts = {}) {
  const game = emptyWorld(5);
  game.specialTarget = 0;
  const w = new Worm({ name: 'Eater', skin: SKINS[0], mass: 100, x: 0, y: 0, angle: 0, worldR: game.R, isPlayer: true, shield: 1e9 });
  Object.assign(w.pw, opts.pw || {});
  game.worms = [w];
  game.player = w;
  const p = { x: opts.x ?? 60, y: opts.y ?? 0, kind, life: CFG.SPECIAL_LIFE, ph: 0, dead: false };
  game.specials = [p];
  game.rebuildSegGrid();
  const events = [];
  game.on('special', (e) => events.push(e));
  return { game, w, p, events };
}

test('eating special food gives its value, without x2/x5, and fires one event (#143)', () => {
  for (const [kind, value] of [['nova', 25], ['nebula', 50], ['plasma', 100]]) {
    const { game, w, p, events } = eatingScene(kind);
    const m0 = w.mass, e0 = w.eaten;
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    assert.ok(p.dead && !game.specials.includes(p), `${kind} eaten`);
    assert.ok(Math.abs(w.mass - m0 - value) < 0.5, `${kind}: +${(w.mass - m0).toFixed(2)}, expected +${value}`);
    assert.equal(w.eaten, e0 + 1);
    assert.equal(events.length, 1);
    assert.deepEqual({ worm: events[0].worm, kind: events[0].kind, value: events[0].value }, { worm: w, kind, value });
  }
  const { game, w } = eatingScene('plasma', { pw: { x5: 10 } });
  const m0 = w.mass;
  for (let i = 0; i < 30; i++) game.update(1 / 60);
  assert.ok(Math.abs(w.mass - m0 - 100) < 0.5, `x5 doesn't apply: +${(w.mass - m0).toFixed(2)}`);
});

test('the magnet pulls special food in from far away (#143)', () => {
  const pass = (magnet) => {
    const { game, p } = eatingScene('nebula', { x: 150, y: 200, pw: { magnet: magnet ? 10 : 0 } });
    for (let i = 0; i < 50; i++) game.update(1 / 60);
    return { eaten: p.dead, moved: p.x !== 150 || p.y !== 200 };
  };
  assert.equal(pass(true).eaten, true);
  assert.deepEqual(pass(false), { eaten: false, moved: false });
});

test('bots go for special food over nearby regular food (#143)', () => {
  const { game, worms: [bot] } = scene('normal', withFood([
    { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
  ], [{ x: 150, y: 0 }, { x: 160, y: 10 }, { x: 160, y: -10 }]));
  game.specials = [{ x: 0, y: 250, kind: 'plasma', life: 10, ph: 0, dead: false }];
  botThink(bot, game);
  assert.equal(bot.ai.mode, 'food');
  // Sampled headings land near, not exactly on, the straight line (pi/2) to the sphere.
  assert.ok(bot.targetAngle > 0.9 && bot.targetAngle < 2.2, `heads for the sphere (${bot.targetAngle.toFixed(2)})`);
  // Without it, the same bot goes for the food ahead.
  game.specials = [];
  botThink(bot, game);
  assert.ok(Math.abs(bot.targetAngle) < 0.3, `heads for the food (${bot.targetAngle.toFixed(2)})`);
});

test('special food is saved with the world; saves without it load; bad ones are rejected (#143)', () => {
  const snap = fixture().world;
  assert.equal(snap.specials, undefined, 'the fixture predates special food');
  assert.equal(new Game(null, snap).specials.length, 0);

  snap.specials = [{ x: 120, y: -340, kind: 'nebula', life: 12, ph: 1.5 }];
  assert.doesNotThrow(() => validateSnapshot(snap));
  const g = new Game(null, snap);
  const again = clone(g);
  assert.doesNotThrow(() => validateSnapshot(again));
  assert.deepEqual(again.specials, [{ x: 120, y: -340, kind: 'nebula', life: 12, ph: 1.5 }]);
  // It disappears about 12 seconds later, if nobody eats it.
  const d = g.specials[0];
  Object.assign(g, { worms: [], player: null, respawnQueue: [], specialTarget: 0 });
  const bots = g.settings.botCount;
  g.settings.botCount = 0;
  for (let i = 0; i < 11.9 * 60; i++) g.update(1 / 60);
  assert.ok(g.specials.includes(d), 'still there at 11.9 s');
  for (let i = 0; i < 0.2 * 60; i++) g.update(1 / 60);
  assert.ok(!g.specials.includes(d), 'gone at 12.1 s');

  // An item about to vanish still saves as valid.
  g.settings.botCount = bots;
  g.specials = [{ x: 0, y: 0, kind: 'nova', life: 0.01, ph: 0, dead: false }];
  assert.doesNotThrow(() => validateSnapshot(clone(g)));

  // A longer life than SPECIAL_LIFE (say, saved before the constant was tuned down) loads, clamped.
  const long = fixture().world;
  long.specials = [{ x: 0, y: 0, kind: 'plasma', life: 45, ph: 0 }];
  assert.doesNotThrow(() => validateSnapshot(long));
  assert.equal(new Game(null, long).specials[0].life, CFG.SPECIAL_LIFE);

  const bad = (specials) => { const s = fixture().world; s.specials = specials; return () => validateSnapshot(s); };
  const ok = { x: 0, y: 0, kind: 'nova', life: 5, ph: 0 };
  assert.doesNotThrow(bad([ok]));
  assert.doesNotThrow(bad([]));
  for (const [why, specials] of [
    ['not an array', { 0: ok }],
    ['unknown kind', [{ ...ok, kind: 'ruby' }]],
    ['prototype key', [{ ...ok, kind: '__proto__' }]],
    ['prototype key', [{ ...ok, kind: 'toString' }]],
    ['too many', Array.from({ length: 201 }, () => ok)],
    ['life 0', [{ ...ok, life: 0 }]],
    ['life absurdly long', [{ ...ok, life: 1e7 }]],
    ['life NaN', [{ ...ok, life: NaN }]],
    ['far outside', [{ ...ok, x: 1e9 }]],
    ['phase', [{ ...ok, ph: 'a' }]],
    ['not an object', [null]],
  ]) assert.throws(bad(specials), /special food/, why);
});

test('a world with special food keeps producing valid saves and replays from its seed (#143, #31, #100)', () => {
  const run = (seed) => {
    const g = new Game({ botCount: 10, difficulty: 'hard' }, null, { seed });
    g.spawnPlayer('Tester', 0);
    let eaten = 0;
    g.on('special', () => eaten++);
    for (let i = 0; i < 90 * 60; i++) {
      if (!g.player) g.spawnPlayer('Tester', 0);
      g.update(1 / 60);
      if (i % 600 === 0) {
        const s = clone(g);
        assert.doesNotThrow(() => validateSnapshot(s));
        assert.doesNotThrow(() => validateSnapshot(clone(new Game(null, s))));
      }
    }
    return { eaten, specials: clone(g.specials), mass: g.worms.map((w) => w.mass) };
  };
  const a = run(321), b = run(321);
  assert.deepEqual(a, b, 'replays exactly');
  assert.ok(a.eaten > 0, 'worms ate some special food');
});

// --- A body under your own (#155) ---------------------------------------------------

// A big worm A (mass 1000) with its head at (0, 30) heading down onto a small worm B's body, which
// runs along y = 0 (B's head at (200, 0), heading +x). A's neck goes up from its head; the rest of
// its body lies along y = 0 over B's body from x = -150 to 150 (`over`), and far away beyond that.
function underScene(over, level = 'normal') {
  const s = scene(level, [
    { name: 'A', mass: 1000, x: 0, y: 30, angle: -Math.PI / 2 },
    { name: 'B', mass: 100, x: 200, y: 0, angle: 0 },
  ]);
  const [a] = s.worms, sp = a.r * 0.42;
  for (let i = 0; i < a.sx.length; i++) {
    const x = -150 + (i - 10) * sp, onB = over && x <= 150; // over B's body, short of B's head at x = 200
    if (i < 10) { a.sx[i] = 0; a.sy[i] = 30 + i * sp; } else { a.sx[i] = x; a.sy[i] = onB ? 0 : 900; }
  }
  a.updateBounds();
  s.game.rebuildSegGrid();
  return s;
}

test('a head does not die on a smaller worm\'s body where its own body lies over it (#155)', () => {
  const collide = (over) => {
    const { game, worms: [a, b] } = underScene(over);
    const dead = [];
    game.on('death', (e) => dead.push(e.victim.name));
    game.checkCollisions();
    return dead;
  };
  assert.deepEqual(collide(true), [], 'A lies on top of B there: it survives');
  assert.deepEqual(collide(false), ['A'], 'without its own body there, A dies as before');
  // A smaller worm's head on a bigger worm's body still dies, whatever lies under it.
  const { game, worms: [a, b] } = underScene(true);
  b.sx[0] = a.sx[20]; b.sy[0] = a.sy[20] + 10;
  game.rebuildSegGrid();
  const dead = [];
  game.on('death', (e) => dead.push(e.victim.name));
  game.checkCollisions();
  assert.deepEqual(dead, ['B']);
});

test('bots treat a smaller body under their own as clear, like the collision rule (#155)', () => {
  // A is a bot after food straight below it, across B's body.
  const heading = (over) => withTactics('hard', { ...Object.fromEntries(Object.keys(DIFFICULTY.hard.tactics).map((k) => [k, 0])) }, () => {
    const s = underScene(over, 'hard');
    const [a] = s.worms;
    a.ai = { skill: 1, aggro: 0, interval: 0.1, wx: 0, wy: -300, prey: null, huntUntil: 0 };
    s.game.food.push({ x: 0, y: -250, v: 8, r: 6, c: '#fff', life: Infinity, ph: 0, dead: false, natural: true });
    s.game.rebuildFoodGrid();
    botThink(a, s.game);
    return a.targetAngle;
  });
  assert.ok(Math.abs(heading(true) + Math.PI / 2) < 0.05, `straight down across the covered body (${heading(true).toFixed(2)})`);
  assert.ok(Math.abs(heading(false) + Math.PI / 2) > 0.1, `around B's body when it isn't covered (${heading(false).toFixed(2)})`);
});

// --- Game modes (#12) ---------------------------------------------------------

// A world with a live, shielded player (so nothing but the clock can end the run), advanced by `secs` of game time.
const modeWorld = (mode, extra = {}, seed = 7) => {
  const g = new Game({ botCount: 30, difficulty: 'normal', mode, ...extra }, null, { seed });
  const p = g.spawnPlayer('Tester', 0);
  p.shield = 1e6;
  return { g, p };
};
const warp = (g, secs) => { g.time += secs; };

test('a mode is saved with the world; worlds and saves from before modes are Classic (#12)', () => {
  assert.equal(new Game({ botCount: 10, difficulty: 'easy' }).settings.mode, 'classic');
  assert.equal(new Game({ botCount: 10, difficulty: 'easy', mode: 'nonsense' }).settings.mode, 'classic', 'an unknown mode in the settings falls back');
  for (const mode of ['classic', 'timed', 'survival']) {
    const snap = clone(new Game({ botCount: 10, difficulty: 'easy', mode }));
    assert.equal(snap.settings.mode, mode);
    assert.equal(new Game(null, snap).settings.mode, mode, `${mode} round-trips`);
  }
  const save = fixture();
  assert.equal(save.world.settings.mode, undefined, 'the fixture predates modes');
  assert.doesNotThrow(() => validateSnapshot(save.world));
  assert.equal(new Game(null, save.world).settings.mode, 'classic');
  const bad = clone(save.world);
  bad.settings.mode = 'zen';
  assert.throws(() => validateSnapshot(bad), /mode/);
  assert.throws(() => new Game(null, bad), /mode/);
});

test('the Timed clock and the Survival level come from game time, and survive a save (#12)', () => {
  const { g, p } = modeWorld('survival');
  const levelAt = (secs) => { g.time = p.born + secs; return g.survivalLevel(); };
  assert.deepEqual([0, 59, 59.9, 60, 61, 125, 600].map(levelAt), [1, 1, 1, 2, 2, 3, 11]);
  g.time = p.born + 125;
  assert.equal(g.matchTime(p), 125);
  const again = new Game(null, clone(g));
  assert.equal(again.matchTime(again.player), 125, 'the same match time after a save');
  assert.equal(again.survivalLevel(), 3);
  // Held at its last value after the player dies.
  g.kill(p, null, 'quit');
  g.time += 500;
  assert.equal(g.survivalLevel(), 3);
  const { g: classic } = modeWorld('classic');
  warp(classic, 900);
  assert.equal(classic.survivalLevel(), 1, 'Classic has no levels');
});

test('a Timed match ends when the clock reaches zero, with the rank taken before the worm is removed (#12)', () => {
  const run = (mass) => {
    const { g, p } = modeWorld('timed');
    p.mass = p.peak = mass;
    const events = [];
    g.on('death', (e) => events.push(e));
    warp(g, 299.9);
    g.update(0.05);
    assert.equal(events.length, 0, 'not before 5:00');
    assert.ok(g.player && !p.dead);
    g.update(0.1);
    return { events, g, p };
  };
  const top = run(1e6);
  assert.equal(top.events.length, 1);
  const e = top.events[0];
  assert.equal(e.cause, 'time');
  assert.equal(e.killer, null);
  assert.equal(e.victim, top.p);
  assert.equal(e.rank, 1);
  assert.equal(e.total, 31, '30 bots and the player');
  assert.equal(top.g.player, null, 'the run is over');
  assert.ok(top.g.food.length > 0 && top.p.dead);
  assert.equal(run(15).events[0].rank, 31, 'last place');
  // A middle rank: exactly 4 bots heavier.
  const { g, p } = modeWorld('timed');
  const masses = g.worms.filter((w) => w.ai).map((w) => w.mass).sort((a, b) => b - a);
  p.mass = p.peak = (masses[3] + masses[4]) / 2;
  const got = [];
  g.on('death', (ev) => got.push(ev));
  warp(g, 300);
  g.update(1 / 60);
  assert.equal(got[0].rank, 5, 'four worms are bigger');
});

test('the clock only ends Timed matches, and only for a living player (#12)', () => {
  for (const mode of ['classic', 'survival']) {
    const { g } = modeWorld(mode);
    const causes = [];
    g.on('death', (e) => causes.push(e.cause));
    warp(g, 400);
    g.update(1 / 60);
    assert.ok(!causes.includes('time'), `${mode} has no time limit`);
    assert.ok(g.player);
  }
  const { g, p } = modeWorld('timed');
  p.shield = 0;
  const causes = [];
  g.on('death', (e) => causes.push(e.cause));
  g.kill(p, null, 'wall');
  warp(g, 400);
  g.update(1 / 60);
  assert.deepEqual(causes, ['wall'], 'a player who already died is not ended again');
});

test('Timed and Survival worlds start even: no starting giants or big bots (#12)', () => {
  const masses = (mode) => new Game({ botCount: 30, difficulty: 'hard', mode }, null, { seed: 3 }).worms.map((w) => w.mass);
  assert.ok(masses('classic').filter((m) => m > 200).length >= 3, 'Classic keeps its giants');
  for (const mode of ['timed', 'survival']) {
    const m = masses(mode);
    assert.equal(m.length, 30);
    assert.ok(m.every((x) => x >= 15 && x <= 200), `${mode}: every bot between 15 and 200 (max ${Math.max(...m)})`);
  }
});

test('a Classic world replays exactly the same whether or not it names its mode (#12)', () => {
  const a = new Game({ botCount: 20, difficulty: 'hard' }, null, { seed: 11 });
  const b = new Game({ botCount: 20, difficulty: 'hard', mode: 'classic' }, null, { seed: 11 });
  for (let i = 0; i < 600; i++) { a.update(1 / 60); b.update(1 / 60); }
  assert.deepEqual(a.worms.map((w) => [w.name, Math.round(w.mass), Math.round(w.sx[0])]), b.worms.map((w) => [w.name, Math.round(w.mass), Math.round(w.sx[0])]));
});

test('a Survival world at its bot cap saves and restores (#12)', () => {
  for (const [bots, cap] of [[30, 60], [150, 150]]) {
    const { g, p } = modeWorld('survival', { botCount: bots });
    g.time = p.born + 20 * 60; // level 21
    for (let i = 0; i < 6 * 60; i++) g.update(1 / 60); // replacements arrive 1-3 s after the target rises
    // Bots that die are replaced 1-3 s later, so the world holds the cap between its living bots and its queue.
    const held = (w) => w.worms.filter((x) => x.ai).length + w.respawnQueue.length;
    assert.equal(held(g), cap, `${bots} configured: ${cap} bots`);
    const snap = clone(g);
    assert.equal(snap.settings.botCount, bots, 'the arena is still sized by the configured count');
    assert.ok(snap.worms.length <= 200 && snap.respawnQueue.length <= 500);
    assert.doesNotThrow(() => validateSnapshot(snap));
    const back = new Game(null, snap);
    assert.equal(held(back), cap);
    assert.equal(back.survivalLevel(), g.survivalLevel());
    assert.equal(back.botTarget(), cap);
    for (let i = 0; i < 120; i++) back.update(1 / 60);
    assert.ok(held(back) <= cap, 'never above the cap');
  }
});
