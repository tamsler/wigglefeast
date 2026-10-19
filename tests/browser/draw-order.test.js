// What the player can run into is never hidden under the player's own body (#102):
// the player's body is drawn below other worms, its head on top.
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

test('draw order around the player', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');

  // The player (Lava: reds and yellow) lies straight, head on the right. One Emerald bot (green
  // and blue) lies along under the player's body, its head clear of it; another lies across the
  // player's head.
  const at = await page.eval(`(() => {
    const g = window.__game, p = window.__player, { SKINS, radiusFor, Worm } = window.WormEngine;
    const lava = SKINS.find((s) => s.name === 'Lava'), emerald = SKINS.find((s) => s.name === 'Emerald');
    const px = p.x, py = p.y;
    const lay = (w, mass, skin, pts) => {
      w.mass = mass; w.r = radiusFor(mass); w.skin = skin;
      w.sx = pts.map((q) => q[0]); w.sy = pts.map((q) => q[1]); w.shield = 0; w.updateBounds();
    };
    const line = (x0, y0, x1, y1, step) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step), out = [];
      for (let i = 0; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
      return out;
    };
    lay(p, 1000, lava, line(px, py, px - 700, py, radiusFor(1000) * 0.42)); // no shield: drawn fully opaque (paused, so safe)
    const [under, across] = g.worms.filter((w) => w.ai).slice(0, 2);
    lay(under, 300, emerald, line(px - 120, py, px - 600, py, radiusFor(300) * 0.42));
    lay(across, 300, emerald, line(px, py - 250, px, py + 250, radiusFor(300) * 0.42));
    g.worms = [p, under, across]; g.food = []; g.powerups = []; g.rebuildFoodGrid();
    g.rebuildSegGrid(); g.maxR = Math.max(...g.worms.map((w) => w.r)); // as a game tick would before drawing
    return { under: [px - 360, py], head: [px, py] };
  })()`);
  await page.frames(5);
  // A world point's pixel, through the transform the game leaves on the canvas.
  const pixel = ([x, y]) => page.eval(`(() => {
    const c = document.getElementById('game'), g = c.getContext('2d'), m = g.getTransform();
    const d = g.getImageData(Math.round(m.a * ${x} + m.e), Math.round(m.d * ${y} + m.f), 1, 1).data;
    return [d[0], d[1], d[2]];
  })()`);

  await t.test("a body lying under the player's body is visible", async () => {
    const [r, g, b] = await pixel(at.under);
    assert.ok(r < 120 && Math.max(g, b) > 120, `bot colour (green/blue), got rgb(${r}, ${g}, ${b})`);
  });

  await t.test("the player's head stays on top of a body lying across it", async () => {
    const [r, g, b] = await pixel(at.head);
    assert.ok(r > 150 && g < 120, `player colour (red), got rgb(${r}, ${g}, ${b})`);
  });

  // Review of #104: an earlier version left a dark seam across the player's body just behind the
  // head. With nothing over the head the player must be drawn in one piece: along the centreline
  // from the head back 5 radii, no pixel much darker than the skin's stripes (Emerald).
  await t.test('no seam behind the head', async () => {
    const line = await page.eval(`(() => {
      const g = window.__game, p = window.__player, { SKINS } = window.WormEngine;
      p.skin = SKINS.find((s) => s.name === 'Emerald');
      g.worms = [p];
      g.rebuildSegGrid();
      return { x: p.x, y: p.y, r: p.r };
    })()`);
    await page.frames(5);
    // Every canvas pixel along the centreline (the seam is only a couple of pixels thick).
    const lum = await page.eval(`(() => {
      const c = document.getElementById('game'), g = c.getContext('2d'), m = g.getTransform();
      const y = Math.round(m.d * ${line.y} + m.f), x1 = Math.round(m.a * (${line.x} - 0.2 * ${line.r}) + m.e), x0 = Math.round(m.a * (${line.x} - 5 * ${line.r}) + m.e);
      const d = g.getImageData(x0, y, x1 - x0, 1).data, out = [];
      for (let i = 0; i < d.length; i += 4) out.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      return out;
    })()`);
    // The darker Emerald stripe (#118ab2) is about 115; a half-dark outline seam would be about 60.
    const min = Math.min(...lum);
    assert.ok(min > 85, `darkest centreline pixel behind the head: ${min.toFixed(0)} (seam if well below the stripes' ~115)`);
  });
});
