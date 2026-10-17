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

// In-game HUD on touch screens (#11): the touch buttons and every HUD element fit
// inside the screen without overlapping, in portrait and landscape. The feed is
// transient and ignores taps, so it is left out.
const HUD = ['#boostBtn', '#pauseBtn', '#stats', '#leaderboard', '#minimap', '#powerups'];
const MEASURE_HUD = `(() => Object.fromEntries(${JSON.stringify(HUD)}.map((s) => {
  const el = document.querySelector(s), r = el.getBoundingClientRect();
  return [s, { shown: el.getClientRects().length > 0, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }];
})))()`;

async function startTouchRun(t, width, height, coarse) {
  const page = await launch({ width, height });
  t.after(() => page.close());
  if (coarse) await page.coarsePointer();
  await page.goto(gameUrl());
  await page.startRun();
  // Shielded, with every power-up running so their timers take the most space in the HUD.
  await page.eval(`Object.assign(window.__player, { shield: 1e9 }); Object.assign(window.__player.pw, { magnet: 15, x2: 15, x5: 15, speed: 15, zoom: 15, turn: 15 })`);
  await page.waitFor(`document.querySelectorAll('#powerups .pw').length === 6`, 'power-up timers');
  // Boosting, so the BOOST badge next to the score takes its space too (#37).
  await page.eval('window.__player.mass = 300');
  await page.key('keyDown', 'Space');
  await page.waitFor(`!document.getElementById('boostBadge').classList.contains('hidden')`, 'boost badge');
  await page.frames(5);
  return page;
}

for (const [width, height] of [[390, 844], [360, 640], [844, 390], [667, 375], [640, 360]]) {
  test(`touch HUD fits without overlaps at ${width}x${height}`, async (t) => {
    const page = await startTouchRun(t, width, height, true);
    const m = await page.eval(MEASURE_HUD);
    assert.ok(await page.eval(`document.getElementById('boostBadge').getClientRects().length > 0`), 'boost badge shown');
    for (const s of HUD) {
      const r = m[s];
      assert.ok(r.shown, `${s} is shown`);
      assert.ok(r.left >= 0 && r.top >= 0 && r.right <= width + 0.5 && r.bottom <= height + 0.5, `${s} inside the screen: ${JSON.stringify(r)}`);
    }
    for (const s of ['#boostBtn', '#pauseBtn']) assert.ok(m[s].width >= 44 && m[s].height >= 44, `${s} at least 44px`);
    for (let i = 0; i < HUD.length; i++) {
      for (let j = i + 1; j < HUD.length; j++) {
        const a = m[HUD[i]], b = m[HUD[j]];
        const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        assert.ok(!overlap, `${HUD[i]} overlaps ${HUD[j]}: ${JSON.stringify(a)} ${JSON.stringify(b)}`);
      }
    }
  });
}

for (const [width, height] of [[1280, 713], [1440, 900]]) {
  test(`no touch buttons with a mouse at ${width}x${height}`, async (t) => {
    const page = await startTouchRun(t, width, height, false);
    const m = await page.eval(MEASURE_HUD);
    assert.equal(m['#boostBtn'].shown, false, 'boost button hidden');
    assert.equal(m['#pauseBtn'].shown, false, 'pause button hidden');
  });
}
