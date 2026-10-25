// Massive worms (#82): long bodies still draw when only part is on screen, frames stay fast,
// and the camera keeps zooming out as the player thickens. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl, sleep } = require('../helpers/browser');

// The game leaves its world transform (zoom × device pixel ratio) on the canvas after each frame.
const ZOOM = `(() => document.getElementById('game').getContext('2d').getTransform().a / devicePixelRatio)()`;

test('massive worms', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');

  await t.test('a massive body crossing the screen, head off-screen, still draws', async () => {
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');
    try {
      // Nothing animated near the column we read: no food, power-ups or special food (which
      // pulses on real time, even while paused).
      await page.eval(`(() => { const g = window.__game; g.food = []; g.powerups = []; g.specials = []; g.rebuildFoodGrid(); })()`);
      await page.frames(5);
      const column = `(() => {
        const c = document.getElementById('game'), g = c.getContext('2d');
        return Array.from(g.getImageData(Math.round(c.width / 2), Math.round(c.height / 2), 1, Math.round(c.height / 2)).data);
      })()`;
      const before = await page.eval(column);
      // A 50,000-mass bot laid straight across the view, 150 units below the player; its head
      // and tail are thousands of units off-screen on either side.
      await page.eval(`(() => {
        const g = window.__game, p = window.__player, { radiusFor } = window.WormEngine;
        const b = g.worms.find((w) => w.ai);
        b.mass = 50000; b.r = radiusFor(50000);
        // A bright skin: a near-black one (Galaxy) barely differs from the arena floor (#159).
        b.skin = window.WormEngine.SKINS.find((s) => s.name === 'Cherry Pop');
        const step = b.r * 0.42, n = Math.ceil(16000 / step);
        b.sx = []; b.sy = [];
        for (let i = 0; i < n; i++) { b.sx.push(p.x - 8000 + i * step); b.sy.push(p.y + 150); }
        b.updateBounds();
      })()`);
      await page.frames(10);
      const after = await page.eval(column);
      let changed = 0;
      for (let i = 0; i < before.length; i += 4) if (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]) > 30) changed++;
      assert.ok(changed > 30, `${changed} pixels of the column changed where the body crosses`);
    } finally {
      await page.press('KeyP'); // unpause even on failure, so the next tests can run (#159)
    }
  });

  await t.test('frames stay fast with the player at 50,000 mass', async (st) => {
    await page.eval('window.__player.mass = 50000');
    await sleep(1500); // the body grows to its new length
    const m = await page.eval(`new Promise((resolve) => {
      const g = window.__game, orig = g.update;
      let engine = 0;
      g.update = function (dt) { const t0 = performance.now(); orig.call(this, dt); engine += performance.now() - t0; };
      const frames = [];
      let last = performance.now();
      const end = last + 3000;
      const tick = (now) => {
        frames.push(now - last); last = now;
        if (now < end) return requestAnimationFrame(tick);
        delete g.update;
        frames.sort((a, b) => a - b);
        resolve({ engine: engine / frames.length, p50: frames[frames.length >> 1], p95: frames[Math.floor(frames.length * 0.95)], segments: window.__player.sx.length });
      };
      requestAnimationFrame(tick);
    })`);
    st.diagnostic(`player at 50,000 (${m.segments} segments): engine ${m.engine.toFixed(2)} ms/frame, frame p50 ${m.p50.toFixed(1)} ms, p95 ${m.p95.toFixed(1)} ms`);
    // Same loose smoke limits as the 150-bot check (#81).
    assert.ok(m.engine < 12, `engine ${m.engine.toFixed(2)} ms per frame`);
    assert.ok(m.p50 < 50, `median frame ${m.p50.toFixed(1)} ms`);
  });

  await t.test('the camera keeps zooming out as the player thickens past 10,000', async () => {
    // Waits until the camera has eased to its new zoom (two readings 250 ms apart within 0.5%),
    // rather than a fixed time that a busy machine may not keep up with.
    const zoomAt = async (mass) => {
      await page.eval(`window.__player.mass = ${mass}`);
      let prev = await page.eval(ZOOM);
      for (let i = 0; i < 40; i++) {
        await sleep(250);
        const z = await page.eval(ZOOM);
        if (i >= 3 && Math.abs(z - prev) / prev < 0.005) return z;
        prev = z;
      }
      return prev;
    };
    const z10 = await zoomAt(10000), z50 = await zoomAt(50000), z100 = await zoomAt(100000);
    assert.ok(z50 < z10 * 0.9, `50,000 zooms out from 10,000 (${z10.toFixed(3)} -> ${z50.toFixed(3)})`);
    assert.ok(z100 < z50 * 0.95, `100,000 keeps zooming out (${z50.toFixed(3)} -> ${z100.toFixed(3)})`);
  });
});

// #163: the camera zooms out faster with thickness: zoom = base / (1 + (r - 14) / 35). Relative to a
// new worm (mass 15) that is about 0.74 at mass 1,000, 0.54 at 10,000 and 0.41 at 50,000; the zoom
// power-up multiplies by 0.62. The worm eats as it goes, so readings are checked against its radius.
test('camera zoom follows worm size (#163)', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');
  const zoomOf = (r) => 1 / (1 + (r - 14) / 35);
  // The settled zoom (two readings 250 ms apart within 0.3%) and the radius at that moment.
  const settled = async () => {
    let prev = await page.eval(ZOOM);
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      const z = await page.eval(ZOOM);
      if (i >= 3 && Math.abs(z - prev) / prev < 0.003) return { z, r: await page.eval('window.__player.r') };
      prev = z;
    }
    return { z: prev, r: await page.eval('window.__player.r') };
  };
  const s0 = await settled(), base = s0.z / zoomOf(s0.r); // the zoom a radius-14 worm would get
  const radiusFor = (m) => page.eval(`window.WormEngine.radiusFor(${m})`);
  for (const [mass, want] of [[1000, 0.74], [10000, 0.54], [50000, 0.41]]) {
    await page.eval(`window.__player.mass = ${mass}`);
    const s = await settled();
    assert.ok(Math.abs(s.z / base - zoomOf(s.r)) / zoomOf(s.r) < 0.02, `zoom at ${mass} follows the radius: ${(s.z / base).toFixed(3)} vs ${zoomOf(s.r).toFixed(3)}`);
    const fromNew = zoomOf(await radiusFor(mass)) / zoomOf(await radiusFor(15));
    assert.ok(Math.abs(fromNew - want) <= 0.01, `relative to a new worm at ${mass}: ${fromNew.toFixed(3)}, want about ${want}`);
  }
  await page.eval('window.__player.mass = 1000');
  const plain = await settled();
  await page.eval('window.__player.pw.zoom = 60');
  const zoomed = await settled();
  assert.ok(Math.abs(zoomed.z / plain.z - 0.62) <= 0.02, `zoom power-up: ${(zoomed.z / plain.z).toFixed(3)}x`);
});
