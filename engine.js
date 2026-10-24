/* Wigglefeast — game simulation. No DOM access here so it can run headless. */
(function (root) {
  'use strict';

  const CFG = {
    BASE_SPEED: 230,
    BOOST_MULT: 2.1,
    BOOST_COST_BASE: 1.5, // boosting costs BASE + SHARE of mass per second; 60% of it drops as food (#125)
    BOOST_COST_SHARE: 0.005,
    START_MASS: 15,
    MIN_BOOST_MASS: 12,
    CELL: 96,
    POWERUP_TIME: 16,
    TURN_POWER_MULT: 2, // turn-rate multiplier while the tight-turn power-up runs (#38)
    // Refill rates per simulated second, so pacing doesn't depend on the display's refresh rate (#48).
    // Equal to the old per-update amounts at 60 updates per second: 10 food, and a 3% power-up chance.
    FOOD_REFILL_RATE: 600,
    POWERUP_SPAWN_RATE: -Math.log(0.97) * 60,
    POWERUP_REACH: 60, // power-ups slide toward heads this far beyond the head's edge (just past their glow)
    MAGNET_REACH: 230, // extra pull range for food and power-ups while the magnet runs
    SPAWN_SHIELD: 2.5,
    // Very large worms shed mass so nobody grows forever: SHED_RATE of the mass above
    // SHED_ABOVE per second. Late and gentle, so a worm that keeps winning can grow massive (#82).
    SHED_ABOVE: 10000,
    SHED_RATE: 0.002,
    REMAINS_TIME: 60, // longest scavenging bots remember remains: as long as a remains pellet lives (#78, #122)
    REMAINS_REFRESH: 0.25, // seconds between re-counting what is left of each worm's remains (#122)
    HUNT_ODDS: 0.5, // a hunt is worth this share of what the kill drops, against a meal of remains (#122)
    // Learning the player's habits (#135): how they escape a bot cutting them off.
    HABIT_DECAY: 0.92, // per encounter, every count keeps this share: a half-life of about 8 encounters
    HABIT_RANGE: 300, // a cut-off counts when the cutter's head is this close, ahead of the player
    HABIT_WINDOW: 0.6, // seconds of the player's movement that make up the outcome
    HABIT_GAP: 1, // at least this many seconds between the starts of two encounters
    HABIT_STRAIGHT: 0.15, // a net turn under this (radians) is keeping straight
    HABIT_EVIDENCE: 6, // confidence n / (n + this): half-confident after this many encounters
    HABIT_MAX: 0.75, // the most a habit can move the aim, as a share of a full sideways shift
    // Food / power-up density per unit of world area (tuned for a 3600 radius world).
    FOOD_DENSITY: 2600 / (Math.PI * 3600 * 3600),
    POWERUP_DENSITY: 26 / (Math.PI * 3600 * 3600),
    // Special food (#143): rare, high-value items that vanish if nobody eats them.
    SPECIAL_DENSITY: 5 / (Math.PI * 3600 * 3600), // all kinds together: 5 in a 30-bot world
    SPECIAL_SPAWN_RATE: 0.06, // spawns per second per item of the target, so big arenas fill as fast
    SPECIAL_LIFE: 20,
    SPECIAL_BLINK: 4, // seconds of blinking before one vanishes
    SPECIAL_R: 16, // pickup radius
  };

  const TAU = Math.PI * 2;
  // Seedable random numbers (mulberry32): each world draws from its own stream, so a world
  // replays exactly from its seed (#100). rng() returns [0, 1) like Math.random.
  function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const newSeed = () => Math.floor(Math.random() * 4294967296);
  const rand = (rng, a, b) => a + rng() * (b - a);
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function angleDiff(from, to) {
    let d = (to - from) % TAU;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    return d;
  }
  function randomInCircle(rng, R) {
    const a = rng() * TAU, d = R * Math.sqrt(rng());
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  }
  function weighted(rng, table) {
    let total = 0;
    for (const k in table) total += table[k];
    let t = rng() * total;
    for (const k in table) { t -= table[k]; if (t <= 0) return k; }
    return Object.keys(table)[0];
  }

  // Size curves: everything derives from mass.
  // Above MASSIVE a worm grows mostly thicker: its length grows more slowly, and its radius
  // keeps growing up to 90, so a massive worm looks massive without walling off the arena (#82).
  const MASSIVE = 10000;
  const radiusFor = (m) => Math.min(90, 9 + 2.2 * Math.pow(Math.max(m, 1), 0.3));
  const lengthFor = (m) => (m <= MASSIVE ? 40 + 9 * Math.pow(Math.max(m, 1), 0.72)
    : (40 + 9 * Math.pow(MASSIVE, 0.72)) * Math.pow(m / MASSIVE, 0.4));
  const spacingFor = (r) => r * 0.42;
  const turnRateFor = (r) => 5.4 / (1 + (r - 14) / 45);
  const foodRadius = (v) => Math.min(20, 3 + Math.sqrt(v) * 2.4);

  const SKINS = [
    { name: 'Cherry Pop', colors: ['#ff595e', '#ffca3a'] },
    { name: 'Lagoon', colors: ['#4cc9f0', '#4361ee', '#3a0ca3'] },
    { name: 'Lime Ocean', colors: ['#8ac926', '#1982c4'] },
    { name: 'Rainbow', colors: ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'], hidden: true },
    { name: 'Candy Cane', colors: ['#ffffff', '#ef233c'] },
    { name: 'Bumblebee', colors: ['#2b2b2b', '#ffd60a'] },
    { name: 'Neon Night', colors: ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0'] },
    { name: 'Mint', colors: ['#2ec4b6', '#cbf3f0'] },
    { name: 'Lavender', colors: ['#ffd6ff', '#e7c6ff', '#c8b6ff', '#b8c0ff'], hidden: true },
    { name: 'Sailor', colors: ['#e63946', '#f1faee', '#a8dadc', '#457b9d'] },
    { name: 'Tangerine', colors: ['#ff9f1c', '#ffbf69', '#fff3e0'] },
    { name: 'Emerald', colors: ['#06d6a0', '#118ab2'] },
    { name: 'Grape', colors: ['#6a4c93', '#f15bb5'] },
    { name: 'Lava', colors: ['#d00000', '#ffba08', '#dc2f02'] },
    // Saves store a skin by its position: only ever append, never remove or reorder (#58).
    // finish: how the body is drawn (main.js). colors: that finish's colours. accent: minimap
    // dot and boost arrows. food: what the worm drops. hidden: not offered or given to new bots.
    { name: 'Aurora', finish: 'gradient', colors: ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5'] },
    { name: 'Sunset Drive', finish: 'gradient', colors: ['#ffbe0b', '#fb5607', '#ff006e', '#8338ec'] },
    { name: 'Synthwave', finish: 'neon', colors: ['#160b2e', '#ff2e88', '#2de2e6'], accent: '#ff2e88', food: ['#ff2e88', '#2de2e6'] },
    { name: 'Toxic', finish: 'neon', colors: ['#0c1a0f', '#b8ff3c', '#f2ff8a'], accent: '#b8ff3c', food: ['#b8ff3c', '#f2ff8a'] },
    { name: 'Gold Rush', finish: 'metallic', colors: ['#b8862b', '#fff1b8', '#5c3d0c'], accent: '#e0b44c', food: ['#e0b44c', '#fff1b8'] },
    { name: 'Chrome', finish: 'metallic', colors: ['#7d8896', '#ffffff', '#2c333c'], accent: '#c9d1da', food: ['#c9d1da', '#ffffff'] },
    { name: 'Ladybug', finish: 'spots', colors: ['#e5383b', '#161a1d'], food: ['#e5383b', '#ff7a7c'] },
    { name: 'Leopard', finish: 'spots', colors: ['#e9a15a', '#3d2412', '#c47a35'], food: ['#e9a15a', '#f6c58f'] },
    { name: 'Viper', finish: 'scales', colors: ['#2f5d3a', '#c5e063', '#173020'], accent: '#c5e063', food: ['#c5e063', '#7fb069'] },
    { name: 'Galaxy', finish: 'galaxy', colors: ['#0b1030', '#5a189a', '#ffffff'], accent: '#b98cff', food: ['#b98cff', '#ffffff', '#7b6cff'] },
    { name: 'Magma', finish: 'pulse', colors: ['#2b0b05', '#ff7a00'], accent: '#ff7a00', food: ['#ff7a00', '#ffb347'] },
    { name: 'Abyss', finish: 'pulse', colors: ['#041c32', '#00e5ff'], accent: '#00e5ff', food: ['#00e5ff', '#7df9ff'] },
  ];
  for (const skin of SKINS) {
    skin.finish = skin.finish || 'stripes';
    skin.accent = skin.accent || skin.colors[0];
    skin.food = skin.food || skin.colors;
    skin.hidden = !!skin.hidden;
  }
  const PICKABLE_SKINS = SKINS.filter((skin) => !skin.hidden);

  const BOT_NAMES = [
    'Slinky', 'Noodle', 'Wiggles', 'Sir Hiss', 'Spaghetti', 'Gummy', 'Zigzag', 'Squiggle',
    'Dr. Worm', 'Lil Byte', 'Mamba', 'Pretzel', 'Sprinkles', 'Jellybean', 'Turbo', 'Nibbles',
    'Licorice', 'Ramen', 'Boba', 'Taffy', 'Glowstick', 'Mochi', 'Pixel', 'Udon', 'Bubbles',
    'Doodle', 'Twister', 'Churro', 'Shoelace', 'Zippy', 'Fettuccine', 'Marshmallow', 'Cosmo',
    'Kiwi', 'Biscuit', 'Waffles', 'Nova', 'Cinnamon', 'Pickles', 'Rascal', 'Snek', 'Tofu',
    'Orbit', 'Domino', 'Jinx', 'Ziggy', 'Lasagna', 'Peaches', 'Hydra', 'Viper', 'Gizmo',
    'Sushi', 'Disco', 'Maple', 'Echo', 'Rocket', 'Noodlord', 'Captain Slurp', 'Wormzilla',
    'Gobbler', 'Slurpy', 'Tangle', 'Spiral', 'Comet', 'Bean', 'Fizz', 'Pudding', 'Macaroni',
  ];

  const FOOD_COLORS = [
    '#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#f72585', '#4cc9f0',
    '#ff9f1c', '#2ec4b6', '#ffd6ff', '#b8f2e6', '#f15bb5', '#00f5d4', '#fee440',
  ];

  // Save files written before the rename used 'worm-arena'; both load fine.
  const SAVE_APP_IDS = ['wigglefeast', 'worm-arena'];

  const POWERUP_WEIGHTS = { magnet: 30, x2: 22, x5: 5, speed: 20, zoom: 14, turn: 14 };

  // Special food kinds (#143): value in mass and spawn weight. Only append.
  const SPECIALS = {
    nova: { value: 25, weight: 60 },
    nebula: { value: 50, weight: 30 },
    plasma: { value: 100, weight: 10 },
  };
  const SPECIAL_WEIGHTS = Object.fromEntries(Object.entries(SPECIALS).map(([k, s]) => [k, s.weight]));
  const MAX_SPECIALS = 200; // save limit; a 150-bot world holds about 28

  // Bot tactics (#78). Their order is part of each bot's identity (see knowsTactic):
  // only ever append.
  const TACTICS = ['predict', 'anticipate', 'evade', 'headOn', 'scavenge', 'trap', 'pin', 'coil', 'flank', 'read', 'learn', 'escape'];
  const tactics = (shares) => Object.fromEntries(TACTICS.map((k) => [k, shares[k] || 0]));

  // Per difficulty (#16). skill: look-ahead, reaction time and steering precision.
  // aggro: how often and how far a bot hunts. preyRatio: it hunts worms lighter than this
  // times its own mass. bigShare: share of the bots in a new world that start large, at
  // up to bigMax mass; the rest start small. tactics: share of bots that know each tactic.
  // sharp (expert only, #110): sharper than skill allows, applied when a bot thinks, so nothing
  // is saved. think: re-plan delay x; look: look-ahead x; dense: check the winning heading
  // closely (1/0); headings: candidates x; sense: threat-sensing range x; heads: heads tracked;
  // escape: steer clear of every cutter, not only the nearest (1/0); reach: before boosting, check the
  // turn a boost would really take (1/0, #149). 1 (or 8 heads) is off.
  const DIFFICULTY = {
    easy: { skill: [0.12, 0.45], aggro: [0.0, 0.35], preyRatio: 1, bigShare: 0.1, bigMax: 1200, tactics: tactics({}) },
    normal: {
      skill: [0.35, 0.8], aggro: [0.1, 0.65], preyRatio: 1.3, bigShare: 0.15, bigMax: 2000,
      tactics: tactics({ predict: 0.5, anticipate: 0.3, evade: 0.3, headOn: 0.2, scavenge: 0.3, read: 0.2 }),
    },
    hard: {
      skill: [0.7, 1.0], aggro: [0.35, 1.0], preyRatio: 1.6, bigShare: 0.2, bigMax: 2500,
      tactics: tactics({ predict: 1, anticipate: 0.7, evade: 0.6, headOn: 0.5, scavenge: 0.5, trap: 0.4, pin: 0.4, coil: 0.3, read: 0.5, escape: 0.5 }),
    },
    expert: {
      skill: [0.85, 1.0], aggro: [0.6, 1.0], preyRatio: 2, bigShare: 0.35, bigMax: 5000,
      tactics: tactics(Object.fromEntries(TACTICS.map((k) => [k, 1]))),
      sharp: { think: 0.7, look: 1.25, dense: 1, headings: 1.3, sense: 1.4, heads: 12, escape: 1, reach: 1 },
    },
  };
  const DIFFICULTIES = Object.keys(DIFFICULTY);

  // A bot knows a tactic when a hash of its id and the tactic falls below the level's share,
  // so it keeps the same tactics for life, across saves, without storing them.
  function hash01(a, b) {
    let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }
  function knowsTactic(w, difficulty, tactic) {
    const share = (DIFFICULTY[difficulty] || DIFFICULTY.normal).tactics[tactic];
    return share > 0 && hash01(w.id, TACTICS.indexOf(tactic)) < share;
  }

  // Limits shared by save validation and the simulation, so a world loaded from a
  // valid save can never grow into one that fails validation (#31).
  const MAX_MASS = 1e6; // ~1,150 body segments (#82); normal play stays far below (mass sheds above 10,000)
  const MAX_SEGMENTS = 20000;
  const MAX_FOOD = 50000;
  const MAX_ID = 1e9;
  const MIN_BOTS = 5, MAX_BOTS = 150; // #81

  // Arena radius for a bot count: 1800 + 60 per bot up to 60 bots (worlds made before #81
  // keep their size); above that the area grows in proportion, so each bot keeps the same room.
  const arenaRadius = (bots) => (bots <= 60 ? 1800 + 60 * bots : 5400 * Math.sqrt(bots / 60));
  const MAX_TIME = 1e9; // seconds of world time; keeps the save rounding (x100) finite

  // The record of the player's habits (#135): decayed counts of how they escaped a bot cutting
  // them off. side: turned away from the cutter, toward it, or kept straight. boost: boosted or
  // not. It belongs to the player, not to a world: main.js keeps it between games, outside the
  // world save and the export.
  const HABIT_KEYS = ['away', 'toward', 'straight', 'boost', 'still'];
  const freshHabits = () => ({ v: 1, away: 0, toward: 0, straight: 0, boost: 0, still: 0 });
  // Stored records are untrusted: every count must be a finite number from 0 to 1e6.
  const validHabits = (h) => h !== null && typeof h === 'object' && !Array.isArray(h) && h.v === 1 &&
    HABIT_KEYS.every((k) => typeof h[k] === 'number' && Number.isFinite(h[k]) && h[k] >= 0 && h[k] <= 1e6);
  // One encounter: older ones fade, then the outcome counts 1.
  function recordHabit(h, side, boosted) {
    for (const k of HABIT_KEYS) h[k] *= CFG.HABIT_DECAY;
    h[side] += 1;
    h[boosted ? 'boost' : 'still'] += 1;
  }
  // How much to trust a split seen over n encounters: grows with evidence, never above HABIT_MAX.
  const habitConf = (n) => Math.min(CFG.HABIT_MAX, n / (n + CFG.HABIT_EVIDENCE));
  // From -HABIT_MAX (always turns toward the cutter) to HABIT_MAX (always turns away); 0 without evidence.
  function habitBias(h) {
    const n = h.away + h.toward;
    return n > 0 ? (habitConf(n) * (h.away - h.toward)) / n : 0;
  }
  // How likely the player is to boost out of a cut-off, from 0 to HABIT_MAX.
  function habitBoost(h) {
    const n = h.boost + h.still;
    return n > 0 ? (habitConf(n) * h.boost) / n : 0;
  }

  // ---------------------------------------------------------------------------
  // Save files are untrusted input (they can be imported from anywhere), so check
  // every field load() relies on before building a world from one. Numbers are
  // range-checked too: finite but extreme values overflow to NaN or stall bots (#31),
  // and values must be consistent and survive being saved again (#46).
  function validateSnapshot(snap) {
    const fail = (why) => { throw new Error('Invalid Wigglefeast save: ' + why); };
    const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const fin = (v) => typeof v === 'number' && Number.isFinite(v);
    const finArr = (a, max) => Array.isArray(a) && a.length <= max && a.every(fin);
    const has = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);
    const inRange = (v, a, b) => fin(v) && v >= a && v <= b;
    const isId = (v) => Number.isInteger(v) && v >= 1 && v <= MAX_ID;

    if (!isObj(snap) || !SAVE_APP_IDS.includes(snap.app) || snap.v !== 1) fail('not a world snapshot');
    const s = snap.settings;
    if (!isObj(s) || !Number.isInteger(s.botCount) || s.botCount < MIN_BOTS || s.botCount > MAX_BOTS || !has(DIFFICULTY, s.difficulty)) fail('settings');
    if (!inRange(snap.time, 0, MAX_TIME)) fail('time');
    if (snap.nextId !== undefined && !isId(snap.nextId)) fail('nextId');
    // Everything lives inside the arena; twice its radius leaves plenty of slack.
    const B = 2 * arenaRadius(s.botCount);
    const coord = (v) => inRange(v, -B, B);
    const angle = (v) => inRange(v, -1e9, 1e9); // the player's keyboard heading isn't wrapped

    if (!Array.isArray(snap.worms) || snap.worms.length > 200) fail('worms');
    let players = 0;
    const ids = new Set();
    for (const w of snap.worms) {
      if (!isObj(w) || typeof w.name !== 'string' || w.name.length > 40) fail('worm name');
      if (!Number.isInteger(w.skin) || w.skin < 0 || w.skin >= SKINS.length) fail('worm skin');
      for (const k of ['id', 'mass', 'angle', 'targetAngle', 'kills', 'eaten', 'dropAcc', 'shield', 'born', 'peak']) if (!fin(w[k])) fail('worm ' + k);
      if (!isId(w.id) || ids.has(w.id)) fail('worm id');
      ids.add(w.id);
      if (w.mass < 1 || w.mass > MAX_MASS) fail('worm mass');
      if (!angle(w.angle) || !angle(w.targetAngle)) fail('worm heading');
      if (w.dropAcc < 0 || w.dropAcc > 1000) fail('worm dropAcc');
      if (![w.kills, w.eaten].every((v) => Number.isInteger(v) && v >= 0 && v <= 1e9)) fail('worm counters');
      if (w.born < 0 || w.born > snap.time) fail('worm born'); // a run can't start after the save
      if (!inRange(w.peak, 0, 1e7) || !inRange(w.shield, 0, 1e6)) fail('worm peak or shield');
      if (!finArr(w.sx, MAX_SEGMENTS) || !finArr(w.sy, MAX_SEGMENTS) || w.sx.length !== w.sy.length || w.sx.length < 2 ||
        !w.sx.every(coord) || !w.sy.every(coord)) fail('worm body');
      if (!isObj(w.pw) || Object.keys(w.pw).some((k) => !has(POWERUP_WEIGHTS, k) || !inRange(w.pw[k], 0, 1e6))) fail('worm power-ups');
      if (w.isPlayer === true) players++;
      if ((w.isPlayer === true) === (w.ai != null)) fail('worm kind'); // players have no brain, bots do
      if (w.ai != null) {
        const a = w.ai;
        if (!isObj(a) || !inRange(a.skill, 0, 1) || !inRange(a.aggro, 0, 1) || !inRange(a.interval, 0.05, 1) ||
          !coord(a.wx) || !coord(a.wy) || !fin(a.huntUntil) || !(a.prey == null || fin(a.prey))) fail('bot state');
      }
    }
    if (players > 1) fail('more than one player');

    if (!Array.isArray(snap.palette) || snap.palette.length > 1000 || !snap.palette.every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))) fail('colours');
    const F = snap.food;
    if (!finArr(F, 7 * MAX_FOOD) || F.length % 7 !== 0) fail('food');
    for (let i = 0; i < F.length; i += 7) {
      // Value >= 0.01 so it can't round to 0 when saved again; life is -1 (natural food) or a timer.
      if (!coord(F[i]) || !coord(F[i + 1]) || F[i + 2] < 0.01 || F[i + 2] > 1e6 ||
        !(F[i + 4] === -1 || inRange(F[i + 4], 0, 1e6)) || !inRange(F[i + 5], -1e6, 1e6)) fail('food values');
    }
    if (!Array.isArray(snap.powerups) || snap.powerups.length > 500 ||
      !snap.powerups.every((p) => isObj(p) && has(POWERUP_WEIGHTS, p.type) && coord(p.x) && coord(p.y) && inRange(p.ph, -1e6, 1e6))) fail('power-ups');
    // Optional: saves from before special food (#143) have none. Life isn't capped by SPECIAL_LIFE
    // here: load() clamps it, so tuning that constant down never rejects an existing save.
    if (snap.specials !== undefined && (!Array.isArray(snap.specials) || snap.specials.length > MAX_SPECIALS ||
      !snap.specials.every((p) => isObj(p) && has(SPECIALS, p.kind) && coord(p.x) && coord(p.y) &&
        fin(p.life) && p.life > 0 && p.life <= 1e6 && inRange(p.ph, -1e6, 1e6)))) fail('special food');
    if (snap.respawnQueue !== undefined && !(finArr(snap.respawnQueue, 500) && snap.respawnQueue.every((t) => inRange(t, 0, 2 * MAX_TIME)))) fail('respawn queue');
  }

  // ---------------------------------------------------------------------------
  // Uniform grid storing (a, b) integer pairs per cell. Rebuilt every tick.
  class Grid {
    constructor(cell, half) {
      this.cell = cell;
      this.off = half;
      this.n = Math.ceil((2 * half) / cell);
      this.cells = new Array(this.n * this.n);
      for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
      this.dirty = [];
    }
    clear() {
      for (const i of this.dirty) this.cells[i].length = 0;
      this.dirty.length = 0;
    }
    insert(x, y, a, b) {
      const n = this.n;
      const cx = clamp(Math.floor((x + this.off) / this.cell), 0, n - 1);
      const cy = clamp(Math.floor((y + this.off) / this.cell), 0, n - 1);
      const i = cy * n + cx;
      const c = this.cells[i];
      if (c.length === 0) this.dirty.push(i);
      c.push(a, b);
    }
    // Calls cb(a, b) for every entry in cells overlapping the square; stops when cb returns true.
    query(x, y, rad, cb) {
      const c = this.cell, o = this.off, n = this.n - 1;
      const cx0 = clamp(Math.floor((x - rad + o) / c), 0, n);
      const cx1 = clamp(Math.floor((x + rad + o) / c), 0, n);
      const cy0 = clamp(Math.floor((y - rad + o) / c), 0, n);
      const cy1 = clamp(Math.floor((y + rad + o) / c), 0, n);
      for (let cy = cy0; cy <= cy1; cy++) {
        const row = cy * this.n;
        for (let cx = cx0; cx <= cx1; cx++) {
          const arr = this.cells[row + cx];
          for (let k = 0; k < arr.length; k += 2) if (cb(arr[k], arr[k + 1])) return true;
        }
      }
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Ids for worms made outside a Game (tests); a Game hands out its own from 1 (game.nextId).
  // Kept far above any world's ids, so adding such a worm to a world never duplicates an id,
  // and below MAX_ID, so the world still saves.
  let nextId = MAX_ID / 2 + 1;

  class Worm {
    constructor(o) {
      this.id = o.id || nextId++;
      this.name = o.name;
      this.skin = o.skin;
      this.isPlayer = !!o.isPlayer;
      this.mass = o.mass;
      this.angle = o.angle;
      this.targetAngle = o.targetAngle !== undefined ? o.targetAngle : o.angle;
      this.wantBoost = false;
      this.boosting = false;
      this.speed = CFG.BASE_SPEED;
      this.turnRate = 0; // observed heading change per second, smoothed; what bots predict with (#78)
      this.dead = false;
      this.kills = o.kills || 0;
      this.eaten = o.eaten || 0;
      this.dropAcc = o.dropAcc || 0;
      this.shield = o.shield || 0;
      this.pw = Object.assign({ magnet: 0, x2: 0, x5: 0, speed: 0, zoom: 0, turn: 0 }, o.pw);
      this.ai = o.ai || null;
      const rng = o.rng || Math.random; // the world's random numbers; Math.random outside a Game
      this.thinkT = rng() * 0.3;
      this.born = o.time || 0;
      this.peak = Math.max(o.peak || 0, this.mass);
      this.r = radiusFor(this.mass);

      if (o.sx && o.sy && o.sx.length === o.sy.length && o.sx.length > 1) {
        this.sx = o.sx;
        this.sy = o.sy;
        this.updateBounds();
        return;
      }

      // Lay the body out behind the head, curling away from the wall.
      const sp = spacingFor(this.r);
      const n = Math.max(6, Math.ceil(lengthFor(this.mass) / sp));
      const lim = o.worldR * 0.85;
      this.sx = new Array(n);
      this.sy = new Array(n);
      let px = o.x, py = o.y, b = o.angle + Math.PI;
      const curl = rand(rng, -0.06, 0.06);
      for (let i = 0; i < n; i++) {
        this.sx[i] = px;
        this.sy[i] = py;
        b += curl;
        if (px * px + py * py > lim * lim) b += clamp(angleDiff(b, Math.atan2(-py, -px)), -0.3, 0.3);
        px += Math.cos(b) * sp;
        py += Math.sin(b) * sp;
      }
      this.updateBounds();
    }

    get x() { return this.sx[0]; }
    get y() { return this.sy[0]; }
    get multiplier() { return this.pw.x5 > 0 ? 5 : this.pw.x2 > 0 ? 2 : 1; }
    // Colour of the food dropped at segment i: the skin's food colours, banded like stripes.
    stripeColor(i) { const c = this.skin.food; return c[Math.floor(i / 3) % c.length]; }

    update(dt, g) {
      if (this.shield > 0) this.shield -= dt;
      const pw = this.pw;
      for (const k in pw) if (pw[k] > 0) pw[k] = Math.max(0, pw[k] - dt);

      const r = (this.r = radiusFor(this.mass));
      const sp = spacingFor(r);

      const maxTurn = turnRateFor(r) * dt * (this.boosting ? 0.85 : 1) * (pw.turn > 0 ? CFG.TURN_POWER_MULT : 1);
      const turn = clamp(angleDiff(this.angle, this.targetAngle), -maxTurn, maxTurn);
      this.angle += turn;
      if (dt > 0) this.turnRate += (turn / dt - this.turnRate) * Math.min(1, dt / 0.3);
      if (this.angle > Math.PI) this.angle -= TAU;
      else if (this.angle < -Math.PI) this.angle += TAU;

      this.boosting = false;
      if (this.wantBoost) {
        if (pw.speed > 0) this.boosting = true;
        else if (this.mass > CFG.MIN_BOOST_MASS) {
          this.boosting = true;
          const drain = (CFG.BOOST_COST_BASE + this.mass * CFG.BOOST_COST_SHARE) * dt;
          this.mass -= drain;
          this.dropAcc += drain * 0.6;
        }
      }
      const speed = (this.speed = CFG.BASE_SPEED * (pw.speed > 0 ? 1.25 : 1) * (this.boosting ? CFG.BOOST_MULT : 1));

      const sx = this.sx, sy = this.sy;
      sx[0] += Math.cos(this.angle) * speed * dt;
      sy[0] += Math.sin(this.angle) * speed * dt;
      const n = sx.length, sp2 = sp * sp;
      for (let i = 1; i < n; i++) {
        const dx = sx[i - 1] - sx[i], dy = sy[i - 1] - sy[i];
        const d2 = dx * dx + dy * dy;
        if (d2 > sp2) {
          const d = Math.sqrt(d2), k = (d - sp) / d;
          sx[i] += dx * k;
          sy[i] += dy * k;
        }
      }

      if (this.dropAcc >= 1.5) {
        const t = n - 1;
        g.addFood(sx[t] + rand(g.rng, -r, r) * 0.5, sy[t] + rand(g.rng, -r, r) * 0.5, this.dropAcc, this.stripeColor(t), 18);
        this.dropAcc = 0;
      }

      const target = Math.max(6, Math.ceil(lengthFor(this.mass) / sp));
      if (target > n) {
        const lx = sx[n - 1], ly = sy[n - 1];
        for (let i = n; i < target; i++) { sx.push(lx); sy.push(ly); }
      } else if (target < n) {
        sx.length = target;
        sy.length = target;
      }

      // Very large worms slowly shed mass so nobody grows forever.
      if (this.mass > CFG.SHED_ABOVE) this.mass -= (this.mass - CFG.SHED_ABOVE) * CFG.SHED_RATE * dt;

      if (this.mass > this.peak) this.peak = this.mass;
      this.updateBounds();
    }

    updateBounds() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const sx = this.sx, sy = this.sy;
      for (let i = 0; i < sx.length; i++) {
        const x = sx[i], y = sy[i];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const p = this.r + 12;
      this.minX = x0 - p; this.maxX = x1 + p; this.minY = y0 - p; this.maxY = y1 + p;
    }
  }

  // ---------------------------------------------------------------------------
  // Bot brain. Picks a mode (evade, hunt, head-on, scavenge, or the plain goals: power-up,
  // food, wander point), then samples candidate headings and rejects those that run into
  // bodies, the wall or, for bots that anticipate, the path a nearby head is about to cover.
  // Tactics (#78) only use what a player could see: positions, headings, sizes and observed
  // turning (turnRate), never a worm's targetAngle.
  const SAMPLE_T = [0.15, 0.35, 0.62, 1];
  const SAMPLE_W = [12, 6, 3, 1.5];
  // Danger weight of a hit at fraction f of the look-ahead, between the SAMPLE_T points (#110).
  function dangerAt(f) {
    if (f <= SAMPLE_T[0]) return SAMPLE_W[0];
    for (let j = 1; j < SAMPLE_T.length; j++) {
      if (f <= SAMPLE_T[j]) return SAMPLE_W[j - 1] + ((f - SAMPLE_T[j - 1]) / (SAMPLE_T[j] - SAMPLE_T[j - 1])) * (SAMPLE_W[j] - SAMPLE_W[j - 1]);
    }
    return SAMPLE_W[SAMPLE_W.length - 1];
  }
  const GHOST_T = [0.25, 0.5, 0.75];
  const EVADE_T = [0.25, 0.5, 0.75, 1];
  const HEAD_ON = 0.85; // a head-on collision is a safe win against worms under this share of own mass

  // headMass: the first 3 segments of worms lighter than this don't count (a head-on win).
  // other: a second worm to ignore besides self; otherSegs: only its first otherSegs segments.
  function hitAt(g, self, px, py, rad, headMass = 0, other = null, otherSegs = Infinity) {
    const lim = g.R - rad;
    if (px * px + py * py > lim * lim) return true;
    const gw = g.gridWorms;
    return g.segGrid.query(px, py, rad + g.maxR, (oi, si) => {
      const o = gw[oi];
      if (o === self || (o === other && si < otherSegs) || o.dead) return false;
      if (si < 3 && o.mass < headMass) return false;
      const dx = o.sx[si] - px, dy = o.sy[si] - py, rr = rad + o.r;
      return dx * dx + dy * dy < rr * rr;
    });
  }

  // Where a worm's head will be after t seconds if it keeps its speed (or speed v) and observed turning.
  function predictHead(o, t, v = o.speed) {
    const a = o.angle, x = o.sx[0], y = o.sy[0];
    const turn = clamp(o.turnRate * t, -Math.PI, Math.PI);
    if (Math.abs(turn) < 1e-3) return { x: x + Math.cos(a) * v * t, y: y + Math.sin(a) * v * t, a };
    const k = (v * t) / turn; // radius of the arc
    return { x: x + k * (Math.sin(a + turn) - Math.sin(a)), y: y - k * (Math.cos(a + turn) - Math.cos(a)), a: a + turn };
  }

  // Reachable paths (#149). A worm turns toward its target heading at full rate, the shortest way,
  // then goes straight: Worm.update has no turning momentum. reachPath gives the shape of that
  // move toward heading a, at normal speed or boosting; reachAt(p, s) the point s along it.
  function reachPath(w, a, boosted) {
    const v = CFG.BASE_SPEED * (w.pw.speed > 0 ? 1.25 : 1) * (boosted ? CFG.BOOST_MULT : 1);
    const om = turnRateFor(w.r) * (boosted ? 0.85 : 1) * (w.pw.turn > 0 ? CFG.TURN_POWER_MULT : 1);
    const a0 = w.angle, d = angleDiff(a0, a), k = (Math.sign(d) || 1) * (v / om); // signed turn radius
    const hx = w.sx[0], hy = w.sy[0];
    return {
      hx, hy, a0, k, d, v, s1: Math.abs(d) * (v / om),
      x1: hx + k * (Math.sin(a0 + d) - Math.sin(a0)), y1: hy - k * (Math.cos(a0 + d) - Math.cos(a0)),
      c: Math.cos(a), s: Math.sin(a),
    };
  }
  const REACH_PT = { x: 0, y: 0 }; // reused: reachAt runs for every probe point
  function reachAt(p, s) {
    if (s < p.s1) {
      const th = s / p.k; // the turn so far, signed like k
      REACH_PT.x = p.hx + p.k * (Math.sin(p.a0 + th) - Math.sin(p.a0));
      REACH_PT.y = p.hy - p.k * (Math.cos(p.a0 + th) - Math.cos(p.a0));
    } else {
      REACH_PT.x = p.x1 + p.c * (s - p.s1);
      REACH_PT.y = p.y1 + p.s * (s - p.s1);
    }
    return REACH_PT;
  }

  // Share of directions around a worm's head that are clear for 250 px, ignoring the worm
  // itself and the hunter asking. side 0: all 8 directions; side +1 / -1: the 3 directions
  // on that side of its heading (+1 is angle + 90 degrees).
  function freedom(g, o, hunter, side) {
    const dirs = side ? [0.25, 0.5, 0.75].map((f) => side * f * Math.PI) : [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (k * TAU) / 8);
    let clear = 0;
    for (const da of dirs) {
      const c = Math.cos(o.angle + da), s = Math.sin(o.angle + da);
      let ok = true;
      for (const t of [80, 160, 250]) if (hitAt(g, o, o.sx[0] + c * t, o.sy[0] + s * t, o.r + 4, 0, hunter)) { ok = false; break; }
      if (ok) clear++;
    }
    return clear / dirs.length;
  }

  // Coil escape (#94): the circle a clearly bigger nearby head is turning on, if our head is inside
  // it. Only what a player could see: mass, observed turning, speed and positions, never o.ai.
  // dir: +1 when it circles counter-clockwise (turnRate > 0), -1 clockwise.
  function coilCircle(w, o) {
    if (o.mass < 1.5 * w.mass) return null;
    const tr = o.turnRate;
    if (Math.abs(tr) < 1.2) return null;
    const rho = o.speed / Math.abs(tr), dir = tr > 0 ? 1 : -1;
    if (rho > 500) return null;
    const cx = o.sx[0] - Math.sin(o.angle) * rho * dir, cy = o.sy[0] + Math.cos(o.angle) * rho * dir;
    if (Math.hypot(cx - w.sx[0], cy - w.sy[0]) >= rho - o.r) return null;
    return { cx, cy, rho, dir };
  }
  const CIRCLED_HOLD = 0.5; // seconds a bot stays circled after the signs last held (#94)

  // The point to cross in front of a prey. Without prediction: ahead along its heading, by
  // more the farther it is. With prediction: where its curving path meets ours. fast: how much
  // faster than now the prey is expected to go (1: as fast as now).
  function cutPoint(w, o, predict, fast = 1) {
    const hx = w.sx[0], hy = w.sy[0], lead = w.r * 2 + o.r * 2;
    if (!predict) {
      const l = lead + Math.hypot(o.sx[0] - hx, o.sy[0] - hy) * 0.6 * fast;
      return { x: o.sx[0] + Math.cos(o.angle) * l, y: o.sy[0] + Math.sin(o.angle) * l, a: o.angle };
    }
    const sp = Math.max(w.speed, CFG.BASE_SPEED);
    let t = Math.hypot(o.sx[0] - hx, o.sy[0] - hy) / sp, p = null;
    for (let i = 0; i < 3; i++) {
      p = predictHead(o, Math.min(t, 2), o.speed * fast);
      t = Math.hypot(p.x - hx, p.y - hy) / sp;
    }
    return { x: p.x + Math.cos(p.a) * lead, y: p.y + Math.sin(p.a) * lead, a: p.a };
  }

  // ghost: flat [x, y, t, r] points nearby heads reach t seconds from now. One we would reach
  // later than its head (tau >= t) is body by then.
  function ghostHit(ghost, px, py, rad, tau) {
    for (let i = 0; i < ghost.length; i += 4) {
      if (ghost[i + 2] > tau + 0.1) continue;
      const dx = ghost[i] - px, dy = ghost[i + 1] - py, rr = rad + ghost[i + 3];
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }

  // Reading other worms (#83): each bot that knows `read` remembers, per worm id, kills it saw
  // that worm make and grudges (the worm tried to cut it off, or killed right next to it).
  // Values fade by half-life; nothing here is saved.
  const KILL_HALF = 15, GRUDGE_HALF = 10, SEEN_MAX = 16, KILL_VIEW = 900, KILL_NEAR = 300;
  // One event stores 1 and fades from there: it counts while at least SEEN_MIN is left, so one seen
  // kill counts for 30 s (two half-lives) and one grudge for 20 s.
  const SEEN_MIN = 0.25;
  function recall(ai, id, now) {
    const m = ai.seen && ai.seen.get(id);
    if (!m) return null;
    const dt = now - m.at;
    if (dt > 0) {
      m.kills *= Math.pow(0.5, dt / KILL_HALF);
      m.grudge *= Math.pow(0.5, dt / GRUDGE_HALF);
      m.at = now;
    }
    if (m.kills < 0.05 && m.grudge < 0.05 && now - m.cutAt >= 1) { ai.seen.delete(id); return null; }
    return m;
  }
  function remember(ai, id, now) {
    if (!ai.seen) ai.seen = new Map();
    let m = recall(ai, id, now);
    if (!m) {
      m = { kills: 0, grudge: 0, at: now, cutAt: -Infinity };
      ai.seen.set(id, m);
      if (ai.seen.size > SEEN_MAX) {
        let oldId = null, oldAt = Infinity;
        for (const [k, e] of ai.seen) if (e.at < oldAt) { oldAt = e.at; oldId = k; }
        ai.seen.delete(oldId);
      }
    }
    return m;
  }
  const wariness = (ai, o, now) => { const m = recall(ai, o.id, now); return m ? m.kills + m.grudge : 0; };
  const CUT_MODES = ['cut', 'trap', 'flank', 'pin', 'learn']; // moving in ahead of the prey
  const REMAINS_MARGIN = 100; // a scavenger this far past the remains' reach is still there (#146)
  const endHunt = (ai) => { ai.prey = null; ai.coilDir = 0; ai.retaliating = null; };
  // What hunting worm o, its head d away, is worth against a meal of remains (score value / (d + 200)):
  // what the kill drops, discounted for hunts that fail (#122).
  const huntScore = (o, d) => (CFG.HUNT_ODDS * Math.max(10, 0.8 * o.mass)) / (d + 200);
  // Other living bots already retaliating against worm o.
  function retaliators(g, w, o) {
    let n = 0;
    for (const b of g.worms) if (b !== w && !b.dead && b.ai && b.ai.retaliating === o) n++;
    return n;
  }

  // botThink runs these in order (#153). Each reads and updates one plan, `t`: the goal heading
  // and its weight, whether to boost, the mode, and what the heading check should treat
  // differently. The order is part of the behaviour: later steps override earlier goals, and the
  // random draws (g.rng) must come in the same sequence for seeded worlds to replay.
  function botThink(w, g) {
    const t = thinkPlan(w, g);
    refreshWander(t);
    seekFood(t);
    seekPowerups(t);
    gatherHeads(t);
    seekRemains(t);
    seekHeadOn(t);
    pickPrey(t);
    chasePrey(t);
    noticeCoil(t);
    evadeCutters(t);
    if (t.goal === null) {
      t.goal = Math.atan2(w.ai.wy - t.hy, w.ai.wx - t.hx);
      t.goalW = 0.5;
    }
    w.ai.mode = t.mode;
    planGhosts(t);
    steer(t);
  }

  // What every step needs, and the plan they build. Not saved: rebuilt every think.
  function thinkPlan(w, g) {
    const ai = w.ai, skill = ai.skill, r = w.r;
    const level = g.settings.difficulty;
    const diff = DIFFICULTY[level] || DIFFICULTY.normal;
    const sharp = diff.sharp; // expert only (#110)
    const knows = (k) => knowsTactic(w, level, k);
    const hx = w.sx[0], hy = w.sy[0];
    const edge = g.R - r * 3 - 40;
    ai.aim = null; // the point a hunt aims at, for tests and tools; not saved
    return {
      w, g, ai, skill, r, diff, sharp, knows, hx, hy,
      sense: sharp ? sharp.sense : 1,
      edge2: edge * edge,
      L: (80 + 240 * skill) * (w.boosting ? 1.6 : 1) * (sharp ? sharp.look : 1) + r * 3, // look-ahead
      mySpeed: Math.max(w.speed, CFG.BASE_SPEED),
      ca: Math.cos(w.angle), sa: Math.sin(w.angle),
      FR: 200 + 300 * skill, // food range
      anticipate: knows('anticipate'), evade: knows('evade'), headOn: knows('headOn'), escape: knows('escape'), read: knows('read'),
      heads: [], // nearby heads, nearest first ({ o, d })
      best: 0, // score of the best food
      meal: 0, mealA: 0, mealBoost: false, // score, heading and boost of the best uncontested remains
      // The plan:
      goal: null, goalW: 0, boost: false, mode: 'wander',
      headMass: 0, ignore: null, // set while going head-on
      threatPath: null, // sharp bots: the coming paths of every cutter
      circled: null, // { o, cx, cy, rho, dir } while a coil escape runs (#94)
    };
  }

  // Wander point, refreshed when reached or occasionally.
  function refreshWander(t) {
    const { ai, g } = t;
    const wdx = ai.wx - t.hx, wdy = ai.wy - t.hy;
    if (wdx * wdx + wdy * wdy < 200 * 200 || g.rng() < 0.01) {
      const p = randomInCircle(g.rng, g.R * 0.75);
      ai.wx = p.x; ai.wy = p.y;
    }
  }

  // Food: best value-per-distance, preferring what's ahead.
  function seekFood(t) {
    const { w, g, hx, hy, ca, sa, FR, edge2, skill } = t;
    let best = 0, bx = 0, by = 0, bv = 0, bd = 0;
    g.foodGrid.query(hx, hy, FR, (i) => {
      const f = g.food[i];
      if (f.dead) return false;
      const dx = f.x - hx, dy = f.y - hy, d2 = dx * dx + dy * dy;
      if (d2 > FR * FR || f.x * f.x + f.y * f.y > edge2) return false;
      const d = Math.sqrt(d2) + 1;
      const ahead = (dx * ca + dy * sa) / d;
      const s = (f.v * (1.3 + 0.7 * ahead)) / (d + 40);
      if (s > best) { best = s; bx = f.x; by = f.y; bv = f.v; bd = d; }
      return false;
    });
    // Special food (#143) is scored like food of its value.
    for (const p of g.specials) {
      if (p.dead) continue;
      const dx = p.x - hx, dy = p.y - hy, d2 = dx * dx + dy * dy;
      if (d2 > FR * FR || p.x * p.x + p.y * p.y > edge2) continue;
      const d = Math.sqrt(d2) + 1, v = SPECIALS[p.kind].value;
      const s = (v * (1.3 + 0.7 * ((dx * ca + dy * sa) / d))) / (d + 40);
      if (s > best) { best = s; bx = p.x; by = p.y; bv = v; bd = d; }
    }
    t.best = best;
    if (best > 0) {
      t.goal = Math.atan2(by - hy, bx - hx);
      t.goalW = 1;
      t.mode = 'food';
      if (bv >= 6 && bd < 260 && skill > 0.45 && w.mass > 50 && g.rng() < skill * 0.5) t.boost = true;
    }
  }

  // Power-ups are worth a detour.
  function seekPowerups(t) {
    const { g, hx, hy, edge2, skill } = t;
    const PR = 220 + 220 * skill;
    for (const p of g.powerups) {
      const dx = p.x - hx, dy = p.y - hy;
      if (dx * dx + dy * dy < PR * PR && p.x * p.x + p.y * p.y < edge2) {
        t.goal = Math.atan2(dy, dx);
        t.goalW = 1.5;
        t.mode = 'powerup';
        break;
      }
    }
  }

  // Nearby heads, nearest first, for the defensive tactics.
  function gatherHeads(t) {
    const { w, g, hx, hy, sharp, heads } = t;
    if (!(t.anticipate || t.evade || t.headOn || t.escape)) return;
    const HR = (t.L + 300) * t.sense;
    for (const o of g.worms) {
      if (o === w || o.dead || o.shield > 0) continue;
      const dx = o.sx[0] - hx, dy = o.sy[0] - hy, d2 = dx * dx + dy * dy;
      if (d2 < HR * HR) heads.push({ o, d: Math.sqrt(d2) });
    }
    heads.sort((a, b) => a.d - b.d);
    const maxHeads = sharp ? sharp.heads : 8;
    if (heads.length > maxHeads) heads.length = maxHeads;
  }

  // Scavenging: the remains of a worm that died nearby, if they beat the best food and no other
  // head is closer to them: racing others into the remains got scavengers killed. The best such
  // meal is also weighed against hunting: a meal before a fight (#122).
  function seekRemains(t) {
    const { w, g, ai, hx, hy, ca, sa, edge2 } = t;
    if (!t.knows('scavenge') || !g.recentDeaths.length) return;
    const SR = t.FR + 400;
    let meal = 0, sx = 0, sy = 0, sm = 0, sd = 0, sreach = 0, srem = null;
    for (const rem of g.recentDeaths) {
      const dx = rem.x - hx, dy = rem.y - hy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > SR || rem.x * rem.x + rem.y * rem.y > edge2) continue;
      const sc = rem.value / (d + 200); // what is left of it (#122)
      if (sc <= meal) continue;
      let contested = false;
      for (const o of g.worms) {
        if (o !== w && !o.dead && Math.hypot(o.sx[0] - rem.x, o.sy[0] - rem.y) < d) { contested = true; break; }
      }
      if (contested) continue;
      meal = sc; sx = rem.x; sy = rem.y; sm = rem.value * 5; sd = d; sreach = rem.reach; srem = rem;
    }
    t.meal = meal;
    if (meal > 0) {
      // Arrived (#141): in the remains, go for their food itself, scored like plain food, and don't
      // boost. Aiming at the middle point made the bot circle it, boosting, while the food spread
      // around it stayed uneaten. Once in, overshooting the edge a little while chasing a pellet
      // there still counts as arrived, or it turned back for the middle at a boost (#146).
      if (sd < sreach) ai.remainsIn = srem; // not saved, like the remains themselves
      const there = sd < sreach || (ai.remainsIn === srem && sd < sreach + REMAINS_MARGIN);
      let tx = sx, ty = sy;
      if (there) {
        let bs = 0;
        g.foodGrid.query(sx, sy, sreach, (i) => {
          const f = g.food[i];
          if (f.dead || f.natural || (f.x - sx) ** 2 + (f.y - sy) ** 2 > sreach * sreach) return false;
          const dx = f.x - hx, dy = f.y - hy, d = Math.sqrt(dx * dx + dy * dy) + 1;
          const s = (f.v * (1.3 + 0.7 * ((dx * ca + dy * sa) / d))) / (d + 40);
          if (s > bs) { bs = s; tx = f.x; ty = f.y; }
          return false;
        });
      }
      t.mealA = Math.atan2(ty - hy, tx - hx);
      t.mealBoost = sm > 300 && !there && sd < 500 && w.mass > 60;
    }
    if (meal > t.best) goForMeal(t);
  }
  function goForMeal(t) {
    t.goal = t.mealA;
    t.goalW = 1.3;
    t.mode = 'scavenge';
    t.boost = t.mealBoost; // its own call: a boost rolled for plain food it passed over doesn't carry over (#141)
  }

  // Head-on: the bigger worm wins, so meet a clearly smaller oncoming head.
  function seekHeadOn(t) {
    const { w, hx, hy } = t;
    if (!t.headOn) return;
    for (const { o, d } of t.heads) {
      if (d > 220) break;
      if (o.mass >= w.mass * HEAD_ON || Math.abs(angleDiff(w.angle, o.angle)) < (2 * Math.PI) / 3) continue;
      if (Math.abs(angleDiff(w.angle, Math.atan2(o.sy[0] - hy, o.sx[0] - hx))) > Math.PI / 3) continue;
      const p = predictHead(o, d / (t.mySpeed + o.speed));
      t.goal = Math.atan2(p.y - hy, p.x - hx);
      t.goalW = 2.5;
      t.mode = 'headOn';
      t.headMass = w.mass * HEAD_ON;
      t.ignore = o;
      break;
    }
  }

  // Hunting: pick a nearby worm lighter than the level allows; with trap, prefer one with few ways
  // out. Readers retaliate, and leave alone a worm they saw kill.
  function pickPrey(t) {
    const { w, g, ai, hx, hy, read, meal } = t;
    if (ai.prey && (ai.prey.dead || g.time > ai.huntUntil)) endHunt(ai);
    if (ai.prey || w.mass <= 30 || !(g.rng() < ai.aggro * 0.2)) return;
    const td = Math.pow(300 + 350 * ai.aggro, 2), cands = [];
    for (const o of g.worms) {
      if (o === w || o.dead || o.shield > 0) continue;
      const dx = o.sx[0] - hx, dy = o.sy[0] - hy, d2 = dx * dx + dy * dy;
      if (d2 < td && o.mass < w.mass * t.diff.preyRatio) {
        if (meal > 0 && huntScore(o, Math.sqrt(d2)) <= meal) continue; // a meal before a fight (#122)
        // A reader leaves alone a worm it saw kill, unless that worm is much smaller.
        const m = read ? recall(ai, o.id, g.time) : null;
        if (m && m.kills >= SEEN_MIN && o.mass > w.mass * 0.5) continue;
        // No gang-ups: a worm it holds a grudge against, with two other bots already
        // retaliating, isn't prey at all, not even as the nearest or easiest (#119).
        if (m && m.grudge >= SEEN_MIN && retaliators(g, w, o) >= 2) continue;
        cands.push({ o, d2, grudge: m ? m.grudge : 0 });
      }
    }
    if (!cands.length) return;
    cands.sort((a, b) => a.d2 - b.d2);
    let tgt = cands[0].o, grudgeTgt = null;
    if (read) {
      // Retaliate against the worm it holds the biggest grudge against (ganged-up ones are
      // already left out above).
      let bg = SEEN_MIN;
      for (const c of cands) if (c.grudge >= bg) { bg = c.grudge; grudgeTgt = c.o; }
    }
    if (grudgeTgt) tgt = grudgeTgt;
    else if (t.knows('trap')) {
      let bs = Infinity;
      for (const c of cands.slice(0, 3)) {
        const sc = Math.sqrt(c.d2) * (0.5 + freedom(g, c.o, w, 0));
        if (sc < bs) { bs = sc; tgt = c.o; }
      }
    }
    ai.prey = tgt;
    ai.retaliating = grudgeTgt;
    ai.huntUntil = g.time + rand(g.rng, 1.5, 4.5);
    ai.coilDir = 0;
  }

  // Chase the prey: drop it for a better meal, coil it, or cut it off.
  function chasePrey(t) {
    const { w, ai, hx, hy, r } = t;
    const o = ai.prey;
    if (!o) return;
    const dx = o.sx[0] - hx, dy = o.sy[0] - hy, d = Math.sqrt(dx * dx + dy * dy);
    const R0 = Math.max(120, 4 * o.r + 2 * r);
    if (d > 900) endHunt(ai);
    else if (t.meal > huntScore(o, d)) {
      // A meal before a fight: drop the hunt, coil included, for better remains (#122). A head-on
      // set above still comes first.
      endHunt(ai);
      if (t.mode !== 'headOn') goForMeal(t);
    } else if (t.knows('coil') && o.mass <= w.mass * 0.5 && lengthFor(w.mass) >= TAU * R0 * 1.3 && d < (ai.coilDir ? 2.5 * R0 : 350)) {
      coilPrey(t, o, dx, dy, R0);
    } else cutOff(t, o, dx, dy, d);
    if (ai.prey) { t.headMass = 0; t.ignore = null; }
  }

  // Coil: circle the prey's head at a shrinking radius; our own body is the trap.
  function coilPrey(t, o, dx, dy, R0) {
    const { w, g, ai, hx, hy, r } = t;
    if (!ai.coilDir) {
      ai.coilDir = Math.cos(w.angle) * dy - Math.sin(w.angle) * dx >= 0 ? 1 : -1; // turn toward the prey's side
      ai.coilR = R0;
      ai.coilT = g.time;
      ai.huntUntil = g.time + 6;
    }
    ai.coilR = Math.max(2 * o.r + 2 * r, ai.coilR * Math.pow(0.85, g.time - ai.coilT));
    ai.coilT = g.time;
    const c = predictHead(o, 0.3);
    const rho = Math.hypot(hx - c.x, hy - c.y), phi = Math.atan2(hy - c.y, hx - c.x);
    t.goal = phi + ai.coilDir * (Math.PI / 2 + clamp((rho - ai.coilR) / ai.coilR, -0.5, 0.8));
    t.goalW = 2;
    t.mode = 'coil';
    if (w.mass > 150) t.boost = true;
  }

  // Cut-off: cross ahead of the prey, shifted by pin, flank, learning or trap.
  function cutOff(t, o, dx, dy, d) {
    const { w, g, ai, hx, hy, r, knows, skill } = t;
    ai.coilDir = 0;
    // Learning (#135): against the player, use the record of how they escape a cut-off. Without
    // evidence bias and pBoost are 0, and the cut is exactly the one without learning.
    const learn = o.isPlayer && knows('learn');
    const bias = learn ? habitBias(g.habits) : 0;
    const pBoost = learn && !o.boosting ? habitBoost(g.habits) : 0;
    let p = cutPoint(w, o, knows('predict'), 1 + pBoost * (CFG.BOOST_MULT - 1));
    const nx = -Math.sin(p.a), ny = Math.cos(p.a); // the prey's +1 side
    const shift = (k, m) => { p = { x: p.x + nx * k, y: p.y + ny * k, a: p.a }; t.mode = m; };
    t.mode = 'cut';
    const orad = Math.hypot(o.sx[0], o.sy[0]);
    const radial = orad > 0 ? (Math.cos(o.angle) * o.sx[0] + Math.sin(o.angle) * o.sy[0]) / orad : 1;
    let flankSide = 0;
    if (knows('flank')) {
      for (const h of g.worms) {
        if (h === w || h.dead || !h.ai || h.ai.prey !== o) continue;
        const side = Math.cos(o.angle) * (h.sy[0] - o.sy[0]) - Math.sin(o.angle) * (h.sx[0] - o.sx[0]);
        flankSide = side >= 0 ? -1 : 1; // the side opposite the other hunter
        break;
      }
    }
    if (knows('pin') && g.R - orad < 450 && Math.abs(radial) < 0.5 && Math.hypot(hx, hy) < orad) {
      // Pin: cut in on the arena side, ahead of a prey running along the wall.
      const pr = Math.hypot(p.x, p.y) || 1;
      p = { x: p.x - (p.x / pr) * 3 * o.r, y: p.y - (p.y / pr) * 3 * o.r, a: p.a };
      t.mode = 'pin';
    } else if (flankSide) shift(flankSide * 4 * o.r, 'flank');
    else if (Math.abs(bias) >= 0.1) {
      // Aim at the side the player usually escapes to: away from us (-s) when bias > 0.
      const s = Math.cos(o.angle) * (hy - o.sy[0]) - Math.sin(o.angle) * (hx - o.sx[0]) >= 0 ? 1 : -1;
      shift(-s * bias * 4 * o.r, 'learn');
    } else if (knows('trap')) {
      // Close the side with more room, so the prey's only way out is the blocked one.
      const up = freedom(g, o, w, 1), down = freedom(g, o, w, -1);
      if (Math.abs(up - down) >= 0.25) shift((up > down ? 1 : -1) * 4 * o.r, 'trap');
    }
    t.goal = Math.atan2(p.y - hy, p.x - hx);
    t.goalW = 2;
    ai.aim = p;
    // Experienced (predicting) hunters don't boost at point-blank range or at a prey
    // heading for them: most hunters that die are killed by their own prey turning in.
    const safe = !knows('predict') || (d > 150 + 2 * (r + o.r) && Math.abs(angleDiff(o.angle, Math.atan2(-dy, -dx))) > Math.PI / 2);
    if (d < 450 && w.mass > 60 && safe && g.rng() < ai.aggro * skill) t.boost = true;
  }

  // Coil escape (#94): circled by a clearly bigger worm, with our head closed in. The circle comes
  // from what the coiler visibly does, and a bot stays circled for CIRCLED_HOLD after the signs
  // last held, so one wobble doesn't flip it in and out. Not saved, like remainsIn.
  function noticeCoil(t) {
    const { w, g, ai, hx, hy } = t;
    if (!t.escape) return;
    const held = ai.circledBy;
    if (held && (held.dead || g.time > ai.circledUntil)) ai.circledBy = null;
    for (const { o } of t.heads) {
      const c = coilCircle(w, o);
      if (!c) continue;
      if (o !== ai.circledBy && freedom(g, w, null, 0) > 0.5) continue;
      ai.circledBy = o; ai.circledUntil = g.time + CIRCLED_HOLD; ai.circle = c;
      break;
    }
    const o = ai.circledBy;
    if (o && Math.hypot(o.sx[0] - hx, o.sy[0] - hy) > 2 * ai.circle.rho) ai.circledBy = null;
    if (!ai.circledBy) return;
    t.circled = { o: ai.circledBy, ...ai.circle };
    endHunt(ai);
    t.mode = 'escape';
    t.boost = false; // unless the way out allows it (escapeMove)
    t.headMass = 0;
    t.ignore = null;
  }

  // Evasion: a head that will cross our path in the next second before we get there.
  // Sharp bots (#110) weigh every cutter: they sum each one's sideways escape, nearer ones
  // counting more, and treat each cutter's coming path as an obstacle. Circled, the coil escape
  // decides instead.
  function evadeCutters(t) {
    const { w, g, ai, hx, hy, r, sharp, read } = t;
    if (!t.evade || t.circled) return;
    const ER = (250 + 150 * t.skill) * t.sense;
    const multi = sharp && sharp.escape > 0;
    let ex = 0, ey = 0, nearD = Infinity, nearAway = 0;
    const mine = EVADE_T.map((s) => predictHead(w, s));
    for (const { o, d } of t.heads) {
      if (d > ER * 2) break;
      // Readers give worms they are wary of more room (#83).
      if (d > ER * (read ? 1 + 0.5 * Math.min(2, wariness(ai, o, g.time)) : 1)) continue;
      if (t.headOn && o.mass < w.mass * HEAD_ON) continue; // a head-on there is a win
      let threat = false;
      for (let j = 0; j < EVADE_T.length && !threat; j++) {
        const b = predictHead(o, EVADE_T[j]);
        for (let i = j; i < EVADE_T.length; i++) {
          if (Math.hypot(mine[i].x - b.x, mine[i].y - b.y) < 3 * r + o.r) { threat = true; break; }
        }
      }
      if (!threat) continue;
      if (read) { // it tried to cut us off: a grudge, at most once a second per worm
        const m = remember(ai, o.id, g.time);
        if (g.time - m.cutAt >= 1) { m.grudge += 1; m.cutAt = g.time; }
      }
      // Head away from its line, on the side we are on.
      const side = Math.cos(o.angle) * (hy - o.sy[0]) - Math.sin(o.angle) * (hx - o.sx[0]) >= 0 ? 1 : -1;
      const away = o.angle + side * Math.PI / 2;
      if (multi) {
        const k = 1 / Math.max(d, 1);
        ex += Math.cos(away) * k; ey += Math.sin(away) * k;
        if (d < nearD) { nearD = d; nearAway = away; }
        if (!t.threatPath) t.threatPath = [];
        // t = -1: a cutter's coming path blocks whenever we would get there (ghostHit's
        // timing filter never skips it), unlike anticipation's ghosts.
        for (const s of EVADE_T) { const p = predictHead(o, s); t.threatPath.push(p.x, p.y, -1, o.r); }
        continue;
      }
      evadeTo(t, away);
      if (w.mass > 60 && d < 200) t.boost = true;
      return;
    }
    if (t.threatPath) {
      // Escapes that nearly cancel out give no direction: get away from the nearest cutter.
      evadeTo(t, Math.hypot(ex, ey) * nearD < 0.25 ? nearAway : Math.atan2(ey, ex));
      if (w.mass > 60 && nearD < 200) t.boost = true;
    }
  }
  function evadeTo(t, a) {
    t.goal = a;
    t.goalW = 3;
    t.mode = 'evade';
    t.headMass = 0;
    t.ignore = null;
  }

  // Anticipation: the paths nearby heads are about to cover count as obstacles.
  function planGhosts(t) {
    t.ghost = null;
    if (!t.anticipate || !t.heads.length) return;
    const ghost = (t.ghost = []);
    for (const { o } of t.heads) {
      if (o === t.ignore || (t.circled && o === t.circled.o)) continue; // we may mean to cross the coiler's path
      for (const s of GHOST_T) { const p = predictHead(o, s); ghost.push(p.x, p.y, s, o.r); }
    }
  }

  // Pick the heading: candidates around the current one plus the goal, each probed for bodies, the
  // wall and (for anticipating bots) ghosts; sharp bots then check the best ones closely. Then
  // decide the boost.
  function steer(t) {
    const { w, g, hx, hy, skill, sharp, L, mySpeed, headMass, ghost, threatPath } = t;
    const N = 2 * Math.round((4 + 6 * skill) * (sharp ? sharp.headings : 1)) + 1;
    const spread = Math.PI * (0.6 + 0.35 * skill);
    const rad = t.r + 4 + 6 * skill;
    // Going head-on, a sharp bot ignores the target's body beyond its head (meeting the head
    // ends the fight first) and the stretch right behind the head it is bound to brush. Any
    // other part of the target, such as a loop across the way, still counts (#110).
    const pass = sharp ? t.ignore : null;
    const past = pass ? Math.hypot(pass.sx[0] - hx, pass.sy[0] - hy) : Infinity;
    const nearSegs = pass ? Math.ceil((2 * (rad + pass.r)) / spacingFor(pass.r)) : 0;
    const blocked = (px, py, s, speed) => hitAt(g, w, px, py, rad, headMass, pass, s > past ? Infinity : nearSegs)
      || (ghost && ghostHit(ghost, px, py, rad, s / speed)) || (threatPath && ghostHit(threatPath, px, py, rad, 0));
    const step = 2 * rad;
    const cleared = t.circled ? escapeMove(t, blocked, step, N, spread) : ((w.ai.escape = null), null);
    const { goal, goalW } = t;
    const dense = sharp && sharp.dense > 0 ? [] : null; // [angle, score, danger] per candidate
    let bestA = w.angle, bestS = -Infinity, bestD = 0;
    for (let k = 0; k <= N; k++) {
      const a = k === N ? goal : w.angle + spread * ((2 * k) / (N - 1) - 1);
      const c = Math.cos(a), s = Math.sin(a);
      let danger = 0;
      if (!(k === N && cleared !== null)) {
        for (let j = 0; j < 4; j++) {
          const d = L * SAMPLE_T[j];
          if (blocked(hx + c * d, hy + s * d, d, mySpeed)) { danger = SAMPLE_W[j]; break; }
        }
      }
      const score = -danger + goalW * Math.cos(angleDiff(a, goal)) - 0.25 * Math.abs(angleDiff(w.angle, a));
      if (dense) dense.push(k === N && cleared !== null ? [a, score, 0, true] : [a, score, danger]);
      if (score > bestS) { bestS = score; bestA = a; bestD = danger; }
    }
    // Sharp bots check the best clear headings closely, at most 2·rad apart along the whole
    // look-ahead, so a thin body between the sparse points can't slip through (#110). They keep
    // going, best first, until one is clear all the way, and a heading never checked closely can't
    // win: boxed in by a loop of body, the way out may be far down the list (#118).
    if (dense && bestD === 0 && !(cleared !== null && bestA === cleared)) {
      for (;;) {
        let bi = -1;
        for (let i = 0; i < dense.length; i++) if (!dense[i][3] && dense[i][2] === 0 && (bi < 0 || dense[i][1] > dense[bi][1])) bi = i;
        if (bi < 0) break;
        const e = dense[bi], c = Math.cos(e[0]), s = Math.sin(e[0]);
        e[3] = true; // checked closely
        for (let d = step; ; d += step) {
          const dd = Math.min(d, L);
          if (blocked(hx + c * dd, hy + s * dd, dd, mySpeed)) { e[2] = dangerAt(dd / L); e[1] -= e[2]; break; }
          if (dd >= L) break;
        }
        if (e[2] === 0) break; // clear all the way
      }
      bestS = -Infinity;
      for (const e of dense) if ((e[3] || e[2] > 0) && e[1] > bestS) { bestS = e[1]; bestA = e[0]; bestD = e[2]; }
    }
    w.targetAngle = bestA;
    w.wantBoost = t.boost && bestD === 0;
    // A boost turns wider and goes farther: bots with reach check, closely, the path a boost would
    // really take, as far as a boost carries them, whether or not they are boosting already (#149).
    // Headings themselves are still judged along straight lines: judging them along reachable paths
    // made Expert bots very hard to kill and trapped bots worse at surviving a coil (measured, #149).
    const reach = !!(sharp && sharp.reach > 0) || !!t.circled; // circled bots check it on any level (#94)
    if (w.wantBoost && reach) {
      const p = reachPath(w, bestA, true), far = L * 1.6;
      for (let d = step; ; d += step) {
        const dd = Math.min(d, far), q = reachAt(p, dd);
        if (blocked(q.x, q.y, dd, p.v)) { w.wantBoost = false; break; }
        if (dd >= far) break;
      }
    } else if (w.wantBoost && t.anticipate && !w.boosting) {
      // Anticipating bots look as far as a boost will carry them before they boost.
      const c = Math.cos(bestA), s = Math.sin(bestA), boostSpeed = mySpeed * CFG.BOOST_MULT;
      for (const f of [0.62, 1]) {
        const d = L * 1.6 * f, px = hx + c * d, py = hy + s * d;
        if (blocked(px, py, d, boostSpeed)) { w.wantBoost = false; break; }
      }
    }
  }

  // Escape moves (#94): out of the loop if it can, else hug the loop's inside edge. The way out is
  // judged along the path the bot can really take (#149), closely, and then counts as clear in the
  // heading choice. Returns the cleared heading, or null. (A head shot, crossing just ahead of the
  // coiler's head, was built and measured: none landed. A coiler steers round its prey's head, so
  // as the prey crosses, the coil moves with it and the coiler's head leaves the predicted arc.)
  function escapeMove(t, blocked, step, N, spread) {
    const { w, ai, hx, hy, r, L, circled } = t;
    const o = circled.o;
    const outR = circled.rho + o.r + r;
    const outside = (q) => Math.hypot(q.x - circled.cx, q.y - circled.cy) > outR;
    // How far a path is clear, out to `far`.
    const clearTo = (p, far) => {
      for (let d = step; ; d += step) {
        const dd = Math.min(d, far), q = reachAt(p, dd);
        if (blocked(q.x, q.y, dd, p.v)) return dd - step;
        if (dd >= far) return far;
      }
    };
    const cands = [];
    for (let k = 0; k < N; k++) cands.push(w.angle + spread * ((2 * k) / (N - 1) - 1));
    cands.sort((x, y) => Math.abs(angleDiff(w.angle, x)) - Math.abs(angleDiff(w.angle, y)));
    let cleared = null;
    ai.mode = 'escape';
    // Out: a path clear all the way that ends outside the loop, the smallest turn first.
    for (const a of cands) {
      const p = reachPath(w, a, false);
      if (clearTo(p, L) < L) continue;
      const end = reachAt(p, L);
      if (!outside(end)) continue;
      t.goal = a;
      t.goalW = 3.5;
      ai.aim = { x: end.x, y: end.y }; // the exit point
      const bp = reachPath(w, a, true);
      if (clearTo(bp, L * 1.6) >= L * 1.6 && outside(reachAt(bp, L * 1.6))) t.boost = true;
      ai.escape = 'out';
      return (cleared = a);
    }
    // Hug: circle the coiler's centre its way round, just inside its body. Re-planned several
    // times a second, this is a steady turn, checked against bodies like any heading.
    const minTurn = reachPath(w, w.angle + Math.PI / 2, false).s1 / (Math.PI / 2);
    const rh = Math.max(minTurn, circled.rho - o.r - r - r);
    const dist = Math.hypot(hx - circled.cx, hy - circled.cy), phi = Math.atan2(hy - circled.cy, hx - circled.cx);
    t.goal = phi + circled.dir * (Math.PI / 2 + clamp((dist - rh) / rh, -0.5, 0.8));
    t.goalW = 2.5;
    ai.escape = 'hug';
    return cleared;
  }

  // ---------------------------------------------------------------------------
  class Game {
    // opts.seed replays a world exactly (#100); without one each world gets a random seed.
    // The seed isn't saved: a loaded world continues with a new one.
    constructor(settings, snapshot, opts = {}) {
      this.seed = opts.seed !== undefined ? opts.seed >>> 0 : newSeed();
      this.rng = makeRng(this.seed);
      this.nextId = 1; // per world, so worm ids (and the tactics they pick) replay from the seed too
      if (snapshot) {
        validateSnapshot(snapshot); // before its settings size the world
        settings = snapshot.settings;
      }
      this.settings = Object.assign({ botCount: 30, difficulty: 'normal' }, settings);
      const bc = this.settings.botCount;
      this.R = arenaRadius(bc);
      const area = Math.PI * this.R * this.R;
      this.foodTarget = Math.round(area * CFG.FOOD_DENSITY);
      this.powerupTarget = Math.max(6, Math.round(area * CFG.POWERUP_DENSITY));
      this.specialTarget = Math.max(2, Math.round(area * CFG.SPECIAL_DENSITY));

      this.worms = [];
      this.food = [];
      this.powerups = [];
      this.specials = []; // { x, y, kind, life, ph, dead } (#143)
      this.player = null;
      this.lastPlayer = null;
      this.time = 0;
      this.tick = 0;
      this.segGrid = new Grid(CFG.CELL, this.R + 600);
      this.foodGrid = new Grid(CFG.CELL, this.R + 600);
      this.gridWorms = [];
      this.maxR = 20;
      this.respawnQueue = [];
      this.naturalFood = 0;
      this.foodBudget = 0; // natural food owed by the refill rate
      this.listeners = {};
      this.leaderboard = [];
      this.recentDeaths = []; // { x, y, reach, mass, value, time } along each body that died, while its food lasts (#78, #122); not saved
      this.remainsAt = 0; // when to re-count the remains next
      // The player's habits (#135), owned by the caller and updated in place; not part of the world.
      this.habits = opts.habits || freshHabits();
      this.encounter = null; // the cut-off being watched; not saved
      this.encounterNext = 0; // earliest start of the next encounter

      if (snapshot) this.load(snapshot);
      else {
        for (let i = 0; i < this.foodTarget; i++) this.spawnNaturalFood();
        for (let i = 0; i < this.powerupTarget; i++) this.spawnPowerup();
        for (let i = 0; i < bc; i++) this.spawnBot(true);
      }
      this.rebuildSegGrid();
      this.rebuildFoodGrid();
      this.updateLeaderboard();
    }

    on(evt, fn) { (this.listeners[evt] || (this.listeners[evt] = [])).push(fn); }
    emit(evt, data) { const l = this.listeners[evt]; if (l) for (const fn of l) fn(data); }

    // --- save / load --------------------------------------------------------
    // Compact JSON-friendly snapshot of the whole world. Food is packed into a flat
    // number array (7 values each) with colours referenced through a palette.
    toJSON() {
      const r1 = (v) => Math.round(v * 10) / 10;
      const r2 = (v) => Math.round(v * 100) / 100;
      const palette = [], palIdx = new Map();
      const colorIndex = (c) => {
        let i = palIdx.get(c);
        if (i === undefined) { i = palette.length; palette.push(c); palIdx.set(c, i); }
        return i;
      };
      const food = [];
      for (const f of this.food) {
        if (f.dead) continue;
        food.push(Math.round(f.x), Math.round(f.y), r2(f.v), colorIndex(f.c), f.life === Infinity ? -1 : r1(f.life), r2(f.ph), f.natural ? 1 : 0);
      }
      return {
        app: 'wigglefeast',
        v: 1,
        savedAt: Date.now(),
        settings: { botCount: this.settings.botCount, difficulty: this.settings.difficulty },
        time: r2(this.time),
        nextId: this.nextId,
        worms: this.worms.filter((w) => !w.dead).map((w) => ({
          id: w.id,
          name: w.name,
          skin: Math.max(0, SKINS.indexOf(w.skin)),
          isPlayer: w.isPlayer,
          mass: r2(w.mass),
          angle: r2(w.angle),
          targetAngle: r2(w.targetAngle),
          kills: w.kills,
          eaten: w.eaten,
          dropAcc: r2(w.dropAcc),
          shield: r2(Math.max(0, w.shield)),
          pw: Object.fromEntries(Object.entries(w.pw).map(([k, v]) => [k, r1(v)])),
          born: r2(w.born),
          peak: r2(w.peak),
          // Only the saved bot state; tactic state (mode, coil) is re-picked after loading (#78).
          ai: w.ai ? { skill: w.ai.skill, aggro: w.ai.aggro, interval: w.ai.interval, wx: w.ai.wx, wy: w.ai.wy, prey: w.ai.prey ? w.ai.prey.id : 0, huntUntil: w.ai.huntUntil } : null,
          sx: w.sx.map(r1),
          sy: w.sy.map(r1),
        })),
        palette,
        food,
        powerups: this.powerups.filter((p) => !p.dead).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), type: p.type, ph: r2(p.ph) })),
        // Life never rounds down to 0, so the save stays valid (#46).
        specials: this.specials.filter((p) => !p.dead && p.life > 0).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), kind: p.kind, life: Math.max(0.1, r1(p.life)), ph: r2(p.ph) })),
        respawnQueue: this.respawnQueue.map(r2),
      };
    }

    load(snap) {
      this.time = snap.time || 0;
      // Never hand out an id a loaded worm already has, even if nextId is missing or stale (#31).
      this.nextId = Math.max(snap.nextId || 1, ...snap.worms.map((d) => d.id + 1));
      const byId = new Map();
      for (const d of snap.worms) {
        const w = new Worm({
          id: d.id, name: d.name, skin: SKINS[d.skin], isPlayer: d.isPlayer === true, mass: d.mass,
          angle: d.angle, targetAngle: d.targetAngle, kills: d.kills, eaten: d.eaten, dropAcc: d.dropAcc,
          shield: d.shield, pw: d.pw, time: d.born, peak: d.peak,
          ai: d.ai ? { skill: d.ai.skill, aggro: d.ai.aggro, interval: d.ai.interval, wx: d.ai.wx, wy: d.ai.wy, prey: d.ai.prey, huntUntil: d.ai.huntUntil } : null,
          sx: d.sx.slice(), sy: d.sy.slice(), worldR: this.R, rng: this.rng,
        });
        byId.set(w.id, w);
        this.worms.push(w);
        if (w.isPlayer) this.player = w;
      }
      for (const w of this.worms) if (w.ai) w.ai.prey = byId.get(w.ai.prey) || null;
      const F = snap.food, pal = snap.palette;
      for (let i = 0; i + 6 < F.length; i += 7) {
        const v = F[i + 2], natural = F[i + 6] === 1;
        this.food.push({ x: F[i], y: F[i + 1], v, r: foodRadius(v), c: pal[F[i + 3]] || FOOD_COLORS[0], life: F[i + 4] < 0 ? Infinity : F[i + 4], ph: F[i + 5], dead: false, natural });
        if (natural) this.naturalFood++;
      }
      for (const p of snap.powerups) this.powerups.push({ x: p.x, y: p.y, type: p.type, ph: p.ph, dead: false });
      for (const p of snap.specials || []) this.specials.push({ x: p.x, y: p.y, kind: p.kind, life: Math.min(p.life, CFG.SPECIAL_LIFE), ph: p.ph, dead: false });
      this.respawnQueue = (snap.respawnQueue || []).slice();
    }

    // --- spawning -----------------------------------------------------------
    spawnNaturalFood() {
      if (this.food.length >= MAX_FOOD) return;
      const p = randomInCircle(this.rng, this.R - 30);
      const v = weighted(this.rng, { 1: 55, 2: 30, 4: 12, 8: 3 }) | 0;
      this.food.push({ x: p.x, y: p.y, v, r: foodRadius(v), c: pick(this.rng, FOOD_COLORS), life: Infinity, ph: rand(this.rng, 0, TAU), dead: false, natural: true });
      this.naturalFood++;
    }

    addFood(x, y, v, color, life) {
      if (this.food.length >= MAX_FOOD) return; // keeps saves within the food limit
      const lim = this.R - 20, d2 = x * x + y * y;
      if (d2 > lim * lim) { const k = lim / Math.sqrt(d2); x *= k; y *= k; }
      this.food.push({ x, y, v, r: foodRadius(v), c: color, life, ph: rand(this.rng, 0, TAU), dead: false, natural: false });
    }

    spawnPowerup() {
      const p = randomInCircle(this.rng, this.R * 0.92);
      this.powerups.push({ x: p.x, y: p.y, type: weighted(this.rng, POWERUP_WEIGHTS), ph: rand(this.rng, 0, TAU), dead: false });
    }

    spawnSpecial() {
      const p = randomInCircle(this.rng, this.R * 0.9);
      this.specials.push({ x: p.x, y: p.y, kind: weighted(this.rng, SPECIAL_WEIGHTS), life: CFG.SPECIAL_LIFE, ph: rand(this.rng, 0, TAU), dead: false });
    }

    findSpawnPoint(clearance) {
      let best = null, bestD = -1;
      for (let t = 0; t < 40; t++) {
        const p = randomInCircle(this.rng, this.R * 0.8);
        let minD = Infinity;
        for (const w of this.worms) {
          if (w.dead) continue;
          for (let i = 0; i < w.sx.length; i += 2) {
            const dx = w.sx[i] - p.x, dy = w.sy[i] - p.y, d = dx * dx + dy * dy;
            if (d < minD) minD = d;
          }
        }
        if (minD > clearance * clearance) return p;
        if (minD > bestD) { bestD = minD; best = p; }
      }
      return best;
    }

    uniqueName() {
      const used = new Set(this.worms.map((w) => w.name));
      const free = BOT_NAMES.filter((n) => !used.has(n));
      if (free.length) return pick(this.rng, free);
      return pick(this.rng, BOT_NAMES) + ' ' + Math.floor(rand(this.rng, 2, 99));
    }

    spawnBot(initial) {
      const d = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;
      const skill = rand(this.rng, d.skill[0], d.skill[1]);
      // A new world starts mostly small, with a few large bots (bigShare) to look up to (#16).
      const big = initial && this.rng() < d.bigShare;
      const mass = big ? 400 + Math.pow(this.rng(), 2) * (d.bigMax - 400)
        : initial ? CFG.START_MASS + Math.pow(this.rng(), 2) * 185
        : CFG.START_MASS + rand(this.rng, 0, 25);
      const p = this.findSpawnPoint(300);
      const wp = randomInCircle(this.rng, this.R * 0.75);
      const w = new Worm({
        id: this.nextId++,
        rng: this.rng,
        name: this.uniqueName(),
        skin: pick(this.rng, PICKABLE_SKINS),
        mass,
        x: p.x,
        y: p.y,
        angle: Math.atan2(-p.y, -p.x) + rand(this.rng, -1.2, 1.2),
        worldR: this.R,
        time: this.time,
        ai: { skill, aggro: rand(this.rng, d.aggro[0], d.aggro[1]), interval: 0.32 - 0.22 * skill, wx: wp.x, wy: wp.y, prey: null, huntUntil: 0 },
      });
      this.worms.push(w);
      return w;
    }

    spawnPlayer(name, skinIndex) {
      const p = this.findSpawnPoint(450);
      const w = new Worm({
        id: this.nextId++,
        rng: this.rng,
        name: name || 'You',
        skin: SKINS[skinIndex] || SKINS[0],
        mass: CFG.START_MASS,
        x: p.x,
        y: p.y,
        angle: Math.atan2(-p.y, -p.x),
        worldR: this.R,
        time: this.time,
        shield: CFG.SPAWN_SHIELD,
        isPlayer: true,
      });
      this.worms.push(w);
      this.player = w;
      this.updateLeaderboard();
      return w;
    }

    // --- simulation ---------------------------------------------------------
    update(dt) {
      this.time += dt;
      this.tick++;

      const sharp = (DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal).sharp;
      for (const w of this.worms) {
        if (!w.ai || w.dead) continue;
        w.thinkT -= dt;
        if (w.thinkT <= 0) {
          botThink(w, this);
          w.thinkT = w.ai.interval * rand(this.rng, 0.8, 1.2);
          if (sharp) w.thinkT = Math.max(0.04, w.thinkT * sharp.think); // saved ai.interval stays the base (#110)
        }
      }

      let maxR = 0;
      for (const w of this.worms) { w.update(dt, this); if (w.r > maxR) maxR = w.r; }
      this.maxR = maxR;

      this.rebuildSegGrid();
      this.eatFood(dt);
      this.eatSpecials(dt);
      this.pickPowerups(dt);
      this.checkCollisions();
      if (this.worms.some((w) => w.dead)) this.worms = this.worms.filter((w) => !w.dead);
      this.observeHabits();

      this.cleanFood(dt);
      if (this.naturalFood < this.foodTarget) {
        this.foodBudget += CFG.FOOD_REFILL_RATE * dt; // reset below once the food is back at its target
        for (; this.foodBudget >= 1 && this.naturalFood < this.foodTarget; this.foodBudget--) this.spawnNaturalFood();
      } else this.foodBudget = 0;
      if (this.powerups.length < this.powerupTarget && this.rng() < 1 - Math.exp(-CFG.POWERUP_SPAWN_RATE * dt)) this.spawnPowerup();
      this.cleanSpecials(dt);
      if (this.specials.length < this.specialTarget && this.rng() < 1 - Math.exp(-CFG.SPECIAL_SPAWN_RATE * this.specialTarget * dt)) this.spawnSpecial();

      let bots = 0;
      for (const w of this.worms) if (w.ai) bots++;
      const q = this.respawnQueue;
      while (bots + q.length < this.settings.botCount) q.push(this.time + rand(this.rng, 1, 3));
      q.sort((a, b) => a - b);
      while (q.length && q[0] <= this.time) {
        q.shift();
        if (bots < this.settings.botCount) { this.spawnBot(false); bots++; }
      }

      this.rebuildFoodGrid();
      if (this.recentDeaths.length && this.time >= this.remainsAt) this.refreshRemains();
      if (this.tick % 10 === 0) this.updateLeaderboard();
    }

    // Watches a bot cutting the player off and records how the player escaped (#135). It reads
    // only what anyone can see (heading, boost arrows), never the player's steering input, and
    // draws no random numbers, so every world plays out exactly as it would without it.
    observeHabits() {
      const p = this.player, e = this.encounter;
      if (e) {
        if (p !== e.player || p.dead || p.shield > 0 || e.bot.dead) { this.encounter = null; return; } // no outcome
        e.turn += angleDiff(e.lastA, p.angle);
        e.lastA = p.angle;
        if (p.boosting) e.boosted = true;
        if (this.time - e.start < CFG.HABIT_WINDOW - 1e-9) return;
        const side = Math.abs(e.turn) < CFG.HABIT_STRAIGHT ? 'straight' : Math.sign(e.turn) === e.side ? 'toward' : 'away';
        recordHabit(this.habits, side, e.boosted);
        this.encounter = null;
        return;
      }
      if (!p || p.shield > 0 || this.time < this.encounterNext) return;
      const ca = Math.cos(p.angle), sa = Math.sin(p.angle), px = p.sx[0], py = p.sy[0], R = CFG.HABIT_RANGE;
      for (const b of this.worms) {
        if (!b.ai || b.ai.prey !== p || !CUT_MODES.includes(b.ai.mode)) continue;
        const dx = b.sx[0] - px, dy = b.sy[0] - py;
        if (dx * dx + dy * dy > R * R || dx * ca + dy * sa <= 0) continue; // too far, or not ahead
        // side: +1 when the cutter is on the player's +1 side (heading + 90 degrees), where a
        // positive turn goes.
        this.encounter = { player: p, bot: b, side: ca * dy - sa * dx >= 0 ? 1 : -1, start: this.time, lastA: p.angle, turn: 0, boosted: false };
        this.encounterNext = this.time + CFG.HABIT_GAP;
        return;
      }
    }

    // Re-counts what is left of each remembered remains (dropped food near it, not natural food)
    // and forgets remains that are eaten up or older than any of their food (#122).
    refreshRemains() {
      this.remainsAt = this.time + CFG.REMAINS_REFRESH;
      const food = this.food;
      this.recentDeaths = this.recentDeaths.filter((d) => {
        if (this.time - d.time > CFG.REMAINS_TIME) return false;
        let v = 0;
        const r2 = d.reach * d.reach;
        this.foodGrid.query(d.x, d.y, d.reach, (i) => {
          const f = food[i];
          if (!f.dead && !f.natural && (f.x - d.x) ** 2 + (f.y - d.y) ** 2 <= r2) v += f.v;
          return false;
        });
        d.value = v;
        return v >= Math.max(2, 0.1 * d.mass);
      });
    }

    rebuildSegGrid() {
      const g = this.segGrid;
      g.clear();
      const gw = (this.gridWorms = this.worms.slice());
      for (let wi = 0; wi < gw.length; wi++) {
        const w = gw[wi];
        if (w.dead || w.shield > 0) continue;
        const sx = w.sx, sy = w.sy;
        for (let i = 0; i < sx.length; i++) g.insert(sx[i], sy[i], wi, i);
      }
    }

    rebuildFoodGrid() {
      const g = this.foodGrid, food = this.food;
      g.clear();
      for (let i = 0; i < food.length; i++) g.insert(food[i].x, food[i].y, i, 0);
    }

    eatFood(dt) {
      const food = this.food;
      for (const w of this.worms) {
        if (w.dead) continue;
        const hx = w.sx[0], hy = w.sy[0], r = w.r;
        const A = r * 2.2 + 24 + (w.pw.magnet > 0 ? CFG.MAGNET_REACH : 0);
        const mult = w.multiplier;
        this.foodGrid.query(hx, hy, A, (i) => {
          const f = food[i];
          if (f.dead) return false;
          const dx = hx - f.x, dy = hy - f.y, d2 = dx * dx + dy * dy;
          if (d2 > A * A) return false;
          const d = Math.sqrt(d2);
          if (d < r * 0.9 + f.r * 0.4) {
            f.dead = true;
            // x2/x5 multiply natural food only: on food dropped by worms they made mass from
            // nothing, and the worm that ate a big corpse with x5 grew without limit (#16).
            w.mass = Math.min(MAX_MASS, w.mass + f.v * (f.natural ? mult : 1));
            w.eaten++;
          } else {
            const step = Math.min(d, (700 + 900 * (1 - d / A)) * dt);
            f.x += (dx / d) * step;
            f.y += (dy / d) * step;
          }
          return false;
        });
      }
    }

    // Special food (#143) is eaten like food, pulled in from the same reach, but its value
    // isn't multiplied by x2/x5. Few items, so no grid.
    eatSpecials(dt) {
      const sp = this.specials;
      if (!sp.length) return;
      for (const w of this.worms) {
        if (w.dead) continue;
        const hx = w.sx[0], hy = w.sy[0], r = w.r;
        const A = r * 2.2 + 24 + (w.pw.magnet > 0 ? CFG.MAGNET_REACH : 0);
        for (const p of sp) {
          if (p.dead) continue;
          const dx = hx - p.x, dy = hy - p.y;
          if (dx > A || dx < -A || dy > A || dy < -A) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 > A * A) continue;
          const d = Math.sqrt(d2);
          if (d < r * 0.9 + CFG.SPECIAL_R * 0.4) {
            p.dead = true;
            const value = SPECIALS[p.kind].value;
            w.mass = Math.min(MAX_MASS, w.mass + value);
            w.eaten++;
            this.emit('special', { worm: w, kind: p.kind, value });
          } else {
            const step = Math.min(d, (700 + 900 * (1 - d / A)) * dt);
            p.x += (dx / d) * step;
            p.y += (dy / d) * step;
          }
        }
      }
    }

    cleanSpecials(dt) {
      let any = false;
      for (const p of this.specials) {
        p.life -= dt;
        if (p.dead || p.life <= 0) any = true;
      }
      if (any) this.specials = this.specials.filter((p) => !p.dead && p.life > 0);
    }

    // Like food, a power-up slides toward the nearest head within reach (much farther
    // with the magnet) and is collected when it touches that head (#35).
    pickPowerups(dt) {
      let any = false;
      for (const p of this.powerups) {
        let w = null, wd2 = Infinity, A = 0;
        for (const o of this.worms) {
          if (o.dead) continue;
          const dx = o.sx[0] - p.x, dy = o.sy[0] - p.y, d2 = dx * dx + dy * dy;
          const reach = o.r + CFG.POWERUP_REACH + (o.pw.magnet > 0 ? CFG.MAGNET_REACH : 0);
          if (d2 < reach * reach && d2 < wd2) { w = o; wd2 = d2; A = reach; }
        }
        if (!w) continue;
        const dx = w.sx[0] - p.x, dy = w.sy[0] - p.y, d = Math.sqrt(wd2);
        if (d < w.r + 24) {
          w.pw[p.type] = CFG.POWERUP_TIME;
          p.dead = any = true;
          this.emit('powerup', { worm: w, type: p.type });
        } else {
          const step = Math.min(d, (700 + 900 * (1 - d / A)) * dt);
          p.x += (dx / d) * step;
          p.y += (dy / d) * step;
        }
      }
      if (any) this.powerups = this.powerups.filter((p) => !p.dead);
    }

    checkCollisions() {
      const gw = this.gridWorms, deaths = [];
      for (const w of this.worms) {
        if (w.dead || w.shield > 0) continue;
        const hx = w.sx[0], hy = w.sy[0], r = w.r;
        const lim = this.R - r * 0.4;
        if (hx * hx + hy * hy > lim * lim) { deaths.push([w, null]); continue; }
        let killer = null;
        this.segGrid.query(hx, hy, r + this.maxR, (oi, si) => {
          const o = gw[oi];
          if (o === w || o.dead) return false;
          const dx = o.sx[si] - hx, dy = o.sy[si] - hy, rr = (r + o.r) * 0.78;
          if (dx * dx + dy * dy >= rr * rr) return false;
          if (si < 3 && w.mass >= o.mass) return false; // head-on: the bigger worm wins
          killer = o;
          return true;
        });
        if (killer) deaths.push([w, killer]);
      }
      // Settle every death and kill credit first, then report them, so listeners
      // (stats, saving) never see a half-resolved tick (#47).
      const events = [];
      for (const [w, k] of deaths) { const e = this.die(w, k); if (e) events.push(e); }
      for (const e of events) this.emit('death', e);
    }

    kill(w, killer, cause) {
      const e = this.die(w, killer, cause);
      if (e) this.emit('death', e);
    }

    // Applies a death without reporting it; returns the event to emit, or null if already dead.
    die(w, killer, cause) {
      if (w.dead) return null;
      w.dead = true;
      w.diedAt = this.time;
      if (w.mass > w.peak) w.peak = w.mass; // food eaten this tick, before update() saw it
      const total = Math.max(10, w.mass * 0.8);
      const n = w.sx.length;
      const count = clamp(Math.round(total / 2.5), 5, n);
      const per = total / count, step = n / count, spread = w.r * 0.7;
      for (let k = 0; k < count; k++) {
        const i = Math.floor(k * step);
        this.addFood(w.sx[i] + rand(this.rng, -spread, spread), w.sy[i] + rand(this.rng, -spread, spread), per * rand(this.rng, 0.7, 1.3), w.stripeColor(i), rand(this.rng, 45, 60));
      }
      // Remember where the remains lie (5 points along the body) for scavenging bots. Each point
      // covers its fifth of the body (reach); value is what is left of its food, re-counted as
      // others eat it (#122).
      const reach = Math.max(40, (n / 10) * spacingFor(w.r) + w.r);
      for (let k = 0; k < 5; k++) {
        const i = Math.floor(((k + 0.5) * n) / 5);
        this.recentDeaths.push({ x: w.sx[i], y: w.sy[i], reach, mass: total / 5, value: total / 5, time: this.time });
      }
      if (killer) {
        killer.kills++; // shown on its name tag (#126)
        // Bots that read other worms remember a kill they saw, and a grudge if it was right next to them.
        const vx = w.sx[0], vy = w.sy[0], level = this.settings.difficulty;
        for (const b of this.worms) {
          if (b === killer || b === w || b.dead || !b.ai || !knowsTactic(b, level, 'read')) continue;
          const d = Math.hypot(b.sx[0] - vx, b.sy[0] - vy);
          if (d > KILL_VIEW) continue;
          const m = remember(b.ai, killer.id, this.time);
          m.kills += 1;
          if (d <= KILL_NEAR) m.grudge += 1;
        }
      }
      if (w.isPlayer) { this.player = null; this.lastPlayer = w; }
      return { victim: w, killer, cause: cause || (killer ? 'eaten' : 'wall') };
    }

    cleanFood(dt) {
      const food = this.food;
      let j = 0, nat = 0;
      for (let i = 0; i < food.length; i++) {
        const f = food[i];
        if (f.dead) continue;
        f.life -= dt;
        if (f.life <= 0) continue;
        if (f.natural) nat++;
        food[j++] = f;
      }
      food.length = j;
      this.naturalFood = nat;
    }

    updateLeaderboard() {
      this.leaderboard = this.worms.filter((w) => !w.dead).sort((a, b) => b.mass - a.mass);
    }

    rankOf(w) { return this.leaderboard.indexOf(w) + 1; }
  }

  // Food theme for the Auto setting (#64), by the player's local date: Halloween from
  // 15 to 31 October, Christmas from 1 to 26 December, Classic otherwise.
  function seasonalTheme(date) {
    const m = date.getMonth() + 1, d = date.getDate();
    if (m === 10 && d >= 15) return 'halloween';
    if (m === 12 && d <= 26) return 'christmas';
    return 'classic';
  }

  root.WormEngine = {
    CFG, SKINS, PICKABLE_SKINS, SAVE_APP_IDS, MIN_BOTS, MAX_BOTS, arenaRadius, DIFFICULTY, DIFFICULTIES, TACTICS, SPECIALS, validateSnapshot, seasonalTheme,
    freshHabits, validHabits, recordHabit, habitBias, habitBoost,
    Game, Worm, botThink, knowsTactic, predictHead, reachPath, reachAt, freedom, radiusFor, lengthFor, angleDiff, TAU,
  };
})(typeof window !== 'undefined' ? window : globalThis);
