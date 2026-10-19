// Skin decorations of long worms draw only for the visible part, and stay put (#99).
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl, sleep } = require('../helpers/browser');

test('decorations of a long worm', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');
  // Record every arc drawn on the game canvas, with its radius.
  await page.eval(`(() => {
    const proto = CanvasRenderingContext2D.prototype, orig = proto.arc;
    window.__arcs = [];
    proto.arc = function (x, y, r, ...rest) { if (this.canvas.id === 'game') window.__arcs.push([x, y, r]); return orig.call(this, x, y, r, ...rest); };
  })()`);

  // A 600-segment Ladybug (spots) laid straight across the screen, 150 below the player, head
  // and tail thousands of units off-screen. `shift` slides it along its line by whole segments.
  const layOut = (shift) => page.eval(`(() => {
    const g = window.__game, p = window.__player, { SKINS, radiusFor } = window.WormEngine;
    const b = g.worms.find((w) => w.ai);
    b.skin = SKINS.find((s) => s.name === 'Ladybug');
    b.mass = 2000; b.r = radiusFor(2000);
    const sp = b.r * 0.42, x0 = p.x + 6000 + ${shift} * sp;
    b.sx = []; b.sy = [];
    for (let k = 0; k < 600; k++) { b.sx.push(x0 - k * sp); b.sy.push(p.y + 150); }
    b.updateBounds();
    // Nothing else drawn near the column: no other worms, food or power-ups.
    g.worms = [p, b]; g.food = []; g.powerups = []; g.rebuildFoodGrid();
    return { x0, y: p.y + 150, sp, r: b.r };
  })()`);

  // Spots are the arcs with radius 0.3 r; each maps back to its segment along the straight body.
  const spotsDrawn = async (w) => {
    await page.eval('window.__arcs.length = 0');
    const f0 = await page.eval('performance.now()');
    await sleep(300);
    const ms = (await page.eval('performance.now()')) - f0;
    const arcs = await page.eval('window.__arcs');
    const spots = arcs.filter(([, , r]) => Math.abs(r - 0.3 * w.r) < 1e-6).map(([x, y]) => ({ i: Math.round((w.x0 - x) / w.sp), side: Math.sign(y - w.y) }));
    return { spots, frames: Math.max(1, Math.round(ms / (1000 / 60))) };
  };

  for (const shift of [0, 7]) {
    await t.test(`only the visible spots are drawn, each on its own side (shift ${shift})`, async () => {
      const w = await layOut(shift);
      const { spots, frames } = await spotsDrawn(w);
      const perFrame = spots.length / frames;
      assert.ok(perFrame > 3 && perFrame < 40, `${perFrame.toFixed(1)} spots per frame (all 600 segments would be about 85)`);
      const idx = [...new Set(spots.map((s) => s.i))].sort((a, b) => a - b);
      const step = Math.min(...idx.slice(1).map((v, k) => v - idx[k]));
      for (const s of spots) {
        assert.equal(s.i % step, 0, `spot at segment ${s.i} sits on the every-${step} grid`);
        const side = (s.i / step - 1) % 2 ? 1 : -1;
        assert.equal(s.side, side, `spot at segment ${s.i} is on its own side`);
      }
    });
  }
});
