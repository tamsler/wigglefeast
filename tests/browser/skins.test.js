// Skin finishes and the skin picker (#58). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const KILLER = JSON.stringify({ v: 1, totals: { games: 1, kills: 1, time: 30, eaten: 10, best: 100, bestByDiff: { easy: 0, normal: 100, hard: 0 } }, top: [], recent: [] }); // has eaten a worm: First Bite unlocks Lavender (#14)
const NEW = ['Aurora', 'Sunset Drive', 'Synthwave', 'Toxic', 'Gold Rush', 'Chrome', 'Ladybug', 'Leopard', 'Viper', 'Galaxy', 'Magma', 'Abyss'];
// A cheap fingerprint of the arena canvas.
const HASH = `(() => { const c = document.getElementById('game'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; })()`;

test('skins', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());

  await t.test('the picker offers the 24 free skins, then the 6 rewards locked, drawn with their finish', async () => {
    const names = await page.eval(`[...document.querySelectorAll('#skins button')].map((b) => b.title)`);
    assert.equal(names.length, 30);
    assert.ok(NEW.every((n) => names.slice(0, 24).includes(n)), 'all free skins are offered first');
    assert.deepEqual(names.slice(24), ['Holo', 'Ghost', 'Inferno', 'Storm', 'Crystal', 'Galaxy Prime'], 'then the rewards (#14, #180)');
    const locked = await page.eval(`[...document.querySelectorAll('#skins button.locked')].map((b) => b.title)`);
    assert.deepEqual(locked, names.slice(24), 'rewards are locked on a fresh profile');
    assert.equal(await page.eval(`document.querySelectorAll('#skins button canvas').length`), 30, 'each swatch is a drawn canvas');
  });

  await t.test('picking Galaxy plays as Galaxy and is remembered', async () => {
    await page.click('#skins button[title="Galaxy"]');
    await page.startRun('Star');
    assert.equal(await page.eval('window.__player.skin.name'), 'Galaxy');
    await page.press('KeyP');
    await page.click('#endRun');
    await page.reload();
    assert.equal(await page.eval(`document.querySelector('#skins button.on').title`), 'Galaxy');
  });

  await t.test('a remembered Ghost still loads and plays once First Bite is earned', async () => {
    await page.eval(`localStorage.removeItem('wormarena.world'); localStorage.setItem('wormarena.profile', ${JSON.stringify(KILLER)});
      localStorage.setItem('wormarena.settings', JSON.stringify({ name: 'Old', skin: 8, botCount: 30, difficulty: 'normal' }))`);
    await page.reload();
    assert.equal(await page.eval(`document.getElementById('skinName').textContent`), 'Ghost');
    assert.equal(await page.eval(`document.querySelector('#skins button.on').title`), 'Ghost');
    await page.startRun('Old');
    assert.equal(await page.eval('window.__player.skin.name'), 'Ghost');
  });

  await t.test('every skin renders in the arena without errors', async () => {
    page.exceptions.length = 0;
    await page.eval(`{
      const g = window.__game, p = window.__player, E = window.WormEngine;
      Object.assign(p, { shield: 1e5 });
      g.worms = [p]; g.respawnQueue = []; g.settings.botCount = 0;
      E.SKINS.forEach((skin, k) => {
        const b = g.spawnBot(false);
        Object.assign(b, { skin, thinkT: 1e9, shield: 1e5, wantBoost: k % 2 === 0, mass: 200 });
        const x0 = p.x - 500 + (k % 6) * 180, y0 = p.y - 300 + Math.floor(k / 6) * 140;
        b.sx = b.sx.map((v, i) => x0 - i * 6); b.sy = b.sy.map(() => y0); b.angle = b.targetAngle = 0; b.updateBounds();
      });
    }`);
    await page.frames(30);
    assert.deepEqual(page.exceptions, []);
    assert.equal(await page.eval('window.__game.worms.length'), 1 + (await page.eval('window.WormEngine.SKINS.length')), 'all skins in the world');
  });

  await t.test('animated finishes freeze while paused (#58)', async () => {
    // Only a Magma worm and the player; no food, power-ups or special food (#143), which pulse on
    // real time (a special food in view made this flaky).
    await page.eval(`{
      const g = window.__game, p = window.__player;
      g.worms = [p, ...g.worms.filter((w) => w.skin.name === 'Magma')];
      Object.assign(g, { food: [], powerups: [], specials: [], foodTarget: 0, powerupTarget: 0, specialTarget: 0 }); g.rebuildFoodGrid();
      // These blink or pulse on real time and are not finishes: the shield, the boost arrows,
      // and the arena border (moved out of view).
      g.worms.forEach((w) => { w.shield = 0; w.wantBoost = false; w.boosting = false; });
      g.R = 1e6;
    }`);
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
    await page.eval(`document.getElementById('paused').classList.add('hidden')`); // keep the panel out of the pixels
    await page.frames(3);
    const a = await page.eval(HASH);
    await new Promise((r) => setTimeout(r, 400));
    await page.frames(3);
    assert.equal(await page.eval(HASH), a, 'nothing moves while paused');
  });
});

