// Food themes (#64). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const THEMES = ['auto', 'classic', 'halloween', 'christmas', 'snacks', 'tech'];
const selected = `document.querySelector('#themes button.on').dataset.theme`;

test('food themes', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const withSettings = async (s) => {
    await page.eval(`localStorage.removeItem('wormarena.world'); localStorage.setItem('wormarena.settings', ${JSON.stringify(JSON.stringify(s))})`);
    await page.reload();
  };

  await t.test('remembered settings without a theme, or an unknown one, load as Auto', async () => {
    for (const s of [{ name: 'A', skin: 0, botCount: 30, difficulty: 'normal' }, { name: 'A', skin: 0, botCount: 30, difficulty: 'normal', theme: 'spooky' }]) {
      await withSettings(s);
      assert.equal(await page.eval(selected), 'auto');
      assert.match(await page.eval(`document.getElementById('themeName').textContent`), /^Auto · (Classic|Halloween|Christmas)$/);
    }
  });

  // The theme Auto follows today, whatever today is (#67).
  const seasonal = () => page.eval('window.WormEngine.seasonalTheme(new Date())');
  const visible = () => page.eval(`[...document.querySelectorAll('#themes button:not(.hidden)')].map((b) => b.dataset.theme)`);

  await t.test('the picker lists Auto first and not the theme Auto already shows (#67)', async () => {
    assert.deepEqual(await page.eval(`[...document.querySelectorAll('#themes button')].map((b) => b.dataset.theme)`), THEMES);
    const season = await seasonal();
    assert.deepEqual(await visible(), THEMES.filter((th) => th !== season), `${season} is not repeated`);
    assert.equal((await visible())[0], 'auto');
    assert.deepEqual(await page.eval(`[...document.querySelectorAll('#themes button:not(.hidden)')].map((b) => b.getAttribute('aria-pressed'))`),
      ['true', 'false', 'false', 'false', 'false'], 'Auto is marked as chosen for screen readers');
  });

  await t.test('an explicit choice of the seasonal theme stays listed and selected (#67)', async () => {
    const season = await seasonal();
    await withSettings({ name: 'A', skin: 0, botCount: 30, difficulty: 'normal', theme: season });
    assert.deepEqual(await visible(), THEMES, 'all six listed');
    assert.equal(await page.eval(selected), season);
    await page.click('#themes button[data-theme="auto"]');
    assert.deepEqual(await visible(), THEMES.filter((th) => th !== season), 'hidden again once Auto is chosen');
  });

  await t.test('items are chosen from the values a save keeps, so a reload cannot change them', async () => {
    // Just under a boundary before rounding, at it after: the item must follow the rounded value.
    const item = (v, ph) => page.eval(`window.wigglefeastDebug.foodItem({ v: ${v}, ph: ${ph} })`);
    await page.click('#themes button[data-theme="snacks"]');
    assert.equal(await item(2.996, 1), await item(3, 1), 'v 2.996 saves as 3.00');
    assert.equal(await item(1, 3.1416), await item(1, 3.14), 'ph 3.1416 saves as 3.14');
    await page.click('#themes button[data-theme="auto"]');
  });

  await t.test('every theme renders without errors and caches at most 16 item sprites', async () => {
    page.exceptions.length = 0;
    for (const theme of THEMES) {
      await page.click(`#themes button[data-theme="${theme}"]`);
      await page.frames(10);
    }
    assert.deepEqual(page.exceptions, []);
    assert.ok(await page.eval('window.wigglefeastDebug.itemSprites()') <= 16);
  });

  await t.test('picking Tech changes the arena and is remembered', async () => {
    await page.click('#themes button[data-theme="tech"]');
    assert.equal(await page.eval('window.wigglefeastDebug.theme()'), 'tech');
    await page.reload();
    assert.equal(await page.eval(selected), 'tech');
    assert.equal(await page.eval('window.wigglefeastDebug.theme()'), 'tech');
    await page.click('#themes button[data-theme="classic"]');
    assert.equal(await page.eval('window.wigglefeastDebug.foodItem(window.__game.food[0])'), 'dot', 'Classic draws plain dots');
  });

  await t.test('a piece of food keeps its item across frames and after a save and load', async () => {
    await page.click('#themes button[data-theme="snacks"]');
    await page.startRun('Snack');
    await page.eval('window.__player.shield = 1e5');
    await page.press('KeyP'); // freeze the world
    // Natural food doesn't move unless pulled; key it by its saved position and value.
    const items = () => page.eval(`Object.fromEntries(window.__game.food
      .filter((f) => f.natural)
      .map((f) => [Math.round(f.x) + ',' + Math.round(f.y) + ',' + Math.round(f.v * 100) / 100, window.wigglefeastDebug.foodItem(f)]))`);
    const before = await items();
    await page.frames(10);
    assert.deepEqual(await items(), before, 'same items across frames');
    await page.reload(); // saves the world on the way out, restores it on load
    await page.waitFor(`document.getElementById('pausedTitle').textContent.includes('Welcome back')`, 'restored');
    const after = await items();
    const common = Object.keys(before).filter((k) => k in after);
    assert.ok(common.length > 200, `${common.length} pieces found after reload`);
    for (const k of common) assert.equal(after[k], before[k], `food at ${k}`);
    const kinds = new Set(Object.values(after));
    assert.ok(['cherry', 'cookie', 'donut', 'cake slice'].every((n) => kinds.has(n)), `all four snack items appear: ${[...kinds]}`);
  });
});

// #163: food is drawn about a third larger, in every theme (drawing only).
test('food drawn larger (#163)', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const sizes = (themed) => page.eval(`window.wigglefeastDebug.foodSizes(10, ${themed})`);
  assert.deepEqual(await sizes(true), { glow: 65, item: 54 }, 'themed: a radius-10 item 54 across on a 65 glow');
  assert.deepEqual(await sizes(false), { glow: 65, item: 0 }, 'Classic: a radius-10 dot 65 across');
});

// Review of #168: a big piece of food just off screen is still drawn while its glow reaches in.
test('big food just off screen is drawn while its glow reaches in (#163)', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');
  // One radius-20 piece, a given distance left of the screen's left edge (glow radius about 73).
  const drawnAt = async (beyond) => {
    await page.eval(`(() => {
      const g = window.__game, m = document.getElementById('game').getContext('2d').getTransform();
      const left = (0 - m.e) / m.a, y = (innerHeight * devicePixelRatio / 2 - m.f) / m.d;
      g.food = [{ x: left - ${beyond}, y, v: 50, r: 20, c: '#ffca3a', life: Infinity, ph: 0, dead: false, natural: true }];
      g.rebuildFoodGrid();
    })()`);
    await page.frames(2);
    return page.eval('window.wigglefeastDebug.foodDrawn()');
  };
  assert.equal(await drawnAt(60), 1, 'drawn 60 units off screen: its glow reaches in');
  assert.equal(await drawnAt(120), 0, 'culled 120 units off screen');
});
