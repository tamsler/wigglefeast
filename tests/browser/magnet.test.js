// The magnet's field: forward waves, alternating blue and red (#103).
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl, sleep } = require('../helpers/browser');

const BLUE = '#4cc9f0', RED = '#ff4d6d', SPAN = (110 * Math.PI) / 180;

test('magnet field', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');
  // Record arcs on the game canvas (centre, radius, angles, stroke colour, alpha) and food sprites, in order.
  await page.eval(`(() => {
    const proto = CanvasRenderingContext2D.prototype, arc = proto.arc, img = proto.drawImage;
    window.__log = [];
    proto.arc = function (x, y, r, a0, a1, ...rest) {
      if (this.canvas.id === 'game') window.__log.push({ k: 'arc', x, y, r, a0, a1, color: this.strokeStyle, alpha: this.globalAlpha });
      return arc.call(this, x, y, r, a0, a1, ...rest);
    };
    proto.drawImage = function (...args) { if (this.canvas.id === 'game') window.__log.push({ k: 'img' }); return img.apply(this, args); };
    // Exactly one game frame, with the heads as that frame drew them: our first callback runs after
    // the frame queued before it, the second after the next one.
    window.__oneFrame = () => new Promise((resolve) => requestAnimationFrame(() => {
      window.__log.length = 0;
      requestAnimationFrame(() => {
        const [p, b] = window.__game.worms;
        resolve({ log: window.__log.slice(), p: [p.sx[0], p.sy[0], p.r, p.angle], b: b ? [b.sx[0], b.sy[0], b.r, b.angle] : null });
      });
    }));
  })()`);
  // The player and one bot, both on screen.
  await page.eval(`(() => {
    const g = window.__game, p = window.__player;
    const b = g.worms.find((w) => w.ai);
    const sp = b.r * 0.42;
    for (let i = 0; i < b.sx.length; i++) { b.sx[i] = p.x + 300 - i * sp; b.sy[i] = p.y + 200; }
    b.updateBounds();
    g.worms = [p, b];
  })()`);
  const frame = async (player, bot) => {
    await page.eval(`(() => { const [p, b] = window.__game.worms; p.pw.magnet = ${player}; if (b) b.pw.magnet = ${bot}; })()`);
    return page.eval('window.__oneFrame()');
  };
  // Field waves around a head: arcs centred there, about 110 degrees, in a field colour, outside the head.
  const waves = (log, [x, y, r]) => log.filter((e) => e.k === 'arc' && Math.abs(e.a1 - e.a0 - SPAN) < 1e-6 &&
    (e.color === BLUE || e.color === RED) && Math.hypot(e.x - x, e.y - y) < 0.5 && e.r > r);
  const pullRange = (r) => 2.2 * r + 24 + 230;

  await t.test("forward waves from the player's head, alternating blue and red, within the pull range", async () => {
    const f = await frame(10, 0);
    const w = waves(f.log, f.p).sort((a, b) => a.r - b.r);
    assert.ok(w.length >= 2, `${w.length} waves`);
    for (const e of w) {
      assert.ok(Math.abs(((e.a0 + e.a1) / 2) - f.p[3]) < 1e-6, 'centred on the heading (in front)');
      assert.ok(e.r <= pullRange(f.p[2]) + 0.5, `within the pull range: ${e.r.toFixed(0)}`);
    }
    for (let i = 1; i < w.length; i++) assert.notEqual(w[i].color, w[i - 1].color, 'consecutive waves alternate colour');
    assert.ok(!f.log.some((e) => e.k === 'arc' && (e.color === BLUE || e.color === RED) && Math.hypot(e.x - f.p[0], e.y - f.p[1]) < 0.5 && e.a1 - e.a0 >= 2 * Math.PI - 1e-6), 'no full circle');
  });

  await t.test('no field without a magnet', async () => {
    const f = await frame(0, 0);
    assert.equal(waves(f.log, f.p).length, 0);
    assert.equal(waves(f.log, f.b).length, 0);
  });

  await t.test("a bot's field is fainter than the player's", async () => {
    const f = await frame(10, 10);
    const pa = Math.max(...waves(f.log, f.p).map((e) => e.alpha)), ba = Math.max(...waves(f.log, f.b).map((e) => e.alpha));
    assert.ok(ba > 0 && ba < pa * 0.75, `bot ${ba.toFixed(2)} vs player ${pa.toFixed(2)}`);
  });

  await t.test('it fades over the last 3 seconds', async () => {
    const full = Math.max(...waves((await frame(10, 0)).log, (await frame(10, 0)).p).map((e) => e.alpha));
    const g = await frame(1, 0);
    const ending = Math.max(...waves(g.log, g.p).map((e) => e.alpha));
    assert.ok(ending < full * 0.5, `with 1 s left ${ending.toFixed(2)} vs ${full.toFixed(2)}`);
  });

  await t.test('it is still while paused', async () => {
    const a = await frame(10, 0);
    await sleep(200);
    const b = await frame(10, 0);
    assert.equal(waves(b.log, b.p).map((e) => e.r.toFixed(3)).join(), waves(a.log, a.p).map((e) => e.r.toFixed(3)).join());
  });

  await t.test('it is drawn before (under) food', async () => {
    const f = await frame(10, 10);
    const isWave = (e) => e.k === 'arc' && Math.abs(e.a1 - e.a0 - SPAN) < 1e-6 && (e.color === BLUE || e.color === RED);
    const firstFood = f.log.findIndex((e) => e.k === 'img'), lastWave = f.log.reduce((m, e, i) => (isWave(e) ? i : m), -1);
    assert.ok(firstFood > 0 && lastWave >= 0 && lastWave < firstFood, `last wave at ${lastWave}, first food at ${firstFood}`);
  });

  await t.test('it moves while the game runs', async () => {
    await page.press('KeyP'); // resume
    const a = await frame(10, 0);
    await sleep(200);
    const b = await frame(10, 0);
    const ra = waves(a.log, a.p).map((e) => e.r.toFixed(2)).join(), rb = waves(b.log, b.p).map((e) => e.r.toFixed(2)).join();
    assert.ok(ra.length > 0 && rb.length > 0, 'waves are drawn while running');
    assert.notEqual(rb, ra, 'and they move');
  });
});
