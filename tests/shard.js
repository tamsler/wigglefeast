#!/usr/bin/env node
// Runs one CI shard of the test files (#112): node tests/shard.js 2/5 [extra node --test flags]
// Files are spread over the shards by their usual duration, longest first onto the least
// loaded shard. A file missing from SECONDS counts as 2 s, so a new test file always runs.
// Not a test file itself (no .test.js), so `node --test "tests/**/*.test.js"` skips it.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
// Rough seconds per file, run alone. Only the balance depends on these, never which files run.
const SECONDS = {
  'tests/browser/layout.test.js': 29,
  'tests/browser/tabs.test.js': 28,
  'tests/engine.test.js': 23,
  'tests/browser/bots.test.js': 12,
  'tests/browser/massive.test.js': 11,
  'tests/browser/updates.test.js': 8,
  'tests/browser/habits.test.js': 4,
  'tests/browser/learning-cue.test.js': 3,
  'tests/browser/import.test.js': 5,
  'tests/browser/themes.test.js': 4,
  'tests/browser/boost.test.js': 3,
  'tests/browser/input.test.js': 3,
  'tests/browser/powerups.test.js': 3,
  'tests/browser/skins.test.js': 3,
  'tests/browser/touch.test.js': 3,
};
const DEFAULT_SECONDS = 2; // the rest take 0.3–2.6 s (measured for #132)

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
