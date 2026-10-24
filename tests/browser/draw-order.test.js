// Draw order: heavier bodies over lighter ones, so a worm wrapping a smaller one is on top of
// it (#116), and the player's head on top of everything (#102).
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

  // The player (Lava: reds and yellow, mass 1000) lies straight, head on the right. Emerald bots
  // (green and blue) lie along the player's body, one lighter and one heavier, and a heavier one
  // lies across the player's head. Away from the player, a heavy Emerald bot crosses a light Lava
  // bot listed after it, as when one bot wraps another (#116).
  const at = await page.eval(`(() => {
    const g = window.__game, p = window.__player, { SKINS, radiusFor, Worm } = window.WormEngine;
    const lava = SKINS.find((s) => s.name === 'Lava'), emerald = SKINS.find((s) => s.name === 'Emerald');
    const px = p.x, py = p.y;
    const lay = (w, mass, skin, pts) => {
      w.mass = mass; w.r = radiusFor(mass); w.skin = skin;
      w.sx = pts.map((q) => q[0]); w.sy = pts.map((q) => q[1]); w.shield = 0; w.updateBounds();
      // Heading along the laid-out body (head first), so a tick could only move it along its own line.
      w.angle = w.targetAngle = Math.atan2(pts[0][1] - pts[1][1], pts[0][0] - pts[1][0]);
    };
    // Nothing moves from here on, paused or not (CI once caught a tick moving the player off the
    // sampled line); frames still draw.
    g.update = () => {};
    const line = (x0, y0, x1, y1, step) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step), out = [];
      for (let i = 0; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
      return out;
    };
    lay(p, 1000, lava, line(px, py, px - 700, py, radiusFor(1000) * 0.42)); // no shield: drawn fully opaque (paused, so safe)
    const [lighter, heavier, across, wrapper, wrapped] = g.worms.filter((w) => w.ai).slice(0, 5);
    lay(lighter, 300, emerald, line(px - 120, py, px - 330, py, radiusFor(300) * 0.42));
    lay(heavier, 3000, emerald, line(px - 420, py, px - 650, py, radiusFor(3000) * 0.42));
    lay(across, 3000, emerald, line(px, py - 250, px, py + 250, radiusFor(3000) * 0.42));
    lay(wrapper, 2000, emerald, line(px - 400, py - 380, px - 400, py - 180, radiusFor(2000) * 0.42));
    lay(wrapped, 400, lava, line(px - 520, py - 280, px - 280, py - 280, radiusFor(400) * 0.42));
    // Heaviest first, the reverse of the draw order (a list order alone used to decide it).
    g.worms = [heavier, across, wrapper, p, wrapped, lighter]; g.food = []; g.powerups = []; g.rebuildFoodGrid();
    g.rebuildSegGrid(); g.maxR = Math.max(...g.worms.map((w) => w.r)); // as a game tick would before drawing
    // The head is sampled half a radius behind its centre: inside the repainted head and under the
    // heavier body, but clear of the big eyes' outlines just ahead of it (#161).
    return { lighter: [px - 220, py], heavier: [px - 540, py], head: [px - 0.5 * radiusFor(1000), py], wrap: [px - 400, py - 280] };
  })()`);
  await page.frames(5);
  // A world point's pixel, through the transform the game leaves on the canvas.
  const pixel = ([x, y]) => page.eval(`(() => {
    const c = document.getElementById('game'), g = c.getContext('2d'), m = g.getTransform();
    const d = g.getImageData(Math.round(m.a * ${x} + m.e), Math.round(m.d * ${y} + m.f), 1, 1).data;
    return [d[0], d[1], d[2]];
  })()`);

  const isBot = ([r, g, b]) => r < 120 && Math.max(g, b) > 120; // Emerald: green/blue
  const isLava = ([r, g]) => r > 150 && g < 120; // reds

  await t.test("a lighter bot's body lies under the player's (#116)", async () => {
    const c = await pixel(at.lighter);
    assert.ok(isLava(c), `player colour (red), got rgb(${c})`);
  });

  await t.test("a heavier bot's body lies over the player's (#102, #116)", async () => {
    const c = await pixel(at.heavier);
    assert.ok(isBot(c), `bot colour (green/blue), got rgb(${c})`);
  });

  await t.test('a worm wrapping a lighter one is drawn on top of it (#116)', async () => {
    const c = await pixel(at.wrap);
    assert.ok(isBot(c), `wrapper colour (green/blue), got rgb(${c})`);
  });

  await t.test("the player's head stays on top of a heavier body lying across it", async () => {
    const c = await pixel(at.head);
    assert.ok(isLava(c), `player colour (red), got rgb(${c})`);
  });

  // Review of #104: an earlier version repainted the player's head every frame and left a dark
  // seam across the body. The head is repainted only when another body covers it, and a
  // repainted head must look exactly like one drawn in one piece. Since #161 the body has dark
  // edges between its round segments on purpose, so this compares pixels instead of looking
  // for dark ones.
  await t.test('a repainted head matches one drawn in one piece (#104)', async () => {
    // Every canvas pixel along the player's centreline, from just behind the eyes back to the
    // repaint circle's edge (r + 3; outside it the heavier body lies on top).
    const centreline = `(() => {
      const p = window.__player, c = document.getElementById('game'), g = c.getContext('2d'), m = g.getTransform();
      const y = Math.round(m.d * p.y + m.f), x1 = Math.round(m.a * (p.x - 0.2 * p.r) + m.e), x0 = Math.round(m.a * (p.x - p.r) + m.e);
      return Array.from(g.getImageData(x0, y, x1 - x0, 1).data);
    })()`;
    await page.eval(`window.__player.skin = window.WormEngine.SKINS.find((s) => s.name === 'Emerald')`);
    await page.frames(5);
    const debug = 'window.wigglefeastDebug.headRepaints()';
    assert.ok((await page.eval(debug)) >= 1, 'the head is repainted while a heavier body lies across it');
    const covered = await page.eval(centreline);
    await page.eval(`(() => { const g = window.__game; g.worms = [window.__player]; g.rebuildSegGrid(); })()`);
    await page.frames(5);
    assert.equal(await page.eval(debug), 0, 'with nothing over it, the head is not repainted');
    const alone = await page.eval(centreline);
    assert.equal(covered.length, alone.length);
    let worst = 0;
    for (let i = 0; i < alone.length; i += 4) {
      worst = Math.max(worst, Math.abs(covered[i] - alone[i]) + Math.abs(covered[i + 1] - alone[i + 1]) + Math.abs(covered[i + 2] - alone[i + 2]));
    }
    assert.ok(worst <= 12, `largest colour difference along the centreline: ${worst}`);
  });
});
