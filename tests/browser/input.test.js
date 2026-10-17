// Real input events through Chrome (#20, #22, #23). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

test('player input', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval('window.__player.shield = 1e9'); // keep the worm alive while we poke it
  const boosting = () => page.eval('window.__player.wantBoost');
  const angle = () => page.eval('window.__player.targetAngle');

  await t.test('releasing one boost key keeps another held key boosting (#23)', async () => {
    await page.key('keyDown', 'Space'); await page.key('keyDown', 'KeyW'); await page.key('keyUp', 'KeyW');
    await page.frames(10);
    assert.equal(await boosting(), true);
    await page.key('keyUp', 'Space');
    await page.waitFor('window.__player.wantBoost === false', 'boost to stop');
  });

  await t.test('releasing one steering key keeps another held key turning (#23)', async () => {
    await page.key('keyDown', 'ArrowLeft'); await page.key('keyDown', 'KeyA'); await page.key('keyUp', 'KeyA');
    const a0 = await angle();
    await page.waitFor(`Math.abs(window.__player.targetAngle - (${a0})) > 0.3`, 'still turning after releasing A');
    await page.key('keyUp', 'ArrowLeft');
  });

  await t.test('releasing the mouse outside the window stops boosting (#22)', async () => {
    await page.mouse('mouseMoved', 900, 400, 0);
    await page.mouse('mousePressed', 900, 400, 1);
    await page.waitFor('window.__player.wantBoost === true', 'boost while the button is down');
    await page.mouse('mouseMoved', 1600, -50, 1);
    await page.mouse('mouseReleased', 1600, -50, 0);
    await page.waitFor('window.__player.wantBoost === false', 'boost to stop after release outside');
  });

  // Chrome's touch emulation can't lift one of several fingers, so fingers after
  // the first two are driven with pointer events using the ids the page received.
  await page.eval(`window.__downs = []; document.getElementById('game').addEventListener('pointerdown', (e) => e.pointerType === 'touch' && window.__downs.push(e.pointerId))`);
  const pointer = (type, id, x, y) => page.eval(`document.getElementById('game').dispatchEvent(new PointerEvent('${type}', { pointerId: ${id}, pointerType: 'touch', clientX: ${x}, clientY: ${y}, bubbles: true }))`);

  await t.test('lifting the steering finger hands steering to the other finger (#20)', async () => {
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.touch('touchStart', [[1, 1000, 400]]);
    await page.touch('touchStart', [[1, 1000, 400], [2, 300, 650]]);
    await page.waitFor('window.__player.wantBoost === true', 'two fingers to boost');
    const [first, second] = await page.eval('window.__downs');
    await pointer('pointerup', first, 1000, 400);
    await page.waitFor('window.__player.wantBoost === false', 'boost off with one finger left');
    await pointer('pointermove', second, 640, 100); // straight up from the worm
    await page.waitFor(`Math.abs(window.__player.targetAngle + Math.PI / 2) < 0.6`, 'remaining finger to steer up');
    await page.touch('touchEnd', []);
  });

  await t.test('after losing focus with a finger down, a new finger steers', async () => {
    await pointer('pointerdown', 900, 1000, 400);
    await page.eval(`window.dispatchEvent(new Event('blur'))`);
    await page.press('KeyP'); // blur pauses; resume
    await pointer('pointerdown', 901, 640, 700); // straight down from the worm
    await page.waitFor(`Math.abs(window.__player.targetAngle - Math.PI / 2) < 0.6`, 'new finger to steer down');
    assert.equal(await boosting(), false);
  });
});
