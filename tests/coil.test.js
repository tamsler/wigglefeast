// Coil encounters from tools/coil.js (#94, #149): the measuring scene itself is sound.
const test = require('node:test');
const assert = require('node:assert/strict');
const { encounter } = require('../tools/coil.js');

test('a coil encounter replays exactly from its seed (#94)', () => {
  for (const coiler of ['bot', 'scripted']) {
    const a = encounter({ seed: 7, coiler }), b = encounter({ seed: 7, coiler });
    assert.deepEqual({ ...a, modes: [...a.modes] }, { ...b, modes: [...b.modes] }, coiler);
  }
});

test('both coilers close a loop around the prey, as a live coil does (#94)', () => {
  for (const coiler of ['bot', 'scripted']) {
    let closed = 0;
    for (let i = 0; i < 10; i++) if (encounter({ seed: 100 + i, coiler }).loop >= 6) closed++;
    assert.ok(closed >= 7, `${coiler}: the loop closed in ${closed} of 10`);
  }
});

test('bots that escape coils die clearly less often in a fixed batch of live coils (#94)', () => {
  // 60 seeded coils per arm; the full measurement (300+ per arm) is `node tools/coil.js`.
  for (const [coiler, most] of [['scripted', 0.6], ['bot', 0.8]]) {
    const deaths = (arm) => {
      let n = 0;
      for (let i = 0; i < 60; i++) if (encounter({ seed: 500 + i, coiler, arm }).outcome === 'prey') n++;
      return n;
    };
    const before = deaths('baseline'), after = deaths('escape');
    assert.ok(after <= before * most, `${coiler} coiler: the trapped bot died ${after} times with the tactic, ${before} without`);
  }
});
