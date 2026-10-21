// CI shards (#112): every test file runs in exactly one shard, whatever the number of shards.
const test = require('node:test');
const assert = require('node:assert/strict');
const { testFiles, shards } = require('./shard.js');

test('every test file runs in exactly one CI shard (#112)', () => {
  const files = testFiles();
  assert.ok(files.includes('tests/engine.test.js') && files.includes('tests/browser/tabs.test.js') && files.includes('tests/shard.test.js'));
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const all = shards(n).flat();
    assert.deepEqual(all.slice().sort(), files, `${n} shards`);
  }
  // A file the duration table doesn't know still gets a shard.
  const extra = [...files, 'tests/browser/new.test.js'];
  assert.ok(shards(3, extra).flat().includes('tests/browser/new.test.js'));
});
