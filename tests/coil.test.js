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
