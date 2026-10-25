#!/usr/bin/env node
// Headless difficulty-balance report (#16): runs worlds on each difficulty with a scripted
// stand-in player and prints how long it survives, what kills it (by the killer's tactic,
// #78), how big bots get and how long a tick takes.
// Usage: node tools/balance.js [--minutes 8] [--runs 3] [--bots 30] [--diff easy,normal,hard]
//                              [--profile novice,careful,skilled] [--set SHED_RATE=0.01,easy.bigShare=0.1]
//                              [--seed 12345]
// --seed replays runs exactly (#100): run r of every row uses seed + r. Without it a random
// seed is picked and printed, so any report can be rerun. Only ms/tick differs between replays.
// --set tries values without editing engine.js: CFG keys by name, DIFFICULTY keys as
// <difficulty>.<key> (ranges as lo:hi, e.g. hard.skill=0.6:1), tactic shares as
// <difficulty>.tactics.<tactic> (e.g. hard.tactics.coil=0).
// The stand-in uses the bot brain at a fixed skill and without tactics, so numbers compare
// settings with each other; they are not a prediction of how long a person lasts.
// Playtesting decides.
// Not part of the game: the release check ignores tools/.
require('../engine.js');
const { Game, botThink, CFG, DIFFICULTY, DIFFICULTIES, difficultyOf } = globalThis.WormEngine;

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const MINUTES = Number(args.minutes || 8);
const RUNS = Number(args.runs || 3);
const BOTS = Number(args.bots || 30);
// 'expert' still names Hard (#177); an unknown name stops with a clear message.
const DIFFS = args.diff ? args.diff.split(',').map((d) => difficultyOf(d) || (() => { throw new Error(`unknown --diff level: ${d}`); })()) : DIFFICULTIES;
const SEED = args.seed !== undefined ? Number(args.seed) >>> 0 : Math.floor(Math.random() * 4294967296);
for (const kv of (args.set || '').split(',').filter(Boolean)) {
  const [key, val] = kv.split('=');
  const num = val.includes(':') ? val.split(':').map(Number) : Number(val);
  const [a, b, c] = key.split('.');
  if (c) DIFFICULTY[a][b][c] = num;
  else if (b) DIFFICULTY[a][b] = num;
  else CFG[a] = num;
}
const PROFILES = {
  // Sees little, reacts slowly, never hunts or boosts.
  novice: { skill: 0.25, aggro: 0, boost: false },
  // Sees far and reacts fast, but only eats: closest to a cautious person.
  careful: { skill: 1, aggro: 0, boost: false },
  // Sees far, reacts fast, hunts now and then, boosts for food.
  skilled: { skill: 1, aggro: 0.5, boost: true },
};
const PROFILE_NAMES = (args.profile || 'novice,careful,skilled').split(',');
const DT = 1 / 60;

const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);

// What killed a worm: the wall, the stand-in player, the killer's tactic (cut, pin, flank,
// trap, learn, coil, headOn) when it was after this victim, escape when a circled bot killed it,
// shadow when a shadowing bot killed it (#150), or 'body' when it just was in the way.
function cause(e) {
  const k = e.killer;
  if (!k) return 'wall';
  if (!k.ai) return 'player';
  if (k.ai.mode === 'headOn') return 'headOn';
  if (k.ai.mode === 'escape') return 'escape'; // a circled bot's way out (#94)
  if (k.ai.mode === 'shadow' || k.ai.fromShadow) return 'shadow'; // shadowing a bigger worm, or cutting in from it (#150)
  if (k.ai.prey !== e.victim) return 'body';
  return ['cut', 'pin', 'flank', 'trap', 'learn', 'coil'].includes(k.ai.mode) ? k.ai.mode : 'hunt'; // hunting it, doing something else this moment
}
const tally = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';

function run(diff, profileName, seed) {
  const prof = PROFILES[profileName];
  const g = new Game({ botCount: BOTS, difficulty: diff }, null, { seed });
  const initial = g.worms.map((w) => w.mass);
  const ai = { skill: prof.skill, aggro: prof.aggro, interval: 0.32 - 0.22 * prof.skill, wx: 0, wy: 0, prey: null, huntUntil: 0 };
  let thinkT = 0, bornAt = 0, respawnAt = 0;
  const lives = []; // { secs, peak, by: cause(), killerMass }
  const botDeaths = {}; // cause() -> count
  let shadowDeaths = 0; // bots that died while shadowing or cutting in from a shadow (#150)
  g.on('death', (e) => {
    const k = e.killer, by = cause(e);
    if (e.victim.isPlayer) {
      lives.push({ secs: g.time - bornAt, peak: e.victim.peak, by, killerMass: k ? k.mass : 0 });
      respawnAt = g.time + 2;
    } else {
      botDeaths[by] = (botDeaths[by] || 0) + 1;
      if (e.victim.ai && (e.victim.ai.mode === 'shadow' || e.victim.ai.fromShadow)) shadowDeaths++;
    }
  });
  g.spawnPlayer('Proxy', 0);
  const samples = []; // every 5 s: top bot mass, its share of all worm mass, bots above 1000
  let leader = null, leaderSince = 0, longestLead = 0, hunters = 0, hunterSamples = 0;
  const ticks = MINUTES * 60 * 60;
  let tickNs = 0n, watched = 0, lastEnc = null;
  for (let i = 0; i < ticks; i++) {
    const p = g.player;
    if (p) {
      thinkT -= DT;
      if (thinkT <= 0) {
        // Think as a bot without tactics: a person doesn't get the bots' tactics on harder levels.
        const level = g.settings.difficulty;
        p.ai = ai;
        g.settings.difficulty = 'easy';
        botThink(p, g);
        g.settings.difficulty = level;
        p.ai = null;
        if (!prof.boost) p.wantBoost = false;
        thinkT = ai.interval;
      }
    } else if (g.time >= respawnAt) {
      g.spawnPlayer('Proxy', 0);
      bornAt = g.time;
      ai.prey = null;
    }
    const t0 = process.hrtime.bigint();
    g.update(DT);
    tickNs += process.hrtime.bigint() - t0;
    if (g.encounter && g.encounter !== lastEnc) watched++; // cut-offs on the stand-in that started (#135), recorded or not
    lastEnc = g.encounter;
    if (i % 60 === 59 && g.player) {
      hunterSamples++;
      for (const w of g.worms) if (w.ai && w.ai.prey === g.player) hunters++;
    }
    if (i % 300 === 299) {
      const bots = g.worms.filter((w) => w.ai);
      const total = g.worms.reduce((a, w) => a + w.mass, 0);
      const top = bots.reduce((a, w) => (w.mass > a.mass ? w : a), bots[0]);
      samples.push({ top: top.mass, share: top.mass / total, big: bots.filter((w) => w.mass > 1000).length });
      if (top !== leader) { leader = top; leaderSince = g.time; }
      longestLead = Math.max(longestLead, g.time - leaderSince);
    }
  }
  if (g.player) lives.push({ secs: g.time - bornAt, peak: g.player.peak, by: 'alive', killerMass: 0 });
  return { initial, lives, botDeaths, samples, longestLead, hunting: hunters / Math.max(1, hunterSamples), msPerTick: Number(tickNs) / 1e6 / ticks, habits: g.habits, watched, shadowDeaths };
}

