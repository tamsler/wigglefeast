// Keyboard shortcuts vs. native keys (#49, #50). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const KEYS = { KeyP: ['p', 80], Space: [' ', 32] };
const hidden = (id) => `document.getElementById('${id}').classList.contains('hidden')`;

test('keyboard', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const key = (type, code, autoRepeat = false) => {
    const [k, vk] = KEYS[code];
    return page.send('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: vk, autoRepeat });
  };

  await t.test('Space presses a focused menu button (#50)', async () => {
    await page.eval(`document.getElementById('openStats').focus()`);
    await key('keyDown', 'Space');
    await key('keyUp', 'Space');
    await page.waitFor(`!${hidden('statsScreen')}`, 'stats screen to open');
    await page.click('#closeStats');
  });

  await page.startRun();
  await page.eval('window.__player.shield = 1e9');

  await t.test('holding P pauses once; a separate press resumes (#49)', async () => {
    await key('keyDown', 'KeyP');
    await page.waitFor(`!${hidden('paused')}`, 'pause');
    for (let i = 0; i < 5; i++) await key('keyDown', 'KeyP', true); // auto-repeat while held
    await page.frames(5);
    assert.equal(await page.eval(`!${hidden('paused')}`), true, 'still paused while P is held');
    await key('keyUp', 'KeyP');
    await page.press('KeyP');
    await page.waitFor(hidden('paused'), 'resume on a separate press');
  });

  await t.test('Space presses a focused Resume button (#50)', async () => {
    await page.press('KeyP');
    await page.waitFor(`!${hidden('paused')}`, 'pause');
    await page.eval(`document.getElementById('resume').focus()`);
    await key('keyDown', 'Space');
    await key('keyUp', 'Space');
    await page.waitFor(hidden('paused'), 'Resume pressed by Space');
  });

  await t.test('Space still boosts during a run', async () => {
    await page.eval('window.__player.mass = 200');
    await key('keyDown', 'Space');
    await page.waitFor('window.__player.wantBoost === true', 'boost while Space is held');
    await key('keyUp', 'Space');
    await page.waitFor('window.__player.wantBoost === false', 'boost to stop on release');
  });

  await t.test('Space presses a focused Play again button (#50)', async () => {
    await page.eval('window.__game.kill(window.__player, null)');
    await page.waitFor(`!${hidden('death')}`, 'death screen');
    await page.eval(`document.getElementById('again').focus()`);
    await key('keyDown', 'Space');
    await key('keyUp', 'Space');
    await page.waitFor(`${hidden('death')} && window.__player && !window.__player.dead`, 'new run from Play again');
  });
});
