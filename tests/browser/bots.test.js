// Bot count range (#81). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

test('bot count', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const withSettings = async (s) => {
    await page.eval(`localStorage.removeItem('wormarena.world'); localStorage.setItem('wormarena.settings', ${JSON.stringify(JSON.stringify(s))})`);
    await page.reload();
  };

  await t.test('the slider goes up to 150, and 150 bots start a 150-bot world that survives a reload', async () => {
    assert.equal(await page.eval(`document.getElementById('botCount').max`), '150');
    await page.eval(`(() => { const s = document.getElementById('botCount'); s.value = 150; s.dispatchEvent(new Event('input')); })()`);
    assert.equal(await page.eval(`document.getElementById('botCountVal').textContent`), '150');
    await page.startRun();
    assert.equal(await page.eval('window.__game.settings.botCount'), 150);
    // Bots that died in the first moments wait 1-3 s to respawn: living + queued is the target.
    assert.equal(await page.eval('window.__game.worms.filter((w) => w.ai).length + window.__game.respawnQueue.length'), 150);
    await page.press('KeyP');
    await page.click('#endRun');
    await page.reload();
    assert.equal(await page.eval(`document.getElementById('botCount').value`), '150');
    assert.equal(JSON.parse(await page.eval(`localStorage.getItem('wormarena.settings')`)).botCount, 150);
  });

  // Engine time per frame and frame intervals over 3 s at each size. Headless Chrome draws in
  // software, so these are loose smoke limits; the numbers are printed for the PR, and a phone
  // playtest decides the real limit (#81).
  await t.test('frame times stay reasonable at 30, 60 and 150 bots', async (st) => {
    for (const botCount of [30, 60, 150]) {
      await withSettings({ name: 'A', skin: 0, botCount, difficulty: 'expert' });
      await page.startRun();
      await page.eval('window.__player.shield = 1e9');
      // At 150 every worm also has a magnet, so the magnet fields' drawing cost is in the worst case (#103).
      if (botCount === 150) await page.eval('window.__game.worms.forEach((w) => { w.pw.magnet = 16; })');
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
          resolve({ engine: engine / frames.length, p50: frames[frames.length >> 1], p95: frames[Math.floor(frames.length * 0.95)], frames: frames.length });
        };
        requestAnimationFrame(tick);
      })`);
      st.diagnostic(`${botCount} bots${botCount === 150 ? ', all with magnets' : ''}: engine ${m.engine.toFixed(2)} ms/frame, frame p50 ${m.p50.toFixed(1)} ms, p95 ${m.p95.toFixed(1)} ms (${m.frames} frames)`);
      assert.ok(m.engine < 12, `${botCount} bots: engine ${m.engine.toFixed(2)} ms per frame`);
      assert.ok(m.p50 < 50, `${botCount} bots: median frame ${m.p50.toFixed(1)} ms`);
      await page.press('KeyP');
      await page.click('#endRun');
    }
  });

  await t.test('a stored bot count above 150 falls back to 30', async () => {
    await withSettings({ name: 'A', skin: 0, botCount: 151, difficulty: 'normal' });
    assert.equal(await page.eval(`document.getElementById('botCount').value`), '30');
  });
});
