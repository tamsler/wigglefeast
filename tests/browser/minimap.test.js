// The minimap is a density map of other worms, not individual worms (#80, #91). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl, sleep } = require('../helpers/browser');

// Runs in the page: pixel helpers for the minimap, in world coordinates.
const HELPERS = `(() => {
  const mini = document.getElementById('minimap');
  const at = (x, y) => {
    const s = mini.width, c = s / 2, k = (c - 4) / window.__game.R;
    const px = Math.round(c + x * k), py = Math.round(c + y * k);
    const d = mini.getContext('2d').getImageData(px - 2, py - 2, 5, 5).data;
    const sum = [0, 0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 4; j++) sum[j] += d[i + j];
    return sum.map((v) => v / 25);
  };
  // Lays a worm's whole body in a small cluster around (x, y), head first at (x, y).
  const place = (w, x, y, spread) => {
    for (let i = 0; i < w.sx.length; i++) {
      const a = i * 2.39996, r = i === 0 ? 0 : spread * Math.sqrt(i / w.sx.length);
      w.sx[i] = x + Math.cos(a) * r; w.sy[i] = y + Math.sin(a) * r;
    }
    w.updateBounds();
  };
  window.__mini = { at, place };
})()`;

test('minimap shows density', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.press('KeyP'); // paused: nothing moves, the minimap keeps drawing
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');
  await page.eval(HELPERS);
  // Crowd every bot except the biggest into the (+, +) quadrant; the biggest alone in (+, -);
  // the player in (-, +) with its own large body clustered beside it; (-, -) stays empty.
  const setup = await page.eval(`(() => {
    const g = window.__game, R = g.R, p = window.__player, { place } = window.__mini;
    const bots = g.worms.filter((w) => w.ai).sort((a, b) => b.mass - a.mass);
    const big = bots[0];
    for (const w of bots.slice(1)) { w.mass = Math.min(w.mass, 200); w.r = 12; } // the starting giants would lead and smear the shading (#204); paused, so the radius is set by hand
    big.mass = 20000; big.r = 50;
    g.updateLeaderboard();
    bots.slice(1).forEach((w) => place(w, R * 0.5, R * 0.5, 500));
    place(big, R * 0.5, -R * 0.5, 150);
    p.mass = 5000; p.r = 37;
    while (p.sx.length < 200) { p.sx.push(0); p.sy.push(0); }
    place(p, -R * 0.5, R * 0.5, 0);
    for (let i = 1; i < p.sx.length; i++) { p.sx[i] = -R * 0.5 + (i % 10) * 20; p.sy[i] = R * 0.5 + 900 + Math.floor(i / 10) * 20; }
    return { R, leader: g.leaderboard[0] === big };
  })()`);
  assert.ok(setup.leader, 'the moved bot leads the leaderboard');
  const R = setup.R;
  // Frames are being drawn again once the player's red-orange dot shows at its new spot; then
  // wait out the 250 ms shading refresh.
  await page.waitFor(`(() => { const m = window.__mini.at(${-R * 0.5}, ${R * 0.5}); return m[0] > 200 && m[1] < 140 && m[2] < 80; })()`, 'the minimap to redraw');
  await sleep(400);
  const px = (x, y) => page.eval(`window.__mini.at(${x}, ${y})`);
  const empty = await px(-R * 0.5, -R * 0.5);
  const crowd = await px(R * 0.5 + 300, R * 0.5); // among the bodies, away from the heads at the centre

  await t.test('a crowded area is clearly shaded, an empty one is not', () => {
    assert.ok(crowd[3] > empty[3] + 60, `alpha crowded ${crowd[3].toFixed(0)} vs empty ${empty[3].toFixed(0)}`);
    assert.ok(crowd[2] > empty[2] + 60, 'and visibly lighter');
  });

  // Every shaded pixel lies between the minimap's dark disc and the one shading colour.
  const onShadingLine = ([r, g, b]) => {
    const f = (g - 14) / (220 - 14);
    return Math.abs(r - (10 + f * 117)) < 16 && Math.abs(b - (30 + f * 225)) < 16;
  };

  await t.test('shading is one colour, with no worm colours', () => {
    assert.ok(onShadingLine(crowd), `crowd pixel ${crowd.map((v) => v.toFixed(0))}`);
  });

  await t.test('the biggest worm alone gets no marker, only the same shading', async () => {
    const head = await px(R * 0.5, -R * 0.5);
    assert.ok(head[3] > empty[3] + 20, 'its body still shows as shading');
    assert.ok(onShadingLine(head), `pixel at its head ${head.map((v) => v.toFixed(0))} is shading, not a marker`);
  });

  await t.test("the player's own body adds no shading, and the player shows as a red-orange dot", async () => {
    const body = await px(-R * 0.5 + 90, R * 0.5 + 1000);
    assert.ok(Math.abs(body[3] - empty[3]) < 10, `alpha at the player's body ${body[3].toFixed(0)} vs empty ${empty[3].toFixed(0)}`);
    const dot = await px(-R * 0.5, R * 0.5);
    assert.ok(dot[0] > 200 && dot[1] > 50 && dot[1] < 140 && dot[2] < 80, `the player dot is red-orange (${dot.map((v) => v.toFixed(0))})`);
  });

  await t.test('two crowds about 900 units apart show a clear gap between them (#91)', async () => {
    // Regroup the crowd into two tight clusters in the empty quadrant, 900 units apart.
    const cx = -R * 0.5, cy = -R * 0.5;
    await page.eval(`(() => {
      const g = window.__game, { place } = window.__mini;
      const bots = g.worms.filter((w) => w.ai).sort((a, b) => b.mass - a.mass).slice(1);
      bots.forEach((w, i) => place(w, ${cx} + (i % 2 ? 450 : -450), ${cy}, 150));
    })()`);
    await sleep(400); // past the 250 ms refresh
    const left = await px(cx - 450, cy), right = await px(cx + 450, cy), gap = await px(cx, cy);
    assert.ok(left[3] > gap[3] + 40 && right[3] > gap[3] + 40, `crowds ${left[3].toFixed(0)} / ${right[3].toFixed(0)} vs gap ${gap[3].toFixed(0)}`);
  });
});
