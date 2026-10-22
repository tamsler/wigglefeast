/* Wigglefeast — rendering, input and UI. */
(function () {
  'use strict';

  const { Game, CFG, SKINS, SAVE_APP_IDS, DIFFICULTIES, MIN_BOTS, MAX_BOTS, validateSnapshot, TAU, freshHabits, validHabits } = window.WormEngine;
  const $ = (id) => document.getElementById(id);

  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const mini = $('minimap');
  const mctx = mini.getContext('2d');

  const POWERUP_INFO = {
    magnet: { icon: '🧲', label: 'Magnet', color: '#ff4d6d' },
    x2: { icon: 'x2', label: 'Double food', color: '#ffd60a' },
    x5: { icon: 'x5', label: 'Food x5', color: '#ff9f1c' },
    speed: { icon: '⚡', label: 'Free boost', color: '#4cc9f0' },
    zoom: { icon: '🔭', label: 'Zoom out', color: '#b388ff' },
    turn: { icon: '🌀', label: 'Tight turns', color: '#8ac926' },
  };

  // ---------------------------------------------------------------------------
  // Settings (remembered between sessions when storage is available)
  // Storage keys keep their original 'wormarena.' prefix so saves from before the rename still load.
  const store = {
    get(k, d) { try { const v = localStorage.getItem('wormarena.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('wormarena.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  // One active game at a time (#45): only the window that owns the session writes the
  // world, stats and settings. Others wait on the "open in another window" panel.
  const SESSION_KEY = 'wormarena.session', HANDOVER_KEY = 'wormarena.handover';
  const STALE_MS = 3000, HANDOVER_WAIT_MS = 2000;
  const sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const readKey = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const writeKey = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
  const removeKey = (k) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } };
  const claimSession = () => writeKey(SESSION_KEY, { id: sessionId, at: Date.now() });
  // Active unless another window holds a fresh session (a closed or crashed one goes stale).
  let active = (() => { const s = readKey(SESSION_KEY); return !s || Date.now() - s.at >= STALE_MS; })();
  if (active) claimSession();
  // Before every write: still ours? If another window took over, stop and stand by.
  function isActive() {
    if (!active) return false;
    const s = readKey(SESSION_KEY);
    if (!s) { claimSession(); return true; } // cleared, or storage unavailable: nothing to protect
    if (s.id === sessionId) return true;
    goStandby();
    return false;
  }

  // Rebuilt from checked fields: a corrupted stored value must not stop startup (#26).
  const settings = {};
  function loadSettings() {
    Object.assign(settings, { name: '', skin: 0, botCount: 30, difficulty: 'normal', theme: 'auto' });
    const s = store.get('settings', null);
    if (s && typeof s === 'object') {
      if (typeof s.name === 'string') settings.name = s.name.slice(0, 16);
      if (Number.isInteger(s.skin) && s.skin >= 0 && s.skin < SKINS.length) settings.skin = s.skin;
      if (Number.isInteger(s.botCount) && s.botCount >= MIN_BOTS && s.botCount <= MAX_BOTS) settings.botCount = s.botCount;
      if (DIFFICULTIES.includes(s.difficulty)) settings.difficulty = s.difficulty;
      if (['auto', 'classic', 'halloween', 'christmas', 'snacks', 'tech'].includes(s.theme)) settings.theme = s.theme; // #64
    }
  }
  loadSettings();

  // ---------------------------------------------------------------------------
  // Profile: lifetime totals, top runs and recent runs. Kept separate from the
  // world snapshot so a failed world save can never take the stats with it.
  const PROFILE_VERSION = 1;
  const emptyProfile = () => ({
    v: PROFILE_VERSION,
    totals: { games: 0, kills: 0, time: 0, eaten: 0, best: 0, bestByDiff: Object.fromEntries(DIFFICULTIES.map((d) => [d, 0])) },
    top: [],
    recent: [],
  });
  // Profiles can come from imported files, so rebuild them from checked fields only.
  // Returns a clean copy, or null if anything is missing or the wrong type. With
  // keepGoodRuns, invalid runs are dropped instead of rejecting the whole profile (#46).
  function cleanProfile(p, keepGoodRuns = false) {
    const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const num = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    const str = (v) => typeof v === 'string' && v.length <= 40;
    if (!isObj(p) || p.v !== PROFILE_VERSION || !isObj(p.totals) || !Array.isArray(p.top) || !Array.isArray(p.recent)) return null;
    if (p.top.length > 1000 || p.recent.length > 1000) return null;
    const t = p.totals, bd = isObj(t.bestByDiff) ? t.bestByDiff : null;
    if (!['games', 'kills', 'time', 'eaten', 'best'].every((k) => num(t[k])) || !bd) return null;
    if (!DIFFICULTIES.every((d) => bd[d] === undefined || num(bd[d]))) return null; // Expert (#78) is missing from older profiles
    const cleanRun = (r) => {
      if (!isObj(r) || !['date', 'score', 'peak', 'kills', 'eaten', 'time'].every((k) => num(r[k]))) return null;
      if (!str(r.name) || !str(r.by) || !DIFFICULTIES.includes(r.diff) || !Number.isInteger(r.bots) || r.bots < 0 || r.bots > 1000) return null;
      return { date: r.date, name: r.name, score: r.score, peak: r.peak, kills: r.kills, eaten: r.eaten, time: r.time, by: r.by, diff: r.diff, bots: r.bots };
    };
    const top = p.top.map(cleanRun), recent = p.recent.map(cleanRun);
    if (!keepGoodRuns && (top.includes(null) || recent.includes(null))) return null;
    return {
      v: PROFILE_VERSION,
      totals: {
        games: t.games, kills: t.kills, time: t.time, eaten: t.eaten, best: t.best,
        bestByDiff: Object.fromEntries(DIFFICULTIES.map((d) => [d, bd[d] || 0])),
      },
      top: top.filter(Boolean).slice(0, 10),
      recent: recent.filter(Boolean).slice(0, 50),
    };
  }
  function loadProfile() {
    let rawProfile = null;
    try { rawProfile = localStorage.getItem('wormarena.profile'); } catch { /* storage unavailable */ }
    const storedProfile = store.get('profile', null);
    let p = cleanProfile(storedProfile);
    if (p) return p;
    // Keep unreadable data aside (as the raw text, even if it isn't JSON) instead of crashing on it
    // or losing it. Only the active window writes (#45).
    if (rawProfile !== null && active) {
      try { localStorage.setItem('wormarena.profile-corrupt', rawProfile); } catch { /* storage full or unavailable */ }
      console.warn('Stored profile was invalid; saved it as wormarena.profile-corrupt and kept what was readable.');
    }
    // A bad run costs only that run, not every stat (#46). Imports stay strict (importSave).
    p = cleanProfile(storedProfile, true);
    if (!p) {
      p = emptyProfile();
      p.totals.best = Number(store.get('best', 0)) || 0; // carry over the best score from before stats existed
    }
    if (rawProfile !== null && active) store.set('profile', p);
    return p;
  }
  let profile = loadProfile();
  const saveProfile = () => { if (isActive()) store.set('profile', profile); };

  function recordRun(w, killer, cause) {
    const run = {
      date: Date.now(),
      name: w.name,
      score: Math.round(w.mass),
      peak: Math.round(w.peak),
      kills: w.kills,
      eaten: w.eaten,
      time: Math.max(0, Math.round(game.time - w.born)),
      by: cause === 'quit' ? 'Quit' : killer ? killer.name : 'Wall',
      diff: game.settings.difficulty,
      bots: game.settings.botCount,
    };
    // Add to the stats as they are stored now, so runs recorded by another window are kept (#45).
    const stored = cleanProfile(store.get('profile', null), true);
    if (stored) profile = stored;
    const t = profile.totals;
    const isBest = run.peak > t.best;
    t.games++;
    t.kills += run.kills;
    t.time += run.time;
    t.eaten += run.eaten;
    t.best = Math.max(t.best, run.peak);
    t.bestByDiff[run.diff] = Math.max(t.bestByDiff[run.diff] || 0, run.peak);
    profile.recent.unshift(run);
    profile.recent.length = Math.min(profile.recent.length, 50);
    profile.top.push(run);
    profile.top.sort((a, b) => b.peak - a.peak);
    profile.top.length = Math.min(profile.top.length, 10);
    saveProfile();
    return isBest;
  }

  // ---------------------------------------------------------------------------
  // The player's habits (#135): how they escape a bot cutting them off, which expert bots learn
  // from. Kept between games, separate from the world and the stats, never exported; Reset stats
  // forgets it. Every game shares this one object, which the engine updates in place.
  function loadHabits() {
    const h = store.get('habits', null), out = freshHabits();
    if (validHabits(h)) for (const k in out) out[k] = h[k]; // checked fields only; damaged: start fresh
    return out;
  }
  const habits = loadHabits();

  // ---------------------------------------------------------------------------
  // World persistence: autosave every 10s, when the tab is hidden, and on close.
  // The habits are saved with the world.
  const WORLD_KEY = 'wormarena.world';
  function saveWorld() {
    if (!game || !isActive()) return;
    try {
      localStorage.setItem(WORLD_KEY, JSON.stringify(game));
    } catch {
      try { localStorage.removeItem(WORLD_KEY); } catch { /* storage unavailable */ }
    }
    store.set('habits', habits);
  }
  function loadWorld() {
    try {
      const raw = localStorage.getItem(WORLD_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  setInterval(saveWorld, 10000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveWorld(); });
  window.addEventListener('pagehide', saveWorld);
  window.addEventListener('beforeunload', saveWorld);

  // Session upkeep: heartbeat, handing over to a window that asks with Play here, and
  // releasing the session on close so a reload becomes active straight away.
  window.addEventListener('pagehide', () => {
    const s = readKey(SESSION_KEY), h = readKey(HANDOVER_KEY);
    // Release the session even mid-takeover, so a waiting window's Play here works at once.
    if (s && s.id === sessionId) removeKey(SESSION_KEY);
    if (h && h.to === sessionId) removeKey(HANDOVER_KEY); // closed while asking for Play here
    // Just saved; write nothing more (the visibilitychange that follows would re-claim).
    active = false;
  });
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return; // restored from the back/forward cache: decide again
    const s = readKey(SESSION_KEY);
    if (!s || s.id === sessionId || Date.now() - s.at >= STALE_MS) becomeActive(); else goStandby();
  });
  function answerHandover() {
    const h = readKey(HANDOVER_KEY);
    if (!active || !h || h.to === sessionId || Date.now() - h.at > 2 * HANDOVER_WAIT_MS) return;
    saveWorld();
    saveProfile();
    writeKey(SESSION_KEY, { id: h.to, at: Date.now() });
    goStandby();
  }
  window.addEventListener('storage', (e) => {
    if (e.key === HANDOVER_KEY) answerHandover();
    else if (e.key === SESSION_KEY) isActive(); // another window took over: stand by
  });
  setInterval(() => {
    answerHandover(); // also covers browsers that don't deliver the storage event
    if (isActive()) claimSession();
  }, 1000);

  async function playHere() {
    $('playHere').disabled = true;
    // Wait for the active window to save and hand over; take over anyway if it's gone or stuck.
    // If the session moves to another live window meanwhile (one that also pressed Play here),
    // ask that one instead and wait again, so its newer world isn't replaced by an older save (#74).
    for (let owner = null, t0 = 0; ;) {
      const s = readKey(SESSION_KEY);
      if (!s || s.id === sessionId || Date.now() - s.at >= STALE_MS) break;
      if (s.id !== owner) {
        owner = s.id;
        t0 = Date.now();
        writeKey(HANDOVER_KEY, { to: sessionId, at: t0 });
      } else if (Date.now() - t0 >= HANDOVER_WAIT_MS) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const h = readKey(HANDOVER_KEY);
    if (h && h.to === sessionId) removeKey(HANDOVER_KEY); // another window's request stays
    $('playHere').disabled = false;
    becomeActive();
  }
  // Take over: continue from whatever the previous window saved.
  function becomeActive() {
    active = true;
    claimSession();
    $('standby').classList.add('hidden');
    profile = loadProfile();
    Object.assign(habits, loadHabits()); // the other window saved what its bots learned
    loadSettings(); // the other window may have changed name, skin or world settings
    $('name').value = settings.name;
    $('botCount').value = settings.botCount;
    refreshMenu();
    const saved = loadWorld();
    if (!saved || !restoreWorld(saved)) { newGame(); showMenu(); }
  }
  function goStandby() {
    active = false;
    mode = 'standby';
    clearTimeout(deathTimer);
    for (const id of ['menu', 'death', 'hud', 'paused', 'statsScreen']) $(id).classList.add('hidden');
    $('standby').classList.remove('hidden');
  }

  // ---------------------------------------------------------------------------
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    const ms = mini.getBoundingClientRect().width || 160;
    mini.width = Math.round(ms * DPR);
    mini.height = Math.round(ms * DPR);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------------------
  // Pre-rendered sprites
  function makeHexPattern() {
    const s = 46, w = 3 * s, h = 80;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#0d1322';
    g.fillRect(0, 0, w, h);
    const hex = (cx, cy) => {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const x = cx + Math.cos(a) * s * 0.9, y = cy + Math.sin(a) * (h / 2 / 0.866) * 0.9;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
      g.fillStyle = '#121a2e';
      g.fill();
      g.strokeStyle = '#18213a';
      g.lineWidth = 2;
      g.stroke();
    };
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      hex(i * w, j * h);
      hex(i * w + 1.5 * s, j * h + h / 2);
    }
    return ctx.createPattern(c, 'repeat');
  }
  const bgPattern = makeHexPattern();

  const foodSprites = new Map();
  function foodSprite(color) {
    let s = foodSprites.get(color);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.14, color);
    grad.addColorStop(0.38, color);
    grad.addColorStop(0.42, hexAlpha(color, 0.35));
    grad.addColorStop(1, hexAlpha(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    foodSprites.set(color, s);
    return s;
  }
  function hexAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ---------------------------------------------------------------------------
  // Food themes (#64): food drawn as themed items instead of plain dots. Drawing only:
  // values, sizes, pickup and saves are unchanged. Each item is drawn once, in code, into a
  // cached sprite; themed food is its colour glow plus the item. Classic is the plain glow.
  const THEME_NAMES = { auto: 'Auto', classic: 'Classic', halloween: 'Halloween', christmas: 'Christmas', snacks: 'Snacks', tech: 'Tech' };
  const INK = '#1a1024';
  // Fill then outline the current path, so items read on the dark arena.
  function paint(g, s, fill) {
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = s * 0.045;
    g.strokeStyle = INK;
    g.stroke();
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function shine(g, x, y, r) {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.6, -0.6, 0, TAU);
    g.fill();
  }
  // Items per theme, in tier order: two small, one medium, one large.
  const FOOD_THEMES = {
    halloween: [
      { name: 'candy corn', draw(g, s) {
        g.beginPath(); g.moveTo(s * 0.5, s * 0.1); g.quadraticCurveTo(s * 0.86, s * 0.84, s * 0.8, s * 0.86);
        g.quadraticCurveTo(s * 0.5, s * 0.94, s * 0.2, s * 0.86); g.quadraticCurveTo(s * 0.14, s * 0.84, s * 0.5, s * 0.1); g.closePath();
        g.save(); g.clip();
        for (const [y0, y1, c] of [[0, 0.42, '#fff6e5'], [0.42, 0.66, '#ff8c1a'], [0.66, 1, '#ffd23f']]) { g.fillStyle = c; g.fillRect(0, s * y0, s, s * (y1 - y0)); }
        g.restore(); g.lineWidth = s * 0.045; g.strokeStyle = INK; g.stroke();
      } },
      { name: 'wrapped candy', draw(g, s) {
        for (const d of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.5 + d * s * 0.22, s * 0.5); g.lineTo(s * 0.5 + d * s * 0.44, s * 0.3); g.lineTo(s * 0.5 + d * s * 0.44, s * 0.7); g.closePath(); paint(g, s, '#b388ff'); }
        g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.25, s * 0.19, 0, 0, TAU); paint(g, s, '#7b2cbf');
        g.save(); g.clip(); g.strokeStyle = '#ff8c1a'; g.lineWidth = s * 0.07;
        for (const x of [0.38, 0.5, 0.62]) { g.beginPath(); g.moveTo(s * (x - 0.08), s * 0.72); g.lineTo(s * (x + 0.08), s * 0.28); g.stroke(); }
        g.restore(); shine(g, s * 0.42, s * 0.4, s * 0.05);
      } },
      { name: 'lollipop', draw(g, s) {
        roundRect(g, s * 0.46, s * 0.5, s * 0.08, s * 0.42, s * 0.03); paint(g, s, '#fff6e5');
        g.beginPath(); g.arc(s * 0.5, s * 0.38, s * 0.28, 0, TAU); paint(g, s, '#ff8c1a');
        g.strokeStyle = '#7b2cbf'; g.lineWidth = s * 0.06; g.beginPath();
        for (let a = 0; a < TAU * 2.2; a += 0.2) { const r = s * 0.03 + a * s * 0.017; g.lineTo(s * 0.5 + Math.cos(a) * r, s * 0.38 + Math.sin(a) * r); }
        g.stroke(); shine(g, s * 0.4, s * 0.27, s * 0.05);
      } },
      { name: 'pumpkin', draw(g, s) {
        for (const [x, w] of [[0.3, 0.2], [0.7, 0.2], [0.5, 0.24]]) { g.beginPath(); g.ellipse(s * x, s * 0.58, s * w, s * 0.3, 0, 0, TAU); paint(g, s, '#ff7b1a'); }
        roundRect(g, s * 0.45, s * 0.14, s * 0.1, s * 0.16, s * 0.03); paint(g, s, '#4f772d');
        g.fillStyle = '#2a1200';
        for (const d of [-1, 1]) { g.beginPath(); g.moveTo(s * (0.5 + d * 0.08), s * 0.5); g.lineTo(s * (0.5 + d * 0.2), s * 0.5); g.lineTo(s * (0.5 + d * 0.14), s * 0.4); g.closePath(); g.fill(); }
        g.beginPath(); g.moveTo(s * 0.3, s * 0.64);
        for (let i = 1; i <= 6; i++) g.lineTo(s * (0.3 + i * 0.0667), s * (i % 2 ? 0.74 : 0.66));
        g.lineTo(s * 0.5, s * 0.8); g.closePath(); g.fill();
      } },
    ],
    christmas: [
      { name: 'candy cane', draw(g, s) {
        const cane = () => { g.beginPath(); g.moveTo(s * 0.42, s * 0.9); g.lineTo(s * 0.42, s * 0.36); g.arc(s * 0.56, s * 0.36, s * 0.14, Math.PI, 0); };
        g.lineCap = 'round';
        cane(); g.lineWidth = s * 0.2; g.strokeStyle = INK; g.stroke();
        cane(); g.lineWidth = s * 0.14; g.strokeStyle = '#ffffff'; g.stroke();
        cane(); g.setLineDash([s * 0.08, s * 0.08]); g.strokeStyle = '#e63946'; g.stroke(); g.setLineDash([]);
      } },
      { name: 'ornament', draw(g, s) {
        roundRect(g, s * 0.42, s * 0.12, s * 0.16, s * 0.12, s * 0.02); paint(g, s, '#ffd166');
        g.beginPath(); g.arc(s * 0.5, s * 0.56, s * 0.32, 0, TAU); paint(g, s, '#e63946');
        g.strokeStyle = '#ffd166'; g.lineWidth = s * 0.05; g.beginPath();
        for (let i = 0; i <= 8; i++) g.lineTo(s * (0.2 + i * 0.075), s * (i % 2 ? 0.5 : 0.6));
        g.stroke(); shine(g, s * 0.38, s * 0.42, s * 0.07);
      } },
      { name: 'gingerbread', draw(g, s) {
        g.lineCap = 'round';
        for (const [x0, y0, x1, y1] of [[0.5, 0.45, 0.2, 0.42], [0.5, 0.45, 0.8, 0.42], [0.5, 0.6, 0.32, 0.88], [0.5, 0.6, 0.68, 0.88]]) {
          g.beginPath(); g.moveTo(s * x0, s * y0); g.lineTo(s * x1, s * y1); g.lineWidth = s * 0.19; g.strokeStyle = INK; g.stroke(); g.lineWidth = s * 0.14; g.strokeStyle = '#b5651d'; g.stroke();
        }
        g.beginPath(); g.ellipse(s * 0.5, s * 0.56, s * 0.16, s * 0.22, 0, 0, TAU); paint(g, s, '#b5651d');
        g.beginPath(); g.arc(s * 0.5, s * 0.26, s * 0.15, 0, TAU); paint(g, s, '#b5651d');
        g.fillStyle = '#ffffff';
        for (const [x, y] of [[0.45, 0.24], [0.55, 0.24]]) { g.beginPath(); g.arc(s * x, s * y, s * 0.025, 0, TAU); g.fill(); }
        g.fillStyle = '#e63946';
        for (const y of [0.5, 0.62]) { g.beginPath(); g.arc(s * 0.5, s * y, s * 0.035, 0, TAU); g.fill(); }
        g.strokeStyle = '#ffffff'; g.lineWidth = s * 0.025; g.beginPath(); g.arc(s * 0.5, s * 0.28, s * 0.06, 0.2, Math.PI - 0.2); g.stroke();
      } },
      { name: 'gift', draw(g, s) {
        roundRect(g, s * 0.16, s * 0.34, s * 0.68, s * 0.54, s * 0.05); paint(g, s, '#2a9d8f');
        g.fillStyle = '#e63946'; g.fillRect(s * 0.44, s * 0.34, s * 0.12, s * 0.54); g.fillRect(s * 0.16, s * 0.54, s * 0.68, s * 0.1);
        roundRect(g, s * 0.16, s * 0.34, s * 0.68, s * 0.54, s * 0.05); g.lineWidth = s * 0.045; g.strokeStyle = INK; g.stroke();
        for (const d of [-1, 1]) { g.beginPath(); g.ellipse(s * (0.5 + d * 0.13), s * 0.26, s * 0.13, s * 0.08, d * 0.5, 0, TAU); paint(g, s, '#e63946'); }
        g.beginPath(); g.arc(s * 0.5, s * 0.3, s * 0.05, 0, TAU); paint(g, s, '#e63946');
      } },
    ],
    snacks: [
      { name: 'cherry', draw(g, s) {
        g.strokeStyle = '#4f772d'; g.lineWidth = s * 0.05; g.lineCap = 'round';
        for (const x of [0.34, 0.64]) { g.beginPath(); g.moveTo(s * x, s * 0.56); g.quadraticCurveTo(s * 0.5, s * 0.3, s * 0.56, s * 0.12); g.stroke(); }
        for (const x of [0.34, 0.64]) { g.beginPath(); g.arc(s * x, s * 0.66, s * 0.18, 0, TAU); paint(g, s, '#d00000'); shine(g, s * (x - 0.06), s * 0.6, s * 0.045); }
      } },
      { name: 'cookie', draw(g, s) {
        g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.36, 0, TAU); paint(g, s, '#d9a45b');
        g.fillStyle = '#4a2511';
        for (const [x, y] of [[0.38, 0.38], [0.6, 0.34], [0.5, 0.56], [0.34, 0.62], [0.66, 0.6], [0.56, 0.74]]) { g.beginPath(); g.arc(s * x, s * y, s * 0.045, 0, TAU); g.fill(); }
      } },
      { name: 'donut', draw(g, s) {
        const ring = (r1, r2) => { g.beginPath(); g.arc(s * 0.5, s * 0.5, s * r1, 0, TAU); g.moveTo(s * (0.5 + r2), s * 0.5); g.arc(s * 0.5, s * 0.5, s * r2, 0, TAU, true); };
        ring(0.38, 0.12); g.fillStyle = '#e0a96d'; g.fill('evenodd'); g.lineWidth = s * 0.045; g.strokeStyle = INK; g.stroke();
        ring(0.31, 0.16); g.fillStyle = '#ff7eb6'; g.fill('evenodd');
        const cols = ['#ffd166', '#4cc9f0', '#ffffff', '#8ac926'];
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + 0.3, r = s * (0.21 + (i % 2) * 0.05), x = s * 0.5 + Math.cos(a) * r, y = s * 0.5 + Math.sin(a) * r;
          g.save(); g.translate(x, y); g.rotate(a * 2); g.fillStyle = cols[i % 4]; g.fillRect(-s * 0.03, -s * 0.01, s * 0.06, s * 0.02); g.restore();
        }
      } },
      { name: 'cake slice', draw(g, s) {
        g.beginPath(); g.moveTo(s * 0.14, s * 0.84); g.lineTo(s * 0.86, s * 0.84); g.lineTo(s * 0.86, s * 0.36); g.lineTo(s * 0.14, s * 0.62); g.closePath();
        g.save(); g.clip();
        for (const [y0, y1, c] of [[0.3, 0.46, '#fff6e5'], [0.46, 0.6, '#ffd166'], [0.6, 0.66, '#ff7eb6'], [0.66, 0.9, '#ffd166']]) { g.fillStyle = c; g.fillRect(0, s * y0, s, s * (y1 - y0)); }
        g.restore(); g.lineWidth = s * 0.045; g.strokeStyle = INK; g.stroke();
        g.beginPath(); g.arc(s * 0.72, s * 0.3, s * 0.09, 0, TAU); paint(g, s, '#d00000'); shine(g, s * 0.69, s * 0.27, s * 0.025);
      } },
    ],
    tech: [
      { name: 'microchip', draw(g, s) {
        g.fillStyle = '#c0c6d0';
        for (let i = 0; i < 4; i++) {
          const p = s * (0.3 + i * 0.13);
          g.fillRect(p - s * 0.025, s * 0.1, s * 0.05, s * 0.8); g.fillRect(s * 0.1, p - s * 0.025, s * 0.8, s * 0.05);
        }
        roundRect(g, s * 0.2, s * 0.2, s * 0.6, s * 0.6, s * 0.06); paint(g, s, '#2b2d42');
        roundRect(g, s * 0.36, s * 0.36, s * 0.28, s * 0.28, s * 0.03); paint(g, s, '#ffd166');
      } },
      { name: 'battery', draw(g, s) {
        roundRect(g, s * 0.4, s * 0.1, s * 0.2, s * 0.1, s * 0.02); paint(g, s, '#c0c6d0');
        roundRect(g, s * 0.26, s * 0.18, s * 0.48, s * 0.72, s * 0.08); paint(g, s, '#2b2d42');
        g.fillStyle = '#70e000';
        for (let i = 0; i < 3; i++) { roundRect(g, s * 0.33, s * (0.62 - i * 0.18), s * 0.34, s * 0.14, s * 0.03); g.fill(); }
      } },
      { name: 'floppy disk', draw(g, s) {
        g.beginPath(); g.moveTo(s * 0.14, s * 0.14); g.lineTo(s * 0.74, s * 0.14); g.lineTo(s * 0.86, s * 0.26); g.lineTo(s * 0.86, s * 0.86); g.lineTo(s * 0.14, s * 0.86); g.closePath(); paint(g, s, '#4361ee');
        roundRect(g, s * 0.3, s * 0.14, s * 0.4, s * 0.24, s * 0.02); paint(g, s, '#c0c6d0');
        g.fillStyle = '#2b2d42'; g.fillRect(s * 0.54, s * 0.18, s * 0.08, s * 0.16);
        roundRect(g, s * 0.24, s * 0.52, s * 0.52, s * 0.3, s * 0.03); paint(g, s, '#ffffff');
        g.fillStyle = '#9aa3c4'; g.fillRect(s * 0.3, s * 0.6, s * 0.4, s * 0.03); g.fillRect(s * 0.3, s * 0.68, s * 0.3, s * 0.03);
      } },
      { name: 'gear', draw(g, s) {
        g.beginPath();
        const teeth = 8;
        for (let i = 0; i < teeth * 2; i++) {
          const a0 = (i / (teeth * 2)) * TAU, a1 = ((i + 1) / (teeth * 2)) * TAU, r = s * (i % 2 ? 0.3 : 0.4);
          g.arc(s * 0.5, s * 0.5, r, a0, a1);
        }
        g.closePath(); g.moveTo(s * 0.62, s * 0.5); g.arc(s * 0.5, s * 0.5, s * 0.12, 0, TAU, true);
        g.fillStyle = '#ffb703'; g.fill('evenodd'); g.lineWidth = s * 0.045; g.strokeStyle = INK; g.stroke();
        shine(g, s * 0.36, s * 0.32, s * 0.05);
      } },
    ],
  };
  const itemSprites = new Map(); // 'theme:index' -> canvas, made once
  function itemSprite(theme, i) {
    const key = theme + ':' + i;
    let c = itemSprites.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.lineJoin = 'round';
    FOOD_THEMES[theme][i].draw(g, 96);
    itemSprites.set(key, c);
    return c;
  }
  // Which item a piece of food shows: by value (small, medium, large), and for small food by its
  // phase, which is fixed for the food's life and saved with it, so the item never changes. Both
  // are rounded as the save rounds them, so a reload can't tip a piece over a boundary.
  const r2 = (x) => Math.round(x * 100) / 100;
  const itemIndex = (f) => { const v = r2(f.v); return v < 3 ? (r2(f.ph) < Math.PI ? 0 : 1) : v < 7 ? 2 : 3; };
  const resolveTheme = () => (settings.theme === 'auto' ? window.WormEngine.seasonalTheme(new Date()) : settings.theme);
  let activeTheme = 'classic';

  const pwSprites = {};
  for (const type in POWERUP_INFO) {
    const info = POWERUP_INFO[type];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    grad.addColorStop(0, hexAlpha(info.color, 0.55));
    grad.addColorStop(1, hexAlpha(info.color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.beginPath();
    g.arc(64, 64, 34, 0, TAU);
    g.fillStyle = '#141a33';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = info.color;
    g.stroke();
    g.fillStyle = info.color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = info.icon.length > 1 && /^x/.test(info.icon) ? '900 30px system-ui, sans-serif' : '34px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    g.fillText(info.icon, 64, 67);
    pwSprites[type] = c;
  }

  // ---------------------------------------------------------------------------
  // Skin finishes (#58): how a skin's body is painted. Each routine draws on the context it
  // is given, so the picker swatches use exactly the arena's code. Smooth colours are stroked
  // in runs of 3 segments, like stripes, so every finish costs about the same per worm, and
  // patterns are spaced in body lengths (segments sit 0.42 r apart) so they look the same at
  // any size. t is game time, so animated finishes freeze while paused.
  const SEGMENT = 0.42;
  const every = (lengths) => Math.max(1, Math.round(lengths / SEGMENT)); // body lengths (in r) -> segments
  // Segments a per-segment decoration visits: every `step` from `first` up to `last`, limited to
  // the on-screen span while a worm is drawn in the arena (#99). Numbers stay absolute, so a
  // decoration stays put as the worm moves on and off screen.
  function stepRange(first, step, last) {
    if (!span) return [first, last];
    return [Math.max(first, first + Math.ceil((span[0] - first) / step) * step), Math.min(last, span[1])];
  }
  const rgbCache = new Map();
  function rgbOf(hex) {
    let v = rgbCache.get(hex);
    if (!v) { const n = parseInt(hex.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; rgbCache.set(hex, v); }
    return v;
  }
  function mix(a, b, k) {
    const x = rgbOf(a), y = rgbOf(b);
    return `rgb(${Math.round(x[0] + (y[0] - x[0]) * k)},${Math.round(x[1] + (y[1] - x[1]) * k)},${Math.round(x[2] + (y[2] - x[2]) * k)})`;
  }
  function along(stops, u) {
    const s = Math.min(0.9999, Math.max(0, u)) * (stops.length - 1), i = Math.floor(s);
    return mix(stops[i], stops[i + 1], s - i);
  }
  // While a worm is drawn in the arena, only the segments in `span` ([first, last], on screen)
  // are traced, so a massive body costs only what is visible (#82). Segment numbers stay
  // absolute, so skins' patterns don't shift. null elsewhere (menu swatches draw everything).
  let span = null;
  function traceOn(g, sx, sy, from, to) {
    g.beginPath();
    if (span) { from = Math.min(from, span[1]); to = Math.max(to, span[0]); if (from < to) return; }
    g.moveTo(sx[from], sy[from]);
    for (let i = from - 1; i >= to; i--) g.lineTo(sx[i], sy[i]);
  }
  // Strokes the body tail to head in runs of 3 segments, coloured by colorAt(first segment, count).
  function inRuns(g, sx, sy, r, colorAt) {
    const n = sx.length;
    g.lineWidth = 2 * r;
    for (let c = Math.ceil((n - 1) / 3) - 1; c >= 0; c--) {
      const a = c * 3, b = Math.min(n - 1, a + 3);
      if (span && (b < span[0] || a > span[1])) continue;
      g.strokeStyle = colorAt(a, n);
      traceOn(g, sx, sy, b, a);
      g.stroke();
    }
  }
  function solid(g, sx, sy, r, color) {
    g.strokeStyle = color;
    g.lineWidth = 2 * r;
    traceOn(g, sx, sy, sx.length - 1, 0);
    g.stroke();
  }
  // Unit normal of the body at segment i (pointing to the worm's left).
  function normalAt(sx, sy, i) {
    const a = Math.max(0, i - 1), b = Math.min(sx.length - 1, i + 1);
    const dx = sx[a] - sx[b], dy = sy[a] - sy[b], d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d, -dy / d, dx / d]; // tangent toward the head, then normal
  }
  const hash01 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const FINISH = {
    stripes(g, sx, sy, r, skin) {
      const cols = skin.colors;
      inRuns(g, sx, sy, r, (a) => cols[(a / 3) % cols.length]);
    },
    gradient(g, sx, sy, r, skin) {
      inRuns(g, sx, sy, r, (a, n) => along(skin.colors, a / Math.max(1, n - 1)));
    },
    neon(g, sx, sy, r, skin, t) {
      const [body, glow, lights] = skin.colors, n = sx.length, a0 = g.globalAlpha;
      g.strokeStyle = glow;
      for (const [w, k] of [[2 * r + r * 1.4, 0.12], [2 * r + r * 0.75, 0.25]]) {
        g.globalAlpha = a0 * k;
        g.lineWidth = w;
        traceOn(g, sx, sy, n - 1, 0);
        g.stroke();
      }
      g.globalAlpha = a0;
      solid(g, sx, sy, r, body);
      g.strokeStyle = glow;
      g.lineWidth = r * 0.32;
      traceOn(g, sx, sy, n - 1, 0);
      g.stroke();
      g.fillStyle = lights;
      const lit = every(2.8), [l0, l1] = stepRange(lit, lit, n - 2);
      for (let i = l0; i <= l1; i += lit) {
        g.globalAlpha = a0 * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 6 - i * 0.3)));
        g.beginPath();
        g.arc(sx[i], sy[i], r * 0.26, 0, TAU);
        g.fill();
      }
      g.globalAlpha = a0;
    },
    metallic(g, sx, sy, r, skin, t) {
      const [base, sheen, edge] = skin.colors, n = sx.length, a0 = g.globalAlpha;
      const p = (((t * 0.45) % 1.6) - 0.3) * n; // the shine sweeps head to tail
      inRuns(g, sx, sy, r, (a) => {
        const i = a + 1.5, k = Math.exp(-((i - p) ** 2) / 50) + 0.35 * Math.exp(-((i - p - 15) ** 2) / 27);
        return mix(base, sheen, Math.min(1, k));
      });
      g.save();
      g.translate(r * 0.3, r * 0.55);
      g.globalAlpha = a0 * 0.55;
      g.strokeStyle = edge;
      g.lineWidth = r * 0.22;
      traceOn(g, sx, sy, n - 1, 0);
      g.stroke();
      g.restore();
    },
    spots(g, sx, sy, r, skin) {
      const [base, spot, ring] = skin.colors, n = sx.length, step = every(2.8);
      solid(g, sx, sy, r, base);
      const [s0, s1] = stepRange(step, step, n - 2);
      for (let i = s0; i <= s1; i += step) {
        // The side comes from the spot's own number, so spots don't swap sides when only part is drawn.
        const [, , nx, ny] = normalAt(sx, sy, i), side = (i / step - 1) % 2 ? 1 : -1;
        const x = sx[i] + nx * side * r * 0.42, y = sy[i] + ny * side * r * 0.42;
        g.beginPath();
        g.arc(x, y, r * 0.3, 0, TAU);
        if (ring) {
          g.fillStyle = ring;
          g.fill();
          g.strokeStyle = spot;
          g.lineWidth = r * 0.16;
          g.stroke();
        } else {
          g.fillStyle = spot;
          g.fill();
        }
      }
    },
    scales(g, sx, sy, r, skin) {
      const [base, mark, dark] = skin.colors, n = sx.length, L = r * 0.62, Wd = r * 0.5;
      solid(g, sx, sy, r, base);
      g.fillStyle = mark;
      g.strokeStyle = dark;
      g.lineWidth = r * 0.1;
      const sc = every(2.1), [c0, c1] = stepRange(sc, sc, n - 2);
      for (let i = c0; i <= c1; i += sc) {
        const [tx, ty, nx, ny] = normalAt(sx, sy, i), x = sx[i], y = sy[i];
        g.beginPath();
        g.moveTo(x + tx * L, y + ty * L);
        g.lineTo(x + nx * Wd, y + ny * Wd);
        g.lineTo(x - tx * L, y - ty * L);
        g.lineTo(x - nx * Wd, y - ny * Wd);
        g.closePath();
        g.fill();
        g.stroke();
      }
    },
    galaxy(g, sx, sy, r, skin, t) {
      const [base, nebula, star] = skin.colors, n = sx.length, a0 = g.globalAlpha;
      inRuns(g, sx, sy, r, (a) => mix(base, nebula, 0.35 + 0.35 * Math.sin(a * 0.168 + 1)));
      // Stars batched into three brightness levels: three fills per worm, however long.
      const paths = [new Path2D(), new Path2D(), new Path2D()];
      const [g0, g1] = stepRange(0, 3, n - 1);
      for (let i = g0; i <= g1; i += 3) {
        const [, , nx, ny] = normalAt(sx, sy, i);
        for (let k = 0; k < 2; k++) {
          const seed = i * 2 + k, off = (hash01(seed) - 0.5) * 1.5 * r, size = r * (0.06 + 0.08 * hash01(seed + 99));
          const level = Math.min(2, Math.floor((0.5 + 0.5 * Math.sin(t * 3 + seed * 1.7)) * 3));
          const x = sx[i] + nx * off, y = sy[i] + ny * off;
          paths[level].moveTo(x + size, y);
          paths[level].arc(x, y, size, 0, TAU);
        }
      }
      g.fillStyle = star;
      paths.forEach((path, level) => { g.globalAlpha = a0 * (0.3 + 0.35 * level); g.fill(path); });
      g.globalAlpha = a0;
    },
    pulse(g, sx, sy, r, skin, t) {
      const [base, hot] = skin.colors;
      inRuns(g, sx, sy, r, (a) => mix(base, hot, Math.max(0, Math.sin(a * 0.19 - t * 5)) ** 2));
    },
  };
  const GLOSSY = (skin) => skin.finish !== 'neon' && skin.finish !== 'galaxy';

  // ---------------------------------------------------------------------------
  // Game state
  let game = null;
  let mode = 'menu'; // menu | playing | dead | paused | standby (another window is active, #45)
  const cam = { x: 0, y: 0, z: 0.6 };
  let spectate = null;

  function newGame(snapshot) {
    game = snapshot ? new Game(null, snapshot, { habits }) : new Game({ botCount: settings.botCount, difficulty: settings.difficulty }, null, { habits });
    game.on('death', onDeath);
    game.on('powerup', onPowerup);
    spectate = game.leaderboard[0] || null;
    if (spectate) { cam.x = spectate.x; cam.y = spectate.y; }
  }

  function onDeath({ victim, killer, cause }) {
    // killer.isPlayer, not game.player: the player may have died in the same tick (#47).
    if (killer && killer.isPlayer) feed(`You ate ${victim.name}! (+${Math.round(victim.mass * 0.8)})`, 'good');
    else if (victim.isPlayer) {
      // Another window took over in the meantime: its last save wins, so this run isn't kept (#45).
      if (!isActive()) return;
      const isBest = recordRun(victim, killer, cause);
      saveWorld();
      if (cause === 'quit') { showMenu(); return; }
      $('deathTitle').textContent = killer ? `Eaten by ${killer.name}` : 'You hit the wall!';
      showDeath(victim, isBest);
    } else if (victim === game.leaderboard[0] && victim.mass > 500) {
      feed(`#1 ${victim.name} was taken down${killer ? ' by ' + killer.name : ''}!`, 'info');
    }
  }

  function onPowerup({ worm, type }) {
    if (worm === game.player) feed(`${POWERUP_INFO[type].icon} ${POWERUP_INFO[type].label}!`, 'info');
  }

  function startPlaying() {
    settings.name = $('name').value.trim().slice(0, 16);
    if (isActive()) store.set('settings', settings);
    activeTheme = resolveTheme();
    if (!game || game.settings.botCount !== settings.botCount || game.settings.difficulty !== settings.difficulty) newGame();
    const p = game.spawnPlayer(settings.name || 'You', settings.skin);
    cam.x = p.x; cam.y = p.y;
    input.keyAngle = p.angle;
    mode = 'playing';
    $('menu').classList.add('hidden');
    $('death').classList.add('hidden');
    $('hud').classList.remove('hidden');
    canvas.focus();
  }

  let deathTimer = 0;
  function showDeath(w, isBest) {
    mode = 'dead';
    const score = Math.round(w.mass), peak = Math.round(w.peak), best = profile.totals.best;
    $('dScore').textContent = score.toLocaleString();
    $('dPeak').textContent = peak.toLocaleString();
    $('dKills').textContent = w.kills;
    $('dTime').textContent = fmtTime(game.time - w.born);
    $('dBest').textContent = isBest ? '🏆 New personal best!' : `Personal best: ${best.toLocaleString()}`;
    clearTimeout(deathTimer);
    deathTimer = setTimeout(() => { if (mode === 'dead') $('death').classList.remove('hidden'); }, 1100);
  }

  function showMenu() {
    mode = 'menu';
    for (const id of ['death', 'hud', 'paused', 'statsScreen']) $(id).classList.add('hidden');
    $('menu').classList.remove('hidden');
    const t = profile.totals;
    $('best').textContent = t.games ? `Personal best: ${t.best.toLocaleString()} · ${t.games} game${t.games === 1 ? '' : 's'} played` : '';
  }

  function setPaused(on, welcomeBack) {
    if (on && mode === 'playing') {
      mode = 'paused';
      $('pausedTitle').textContent = welcomeBack ? 'Welcome back!' : 'Paused';
      $('pausedText').innerHTML = welcomeBack && game.player
        ? `Your worm <b>${escapeHtml(game.player.name)}</b> is waiting with a score of <b>${Math.round(game.player.mass).toLocaleString()}</b>.`
        : 'Press <kbd>P</kbd> or <kbd>Esc</kbd> to resume';
      $('paused').classList.remove('hidden');
    } else if (!on && mode === 'paused') {
      mode = 'playing';
      $('paused').classList.add('hidden');
      last = performance.now();
    }
  }

  function endRun() {
    if (game.player) game.kill(game.player, null, 'quit');
    else showMenu();
  }

  // Load a saved world. If the player was alive, drop straight back into the run, paused.
  function restoreWorld(snapshot) {
    try { newGame(snapshot); } catch (err) { console.warn('Could not restore saved world:', err); return false; }
    const p = game.player;
    if (!p) { showMenu(); return true; }
    p.shield = Math.max(p.shield, 2); // a moment to get your bearings after resuming
    cam.x = p.x; cam.y = p.y; cam.z = targetZoom(p);
    input.keyAngle = p.angle;
    $('menu').classList.add('hidden');
    $('death').classList.add('hidden');
    $('statsScreen').classList.add('hidden');
    $('hud').classList.remove('hidden');
    mode = 'playing';
    setPaused(true, true);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Stats screen
  function fmtDuration(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
  }
  function fmtDate(ms) {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  // Every value is escaped: profiles can come from imported files (see #18).
  const fmtNum = (v) => Math.round(Number(v) || 0).toLocaleString();
  function runsTable(runs, ranked) {
    if (!runs.length) return '<tr><td class="empty">No games yet. Go eat something!</td></tr>';
    const e = escapeHtml;
    let h = `<tr>${ranked ? '<th>#</th>' : ''}<th class="num">Peak</th><th class="num">Kills</th><th class="num">Time</th><th>Killed by</th><th class="hide-sm">Mode</th><th class="hide-sm">Date</th></tr>`;
    runs.forEach((r, i) => {
      h += `<tr>${ranked ? `<td class="dim">${i + 1}</td>` : ''}<td class="num"><b>${e(fmtNum(r.peak))}</b></td><td class="num">${e(fmtNum(r.kills))}</td><td class="num">${e(fmtDuration(r.time))}</td>` +
        `<td>${e(r.by)}</td><td class="hide-sm dim">${e(r.diff)} · ${e(r.bots)}</td><td class="hide-sm dim">${e(fmtDate(r.date))}</td></tr>`;
    });
    return h;
  }
  function showStats() {
    const t = profile.totals;
    const avg = t.games ? Math.round(profile.recent.reduce((s, r) => s + r.peak, 0) / Math.max(1, profile.recent.length)) : 0;
    const tile = (v, label) => `<div><b>${escapeHtml(v)}</b><small>${escapeHtml(label)}</small></div>`;
    $('totals').innerHTML = tile(fmtNum(t.best), 'best') + tile(fmtNum(t.games), 'games') + tile(fmtNum(t.kills), 'kills') + tile(fmtDuration(t.time), 'played') +
      tile(fmtNum(avg), 'avg (recent)') + tile(fmtNum(t.eaten), 'food eaten') + tile(t.games ? (t.kills / t.games).toFixed(1) : '0', 'kills / game') +
      tile(t.games ? fmtDuration(Math.round(t.time / t.games)) : '0s', 'avg survival');
    $('bestByDiff').innerHTML = DIFFICULTIES.map((d) => tile(fmtNum(t.bestByDiff[d]), d)).join('');
    $('topRuns').innerHTML = runsTable(profile.top, true);
    $('recentRuns').innerHTML = runsTable(profile.recent.slice(0, 15), false);
    $('menu').classList.add('hidden');
    $('statsScreen').classList.remove('hidden');
  }

  function exportSave() {
    saveWorld();
    const data = { app: 'wigglefeast', kind: 'save', v: 1, exportedAt: new Date().toISOString(), profile, world: JSON.parse(JSON.stringify(game)) };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wigglefeast-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importSave(file) {
    const reader = new FileReader();
    reader.onload = () => {
      if (!isActive()) return; // another window took over while the file picker was open (#45)
      let data;
      try { data = JSON.parse(reader.result); } catch { alert('That file is not valid JSON.'); return; }
      // Check everything before changing anything: an invalid file leaves stats and world untouched.
      // Every export includes the world, so a file without one isn't a save (#29).
      const newProfile = data && SAVE_APP_IDS.includes(data.app) && data.kind === 'save' ? cleanProfile(data.profile) : null;
      let worldOk = false;
      if (newProfile && data.world) { try { validateSnapshot(data.world); worldOk = true; } catch (err) { console.warn(err.message); } }
      if (!newProfile || !worldOk) { alert('That file is not a valid Wigglefeast save. Nothing was changed.'); return; }
      if (!confirm('Replace your current stats and world with this save?') || !isActive()) return;
      if (!restoreWorld(data.world)) { alert('That save could not be loaded. Nothing was changed.'); return; }
      profile = newProfile;
      saveProfile();
      saveWorld();
      if (mode === 'menu') showStats();
    };
    reader.readAsText(file);
  }

  function fmtTime(s) {
    s = Math.floor(s);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  }

  // ---------------------------------------------------------------------------
  // Menu wiring
  $('name').value = settings.name;
  // Skin picker (#58): visible skins only, each swatch a piece of body painted by the skin's
  // own finish. Buttons keep the skin's position in SKINS, which saves and settings rely on.
  function skinSwatch(skin) {
    const size = 44, dpr = Math.min(2, window.devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#0d1322';
    g.fillRect(0, 0, size, size);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const r = size * 0.3, n = 14, sp = r * SEGMENT * Math.SQRT1_2, sx = [], sy = [];
    for (let i = 0; i < n; i++) { sx.push(size / 2 + (n / 2 - i) * sp); sy.push(size / 2 - (n / 2 - i) * sp); } // head at top right
    // A moment that shows the finish: the metallic shine or the pulse glow mid-swatch.
    FINISH[skin.finish](g, sx, sy, r, skin, skin.finish === 'pulse' ? 1.21 : 1.8);
    if (GLOSSY(skin)) {
      g.translate(-r * 0.22, -r * 0.3);
      g.strokeStyle = 'rgba(255,255,255,0.16)';
      g.lineWidth = r * 0.55;
      traceOn(g, sx, sy, n - 1, 0);
      g.stroke();
    }
    return c;
  }
  const skinsEl = $('skins');
  SKINS.forEach((skin, i) => {
    if (skin.hidden) return;
    const b = document.createElement('button');
    b.dataset.skin = i;
    b.title = skin.name;
    b.setAttribute('aria-label', skin.name);
    b.appendChild(skinSwatch(skin));
    b.addEventListener('click', () => { settings.skin = i; refreshMenu(); });
    skinsEl.appendChild(b);
  });
  $('botCount').value = settings.botCount;
  $('botCount').addEventListener('input', (e) => { settings.botCount = +e.target.value; refreshMenu(); });
  document.querySelectorAll('#difficulty button').forEach((b) =>
    b.addEventListener('click', () => { settings.difficulty = b.dataset.v; refreshMenu(); }));
  function refreshMenu() {
    [...skinsEl.children].forEach((b) => b.classList.toggle('on', +b.dataset.skin === settings.skin)); // none for a hidden skin
    $('skinName').textContent = SKINS[settings.skin].name;
    $('botCountVal').textContent = settings.botCount;
    document.querySelectorAll('#difficulty button').forEach((b) => b.classList.toggle('on', b.dataset.v === settings.difficulty));
    activeTheme = resolveTheme();
    // Auto comes first; the theme it currently follows isn't listed again unless it's the explicit choice (#67).
    const seasonal = window.WormEngine.seasonalTheme(new Date());
    [...$('themes').children].forEach((b) => {
      const theme = b.dataset.theme, on = theme === settings.theme;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on)); // the chosen theme, for screen readers too
      b.classList.toggle('hidden', theme !== 'auto' && theme === seasonal && !on);
    });
    $('themeName').textContent = settings.theme === 'auto' ? `Auto · ${THEME_NAMES[activeTheme]}` : THEME_NAMES[settings.theme];
  }
  // Food theme picker (#64): each button shows its theme's large item; Auto shows this season's.
  function themeIcon(theme) {
    const c = document.createElement('canvas'), size = 32, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext('2d');
    const shown = theme === 'auto' ? window.WormEngine.seasonalTheme(new Date()) : theme;
    if (shown === 'classic') g.drawImage(foodSprite('#ff2e88'), 0, 0, c.width, c.height);
    else g.drawImage(itemSprite(shown, 3), c.width * 0.08, c.width * 0.08, c.width * 0.84, c.width * 0.84);
    return c;
  }
  for (const theme of Object.keys(THEME_NAMES)) {
    const b = document.createElement('button');
    b.dataset.theme = theme;
    b.title = theme === 'auto' ? 'Auto: follows the season' : THEME_NAMES[theme];
    b.setAttribute('aria-label', b.title);
    b.appendChild(themeIcon(theme));
    if (theme === 'auto') { const tag = document.createElement('span'); tag.textContent = 'Auto'; b.appendChild(tag); }
    b.addEventListener('click', () => { settings.theme = theme; if (isActive()) store.set('settings', settings); refreshMenu(); });
    $('themes').appendChild(b);
  }
  refreshMenu();
  $('play').addEventListener('click', startPlaying);
  $('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') startPlaying(); });
  $('again').addEventListener('click', startPlaying);
  $('toMenu').addEventListener('click', showMenu);
  $('resume').addEventListener('click', () => setPaused(false));
  $('endRun').addEventListener('click', endRun);
  $('openStats').addEventListener('click', showStats);
  $('closeStats').addEventListener('click', showMenu);
  $('exportSave').addEventListener('click', exportSave);
  $('importSave').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importSave(f); });
  $('playHere').addEventListener('click', playHere);
  $('resetStats').addEventListener('click', () => {
    if (!confirm('Reset all stats and high scores? This cannot be undone (export a save first if you want a backup).') || !isActive()) return;
    profile = emptyProfile();
    saveProfile();
    Object.assign(habits, freshHabits()); // the bots forget the player's habits too (#135)
    store.set('habits', habits);
    showStats();
  });

  // ---------------------------------------------------------------------------
  // Input
  const input = { mx: W / 2 + 100, my: H / 2, mouseBoost: false, keyBoost: false, touchBoost: false, buttonBoost: false, left: false, right: false, useMouse: true, keyAngle: 0, steerId: null };
  // Active pointers by id. Touch: the first finger steers and any second finger boosts;
  // if the steering finger lifts, a remaining finger takes over steering (#20).
  const pointers = new Map();
  const touchIds = () => [...pointers].filter(([, p]) => p.type !== 'mouse').map(([id]) => id);
  function steerWith(id) {
    const p = pointers.get(id);
    input.steerId = id;
    input.mx = p.x; input.my = p.y; input.useMouse = true;
  }

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { type: e.pointerType, x: e.clientX, y: e.clientY });
    // Capture so the release reaches us even outside the canvas or window (#22).
    // Touch is captured implicitly; mouse and pen are not.
    if (e.pointerType !== 'touch') { try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } }
    if (e.pointerType === 'mouse') {
      if (e.button === 0) input.mouseBoost = true; // only the main button boosts (#30)
      input.mx = e.clientX; input.my = e.clientY; input.useMouse = true;
    } else {
      if (input.steerId === null || !pointers.has(input.steerId)) steerWith(e.pointerId);
      input.touchBoost = touchIds().length >= 2;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (e.pointerType === 'mouse' || e.pointerId === input.steerId) {
      input.mx = e.clientX; input.my = e.clientY; input.useMouse = true;
    }
    // Pressing or releasing a second mouse button only fires pointermove (#30).
    if (e.pointerType === 'mouse' && pointers.has(e.pointerId)) input.mouseBoost = (e.buttons & 1) !== 0;
  });
  const pointerEnd = (e) => {
    if (!pointers.delete(e.pointerId) && e.pointerType !== 'mouse') return;
    if (e.pointerType === 'mouse') input.mouseBoost = false;
    else {
      const rest = touchIds();
      if (e.pointerId === input.steerId) {
        input.steerId = null;
        if (rest.length) steerWith(rest[0]);
      }
      input.touchBoost = rest.length >= 2;
    }
  };
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('lostpointercapture', pointerEnd);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // On-screen buttons for touch screens (#11); CSS shows them only for a coarse pointer.
  // Their events never reach the canvas, so the boost finger is never counted as steering.
  const boostBtn = $('boostBtn');
  const boostIds = new Set(); // fingers on the button: boost lasts until the last one lifts
  boostBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // Keep the release even if the finger slides off the button.
    try { boostBtn.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    boostIds.add(e.pointerId);
    input.buttonBoost = true;
    boostBtn.classList.add('on');
  });
  function boostButtonEnd() {
    boostIds.clear();
    input.buttonBoost = false;
    boostBtn.classList.remove('on');
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    boostBtn.addEventListener(type, (e) => {
      boostIds.delete(e.pointerId);
      if (!boostIds.size) boostButtonEnd();
    });
  }
  boostBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  $('pauseBtn').addEventListener('click', () => setPaused(true));

  // Shown only while a run is being played; hiding them ends any boost they were giving.
  let touchControlsShown = false;
  function syncTouchControls() {
    const show = mode === 'playing' && !!game.player;
    if (show === touchControlsShown) return;
    touchControlsShown = show;
    $('touchControls').classList.toggle('hidden', !show);
    if (!show) boostButtonEnd();
  }

  // Keys are tracked individually so releasing one alias (e.g. W) doesn't cancel
  // another that is still held (e.g. Space) (#23).
  const KEYS = { boost: ['Space', 'ArrowUp', 'KeyW'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'] };
  const ALL_KEYS = [...KEYS.boost, ...KEYS.left, ...KEYS.right];
  const heldKeys = new Set();
  function syncKeys() {
    input.keyBoost = KEYS.boost.some((k) => heldKeys.has(k));
    input.left = KEYS.left.some((k) => heldKeys.has(k));
    input.right = KEYS.right.some((k) => heldKeys.has(k));
  }

  window.addEventListener('blur', () => {
    heldKeys.clear();
    syncKeys();
    pointers.clear();
    input.steerId = null;
    input.mouseBoost = input.touchBoost = false;
    boostButtonEnd();
    setPaused(true);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (ALL_KEYS.includes(e.code)) {
      // Outside a run, Space on a focused button presses it instead of boosting (#50).
      if (e.code === 'Space' && mode !== 'playing' && e.target.closest && e.target.closest('button, a[href]')) return;
      heldKeys.add(e.code);
      syncKeys();
      if (KEYS.boost.includes(e.code)) e.preventDefault();
      return;
    }
    if (e.repeat) return; // holding a toggle key must not flip it back and forth (#49)
    switch (e.code) {
      case 'KeyP': case 'Escape': setPaused(mode === 'playing'); break;
      case 'Enter': if (mode === 'dead' && !$('death').classList.contains('hidden')) startPlaying(); break;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (heldKeys.delete(e.code)) syncKeys();
  });

  function applyInput(dt) {
    const p = game.player;
    if (!p) return;
    if (input.left || input.right) {
      if (input.useMouse) input.keyAngle = p.angle;
      input.useMouse = false;
      input.keyAngle += (input.right - input.left) * 4.2 * dt;
    }
    if (input.useMouse) {
      const sx = (p.x - cam.x) * cam.z + W / 2, sy = (p.y - cam.y) * cam.z + H / 2;
      const dx = input.mx - sx, dy = input.my - sy;
      if (dx * dx + dy * dy > 16) p.targetAngle = Math.atan2(dy, dx);
    } else p.targetAngle = input.keyAngle;
    p.wantBoost = input.mouseBoost || input.keyBoost || input.touchBoost || input.buttonBoost;
  }

  // ---------------------------------------------------------------------------
  // Camera
  const baseZoom = () => Math.sqrt(W * H) / 1150;
  const targetZoom = (p) => baseZoom() / (1 + (p.r - 14) / 55) * (p.pw.zoom > 0 ? 0.62 : 1);
  function updateCamera(dt) {
    const base = baseZoom();
    let tx = cam.x, ty = cam.y, tz = cam.z, k = 6;
    const p = game.player;
    if (p) {
      tx = p.x; ty = p.y;
      tz = targetZoom(p);
    } else if (mode === 'menu') {
      if (!spectate || spectate.dead || Math.random() < 0.002) spectate = game.leaderboard[0] || null;
      if (spectate) { tx = spectate.x; ty = spectate.y; tz = base * 0.6; }
      k = 2;
    }
    const a = 1 - Math.exp(-k * dt), az = 1 - Math.exp(-2.5 * dt);
    cam.x += (tx - cam.x) * a;
    cam.y += (ty - cam.y) * a;
    cam.z += (tz - cam.z) * az;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // Boost arrows (#37, #41): two chevrons just in front of a boosting worm's head,
  // pointing where it is going, pulsing from back to front.
  let boostArrowsDrawn = 0; // worms whose arrows were drawn in the last frame
  function drawBoostArrows(w, t, alpha) {
    const r = w.r, a = w.angle, arm = r * 1.05, spread = Math.PI / 4;
    const hx = w.sx[0], hy = w.sy[0];
    for (let k = 0; k < 2; k++) {
      const d = r * (2 + 1.1 * k);
      const tx = hx + Math.cos(a) * d, ty = hy + Math.sin(a) * d;
      ctx.beginPath();
      ctx.moveTo(tx - Math.cos(a - spread) * arm, ty - Math.sin(a - spread) * arm);
      ctx.lineTo(tx, ty);
      ctx.lineTo(tx - Math.cos(a + spread) * arm, ty - Math.sin(a + spread) * arm);
      ctx.globalAlpha = alpha * (0.55 + 0.45 * Math.sin(t * 10 - k * 1.3));
      ctx.strokeStyle = w.skin.accent;
      ctx.lineWidth = Math.max(4, r * 0.55);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(2, r * 0.22);
      ctx.stroke();
    }
    boostArrowsDrawn++;
  }
  // Read-only hook for the browser tests; nothing in the game uses it.
  window.wigglefeastDebug = {
    boostArrows: () => boostArrowsDrawn,
    theme: () => activeTheme, // #64
    itemSprites: () => itemSprites.size,
    foodItem: (f) => (activeTheme === 'classic' ? 'dot' : FOOD_THEMES[activeTheme][itemIndex(f)].name),
  };

  function tracePath(sx, sy, from, to) {
    ctx.beginPath();
    if (span && from > to) { from = Math.min(from, span[1]); to = Math.max(to, span[0]); if (from < to) return; }
    ctx.moveTo(sx[from], sy[from]);
    if (from > to) for (let i = from - 1; i >= to; i--) ctx.lineTo(sx[i], sy[i]);
    else for (let i = from + 1; i <= to; i++) ctx.lineTo(sx[i], sy[i]);
  }

  // part: 'all'; 'body' (everything but the eyes and boost arrows); 'head' (the first few
  // segments, eyes and arrows). Worms are drawn lighter first, so a heavier body lies over a lighter
  // one and a worm wrapping a smaller one is on top of it (#116). The player's body takes its place
  // in that order, and its head is drawn last, on top of everything (#102).
  const HEAD_SEGS = 4; // segments drawn again in the head pass: about 1.7 r, enough to cover the head
  const drawOrder = []; // reused every frame
  const byMass = (a, b) => a.mass - b.mass;
  // Is another worm's body (one that could be hit, so not shielded) over this worm's head?
  function headCovered(w) {
    const hx = w.sx[0], hy = w.sy[0], gw = game.gridWorms;
    return game.segGrid.query(hx, hy, w.r + game.maxR + 4, (oi, si) => {
      const o = gw[oi];
      if (o === w || o.dead) return false;
      const dx = o.sx[si] - hx, dy = o.sy[si] - hy, rr = w.r + o.r + 4;
      return dx * dx + dy * dy < rr * rr;
    });
  }
  function drawWorm(w, t, view, part = 'all') {
    const m = w.boosting ? w.r * 3.5 : 0; // boost arrows reach ahead of the head
    if (w.maxX + m < view.x0 || w.minX - m > view.x1 || w.maxY + m < view.y0 || w.minY - m > view.y1) return;
    const sx = w.sx, sy = w.sy, n = sx.length, r = w.r, skin = w.skin;
    // The on-screen stretch of the body, padded for the widest glow (neon, boost) (#82).
    const pad = 1.8 * r + m + 10;
    let lo = -1, hi = -1;
    for (let i = 0; i < n; i++) {
      const x = sx[i], y = sy[i];
      if (x + pad >= view.x0 && x - pad <= view.x1 && y + pad >= view.y0 && y - pad <= view.y1) { if (lo < 0) lo = i; hi = i; }
    }
    if (lo < 0) return;
    if (part === 'head') {
      if (lo > HEAD_SEGS) return; // the head is off screen
      hi = Math.min(hi, HEAD_SEGS);
    }
    span = [Math.max(0, lo - 1), Math.min(n - 1, hi + 1, part === 'head' ? HEAD_SEGS : n - 1)];
    try { drawWormBody(w, t, sx, sy, n, r, skin, part); } finally { span = null; }
  }

  function drawWormBody(w, t, sx, sy, n, r, skin, part) {
    const alpha = w.shield > 0 ? 0.45 + 0.25 * Math.sin(t * 14) : 1;
    ctx.globalAlpha = alpha;

    if (w.boosting && part !== 'head') { // the glow along the whole body, drawn once
      ctx.globalAlpha = alpha * (0.3 + 0.15 * Math.sin(t * 18));
      ctx.strokeStyle = skin.accent;
      ctx.lineWidth = 2 * r + 16;
      tracePath(sx, sy, n - 1, 0);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    // The head pass repaints the head (clipped to a disc around it) only when another worm's body
    // actually touches it; otherwise the worm is drawn in one piece, exactly as before, with no seam.
    // While shielded nothing can hurt the player, so it never repaints (that would show through the
    // shield's transparency) and draws just the eyes and arrows (#102).
    const repaint = part !== 'head' || (w.shield <= 0 && headCovered(w));
    if (repaint) {
      if (part === 'head') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx[0], sy[0], r + 3, 0, TAU);
        ctx.clip();
      }

      // Outline
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2 * r + 4;
      tracePath(sx, sy, n - 1, 0);
      ctx.stroke();

      // Body, painted by the skin's finish (#58), then the glossy highlight
      FINISH[skin.finish](ctx, sx, sy, r, skin, game.time);
      if (GLOSSY(skin)) {
        ctx.save();
        ctx.translate(-r * 0.22, -r * 0.3);
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = r * 0.55;
        tracePath(sx, sy, n - 1, 0);
        ctx.stroke();
        ctx.restore();
      }
      if (part === 'head') ctx.restore();
    }

    if (part === 'body') { ctx.globalAlpha = 1; return; } // eyes and arrows come with the head pass

    // Eyes
    const hx = sx[0], hy = sy[0], ex = Math.cos(w.angle), ey = Math.sin(w.angle);
    const lx = Math.cos(w.targetAngle) * r * 0.14, ly = Math.sin(w.targetAngle) * r * 0.14;
    for (let side = -1; side <= 1; side += 2) {
      const cx = hx + ex * r * 0.32 - ey * side * r * 0.46, cy = hy + ey * r * 0.32 + ex * side * r * 0.46;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.36, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + lx, cy + ly, r * 0.19, 0, TAU);
      ctx.fillStyle = '#141414';
      ctx.fill();
    }
    if (w.boosting) drawBoostArrows(w, t, alpha);
    ctx.globalAlpha = 1;
  }

  // Magnet field (#103): while a worm's magnet runs, waves ripple forward from its head to the edge
  // of its food pull range and dissipate: arcs about 110 degrees wide in front of it, alternating
  // blue, red, blue... like a magnet's two poles. Drawn on the floor (under food, power-ups and
  // worms), fainter on bots, fading over the magnet's last 3 seconds, and moving with game time,
  // so it is still while paused.
  const FIELD_COLORS = ['#4cc9f0', '#ff4d6d']; // blue, red, by each wave's birth number
  const FIELD_PERIOD = 1.4, FIELD_WAVES = 4; // seconds from head to edge; waves in flight at once
  const FIELD_HALF = (55 * Math.PI) / 180; // half of the ~110 degree arc
  const fieldReach = (w) => 2.2 * w.r + 24 + CFG.MAGNET_REACH; // the food pull range (engine.js)
  function drawMagnetField(w, time) {
    const r = w.r, A = fieldReach(w), hx = w.sx[0], hy = w.sy[0], a = w.angle;
    const base = (w === game.player ? 0.7 : 0.35) * Math.min(1, w.pw.magnet / 3);
    const gap = FIELD_PERIOD / FIELD_WAVES, newest = Math.floor(time / gap);
    ctx.lineWidth = Math.max(3.5, 0.2 * r);
    ctx.lineCap = 'round';
    for (let j = 0; j < FIELD_WAVES; j++) {
      const n = newest - j, p = (time - n * gap) / FIELD_PERIOD; // 0 at the head, 1 at the edge
      const alpha = base * (1 - p);
      if (alpha < 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = FIELD_COLORS[((n % 2) + 2) % 2];
      ctx.beginPath();
      ctx.arc(hx, hy, r + (A - r) * p, a - FIELD_HALF, a + FIELD_HALF);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function render(t) {
    const z = cam.z;
    boostArrowsDrawn = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0f1c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(z * DPR, 0, 0, z * DPR, (W / 2 - cam.x * z) * DPR, (H / 2 - cam.y * z) * DPR);

    const hw = W / 2 / z, hh = H / 2 / z;
    const view = { x0: cam.x - hw - 40, x1: cam.x + hw + 40, y0: cam.y - hh - 40, y1: cam.y + hh + 40 };
    const R = game.R;

    // Arena floor
    ctx.fillStyle = bgPattern;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

    // Out of bounds + border
    ctx.beginPath();
    ctx.rect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fillStyle = 'rgba(70, 0, 18, 0.6)';
    ctx.fill('evenodd');
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.lineWidth = 10 / z;
    ctx.strokeStyle = `rgba(255, 60, 100, ${0.55 + 0.2 * Math.sin(t * 3)})`;
    ctx.stroke();

    // Magnet fields, under everything else in the arena (#103)
    for (const w of game.worms) {
      if (w.dead || !(w.pw.magnet > 0)) continue;
      const A = fieldReach(w), x = w.sx[0], y = w.sy[0];
      if (x + A < view.x0 || x - A > view.x1 || y + A < view.y0 || y - A > view.y1) continue;
      drawMagnetField(w, game.time);
    }

    // Food: a glow in the food's colour, plus the theme's item unless the theme is Classic (#64)
    const themed = activeTheme !== 'classic';
    for (const f of game.food) {
      if (f.x < view.x0 || f.x > view.x1 || f.y < view.y0 || f.y > view.y1) continue;
      const pulse = 1 + 0.12 * Math.sin(t * 3 + f.ph), a = f.life < 3 ? Math.max(0, f.life / 3) : 1;
      if (!themed) {
        const D = f.r * 5 * pulse;
        ctx.globalAlpha = a;
        ctx.drawImage(foodSprite(f.c), f.x - D / 2, f.y - D / 2, D, D);
      } else {
        const G = f.r * 4.8 * pulse, D = f.r * 4 * pulse; // items drawn a bit larger than dots so small ones read
        ctx.globalAlpha = a * 0.55;
        ctx.drawImage(foodSprite(f.c), f.x - G / 2, f.y - G / 2, G, G);
        ctx.globalAlpha = a;
        ctx.drawImage(itemSprite(activeTheme, itemIndex(f)), f.x - D / 2, f.y - D / 2, D, D);
      }
    }
    ctx.globalAlpha = 1;

    // Power-ups
    for (const p of game.powerups) {
      if (p.x < view.x0 - 60 || p.x > view.x1 + 60 || p.y < view.y0 - 60 || p.y > view.y1 + 60) continue;
      const D = 110 * (1 + 0.08 * Math.sin(t * 4 + p.ph));
      ctx.drawImage(pwSprites[p.type], p.x - D / 2, p.y - D / 2 + Math.sin(t * 2 + p.ph) * 4, D, D);
    }

    // Worms: lighter under heavier (#116), the player's head on top (#102). The sort is stable,
    // so worms of equal mass keep their usual order.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const player = game.player;
    drawOrder.length = 0;
    for (const w of game.worms) drawOrder.push(w);
    drawOrder.sort(byMass);
    for (const w of drawOrder) drawWorm(w, t, view, w === player ? 'body' : 'all');
    drawOrder.length = 0;
    if (player) drawWorm(player, t, view, 'head');

    // Names
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `700 ${13 / z}px system-ui, sans-serif`;
    ctx.lineWidth = 3 / z;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    for (const w of game.worms) {
      const x = w.sx[0], y = w.sy[0];
      if (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1) continue;
      const ty = y - w.r - 8 / z;
      // Reputation tags (#83): the worm's kills so far after its name (#126); a bot coming after
      // you in red-orange. ⚔ in emoji form (U+FE0F): the plain glyph is tiny at name size and
      // reads like "x2".
      const label = w.kills ? `${w.name} \u2694\uFE0F${w.kills}` : w.name;
      ctx.fillStyle = w === player ? '#ffd60a' : player && w.ai && w.ai.retaliating === player ? PLAYER_DOT : 'rgba(255,255,255,0.85)';
      ctx.strokeText(label, x, ty);
      ctx.fillText(label, x, ty);
    }
  }

  // Minimap density (#80, #91): how much of each part of the arena other worms' bodies cover,
  // as a fine grid over the arena's square refreshed a few times a second, lightly blurred and
  // drawn in one colour. No worm gets a marker or its own colour; the player's body doesn't count.
  const DENSITY_N = 64, DENSITY_MS = 250;
  const DENSITY_SIGMA = 1; // blur, in cells: softens edges without washing out detail
  const DENSITY_FULL = 0.15; // coverage drawn at full strength
  const DENSITY_GAMMA = 0.6; // < 1 keeps sparse areas visible without flattening crowds
  const DENSITY_RGB = [127, 220, 255];
  const PLAYER_DOT = '#ff5a1f'; // red-orange: stands out on the dark map and the cyan shading
  const densityCanvas = document.createElement('canvas');
  densityCanvas.width = densityCanvas.height = DENSITY_N;
  const dctx = densityCanvas.getContext('2d');
  const densityImg = dctx.createImageData(DENSITY_N, DENSITY_N);
  const densityGrid = new Float32Array(DENSITY_N * DENSITY_N);
  const densityTmp = new Float32Array(DENSITY_N * DENSITY_N);
  const densityKernel = (() => {
    const rad = Math.ceil(DENSITY_SIGMA * 3), k = [];
    for (let i = -rad; i <= rad; i++) k.push(Math.exp(-(i * i) / (2 * DENSITY_SIGMA * DENSITY_SIGMA)));
    const sum = k.reduce((a, b) => a + b, 0);
    return k.map((v) => v / sum);
  })();
  let densityAt = -Infinity, densityFor = null;
  // Separable blur of src into dst, along x or y. Near the grid's edge only the in-range
  // weights count, so a worm by the arena's rim isn't drawn dimmer than one mid-arena.
  function blurDensity(src, dst, n, horizontal) {
    const kr = (densityKernel.length - 1) / 2;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let sum = 0, wsum = 0;
        for (let j = -kr; j <= kr; j++) {
          const xx = horizontal ? x + j : x, yy = horizontal ? y : y + j;
          if (xx >= 0 && xx < n && yy >= 0 && yy < n) { sum += src[yy * n + xx] * densityKernel[j + kr]; wsum += densityKernel[j + kr]; }
        }
        dst[y * n + x] = sum / wsum;
      }
    }
  }
  function updateDensity() {
    const R = game.R, n = DENSITY_N, cell = (2 * R) / n, g = densityGrid, player = game.player;
    g.fill(0);
    for (const w of game.worms) {
      if (w.dead || w === player) continue;
      const area = 2 * w.r * w.r * 0.42; // the body area one segment stands for (spacing 0.42 r, as in the engine)
      const sx = w.sx, sy = w.sy;
      for (let i = 0; i < sx.length; i++) {
        const ix = Math.floor((sx[i] + R) / cell), iy = Math.floor((sy[i] + R) / cell);
        if (ix >= 0 && ix < n && iy >= 0 && iy < n) g[iy * n + ix] += area;
      }
    }
    blurDensity(g, densityTmp, n, true);
    blurDensity(densityTmp, g, n, false);
    const d = densityImg.data, full = cell * cell * DENSITY_FULL;
    for (let i = 0; i < g.length; i++) {
      d[i * 4] = DENSITY_RGB[0]; d[i * 4 + 1] = DENSITY_RGB[1]; d[i * 4 + 2] = DENSITY_RGB[2];
      d[i * 4 + 3] = Math.round(255 * Math.min(1, Math.pow(g[i] / full, DENSITY_GAMMA)));
    }
    dctx.putImageData(densityImg, 0, 0);
  }

  function renderMinimap() {
    // Match the canvas to its on-screen size (110 or 160 px): resize() runs while the HUD is hidden.
    const cw = mini.clientWidth;
    if (cw && mini.width !== Math.round(cw * DPR)) mini.width = mini.height = Math.round(cw * DPR);
    const s = mini.width, c = s / 2, R = game.R, k = (c - 4) / R;
    const now = performance.now();
    if (now - densityAt > DENSITY_MS || densityFor !== game.player) { updateDensity(); densityAt = now; densityFor = game.player; }
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, s, s);
    mctx.save();
    mctx.beginPath();
    mctx.arc(c, c, c - 2, 0, TAU);
    mctx.fillStyle = 'rgba(10,14,30,0.6)';
    mctx.fill();
    mctx.clip();
    mctx.imageSmoothingEnabled = true;
    mctx.drawImage(densityCanvas, c - R * k, c - R * k, 2 * R * k, 2 * R * k);
    mctx.restore();
    mctx.beginPath();
    mctx.arc(c, c, c - 2, 0, TAU);
    mctx.lineWidth = 2 * DPR;
    mctx.strokeStyle = 'rgba(255,60,100,0.6)';
    mctx.stroke();
    const p = game.player;
    if (p) {
      mctx.beginPath();
      mctx.arc(c + p.x * k, c + p.y * k, 4 * DPR, 0, TAU);
      mctx.fillStyle = PLAYER_DOT;
      mctx.fill();
      mctx.strokeStyle = 'rgba(0,0,0,0.7)';
      mctx.lineWidth = 1.5 * DPR;
      mctx.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // HUD
  let hudT = 0;
  // BOOST badge next to the score (#37): synced every frame so it keeps pace with the head arrows.
  let boostBadgeShown = false;
  function syncBoostBadge() {
    const p = game.player;
    const show = !!(p && !p.dead && p.boosting);
    if (show === boostBadgeShown) return;
    boostBadgeShown = show;
    $('boostBadge').classList.toggle('hidden', !show);
  }

  function updateHud(dt) {
    hudT -= dt;
    if (hudT > 0 || mode === 'menu') return;
    hudT = 0.15;
    const p = game.player || game.lastPlayer;
    if (!p) return;
    const lb = game.leaderboard;
    $('score').textContent = Math.round(p.mass).toLocaleString();
    $('rank').textContent = p.dead ? '-' : game.rankOf(p);
    $('total').textContent = lb.length;
    $('kills').textContent = p.kills;

    let html = '';
    const top = lb.slice(0, 10);
    top.forEach((w, i) => { html += row(i + 1, w, w === p); });
    if (!p.dead && !top.includes(p)) html += `<li class="gap">···</li>` + row(game.rankOf(p), p, true);
    $('lb').innerHTML = html;
  }

  // Power-up badges (#63): one per power-up type, built once in POWERUP_INFO order and synced
  // every frame, so the ring drains smoothly and the "about to end" blink is never restarted.
  const badges = {};
  for (const type in POWERUP_INFO) {
    const info = POWERUP_INFO[type], el = document.createElement('div'), icon = document.createElement('span');
    el.className = 'badge hidden';
    el.dataset.type = type;
    el.title = info.label;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', info.label);
    el.style.setProperty('--c', info.color);
    icon.textContent = info.icon;
    if (/^x\d/.test(info.icon)) icon.className = 'txt';
    el.appendChild(icon);
    $('powerups').appendChild(el);
    badges[type] = { el, shown: false, left: -1, ending: 0 };
  }
  function syncBadges() {
    const p = game.player;
    for (const type in badges) {
      const b = badges[type], left = p && !p.dead ? p.pw[type] : 0, show = left > 0;
      if (show !== b.shown) { b.shown = show; b.el.classList.toggle('hidden', !show); }
      if (!show) continue;
      const frac = Math.round(Math.min(1, left / CFG.POWERUP_TIME) * 200) / 200;
      if (frac !== b.left) { b.left = frac; b.el.style.setProperty('--left', frac); }
      const ending = left <= 1 ? 2 : left <= 3 ? 1 : 0; // blink in the last 3 s, faster in the last 1 s
      if (ending !== b.ending) {
        b.ending = ending;
        b.el.classList.toggle('ending', ending > 0);
        b.el.classList.toggle('ending-fast', ending === 2);
      }
    }
  }
  function row(rank, w, me) {
    return `<li class="${me ? 'me' : ''}"><span class="r">${rank}</span><span class="n">${escapeHtml(w.name)}</span><span class="m">${Math.round(w.mass).toLocaleString()}</span></li>`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function feed(text, cls) {
    const el = document.createElement('div');
    el.textContent = text;
    if (cls) el.className = cls;
    const box = $('feed');
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.remove(), 3200);
  }

  // ---------------------------------------------------------------------------
  // Main loop: variable step split into ≤1/60s sub-steps so 120Hz displays stay smooth.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (mode !== 'paused' && mode !== 'standby') {
      applyInput(dt);
      const steps = Math.max(1, Math.ceil(dt / (1 / 60) - 0.01));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) game.update(h);
      updateCamera(dt);
    }
    render(now / 1000);
    if (mode !== 'menu' && mode !== 'standby') renderMinimap();
    updateHud(dt);
    syncUpdateBanner();
    syncTouchControls();
    syncBoostBadge();
    syncBadges();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Releases: offline support, update checks and the "Update available" banner.
  // Only when served over http(s); opened from file:// there is no service worker.
  const updates = { reg: null, ready: false, dismissed: false, reloading: false, shown: false, lastCheck: 0 };

  function askVersion(worker) {
    return new Promise((resolve) => {
      if (!worker) { resolve(null); return; }
      const ch = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 3000); // older workers don't answer
      ch.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data && e.data.version); };
      worker.postMessage({ type: 'version' }, [ch.port2]);
    });
  }

  function checkForUpdate() {
    if (!updates.reg) return;
    updates.lastCheck = Date.now();
    updates.reg.update().catch(() => {}); // offline or unreachable: try again later
  }

  async function onUpdateReady(worker) {
    updates.ready = true;
    const v = await askVersion(worker);
    $('updateText').textContent = v ? `Version ${v} is ready` : 'A new version is ready';
  }

  // A worker that finishes installing while a controller exists is an update;
  // with no controller it is the very first install.
  function watchInstalling(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady(worker);
    });
  }

  function applyUpdate() {
    const waiting = updates.reg && updates.reg.waiting;
    saveWorld();
    if (!waiting) { location.reload(); return; }
    updates.reloading = true;
    waiting.postMessage({ type: 'skipWaiting' });
  }

  // Banner shows when an update is ready, unless dismissed or a run is being played.
  function syncUpdateBanner() {
    const show = updates.ready && !updates.dismissed && mode !== 'playing';
    if (show !== updates.shown) {
      updates.shown = show;
      $('updateBanner').classList.toggle('hidden', !show);
    }
  }

  $('updateReload').addEventListener('click', applyUpdate);
  $('updateDismiss').addEventListener('click', () => { updates.dismissed = true; });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const sw = navigator.serviceWorker;
    sw.register('sw.js').then((reg) => {
      updates.reg = reg;
      if (reg.waiting && sw.controller) onUpdateReady(reg.waiting);
      watchInstalling(reg.installing);
      reg.addEventListener('updatefound', () => watchInstalling(reg.installing));
      checkForUpdate();
    }).catch((err) => console.warn('Service worker failed:', err));
    sw.addEventListener('controllerchange', () => { if (updates.reloading) location.reload(); });
    sw.ready.then((reg) => askVersion(sw.controller || reg.active)).then((v) => { $('version').textContent = v ? `v${v}` : ''; });
    setInterval(checkForUpdate, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - updates.lastCheck > 5 * 60 * 1000) checkForUpdate();
    });
  } else {
    $('version').textContent = 'local';
  }
  // Ask the browser not to evict saves when it is low on space.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  if (active) {
    const saved = loadWorld();
    if (!saved || !restoreWorld(saved)) { newGame(); showMenu(); }
    // Two windows opened in the same instant can both claim: the last claim wins, the other stands by.
    setTimeout(() => { const s = readKey(SESSION_KEY); if (s && s.id !== sessionId) goStandby(); }, 50 + Math.random() * 100);
  } else {
    newGame(); // a world to show behind the panel; never saved
    goStandby();
  }
  requestAnimationFrame(frame);
})();
