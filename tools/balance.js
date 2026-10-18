#!/usr/bin/env node
// Headless difficulty-balance report (#16): runs worlds on each difficulty with a scripted
// stand-in player and prints how long it survives, what kills it, and how big bots get.
// Usage: node tools/balance.js [--minutes 8] [--runs 3] [--bots 30] [--diff easy,normal,hard]
//                              [--profile novice,careful,skilled] [--set SHED_RATE=0.01,easy.bigShare=0.1]
// --set tries values without editing engine.js: CFG keys by name, DIFFICULTY keys as
// <difficulty>.<key> (ranges as lo:hi, e.g. hard.skill=0.6:1).
// The stand-in uses the bot brain at a fixed skill, so numbers compare settings with each
// other; they are not a prediction of how long a person lasts. Playtesting decides.
// Not part of the game: the release check ignores tools/.
require('../engine.js');
const { Game, botThink, CFG, DIFFICULTY } = globalThis.WormEngine;

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const MINUTES = Number(args.minutes || 8);
const RUNS = Number(args.runs || 3);
const BOTS = Number(args.bots || 30);
const DIFFS = (args.diff || 'easy,normal,hard').split(',');
for (const kv of (args.set || '').split(',').filter(Boolean)) {
  const [key, val] = kv.split('=');
  const num = val.includes(':') ? val.split(':').map(Number) : Number(val);
  const [a, b] = key.split('.');
  if (b) DIFFICULTY[a][b] = num;
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

function run(diff, profileName) {
  const prof = PROFILES[profileName];
  const g = new Game({ botCount: BOTS, difficulty: diff });
  const initial = g.worms.map((w) => w.mass);
  const ai = { skill: prof.skill, aggro: prof.aggro, interval: 0.32 - 0.22 * prof.skill, wx: 0, wy: 0, prey: null, huntUntil: 0 };
  let thinkT = 0, bornAt = 0, respawnAt = 0;
  const lives = []; // { secs, peak, by: 'wall' | 'hunter' | 'body' | 'headon', killerMass }
  const botDeaths = { wall: 0, hunted: 0, other: 0 };
  g.on('death', (e) => {
    const k = e.killer;
    const hunted = !!(k && k.ai && k.ai.prey === e.victim);
    if (e.victim.isPlayer) {
      lives.push({ secs: g.time - bornAt, peak: e.victim.peak, by: !k ? 'wall' : hunted ? 'hunter' : 'body', killerMass: k ? k.mass : 0 });
      respawnAt = g.time + 2;
    } else botDeaths[!k ? 'wall' : hunted ? 'hunted' : 'other']++;
  });
  g.spawnPlayer('Proxy', 0);
  const samples = []; // every 5 s: top bot mass, its share of all worm mass, bots above 1000
  let leader = null, leaderSince = 0, longestLead = 0, hunters = 0, hunterSamples = 0;
  const ticks = MINUTES * 60 * 60;
  for (let i = 0; i < ticks; i++) {
    const p = g.player;
    if (p) {
      thinkT -= DT;
      if (thinkT <= 0) {
        p.ai = ai;
        botThink(p, g);
        p.ai = null;
        if (!prof.boost) p.wantBoost = false;
        thinkT = ai.interval;
      }
    } else if (g.time >= respawnAt) {
      g.spawnPlayer('Proxy', 0);
      bornAt = g.time;
      ai.prey = null;
    }
    g.update(DT);
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
  return { initial, lives, botDeaths, samples, longestLead, hunting: hunters / Math.max(1, hunterSamples) };
}

const f0 = (v) => (Number.isFinite(v) ? Math.round(v).toString() : '-');
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');

console.log(`${BOTS} bots, ${MINUTES} min x ${RUNS} runs per row${args.set ? ', ' + args.set : ''}\n`);
for (const diff of DIFFS) {
  for (const pn of PROFILE_NAMES) {
    const all = { initial: [], lives: [], wall: 0, hunted: 0, other: 0, top: [], share: [], big: [], lead: [], hunting: [] };
    for (let r = 0; r < RUNS; r++) {
      const o = run(diff, pn);
      all.initial.push(...o.initial);
      all.lives.push(...o.lives);
      for (const k of ['wall', 'hunted', 'other']) all[k] += o.botDeaths[k];
      for (const s of o.samples) { all.top.push(s.top); all.share.push(s.share); all.big.push(s.big); }
      all.lead.push(o.longestLead);
      all.hunting.push(o.hunting);
    }
    const dead = all.lives.filter((l) => l.by !== 'alive');
    const secs = all.lives.map((l) => l.secs);
    const by = (k) => dead.filter((l) => l.by === k).length;
    const bigKill = dead.filter((l) => l.killerMass > 500).length;
    const botTotal = all.wall + all.hunted + all.other;
    console.log(`== ${diff} / ${pn}`);
    console.log(`  start bots: median ${f0(pct(all.initial, 0.5))}, ${f0((100 * all.initial.filter((m) => m > 500).length) / all.initial.length)}% > 500, ${f0((100 * all.initial.filter((m) => m > 1500).length) / all.initial.length)}% > 1500`);
    console.log(`  player lives: ${all.lives.length} (${dead.length} deaths), survival median ${f0(pct(secs, 0.5))}s, p25 ${f0(pct(secs, 0.25))}s, p75 ${f0(pct(secs, 0.75))}s, peak median ${f0(pct(all.lives.map((l) => l.peak), 0.5))}`);
    console.log(`  player killed by: hunter ${by('hunter')}, body ${by('body')}, wall ${by('wall')}; killer > 500 mass ${bigKill}; bots hunting it at a time ${f2(mean(all.hunting))}`);
    console.log(`  bot deaths/min: ${f2(botTotal / (RUNS * MINUTES))} (hunted ${f0((100 * all.hunted) / botTotal)}%, wall ${f0((100 * all.wall) / botTotal)}%)`);
    console.log(`  top bot: median ${f0(pct(all.top, 0.5))}, max ${f0(Math.max(...all.top))}, share of all mass median ${f2(pct(all.share, 0.5))}, bots > 1000 avg ${f2(mean(all.big))}, longest #1 streak ${f0(Math.max(...all.lead))}s`);
  }
}