// Skin preview (#161): the selected skin on a wiggling worm under the Skin label.
test('skin preview', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const preview = () => page.eval('window.wigglefeastDebug.previewSkin()');
  const pixels = `(() => { const c = document.getElementById('skinPreview'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0; return h; })()`;

  await t.test('shows the remembered skin, then each picked skin straight away', async () => {
    await page.frames(2);
    assert.equal(await preview(), await page.eval(`document.getElementById('skinName').textContent`));
    await page.click('#skins button[title="Leopard"]');
    await page.frames(2);
    assert.equal(await preview(), 'Leopard');
    await page.click('#skins button[title="Chrome"]');
    await page.frames(2);
    assert.equal(await preview(), 'Chrome');
  });

  await t.test('wiggles, and holds still when the system asks for reduced motion', async () => {
    const a = await page.eval(pixels);
    await page.frames(10);
    assert.notEqual(await page.eval(pixels), a, 'the worm moves');
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await page.frames(2);
    const b = await page.eval(pixels);
    await page.frames(10);
    assert.equal(await page.eval(pixels), b, 'the worm holds still');
    await page.send('Emulation.setEmulatedMedia', { features: [] });
  });

  await t.test('a remembered, unlocked Ghost shows in the preview', async () => {
    await page.eval(`localStorage.removeItem('wormarena.world'); localStorage.setItem('wormarena.profile', ${JSON.stringify(KILLER)});
      localStorage.setItem('wormarena.settings', JSON.stringify({ name: 'Old', skin: 8, botCount: 30, difficulty: 'normal' }))`);
    await page.reload();
    await page.frames(2);
    assert.equal(await preview(), 'Ghost');
  });

  await t.test('is not drawn while playing', async () => {
    await page.startRun('Prev');
    await page.frames(2);
    const n = await page.eval('window.wigglefeastDebug.previewFrames()');
    await page.frames(10);
    assert.equal(await page.eval('window.wigglefeastDebug.previewFrames()'), n);
  });
});

