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
    SPAWN_SHIELD: 2.5,
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
  const radiusFor = (m) => Math.min(62, 9 + 2.2 * Math.pow(Math.max(m, 1), 0.3));
  const lengthFor = (m) => 40 + 9 * Math.pow(Math.max(m, 1), 0.72);
  const spacingFor = (r) => r * 0.42;
  const turnRateFor = (r) => 5.4 / (1 + (r - 14) / 45);
  const foodRadius = (v) => Math.min(20, 3 + Math.sqrt(v) * 2.4);

  const SKINS = [
    { name: 'Cherry Pop', colors: ['#ff595e', '#ffca3a'] },
    { name: 'Lagoon', colors: ['#4cc9f0', '#4361ee', '#3a0ca3'] },
    { name: 'Lime Ocean', colors: ['#8ac926', '#1982c4'] },
    { name: 'Rainbow', colors: ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'] },
    { name: 'Candy Cane', colors: ['#ffffff', '#ef233c'] },
    { name: 'Bumblebee', colors: ['#2b2b2b', '#ffd60a'] },
    { name: 'Neon Night', colors: ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0'] },
    { name: 'Mint', colors: ['#2ec4b6', '#cbf3f0'] },
    { name: 'Lavender', colors: ['#ffd6ff', '#e7c6ff', '#c8b6ff', '#b8c0ff'] },
    { name: 'Sailor', colors: ['#e63946', '#f1faee', '#a8dadc', '#457b9d'] },
    { name: 'Tangerine', colors: ['#ff9f1c', '#ffbf69', '#fff3e0'] },
    { name: 'Emerald', colors: ['#06d6a0', '#118ab2'] },
    { name: 'Grape', colors: ['#6a4c93', '#f15bb5'] },
    { name: 'Lava', colors: ['#d00000', '#ffba08', '#dc2f02'] },
  ];

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

  const POWERUP_WEIGHTS = { magnet: 30, x2: 22, x5: 5, speed: 20, zoom: 14 };

  const DIFFICULTY = {
    easy: { skill: [0.12, 0.45], aggro: [0.0, 0.35] },
    normal: { skill: [0.35, 0.8], aggro: [0.1, 0.65] },
    hard: { skill: [0.7, 1.0], aggro: [0.35, 1.0] },
  };

  // ---------------------------------------------------------------------------
  // Save files are untrusted input (they can be imported from anywhere), so check
  // every field load() relies on before building a world from one.
  function validateSnapshot(snap) {
    const fail = (why) => { throw new Error('Invalid Wigglefeast save: ' + why); };
    const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const fin = (v) => typeof v === 'number' && Number.isFinite(v);
    const finArr = (a, max) => Array.isArray(a) && a.length <= max && a.every(fin);
    const has = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);

    if (!isObj(snap) || !SAVE_APP_IDS.includes(snap.app) || snap.v !== 1) fail('not a world snapshot');
    const s = snap.settings;
    if (!isObj(s) || !Number.isInteger(s.botCount) || s.botCount < 5 || s.botCount > 60 || !has(DIFFICULTY, s.difficulty)) fail('settings');
    if (!fin(snap.time) || snap.time < 0) fail('time');
    if (snap.nextId !== undefined && !fin(snap.nextId)) fail('nextId');

    if (!Array.isArray(snap.worms) || snap.worms.length > 200) fail('worms');
    let players = 0;
    for (const w of snap.worms) {
      if (!isObj(w) || typeof w.name !== 'string' || w.name.length > 40) fail('worm name');
      if (!Number.isInteger(w.skin) || w.skin < 0 || w.skin >= SKINS.length) fail('worm skin');
      for (const k of ['id', 'mass', 'angle', 'targetAngle', 'kills', 'eaten', 'dropAcc', 'shield', 'born', 'peak']) if (!fin(w[k])) fail('worm ' + k);
      if (w.mass < 1 || w.mass > 1e7) fail('worm mass');
      if (!finArr(w.sx, 20000) || !finArr(w.sy, 20000) || w.sx.length !== w.sy.length || w.sx.length < 2) fail('worm body');
      if (!isObj(w.pw) || Object.keys(w.pw).some((k) => !has(POWERUP_WEIGHTS, k) || !fin(w.pw[k]))) fail('worm power-ups');
      if (w.isPlayer === true) players++;
      if (w.ai != null) {
        const a = w.ai;
        if (!isObj(a) || !['skill', 'aggro', 'interval', 'wx', 'wy', 'huntUntil'].every((k) => fin(a[k])) || !(a.prey == null || fin(a.prey))) fail('bot state');
      }
    }
    if (players > 1) fail('more than one player');

    if (!Array.isArray(snap.palette) || snap.palette.length > 1000 || !snap.palette.every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))) fail('colours');
    const F = snap.food;
    if (!finArr(F, 7 * 50000) || F.length % 7 !== 0) fail('food');
    for (let i = 0; i < F.length; i += 7) if (F[i + 2] <= 0 || F[i + 2] > 1e6 || (F[i + 4] < 0 && F[i + 4] !== -1)) fail('food values');
    if (!Array.isArray(snap.powerups) || snap.powerups.length > 500 ||
      !snap.powerups.every((p) => isObj(p) && has(POWERUP_WEIGHTS, p.type) && fin(p.x) && fin(p.y) && fin(p.ph))) fail('power-ups');
    if (snap.respawnQueue !== undefined && !finArr(snap.respawnQueue, 500)) fail('respawn queue');
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
      this.dead = false;
      this.kills = o.kills || 0;
      this.eaten = o.eaten || 0;
      this.dropAcc = o.dropAcc || 0;
      this.shield = o.shield || 0;
      this.pw = Object.assign({ magnet: 0, x2: 0, x5: 0, speed: 0, zoom: 0 }, o.pw);
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
    stripeColor(i) { const c = this.skin.colors; return c[Math.floor(i / 3) % c.length]; }

    update(dt, g) {
      if (this.shield > 0) this.shield -= dt;
      const pw = this.pw;
      for (const k in pw) if (pw[k] > 0) pw[k] = Math.max(0, pw[k] - dt);

      const r = (this.r = radiusFor(this.mass));
      const sp = spacingFor(r);

      const maxTurn = turnRateFor(r) * dt * (this.boosting ? 0.85 : 1);
      this.angle += clamp(angleDiff(this.angle, this.targetAngle), -maxTurn, maxTurn);
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
      if (this.mass > 1500) this.mass -= (this.mass - 1500) * 0.004 * dt;

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
  // Bot brain. Picks a goal (food, power-up, prey, or wander point), then samples
  // candidate headings and rejects those that run into bodies or the wall.
  const SAMPLE_T = [0.15, 0.35, 0.62, 1];
  const SAMPLE_W = [12, 6, 3, 1.5];

  function hitAt(g, self, px, py, rad) {
    const lim = g.R - rad;
    if (px * px + py * py > lim * lim) return true;
    const gw = g.gridWorms;
    return g.segGrid.query(px, py, rad + g.maxR, (oi, si) => {
      const o = gw[oi];
      if (o === self || o.dead) return false;
      const dx = o.sx[si] - px, dy = o.sy[si] - py, rr = rad + o.r;
      return dx * dx + dy * dy < rr * rr;
    });
  }

  function botThink(w, g) {
    const ai = w.ai, skill = ai.skill, r = w.r;
    const hx = w.sx[0], hy = w.sy[0];
    const edge = g.R - r * 3 - 40, edge2 = edge * edge;
    let goal = null, goalW = 0, boost = false;

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
      if (bv >= 6 && bd < 260 && skill > 0.45 && w.mass > 50 && Math.random() < skill * 0.5) boost = true;
    }

    // Power-ups are worth a detour.
    const PR = 220 + 220 * skill;
    for (const p of g.powerups) {
      const dx = p.x - hx, dy = p.y - hy;
      if (dx * dx + dy * dy < PR * PR && p.x * p.x + p.y * p.y < edge2) {
        goal = Math.atan2(dy, dx);
        goalW = 1.5;
        break;
      }
    }

    // Hunting: aim ahead of a nearby worm's head to cut it off.
    if (ai.prey && (ai.prey.dead || g.time > ai.huntUntil)) ai.prey = null;
    if (!ai.prey && w.mass > 30 && Math.random() < ai.aggro * 0.2) {
      let td = Math.pow(300 + 350 * ai.aggro, 2), tgt = null;
      for (const o of g.worms) {
        if (o === w || o.dead || o.shield > 0) continue;
        const dx = o.sx[0] - hx, dy = o.sy[0] - hy, d2 = dx * dx + dy * dy;
        if (d2 < td && o.mass < w.mass * 1.6) { td = d2; tgt = o; }
      }
      if (tgt) { ai.prey = tgt; ai.huntUntil = g.time + rand(1.5, 4.5); }
    }
    if (ai.prey) {
      const o = ai.prey;
      const dx = o.sx[0] - hx, dy = o.sy[0] - hy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 900) ai.prey = null;
      else {
        const lead = r * 2 + o.r * 2 + d * 0.6;
        const px = o.sx[0] + Math.cos(o.angle) * lead, py = o.sy[0] + Math.sin(o.angle) * lead;
        goal = Math.atan2(py - hy, px - hx);
        goalW = 2;
        if (d < 450 && w.mass > 60 && Math.random() < ai.aggro * skill) boost = true;
      }
    }

    if (goal === null) {
      goal = Math.atan2(ai.wy - hy, ai.wx - hx);
      goalW = 0.5;
    }

    // Evaluate candidate headings.
    const N = 2 * Math.round(4 + 6 * skill) + 1;
    const spread = Math.PI * (0.6 + 0.35 * skill);
    const L = (80 + 240 * skill) * (w.boosting ? 1.6 : 1) + r * 3;
    const rad = r + 4 + 6 * skill;
    let bestA = w.angle, bestS = -Infinity, bestD = 0;
    for (let k = 0; k <= N; k++) {
      const a = k === N ? goal : w.angle + spread * ((2 * k) / (N - 1) - 1);
      const c = Math.cos(a), s = Math.sin(a);
      let danger = 0;
      for (let j = 0; j < 4; j++) {
        const t = L * SAMPLE_T[j];
        if (hitAt(g, w, hx + c * t, hy + s * t, rad)) { danger = SAMPLE_W[j]; break; }
      }
      const score = -danger + goalW * Math.cos(angleDiff(a, goal)) - 0.25 * Math.abs(angleDiff(w.angle, a));
      if (score > bestS) { bestS = score; bestA = a; bestD = danger; }
    }
    w.targetAngle = bestA;
    w.wantBoost = boost && bestD === 0;
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
      this.R = 1800 + 60 * bc;
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
      this.listeners = {};
      this.leaderboard = [];

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
          ai: w.ai ? Object.assign({}, w.ai, { prey: w.ai.prey ? w.ai.prey.id : 0 }) : null,
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
      nextId = Math.max(nextId, snap.nextId || 1);
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
      const p = randomInCircle(this.R - 30);
      const v = weighted({ 1: 55, 2: 30, 4: 12, 8: 3 }) | 0;
      this.food.push({ x: p.x, y: p.y, v, r: foodRadius(v), c: pick(FOOD_COLORS), life: Infinity, ph: rand(0, TAU), dead: false, natural: true });
      this.naturalFood++;
    }

    addFood(x, y, v, color, life) {
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
      const mass = initial ? CFG.START_MASS + Math.pow(Math.random(), 2.5) * 2500 : CFG.START_MASS + rand(0, 25);
      const p = this.findSpawnPoint(300);
      const wp = randomInCircle(this.R * 0.75);
      const w = new Worm({
        name: this.uniqueName(),
        skin: pick(SKINS),
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
      this.pickPowerups();
      this.checkCollisions();
      if (this.worms.some((w) => w.dead)) this.worms = this.worms.filter((w) => !w.dead);

      this.cleanFood(dt);
      for (let i = 0; i < 10 && this.naturalFood < this.foodTarget; i++) this.spawnNaturalFood();
      if (this.powerups.length < this.powerupTarget && Math.random() < 0.03) this.spawnPowerup();

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
        const A = r * 2.2 + 24 + (w.pw.magnet > 0 ? 230 : 0);
        const mult = w.multiplier;
        this.foodGrid.query(hx, hy, A, (i) => {
          const f = food[i];
          if (f.dead) return false;
          const dx = hx - f.x, dy = hy - f.y, d2 = dx * dx + dy * dy;
          if (d2 > A * A) return false;
          const d = Math.sqrt(d2);
          if (d < r * 0.9 + f.r * 0.4) {
            f.dead = true;
            w.mass += f.v * mult;
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

    pickPowerups() {
      let any = false;
      for (const p of this.powerups) {
        for (const w of this.worms) {
          if (w.dead) continue;
          const dx = w.sx[0] - p.x, dy = w.sy[0] - p.y, rr = w.r + 24;
          if (dx * dx + dy * dy < rr * rr) {
            w.pw[p.type] = CFG.POWERUP_TIME;
            p.dead = any = true;
            this.emit('powerup', { worm: w, type: p.type });
            break;
          }
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
      for (const [w, k] of deaths) this.kill(w, k);
    }

    kill(w, killer, cause) {
      if (w.dead) return;
      w.dead = true;
      w.diedAt = this.time;
      const total = Math.max(10, w.mass * 0.8);
      const n = w.sx.length;
      const count = clamp(Math.round(total / 2.5), 5, n);
      const per = total / count, step = n / count, spread = w.r * 0.7;
      for (let k = 0; k < count; k++) {
        const i = Math.floor(k * step);
        this.addFood(w.sx[i] + rand(-spread, spread), w.sy[i] + rand(-spread, spread), per * rand(0.7, 1.3), w.stripeColor(i), rand(45, 60));
      }
      if (killer) killer.kills++;
      if (w.isPlayer) { this.player = null; this.lastPlayer = w; }
      this.emit('death', { victim: w, killer, cause: cause || (killer ? 'eaten' : 'wall') });
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

  root.WormEngine = { CFG, SKINS, SAVE_APP_IDS, validateSnapshot, Game, Worm, radiusFor, lengthFor, angleDiff, TAU };
})(typeof window !== 'undefined' ? window : globalThis);
