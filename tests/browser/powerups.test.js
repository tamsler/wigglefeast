// Power-ups in the page: collecting the tight-turn power-up (#38). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

test('collecting the tight-turn power-up shows its feed message and HUD timer (#38)', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval(`window.__player.shield = 1e9;
    window.__game.powerups.push({ x: window.__player.x, y: window.__player.y, type: 'turn', ph: 0, dead: false })`);
  await page.waitFor('window.__player.pw.turn > 0', 'power-up collected');
  await page.waitFor(`[...document.querySelectorAll('#feed div')].some((d) => d.textContent === '🌀 Tight turns!')`, 'feed message');
  await page.waitFor(`[...document.querySelectorAll('#powerups .pw .ic')].some((e) => e.textContent === '🌀')`, 'HUD timer');
  const timer = await page.eval(`[...document.querySelectorAll('#powerups .pw')].find((e) => e.querySelector('.ic').textContent === '🌀').textContent`);
  assert.match(timer, /1[56]s$/, 'counts down from 16 s');
});