// Reward skins (#180): six animated finishes that only rewards have.
const REWARDS = ['Holo', 'Ghost', 'Inferno', 'Storm', 'Crystal', 'Galaxy Prime'];
test('reward skins', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval(`window.__player.shield = 1e9`);
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
  await page.eval(`document.getElementById('paused').classList.add('hidden')`);
  // The player alone, straight, heading right, in the given skin; returns a row of pixels along its body.
  const bodyPixels = async (name) => {
    await page.eval(`(() => {
      const g = window.__game, p = window.__player, { radiusFor, SKINS } = window.WormEngine;
      Object.assign(g, { worms: [p], respawnQueue: [], food: [], powerups: [], specials: [] }); g.rebuildFoodGrid();
      p.skin = SKINS.find((s) => s.name === ${JSON.stringify(name)});
      p.mass = 500; p.r = radiusFor(500); p.shield = 0;
      p.sx = p.sx.map((_, i) => p.x - i * p.r * 0.42); p.sy = p.sy.map(() => p.y);
      p.angle = p.targetAngle = 0; p.updateBounds(); g.rebuildSegGrid();
    })()`);
    await page.frames(4);
    return page.eval(`(() => {
      const p = window.__player, c = document.getElementById('game'), g = c.getContext('2d'), m = g.getTransform();
      const x1 = Math.round(m.a * (p.x - 2 * p.r) + m.e), x0 = Math.round(m.a * (p.x - 7 * p.r) + m.e), y = Math.round(m.d * p.y + m.f);
      return Array.from(g.getImageData(x0, y - 6, x1 - x0, 12).data);
    })()`);
  };
  const chroma = (d) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) n++; return n; };

  await t.test('every reward draws a coloured body that differs from the others', async () => {
    const seen = new Set();
    for (const name of REWARDS) {
      const d = await bodyPixels(name);
      // Ghost is pale grey-cyan, so only the others must be colourful; all must differ from the bare floor.
      assert.ok(d.length > 0 && (name === 'Ghost' || chroma(d) > 20), `${name}: coloured pixels along the body`);
      seen.add(String(d.slice(0, 600)));
    }
    assert.equal(seen.size, REWARDS.length, 'six different looks');
  });

  await t.test('Ghost is see-through: much dimmer than a solid pale skin, but not dark', async () => {
    const mean = (a) => { let sum = 0; for (let i = 0; i < a.length; i += 4) sum += 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]; return sum / (a.length / 4); };
    const ghost = mean(await bodyPixels('Ghost')), crystal = mean(await bodyPixels('Crystal'));
    assert.ok(ghost < crystal * 0.95, `Ghost (${ghost.toFixed(0)}) is dimmer than the solid pale Crystal (${crystal.toFixed(0)})`);
    assert.ok(ghost > 60, `but it doesn't vanish (${ghost.toFixed(0)})`);
  });

  await t.test('no skin is drawn wider than its body outline: no glow around it (#190)', async () => {
    for (const name of await page.eval(`window.WormEngine.SKINS.map((s) => s.name)`)) {
      await bodyPixels(name);
      // The widest stroke the game draws in a few frames. The body is 2r wide and its outline 2r + 4;
      // a glow under the body would be wider and make the edge look like it was further out than it is.
      const { widest, limit } = await page.eval(`(async () => {
        const proto = CanvasRenderingContext2D.prototype, stroke = proto.stroke, p = window.__player;
        let widest = 0;
        proto.stroke = function (...a) { if (this.lineWidth > widest) widest = this.lineWidth; return stroke.apply(this, a); };
        try { for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r)); } finally { proto.stroke = stroke; }
        return { widest, limit: 2 * p.r + 4 };
      })()`);
      assert.ok(widest > 0 && widest <= limit + 0.01, `${name}: widest stroke ${widest.toFixed(1)}, the outline is ${limit.toFixed(1)}`);
    }
  });

  await t.test('animated rewards freeze while paused', async () => {
    for (const name of ['Inferno', 'Storm', 'Galaxy Prime', 'Holo']) {
      const a = await bodyPixels(name);
      await page.frames(10);
      const b = await page.eval(`(() => {
        const p = window.__player, c = document.getElementById('game'), g = c.getContext('2d'), m = g.getTransform();
        const x1 = Math.round(m.a * (p.x - 2 * p.r) + m.e), x0 = Math.round(m.a * (p.x - 7 * p.r) + m.e), y = Math.round(m.d * p.y + m.f);
        return Array.from(g.getImageData(x0, y - 6, x1 - x0, 12).data);
      })()`);
      assert.deepEqual(b, a, `${name} stands still while paused`);
    }
  });

  await t.test('each reward swatch shows its own finish, and locked ones are dimmed', async () => {
    const swatches = await page.eval(`(() => [...document.querySelectorAll('#skins button')].filter((b) => ${JSON.stringify(REWARDS)}.includes(b.title)).map((b) => {
      const c = b.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let h = 0; for (let i = 0; i < d.length; i += 11) h = (h * 31 + d[i]) | 0;
      return { title: b.title, hash: h, locked: b.classList.contains('locked') };
    }))()`);
    assert.equal(swatches.length, 6);
    assert.equal(new Set(swatches.map((s) => s.hash)).size, 6, 'six different swatches');
    assert.ok(swatches.every((s) => s.locked), 'locked on a fresh profile');
  });
});
