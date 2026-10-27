/* Wigglefeast — rendering, input and UI. */
(function () {
  'use strict';

  const { Game, CFG, SKINS, SAVE_APP_IDS, DIFFICULTIES, difficultyOf, MIN_BOTS, MAX_BOTS, validateSnapshot, TAU, freshHabits, validHabits, knowsTactic } = window.WormEngine;
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
  // Declared here, not with the game state: checkAchievements() at startup can reach goStandby() (#185).
  let mode = 'menu'; // menu | playing | dead | paused | standby (another window is active, #45)
  let deathTimer = 0;
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
    Object.assign(settings, { name: '', skin: 0, botCount: 30, difficulty: 'normal', theme: 'auto', sound: true, music: true });
    const s = store.get('settings', null);
    if (s && typeof s === 'object') {
      if (typeof s.name === 'string') settings.name = s.name.slice(0, 16);
      if (Number.isInteger(s.skin) && s.skin >= 0 && s.skin < SKINS.length) settings.skin = s.skin;
      if (Number.isInteger(s.botCount) && s.botCount >= MIN_BOTS && s.botCount <= MAX_BOTS) settings.botCount = s.botCount;
      if (difficultyOf(s.difficulty)) settings.difficulty = difficultyOf(s.difficulty); // Expert became Hard (#177)
      if (['auto', 'classic', 'halloween', 'christmas', 'snacks', 'tech'].includes(s.theme)) settings.theme = s.theme; // #64
      if (typeof s.sound === 'boolean') settings.sound = s.sound; // #9: older settings have neither, so both stay on
      if (typeof s.music === 'boolean') settings.music = s.music;
    }
    window.WormAudio.setSound(settings.sound);
    window.WormAudio.setMusic(settings.music);
    syncSoundButtons(); // also when another window changed them and this one takes over (#45)
  }
  loadSettings();

  // ---------------------------------------------------------------------------
  // Sound (#9): audio.js makes the sounds; this file says what happened. Browsers only let audio
  // start after a user gesture, so the first click, tap or key press unlocks it.
  const sound = window.WormAudio;
  for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, () => sound.unlock(), { capture: true, passive: true });
  // Sound and music toggles (#9): corner buttons on the main menu and pause panels, and the M key.
  // Saved at once (by the window that has the game, #45), not only when a run starts.
  function syncSoundButtons() {
    document.querySelectorAll('.audioToggles button').forEach((b) => {
      const on = settings[b.dataset.toggle];
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('off', !on);
      b.classList.toggle('muted', b.dataset.toggle === 'music' && !settings.sound);
    });
  }
  function setAudio(key, on) {
    settings[key] = on;
    if (key === 'sound') sound.setSound(on);
    else sound.setMusic(on);
    if (isActive()) store.set('settings', settings);
    syncSoundButtons();
  }
  document.querySelectorAll('.audioToggles button').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation(); // no click sound for the toggles themselves
    setAudio(b.dataset.toggle, !settings[b.dataset.toggle]);
  }));
  syncSoundButtons();
  // Menu buttons click; starting a run swooshes instead.
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.overlay button');
    if (!b) return;
    sound.play(b.id === 'play' || b.id === 'again' ? 'start' : 'click');
  });

  // ---------------------------------------------------------------------------
  // Profile: lifetime totals, top runs and recent runs. Kept separate from the
  // world snapshot so a failed world save can never take the stats with it.
  const PROFILE_VERSION = 1;
  // Achievements (#14). Each progress(c) returns [value, target]; c is the stored profile (totals,
  // saved runs) plus, during a run, the live run. One list drives unlocking, past play and the stats
  // screen. skin: the reward it unlocks (SKINS[].unlock names the same id).
  const runsOf = (c) => c.top.concat(c.recent);
  const most = (c, key) => Math.max(0, ...runsOf(c).map((r) => r[key]), c.live ? c.live[key] : 0);
  const bestOn = (c, diff) => Math.max(c.totals.bestByDiff[diff] || 0, c.live && c.live.diff === diff ? c.live.peak : 0);
  const plus = (c, key, liveKey = key) => c.totals[key] + (c.live ? c.live[liveKey] : 0);
  const ACHIEVEMENTS = [
    { id: 'snack', name: 'Snack Time', goal: 'Reach 1,000', progress: (c) => [Math.max(c.totals.best, c.live ? c.live.peak : 0), 1000] },
    { id: 'noodle', name: 'Big Noodle', goal: 'Reach 5,000', progress: (c) => [Math.max(c.totals.best, c.live ? c.live.peak : 0), 5000] },
    { id: 'titan', name: 'Titan', goal: 'Reach 25,000', progress: (c) => [Math.max(c.totals.best, c.live ? c.live.peak : 0), 25000] },
    { id: 'firstbite', name: 'First Bite', goal: 'Eat your first worm', progress: (c) => [plus(c, 'kills'), 1] },
    { id: 'hunter', name: 'Hungry Hunter', goal: 'Eat 10 worms in one run', progress: (c) => [most(c, 'kills'), 10] },
    { id: 'apex', name: 'Apex', goal: 'Eat 100 worms in total', progress: (c) => [plus(c, 'kills'), 100] },
    { id: 'hang', name: 'Hang In There', goal: 'Survive 5 minutes in one run', time: true, progress: (c) => [most(c, 'time'), 300] },
    { id: 'marathon', name: 'Marathon', goal: 'Survive 20 minutes in one run', time: true, progress: (c) => [most(c, 'time'), 1200] },
    { id: 'grazer', name: 'Grazer', goal: 'Eat 10,000 food in total', progress: (c) => [plus(c, 'eaten'), 10000] },
    { id: 'dedicated', name: 'Dedicated', goal: 'Play 50 games', progress: (c) => [c.totals.games, 50] },
    { id: 'hard', name: 'Hard Mode', goal: 'Reach 5,000 on Hard', progress: (c) => [bestOn(c, 'hard'), 5000] },
    // Expert Survivor until there were three levels (#177); the id stays, so it stays earned.
    { id: 'expert', name: 'Hard Survivor', goal: 'Reach 10,000 on Hard', progress: (c) => [bestOn(c, 'hard'), 10000] },
    { id: 'stargazer', name: 'Stargazer', goal: 'Eat 25 special food', progress: (c) => [plus(c, 'specials'), 25] },
    { id: 'board', name: 'Top of the Board', goal: 'Be first on the leaderboard', progress: (c) => [c.totals.firsts + (c.live && c.live.first ? 1 : 0), 1] },
  ];
  for (const a of ACHIEVEMENTS) a.skin = (SKINS.find((s) => s.unlock === a.id) || {}).name;
  const ACH_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));
  const emptyProfile = () => ({
    v: PROFILE_VERSION,
    totals: { games: 0, kills: 0, time: 0, eaten: 0, best: 0, bestByDiff: Object.fromEntries(DIFFICULTIES.map((d) => [d, 0])), specials: 0, firsts: 0 },
    top: [],
    recent: [],
    ach: {}, // achievement id -> when it was earned (#14)
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
    // Bests may hold 'expert' (#78) from before there were three levels (#177), or miss levels.
    const BEST_KEYS = DIFFICULTIES.concat(['expert']);
    if (!BEST_KEYS.every((d) => bd[d] === undefined || num(bd[d]))) return null;
    const cleanRun = (r) => {
      if (!isObj(r) || !['date', 'score', 'peak', 'kills', 'eaten', 'time'].every((k) => num(r[k]))) return null;
      if (!str(r.name) || !str(r.by) || !difficultyOf(r.diff) || !Number.isInteger(r.bots) || r.bots < 0 || r.bots > 1000) return null;
      return { date: r.date, name: r.name, score: r.score, peak: r.peak, kills: r.kills, eaten: r.eaten, time: r.time, by: r.by, diff: difficultyOf(r.diff), bots: r.bots };
    };
    const top = p.top.map(cleanRun), recent = p.recent.map(cleanRun);
    if (!keepGoodRuns && (top.includes(null) || recent.includes(null))) return null;
    // Achievements and their two counters (#14) are optional: profiles from before them load with
    // none, and unknown or damaged entries are dropped rather than rejecting the profile.
    const ach = {};
    if (isObj(p.ach)) for (const id of Object.keys(p.ach)) if (ACH_IDS.has(id) && num(p.ach[id])) ach[id] = p.ach[id];
    return {
      v: PROFILE_VERSION,
      totals: {
        games: t.games, kills: t.kills, time: t.time, eaten: t.eaten, best: t.best,
        // Each level's best, the old Expert's folded into Hard (#177).
        bestByDiff: Object.fromEntries(DIFFICULTIES.map((d) => [d, Math.max(0, ...BEST_KEYS.filter((k) => difficultyOf(k) === d).map((k) => bd[k] || 0))])),
        specials: num(t.specials) ? t.specials : 0, firsts: num(t.firsts) ? t.firsts : 0,
      },
      top: top.filter(Boolean).slice(0, 10),
      recent: recent.filter(Boolean).slice(0, 50),
      ach,
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

  // Earns every achievement the stats (plus the live run, if any) now prove (#14). New ones are
  // saved at once, merged with the stored profile so another window's achievements survive (#45),
  // and announced when `announce` is set (in a run, at its end); on load and import they're silent.
  // merge: false when the profile was just replaced (import) and the stored one must not leak in.
  function checkAchievements(live = null, { announce = false, merge = true } = {}) {
    const c = { totals: profile.totals, top: profile.top, recent: profile.recent, live };
    const earned = ACHIEVEMENTS.filter((a) => !profile.ach[a.id] && a.progress(c)[0] >= a.progress(c)[1]);
    if (!earned.length) return earned;
    const now = Date.now();
    for (const a of earned) profile.ach[a.id] = now;
    if (merge) {
      const stored = cleanProfile(store.get('profile', null), true);
      if (stored) {
        for (const id in stored.ach) profile.ach[id] = Math.min(stored.ach[id], profile.ach[id] || Infinity);
        stored.ach = profile.ach;
        profile = stored;
      }
    }
    saveProfile();
    if (announce) for (const a of earned) announceAchievement(a);
    return earned;
  }
  const isUnlocked = (skin) => !skin.unlock || !!profile.ach[skin.unlock];
  // A locked reward can't be worn (#178): after Reset stats, on load, after an import or when another
  // window takes over, a locked chosen skin falls back to the first free one, and a run in progress
  // in a locked skin continues in that free skin.
  function dropLockedSkin() {
    if (!isUnlocked(SKINS[settings.skin])) {
      settings.skin = 0;
      if (isActive()) store.set('settings', settings);
      refreshMenu();
    }
    const p = game && game.player;
    if (p && !isUnlocked(p.skin)) p.skin = SKINS[settings.skin];
  }
  // What the stats can't see until a run ends: special food eaten and whether the player led (#14).
  const freshRun = () => ({ specials: 0, first: false });
  let liveRun = freshRun();
  function liveContext() {
    const p = game && game.player;
    if (!p || p.dead) return null;
    return { peak: Math.round(p.peak), kills: p.kills, eaten: p.eaten, time: Math.max(0, game.time - p.born), diff: game.settings.difficulty, specials: liveRun.specials, first: liveRun.first };
  }
  checkAchievements(); // past play counts, silently

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
    t.specials += liveRun.specials; // #14
    if (liveRun.first) t.firsts++;
    profile.recent.unshift(run);
    profile.recent.length = Math.min(profile.recent.length, 50);
    profile.top.push(run);
    profile.top.sort((a, b) => b.peak - a.peak);
    profile.top.length = Math.min(profile.top.length, 10);
    saveProfile();
    checkAchievements(null, { announce: true }); // e.g. Dedicated, earned as a game ends
    liveRun = freshRun();
    return isBest;
  }

  // ---------------------------------------------------------------------------
  // The player's habits (#135): how they escape a bot cutting them off, which hard bots learn
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
    } catch { /* storage full or unavailable: a failed write leaves the last good save in place (#185) */ }
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
    checkAchievements(); // silently, as on load (#14)
    Object.assign(habits, loadHabits()); // the other window saved what its bots learned
    loadSettings(); // the other window may have changed name, skin or world settings
    $('name').value = settings.name;
    $('botCount').value = settings.botCount;
    refreshMenu();
    const saved = loadWorld();
    if (!saved || !restoreWorld(saved)) { newGame(); showMenu(); }
    dropLockedSkin();
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
  // The arena floor (#163): big flat-top hexagons (FLOOR_S from centre to corner) with dark grooves
  // and a faint light edge, a soft shadow toward each edge, and a fine honeycomb texture (FLOOR_S / 8)
  // inside. One tile, drawn once, filled in world space so it moves and scales with the camera.
  const FLOOR_S = 80, FLOOR_W = 3 * FLOOR_S, FLOOR_H = 139; // FLOOR_H ~ sqrt(3) * FLOOR_S, whole pixels
  function makeHexPattern() {
    const S = FLOOR_S, W = FLOOR_W, H = FLOOR_H, K = 8;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#0e1424';
    g.fillRect(0, 0, W, H);
    const ry = H / 2 / 0.866; // vertical radius, stretched a hair so the tile repeats exactly
    const path = (cx, cy, s, k = 1) => {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3, x = cx + Math.cos(a) * s * k, y = cy + Math.sin(a) * ry * (s / S) * k;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    };
    // Every hexagon of size s whose centre lands on or near the tile (columns w apart, rows h apart).
    const grid = (s, w, h, fn) => {
      for (let i = -1; i <= W / w + 1; i++) for (let j = -1; j <= H / h + 1; j++) { fn(i * w, j * h); fn(i * w + 1.5 * s, j * h + h / 2); }
    };
    const s2 = S / K; // fine honeycomb; K divides both tile sides, so it tiles seamlessly
    g.strokeStyle = 'rgba(120,140,190,0.12)';
    g.lineWidth = 1;
    grid(s2, W / K, H / K, (x, y) => { path(x, y, s2, 0.92); g.stroke(); });
    grid(S, W, H, (x, y) => {
      const gr = g.createRadialGradient(x, y, S * 0.4, x, y, S);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.28)');
      path(x, y, S);
      g.fillStyle = gr;
      g.fill();
    });
    grid(S, W, H, (x, y) => {
      path(x, y, S);
      g.strokeStyle = '#070b15';
      g.lineWidth = 7;
      g.stroke();
      path(x, y, S, 0.955);
      g.strokeStyle = 'rgba(140,160,210,0.10)';
      g.lineWidth = 1.5;
      g.stroke();
    });
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

  // Special food (#143): its own look in every theme, drawn in code once per kind into a sprite
  // with a soft halo. look: what the test hook reports, so tests can tell the looks apart.
  const SPECIAL_INFO = {
    nova: { label: 'Nova crystal', icon: '💠', look: 'crystal', glow: '#4cf2ff', draw(g, s) {
      const P = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s))); g.closePath(); };
      const top = [0.5, 0.04], bot = [0.5, 0.96];
      P([top, [0.8, 0.3], [0.8, 0.7], bot, [0.2, 0.7], [0.2, 0.3]]);
      g.fillStyle = '#2fd8f0'; g.fill();
      P([top, [0.2, 0.3], [0.2, 0.7], bot, [0.4, 0.7], [0.4, 0.3]]);
      g.fillStyle = '#b4fcff'; g.fill();
      P([top, [0.8, 0.3], [0.8, 0.7], bot, [0.6, 0.7], [0.6, 0.3]]);
      g.fillStyle = '#128fb0'; g.fill();
      P([top, [0.8, 0.3], [0.8, 0.7], bot, [0.2, 0.7], [0.2, 0.3]]);
      g.lineWidth = s * 0.045; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(0.4 * s, 0.3 * s); g.lineTo(0.4 * s, 0.7 * s); g.moveTo(0.6 * s, 0.3 * s); g.lineTo(0.6 * s, 0.7 * s);
      g.lineWidth = s * 0.02; g.strokeStyle = 'rgba(26,16,36,0.6)'; g.stroke();
      shine(g, s * 0.31, s * 0.36, s * 0.05);
    } },
    nebula: { label: 'Nebula diamond', icon: '💎', look: 'diamond', glow: '#d66bff', draw(g, s) {
      const L = 0.08, R = 0.92, G = 0.4, T = 0.16, tl = 0.3, tr = 0.7, tip = [0.5, 0.92];
      const tri = (a, b, c, fill) => { g.beginPath(); g.moveTo(a[0] * s, a[1] * s); g.lineTo(b[0] * s, b[1] * s); g.lineTo(c[0] * s, c[1] * s); g.closePath(); g.fillStyle = fill; g.fill(); };
      // Pavilion: alternating facets down to the tip.
      const girdle = [[L, G], [0.29, G], [0.5, G], [0.71, G], [R, G]];
      const pav = ['#8a2fd6', '#e68cff', '#b54ff0', '#f1b3ff'];
      for (let i = 0; i < 4; i++) tri(girdle[i], girdle[i + 1], tip, pav[i]);
      // Crown: table and side facets.
      g.beginPath(); g.moveTo(tl * s, T * s); g.lineTo(tr * s, T * s); g.lineTo(0.71 * s, G * s); g.lineTo(0.29 * s, G * s); g.closePath();
      g.fillStyle = '#f6d2ff'; g.fill();
      tri([tl, T], [L, G], [0.29, G], '#c45cff');
      tri([tr, T], [R, G], [0.71, G], '#9b3be0');
      g.beginPath(); g.moveTo(tl * s, T * s); g.lineTo(tr * s, T * s); g.lineTo(R * s, G * s); g.lineTo(tip[0] * s, tip[1] * s); g.lineTo(L * s, G * s); g.closePath();
      g.lineWidth = s * 0.045; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(L * s, G * s); g.lineTo(R * s, G * s);
      for (const x of [0.29, 0.5, 0.71]) { g.moveTo(x * s, G * s); g.lineTo(tip[0] * s, tip[1] * s); }
      g.lineWidth = s * 0.02; g.strokeStyle = 'rgba(26,16,36,0.6)'; g.stroke();
      shine(g, s * 0.42, s * 0.25, s * 0.05);
    } },
    plasma: { label: 'Plasma sphere', icon: '🔮', look: 'orb', glow: '#7df9ff', draw(g, s) {
      const c = s * 0.5, r = s * 0.4;
      const grad = g.createRadialGradient(c - r * 0.25, c - r * 0.25, r * 0.05, c, c, r);
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, '#8ff7ff'); grad.addColorStop(0.75, '#2f63ff'); grad.addColorStop(1, '#1b1a6b');
      g.beginPath(); g.arc(c, c, r, 0, TAU); g.fillStyle = grad; g.fill();
      g.lineWidth = s * 0.045; g.strokeStyle = INK; g.stroke();
      // Electric core: forked bolts out from the middle.
      g.lineCap = 'round';
      for (const [w, col] of [[s * 0.07, 'rgba(184,248,255,0.55)'], [s * 0.028, '#ffffff']]) {
        g.beginPath();
        for (const a of [0.3, 2.3, 4.3]) {
          g.moveTo(c, c);
          g.lineTo(c + Math.cos(a + 0.4) * r * 0.35, c + Math.sin(a + 0.4) * r * 0.35);
          g.lineTo(c + Math.cos(a - 0.2) * r * 0.6, c + Math.sin(a - 0.2) * r * 0.6);
          g.lineTo(c + Math.cos(a + 0.25) * r * 0.86, c + Math.sin(a + 0.25) * r * 0.86);
        }
        g.lineWidth = w; g.strokeStyle = col; g.stroke();
      }
      g.beginPath(); g.arc(c, c, r * 0.14, 0, TAU); g.fillStyle = '#ffffff'; g.fill();
    } },
  };
  const specialSprites = new Map(); // kind -> canvas, made once
  function specialSprite(kind) {
    let c = specialSprites.get(kind);
    if (c) return c;
    const info = SPECIAL_INFO[kind];
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const halo = g.createRadialGradient(64, 64, 18, 64, 64, 64);
    halo.addColorStop(0, hexAlpha(info.glow, 0.6));
    halo.addColorStop(1, hexAlpha(info.glow, 0));
    g.fillStyle = halo;
    g.fillRect(0, 0, 128, 128);
    g.translate(16, 16);
    g.lineJoin = 'round';
    info.draw(g, 96);
    specialSprites.set(kind, c);
    return c;
  }
  // Fully shown until the last SPECIAL_BLINK seconds, then blinking at 5 Hz, fading out in the last half second.
  function specialAlpha(life, t) {
    if (life > CFG.SPECIAL_BLINK) return 1;
    return (Math.sin(t * TAU * 5) > 0 ? 1 : 0.3) * Math.min(1, life / 0.5);
  }
  const specialsDrawn = []; // looks drawn in the last frame, for the test hook

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
  // Skin finishes (#58): how a skin's body is painted. A finish gives each band of 3 segments its
  // colour and may draw markings over the body (and, for neon, a glow under it); ridges come on
  // top of the colour (#161). Every routine draws on the context it is given, so
  // the arena, the picker swatches and the menu preview share one drawing path. Patterns are
  // spaced in body lengths (segments sit 0.42 r apart) so they look the same at any size. t is
  // game time, so animated finishes freeze while paused.
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
  // Unit normal of the body at segment i (pointing to the worm's left).
  function normalAt(sx, sy, i) {
    const a = Math.max(0, i - 1), b = Math.min(sx.length - 1, i + 1);
    const dx = sx[a] - sx[b], dy = sy[a] - sy[b], d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d, -dy / d, dx / d]; // tangent toward the head, then normal
  }
  const hash01 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // color(skin, a, n, t): the colour of the band of 3 segments starting at segment a. marks: drawn
  // over the body. under: drawn under it. soft: lighter ridges, for dark-bodied finishes.
  const FINISH = {
    stripes: { color: (skin, a) => skin.colors[(a / 3) % skin.colors.length] },
    gradient: { color: (skin, a, n) => along(skin.colors, a / Math.max(1, n - 1)) },
    neon: {
      soft: true,
      color: (skin) => skin.colors[0],
      under(g, sx, sy, r, skin) {
        const n = sx.length, a0 = g.globalAlpha;
        g.strokeStyle = skin.colors[1];
        for (const [w, k] of [[2 * r + r * 1.4, 0.12], [2 * r + r * 0.75, 0.25]]) {
          g.globalAlpha = a0 * k;
          g.lineWidth = w;
          traceOn(g, sx, sy, n - 1, 0);
          g.stroke();
        }
        g.globalAlpha = a0;
      },
      marks(g, sx, sy, r, skin, t) {
        const [, glow, lights] = skin.colors, n = sx.length, a0 = g.globalAlpha;
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
    },
    metallic: {
      color(skin, a, n, t) { // the shine sweeps head to tail
        const p = (((t * 0.45) % 1.6) - 0.3) * n, i = a + 1.5;
        const k = Math.exp(-((i - p) ** 2) / 50) + 0.35 * Math.exp(-((i - p - 15) ** 2) / 27);
        return mix(skin.colors[0], skin.colors[1], Math.min(1, k));
      },
    },
    spots: {
      color: (skin) => skin.colors[0],
      marks(g, sx, sy, r, skin) {
        const [, spot, ring] = skin.colors, n = sx.length, step = every(2.8);
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
    },
    scales: {
      color: (skin) => skin.colors[0],
      marks(g, sx, sy, r, skin) {
        const [, mark, dark] = skin.colors, n = sx.length, L = r * 0.62, Wd = r * 0.5;
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
    },
    galaxy: {
      soft: true,
      color: (skin, a) => mix(skin.colors[0], skin.colors[1], 0.35 + 0.35 * Math.sin(a * 0.168 + 1)),
      marks(g, sx, sy, r, skin, t) {
        const star = skin.colors[2], n = sx.length, a0 = g.globalAlpha;
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
    },
    pulse: { color: (skin, a, n, t) => mix(skin.colors[0], skin.colors[1], Math.max(0, Math.sin(a * 0.19 - t * 5)) ** 2) },
  };

  // Reward finishes (#180): animated looks only rewards have. Bright marks and glows are drawn with
  // additive blending; every animation follows game time t, so it stops while paused.
  // Travelling effects (bolts, shooting stars, the Holo shine) stay within this many segments of the head,
  // so on a very long worm they still happen where the player is looking.
  const NEAR_HEAD = 120;
  const lighter = (g, fn) => { const op = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; try { fn(); } finally { g.globalCompositeOperation = op; } };
  // A jagged line across the body at segment i: from one side to the other, zigzagging.
  function crack(path, sx, sy, r, i, seed, along = 0.5) {
    const [tx, ty, nx, ny] = normalAt(sx, sy, i), steps = 5;
    for (let k = 0; k <= steps; k++) {
      const u = -0.75 + (1.5 * k) / steps, j = (hash01(seed * 13 + k) - 0.5) * r * along;
      const x = sx[i] + nx * u * r + tx * j, y = sy[i] + ny * u * r + ty * j;
      k ? path.lineTo(x, y) : path.moveTo(x, y);
    }
  }
  Object.assign(FINISH, {
    inferno: {
      color: (skin, a, n, t) => mix(skin.colors[0], skin.colors[1], 0.5 + 0.5 * Math.sin(a * 0.3 - t * 2)),
      marks(g, sx, sy, r, skin, t) {
        const n = sx.length, levels = [new Path2D(), new Path2D(), new Path2D()], [i0, i1] = stepRange(1, 2, n - 2);
        for (let i = i0; i <= i1; i += 2) { // stepRange with the same step, so cracks stay on fixed segments
          const b = 0.5 + 0.5 * Math.sin(i * 0.35 - t * 4);
          if (b < 0.35) continue;
          crack(levels[Math.min(2, Math.floor(b * 3))], sx, sy, r, i, i, 0.9);
        }
        // Two molten veins winding along the body.
        for (const side of [-1, 1]) {
          const vein = new Path2D();
          let started = false;
          for (let i = i0; i <= i1; i++) {
            const [, , nx, ny] = normalAt(sx, sy, i), off = side * r * (0.35 + 0.25 * Math.sin(i * 0.4 + side * 1.3 - t * 1.5));
            const x = sx[i] + nx * off, y = sy[i] + ny * off;
            started ? vein.lineTo(x, y) : (vein.moveTo(x, y), started = true);
          }
          levels[1].addPath(vein);
        }
        lighter(g, () => levels.forEach((p, lv) => {
          const a0 = g.globalAlpha;
          g.globalAlpha = a0 * (0.35 + 0.3 * lv); g.strokeStyle = '#ff6a00'; g.lineWidth = r * 0.24; g.stroke(p);
          g.strokeStyle = '#ffd36a'; g.lineWidth = r * 0.08; g.stroke(p);
          g.globalAlpha = a0;
        }));
      },
    },
    holo: {
      color: (skin, a, n, t) => `hsl(${(a * 9 + t * 90) % 360}, 85%, 64%)`,
      marks(g, sx, sy, r, skin, t) {
        const n = sx.length, p = ((t * 28) % (Math.min(n, NEAR_HEAD) + 30)) - 15, a0 = g.globalAlpha;
        const from = Math.max(0, Math.min(n - 1, Math.round(p + 3))), to = Math.max(0, Math.min(n - 1, Math.round(p - 3)));
        if (from > to) lighter(g, () => { g.globalAlpha = a0 * 0.45; g.strokeStyle = '#ffffff'; g.lineWidth = r * 1.3; traceOn(g, sx, sy, from, to); g.stroke(); g.globalAlpha = a0; });
        const stars = new Path2D(), [s0, s1] = stepRange(0, 4, n - 1);
        for (let i = s0; i <= s1; i += 4) {
          const tw = Math.sin(t * 5 + i), [, , nx, ny] = normalAt(sx, sy, i);
          if (tw < 0.4) continue;
          const off = (hash01(i) - 0.5) * 1.2 * r, x = sx[i] + nx * off, y = sy[i] + ny * off, q = r * 0.22 * tw;
          stars.moveTo(x - q, y); stars.lineTo(x + q, y); stars.moveTo(x, y - q); stars.lineTo(x, y + q);
        }
        lighter(g, () => { g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.07; g.stroke(stars); });
      },
    },
    storm: {
      color: (skin, a, n, t) => mix(skin.colors[0], skin.colors[1], 0.5 + 0.5 * Math.sin(a * 0.21 + t)),
      marks(g, sx, sy, r, skin, t) {
        const n = sx.length;
        if (n < 10) return;
        for (let k = 0; k < 4; k++) {
          const phase = t * 3.1 + k * 0.27, id = Math.floor(phase), local = phase - id;
          if (local > 0.55) continue;
          const start = 1 + Math.floor(hash01(id * 7 + k) * (Math.min(n - 9, NEAR_HEAD) - 0)), path = new Path2D();
          for (let i = start, m = 0; i < start + 7; i++, m++) {
            const [, , nx, ny] = normalAt(sx, sy, i), off = (hash01(id * 31 + m * 3 + k) - 0.5) * 1.3 * r;
            m ? path.lineTo(sx[i] + nx * off, sy[i] + ny * off) : path.moveTo(sx[i] + nx * off, sy[i] + ny * off);
          }
          const a0 = g.globalAlpha, f = 1 - local / 0.55;
          lighter(g, () => {
            g.globalAlpha = a0 * 0.6 * f; g.strokeStyle = '#46c8ff'; g.lineWidth = r * 0.3; g.stroke(path);
            g.globalAlpha = a0 * f; g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.09; g.stroke(path);
            g.globalAlpha = a0;
          });
        }
      },
    },
    crystal: {
      color: (skin, a) => mix(skin.colors[0], skin.colors[1], 0.15 + 0.7 * hash01(a * 1.3)),
      marks(g, sx, sy, r, skin, t) {
        const n = sx.length, a0 = g.globalAlpha, facets = new Path2D(), L = r * 0.62, Wd = r * 0.55, [c0, c1] = stepRange(3, 3, n - 2);
        for (let i = c0; i <= c1; i += 3) {
          const [tx, ty, nx, ny] = normalAt(sx, sy, i), x = sx[i], y = sy[i];
          facets.moveTo(x + tx * L, y + ty * L); facets.lineTo(x + nx * Wd, y + ny * Wd); facets.lineTo(x - tx * L, y - ty * L); facets.lineTo(x - nx * Wd, y - ny * Wd); facets.closePath();
        }
        g.globalAlpha = a0 * 0.5; g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.07; g.stroke(facets); g.globalAlpha = a0;
        const sparks = new Path2D(), [s0, s1] = stepRange(0, 2, n - 1);
        for (let i = s0; i <= s1; i += 2) {
          const tw = Math.sin(t * 4 + i * 1.7);
          if (tw < 0.75) continue;
          const [, , nx, ny] = normalAt(sx, sy, i), side = hash01(i + 5) < 0.5 ? -1 : 1, x = sx[i] + nx * side * r * 0.7, y = sy[i] + ny * side * r * 0.7, q = r * 0.35 * (tw - 0.75) * 4;
          sparks.moveTo(x - q, y); sparks.lineTo(x + q, y); sparks.moveTo(x, y - q); sparks.lineTo(x, y + q);
        }
        lighter(g, () => { g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.08; g.stroke(sparks); });
      },
    },
    ghost: {
      alpha: 0.38,
      color: (skin, a, n, t) => mix(skin.colors[0], skin.colors[1], 0.5 + 0.5 * Math.sin(a * 0.2 - t * 2)),
    },
    galaxyprime: {
      soft: true,
      color: (skin, a, n, t) => along(['#14062e', '#4b0f6e', '#0f2a6b', '#14062e'], (Math.sin(a * 0.06 + t * 0.4) + 1) / 2),
      marks(g, sx, sy, r, skin, t) {
        FINISH.galaxy.marks(g, sx, sy, r, skin, t);
        const n = sx.length, a0 = g.globalAlpha, [b0, b1] = stepRange(0, 5, n - 1);
        lighter(g, () => {
          for (let i = b0; i <= b1; i += 5) {
            const [, , nx, ny] = normalAt(sx, sy, i), off = Math.sin(t * 0.8 + i * 0.4) * 0.45 * r;
            g.globalAlpha = a0 * 0.16; g.fillStyle = i % 10 ? '#ff5fd2' : '#4fd8ff';
            g.beginPath(); g.arc(sx[i] + nx * off, sy[i] + ny * off, r * 0.7, 0, TAU); g.fill();
          }
          const phase = t / 2.5, id = Math.floor(phase), local = phase - id;
          if (local < 0.3 && n > 14) {
            const p = Math.floor(local / 0.3 * (Math.min(n, NEAR_HEAD + 12) - 12)), [, , nx, ny] = normalAt(sx, sy, p), off = (hash01(id) - 0.5) * r;
            g.globalAlpha = a0 * 0.9; g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.1;
            g.beginPath(); g.moveTo(sx[p] + nx * off, sy[p] + ny * off); g.lineTo(sx[p + 8] + nx * off, sy[p + 8] + ny * off); g.stroke();
          }
          g.globalAlpha = a0;
        });
      },
    },
  });

  // Ridges (#161): the body reads as a stack of thin round discs, one per segment, laid from the
  // tail to the head. Each disc hides most of the one behind it, so all that shows of a disc is
  // the back part of its edge: a curved ridge line. The body is stroked as a smooth tube (in runs
  // of 3 segments, each in its band's colour), then every ridge is added to one path and stroked
  // once, which costs about the same as the tube itself. Worms under a few pixels wide skip them.
  const RIDGE_MIN_PX = 6; // body width on screen, in pixels
  // Paints a body: the finish's glow under it, the tube, ridges and a soft highlight, then the
  // finish's markings. px: screen pixels per world unit.
  function paintBody(g, sx, sy, r, skin, t, px) {
    const f = FINISH[skin.finish], n = sx.length, last = n - 1, aOuter = g.globalAlpha;
    if (f.under) f.under(g, sx, sy, r, skin, t);
    // A see-through finish (Ghost, #180) draws the body, ridges and markings at its own alpha.
    const a0 = aOuter * (f.alpha || 1);
    g.globalAlpha = a0;
    g.lineWidth = 2 * r;
    for (let c = Math.ceil(last / 3) - 1; c >= 0; c--) {
      const a = c * 3, b = Math.min(last, a + 3);
      if (span && (b < span[0] || a > span[1])) continue;
      g.strokeStyle = f.color(skin, a, n, t);
      traceOn(g, sx, sy, b, a);
      g.stroke();
    }
    if (n === 1) { // a single segment: just its disc
      g.fillStyle = f.color(skin, 0, n, t);
      g.beginPath();
      g.arc(sx[0], sy[0], r, 0, TAU);
      g.fill();
    }
    if (2 * r * px >= RIDGE_MIN_PX && n > 1) {
      const k = f.soft ? 0.6 : 1, lo = Math.max(1, span ? span[0] : 1), hi = span ? span[1] : last;
      g.beginPath();
      for (let i = hi; i >= lo; i--) {
        // Disc i's edge is hidden where disc i - 1 (one segment nearer the head) covers it: within
        // acos(d / 2r) of straight ahead, d being the distance between them.
        const dx = sx[i - 1] - sx[i], dy = sy[i - 1] - sy[i], d = Math.hypot(dx, dy);
        if (d < 1e-6) continue;
        const ahead = Math.atan2(dy, dx), half = Math.acos(Math.min(1, d / (2 * r)));
        const from = ahead + half;
        g.moveTo(sx[i] + Math.cos(from) * r, sy[i] + Math.sin(from) * r);
        g.arc(sx[i], sy[i], r, from, ahead + TAU - half);
      }
      g.globalAlpha = a0 * k;
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      g.lineWidth = Math.max(1 / px, r * 0.08);
      g.stroke();
      // A faint light rim just inside each ridge, so each disc looks raised.
      g.beginPath();
      const ri = r * 0.88;
      for (let i = hi; i >= lo; i--) {
        const dx = sx[i - 1] - sx[i], dy = sy[i - 1] - sy[i], d = Math.hypot(dx, dy);
        if (d < 1e-6) continue;
        const ahead = Math.atan2(dy, dx), half = Math.acos(Math.max(-1, Math.min(1, (d * d + ri * ri - r * r) / (2 * d * ri))));
        if (half >= Math.PI) continue; // all of this rim is covered
        const from = ahead + half;
        g.moveTo(sx[i] + Math.cos(from) * ri, sy[i] + Math.sin(from) * ri);
        g.arc(sx[i], sy[i], ri, from, ahead + TAU - half);
      }
      g.strokeStyle = 'rgba(255,255,255,0.14)';
      g.stroke();
      // A soft highlight along the body, so it reads as a round tube.
      g.save();
      g.translate(-r * 0.18, -r * 0.26);
      g.globalAlpha = a0 * k * 0.2;
      g.strokeStyle = '#fff';
      g.lineWidth = r * 0.6;
      traceOn(g, sx, sy, last, 0);
      g.stroke();
      g.restore();
      g.globalAlpha = a0;
    }
    if (f.marks) f.marks(g, sx, sy, r, skin, t);
    g.globalAlpha = aOuter;
  }

  // ---------------------------------------------------------------------------
  // Game state
  let game = null;
  const cam = { x: 0, y: 0, z: 0.6 };
  let spectate = null;

  function newGame(snapshot) {
    game = snapshot ? new Game(null, snapshot, { habits }) : new Game({ botCount: settings.botCount, difficulty: settings.difficulty }, null, { habits });
    learningSeen.clear(); // learning cues belong to the old world's bots
    game.on('death', onDeath);
    game.on('powerup', onPowerup);
    game.on('special', onSpecial);
    game.on('eat', onEat); // #9
    spectate = game.leaderboard[0] || null;
    if (spectate) { cam.x = spectate.x; cam.y = spectate.y; }
  }

  function onDeath({ victim, killer, cause }) {
    // killer.isPlayer, not game.player: the player may have died in the same tick (#47).
    if (killer && killer.isPlayer) {
      feed(`You ate ${victim.name}! (+${Math.round(victim.mass * 0.8)})`, 'good');
      sound.play('kill');
    } else if (victim.isPlayer) {
      if (cause !== 'quit') sound.play('death');
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
    if (worm !== game.player) return;
    feed(`${POWERUP_INFO[type].icon} ${POWERUP_INFO[type].label}!`, 'info');
    sound.play('powerup');
  }

  function onSpecial({ worm, kind, value }) {
    if (worm !== game.player) return;
    feed(`${SPECIAL_INFO[kind].icon} ${SPECIAL_INFO[kind].label} +${value}`, 'good');
    sound.play('special');
    liveRun.specials++; // toward Stargazer (#14)
  }

  // Eating pop (#9), higher for small food: food radii run from 3 to 20 (foodRadius in engine.js).
  function onEat({ worm, r }) {
    if (worm === game.player) sound.play('eat', { size: Math.min(1, Math.max(0, (r - 3) / 17)) });
  }

  function startPlaying() {
    if (mode === 'playing') return; // a second trigger (key + click) must not spawn a second player (#184)
    liveRun = freshRun();
    dropLockedSkin(); // never start a run in a locked skin (#178)
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
    refreshMenu(); // rewards earned in the run show unlocked (#14)
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
    renderAchievements();
    $('topRuns').innerHTML = runsTable(profile.top, true);
    $('recentRuns').innerHTML = runsTable(profile.recent.slice(0, 15), false);
    $('menu').classList.add('hidden');
    $('statsScreen').classList.remove('hidden');
  }

  // Achievements on the stats screen (#14): each with its goal and progress, or when it was earned.
  function renderAchievements() {
    const c = { totals: profile.totals, top: profile.top, recent: profile.recent, live: null };
    const fmt = (a, v) => (a.time ? fmtDuration(Math.round(v)) : fmtNum(Math.floor(v)));
    $('achTitle').textContent = `🏆 Achievements ${ACHIEVEMENTS.filter((a) => profile.ach[a.id]).length} / ${ACHIEVEMENTS.length}`;
    $('achList').innerHTML = ACHIEVEMENTS.map((a) => {
      const [v, target] = a.progress(c), when = profile.ach[a.id];
      const reward = a.skin ? `<span class="reward">Unlocks ${escapeHtml(a.skin)}</span>` : '';
      const status = when
        ? `<span class="done">✓ Earned ${escapeHtml(new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))}</span>`
        : `<span class="bar"><i style="width:${Math.round(Math.min(1, v / target) * 100)}%"></i></span><span class="val">${fmt(a, Math.min(v, target))} / ${fmt(a, target)}</span>`;
      return `<div class="ach${when ? ' earned' : ''}" data-id="${a.id}"><div><b>${when ? '🏆 ' : ''}${escapeHtml(a.name)}</b><small>${escapeHtml(a.goal)}</small>${reward}</div><div class="prog">${status}</div></div>`;
    }).join('');
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
      checkAchievements(null, { merge: false }); // whatever its stats prove (#14)
      saveProfile();
      dropLockedSkin();
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
    paintBody(g, sx, sy, r, skin, skin.finish === 'pulse' ? 1.21 : 1.8, dpr);
    return c;
  }
  // Skin preview (#161): the selected skin on a worm wiggling across a strip under the Skin label,
  // drawn with the arena's code. Redrawn by the frame loop while the menu shows; with reduced
  // motion it holds one pose.
  const previewEl = $('skinPreview'), menuEl = $('menu');
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  let previewName = null, previewFrames = 0;
  function drawSkinPreview(now) {
    if (menuEl.classList.contains('hidden')) return;
    const w = previewEl.clientWidth, h = previewEl.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (previewEl.width !== cw || previewEl.height !== ch) { previewEl.width = cw; previewEl.height = ch; }
    const g = previewEl.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const still = reduceMotion.matches, t = still ? 1.8 : now / 1000, skin = SKINS[settings.skin];
    // A body about two thirds of the strip long, head to the right, on a wave travelling tailward.
    const r = h * 0.26, step = r * SEGMENT, n = Math.max(8, Math.min(90, Math.floor((w * 0.68) / step)));
    const amp = h * 0.13, k = TAU / (step * 22), phase = still ? 0 : t * 4;
    const x0 = (w + (n - 1) * step) / 2, sx = [], sy = [];
    for (let i = 0; i < n; i++) { const x = x0 - i * step; sx.push(x); sy.push(h / 2 + amp * Math.sin(k * x - phase)); }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; // the outline, as in the arena
    g.lineWidth = 2 * r + 4;
    traceOn(g, sx, sy, n - 1, 0);
    g.stroke();
    paintBody(g, sx, sy, r, skin, t, dpr);
    const angle = Math.atan2(sy[0] - sy[1], sx[0] - sx[1]);
    drawEyes(g, sx[0], sy[0], angle, angle + (still ? 0 : 0.5 * Math.sin(t * 1.3)), r);
    previewName = skin.name;
    previewFrames++;
  }
  // The free skins, then the rewards (#14): locked ones dimmed with a padlock; picking one shows
  // what unlocks it instead of choosing it.
  const skinsEl = $('skins');
  let skinHintTimer = 0;
  const unlockHint = (skin) => {
    const a = ACHIEVEMENTS.find((x) => x.id === skin.unlock);
    return `${a.goal} to unlock ${skin.name}`;
  };
  const pickerOrder = SKINS.map((skin, i) => [skin, i]).filter(([s]) => !s.hidden).concat(SKINS.map((skin, i) => [skin, i]).filter(([s]) => s.hidden && s.unlock));
  for (const [skin, i] of pickerOrder) {
    const b = document.createElement('button');
    b.dataset.skin = i;
    b.title = skin.name;
    b.appendChild(skinSwatch(skin));
    if (skin.unlock) {
      const lock = document.createElement('span');
      lock.className = 'lock';
      lock.setAttribute('aria-hidden', 'true');
      lock.textContent = '🔒';
      b.appendChild(lock);
    }
    b.addEventListener('click', () => {
      if (!isUnlocked(skin)) {
        $('skinName').textContent = unlockHint(skin);
        $('skinName').classList.add('hint');
        clearTimeout(skinHintTimer);
        skinHintTimer = setTimeout(refreshMenu, 3500);
        return;
      }
      settings.skin = i;
      refreshMenu();
    });
    skinsEl.appendChild(b);
  }
  $('botCount').value = settings.botCount;
  $('botCount').addEventListener('input', (e) => { settings.botCount = +e.target.value; refreshMenu(); });
  document.querySelectorAll('#difficulty button').forEach((b) =>
    b.addEventListener('click', () => { settings.difficulty = b.dataset.v; refreshMenu(); }));
  function refreshMenu() {
    [...skinsEl.children].forEach((b) => {
      const skin = SKINS[+b.dataset.skin], locked = !isUnlocked(skin);
      b.classList.toggle('on', !locked && +b.dataset.skin === settings.skin); // none for a remembered locked skin
      b.classList.toggle('locked', locked);
      b.setAttribute('aria-label', locked ? `${skin.name} (locked)` : skin.name);
    });
    clearTimeout(skinHintTimer);
    $('skinName').classList.remove('hint');
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
  $('openStats').addEventListener('click', () => { showStatsTab('statsPane'); showStats(); });
  // Stats and Achievements (#14) are two tabs, so each fits a laptop screen without scrolling.
  function showStatsTab(id) {
    document.querySelectorAll('#statsTabs button').forEach((b) => {
      const on = b.dataset.tab === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      $(b.dataset.tab).classList.toggle('hidden', !on);
    });
  }
  document.querySelectorAll('#statsTabs button').forEach((b) => b.addEventListener('click', () => showStatsTab(b.dataset.tab)));
  $('closeStats').addEventListener('click', showMenu);
  $('exportSave').addEventListener('click', exportSave);
  $('importSave').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importSave(f); });
  $('playHere').addEventListener('click', playHere);
  $('resetStats').addEventListener('click', () => {
    if (!confirm('Reset all stats and high scores? This cannot be undone (export a save first if you want a backup).') || !isActive()) return;
    profile = emptyProfile();
    saveProfile();
    dropLockedSkin(); // the rewards are locked again (#178)
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
      case 'KeyM': // #9; Ctrl/Cmd/Alt+M belong to the browser or system
        if (e.ctrlKey || e.metaKey || e.altKey) break;
        setAudio('sound', !settings.sound);
        if (mode === 'playing') feed(settings.sound ? '🔊 Sound on' : '🔇 Sound off', 'info');
        break;
      case 'Enter': // a focused button presses itself; running both started two runs (#184)
        if (e.target.closest && e.target.closest('button, a[href]')) break;
        if (mode === 'dead' && !$('death').classList.contains('hidden')) startPlaying();
        break;
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
  // Zooms out as the worm thickens (#163: divisor 35, was 55); the zoom power-up adds a further 0.62.
  const targetZoom = (p) => baseZoom() / (1 + (p.r - 14) / 35) * (p.pw.zoom > 0 ? 0.62 : 1);
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
  let foodDrawn = 0; // pieces of food drawn in the last frame (#163)
  let headRepaints = 0; // heads repainted over another body in the last frame (#102, #161)
  function drawBoostArrows(w, t, alpha) {
    const r = w.r, a = w.angle, arm = r * 1.05, spread = Math.PI / 4;
    const hx = w.sx[0], hy = w.sy[0];
    for (let k = 0; k < 2; k++) {
      const d = r * (2.6 + 1.1 * k); // a little ahead of the eyes (#161)
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
  // Learning cue (#138): a small brain beside the head of a Hard bot while the game watches how
  // the player escapes its cut-off (#135), pulsing, then fading out. Drawing only: kept by page time.
  const LEARN_FADE = 0.5; // seconds the brain takes to fade once the watching ends
  const learningSeen = new Map(); // bot -> page time it was last seen being watched
  const learningAlpha = new Map(); // bot id -> alpha drawn in the last frame, for the tests
  function drawLearningCues(t, z, view) {
    learningAlpha.clear();
    const e = game.encounter;
    if (e && !e.bot.dead && knowsTactic(e.bot, game.settings.difficulty, 'learn')) learningSeen.set(e.bot, t);
    if (!learningSeen.size) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [w, at] of learningSeen) {
      const age = t - at;
      if (w.dead || age > LEARN_FADE) { learningSeen.delete(w); continue; }
      const x = w.sx[0], y = w.sy[0];
      if (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1) continue;
      const watching = e && e.bot === w;
      const alpha = watching ? 0.875 + 0.125 * Math.sin(t * TAU * 3) : Math.max(0, 1 - age / LEARN_FADE); // pulse 0.75-1
      const size = Math.max(22 / z, w.r * 1.1);
      ctx.globalAlpha = alpha;
      ctx.font = `${size}px system-ui, sans-serif`;
      ctx.fillText('\u{1F9E0}', x + w.r + size * 0.6, y - w.r * 0.6); // just right of the head, upright
      learningAlpha.set(w.id, alpha);
    }
    ctx.globalAlpha = 1;
  }

  // Read-only hook for the browser tests; nothing in the game uses it.
  window.wigglefeastDebug = {
    boostArrows: () => boostArrowsDrawn,
    headRepaints: () => headRepaints, // #161
    previewSkin: () => previewName, // #161
    achievements: () => ({ ...profile.ach }), // #14
    profile: () => JSON.parse(JSON.stringify(profile)),
    toasts: () => toastsShown.slice(),
    sounds: () => sound.log().map((e) => e.name), // #9
    audioState: () => sound.state(),
    foodSizes: (r, themed) => foodSizes(r, 1, themed), // #163
    floorTile: () => ({ w: FLOOR_W, h: FLOOR_H, s: FLOOR_S }), // #163
    foodDrawn: () => foodDrawn,
    previewFrames: () => previewFrames,
    learningCues: () => learningAlpha.size, // #138
    learningCue: (id) => learningAlpha.get(id) || 0,
    theme: () => activeTheme, // #64
    itemSprites: () => itemSprites.size,
    foodItem: (f) => (activeTheme === 'classic' ? 'dot' : FOOD_THEMES[activeTheme][itemIndex(f)].name),
    specialSprites: () => specialSprites.size, // #143
    specialLook: (kind) => SPECIAL_INFO[kind].look,
    specialsDrawn: () => specialsDrawn.slice(),
  };

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
  // Eyes (#161): two big round eyes near the front of the head, close together and facing the way
  // the worm moves; the pupils look where it steers (targetAngle), with a small white glint.
  function drawEyes(g, hx, hy, angle, look, r) {
    const ex = Math.cos(angle), ey = Math.sin(angle);
    const lx = Math.cos(look) * r * 0.17, ly = Math.sin(look) * r * 0.17;
    for (let side = -1; side <= 1; side += 2) {
      const cx = hx + ex * r * 0.34 - ey * side * r * 0.4, cy = hy + ey * r * 0.34 + ex * side * r * 0.4;
      g.beginPath();
      g.arc(cx, cy, r * 0.44, 0, TAU);
      g.fillStyle = '#fff';
      g.fill();
      g.lineWidth = Math.max(1, r * 0.07);
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.stroke();
      g.beginPath();
      g.arc(cx + lx, cy + ly, r * 0.25, 0, TAU);
      g.fillStyle = '#141414';
      g.fill();
      g.beginPath();
      g.arc(cx + lx - r * 0.08, cy + ly - r * 0.09, r * 0.08, 0, TAU);
      g.fillStyle = '#fff';
      g.fill();
    }
  }

  function drawWorm(w, t, view, part = 'all') {
    const m = w.boosting ? w.r * 4.2 : 0; // boost arrows reach ahead of the head
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

    // The head pass repaints the head (clipped to a disc around it) only when another worm's body
    // actually touches it; otherwise the worm is drawn in one piece, exactly as before, with no seam.
    // While shielded nothing can hurt the player, so it never repaints (that would show through the
    // shield's transparency) and draws just the eyes and arrows (#102).
    const repaint = part !== 'head' || (w.shield <= 0 && headCovered(w));
    if (repaint) {
      if (part === 'head') {
        headRepaints++;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx[0], sy[0], r + 3, 0, TAU);
        ctx.clip();
      }

      // Outline: it gives a solid body its edge. A see-through finish (Ghost, #187) has none, since
      // it would show through the body as a dark tint; its glow marks the edge instead.
      if (!FINISH[skin.finish].alpha) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2 * r + 4;
        traceOn(ctx, sx, sy, n - 1, 0);
        ctx.stroke();
      }

      // Body in the skin's finish, with ridges (#58, #161)
      paintBody(ctx, sx, sy, r, skin, game.time, cam.z * DPR);
      if (part === 'head') ctx.restore();
    }

    if (part === 'body') { ctx.globalAlpha = 1; return; } // eyes and arrows come with the head pass

    drawEyes(ctx, sx[0], sy[0], w.angle, w.targetAngle, r);
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

  // Drawn food sizes, in world units across (#163: about a third larger than before, drawing only).
  // Classic draws just the glowing dot; a themed arena draws an item on a softer glow.
  function foodSizes(r, pulse, themed) {
    return { glow: r * 6.5 * pulse, item: themed ? r * 5.4 * pulse : 0 };
  }

  function render(t) {
    const z = cam.z;
    boostArrowsDrawn = 0;
    headRepaints = 0;
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
    foodDrawn = 0;
    for (const f of game.food) {
      // Culled by its drawn size, so a big piece's glow doesn't pop in at the screen edge (#163).
      const m = f.r * 3.7 - 40; // glow radius at the peak of its pulse, beyond the view's own margin
      if (f.x < view.x0 - m || f.x > view.x1 + m || f.y < view.y0 - m || f.y > view.y1 + m) continue;
      foodDrawn++;
      const pulse = 1 + 0.12 * Math.sin(t * 3 + f.ph), a = f.life < 3 ? Math.max(0, f.life / 3) : 1;
      const { glow: G, item: D } = foodSizes(f.r, pulse, themed);
      if (!themed) {
        ctx.globalAlpha = a;
        ctx.drawImage(foodSprite(f.c), f.x - G / 2, f.y - G / 2, G, G);
      } else {
        ctx.globalAlpha = a * 0.55;
        ctx.drawImage(foodSprite(f.c), f.x - G / 2, f.y - G / 2, G, G);
        ctx.globalAlpha = a;
        ctx.drawImage(itemSprite(activeTheme, itemIndex(f)), f.x - D / 2, f.y - D / 2, D, D);
      }
    }
    ctx.globalAlpha = 1;

    // Special food (#143): the same in every theme, with a twinkling sparkle; blinks before it vanishes.
    specialsDrawn.length = 0;
    for (const p of game.specials) {
      if (p.dead || p.x < view.x0 - 70 || p.x > view.x1 + 70 || p.y < view.y0 - 70 || p.y > view.y1 + 70) continue;
      const D = 130 * (1 + 0.08 * Math.sin(t * 3 + p.ph));
      ctx.globalAlpha = specialAlpha(p.life, t);
      ctx.drawImage(specialSprite(p.kind), p.x - D / 2, p.y - D / 2, D, D);
      const tw = 0.5 + 0.5 * Math.sin(t * 5 + p.ph * 3), S = D * 0.13 * tw, a = t * 1.5 + p.ph;
      if (S > 1) {
        const sx = p.x + D * 0.24, sy = p.y - D * 0.24;
        ctx.beginPath();
        for (const k of [0, 1]) {
          const c = Math.cos(a + k * Math.PI / 2) * S, s = Math.sin(a + k * Math.PI / 2) * S;
          ctx.moveTo(sx - c, sy - s);
          ctx.lineTo(sx + c, sy + s);
        }
        ctx.lineWidth = D * 0.025;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      specialsDrawn.push(SPECIAL_INFO[p.kind].look);
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
    drawLearningCues(t, z, view);
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

  // Achievement pop-up (#14): one at a time, 3 s each, with the fanfare.
  const toastQueue = [];
  let toastBusy = false;
  function announceAchievement(a) {
    toastQueue.push(a);
    if (!toastBusy) nextToast();
  }
  function nextToast() {
    const a = toastQueue.shift(), el = $('achToast');
    if (!a) { toastBusy = false; el.classList.add('hidden'); return; }
    toastBusy = true;
    $('achToastName').textContent = a.name;
    $('achToastSkin').textContent = a.skin ? `${a.skin} unlocked!` : a.goal;
    el.classList.remove('hidden');
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    sound.play('achievement');
    toastsShown.push(a.id);
    setTimeout(nextToast, 3000);
  }
  const toastsShown = []; // for the test hook

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
  // The boost whoosh follows the player's boost, the music plays during a run, and everything goes
  // quiet while paused, standing by for another window (#45), or hidden (#9).
  function syncAudio() {
    const p = game && game.player, playing = mode === 'playing' && p && !p.dead;
    sound.boost(playing && p.boosting);
    sound.music(playing);
    sound.quiet(mode === 'paused' || mode === 'standby' || document.hidden);
  }
  document.addEventListener('visibilitychange', syncAudio); // frames stop while hidden

  let achTimer = 0; // seconds since the last in-run achievement check (#14)
  function frame(now) {
    requestAnimationFrame(frame); // first, so one exception can't leave a dead canvas (#185)
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); // `last` can be ahead of `now` after a resume
    last = now;
    if (mode !== 'paused' && mode !== 'standby') {
      applyInput(dt);
      const steps = Math.max(1, Math.ceil(dt / (1 / 60) - 0.01));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) game.update(h);
      updateCamera(dt);
    }
    render(now / 1000);
    drawSkinPreview(now);
    syncAudio();
    if (mode === 'playing' && game.player && !game.player.dead && (achTimer += dt) >= 0.5) {
      achTimer = 0;
      if (game.leaderboard[0] === game.player) liveRun.first = true;
      checkAchievements(liveContext(), { announce: true });
    }
    if (mode !== 'menu' && mode !== 'standby') renderMinimap();
    updateHud(dt);
    syncUpdateBanner();
    syncTouchControls();
    syncBoostBadge();
    syncBadges();
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
  dropLockedSkin(); // a remembered or resumed locked skin (#178)
  requestAnimationFrame(frame);
})();
