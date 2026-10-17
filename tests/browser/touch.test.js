// On-screen touch buttons (#11). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const shown = (sel) => `document.querySelector(${JSON.stringify(sel)}).getClientRects().length > 0`;

test('touch buttons', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch({ width: 390, height: 844 });
  await page.goto(gameUrl());
  const boosting = () => page.eval('window.__player.wantBoost');

  await t.test('the helper switches the page to a coarse pointer', async () => {
    assert.equal(await page.eval(`matchMedia('(pointer: coarse)').matches`), false);
    assert.equal(await page.eval(shown('.help .touch')), false, 'touch help line hidden with a mouse');
    await page.coarsePointer();
    assert.equal(await page.eval(`matchMedia('(pointer: coarse)').matches`), true);
  });

  await t.test('hidden in the menu, shown during a run', async () => {
    assert.equal(await page.eval(shown('#boostBtn')), false);
    assert.equal(await page.eval(shown('#pauseBtn')), false);
    assert.equal(await page.eval(shown('.help .touch')), true, 'touch help line shows');
    await page.startRun();
    await page.eval('window.__player.shield = 1e9');
    await page.waitFor(shown('#boostBtn') + ' && ' + shown('#pauseBtn'), 'buttons during a run');
  });

  await t.test('holding the boost button boosts and lifting stops it', async () => {
    const [x, y] = await page.center('#boostBtn');
    await page.touch('touchStart', [[1, x, y]]);
    await page.waitFor('window.__player.wantBoost === true', 'boost while held');
    await page.touch('touchEnd', []);
    await page.waitFor('window.__player.wantBoost === false', 'boost to stop on lift');
  });

  await t.test('lifting after sliding off the button stops the boost', async () => {
    const [x, y] = await page.center('#boostBtn');
    await page.touch('touchStart', [[1, x, y]]);
    await page.touch('touchMove', [[1, 100, 300]]);
    await page.frames(10);
    assert.equal(await boosting(), true, 'still boosting after sliding off');
    await page.touch('touchEnd', []);
    await page.waitFor('window.__player.wantBoost === false', 'boost to stop on lift');
  });

  await t.test('another finger steers while the button is held, and is not a second boost finger', async () => {
    await page.eval(`window.__boostIds = []; document.getElementById('boostBtn').addEventListener('pointerdown', (e) => window.__boostIds.push(e.pointerId))`);
    const [bx, by] = await page.center('#boostBtn');
    await page.touch('touchStart', [[2, 195, 120]]); // straight up from the worm
    await page.touch('touchStart', [[2, 195, 120], [1, bx, by]]);
    await page.waitFor('window.__player.wantBoost === true', 'boost while held');
    await page.waitFor(`Math.abs(window.__player.targetAngle + Math.PI / 2) < 0.6`, 'steer up');
    await page.touch('touchMove', [[2, 195, 720], [1, bx, by]]); // straight down
    await page.waitFor(`Math.abs(window.__player.targetAngle - Math.PI / 2) < 0.6`, 'steer down');
    // Chrome's touch emulation can't lift one of several fingers, so lift the boost finger with a pointer event.
    const id = (await page.eval('window.__boostIds')).pop();
    await page.eval(`document.getElementById('boostBtn').dispatchEvent(new PointerEvent('pointerup', { pointerId: ${id}, pointerType: 'touch', bubbles: true }))`);
    await page.frames(10);
    assert.equal(await boosting(), false, 'one steering finger alone does not boost');
    await page.touch('touchEnd', []);
  });

  await t.test('with two fingers on the button, boost lasts until both lift', async () => {
    const ids = [];
    await page.eval(`window.__boostIds = []`);
    const [x, y] = await page.center('#boostBtn');
    await page.touch('touchStart', [[1, x - 10, y]]);
    await page.touch('touchStart', [[1, x - 10, y], [2, x + 10, y]]);
    await page.waitFor('window.__player.wantBoost === true', 'boost while held');
    ids.push(...(await page.eval('window.__boostIds')));
    assert.equal(ids.length, 2, 'both fingers reached the button');
    await page.eval(`document.getElementById('boostBtn').dispatchEvent(new PointerEvent('pointerup', { pointerId: ${ids[0]}, pointerType: 'touch', bubbles: true }))`);
    await page.frames(10);
    assert.equal(await boosting(), true, 'still boosting with one finger left');
    await page.touch('touchEnd', []);
    await page.waitFor('window.__player.wantBoost === false', 'boost to stop when both lift');
  });

  await t.test('the pause button pauses; Resume continues the run', async () => {
    const [x, y] = await page.center('#pauseBtn');
    await page.touch('touchStart', [[1, x, y]]);
    await page.touch('touchEnd', []);
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause panel');
    await page.waitFor(`!(${shown('#boostBtn')})`, 'buttons hidden while paused');
    const t0 = await page.eval('window.__game.time');
    await page.frames(10);
    assert.equal(await page.eval('window.__game.time'), t0, 'world does not advance while paused');
    await page.click('#resume');
    await page.waitFor(`window.__game.time > ${t0}`, 'run to continue');
    await page.waitFor(shown('#boostBtn'), 'buttons back after resuming');
  });

  await t.test('pausing while the button is held ends the boost', async () => {
    const [x, y] = await page.center('#boostBtn');
    await page.touch('touchStart', [[1, x, y]]);
    await page.waitFor('window.__player.wantBoost === true', 'boost while held');
    await page.eval(`window.dispatchEvent(new Event('blur'))`); // e.g. switching apps
    await page.click('#resume');
    await page.frames(10);
    assert.equal(await boosting(), false, 'boost cleared by the pause');
    await page.touch('touchEnd', []);
  });

  await t.test('hidden on the death screen', async () => {
    await page.eval('window.__game.kill(window.__player, null)');
    await page.waitFor(`document.getElementById('touchControls').classList.contains('hidden')`, 'buttons hidden after death');
    assert.equal(await page.eval(shown('#boostBtn')), false);
  });
});
