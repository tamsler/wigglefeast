// Menus stay usable on short screens (#21). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const MEASURE = `(() => {
  const out = {};
  for (const [name, ids] of [['menu', ['#name', '#play', '#openStats', '#version']], ['stats', ['#totals', '#exportSave', '#closeStats']]]) {
    if (name === 'stats') document.getElementById('openStats').click();
    const panel = document.querySelector(name === 'menu' ? '#menu .panel' : '#statsScreen .panel');
    const p = panel.getBoundingClientRect();
    out[name] = {
      inView: p.top >= 0 && p.bottom <= innerHeight + 0.5,
      scrolls: panel.scrollHeight > panel.clientHeight,
      reachable: ids.every((id) => { const r = document.querySelector(id).getBoundingClientRect(); return r.top - p.top + panel.scrollTop >= 0 && r.bottom - p.top + panel.scrollTop <= panel.scrollHeight + 1; }),
    };
  }
  return out;
})()`;

// Phone landscape sizes, a typical laptop browser viewport, and a larger desktop.
for (const [width, height] of [[844, 390], [667, 375], [1280, 713], [1440, 900]]) {
  test(`menus fit and every control is reachable at ${width}x${height}`, async (t) => {
    let page;
    t.after(() => page && page.close());
    page = await launch({ width, height });
    await page.goto(gameUrl());
    await page.frames(5);
    const m = await page.eval(MEASURE);
    for (const name of ['menu', 'stats']) {
      assert.ok(m[name].inView, `${name} panel fits the screen`);
      assert.ok(m[name].reachable, `${name} controls reachable`);
      if (width >= 1000) assert.equal(m[name].scrolls, false, `${name} panel should not scroll on desktop`);
    }
  });
}
