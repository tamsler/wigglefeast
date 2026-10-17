// Hot Sauce branding (#59). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, gameUrl, REPO } = require('../helpers/browser');

const PINK = 'rgb(255, 46, 136)', ORANGE = 'rgb(255, 159, 28)';
const OLD = ['rgb(255, 89, 94)', 'rgb(255, 202, 58)', 'rgb(138, 201, 38)', 'rgb(76, 201, 240)', 'rgb(46, 196, 182)'];

test('the wordmark and primary buttons use the brand gradient, not the rainbow (#59)', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  for (const sel of ['h1 span', '#play', '#again', '#resume', '#closeStats', '#playHere', '#updateReload']) {
    const bg = await page.eval(`getComputedStyle(document.querySelector(${JSON.stringify(sel)})).backgroundImage`);
    assert.ok(bg.includes(PINK) && bg.includes(ORANGE), `${sel} uses the brand gradient: ${bg}`);
    assert.ok(OLD.every((c) => !bg.includes(c)), `${sel} has none of the old colours: ${bg}`);
  }
  assert.equal(await page.eval(`document.querySelector('meta[name="theme-color"]').content`), '#0b0f1c', 'status bar stays navy');
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.theme_color, '#0b0f1c');
});

test('the app icons exist at their declared sizes (#59)', () => {
  // Width and height sit at bytes 16-23 of a PNG's IHDR chunk.
  for (const [file, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon-64.png', 64]]) {
    const png = fs.readFileSync(path.join(REPO, 'icons', file));
    assert.equal(png.toString('ascii', 1, 4), 'PNG', `${file} is a PNG`);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [size, size], `${file} is ${size}x${size}`);
  }
});
