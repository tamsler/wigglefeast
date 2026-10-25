// The arena floor (#163): big hexagons with dark grooves. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

test('arena floor', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');
  await page.eval(`document.getElementById('paused').classList.add('hidden')`); // keep the panel out of the pixels

  await t.test('the floor tile holds big hexagons, 80 units from centre to corner', async () => {
    assert.deepEqual(await page.eval('window.wigglefeastDebug.floorTile()'), { w: 240, h: 139, s: 80 });
  });

  await t.test('grooves between the hexagons are darker than their middles', async () => {
    // Only the player, far from the hexagon we look at; no food, power-ups or special food.
    const at = await page.eval(`(() => {
      const g = window.__game, p = window.__player;
      Object.assign(g, { worms: [p], food: [], powerups: [], specials: [] }); g.rebuildFoodGrid();
      // A big hexagon's centre two columns right of the player (the tile is anchored at world 0, 0).
      const cx = Math.round(p.x / 240) * 240 + 480, cy = Math.round(p.y / 139) * 139;
      return { cx, cy };
    })()`);
    await page.frames(3);
    const lum = (x, y) => page.eval(`(() => {
      const c = document.getElementById('game'), g = c.getContext('2d'), m = g.getTransform();
      const d = g.getImageData(Math.round(m.a * ${x} + m.e), Math.round(m.d * ${y} + m.f), 1, 1).data;
      return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
    })()`);
    // The middle of the edge between the corners at 0 and 60 degrees: (60, 34.75) from the centre.
    const middle = await lum(at.cx, at.cy), groove = await lum(at.cx + 60, at.cy + 34.75);
    assert.ok(groove < middle - 4, `groove ${groove.toFixed(1)} darker than the middle ${middle.toFixed(1)}`);
  });
});
