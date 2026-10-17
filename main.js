/* Wigglefeast — rendering, input and UI. */
(function () {
  'use strict';

  const { Game, SKINS, SAVE_APP_IDS, validateSnapshot, TAU } = window.WormEngine;
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
  };

  // ---------------------------------------------------------------------------
  // Settings (remembered between sessions when storage is available)
  // Storage keys keep their original 'wormarena.' prefix so saves from before the rename still load.
  const store = {
    get(k, d) { try { const v = localStorage.getItem('wormarena.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('wormarena.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  const settings = Object.assign({ name: '', skin: 0, botCount: 30, difficulty: 'normal' }, store.get('settings', {}));

  // ---------------------------------------------------------------------------
  // Profile: lifetime totals, top runs and recent runs. Kept separate from the
  // world snapshot so a failed world save can never take the stats with it.
  const PROFILE_VERSION = 1;
  const emptyProfile = () => ({
    v: PROFILE_VERSION,
    totals: { games: 0, kills: 0, time: 0, eaten: 0, best: 0, bestByDiff: { easy: 0, normal: 0, hard: 0 } },
    top: [],
    recent: [],
  });
  // Profiles can come from imported files, so rebuild them from checked fields only.
  // Returns a clean copy, or null if anything is missing or the wrong type.
  function cleanProfile(p) {
    const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const num = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    const str = (v) => typeof v === 'string' && v.length <= 40;
    if (!isObj(p) || p.v !== PROFILE_VERSION || !isObj(p.totals) || !Array.isArray(p.top) || !Array.isArray(p.recent)) return null;
    if (p.top.length > 1000 || p.recent.length > 1000) return null;
    const t = p.totals, bd = isObj(t.bestByDiff) ? t.bestByDiff : null;
    if (!['games', 'kills', 'time', 'eaten', 'best'].every((k) => num(t[k])) || !bd) return null;
    if (!['easy', 'normal', 'hard'].every((d) => bd[d] === undefined || num(bd[d]))) return null;
    const cleanRun = (r) => {
      if (!isObj(r) || !['date', 'score', 'peak', 'kills', 'eaten', 'time'].every((k) => num(r[k]))) return null;
      if (!str(r.name) || !str(r.by) || !['easy', 'normal', 'hard'].includes(r.diff) || !Number.isInteger(r.bots) || r.bots < 0 || r.bots > 1000) return null;
      return { date: r.date, name: r.name, score: r.score, peak: r.peak, kills: r.kills, eaten: r.eaten, time: r.time, by: r.by, diff: r.diff, bots: r.bots };
    };
    const top = p.top.map(cleanRun), recent = p.recent.map(cleanRun);
    if (top.includes(null) || recent.includes(null)) return null;
    return {
      v: PROFILE_VERSION,
      totals: {
        games: t.games, kills: t.kills, time: t.time, eaten: t.eaten, best: t.best,
        bestByDiff: { easy: bd.easy || 0, normal: bd.normal || 0, hard: bd.hard || 0 },
      },
      top: top.slice(0, 10),
      recent: recent.slice(0, 50),
    };
  }
  const storedProfile = store.get('profile', null);
  let profile = cleanProfile(storedProfile);
  if (!profile) {
    // Keep unreadable data aside instead of crashing on it or throwing it away.
    if (storedProfile !== null) { store.set('profile-corrupt', storedProfile); console.warn('Stored profile was invalid; saved it as wormarena.profile-corrupt and started fresh.'); }
    profile = emptyProfile();
    profile.totals.best = Number(store.get('best', 0)) || 0; // carry over the best score from before stats existed
    if (storedProfile !== null) store.set('profile', profile);
  }
  const saveProfile = () => store.set('profile', profile);

  function recordRun(w, killer, cause) {
    const run = {
      date: Date.now(),
      name: w.name,
      score: Math.round(w.mass),
      peak: Math.round(w.peak),
      kills: w.kills,
      eaten: w.eaten,
      time: Math.round(game.time - w.born),
      by: cause === 'quit' ? 'Quit' : killer ? killer.name : 'Wall',
      diff: game.settings.difficulty,
      bots: game.settings.botCount,
    };
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
  // World persistence: autosave every 10s, when the tab is hidden, and on close.
  const WORLD_KEY = 'wormarena.world';
  function saveWorld() {
    if (!game) return;
    try {
      localStorage.setItem(WORLD_KEY, JSON.stringify(game));
    } catch {
      try { localStorage.removeItem(WORLD_KEY); } catch { /* storage unavailable */ }
    }
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
  // Game state
  let game = null;
  let mode = 'menu'; // menu | playing | dead | paused
  const cam = { x: 0, y: 0, z: 0.6 };
  let spectate = null;

  function newGame(snapshot) {
    game = snapshot ? new Game(null, snapshot) : new Game({ botCount: settings.botCount, difficulty: settings.difficulty });
    game.on('death', onDeath);
    game.on('powerup', onPowerup);
    spectate = game.leaderboard[0] || null;
    if (spectate) { cam.x = spectate.x; cam.y = spectate.y; }
  }

  function onDeath({ victim, killer, cause }) {
    const p = game.player;
    if (killer && killer === p) feed(`You ate ${victim.name}! (+${Math.round(victim.mass * 0.8)})`, 'good');
    else if (victim.isPlayer) {
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
    store.set('settings', settings);
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
    $('bestByDiff').innerHTML = ['easy', 'normal', 'hard'].map((d) => tile(fmtNum(t.bestByDiff[d]), d)).join('');
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
      let data;
      try { data = JSON.parse(reader.result); } catch { alert('That file is not valid JSON.'); return; }
      // Check everything before changing anything: an invalid file leaves stats and world untouched.
      const newProfile = data && SAVE_APP_IDS.includes(data.app) && data.kind === 'save' ? cleanProfile(data.profile) : null;
      let worldOk = !data || !data.world;
      if (newProfile && data.world) { try { validateSnapshot(data.world); worldOk = true; } catch (err) { console.warn(err.message); } }
      if (!newProfile || !worldOk) { alert('That file is not a valid Wigglefeast save. Nothing was changed.'); return; }
      if (!confirm('Replace your current stats and world with this save?')) return;
      if (data.world && !restoreWorld(data.world)) { alert('That save could not be loaded. Nothing was changed.'); return; }
      profile = newProfile;
      saveProfile();
      if (data.world) saveWorld();
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
  const skinsEl = $('skins');
  SKINS.forEach((skin, i) => {
    const b = document.createElement('button');
    const stops = skin.colors.map((c, k) => `${c} ${k * 6}px ${(k + 1) * 6}px`).join(',');
    b.style.background = `repeating-linear-gradient(135deg, ${stops})`;
    b.title = skin.name;
    b.addEventListener('click', () => { settings.skin = i; refreshMenu(); });
    skinsEl.appendChild(b);
  });
  $('botCount').value = settings.botCount;
  $('botCount').addEventListener('input', (e) => { settings.botCount = +e.target.value; refreshMenu(); });
  document.querySelectorAll('#difficulty button').forEach((b) =>
    b.addEventListener('click', () => { settings.difficulty = b.dataset.v; refreshMenu(); }));
  function refreshMenu() {
    [...skinsEl.children].forEach((b, i) => b.classList.toggle('on', i === settings.skin));
    $('skinName').textContent = SKINS[settings.skin].name;
    $('botCountVal').textContent = settings.botCount;
    document.querySelectorAll('#difficulty button').forEach((b) => b.classList.toggle('on', b.dataset.v === settings.difficulty));
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
  $('resetStats').addEventListener('click', () => {
    if (!confirm('Reset all stats and high scores? This cannot be undone (export a save first if you want a backup).')) return;
    profile = emptyProfile();
    saveProfile();
    showStats();
  });

  // ---------------------------------------------------------------------------
  // Input
  const input = { mx: W / 2 + 100, my: H / 2, mouseBoost: false, keyBoost: false, touchBoost: false, left: false, right: false, useMouse: true, keyAngle: 0, steerId: null };
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
    if (e.pointerType === 'mouse') {
      // Capture so the release reaches us even outside the canvas or window (#22).
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      input.mouseBoost = true;
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
    input.mouseBoost = input.touchBoost = false;
    setPaused(true);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (ALL_KEYS.includes(e.code)) {
      heldKeys.add(e.code);
      syncKeys();
      if (KEYS.boost.includes(e.code)) e.preventDefault();
      return;
    }
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
    p.wantBoost = input.mouseBoost || input.keyBoost || input.touchBoost;
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
  function tracePath(sx, sy, from, to) {
    ctx.beginPath();
    ctx.moveTo(sx[from], sy[from]);
    if (from > to) for (let i = from - 1; i >= to; i--) ctx.lineTo(sx[i], sy[i]);
    else for (let i = from + 1; i <= to; i++) ctx.lineTo(sx[i], sy[i]);
  }

  function drawWorm(w, t, view) {
    if (w.maxX < view.x0 || w.minX > view.x1 || w.maxY < view.y0 || w.minY > view.y1) return;
    const sx = w.sx, sy = w.sy, n = sx.length, r = w.r, cols = w.skin.colors;
    const alpha = w.shield > 0 ? 0.45 + 0.25 * Math.sin(t * 14) : 1;
    ctx.globalAlpha = alpha;

    if (w.boosting) {
      ctx.globalAlpha = alpha * (0.3 + 0.15 * Math.sin(t * 18));
      ctx.strokeStyle = cols[0];
      ctx.lineWidth = 2 * r + 16;
      tracePath(sx, sy, n - 1, 0);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2 * r + 4;
    tracePath(sx, sy, n - 1, 0);
    ctx.stroke();

    // Striped body, tail to head
    ctx.lineWidth = 2 * r;
    const S = 3, chunks = Math.ceil((n - 1) / S);
    for (let c = chunks - 1; c >= 0; c--) {
      const a = c * S, b = Math.min(n - 1, a + S);
      ctx.strokeStyle = cols[c % cols.length];
      tracePath(sx, sy, b, a);
      ctx.stroke();
    }

    // Glossy highlight
    ctx.save();
    ctx.translate(-r * 0.22, -r * 0.3);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = r * 0.55;
    tracePath(sx, sy, n - 1, 0);
    ctx.stroke();
    ctx.restore();

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
    ctx.globalAlpha = 1;
  }

  function render(t) {
    const z = cam.z;
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

    // Food
    for (const f of game.food) {
      if (f.x < view.x0 || f.x > view.x1 || f.y < view.y0 || f.y > view.y1) continue;
      const D = f.r * 5 * (1 + 0.12 * Math.sin(t * 3 + f.ph));
      if (f.life < 3) ctx.globalAlpha = Math.max(0, f.life / 3);
      ctx.drawImage(foodSprite(f.c), f.x - D / 2, f.y - D / 2, D, D);
      if (f.life < 3) ctx.globalAlpha = 1;
    }

    // Power-ups
    for (const p of game.powerups) {
      if (p.x < view.x0 - 60 || p.x > view.x1 + 60 || p.y < view.y0 - 60 || p.y > view.y1 + 60) continue;
      const D = 110 * (1 + 0.08 * Math.sin(t * 4 + p.ph));
      ctx.drawImage(pwSprites[p.type], p.x - D / 2, p.y - D / 2 + Math.sin(t * 2 + p.ph) * 4, D, D);
    }

    // Worms (player on top)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const player = game.player;
    for (const w of game.worms) if (w !== player) drawWorm(w, t, view);
    if (player) drawWorm(player, t, view);

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
      ctx.fillStyle = w === player ? '#ffd60a' : 'rgba(255,255,255,0.85)';
      ctx.strokeText(w.name, x, ty);
      ctx.fillText(w.name, x, ty);
    }
  }

  function renderMinimap() {
    const s = mini.width, c = s / 2, R = game.R, k = (c - 4) / R;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, s, s);
    mctx.beginPath();
    mctx.arc(c, c, c - 2, 0, TAU);
    mctx.fillStyle = 'rgba(10,14,30,0.6)';
    mctx.fill();
    mctx.lineWidth = 2 * DPR;
    mctx.strokeStyle = 'rgba(255,60,100,0.6)';
    mctx.stroke();
    const lb = game.leaderboard;
    for (let i = 0; i < lb.length; i++) {
      const w = lb[i];
      if (w.dead || w.isPlayer) continue;
      const big = i < 10;
      mctx.fillStyle = big ? w.skin.colors[0] : 'rgba(255,255,255,0.3)';
      mctx.beginPath();
      mctx.arc(c + w.x * k, c + w.y * k, (big ? 2.5 : 1.5) * DPR + (big ? Math.min(3, w.r / 15) * DPR : 0), 0, TAU);
      mctx.fill();
    }
    const p = game.player;
    if (p) {
      const x = c + p.x * k, y = c + p.y * k;
      mctx.beginPath();
      mctx.arc(x, y, 4 * DPR, 0, TAU);
      mctx.fillStyle = '#fff';
      mctx.fill();
      mctx.strokeStyle = '#ffd60a';
      mctx.lineWidth = 2 * DPR;
      mctx.stroke();
      // view rectangle
      mctx.strokeStyle = 'rgba(255,255,255,0.25)';
      mctx.lineWidth = 1 * DPR;
      mctx.strokeRect(c + (cam.x - W / 2 / cam.z) * k, c + (cam.y - H / 2 / cam.z) * k, (W / cam.z) * k, (H / cam.z) * k);
    }
  }

  // ---------------------------------------------------------------------------
  // HUD
  let hudT = 0;
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

    let pw = '';
    if (!p.dead) for (const type in POWERUP_INFO) {
      const left = p.pw[type];
      if (left <= 0) continue;
      const info = POWERUP_INFO[type];
      pw += `<div class="pw" style="color:${info.color}"><span class="ic">${info.icon}</span><span class="bar"><i style="width:${(left / 16) * 100}%"></i></span>${Math.ceil(left)}s</div>`;
    }
    $('powerups').innerHTML = pw;
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
    if (mode !== 'paused') {
      applyInput(dt);
      const steps = Math.max(1, Math.ceil(dt / (1 / 60) - 0.01));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) game.update(h);
      updateCamera(dt);
    }
    render(now / 1000);
    if (mode !== 'menu') renderMinimap();
    updateHud(dt);
    syncUpdateBanner();
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

  const saved = loadWorld();
  if (!saved || !restoreWorld(saved)) { newGame(); showMenu(); }
  requestAnimationFrame(frame);
})();
