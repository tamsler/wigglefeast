/* Wigglefeast — game simulation. No DOM access here so it can run headless. */
(function (root) {
  'use strict';

  const CFG = {
    BASE_SPEED: 230,
    BOOST_MULT: 2.1,
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
    REMAINS_TIME: 6, // seconds scavenging bots remember where a worm died (#78)
    // Food / power-up density per unit of world area (tuned for a 3600 radius world).
    FOOD_DENSITY: 2600 / (Math.PI * 3600 * 3600),
    POWERUP_DENSITY: 26 / (Math.PI * 3600 * 3600),
  };

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function angleDiff(from, to) {
    let d = (to - from) % TAU;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    return d;
  }
  function randomInCircle(R) {
    const a = Math.random() * TAU, d = R * Math.sqrt(Math.random());
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  }
  function weighted(table) {
    let total = 0;
    for (const k in table) total += table[k];
    let t = Math.random() * total;
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

  // Bot tactics (#78). Their order is part of each bot's identity (see knowsTactic):
  // only ever append.
  const TACTICS = ['predict', 'anticipate', 'evade', 'headOn', 'scavenge', 'trap', 'pin', 'coil', 'flank'];
  const tactics = (shares) => Object.fromEntries(TACTICS.map((k) => [k, shares[k] || 0]));

  // Per difficulty (#16). skill: look-ahead, reaction time and steering precision.
  // aggro: how often and how far a bot hunts. preyRatio: it hunts worms lighter than this
  // times its own mass. bigShare: share of the bots in a new world that start large, at
  // up to bigMax mass; the rest start small. tactics: share of bots that know each tactic.
  const DIFFICULTY = {
    easy: { skill: [0.12, 0.45], aggro: [0.0, 0.35], preyRatio: 1, bigShare: 0.1, bigMax: 1200, tactics: tactics({}) },
    normal: {
      skill: [0.35, 0.8], aggro: [0.1, 0.65], preyRatio: 1.3, bigShare: 0.15, bigMax: 2000,
      tactics: tactics({ predict: 0.5, anticipate: 0.3, evade: 0.3, headOn: 0.2, scavenge: 0.3 }),
    },
    hard: {
      skill: [0.7, 1.0], aggro: [0.35, 1.0], preyRatio: 1.6, bigShare: 0.2, bigMax: 2500,
      tactics: tactics({ predict: 1, anticipate: 0.7, evade: 0.6, headOn: 0.5, scavenge: 0.5, trap: 0.4, pin: 0.4, coil: 0.3 }),
    },
    expert: {
      skill: [0.85, 1.0], aggro: [0.6, 1.0], preyRatio: 2, bigShare: 0.25, bigMax: 3000,
      tactics: tactics(Object.fromEntries(TACTICS.map((k) => [k, 1]))),
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
  let nextId = 1;

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
      this.thinkT = Math.random() * 0.3;
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
      const curl = rand(-0.06, 0.06);
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
          const drain = (3 + this.mass * 0.01) * dt;
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
        g.addFood(sx[t] + rand(-r, r) * 0.5, sy[t] + rand(-r, r) * 0.5, this.dropAcc, this.stripeColor(t), 18);
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
  const GHOST_T = [0.25, 0.5, 0.75];
  const EVADE_T = [0.25, 0.5, 0.75, 1];
  const HEAD_ON = 0.85; // a head-on collision is a safe win against worms under this share of own mass

  // headMass: the first 3 segments of worms lighter than this don't count (a head-on win).
  // other: a second worm to ignore besides self.
  function hitAt(g, self, px, py, rad, headMass = 0, other = null) {
    const lim = g.R - rad;
    if (px * px + py * py > lim * lim) return true;
    const gw = g.gridWorms;
    return g.segGrid.query(px, py, rad + g.maxR, (oi, si) => {
      const o = gw[oi];
      if (o === self || o === other || o.dead) return false;
      if (si < 3 && o.mass < headMass) return false;
      const dx = o.sx[si] - px, dy = o.sy[si] - py, rr = rad + o.r;
      return dx * dx + dy * dy < rr * rr;
    });
  }

  // Where a worm's head will be after t seconds if it keeps its speed and observed turning.
  function predictHead(o, t) {
    const v = o.speed, a = o.angle, x = o.sx[0], y = o.sy[0];
    const turn = clamp(o.turnRate * t, -Math.PI, Math.PI);
    if (Math.abs(turn) < 1e-3) return { x: x + Math.cos(a) * v * t, y: y + Math.sin(a) * v * t, a };
    const k = (v * t) / turn; // radius of the arc
    return { x: x + k * (Math.sin(a + turn) - Math.sin(a)), y: y - k * (Math.cos(a + turn) - Math.cos(a)), a: a + turn };
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

  // The point to cross in front of a prey. Without prediction: ahead along its heading, by
  // more the farther it is. With prediction: where its curving path meets ours.
  function cutPoint(w, o, predict) {
    const hx = w.sx[0], hy = w.sy[0], lead = w.r * 2 + o.r * 2;
    if (!predict) {
      const l = lead + Math.hypot(o.sx[0] - hx, o.sy[0] - hy) * 0.6;
      return { x: o.sx[0] + Math.cos(o.angle) * l, y: o.sy[0] + Math.sin(o.angle) * l, a: o.angle };
    }
    const sp = Math.max(w.speed, CFG.BASE_SPEED);
    let t = Math.hypot(o.sx[0] - hx, o.sy[0] - hy) / sp, p = null;
    for (let i = 0; i < 3; i++) {
      p = predictHead(o, Math.min(t, 2));
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

  function botThink(w, g) {
    const ai = w.ai, skill = ai.skill, r = w.r;
    const level = g.settings.difficulty;
    const diff = DIFFICULTY[level] || DIFFICULTY.normal;
    const knows = (k) => knowsTactic(w, level, k);
    const hx = w.sx[0], hy = w.sy[0];
    const edge = g.R - r * 3 - 40, edge2 = edge * edge;
    const L = (80 + 240 * skill) * (w.boosting ? 1.6 : 1) + r * 3;
    const mySpeed = Math.max(w.speed, CFG.BASE_SPEED);
    let goal = null, goalW = 0, boost = false, mode = 'wander';
    let headMass = 0, ignore = null; // set while going head-on
    ai.aim = null; // the point a hunt aims at, for tests and tools; not saved

    // Wander point, refreshed when reached or occasionally.
    const wdx = ai.wx - hx, wdy = ai.wy - hy;
    if (wdx * wdx + wdy * wdy < 200 * 200 || Math.random() < 0.01) {
      const p = randomInCircle(g.R * 0.75);
      ai.wx = p.x; ai.wy = p.y;
    }

    // Food: best value-per-distance, preferring what's ahead.
    const FR = 200 + 300 * skill;
    const ca = Math.cos(w.angle), sa = Math.sin(w.angle);
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
    if (best > 0) {
      goal = Math.atan2(by - hy, bx - hx);
      goalW = 1;
      mode = 'food';
      if (bv >= 6 && bd < 260 && skill > 0.45 && w.mass > 50 && Math.random() < skill * 0.5) boost = true;
    }

    // Power-ups are worth a detour.
    const PR = 220 + 220 * skill;
    for (const p of g.powerups) {
      const dx = p.x - hx, dy = p.y - hy;
      if (dx * dx + dy * dy < PR * PR && p.x * p.x + p.y * p.y < edge2) {
        goal = Math.atan2(dy, dx);
        goalW = 1.5;
        mode = 'powerup';
        break;
      }
    }

    // Nearby heads, nearest first, for the defensive tactics.
    const anticipate = knows('anticipate'), evade = knows('evade'), headOn = knows('headOn');
    const heads = [];
    if (anticipate || evade || headOn) {
      const HR = L + 300;
      for (const o of g.worms) {
        if (o === w || o.dead || o.shield > 0) continue;
        const dx = o.sx[0] - hx, dy = o.sy[0] - hy, d2 = dx * dx + dy * dy;
        if (d2 < HR * HR) heads.push({ o, d: Math.sqrt(d2) });
      }
      heads.sort((a, b) => a.d - b.d);
      if (heads.length > 8) heads.length = 8;
    }

    // Scavenging: the remains of a worm that just died nearby, if they beat the best food and
    // no other head is closer to them: racing others into the remains got scavengers killed.
    if (knows('scavenge') && g.recentDeaths.length) {
      const SR = FR + 400;
      let bs = best, sx = 0, sy = 0, sm = 0, sd = 0;
      for (const rem of g.recentDeaths) {
        const dx = rem.x - hx, dy = rem.y - hy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > SR || rem.x * rem.x + rem.y * rem.y > edge2) continue;
        const sc = rem.mass / (d + 200);
        if (sc <= bs) continue;
        let contested = false;
        for (const o of g.worms) {
          if (o !== w && !o.dead && Math.hypot(o.sx[0] - rem.x, o.sy[0] - rem.y) < d) { contested = true; break; }
        }
        if (contested) continue;
        if (sc > bs) { bs = sc; sx = rem.x; sy = rem.y; sm = rem.mass * 5; sd = d; }
      }
      if (bs > best) {
        goal = Math.atan2(sy - hy, sx - hx);
        goalW = 1.3;
        mode = 'scavenge';
        if (sm > 300 && sd < 500 && w.mass > 60) boost = true;
      }
    }

    // Head-on: the bigger worm wins, so meet a clearly smaller oncoming head.
    if (headOn) {
      for (const { o, d } of heads) {
        if (d > 220) break;
        if (o.mass >= w.mass * HEAD_ON || Math.abs(angleDiff(w.angle, o.angle)) < (2 * Math.PI) / 3) continue;
        if (Math.abs(angleDiff(w.angle, Math.atan2(o.sy[0] - hy, o.sx[0] - hx))) > Math.PI / 3) continue;
        const p = predictHead(o, d / (mySpeed + o.speed));
        goal = Math.atan2(p.y - hy, p.x - hx);
        goalW = 2.5;
        mode = 'headOn';
        headMass = w.mass * HEAD_ON;
        ignore = o;
        break;
      }
    }

    // Hunting: pick a nearby worm lighter than the level allows; with trap, prefer one with
    // few ways out.
    if (ai.prey && (ai.prey.dead || g.time > ai.huntUntil)) { ai.prey = null; ai.coilDir = 0; }
    if (!ai.prey && w.mass > 30 && Math.random() < ai.aggro * 0.2) {
      const td = Math.pow(300 + 350 * ai.aggro, 2), cands = [];
      for (const o of g.worms) {
        if (o === w || o.dead || o.shield > 0) continue;
        const dx = o.sx[0] - hx, dy = o.sy[0] - hy, d2 = dx * dx + dy * dy;
        if (d2 < td && o.mass < w.mass * diff.preyRatio) cands.push({ o, d2 });
      }
      if (cands.length) {
        cands.sort((a, b) => a.d2 - b.d2);
        let tgt = cands[0].o;
        if (knows('trap')) {
          let bs = Infinity;
          for (const c of cands.slice(0, 3)) {
            const sc = Math.sqrt(c.d2) * (0.5 + freedom(g, c.o, w, 0));
            if (sc < bs) { bs = sc; tgt = c.o; }
          }
        }
        ai.prey = tgt;
        ai.huntUntil = g.time + rand(1.5, 4.5);
        ai.coilDir = 0;
      }
    }
    if (ai.prey) {
      const o = ai.prey;
      const dx = o.sx[0] - hx, dy = o.sy[0] - hy, d = Math.sqrt(dx * dx + dy * dy);
      const R0 = Math.max(120, 4 * o.r + 2 * r);
      if (d > 900) { ai.prey = null; ai.coilDir = 0; }
      else if (knows('coil') && o.mass <= w.mass * 0.5 && lengthFor(w.mass) >= TAU * R0 * 1.3 && d < (ai.coilDir ? 2.5 * R0 : 350)) {
        // Coil: circle the prey's head at a shrinking radius; our own body is the trap.
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
        goal = phi + ai.coilDir * (Math.PI / 2 + clamp((rho - ai.coilR) / ai.coilR, -0.5, 0.8));
        goalW = 2;
        mode = 'coil';
        if (w.mass > 150) boost = true;
      } else {
        ai.coilDir = 0;
        let p = cutPoint(w, o, knows('predict'));
        const nx = -Math.sin(p.a), ny = Math.cos(p.a); // the prey's +1 side
        const shift = (k, m) => { p = { x: p.x + nx * k, y: p.y + ny * k, a: p.a }; mode = m; };
        mode = 'cut';
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
          mode = 'pin';
        } else if (flankSide) shift(flankSide * 4 * o.r, 'flank');
        else if (knows('trap')) {
          // Close the side with more room, so the prey's only way out is the blocked one.
          const up = freedom(g, o, w, 1), down = freedom(g, o, w, -1);
          if (Math.abs(up - down) >= 0.25) shift((up > down ? 1 : -1) * 4 * o.r, 'trap');
        }
        goal = Math.atan2(p.y - hy, p.x - hx);
        goalW = 2;
        ai.aim = p;
        // Experienced (predicting) hunters don't boost at point-blank range or at a prey
        // heading for them: most hunters that die are killed by their own prey turning in.
        const safe = !knows('predict') || (d > 150 + 2 * (r + o.r) && Math.abs(angleDiff(o.angle, Math.atan2(-dy, -dx))) > Math.PI / 2);
        if (d < 450 && w.mass > 60 && safe && Math.random() < ai.aggro * skill) boost = true;
      }
      if (ai.prey) { headMass = 0; ignore = null; }
    }

    // Evasion: a head that will cross our path in the next second before we get there.
    if (evade) {
      const ER = 250 + 150 * skill;
      const mine = EVADE_T.map((t) => predictHead(w, t));
      for (const { o, d } of heads) {
        if (d > ER) break;
        if (headOn && o.mass < w.mass * HEAD_ON) continue; // a head-on there is a win
        let threat = false;
        for (let j = 0; j < EVADE_T.length && !threat; j++) {
          const b = predictHead(o, EVADE_T[j]);
          for (let i = j; i < EVADE_T.length; i++) {
            if (Math.hypot(mine[i].x - b.x, mine[i].y - b.y) < 3 * r + o.r) { threat = true; break; }
          }
        }
        if (!threat) continue;
        // Head away from its line, on the side we are on.
        const side = Math.cos(o.angle) * (hy - o.sy[0]) - Math.sin(o.angle) * (hx - o.sx[0]) >= 0 ? 1 : -1;
        goal = o.angle + side * Math.PI / 2;
        goalW = 3;
        mode = 'evade';
        headMass = 0;
        ignore = null;
        if (w.mass > 60 && d < 200) boost = true;
        break;
      }
    }

    if (goal === null) {
      goal = Math.atan2(ai.wy - hy, ai.wx - hx);
      goalW = 0.5;
    }
    ai.mode = mode;

    // Anticipation: the paths nearby heads are about to cover count as obstacles.
    let ghost = null;
    if (anticipate && heads.length) {
      ghost = [];
      for (const { o } of heads) {
        if (o === ignore) continue;
        for (const t of GHOST_T) { const p = predictHead(o, t); ghost.push(p.x, p.y, t, o.r); }
      }
    }

    // Evaluate candidate headings.
    const N = 2 * Math.round(4 + 6 * skill) + 1;
    const spread = Math.PI * (0.6 + 0.35 * skill);
    const rad = r + 4 + 6 * skill;
    let bestA = w.angle, bestS = -Infinity, bestD = 0;
    for (let k = 0; k <= N; k++) {
      const a = k === N ? goal : w.angle + spread * ((2 * k) / (N - 1) - 1);
      const c = Math.cos(a), s = Math.sin(a);
      let danger = 0;
      for (let j = 0; j < 4; j++) {
        const t = L * SAMPLE_T[j], px = hx + c * t, py = hy + s * t;
        if (hitAt(g, w, px, py, rad, headMass) || (ghost && ghostHit(ghost, px, py, rad, t / mySpeed))) { danger = SAMPLE_W[j]; break; }
      }
      const score = -danger + goalW * Math.cos(angleDiff(a, goal)) - 0.25 * Math.abs(angleDiff(w.angle, a));
      if (score > bestS) { bestS = score; bestA = a; bestD = danger; }
    }
    w.targetAngle = bestA;
    w.wantBoost = boost && bestD === 0;
    // Anticipating bots look as far as a boost will carry them before they boost.
    if (w.wantBoost && anticipate && !w.boosting) {
      const c = Math.cos(bestA), s = Math.sin(bestA), boostSpeed = mySpeed * CFG.BOOST_MULT;
      for (const f of [0.62, 1]) {
        const t = L * 1.6 * f, px = hx + c * t, py = hy + s * t;
        if (hitAt(g, w, px, py, rad, headMass) || (ghost && ghostHit(ghost, px, py, rad, t / boostSpeed))) { w.wantBoost = false; break; }
      }
    }
  }

  // ---------------------------------------------------------------------------
  class Game {
    constructor(settings, snapshot) {
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

      this.worms = [];
      this.food = [];
      this.powerups = [];
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
      this.recentDeaths = []; // { x, y, mass, time } along each body that died in the last few seconds (#78); not saved

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
        nextId,
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
        respawnQueue: this.respawnQueue.map(r2),
      };
    }

    load(snap) {
      this.time = snap.time || 0;
      // Never hand out an id a loaded worm already has, even if nextId is missing or stale (#31).
      nextId = Math.max(nextId, snap.nextId || 1, ...snap.worms.map((d) => d.id + 1));
      const byId = new Map();
      for (const d of snap.worms) {
        const w = new Worm({
          id: d.id, name: d.name, skin: SKINS[d.skin], isPlayer: d.isPlayer === true, mass: d.mass,
          angle: d.angle, targetAngle: d.targetAngle, kills: d.kills, eaten: d.eaten, dropAcc: d.dropAcc,
          shield: d.shield, pw: d.pw, time: d.born, peak: d.peak,
          ai: d.ai ? { skill: d.ai.skill, aggro: d.ai.aggro, interval: d.ai.interval, wx: d.ai.wx, wy: d.ai.wy, prey: d.ai.prey, huntUntil: d.ai.huntUntil } : null,
          sx: d.sx.slice(), sy: d.sy.slice(), worldR: this.R,
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
      this.respawnQueue = (snap.respawnQueue || []).slice();
    }

    // --- spawning -----------------------------------------------------------
    spawnNaturalFood() {
      if (this.food.length >= MAX_FOOD) return;
      const p = randomInCircle(this.R - 30);
      const v = weighted({ 1: 55, 2: 30, 4: 12, 8: 3 }) | 0;
      this.food.push({ x: p.x, y: p.y, v, r: foodRadius(v), c: pick(FOOD_COLORS), life: Infinity, ph: rand(0, TAU), dead: false, natural: true });
      this.naturalFood++;
    }

    addFood(x, y, v, color, life) {
      if (this.food.length >= MAX_FOOD) return; // keeps saves within the food limit
      const lim = this.R - 20, d2 = x * x + y * y;
      if (d2 > lim * lim) { const k = lim / Math.sqrt(d2); x *= k; y *= k; }
      this.food.push({ x, y, v, r: foodRadius(v), c: color, life, ph: rand(0, TAU), dead: false, natural: false });
    }

    spawnPowerup() {
      const p = randomInCircle(this.R * 0.92);
      this.powerups.push({ x: p.x, y: p.y, type: weighted(POWERUP_WEIGHTS), ph: rand(0, TAU), dead: false });
    }

    findSpawnPoint(clearance) {
      let best = null, bestD = -1;
      for (let t = 0; t < 40; t++) {
        const p = randomInCircle(this.R * 0.8);
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
      if (free.length) return pick(free);
      return pick(BOT_NAMES) + ' ' + Math.floor(rand(2, 99));
    }

    spawnBot(initial) {
      const d = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;
      const skill = rand(d.skill[0], d.skill[1]);
      // A new world starts mostly small, with a few large bots (bigShare) to look up to (#16).
      const big = initial && Math.random() < d.bigShare;
      const mass = big ? 400 + Math.pow(Math.random(), 2) * (d.bigMax - 400)
        : initial ? CFG.START_MASS + Math.pow(Math.random(), 2) * 185
        : CFG.START_MASS + rand(0, 25);
      const p = this.findSpawnPoint(300);
      const wp = randomInCircle(this.R * 0.75);
      const w = new Worm({
        name: this.uniqueName(),
        skin: pick(PICKABLE_SKINS),
        mass,
        x: p.x,
        y: p.y,
        angle: Math.atan2(-p.y, -p.x) + rand(-1.2, 1.2),
        worldR: this.R,
        time: this.time,
        ai: { skill, aggro: rand(d.aggro[0], d.aggro[1]), interval: 0.32 - 0.22 * skill, wx: wp.x, wy: wp.y, prey: null, huntUntil: 0 },
      });
      this.worms.push(w);
      return w;
    }

    spawnPlayer(name, skinIndex) {
      const p = this.findSpawnPoint(450);
      const w = new Worm({
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

      for (const w of this.worms) {
        if (!w.ai || w.dead) continue;
        w.thinkT -= dt;
        if (w.thinkT <= 0) { botThink(w, this); w.thinkT = w.ai.interval * rand(0.8, 1.2); }
      }

      let maxR = 0;
      for (const w of this.worms) { w.update(dt, this); if (w.r > maxR) maxR = w.r; }
      this.maxR = maxR;

      this.rebuildSegGrid();
      this.eatFood(dt);
      this.pickPowerups(dt);
      this.checkCollisions();
      if (this.worms.some((w) => w.dead)) this.worms = this.worms.filter((w) => !w.dead);

      this.cleanFood(dt);
      if (this.recentDeaths.length && this.time - this.recentDeaths[0].time > CFG.REMAINS_TIME) {
        this.recentDeaths = this.recentDeaths.filter((d) => this.time - d.time <= CFG.REMAINS_TIME);
      }
      if (this.naturalFood < this.foodTarget) {
        this.foodBudget += CFG.FOOD_REFILL_RATE * dt; // reset below once the food is back at its target
        for (; this.foodBudget >= 1 && this.naturalFood < this.foodTarget; this.foodBudget--) this.spawnNaturalFood();
      } else this.foodBudget = 0;
      if (this.powerups.length < this.powerupTarget && Math.random() < 1 - Math.exp(-CFG.POWERUP_SPAWN_RATE * dt)) this.spawnPowerup();

      let bots = 0;
      for (const w of this.worms) if (w.ai) bots++;
      const q = this.respawnQueue;
      while (bots + q.length < this.settings.botCount) q.push(this.time + rand(1, 3));
      q.sort((a, b) => a - b);
      while (q.length && q[0] <= this.time) {
        q.shift();
        if (bots < this.settings.botCount) { this.spawnBot(false); bots++; }
      }

      this.rebuildFoodGrid();
      if (this.tick % 10 === 0) this.updateLeaderboard();
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
        this.addFood(w.sx[i] + rand(-spread, spread), w.sy[i] + rand(-spread, spread), per * rand(0.7, 1.3), w.stripeColor(i), rand(45, 60));
      }
      // Remember where the remains lie (5 points along the body) for scavenging bots.
      for (let k = 0; k < 5; k++) {
        const i = Math.floor(((k + 0.5) * n) / 5);
        this.recentDeaths.push({ x: w.sx[i], y: w.sy[i], mass: total / 5, time: this.time });
      }
      if (killer) killer.kills++;
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
    CFG, SKINS, PICKABLE_SKINS, SAVE_APP_IDS, MIN_BOTS, MAX_BOTS, arenaRadius, DIFFICULTY, DIFFICULTIES, TACTICS, validateSnapshot, seasonalTheme,
    Game, Worm, botThink, knowsTactic, predictHead, radiusFor, lengthFor, angleDiff, TAU,
  };
})(typeof window !== 'undefined' ? window : globalThis);
