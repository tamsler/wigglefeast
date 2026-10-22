// Special food (#143) in the page. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const THEMES = ['classic', 'halloween', 'christmas', 'snacks', 'tech'];

test('special food', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  // A fresh run in a theme, with only the special food a test places (none spawning), and a
  // shield so the player can't die.
  const runIn = async (theme) => {
    const settings = { name: 'Tester', skin: 0, botCount: 5, difficulty: 'easy', theme };
    await page.eval(`localStorage.removeItem('wormarena.world'); localStorage.setItem('wormarena.settings', ${JSON.stringify(JSON.stringify(settings))})`);
    await page.reload();
    await page.startRun();
    await page.eval(`window.__player.shield = 1e5; Object.assign(window.__game, { specials: [], specialTarget: 0 })`);
  };
  const place = (kind, dx, dy, life = 15) => page.eval(`window.__game.specials.push({ x: window.__player.x + ${dx}, y: window.__player.y + ${dy}, kind: '${kind}', life: ${life}, ph: 0, dead: false })`);

  await t.test('every kind has its own look, the same in every theme, from one sprite each', async () => {
    for (const theme of THEMES) {
      await runIn(theme);
      assert.equal(await page.eval('window.wigglefeastDebug.theme()'), theme);
      assert.deepEqual(await page.eval(`['nova', 'nebula', 'plasma'].map((k) => window.wigglefeastDebug.specialLook(k))`), ['crystal', 'diamond', 'orb']);
      page.exceptions.length = 0;
      // Far enough from the head that nothing is pulled in, close enough to be on screen.
      await place('nova', 0, 260, 1e4);
      await place('nebula', 0, -260, 1e4);
      await place('plasma', -300, 0, 1e4);
      await page.frames(5);
      assert.deepEqual((await page.eval('window.wigglefeastDebug.specialsDrawn()')).sort(), ['crystal', 'diamond', 'orb'], theme);
      await page.frames(5);
      assert.equal(await page.eval('window.wigglefeastDebug.specialSprites()'), 3, `${theme}: one sprite per kind, made once`);
      assert.deepEqual(page.exceptions, [], theme);
    }
    await page.eval('window.__game.specials = []');
  });

  await t.test('eating a nebula diamond adds 50 and shows it in the feed', async () => {
    const before = await page.eval('window.__player.mass');
    await place('nebula', 0, 0);
    await page.waitFor(`[...document.querySelectorAll('#feed div')].some((d) => d.textContent === '💎 Nebula diamond +50')`, 'feed message');
    assert.equal(await page.eval('window.__game.specials.length'), 0, 'eaten');
    const gained = (await page.eval('window.__player.mass')) - before;
    // Plus whatever regular food the worm happened to eat on the way.
    assert.ok(gained >= 50 && gained < 70, `gained ${gained.toFixed(1)}`);
  });
});
