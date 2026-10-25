// Whole worlds over time: every level stays healthy and within the tick budget, up to 150 bots,
// and refills don't depend on the update rate. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../engine.js');
const { Game, DIFFICULTIES, MAX_BOTS } = globalThis.WormEngine;
const { simulate } = require('./helpers/engine.js');

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

test('the biggest world on Hard stays within the tick budget (#78)', () => {
  const { g, msPerTick, shortfalls } = simulate(60, 'hard', 30);
  assert.ok(g.worms.every((w) => Number.isFinite(w.mass) && w.sx.every(Number.isFinite)), 'finite state');
  assert.equal(shortfalls, 0);
  // Same loose limit as above; locally about 0.7 ms.
  assert.ok(msPerTick < 25, `${msPerTick.toFixed(2)} ms per tick is far too slow`);
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

test('a 150-bot Hard world stays healthy within the tick budget (#81)', () => {
  const { g, msPerTick, shortfalls, avgBots } = simulate(MAX_BOTS, 'hard', 20);
  assert.ok(g.worms.every((w) => Number.isFinite(w.mass) && w.sx.every(Number.isFinite)), 'finite state');
  assert.equal(shortfalls, 0, 'living + queued bots always cover the target');
  assert.ok(avgBots >= MAX_BOTS * 0.8, `average ${avgBots.toFixed(0)} bots alive`);
  // Same loose limit as the other simulation tests; locally about 2 ms.
  assert.ok(msPerTick < 25, `${msPerTick.toFixed(2)} ms per tick is far too slow`);
});
