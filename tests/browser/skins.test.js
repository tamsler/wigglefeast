// Skin finishes and the skin picker (#58). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const KILLER = JSON.stringify({ v: 1, totals: { games: 1, kills: 1, time: 30, eaten: 10, best: 100, bestByDiff: { easy: 0, normal: 100, hard: 0 } }, top: [], recent: [] }); // has eaten a worm: First Bite unlocks Lavender (#14)
const NEW = ['Aurora', 'Sunset Drive', 'Synthwave', 'Toxic', 'Gold Rush', 'Chrome', 'Ladybug', 'Leopard', 'Viper', 'Galaxy', 'Magma', 'Abyss'];
// A cheap fingerprint of the arena canvas.
const HASH = `(() => { const c = document.getElementById('game'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; })()`;

test('skins', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());

  await t.test('the picker offers the 24 free skins, then the 6 rewards locked, drawn with their finish', async () => {
    const names = await page.eval(`[...document.querySelectorAll('#skins button')].map((b) => b.title)`);
    assert.equal(names.length, 30);
    assert.ok(NEW.every((n) => names.slice(0, 24).includes(n)), 'all free skins are offered first');
    assert.deepEqual(names.slice(24), ['Rainbow', 'Lavender', 'Dragon', 'Thunder', 'Royal', 'Cosmic'], 'then the rewards (#14)');
    const locked = await page.eval(`[...document.querySelectorAll('#skins button.locked')].map((b) => b.title)`);
    assert.deepEqual(locked, names.slice(24), 'rewards are locked on a fresh profile');
    assert.equal(await page.eval(`document.querySelectorAll('#skins button canvas').length`), 30, 'each swatch is a drawn canvas');
  });

  await t.test('picking Galaxy plays as Galaxy and is remembered', async () => {
    await page.click('#skins button[title="Galaxy"]');
    await page.startRun('Star');
    assert.equal(await page.eval('window.__player.skin.name'), 'Galaxy');
    await page.press('KeyP');
    await page.click('#endRun');
    await page.reload();
    assert.equal(await page.eval(`document.querySelector('#skins button.on').title`), 'Galaxy');
  });

  await t.test('a remembered Lavender still loads and plays once First Bite is earned', async () => {
    await page.eval(`localStorage.removeItem('wormarena.world'); localStorage.setItem('wormarena.profile', ${JSON.stringify(KILLER)});
      localStorage.setItem('wormarena.settings', JSON.stringify({ name: 'Old', skin: 8, botCount: 30, difficulty: 'normal' }))`);
    await page.reload();
    assert.equal(await page.eval(`document.getElementById('skinName').textContent`), 'Lavender');
    assert.equal(await page.eval(`document.querySelector('#skins button.on').title`), 'Lavender');
    await page.startRun('Old');
    assert.equal(await page.eval('window.__player.skin.name'), 'Lavender');
  });

  await t.test('every skin renders in the arena without errors', async () => {
    page.exceptions.length = 0;
    await page.eval(`{
      const g = window.__game, p = window.__player, E = window.WormEngine;
      Object.assign(p, { shield: 1e5 });
      g.worms = [p]; g.respawnQueue = []; g.settings.botCount = 0;
      E.SKINS.forEach((skin, k) => {
        const b = g.spawnBot(false);
        Object.assign(b, { skin, thinkT: 1e9, shield: 1e5, wantBoost: k % 2 === 0, mass: 200 });
        const x0 = p.x - 500 + (k % 6) * 180, y0 = p.y - 300 + Math.floor(k / 6) * 140;
        b.sx = b.sx.map((v, i) => x0 - i * 6); b.sy = b.sy.map(() => y0); b.angle = b.targetAngle = 0; b.updateBounds();
      });
    }`);
    await page.frames(30);
    assert.deepEqual(page.exceptions, []);
    assert.equal(await page.eval('window.__game.worms.length'), 1 + (await page.eval('window.WormEngine.SKINS.length')), 'all skins in the world');
  });

  await t.test('animated finishes freeze while paused (#58)', async () => {
    // Only a Magma worm and the player; no food, power-ups or special food (#143), which pulse on
    // real time (a special food in view made this flaky).
    await page.eval(`{
      const g = window.__game, p = window.__player;
      g.worms = [p, ...g.worms.filter((w) => w.skin.name === 'Magma')];
      Object.assign(g, { food: [], powerups: [], specials: [], foodTarget: 0, powerupTarget: 0, specialTarget: 0 }); g.rebuildFoodGrid();
      // These blink or pulse on real time and are not finishes: the shield, the boost arrows,
      // and the arena border (moved out of view).
      g.worms.forEach((w) => { w.shield = 0; w.wantBoost = false; w.boosting = false; });
      g.R = 1e6;
    }`);
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
    await page.eval(`document.getElementById('paused').classList.add('hidden')`); // keep the panel out of the pixels
    await page.frames(3);
    const a = await page.eval(HASH);
    await new Promise((r) => setTimeout(r, 400));
    await page.frames(3);
    assert.equal(await page.eval(HASH), a, 'nothing moves while paused');
  });
});

// Skin preview (#161): the selected skin on a wiggling worm under the Skin label.
test('skin preview', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const preview = () => page.eval('window.wigglefeastDebug.previewSkin()');
  const pixels = `(() => { const c = document.getElementById('skinPreview'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0; return h; })()`;

  await t.test('shows the remembered skin, then each picked skin straight away', async () => {
    await page.frames(2);
    assert.equal(await preview(), await page.eval(`document.getElementById('skinName').textContent`));
    await page.click('#skins button[title="Leopard"]');
    await page.frames(2);
    assert.equal(await preview(), 'Leopard');
    await page.click('#skins button[title="Chrome"]');
    await page.frames(2);
    assert.equal(await preview(), 'Chrome');
  });

  await t.test('wiggles, and holds still when the system asks for reduced motion', async () => {
    const a = await page.eval(pixels);
    await page.frames(10);
    assert.notEqual(await page.eval(pixels), a, 'the worm moves');
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await page.frames(2);
    const b = await page.eval(pixels);
    await page.frames(10);
    assert.equal(await page.eval(pixels), b, 'the worm holds still');
    await page.send('Emulation.setEmulatedMedia', { features: [] });
  });

  await t.test('a remembered, unlocked Lavender shows in the preview', async () => {
    await page.eval(`localStorage.removeItem('wormarena.world'); localStorage.setItem('wormarena.profile', ${JSON.stringify(KILLER)});
      localStorage.setItem('wormarena.settings', JSON.stringify({ name: 'Old', skin: 8, botCount: 30, difficulty: 'normal' }))`);
    await page.reload();
    await page.frames(2);
    assert.equal(await preview(), 'Lavender');
  });

  await t.test('is not drawn while playing', async () => {
    await page.startRun('Prev');
    await page.frames(2);
    const n = await page.eval('window.wigglefeastDebug.previewFrames()');
    await page.frames(10);
    assert.equal(await page.eval('window.wigglefeastDebug.previewFrames()'), n);
  });
});
