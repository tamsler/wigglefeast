// Engine tests: run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../engine.js');
const { Game, Worm, SKINS, DIFFICULTY, DIFFICULTIES, TACTICS, MAX_BOTS, arenaRadius, CFG, radiusFor, lengthFor, botThink, knowsTactic, predictHead, reachPath, reachAt, validateSnapshot } = globalThis.WormEngine;

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
  assert.deepEqual(Object.keys(DIFFICULTY.expert.sharp).sort(), ['dense', 'escape', 'headings', 'heads', 'look', 'reach', 'sense', 'think']);
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

// ---------------------------------------------------------------------------
// Learning the player's habits (#135)
const { freshHabits, validHabits, recordHabit, habitBias, habitBoost, angleDiff } = globalThis.WormEngine;
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
  const s = scene('expert', [{ name: 'You', mass: 15, x: 0, y: 0, angle: 0 }, { name: 'Cutter', mass: 100, ai: { huntUntil: 1e9 }, ...bot }]);
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
  for (const diff of ['easy', 'normal', 'hard']) {
    let recorded = false;
    for (const seed of [99, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const rec = strong();
      assert.equal(world(diff, rec, seed), world(diff, freshHabits(), seed), `${diff}, seed ${seed}`);
      if ((recorded = JSON.stringify(rec) !== JSON.stringify(strong()))) break;
    }
    assert.ok(recorded, `${diff}: a run recorded cut-offs`);
  }
});

test('learn is appended and expert-only; every bot keeps its other tactics (#135)', () => {
  assert.equal(TACTICS[10], 'learn');
  for (const level of ['easy', 'normal', 'hard']) assert.equal(DIFFICULTY[level].tactics.learn, 0, level);
  assert.equal(DIFFICULTY.expert.tactics.learn, 1);
  for (let id = 1; id <= 200; id++) {
    assert.equal(knowsTactic({ id }, 'expert', 'learn'), true);
    assert.equal(knowsTactic({ id }, 'hard', 'learn'), false);
  }
  // Each bot's first ten tactics, as bits, for ids 1-40, recorded before learn was added.
  const before = {
    hard: [575, 571, 87, 727, 139, 103, 39, 19, 543, 523, 559, 175, 27, 63, 647, 211, 725, 43, 527, 155, 25, 607, 599, 59, 627, 59, 157, 639, 247, 649, 567, 179, 19, 141, 579, 679, 655, 599, 79, 635],
    normal: [537, 521, 3, 516, 8, 1, 7, 17, 512, 0, 526, 5, 17, 19, 6, 19, 517, 1, 5, 2, 16, 5, 7, 27, 16, 0, 21, 17, 22, 8, 518, 18, 3, 5, 515, 512, 514, 530, 0, 19],
  };
  for (const [level, masks] of Object.entries(before)) {
    const now = masks.map((_, i) => TACTICS.slice(0, 10).reduce((m, k, j) => m | (knowsTactic({ id: i + 1 }, level, k) ? 1 << j : 0), 0));
    assert.deepEqual(now, masks, level);
  }
});

test('escape is appended, on half the hard bots and every expert bot; every bot keeps its other tactics (#94)', () => {
  assert.equal(TACTICS.length, 12);
  assert.equal(TACTICS[11], 'escape');
  for (const level of ['easy', 'normal']) assert.equal(DIFFICULTY[level].tactics.escape, 0, level);
  assert.equal(DIFFICULTY.hard.tactics.escape, 0.5);
  assert.equal(DIFFICULTY.expert.tactics.escape, 1);
  // Each bot's first eleven tactics, as bits, for ids 1-40, recorded before escape was added.
  const before = {
    hard: [575, 571, 87, 727, 139, 103, 39, 19, 543, 523, 559, 175, 27, 63, 647, 211, 725, 43, 527, 155, 25, 607, 599, 59, 627, 59, 157, 639, 247, 649, 567, 179, 19, 141, 579, 679, 655, 599, 79, 635],
    normal: [537, 521, 3, 516, 8, 1, 7, 17, 512, 0, 526, 5, 17, 19, 6, 19, 517, 1, 5, 2, 16, 5, 7, 27, 16, 0, 21, 17, 22, 8, 518, 18, 3, 5, 515, 512, 514, 530, 0, 19],
    expert: Array(40).fill(2047),
  };
  for (const [level, masks] of Object.entries(before)) {
    const now = masks.map((_, i) => TACTICS.slice(0, 11).reduce((m, k, j) => m | (knowsTactic({ id: i + 1 }, level, k) ? 1 << j : 0), 0));
    assert.deepEqual(now, masks, level);
  }
});

