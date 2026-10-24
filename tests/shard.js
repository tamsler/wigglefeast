#!/usr/bin/env node
// Runs one CI shard of the test files (#112): node tests/shard.js 2/5 [extra node --test flags]
// Files are spread over the shards by their usual duration, longest first onto the least
// loaded shard. A file missing from SECONDS counts as 3 s, so a new test file always runs.
// Not a test file itself (no .test.js), so `node --test "tests/**/*.test.js"` skips it.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
// Seconds per file on CI (mean of 4 runs with Chrome warmed up, #134; the engine test files split
// in #153 are estimated from local runs x 1.3). Only the balance depends on these, never which
// files run. Remeasure when a file's tests change a lot.
const SECONDS = {
  'tests/simulation.test.js': 22,
  'tests/engine.test.js': 10,
  'tests/habits.test.js': 9,
  'tests/bots.test.js': 5,
  'tests/coil.test.js': 3,
  'tests/browser/layout.test.js': 37,
  'tests/browser/tabs.test.js': 29,
  'tests/browser/bots.test.js': 13,
  'tests/browser/massive.test.js': 10,
  'tests/browser/updates.test.js': 8,
  'tests/browser/boost.test.js': 5,
  'tests/browser/habits.test.js': 5,
  'tests/browser/import.test.js': 5,
  'tests/browser/themes.test.js': 5,
  'tests/browser/learning-cue.test.js': 5,
  'tests/browser/specials.test.js': 5,
  'tests/browser/difficulty.test.js': 3,
  'tests/browser/decorations.test.js': 3,
  'tests/browser/input.test.js': 3,
  'tests/browser/keyboard.test.js': 3,
  'tests/browser/draw-order.test.js': 3,
  'tests/browser/powerups.test.js': 3,
  'tests/browser/skins.test.js': 3,
  'tests/browser/touch.test.js': 3,
  'tests/browser/minimap.test.js': 2,
  'tests/browser/tags.test.js': 2,
  'tests/browser/magnet.test.js': 2,
  'tests/browser/brand.test.js': 1,
  'tests/ci.test.js': 0.5,
  'tests/release.test.js': 0.5,
  'tests/shard.test.js': 0.5,
  'tests/helpers.test.js': 0.5,
};
const DEFAULT_SECONDS = 3; // a new file not measured yet

function testFiles(dir = path.join(ROOT, 'tests')) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...testFiles(p));
    else if (e.name.endsWith('.test.js')) out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out.sort();
}

// The files of each of n shards.
function shards(n, files = testFiles()) {
  const cost = (f) => SECONDS[f] || DEFAULT_SECONDS;
  const load = new Array(n).fill(0), out = Array.from({ length: n }, () => []);
  for (const f of files.slice().sort((a, b) => cost(b) - cost(a) || a.localeCompare(b))) {
    const i = load.indexOf(Math.min(...load));
    out[i].push(f);
    load[i] += cost(f);
  }
  return out;
}

if (require.main === module) {
  const m = /^(\d+)\/(\d+)$/.exec(process.argv[2] || '');
  if (!m || +m[1] < 1 || +m[1] > +m[2]) { console.error('usage: node tests/shard.js <k>/<n>'); process.exit(2); }
  const mine = shards(+m[2])[+m[1] - 1];
  console.log(`shard ${m[1]}/${m[2]}: ${mine.join(' ')}`);
  // One file at a time (timing checks stay honest); a test that hangs fails after 2 min,
  // and the runner exits even if a failed browser test left Chrome running.
  const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-timeout=120000', '--test-force-exit', ...process.argv.slice(3), ...mine], { cwd: ROOT, stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
}

module.exports = { testFiles, shards };
