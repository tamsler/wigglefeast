// Engine tests: the world, saves, food, power-ups and growth. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../engine.js');
const { Game, Worm, SKINS, DIFFICULTY, MAX_BOTS, arenaRadius, CFG, radiusFor, lengthFor, botThink, validateSnapshot } = globalThis.WormEngine;
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
      'mass that outgrows the body limit': (s) => { s.worms[0].mass = 1e7; },
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
  p.mass = 1e6;
  p.pw.x5 = 10;
  p.shield = 10;
  big.food.push(p.sx[0], p.sy[0], 1e6, 0, -1, 0, 1);
  const g2 = new Game(null, big);
  for (let i = 0; i < 5; i++) g2.update(1 / 60);
  assert.ok(g2.player && g2.player.mass <= 1e6, 'mass capped');
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
    ['Rainbow', ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93']], ['Candy Cane', ['#ffffff', '#ef233c']],
    ['Bumblebee', ['#2b2b2b', '#ffd60a']], ['Neon Night', ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0']],
    ['Mint', ['#2ec4b6', '#cbf3f0']], ['Lavender', ['#ffd6ff', '#e7c6ff', '#c8b6ff', '#b8c0ff']],
    ['Sailor', ['#e63946', '#f1faee', '#a8dadc', '#457b9d']], ['Tangerine', ['#ff9f1c', '#ffbf69', '#fff3e0']],
    ['Emerald', ['#06d6a0', '#118ab2']], ['Grape', ['#6a4c93', '#f15bb5']], ['Lava', ['#d00000', '#ffba08', '#dc2f02']],
  ];
  ORIGINAL.forEach(([name, colors], i) => {
    assert.equal(SKINS[i].name, name, `skin ${i}`);
    assert.deepEqual(SKINS[i].colors, colors, `${name} colours`);
    assert.equal(SKINS[i].finish, 'stripes', `${name} finish`);
    assert.deepEqual(SKINS[i].food, colors, `${name} drops its own colours, as before`);
  });
  assert.deepEqual(SKINS.slice(14).map((s) => s.name), ['Aurora', 'Sunset Drive', 'Synthwave', 'Toxic', 'Gold Rush', 'Chrome', 'Ladybug', 'Leopard', 'Viper', 'Galaxy', 'Magma', 'Abyss']);
  const hex = /^#[0-9a-f]{6}$/i;
  for (const s of SKINS) {
    assert.ok(['stripes', 'gradient', 'neon', 'metallic', 'spots', 'scales', 'galaxy', 'pulse'].includes(s.finish), `${s.name} finish`);
    assert.ok([...s.colors, s.accent, ...s.food].every((c) => hex.test(c)), `${s.name} colours are #rrggbb`);
  }
  assert.deepEqual(SKINS.filter((s) => s.hidden).map((s) => s.name), ['Rainbow', 'Lavender']);
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
    for (let i = 0; i < 6; i++) masses.push(...new Game({ botCount: 60, difficulty }).worms.map((w) => w.mass));
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

test('worms shed only above 10,000 mass, at 0.2% of the excess per second (#82)', () => {
  const g = { addFood() {} };
  const shedOver = (mass, seconds) => {
    const w = new Worm({ name: 'Big', skin: SKINS[0], mass, x: 0, y: 0, angle: 0, worldR: 1e5 });
    for (let i = 0; i < seconds * 60; i++) w.update(1 / 60, g);
    return mass - w.mass;
  };
  assert.ok(Math.abs(shedOver(20000, 1) - 20) < 0.2, `20,000 loses about 20 a second (${shedOver(20000, 1).toFixed(2)})`);
  assert.equal(shedOver(10000, 2), 0);
  assert.equal(shedOver(5000, 2), 0, 'mid-size worms (which used to shed above 1500) keep their mass');
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
  assert.ok(radiusFor(1e6) <= 90);
  assert.ok(lengthFor(50000) < 2 * lengthFor(10000), 'less than twice as long as at 10,000');
  assert.ok(lengthFor(50000) < 2 * Math.PI * new Game({ botCount: 30 }).R, "shorter than a 30-bot arena's edge");
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
    const g = new Game({ botCount: 12, difficulty: 'expert' }, null, { seed });
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

test('boosting costs (1.5 + 0.5% of mass) a second, and 60% of it drops as food (#125)', () => {
  let dropped = 0;
  const g = { rng: Math.random, addFood(x, y, v) { dropped += v; } };
  const w = new Worm({ name: 'B', skin: SKINS[0], mass: 3000, x: 0, y: 0, angle: 0, worldR: 5000 });
  w.wantBoost = true;
  for (let i = 0; i < 60; i++) w.update(1 / 60, g);
  const lost = 3000 - w.mass;
  assert.ok(w.boosting, 'boosting');
  assert.ok(Math.abs(lost - 16.5) < 0.1, `loses about 16.5 a second at mass 3000 (lost ${lost.toFixed(2)})`);
  assert.ok(Math.abs(dropped + w.dropAcc - 0.6 * lost) < 1e-6, `drops 60% of it (${(dropped + w.dropAcc).toFixed(2)})`);
  // Small worms pay the base: 1.5 + 0.1 a second at mass 20.
  const s = new Worm({ name: 'S', skin: SKINS[0], mass: 20, x: 0, y: 0, angle: 0, worldR: 5000 });
  s.wantBoost = true;
  for (let i = 0; i < 60; i++) s.update(1 / 60, g);
  assert.ok(Math.abs(20 - s.mass - 1.6) < 0.01, `about 1.6 a second at mass 20 (lost ${(20 - s.mass).toFixed(3)})`);
});

// --- Special food (#143) ---------------------------------------------------------------
const { SPECIALS } = globalThis.WormEngine;
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

  const refill = emptyWorld(9);
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
