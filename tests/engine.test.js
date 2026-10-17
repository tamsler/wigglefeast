// Engine tests: run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../engine.js');
const { Game, Worm, SKINS, validateSnapshot } = globalThis.WormEngine;

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