// An expert hunter at the origin cutting off the player, who heads +y 300 px to its right. The
// hunter is on the player's +1 side, so the player turning away goes to -1 (+x).
function learnHunt(record, shares = ONLY('learn'), prey = {}) {
  return withTactics('expert', shares, () => {
    const s = hunt('expert', { mass: 400, x: 0, y: 0, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2, ...prey });
    const [h, p] = s.worms;
    p.isPlayer = true;
    s.game.player = p;
    s.game.habits = record;
    botThink(h, s.game);
    return { h, p, aim: h.ai.aim, mode: h.ai.mode };
  });
}

test('an expert bot aims at the side the player usually escapes to, a little at first (#135)', () => {
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
  const bot = withTactics('expert', ONLY('learn'), () => {
    const s = hunt('expert', { mass: 400, x: 0, y: 0, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2 });
    s.game.habits = habits({ away: 12 });
    botThink(s.worms[0], s.game);
    return s.worms[0].ai;
  });
  assert.equal(bot.mode, 'cut');
  assert.deepEqual(bot.aim, none.aim);
});

test('pin and flank come before a learned habit, which comes before trap (#135)', () => {
  // Along the wall, pin wins.
  const pin = withTactics('expert', { ...ONLY('learn'), pin: 1 }, () => {
    const s = hunt('expert', { mass: 400, x: 1500, y: -150, angle: Math.PI / 2 }, { mass: 100, x: 1850, y: 0, angle: Math.PI / 2 });
    s.worms[1].isPlayer = true; s.game.player = s.worms[1]; s.game.habits = habits({ away: 12 });
    botThink(s.worms[0], s.game);
    return s.worms[0].ai.mode;
  });
  assert.equal(pin, 'pin');
  // With another hunter on the player's +1 side, flank wins.
  const flank = withTactics('expert', { ...ONLY('learn'), flank: 1 }, () => {
    const s = hunt('expert', { mass: 400, x: 500, y: -200, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2 },
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

test('an expert bot leads farther ahead of a player who usually boosts out (#135)', () => {
  for (const shares of [ONLY('learn'), { ...ONLY('learn'), predict: 1 }]) {
    const none = learnHunt(freshHabits(), shares), boosts = learnHunt(habits({ boost: 12 }), shares);
    assert.equal(boosts.mode, 'cut', 'no side habit, no shift');
    assert.ok(Math.abs(boosts.aim.x - none.aim.x) < 1e-6, 'straight ahead of the player either way');
    assert.ok(boosts.aim.y > none.aim.y + 20, `further ahead (${none.aim.y.toFixed(0)} -> ${boosts.aim.y.toFixed(0)})`);
    assert.deepEqual(learnHunt(habits({ still: 12 }), shares).aim, none.aim, 'a player who never boosts: no extra lead');
  }
  const boosting = (rec) => withTactics('expert', ONLY('learn'), () => {
    const s = hunt('expert', { mass: 400, x: 0, y: 0, angle: Math.PI / 2 }, { mass: 100, x: 300, y: 0, angle: Math.PI / 2 });
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
  // The player near and another worm far, then the other way round; with every expert tactic.
  for (const [near, far] of [[{ name: 'You' }, { name: 'Other' }], [{ name: 'Other' }, { name: 'You' }]]) {
    const picks = [freshHabits(), habits({ away: 12, boost: 12 })].map((rec) =>
      pickPrey({ mass: 100, ...near }, { mass: 100, ...far }, (s) => {
        const p = s.worms.find((w) => w.name === 'You');
        p.isPlayer = true; s.game.player = p; s.game.habits = rec;
      }, [], DIFFICULTY.expert.tactics).prey);
    assert.equal(picks[0], picks[1], `${near.name} near`);
    assert.equal(picks[0], near.name);
  }
});

test('a scavenger that has reached spread-out remains eats them instead of circling their middle (#141)', () => {
  // A scavenger 60 px from the middle of remains whose food lies 110-260 px around it, as a dead
  // worm's body leaves it. Aiming at the middle point, it circled it, boosting, and left 105-146 of
  // 240 in 8 s; eating the food itself, it leaves 5-80 (median 25, #146).
  const { game, worms: [bot] } = withTactics('expert', ONLY('scavenge'), () => scene('expert', [{ name: 'Bot', mass: 300, x: 0, y: 0, angle: 0, ai: {} }]));
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
  withTactics('expert', ONLY('scavenge'), () => {
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

test('a scavenger that overshoots the remains\' edge doesn\'t boost back in (#146)', () => {
  // Remains of 240 spread 110-260 px around (0, 0), reach 300. A bot that was in them and is now
  // 30 px past the edge, heading outward after a pellet there, used to count as "not there yet",
  // aim for the middle and boost.
  const think = (path) => withTactics('expert', ONLY('scavenge'), () => {
    const { game, worms: [bot] } = scene('expert', [{ name: 'Bot', mass: 300, x: path[0], y: 0, angle: 0, ai: {} }]);
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
// Runs fn with expert's reach switched to `on` (1/0).
function withReach(on, fn) {
  const saved = DIFFICULTY.expert.sharp.reach;
  DIFFICULTY.expert.sharp.reach = on;
  try { return fn(); } finally { DIFFICULTY.expert.sharp.reach = saved; }
}

test('a reachable path is where the worm actually goes when it steers for that heading (#149)', () => {
  const { game } = scene('expert', []);
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

test('an expert bot does not boost when only its wider boosting turn meets a body (#149)', () => {
  // The bot goes for a big pellet 250 away, about 110° to its left, and its boost roll always passes.
  // A body runs alongside that line, 170 to its right: clear of the straight line and of the normal
  // turn (about 63 out at 110°), but on the wider boosting turn (about 154 out, and farther as it
  // carries on past the pellet).
  const a = (110 * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), nx = sa, ny = -ca; // right of the line
  const think = (reach) => withReach(reach, () => withTactics('expert', ONLY(null), () => {
    const { game, worms: [bot, body] } = scene('expert', withFood([
      { name: 'Bot', mass: 120, x: 0, y: 0, angle: 0, ai: {} },
      { name: 'Body', mass: 2000, x: ca * 800 + nx * 170, y: sa * 800 + ny * 170, angle: a },
    ], [{ x: ca * 250, y: sa * 250 }]));
    game.rng = () => 0;
    const L = 320 * DIFFICULTY.expert.sharp.look + 3 * bot.r, rad = bot.r + 10;
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

test('reachable paths change nothing on easy, normal and hard (#149)', () => {
  const run = (level, reach) => withReach(reach, () => {
    const g = new Game({ botCount: 30, difficulty: level }, null, { seed: 4242 });
    for (let i = 0; i < 600; i++) g.update(1 / 60);
    return JSON.stringify(g.worms.map((w) => [w.id, w.mass, w.sx[0], w.sy[0], w.angle]));
  });
  for (const level of ['easy', 'normal', 'hard']) assert.equal(run(level, 1), run(level, 0), level);
  assert.notEqual(run('expert', 1), run('expert', 0), 'expert does change');
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
    withArm('escape', 'expert', () => {
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
  const think = (worms, fix) => withTactics('expert', ESCAPE, () => {
    const s = scene('expert', [{ name: 'Prey', mass: 120, x: 0, y: 0, angle: 0, ai: {} }, ...worms]);
    if (fix) fix(s);
    botThink(s.worms[0], s.game);
    return s.worms[0].ai;
  });
  const passing = think([{ name: 'Big', mass: 3000, x: 0, y: 150, angle: 0 }]);
  assert.ok(!passing.circledBy, 'straight past');
  const elsewhere = think([{ name: 'Big', mass: 3000, x: 800, y: 0, angle: Math.PI / 2, turnRate: 1.5 }]);
  assert.ok(!elsewhere.circledBy, 'circling a point far away');
  const loose = withTactics('expert', ESCAPE, () => {
    const s = laidCoil('expert', { span: Math.PI / 2 });
    botThink(s.p, s.game);
    return s.p.ai;
  });
  assert.ok(!loose.circledBy, 'a quarter loop leaves most ways open');
  assert.notEqual(loose.mode, 'escape');
  const closed = withTactics('expert', ESCAPE, () => {
    const s = laidCoil('expert');
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
  const run = (setCoiler, shares = ESCAPE) => withTactics('expert', shares, () => {
    const s = laidCoil('expert');
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
  const out = withTactics('expert', ESCAPE, () => { const s = laidCoil('expert', open); botThink(s.p, s.game); return s.p; });
  assert.equal(out.ai.escape, 'out');
  assert.ok(Math.abs(out.targetAngle) < 0.5, `heads out through the gap (${out.targetAngle.toFixed(2)})`);
  assert.ok(Math.hypot(out.ai.aim.x, out.ai.aim.y) > 100 + 34 + out.r, 'its path ends outside the loop');
  // With a second ring beyond the gap there's no way out: it hugs the loop instead.
  const held = withTactics('expert', ESCAPE, () => { const s = laidCoil('expert', { ...open, outer: 320 }); botThink(s.p, s.game); return s.p; });
  assert.equal(held.ai.escape, 'hug', 'blocked beyond: no way out');
});

test('a circled bot does not go for a gap it cannot turn into (#94)', () => {
  // A closed loop of radius 150 but for a gap of ±28° straight below the prey, which sits 40 below
  // the middle heading +x. A straight line down through the gap is clear; every turn down into it
  // swings into the loop's edge.
  const gap = (28 / 180) * Math.PI;
  const s = withTactics('expert', ESCAPE, () => {
    const s = laidCoil('expert', { R: 150, at: -Math.PI / 2 - gap, span: 2 * Math.PI - 2 * gap, py: -40 });
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
  withTactics('expert', ESCAPE, () => {
    const s = laidCoil('expert');
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

test('a circled bot boosts only along a boosting path that leads cleanly out, on hard as on expert (#94)', () => {
  for (const level of ['expert', 'hard']) {
    // A big pellet ahead and a boost roll that always passes: it would boost, if it weren't circled.
    const think = (opts, shares) => withTactics(level, shares, () => {
      const s = laidCoil(level, { ...opts, extra: Object.assign([], { food: [{ x: 60, y: 0, v: 20 }] }) });
      s.game.rng = () => 0;
      botThink(s.p, s.game);
      return s.p;
    });
    const gap = { R: 100, at: (-2 * Math.PI) / 3, span: (195 / 180) * Math.PI };
    assert.equal(think(gap, ONLY(null)).wantBoost, true, `${level}: boosts for the pellet through the gap without the tactic`);
    const tight = think({}, ESCAPE);
    assert.equal(tight.ai.mode, 'escape');
    assert.equal(tight.wantBoost, false, `${level}: not inside a closed loop`);
    const open = think(gap, ESCAPE);
    assert.equal(open.ai.escape, 'out');
    assert.equal(open.wantBoost, true, `${level}: straight out through the gap at speed`);
  }
});
