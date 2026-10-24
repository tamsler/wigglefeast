#!/usr/bin/env node
// Coil-escape measurement (#94, #149): many seeded encounters of a small bot being coiled by a
// big worm. Reports how often the trapped bot dies, the coiler dies, the bot gets free, or it's
// still held when time runs out, for each arm (baseline, reach only, reach + escape).
// Usage: node tools/coil.js [--n 300] [--seed 1] [--coiler bot,scripted] [--prey expert]
//                           [--arms baseline,reach,escape] [--secs 6] [--dist 400] [--coiler-reach 1]
// Arms switch reachable paths and the escape tactic for the prey only; --coiler-reach sets the bot
// coiler's reachable paths (1, as Expert ships; 0, as before #149).
// Coilers: 'bot' is an ordinary bot of the prey's level hunting the prey (it starts coiling at
// once); 'scripted' circles the prey's head the way a coiling bot aims, every tick, but never
// steers around bodies, like a person might. Encounter i of every arm uses seed + i, so arms are
// compared on the same starts. The 95% interval is the normal approximation.
// Not part of the game: the release check ignores tools/.
require('../engine.js');
const { Game, Worm, SKINS, DIFFICULTY, botThink, predictHead, freedom, TAU } = globalThis.WormEngine;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ARMS = {
  baseline: { reach: 0, escape: 0 },
  reach: { reach: 1, escape: 0 },
  escape: { reach: 1, escape: 1 },
};

// Runs fn with the arm's switches set: Expert sharpness' reach, and the escape tactic share of
// the prey's level (1, so every prey bot knows it, when measuring the tactic itself).
function withArm(arm, level, fn) {
  const a = ARMS[arm], sharp = DIFFICULTY.expert.sharp, tac = DIFFICULTY[level].tactics;
  const saved = { reach: sharp.reach, escape: tac.escape };
  sharp.reach = a.reach;
  tac.escape = a.escape;
  try { return fn(); } finally { sharp.reach = saved.reach; tac.escape = saved.escape; }
}

// Steering of the scripted coiler: the coiling bot's aim (engine botThink, coil branch), checked
// against the prey's body like a person would, but blind to its newest REACT seconds: a person
// reacts late to a body cutting across, which is what a head shot relies on.
const REACT = 0.3;
const LOOK = [40, 90, 150, 220, 300];
const TRY = [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8, 1.1, -1.1, 1.5, -1.5];
function scriptedSteer(c, prey, st, now) {
  if (!st.dir) {
    const dx = prey.sx[0] - c.sx[0], dy = prey.sy[0] - c.sy[0];
    st.dir = Math.cos(c.angle) * dy - Math.sin(c.angle) * dx >= 0 ? 1 : -1;
    st.R = Math.max(120, 4 * prey.r + 2 * c.r);
    st.t = now;
  }
  st.R = Math.max(2 * prey.r + 2 * c.r, st.R * Math.pow(0.85, now - st.t));
  st.t = now;
  const p = predictHead(prey, 0.3);
  const rho = Math.hypot(c.sx[0] - p.x, c.sy[0] - p.y), phi = Math.atan2(c.sy[0] - p.y, c.sx[0] - p.x);
  const goal = phi + st.dir * (Math.PI / 2 + clamp((rho - st.R) / st.R, -0.5, 0.8));
  const seen = Math.ceil((REACT * prey.speed) / (prey.r * 0.42)); // segments laid in the last REACT s
  const rr = c.r + prey.r + 6, hx = c.sx[0], hy = c.sy[0];
  const clear = (a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const t of LOOK) {
      const px = hx + ca * t, py = hy + sa * t;
      for (let i = seen; i < prey.sx.length; i++) {
        const dx = prey.sx[i] - px, dy = prey.sy[i] - py;
        if (dx * dx + dy * dy < rr * rr) return false;
      }
    }
    return true;
  };
  c.targetAngle = goal;
  for (const da of TRY) if (clear(goal + da)) { c.targetAngle = goal + da; break; }
  c.wantBoost = c.mass > 150;
}

// Sectors (of 8) around the prey's head that hold coiler body within 400: 6+ is a closed loop.
function sectors(c, prey) {
  const s = new Set();
  for (let i = 0; i < c.sx.length; i++) {
    const dx = c.sx[i] - prey.sx[0], dy = c.sy[i] - prey.sy[0];
    if (dx * dx + dy * dy < 400 * 400) s.add(Math.floor(((Math.atan2(dy, dx) + Math.PI) / TAU) * 8) % 8);
  }
  return s.size;
}

