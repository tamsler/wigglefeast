// Engine tests: run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../engine.js');
const { Game, Worm, SKINS, DIFFICULTY, botThink, validateSnapshot } = globalThis.WormEngine;

const clone = (o) => JSON.parse(JSON.stringify(o));
const fixture = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'save-v1.json'), 'utf8'));

function simulate(botCount, difficulty, seconds) {
  const g = new Game({ botCount, difficulty });
  let deaths = 0, wall = 0;
  g.on('death', (e) => { deaths++; if (!e.killer) wall++; });
  g.spawnPlayer('Tester', 0);
  const botSamples = [];
  let shortfalls = 0; // seconds where living + queued bots fell below the target
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < seconds * 60; i++) {
    if (g.player) { g.player.targetAngle += Math.sin(i / 50) * 0.05; g.player.wantBoost = i % 200 < 30; } else g.spawnPlayer('Tester', 1);
    g.update(1 / 60);
    if (i % 60 === 59) {
      const bots = g.worms.filter((w) => w.ai).length;
      botSamples.push(bots);
      if (bots + g.respawnQueue.length < botCount) shortfalls++;
    }
  }
  const msPerTick = Number(process.hrtime.bigint() - t0) / 1e6 / (seconds * 60);
  const avgBots = botSamples.reduce((a, b) => a + b, 0) / Math.max(1, botSamples.length);
  return { g, deaths, wall, msPerTick, avgBots, shortfalls };
}

test('simulation stays healthy on every difficulty', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    const { g, deaths, wall, msPerTick, avgBots, shortfalls } = simulate(40, diff, 60);
    for (const w of g.worms) {
      assert.ok(Number.isFinite(w.mass) && w.sx.every(Number.isFinite) && w.sy.every(Number.isFinite), `${diff}: worm ${w.name} has non-finite state`);
    }
    // Bots die often, so the live count dips while replacements wait 1-3 s to respawn.
    // What must hold: living + queued bots always cover the target, and no overshoot.
    assert.equal(shortfalls, 0, `${diff}: living + queued bots fell below 40`);
    assert.ok(g.worms.filter((w) => w.ai).length <= 40, `${diff}: more bots than configured`);
    assert.ok(avgBots >= 32, `${diff}: average ${avgBots.toFixed(1)} bots alive, expected at least 32 of 40`);
    assert.ok(wall <= Math.max(3, deaths * 0.1), `${diff}: ${wall}/${deaths} deaths were bots hitting the wall`);
    // Loose on purpose (locally ~0.4 ms): catches runaway slowdowns, not CI noise.
    assert.ok(msPerTick < 25, `${diff}: ${msPerTick.toFixed(2)} ms per tick is far too slow`);
  }
});

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
  // Ids are global to the engine, so aim just ahead of the next one it would hand out.
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
  const pass = (offset, magnet) => {
    const game = new Game({ botCount: 5 });
    game.worms = []; game.food = []; game.powerups = [];
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
  // Beside the path, close enough to brush the glow: it used to need head radius + 24 (~38).
  assert.equal(pass(55, false).collected, true);
  // Far beside the path: left alone without the magnet, pulled in with it.
  assert.deepEqual(pass(200, false), { collected: false, moved: false });
  assert.equal(pass(200, true).collected, true);
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

test('food and power-ups refill at the same pace at any update rate (#48)', () => {
  // Seeded random numbers, so the comparison doesn't depend on luck.
  const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const refill = (hz) => {
    const random = Math.random;
    Math.random = seeded(42);
    try {
      const game = new Game({ botCount: 5 });
      Object.assign(game, { worms: [], respawnQueue: [], food: [], powerups: [], naturalFood: 0, foodTarget: 1e6, powerupTarget: 1e6 });
      game.settings.botCount = 0;
      for (let i = 0; i < hz * 60; i++) game.update(1 / hz); // one simulated minute
      return { food: game.food.length, powerups: game.powerups.length };
    } finally { Math.random = random; }
  };
  const r60 = refill(60), r120 = refill(120), r30 = refill(30);
  // Natural food has a fixed budget: exactly 600 per simulated second at every rate.
  for (const r of [r30, r60, r120]) assert.equal(r.food, 600 * 60);
  // Power-ups are random: about 1.83 per second at every rate (expected ~110 per minute).
  for (const [hz, r] of [[30, r30], [60, r60], [120, r120]]) {
    assert.ok(r.powerups > 80 && r.powerups < 140, `${hz} updates/s: ${r.powerups} power-ups in a minute`);
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
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const ratio = DIFFICULTY[difficulty].preyRatio;
    assert.equal(hunts(difficulty, 200 * ratio * 0.95), true, `${difficulty}: hunts a worm just under ${ratio}x`);
    assert.equal(hunts(difficulty, 200 * ratio * 1.05), false, `${difficulty}: leaves a worm just over ${ratio}x alone`);
  }
  assert.ok(DIFFICULTY.easy.preyRatio <= 1, 'easy bots never chase worms heavier than themselves');
});
