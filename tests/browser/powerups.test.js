// Power-ups in the page: the tight-turn power-up (#38) and the power-up badges (#63).
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

test('power-ups in the HUD', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval('window.__player.shield = 1e5');
  const badge = (type) => `document.querySelector('#powerups .badge[data-type="${type}"]')`;
  const shown = (type) => page.eval(`!${badge(type)}.classList.contains('hidden')`);
  const ring = (type) => page.eval(`+getComputedStyle(${badge(type)}).getPropertyValue('--left')`);
  const cls = (type) => page.eval(`[...${badge(type)}.classList].filter((c) => c !== 'badge').sort().join(' ')`);

  await t.test('collecting the tight-turn power-up shows its feed message and badge (#38)', async () => {
    await page.eval(`window.__game.powerups.push({ x: window.__player.x, y: window.__player.y, type: 'turn', ph: 0, dead: false })`);
    await page.waitFor('window.__player.pw.turn > 0', 'power-up collected');
    await page.waitFor(`[...document.querySelectorAll('#feed div')].some((d) => d.textContent === '🌀 Tight turns!')`, 'feed message');
    await page.waitFor(`!${badge('turn')}.classList.contains('hidden')`, 'badge shown');
    assert.equal(await page.eval(`${badge('turn')}.textContent`), '🌀');
  });

  await t.test('badges keep a fixed order (#63)', async () => {
    assert.deepEqual(await page.eval(`[...document.querySelectorAll('#powerups .badge')].map((b) => b.dataset.type)`),
      ['magnet', 'x2', 'x5', 'speed', 'zoom', 'turn']);
  });

  await t.test('a fresh power-up has a full ring that drains (#63)', async () => {
    await page.eval('window.__player.pw.magnet = 16');
    await page.waitFor(`!${badge('magnet')}.classList.contains('hidden')`, 'magnet badge');
    assert.ok(await ring('magnet') > 0.95, 'full ring');
    assert.equal(await cls('magnet'), '', 'not blinking');
    await page.eval('window.__player.pw.magnet = 8');
    await page.frames(3);
    const r = await ring('magnet');
    assert.ok(r > 0.45 && r < 0.52, `half ring at 8 s: ${r}`);
  });

  await t.test('about to expire: blinks in the last 3 s, faster in the last second, then hides (#63)', async () => {
    await page.eval('window.__player.pw.magnet = 2.5');
    await page.waitFor(`${badge('magnet')}.classList.contains('ending')`, 'blinking');
    assert.equal(await cls('magnet'), 'ending');
    await page.eval('window.__player.pw.magnet = 0.8');
    await page.waitFor(`${badge('magnet')}.classList.contains('ending-fast')`, 'blinking faster');
    await page.waitFor(`${badge('magnet')}.classList.contains('hidden')`, 'hidden when it ends');
    assert.equal(await page.eval('window.__player.pw.magnet'), 0);
  });

  await t.test('collecting it again refills the ring and stops the blink (#63)', async () => {
    await page.eval('window.__player.pw.x2 = 2');
    await page.waitFor(`${badge('x2')}.classList.contains('ending')`, 'blinking');
    await page.eval(`window.__game.powerups.push({ x: window.__player.x, y: window.__player.y, type: 'x2', ph: 0, dead: false })`);
    await page.waitFor(`!${badge('x2')}.classList.contains('ending')`, 'blink stops');
    assert.ok(await ring('x2') > 0.95, 'ring full again');
    assert.equal(await shown('x2'), true);
  });
});
