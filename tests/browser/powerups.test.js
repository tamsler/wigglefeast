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
  // Only the power-ups a test adds: none in the arena and none spawning. Otherwise the magnet
  // (which pulls power-ups in from far away) can collect a random one and restart a timer.
  await page.eval(`window.__player.shield = 1e5; Object.assign(window.__game, { powerups: [], powerupTarget: 0 })`);
  // Pauses or resumes; presses P only if needed (the game also pauses itself, e.g. on losing focus).
  const pause = async (on) => {
    const paused = `!document.getElementById('paused').classList.contains('hidden')`;
    if ((await page.eval(paused)) !== on) await page.press('KeyP');
    await page.waitFor(on ? paused : `!(${paused})`, on ? 'pause' : 'resume');
  };
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
    await pause(true); // game time stands still while paused; badges still update
    await page.eval('window.__player.pw.magnet = 16');
    await page.waitFor(`!${badge('magnet')}.classList.contains('hidden')`, 'magnet badge');
    assert.equal(await ring('magnet'), 1, 'full ring');
    assert.equal(await cls('magnet'), '', 'not blinking');
    await page.eval('window.__player.pw.magnet = 8');
    await page.waitFor(`+getComputedStyle(${badge('magnet')}).getPropertyValue('--left') === 0.5`, 'half ring at 8 s');
    await pause(false);
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
    assert.ok(await ring('x2') > 0.85, 'ring (nearly) full again'); // time keeps running here
    assert.equal(await shown('x2'), true);
  });
});

test('badges are labelled for screen readers and the minimap is drawn at its displayed size (#63)', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch({ width: 390, height: 844 });
  await page.goto(gameUrl());
  await page.startRun();
  assert.deepEqual(await page.eval(`[...document.querySelectorAll('#powerups .badge')].map((b) => b.getAttribute('role') + ':' + b.getAttribute('aria-label'))`),
    ['img:Magnet', 'img:Double food', 'img:Food x5', 'img:Free boost', 'img:Zoom out', 'img:Tight turns']);
  await page.frames(3);
  const m = await page.eval(`(() => { const c = document.getElementById('minimap'); return [c.width, Math.round(c.clientWidth * Math.min(2, devicePixelRatio))]; })()`);
  assert.equal(m[0], m[1], 'minimap canvas matches its displayed size');
});