// A live coil scene: a mass-120 prey bot and a mass-3,000 coiler about `dist` away, in the default
// arena with no food, power-ups or respawns. Returns { g, p, c, tick }: tick() advances 1/60 s,
// steering the scripted coiler or letting the bot coiler think. Call it inside withArm.
function coilScene({ seed = 1, coiler = 'bot', prey: level = 'expert', preyMass = 120, coilerMass = 3000, dist = 400, coilerReach = 1 } = {}) {
  const g = new Game({ botCount: 30, difficulty: level }, null, { seed }); // the default arena
  const rng = g.rng, d = DIFFICULTY[level];
  g.food = []; g.powerups = []; g.specials = []; g.worms = []; g.respawnQueue = [];
  g.foodTarget = 0; g.powerupTarget = 0; g.specialTarget = 0;
  g.settings.botCount = 0; // no replacements
  const rand = (a, b) => a + rng() * (b - a);
  const ai = (o) => {
    const skill = rand(d.skill[0], d.skill[1]);
    return { skill, aggro: rand(d.aggro[0], d.aggro[1]), interval: 0.32 - 0.22 * skill, wx: 0, wy: 0, prey: null, huntUntil: 0, ...o };
  };
  // Random ids, so the tactics drawn from them vary between encounters as they do in play.
  const id = () => 1 + Math.floor(rng() * 1e8);
  const pa = rand(-Math.PI, Math.PI);
  const p = new Worm({ id: id(), rng, name: 'Prey', skin: SKINS[0], mass: preyMass, x: 0, y: 0, angle: pa, worldR: g.R, ai: ai({}) });
  // The coiler starts about `dist` from the prey, on its front half (its body trails behind it),
  // heading roughly across its way, and clear of the prey's body.
  const bot = coiler === 'bot';
  let c = null;
  for (let k = 0; k < 50 && !c; k++) {
    const ba = pa + rand(-1.2, 1.2), cd = dist + rand(-30, 30);
    const cx = Math.cos(ba) * cd, cy = Math.sin(ba) * cd;
    const ca = ba + (rng() < 0.5 ? 1 : -1) * (Math.PI / 2) + rand(-0.4, 0.4);
    const w = new Worm({ id: id(), rng, name: 'Coiler', skin: SKINS[1], mass: coilerMass, x: cx, y: cy, angle: ca, worldR: g.R,
      ai: bot ? ai({ prey: null, huntUntil: 1e9 }) : null });
    let near = Infinity;
    for (let i = 0; i < w.sx.length; i++) {
      for (let j = 0; j < p.sx.length; j++) near = Math.min(near, Math.hypot(w.sx[i] - p.sx[j], w.sy[i] - p.sy[j]));
    }
    if (near > 120) c = w;
  }
  if (!c) throw new Error('no clear start for seed ' + seed);
  // The bot coiler thinks here, not in g.update, so the arm's switches apply to the prey alone:
  // the coiler keeps coilerReach (on by default, as Expert bots ship).
  const cai = c.ai;
  if (bot) { cai.prey = p; c.ai = null; }
  let thinkT = 0;
  const coilerThink = () => {
    const sharp = DIFFICULTY[level].sharp, saved = sharp && sharp.reach;
    if (sharp) sharp.reach = coilerReach;
    c.ai = cai;
    try { botThink(c, g); } finally { c.ai = null; if (sharp) sharp.reach = saved; }
    thinkT = cai.interval * rand(0.8, 1.2);
    if (sharp) thinkT = Math.max(0.04, thinkT * sharp.think);
  };
  g.worms.push(p, c);
  g.rebuildSegGrid();
  g.rebuildFoodGrid();
  const st = {}, DT = 1 / 60;
  const tick = () => {
    if (!c.dead) {
      if (!bot) scriptedSteer(c, p, st, g.time);
      else if ((thinkT -= DT) <= 0) coilerThink();
    }
    g.update(DT);
  };
  return { g, p, c, tick };
}

// One encounter. Returns { outcome: 'prey' | 'coiler' | 'free' | 'held', loop: most sectors
// closed, modes: Set of the prey's modes, moves: Set of its escape moves, secs }.
function encounter({ arm = 'baseline', prey: level = 'expert', secs = 6, ...opts } = {}) {
  return withArm(arm, level, () => {
    const { g, p, c, tick } = coilScene({ prey: level, ...opts });
    let outcome = null, loop = 0;
    const modes = new Set(), moves = new Set();
    g.on('death', (e) => {
      if (outcome) return;
      outcome = e.victim === p ? 'prey' : 'coiler';
    });
    const steps = Math.round(secs * 60);
    for (let i = 0; i < steps && !outcome; i++) {
      tick();
      if (!p.dead) {
        modes.add(p.ai.mode);
        if (p.ai.escape) moves.add(p.ai.escape);
        if (!c.dead) loop = Math.max(loop, sectors(c, p));
      }
    }
    if (!outcome) {
      g.rebuildSegGrid();
      outcome = freedom(g, p, null, 0) > 0.5 ? 'free' : 'held';
    }
    return { outcome, loop, modes, moves, secs: g.time };
  });
}

module.exports = { encounter, coilScene, withArm, sectors, ARMS, scriptedSteer };

if (require.main === module) {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  const N = Number(args.n || 300), SEED = Number(args.seed || 1) >>> 0, SECS = Number(args.secs || 6), DIST = Number(args.dist || 400);
  const CREACH = Number(args['coiler-reach'] ?? 1);
  const coilers = (args.coiler || 'bot,scripted').split(','), arms = (args.arms || 'baseline,reach,escape').split(',');
  const level = args.prey || 'expert';
  const ci = (k) => {
    const q = k / N, h = 1.96 * Math.sqrt((q * (1 - q)) / N);
    return `${String(k).padStart(4)} (${(100 * q).toFixed(0).padStart(2)}% ±${(100 * h).toFixed(0)})`;
  };
  console.log(`${N} encounters per arm, ${level} prey (mass 120) vs mass-3000 coiler (bot coiler reach ${CREACH}), ${SECS} s each, seed ${SEED}\n`);
  for (const coiler of coilers) {
    console.log(`== ${coiler} coiler`);
    console.log('  arm        prey died       coiler died     free            held          loops closed');
    for (const arm of arms) {
      const n = { prey: 0, coiler: 0, free: 0, held: 0 };
      let closed = 0;
      const t0 = Date.now();
      for (let i = 0; i < N; i++) {
        const r = encounter({ seed: (SEED + i) >>> 0, coiler, arm, prey: level, secs: SECS, dist: DIST, coilerReach: CREACH });
        n[r.outcome]++;
        if (r.loop >= 6) closed++;
      }
      console.log(`  ${arm.padEnd(9)}  ${ci(n.prey)}  ${ci(n.coiler)}  ${ci(n.free)}  ${ci(n.held)}  ${closed} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
  }
}
