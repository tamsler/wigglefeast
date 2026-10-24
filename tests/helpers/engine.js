// Shared helpers for the engine and bot tests (#153).
const fs = require('node:fs');
const path = require('node:path');
require('../../engine.js');
const { Game, Worm, SKINS, DIFFICULTY, TACTICS, botThink } = globalThis.WormEngine;

const clone = (o) => JSON.parse(JSON.stringify(o));
const fixture = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'save-v1.json'), 'utf8'));

// Runs a fresh world for `seconds` and reports its health: deaths, wall deaths, ms per tick, the
// average bot count and how often it fell short of the target.
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

// Hunting scenes: hunters are given their prey directly; the other tactics are switched off
// with withTactics where they would change the mode under test.
const ONLY = (tactic) => Object.fromEntries(TACTICS.map((k) => [k, k === tactic ? 1 : 0]));
function hunt(level, hunter, prey, extra = [], botCount = 5) {
  const s = scene(level, [{ name: 'Hunter', ai: { huntUntil: 1e9 }, ...hunter }, { name: 'Prey', ...prey }, ...extra], botCount);
  s.worms[0].ai.prey = s.worms[1];
  return s;
}

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

module.exports = { clone, fixture, simulate, withFood, scene, sideOf, withTactics, hunt, ONLY, memo, pickPrey };
