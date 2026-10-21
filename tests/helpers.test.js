// Test helpers (#105). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { removeProfile } = require('./helpers/browser');

test('removing a Chrome profile never fails the test, and removes it when it can (#105)', (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-helpers-'));
  t.after(() => { fs.chmodSync(parent, 0o700); fs.rmSync(parent, { recursive: true, force: true }); });
  const profile = path.join(parent, 'profile');
  fs.mkdirSync(path.join(profile, 'Default'), { recursive: true });
  fs.writeFileSync(path.join(profile, 'Default', 'Preferences'), '{}');

  // A folder that can't be deleted (as when Chrome is still writing to it) is left behind quietly.
  fs.chmodSync(parent, 0o500);
  if (process.getuid && process.getuid() !== 0) {
    assert.doesNotThrow(() => removeProfile(profile));
    assert.ok(fs.existsSync(profile));
  }
  fs.chmodSync(parent, 0o700);

  removeProfile(profile);
  assert.ok(!fs.existsSync(profile));
});
