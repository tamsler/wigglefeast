// How worms look (#161): a ridged round body and big eyes whose pupils follow steering.
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

// Lays the player alone, straight and heading right, in a single-colour skin, with the game paused
// so nothing moves. Returns its head position and radius.
const LAY = `(() => {
  const g = window.__game, p = window.__player, { radiusFor } = window.WormEngine;
  Object.assign(g, { worms: [p], respawnQueue: [], food: [], powerups: [], specials: [] }); g.rebuildFoodGrid();
  p.skin = { name: 'Test blue', finish: 'stripes', colors: ['#3a86ff'], accent: '#3a86ff', food: ['#3a86ff'], hidden: true };
  p.mass = 400; p.r = radiusFor(400); p.shield = 0; p.boosting = false;
  p.sx = p.sx.map((_, i) => p.x - i * p.r * 0.42); p.sy = p.sy.map(() => p.y);
  p.angle = p.targetAngle = 0; p.updateBounds(); g.rebuildSegGrid();
  return { x: p.x, y: p.y, r: p.r, n: p.sx.length };
})()`;

test('worm look', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');
  await page.eval(`document.getElementById('paused').classList.add('hidden')`); // keep the panel out of the pixels
  const p = await page.eval(LAY);
  await page.frames(5);

  await t.test('the body shows a ridge at every segment', async () => {
    // Luminance along the centreline, from behind the eyes back 10 radii (or the body's end).
    const len = Math.min(10, (p.n - 1) * 0.42 - 1.5);
    const r = await page.eval(`(() => {
      const c = document.getElementById('game'), g = c.getContext('2d'), m = g.getTransform();
      const { x, y, r } = ${JSON.stringify(p)};
      const x1 = Math.round(m.a * (x - 1.5 * r) + m.e), x0 = Math.round(m.a * (x - (1.5 + ${len}) * r) + m.e);
      const d = g.getImageData(x0, Math.round(m.d * y + m.f), x1 - x0, 1).data, lum = [];
      for (let i = 0; i < d.length; i += 4) lum.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      return { lum, spacing: 0.42 * r * m.a };
    })()`);
    // Count dips: runs of pixels well below the brightest nearby pixels.
    const top = Math.max(...r.lum);
    let dips = 0, inDip = false;
    for (const v of r.lum) {
      const low = v < top - 12;
      if (low && !inDip) dips++;
      inDip = low;
    }
    const expected = r.lum.length / r.spacing;
    assert.ok(r.spacing >= 4, `ridges ${r.spacing.toFixed(1)} px apart, wide enough to see`);
    assert.ok(dips >= expected * 0.7 && dips <= expected * 1.3, `${dips} ridges over ${r.lum.length} px, expected about ${expected.toFixed(0)}`);
  });

  await t.test('a see-through skin has no dark outline under it (#187)', async () => {
    // The outline is a dark stroke 4 units wider than the body. Count the frames' strokes that match.
    const outlines = (skin) => page.eval(`(async () => {
      const { SKINS } = window.WormEngine, p = window.__player;
      p.skin = ${skin ? 'SKINS.find((s) => s.name === ' + JSON.stringify(skin) + ')' : '{ name: "Test blue", finish: "stripes", colors: ["#3a86ff"], accent: "#3a86ff", food: ["#3a86ff"], hidden: true }'};
      const proto = CanvasRenderingContext2D.prototype, stroke = proto.stroke;
      let count = 0;
      proto.stroke = function (...a) {
        if (/^rgba\\(0, 0, 0, 0\\.5\\)$/.test(this.strokeStyle) && Math.abs(this.lineWidth - (2 * p.r + 4)) < 0.01) count++;
        return stroke.apply(this, a);
      };
      try { for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r)); } finally { proto.stroke = stroke; }
      return count;
    })()`);
    assert.ok(await outlines(null) > 0, 'a solid skin is drawn on its outline');
    assert.equal(await outlines('Ghost'), 0, 'Ghost has none');
  });

  await t.test('the pupils look where the worm steers', async () => {
    // Heading right; eye centres sit 0.34 r ahead of the head and 0.4 r to each side. A point
    // 0.25 r above or below an eye's centre (0.1 r forward, clear of the glint) is pupil when the
    // worm steers that way, and white of the eye when it steers the other way.
    const lums = (look) => page.eval(`(async () => {
      window.__player.targetAngle = ${look};
      for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
      const c = document.getElementById('game'), g = c.getContext('2d'), m = g.getTransform();
      const { x, y, r } = ${JSON.stringify(p)};
      const lum = (wx, wy) => { const d = g.getImageData(Math.round(m.a * wx + m.e), Math.round(m.d * wy + m.f), 1, 1).data; return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]; };
      const out = [];
      for (const side of [-1, 1]) { const cx = x + 0.44 * r, cy = y + side * 0.4 * r; out.push({ up: lum(cx, cy - 0.25 * r), down: lum(cx, cy + 0.25 * r) }); }
      return out;
    })()`);
    for (const e of await lums(-Math.PI / 2)) assert.ok(e.up < 80 && e.down > 180, `steering up: pupil above (lum ${e.up.toFixed(0)}), white below (${e.down.toFixed(0)})`);
    for (const e of await lums(Math.PI / 2)) assert.ok(e.down < 80 && e.up > 180, `steering down: pupil below (lum ${e.down.toFixed(0)}), white above (${e.up.toFixed(0)})`);
  });
});