const f0 = (v) => (Number.isFinite(v) ? Math.round(v).toString() : '-');
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');

console.log(`${BOTS} bots, ${MINUTES} min x ${RUNS} runs per row, seed ${SEED}${args.set ? ', ' + args.set : ''}\n`);
for (const diff of DIFFS) {
  for (const pn of PROFILE_NAMES) {
    const all = { initial: [], lives: [], botDeaths: {}, top: [], share: [], big: [], lead: [], hunting: [], ms: [], habits: {}, watched: 0, shadowDeaths: 0 };
    for (let r = 0; r < RUNS; r++) {
      const o = run(diff, pn, (SEED + r) >>> 0);
      all.initial.push(...o.initial);
      all.lives.push(...o.lives);
      for (const [k, n] of Object.entries(o.botDeaths)) all.botDeaths[k] = (all.botDeaths[k] || 0) + n;
      all.ms.push(o.msPerTick);
      for (const s of o.samples) { all.top.push(s.top); all.share.push(s.share); all.big.push(s.big); }
      all.lead.push(o.longestLead);
      all.hunting.push(o.hunting);
      for (const k of ['away', 'toward', 'straight', 'boost', 'still']) all.habits[k] = (all.habits[k] || 0) + o.habits[k];
      all.watched += o.watched;
      all.shadowDeaths += o.shadowDeaths;
    }
    const dead = all.lives.filter((l) => l.by !== 'alive');
    const secs = all.lives.map((l) => l.secs);
    const playerBy = {};
    for (const l of dead) playerBy[l.by] = (playerBy[l.by] || 0) + 1;
    const tactic = (counts) => Object.entries(counts).filter(([k]) => !['wall', 'body', 'player'].includes(k)).reduce((a, [, n]) => a + n, 0);
    const bigKill = dead.filter((l) => l.killerMass > 500).length;
    const botTotal = Object.values(all.botDeaths).reduce((a, n) => a + n, 0);
    console.log(`== ${diff} / ${pn}`);
    console.log(`  start bots: median ${f0(pct(all.initial, 0.5))}, ${f0((100 * all.initial.filter((m) => m > 500).length) / all.initial.length)}% > 500, ${f0((100 * all.initial.filter((m) => m > 1500).length) / all.initial.length)}% > 1500`);
    const aliveMin = secs.reduce((a, t) => a + t, 0) / 60;
    console.log(`  player lives: ${all.lives.length} (${dead.length} deaths, ${f2(dead.length / aliveMin)} per minute alive), survival median ${f0(pct(secs, 0.5))}s, p25 ${f0(pct(secs, 0.25))}s, p75 ${f0(pct(secs, 0.75))}s, peak median ${f0(pct(all.lives.map((l) => l.peak), 0.5))}`);
    console.log(`  player killed by: ${tally(playerBy)} (tactics ${f0((100 * tactic(playerBy)) / Math.max(1, dead.length))}%); killer > 500 mass ${bigKill}; bots hunting it at a time ${f2(mean(all.hunting))}`);
    console.log(`  bot deaths/min: ${f2(botTotal / (RUNS * MINUTES))} (tactics ${f0((100 * tactic(all.botDeaths)) / Math.max(1, botTotal))}%: ${tally(all.botDeaths)}); ${all.shadowDeaths} died while shadowing`);
    // The stand-in's record at the end of each run (#135), summed: its habit, as bots learned it.
    const H = all.habits, sides = H.away + H.toward + H.straight, share = (v, n) => f0((100 * v) / Math.max(1e-9, n));
    console.log(`  stand-in habits: ${all.watched} cut-offs started; end record away ${share(H.away, sides)}%, toward ${share(H.toward, sides)}%, straight ${share(H.straight, sides)}%, boost ${share(H.boost, H.boost + H.still)}%`);
    console.log(`  top bot: median ${f0(pct(all.top, 0.5))}, max ${f0(Math.max(...all.top))}, share of all mass median ${f2(pct(all.share, 0.5))}, bots > 1000 avg ${f2(mean(all.big))}, longest #1 streak ${f0(Math.max(...all.lead))}s; ${f2(mean(all.ms))} ms/tick`);
  }
}
