// The magnet's red and blue field (#103). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl, sleep } = require('../helpers/browser');

const RED = '#ff4d6d', BLUE = '#4cc9f0';

test('magnet field', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');
  // Record arcs drawn on the game canvas with their stroke colour and alpha, and food sprites, in order.
  await page.eval(`(() => {
    const proto = CanvasRenderingContext2D.prototype, arc = proto.arc, img = proto.drawImage;
    window.__log = [];
    proto.arc = function (x, y, r, a0, a1, ...rest) {
      if (this.canvas.id === 'game') window.__log.push({ k: 'arc', x, y, r, span: a1 - a0, color: this.strokeStyle, alpha: this.globalAlpha });
      return arc.call(this, x, y, r, a0, a1, ...rest);
    };
    proto.drawImage = function (...args) { if (this.canvas.id === 'game') window.__log.push({ k: 'img' }); return img.apply(this, args); };
  })()`);
  // The player and one bot, a few hundred units apart, both on screen; their magnets set per check.
  const setup = await page.eval(`(() => {
    const g = window.__game, p = window.__player;
    const b = g.worms.find((w) => w.ai);
    const sp = b.r * 0.42;
    for (let i = 0; i < b.sx.length; i++) { b.sx[i] = p.x + 300 - i * sp; b.sy[i] = p.y + 200; }
    b.updateBounds();
    g.worms = [p, b];
    return { p: [p.x, p.y, p.r, 2.2 * p.r + 24 + window.WormEngine.CFG.MAGNET_REACH], b: [b.sx[0], b.sy[0]] };
  })()`);
  // One frame's field rings around a head: half-circle arcs centred there, in the field colours,
  // outside the head (the glow is a full circle and doesn't count).
  const frame = async (player, bot) => {
    await page.eval(`(() => { const g = window.__game, [p, b] = g.worms; p.pw.magnet = ${player}; b.pw.magnet = ${bot}; window.__log.length = 0; })()`);
    await page.frames(2);
    await page.eval('window.__log.length = 0');
    await page.frames(1);
    return page.eval('window.__log');
  };
  const rings = (log, [x, y], r) => log.filter((e) => e.k === 'arc' && Math.abs(e.span - Math.PI) < 1e-6 && (e.color === RED || e.color === BLUE) && Math.hypot(e.x - x, e.y - y) < 0.5 && e.r > (r || 0));
  const [px, py, pr, reach] = setup.p;

  await t.test("red and blue rings around the player's head, within the pull range", async () => {
    const r = rings(await frame(10, 0), [px, py], pr);
    assert.ok(r.some((e) => e.color === RED) && r.some((e) => e.color === BLUE), `both colours (${r.length} rings)`);
    assert.ok(r.every((e) => e.r <= reach + 0.5), `none beyond the food pull range ${reach.toFixed(0)}: ${Math.max(...r.map((e) => e.r)).toFixed(0)}`);
  });

  await t.test('no field without a magnet', async () => {
    const log = await frame(0, 0);
    assert.equal(rings(log, [px, py], pr).length, 0);
    assert.equal(rings(log, setup.b).length, 0);
  });

  await t.test("a bot's field is fainter than the player's", async () => {
    const log = await frame(10, 10);
    const pa = Math.max(...rings(log, [px, py], pr).map((e) => e.alpha)), ba = Math.max(...rings(log, setup.b).map((e) => e.alpha));
    assert.ok(ba > 0 && ba < pa * 0.75, `bot ${ba.toFixed(2)} vs player ${pa.toFixed(2)}`);
  });

  await t.test('it fades over the last 3 seconds', async () => {
    const full = Math.max(...rings(await frame(10, 0), [px, py], pr).map((e) => e.alpha));
    const ending = Math.max(...rings(await frame(1, 0), [px, py], pr).map((e) => e.alpha));
    assert.ok(ending < full * 0.5, `with 1 s left ${ending.toFixed(2)} vs ${full.toFixed(2)}`);
  });

  await t.test('it is still while paused', async () => {
    const a = rings(await frame(10, 0), [px, py], pr).map((e) => e.r.toFixed(3)).join();
    await sleep(200);
    const b = rings(await frame(10, 0), [px, py], pr).map((e) => e.r.toFixed(3)).join();
    assert.equal(b, a);
  });

  await t.test('it is drawn before (under) food', async () => {
    const log = await frame(10, 10);
    const isRing = (e) => e.k === 'arc' && Math.abs(e.span - Math.PI) < 1e-6 && (e.color === RED || e.color === BLUE);
    const firstFood = log.findIndex((e) => e.k === 'img'), lastRing = log.reduce((m, e, i) => (isRing(e) ? i : m), -1);
    assert.ok(firstFood > 0 && lastRing >= 0 && lastRing < firstFood, `last ring at ${lastRing}, first food at ${firstFood}`);
  });

  await t.test('it moves while the game runs', async () => {
    await page.press('KeyP'); // resume
    // Ring radii around wherever the player's head is now, in two frames a moment apart.
    const radii = async () => {
      const log = await frame(10, 0);
      const head = await page.eval('[window.__player.sx[0], window.__player.sy[0]]');
      return rings(log, head, 0).map((e) => e.r.toFixed(2)).join();
    };
    const a = await radii();
    await sleep(200);
    const b = await radii();
    assert.ok(a.length > 0 && b.length > 0, 'rings are drawn while running');
    assert.notEqual(b, a, 'and they move');
  });
});
