// Engine tests: run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../engine.js');
const { Game, Worm, SKINS, DIFFICULTY, DIFFICULTIES, TACTICS, MAX_BOTS, arenaRadius, CFG, radiusFor, lengthFor, botThink, knowsTactic, predictHead, validateSnapshot } = globalThis.WormEngine;

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
  for (const diff of DIFFICULTIES) {
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

test('the biggest world on Expert stays within the tick budget (#78)', () => {
  const { g, msPerTick, shortfalls } = simulate(60, 'expert', 30);
  assert.ok(g.worms.every((w) => Number.isFinite(w.mass) && w.sx.every(Number.isFinite)), 'finite state');
  assert.equal(shortfalls, 0);
  // Same loose limit as above; locally about 0.7 ms.
  assert.ok(msPerTick < 25, `${msPerTick.toFixed(2)} ms per tick is far too slow`);
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

test('food and power-ups refill at the same pace at any update rate (#48)', () => {
  // A fixed seed, so the comparison doesn't depend on luck.
  const refill = (hz) => {
    const game = new Game({ botCount: 5 }, null, { seed: 42 });
    Object.assign(game, { worms: [], respawnQueue: [], food: [], powerups: [], naturalFood: 0, foodTarget: 1e6, powerupTarget: 1e6 });
    game.settings.botCount = 0;
    for (let i = 0; i < hz * 60; i++) game.update(1 / hz); // one simulated minute
    return { food: game.food.length, powerups: game.powerups.length };
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

// --- Bot tactics (#78) --------------------------------------------------------

test('every level has a full tactic table: none on easy, all on expert (#78)', () => {
  assert.deepEqual(DIFFICULTIES, ['easy', 'normal', 'hard', 'expert']);
  for (const level of DIFFICULTIES) assert.deepEqual(Object.keys(DIFFICULTY[level].tactics).sort(), TACTICS.slice().sort(), level);
  assert.ok(TACTICS.every((k) => DIFFICULTY.easy.tactics[k] === 0), 'easy knows nothing');
  assert.ok(TACTICS.every((k) => DIFFICULTY.expert.tactics[k] === 1), 'expert knows everything');
  assert.equal(DIFFICULTY.normal.tactics.coil + DIFFICULTY.normal.tactics.flank, 0, 'normal bots never coil or flank');
  assert.equal(DIFFICULTY.hard.tactics.flank, 0, 'flanking is expert-only');
  const masses = [];
  for (let i = 0; i < 6; i++) masses.push(...new Game({ botCount: 60, difficulty: 'expert' }).worms.map((w) => w.mass));
  const big = masses.filter((m) => m >= 400).length / masses.length;
  assert.ok(Math.abs(big - DIFFICULTY.expert.bigShare) < 0.08, `${(big * 100).toFixed(0)}% of expert bots start big`);
  assert.ok(Math.max(...masses) <= DIFFICULTY.expert.bigMax);
});

test('a bot keeps its tactics for life, and levels hand them out in their shares (#78)', () => {
  const g = new Game({ botCount: 40, difficulty: 'hard' });
  const known = (w) => TACTICS.filter((k) => knowsTactic(w, 'hard', k)).join();
  const before = new Map(g.worms.map((w) => [w.id, known(w)]));
  const g2 = new Game(null, clone(g));
  for (const w of g2.worms) assert.equal(known(w), before.get(w.id), `bot ${w.name} kept its tactics`);
  // Over 600 ids, the share knowing each tactic is near the table value.
  for (const k of TACTICS) {
    const share = DIFFICULTY.hard.tactics[k];
    let n = 0;
    for (let id = 1; id <= 600; id++) if (knowsTactic({ id }, 'hard', k)) n++;
    assert.ok(Math.abs(n / 600 - share) < 0.07, `hard ${k}: ${(n / 6).toFixed(0)}% know it, table says ${share * 100}%`);
  }
  assert.equal(knowsTactic({ id: 7 }, 'easy', 'evade'), false);
  assert.equal(knowsTactic({ id: 7 }, 'expert', 'flank'), true);
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
  const g = new Game({ botCount: 5, difficulty: 'expert' });
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
  const { game, worms: [big] } = scene('expert', [{ name: 'Big', mass: 2000, x: 0, y: 0, angle: 0 }], 30);
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

// A hand-built scene for bot tests: no food or power-ups, each worm laid out straight
// behind its head. Bots default to skill 1 and aggro 0 (they never pick prey by chance).
function scene(difficulty, worms, botCount = 5) {
  const game = new Game({ botCount, difficulty });
  game.food = []; game.powerups = []; game.worms = []; game.respawnQueue = [];
  const out = worms.map((o) => {
    const ai = o.ai ? { skill: 1, aggro: 0, interval: 0.1, wx: o.x, wy: o.y, prey: null, huntUntil: 0, ...o.ai } : null;
    const w = new Worm({ name: o.name || 'W', skin: SKINS[0], mass: o.mass, x: o.x, y: o.y, angle: o.angle, worldR: game.R, ai });
    const sp = w.r * 0.42;
    for (let i = 0; i < w.sx.length; i++) { w.sx[i] = o.x - Math.cos(o.angle) * sp * i; w.sy[i] = o.y - Math.sin(o.angle) * sp * i; }
    w.updateBounds();
    if (o.turnRate) w.turnRate = o.turnRate;
    game.worms.push(w);
    return w;
  });
  for (const f of worms.food || []) game.food.push({ v: 8, r: 6, c: '#fff', life: Infinity, ph: 0, dead: false, natural: true, ...f });
  game.settings.botCount = out.filter((w) => w.ai).length; // no replacements spawn mid-test
  game.rebuildSegGrid();
  game.rebuildFoodGrid();
  return { game, worms: out };
}
const withFood = (worms, food) => Object.assign(worms, { food });
// Runs fn with some of a level's tactic shares replaced, so one tactic can be tested alone.
function withTactics(level, shares, fn) {
  const saved = { ...DIFFICULTY[level].tactics };
  Object.assign(DIFFICULTY[level].tactics, shares);
  try { return fn(); } finally { Object.assign(DIFFICULTY[level].tactics, saved); }
}
// Signed distance of point p from the line through worm o's head along its heading.
const sideOf = (o, x, y) => Math.cos(o.angle) * (y - o.sy[0]) - Math.sin(o.angle) * (x - o.sx[0]);

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
  const sees = withTactics('expert', { evade: 0 }, () => run('expert'));
  assert.equal(sees.ai.mode, 'food');
  assert.ok(Math.abs(sees.targetAngle) > 0.2, `anticipating bot turns off the line (${sees.targetAngle.toFixed(2)})`);
  const blind = run('easy');
  assert.ok(Math.abs(blind.targetAngle) < 0.05, `bot without the tactic keeps going for the food (${blind.targetAngle.toFixed(2)})`);
});

test('evading bots turn away from a head lining up to cut them off (#78)', () => {
  const { game, worms: [bot, threat] } = scene('expert', withFood([
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
  const meet = (otherMass) => scene('expert', [
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

// Hunting scenes: hunters are given their prey directly; the other tactics are switched off
// with withTactics where they would change the mode under test.
const ONLY = (tactic) => Object.fromEntries(TACTICS.map((k) => [k, k === tactic ? 1 : 0]));
function hunt(level, hunter, prey, extra = [], botCount = 5) {
  const s = scene(level, [{ name: 'Hunter', ai: { huntUntil: 1e9 }, ...hunter }, { name: 'Prey', ...prey }, ...extra], botCount);
  s.worms[0].ai.prey = s.worms[1];
  return s;
}

test('predicting hunters aim where a turning prey is going, not straight ahead of it (#78)', () => {
  // The prey heads +y and has been turning toward -x (its +1 side), toward the hunter.
  const aimAngle = (level) => withTactics('expert', ONLY('predict'), () => {
    const { game, worms: [h] } = hunt(level, { mass: 400, x: 0, y: 0, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2, turnRate: 1.5 });
    botThink(h, game);
    assert.equal(h.ai.mode, 'cut');
    return { angle: Math.atan2(h.ai.aim.y, h.ai.aim.x), aim: h.ai.aim };
  });
  const predicted = aimAngle('expert'), straight = aimAngle('easy');
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
  assert.equal(pick('expert'), 'Boxed');
  assert.equal(pick('easy'), 'Open');
});

test('pinning hunters cut in on the arena side of a prey running along the wall (#78)', () => {
  const s = withTactics('expert', ONLY('pin'), () => {
    const s = hunt('expert', { mass: 400, x: 1500, y: -150, angle: Math.PI / 2 }, { mass: 100, x: 1850, y: 0, angle: Math.PI / 2 });
    botThink(s.worms[0], s.game);
    return s;
  });
  const [h, prey] = s.worms;
  assert.equal(h.ai.mode, 'pin');
  assert.ok(Math.hypot(h.ai.aim.x, h.ai.aim.y) < Math.hypot(prey.x, prey.y) - prey.r, 'aims inside the prey, on the arena side');
  assert.ok(h.ai.aim.y > prey.y, 'ahead of the prey');
  // The same chase away from the wall is a plain cut-off.
  const mid = withTactics('expert', ONLY('pin'), () => {
    const m = hunt('expert', { mass: 400, x: -350, y: -150, angle: Math.PI / 2 }, { mass: 100, x: 0, y: 0, angle: Math.PI / 2 });
    botThink(m.worms[0], m.game);
    return m.worms[0].ai.mode;
  });
  assert.equal(mid, 'cut');
});

test('flanking hunters cut in from the side opposite another hunter (#78)', () => {
  // The prey heads +y. Another bot already hunts it from its +1 side (-x).
  const s = withTactics('expert', ONLY('flank'), () => {
    const s = hunt('expert', { mass: 400, x: 500, y: -200, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2 },
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
  const { game, worms: [h, prey] } = withTactics('expert', ONLY('coil'), () =>
    hunt('expert', { mass: 3000, x: 600, y: 200, angle: 0 }, { mass: 100, x: 600, y: 0, angle: 0 }, [], 30));
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
  withTactics('expert', ONLY('coil'), () => {
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

  const short = withTactics('expert', ONLY('coil'), () => {
    const s = hunt('expert', { mass: 300, x: 0, y: 200, angle: 0 }, { mass: 100, x: 0, y: 0, angle: 0 });
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
  const { bot, game } = think('expert');
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
    const { game, worms: [b, small, rival] } = scene('expert', worms, 30);
    game.kill(small, null);
    if (rival) for (const d of game.recentDeaths) assert.ok(Math.hypot(rival.x - d.x, rival.y - d.y) < Math.hypot(d.x, d.y), 'rival is closer to every point');
    game.rebuildFoodGrid();
    botThink(b, game);
    return b.ai.mode;
  };
  assert.equal(contested(false), 'scavenge', 'uncontested, these remains are worth it');
  assert.notEqual(contested(true), 'scavenge');
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

test('a 150-bot Expert world stays healthy within the tick budget (#81)', () => {
  const { g, msPerTick, shortfalls, avgBots } = simulate(MAX_BOTS, 'expert', 20);
  assert.ok(g.worms.every((w) => Number.isFinite(w.mass) && w.sx.every(Number.isFinite)), 'finite state');
  assert.equal(shortfalls, 0, 'living + queued bots always cover the target');
  assert.ok(avgBots >= MAX_BOTS * 0.8, `average ${avgBots.toFixed(0)} bots alive`);
  // Same loose limit as the other simulation tests; locally about 2 ms.
  assert.ok(msPerTick < 25, `${msPerTick.toFixed(2)} ms per tick is far too slow`);
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

// --- Reading other worms (#83) ---------------------------------------------------

test('the read tactic is appended, so existing bots keep their other tactics (#83)', () => {
  assert.deepEqual(TACTICS.slice(0, 9), ['predict', 'anticipate', 'evade', 'headOn', 'scavenge', 'trap', 'pin', 'coil', 'flank']);
  assert.equal(TACTICS[9], 'read');
  assert.deepEqual(TACTICS.map((k) => DIFFICULTY.easy.tactics[k]), TACTICS.map(() => 0), 'easy knows nothing');
  for (let id = 1; id <= 200; id++) assert.equal(knowsTactic({ id }, 'expert', 'read'), true);
  let hard = 0;
  for (let id = 1; id <= 600; id++) if (knowsTactic({ id }, 'hard', 'read')) hard++;
  assert.ok(Math.abs(hard / 600 - 0.5) < 0.07, `${(hard / 6).toFixed(0)}% of hard bots read`);
});

// A reading bot (expert), a killer and its victim, laid out by distance from the bot.
function killScene(victimAt, extra = []) {
  const s = scene('expert', [
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
  const { game, worms: [reader] } = scene('expert', [{ name: 'Reader', mass: 400, x: 0, y: 0, angle: 0, ai: {} }], 30);
  for (let i = 0; i < 25; i++) {
    const [k, v] = ['K', 'V'].map((n, j) => new Worm({ name: n + i, skin: SKINS[0], mass: 100, x: 200 + j * 60, y: 100, angle: 0, worldR: game.R }));
    game.worms.push(k, v);
    game.time += 0.1;
    game.kill(v, k);
  }
  assert.ok(reader.ai.seen.size <= 16, `${reader.ai.seen.size} worms remembered`);
});

test('readers hold a grudge against a worm that tried to cut them off, once a second at most (#83)', () => {
  const s = scene('expert', withFood([
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

// Prey choice for a reading bot with only `read` on: a near and a far candidate.
function pickPrey(near, far, setup, extra = [], shares = ONLY('read')) {
  return withTactics('expert', shares, () => {
    const s = scene('expert', [
      { name: 'Reader', mass: 400, x: 0, y: 0, angle: 0, ai: { aggro: 1 } },
      { name: 'Near', x: 250, y: 0, angle: Math.PI / 2, ...near },
      { name: 'Far', x: 0, y: 450, angle: 0, ...far },
      ...extra,
    ], 30);
    setup(s);
    const [h] = s.worms;
    for (let i = 0; i < 300 && !h.ai.prey; i++) botThink(h, s.game);
    return { prey: h.ai.prey && h.ai.prey.name, retaliating: h.ai.retaliating && h.ai.retaliating.name, s };
  });
}
const memo = (s, name, kills, grudge) => {
  const [reader] = s.worms, o = s.worms.find((w) => w.name === name);
  reader.ai.seen = new Map([[o.id, { kills, grudge, at: s.game.time, cutAt: -Infinity }]]);
};

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
  const run = (seconds) => withTactics('expert', { ...ONLY('read'), evade: 1 }, () => {
    const s = scene('expert', [
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
  // Bigger culprit: too heavy to hunt (expert prey limit 2x), so not prey.
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
  withTactics('expert', ONLY('read'), () => botThink(h, r.s.game));
  assert.ok(!h.ai.retaliating || h.ai.retaliating === h.ai.prey, 'retaliation ends with the hunt');
});

test('readers evade worms they are wary of from farther away (#83)', () => {
  // A head 470 away, beyond the usual evade range (400 at skill 1), crossing our path ahead.
  // On hard: expert bots sense threats from farther anyway (#110).
  const run = (otherMass, setup) => withTactics('hard', { ...ONLY('read'), evade: 1 }, () => {
    const s = scene('hard', [
      { name: 'Bot', mass: 400, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Other', mass: otherMass, x: 400, y: 250, angle: Math.atan2(-250, -150) },
    ], 30);
    setup(s);
    botThink(s.worms[0], s.game);
    return s.worms[0].ai.mode;
  });
  assert.notEqual(run(100, () => {}), 'evade', 'an unknown worm at that distance is ignored');
  assert.equal(run(100, (s) => memo(s, 'Other', 1, 0)), 'evade', 'a seen killer is evaded from farther');
  assert.equal(run(1000, (s) => memo(s, 'Other', 0, 1)), 'evade', 'a bigger culprit is kept away from');
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

// --- Expert sharpness (#110) ---------------------------------------------------
function withSharp(patch, fn) {
  const saved = { ...DIFFICULTY.expert.sharp };
  Object.assign(DIFFICULTY.expert.sharp, patch);
  try { return fn(); } finally { Object.assign(DIFFICULTY.expert.sharp, saved); }
}
// Re-plans of each bot over `secs`: its think timer jumps up whenever it re-plans.
function replans(game, bots, secs) {
  const n = new Map(bots.map((b) => [b, 0])), prev = new Map(bots.map((b) => [b, b.thinkT]));
  for (let i = 0; i < secs * 60; i++) {
    game.update(1 / 60);
    for (const b of bots) { if (b.thinkT > prev.get(b)) n.set(b, n.get(b) + 1); prev.set(b, b.thinkT); }
  }
  return n;
}

test('only expert is sharp, and only expert starts with more and bigger large bots (#110)', () => {
  assert.deepEqual(Object.keys(DIFFICULTY.expert.sharp).sort(), ['dense', 'escape', 'headings', 'heads', 'look', 'sense', 'think']);
  for (const level of ['easy', 'normal', 'hard']) assert.equal(DIFFICULTY[level].sharp, undefined, level);
  const big = DIFFICULTIES.map((l) => [DIFFICULTY[l].bigShare, DIFFICULTY[l].bigMax]);
  assert.deepEqual(big, [[0.1, 1200], [0.15, 2000], [0.2, 2500], [0.35, 5000]]);
  const masses = [];
  for (let seed = 1; seed <= 6; seed++) masses.push(...new Game({ botCount: 60, difficulty: 'expert' }, null, { seed }).worms.map((w) => w.mass));
  const share = masses.filter((m) => m >= 400).length / masses.length;
  assert.ok(Math.abs(share - 0.35) < 0.08, `${(share * 100).toFixed(0)}% start large`);
  assert.ok(Math.max(...masses) <= 5000 && Math.max(...masses) > 3000, `largest ${Math.round(Math.max(...masses))}`);
});

test('expert bots re-plan more often than hard bots of the same skill; the saved interval is unchanged (#110)', () => {
  const count = (level) => {
    const { game, worms: [bot] } = scene(level, [{ name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} }]);
    return replans(game, [bot], 10).get(bot);
  };
  const hard = count('hard'), expert = count('expert');
  assert.ok(expert > hard * 1.25, `expert ${expert} vs hard ${hard} re-plans in 10 s`);
  // A loaded expert world re-plans at the sharp rate too, from the unchanged saved interval.
  const g = new Game({ botCount: 10, difficulty: 'expert' }, null, { seed: 3 });
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

test('expert bots see a thin body that slips between a hard bot\'s look-ahead points (#110)', () => {
  const r = radiusFor(100), hardL = 320 + 3 * r, expertL = 320 * DIFFICULTY.expert.sharp.look + 3 * r;
  // A thin worm's body across the path at x, ahead of the bot heading for food along +x.
  const run = (level, x, sharp = {}) => withSharp(sharp, () => withTactics(level, ONLY(null), () => {
    const { game, worms: [bot] } = scene(level, withFood([
      { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Thin', mass: 15, x, y: 50, angle: Math.PI / 2 },
    ], [{ x: 480, y: 0 }]));
    botThink(bot, game);
    return bot.targetAngle;
  }));
  // Midway between a hard bot's last two points: the hard bot doesn't see it, the expert does.
  const gapH = hardL * 0.81;
  assert.ok(Math.abs(run('hard', gapH)) < 0.02, 'hard bot keeps its line');
  assert.ok(Math.abs(run('expert', gapH)) > 0.05, 'expert bot turns off its line');
  // Midway between an expert bot's own last two sparse points: only the close check finds it.
  const gapE = expertL * 0.81;
  assert.ok(Math.abs(run('expert', gapE, { dense: 0 })) < 0.02, 'sparse points alone miss it');
  assert.ok(Math.abs(run('expert', gapE)) > 0.05, 'the close check of the winning heading finds it');
});

test('expert bots notice a cutter from farther than a hard bot of the same skill (#110)', () => {
  // A head 470 away (hard evade range at skill 1: 400), crossing ahead.
  const run = (level, sharp = {}) => withSharp(sharp, () => withTactics(level, ONLY('evade'), () => {
    const s = scene(level, [
      { name: 'Bot', mass: 400, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Other', mass: 100, x: 400, y: 250, angle: Math.atan2(-250, -150) },
    ], 30);
    botThink(s.worms[0], s.game);
    return s.worms[0].ai.mode;
  }));
  assert.notEqual(run('hard'), 'evade');
  assert.equal(run('expert'), 'evade');
  assert.notEqual(run('expert', { sense: 1 }), 'evade', 'it is the wider sensing');
});

test('expert bots steer clear of two cutters at once (#110)', () => {
  const { game, worms: [bot, a, b] } = scene('expert', withFood([
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
  // Byte-identical easy/normal/hard runs against the previous engine are checked with seeded
  // balance reports (see the #110 PR); here: a level without a sharp block gets no sharpness,
  // and the same block given to hard does change how its bots play.
  const run = () => {
    const g = new Game({ botCount: 12, difficulty: 'hard' }, null, { seed: 77 });
    g.spawnPlayer('You', 0);
    for (let i = 0; i < 60 * 20; i++) g.update(1 / 60);
    const snap = g.toJSON();
    delete snap.savedAt;
    return JSON.stringify(snap);
  };
  const plain = run();
  DIFFICULTY.hard.sharp = DIFFICULTY.expert.sharp;
  try { assert.notEqual(run(), plain, 'a sharp block changes hard bots'); } finally { delete DIFFICULTY.hard.sharp; }
  assert.equal(run(), plain, 'and without one they play as before');
});

test('a sharp bot going head-on still avoids a loop of its target\'s body across the way (#110)', () => {
  const { game, worms: [bot, other] } = scene('expert', [
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
  const { game, worms: [bot, loop] } = withTactics('expert', ONLY(null), () => scene('expert', withFood([
    { name: 'Bot', mass: 100, x: 0, y: 0, angle: 0, ai: {} },
    { name: 'Loop', mass: 1000, x: 0, y: 3000, angle: 0 },
  ], [{ x: 1000, y: 0 }])));
  const L = 320 * DIFFICULTY.expert.sharp.look + 3 * bot.r, R = 0.485 * L;
  loop.sx = []; loop.sy = [];
  for (let k = 0; k < 320; k++) {
    const a = (2 * Math.PI * k) / 320;
    if (Math.abs(a - Math.PI / 2) < 0.75) continue;
    loop.sx.push(R * Math.cos(a)); loop.sy.push(R * Math.sin(a));
  }
  loop.updateBounds();
  game.rebuildSegGrid();
  withTactics('expert', ONLY(null), () => botThink(bot, game));
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
  return withTactics('expert', shares, () => {
    const s = hunt('expert', hunter, prey, dead ? [dead] : [], 30);
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
  const picks = (dead) => withTactics('expert', ONLY('scavenge'), () => {
    const worms = [
      { name: 'Hunter', mass: 400, x: 0, y: 0, angle: 0, ai: { aggro: 1 } },
      { name: 'Prey', mass: 100, x: 250, y: 0, angle: Math.PI / 2 },
    ];
    if (dead) worms.push(dead);
    const s = scene('expert', worms, 30);
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
