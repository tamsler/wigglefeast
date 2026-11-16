// The Settings screen (#13): opening and closing it, remembering settings, bot names and graphics
// quality. Volume is tested with the rest of the audio in audio.test.js.
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const SETTINGS = 'JSON.parse(localStorage.getItem("wormarena.settings") || "null")';
const hidden = (page, id) => page.eval(`document.getElementById(${JSON.stringify(id)}).classList.contains('hidden')`);
const dbg = (page, expr) => page.eval(`window.wigglefeastDebug.${expr}`);
// Starts from stored settings (or none), as a browser that has played before.
async function open(opts, stored) {
  const page = await launch(opts);
  await page.goto(gameUrl());
  if (stored !== undefined) {
    await page.eval(`localStorage.removeItem('wormarena.world'); localStorage.setItem('wormarena.settings', ${JSON.stringify(JSON.stringify(stored))})`);
    await page.reload();
  }
  return page;
}

test('settings from before the Settings screen load with the new ones at their defaults (#13)', async (t) => {
  const page = await open({}, { name: 'Old', skin: 4, botCount: 40, difficulty: 'hard', mode: 'timed', theme: 'classic', sound: false, music: true });
  t.after(() => page.close());
  const s = await dbg(page, 'settings()');
  assert.deepEqual(
    [s.quality, s.botNames, s.volume, s.sfxVolume, s.musicVolume],
    ['high', true, 1, 1, 1], 'the new settings are at their defaults');
  assert.deepEqual([s.name, s.skin, s.botCount, s.difficulty, s.mode, s.theme, s.sound, s.music],
    ['Old', 4, 40, 'hard', 'timed', 'classic', false, true], 'every older setting is kept');
  await page.click('#openSettings');
  assert.equal(await page.eval(`document.querySelector('#qualityPick button.on').dataset.v`), 'high');
  assert.equal(await page.eval(`document.querySelector('#namesPick button.on').dataset.v`), 'on');
  assert.equal(await page.eval(`document.getElementById('volMaster').value`), '100');
  assert.equal(await page.eval(`document.getElementById('volMasterVal').textContent`), '100%');
});

test('a damaged setting falls back by itself and the game still starts (#13)', async (t) => {
  const page = await open({}, { name: 'Dam', botCount: 33, quality: 'ultra', botNames: 'yes', volume: 5, sfxVolume: -1, musicVolume: 0.25 });
  t.after(() => page.close());
  const s = await dbg(page, 'settings()');
  assert.deepEqual([s.quality, s.botNames, s.volume, s.sfxVolume], ['high', true, 1, 1], 'each bad value gets its default');
  assert.equal(s.musicVolume, 0.25, 'a good value next to bad ones is kept');
  assert.deepEqual([s.name, s.botCount], ['Dam', 33], 'older settings are kept');
  assert.deepEqual(page.exceptions, []);
  await page.startRun();
});

test('Settings opens from the menu and from the pause panel, and Back returns there (#13)', async (t) => {
  const page = await open({});
  t.after(() => page.close());

  await t.test('from the main menu', async () => {
    await page.eval(`document.getElementById('botCount').value = 55; document.getElementById('botCount').dispatchEvent(new Event('input'))`);
    await page.click('#openSettings');
    assert.equal(await hidden(page, 'settingsScreen'), false);
    assert.equal(await hidden(page, 'menu'), true);
    await page.click('#closeSettings');
    assert.equal(await hidden(page, 'settingsScreen'), true);
    assert.equal(await hidden(page, 'menu'), false);
    assert.equal(await page.eval(`document.getElementById('botCount').value`), '55', 'menu choices unchanged');
  });

  await t.test('from the pause panel, the run stays paused and unchanged', async () => {
    await page.startRun();
    await page.eval('window.__player.shield = 1e5');
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
    await page.eval('window.__player.mass = 321'); // after pausing, so a meal can't change it first
    const t0 = await page.eval('window.__game.time');
    await page.click('#pausedSettings');
    assert.equal(await hidden(page, 'paused'), true);
    assert.equal(await hidden(page, 'settingsScreen'), false);
    await page.click('#qualityPick button[data-v="low"]');
    await page.frames(10);
    assert.equal(await page.eval('window.__game.time'), t0, 'the world does not advance behind Settings');
    await page.click('#closeSettings');
    assert.equal(await hidden(page, 'paused'), false, 'the pause panel is back');
    assert.equal(await page.eval('window.__player.mass'), 321, 'same score');
    await page.click('#resume');
    await page.waitFor(`window.__game.time > ${t0}`, 'the run to continue');
  });

  await t.test('Esc and P close Settings and never resume the run', async () => {
    for (const code of ['Escape', 'KeyP']) {
      await page.press('KeyP');
      await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
      await page.click('#pausedSettings');
      if (code === 'Escape') {
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 });
      } else await page.press('KeyP');
      assert.equal(await hidden(page, 'settingsScreen'), true, `${code} closes Settings`);
      assert.equal(await hidden(page, 'paused'), false, 'back on the pause panel');
      assert.equal(await page.eval(`document.getElementById('hud').classList.contains('hidden')`), false);
      await page.click('#resume');
    }
  });

  await t.test('Esc closes Settings from a focused slider too', async () => {
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
    await page.click('#pausedSettings');
    await page.eval(`document.getElementById('volMaster').focus()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 });
    assert.equal(await hidden(page, 'settingsScreen'), true);
    assert.equal(await hidden(page, 'paused'), false, 'still paused');
    // The slider must not keep the keyboard: P would be swallowed and the run could not be resumed.
    assert.equal(await page.eval(`document.activeElement.id !== 'volMaster'`), true, 'the slider lost the focus');
    await page.press('KeyP');
    assert.equal(await hidden(page, 'paused'), true, 'P resumes the run straight away');
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause again');
  });

  await t.test('coming back from the back/forward cache with Settings open shows one panel', async () => {
    await page.click('#pausedSettings');
    assert.equal(await hidden(page, 'settingsScreen'), false);
    await page.eval(`window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
    await page.waitFor(`document.getElementById('settingsScreen').classList.contains('hidden')`, 'Settings to close', 5000);
    assert.equal(await hidden(page, 'paused'), false, 'the Welcome back panel is showing, alone');
    assert.equal(await page.eval(`document.getElementById('pausedTitle').textContent`), 'Welcome back!');
    // and Settings still opens and closes normally afterwards
    await page.click('#pausedSettings');
    await page.click('#closeSettings');
    assert.equal(await hidden(page, 'paused'), false);
  });

  await t.test('a window that loses the game hides Settings and writes nothing', async () => {
    await page.click('#pausedSettings');
    await page.eval(`window.__writes = []; const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { window.__writes.push(k); return set.call(this, k, v); }`);
    await page.eval(`localStorage.setItem('wormarena.session', JSON.stringify({ id: 'another-window', at: Date.now() }))`);
    await page.waitFor(`!document.getElementById('standby').classList.contains('hidden')`, 'the standby panel', 5000);
    assert.equal(await hidden(page, 'settingsScreen'), true, 'Settings is gone');
    await page.eval(`window.__writes.length = 0; document.querySelector('#qualityPick button[data-v="high"]').click()`);
    await page.frames(5);
    assert.deepEqual(await page.eval('window.__writes.filter((k) => k === "wormarena.settings")'), [], 'no settings written from standby');
  });
});

test('Show tips again is in Settings, not on the stats screen (#13)', async (t) => {
  const page = await open({});
  t.after(() => page.close());
  await page.click('#openStats');
  const stats = await page.eval(`[...document.querySelectorAll('#statsScreen .buttons button')].map((b) => b.id)`);
  assert.deepEqual(stats, ['exportSave', 'importSave', 'resetStats']);
  assert.equal(await page.eval(`!!document.querySelector('#statsScreen #showTips')`), false);
  await page.click('#closeStats');
  await page.click('#openSettings');
  assert.equal(await page.eval(`!!document.querySelector('#settingsScreen #showTips')`), true);
});

test('settings are saved at once and survive a reload (#13)', async (t) => {
  const page = await open({});
  t.after(() => page.close());
  await page.click('#openSettings');
  await page.click('#qualityPick button[data-v="low"]');
  await page.click('#namesPick button[data-v="off"]');
  await page.eval(`const m = document.getElementById('volMusic'); m.value = 30; m.dispatchEvent(new Event('input')); m.dispatchEvent(new Event('change'))`);
  const saved = await page.eval(SETTINGS);
  assert.deepEqual([saved.quality, saved.botNames, saved.musicVolume], ['low', false, 0.3], 'saved at once');
  await page.reload();
  const s = await dbg(page, 'settings()');
  assert.deepEqual([s.quality, s.botNames, s.musicVolume], ['low', false, 0.3], 'restored');
  await page.click('#openSettings');
  assert.equal(await page.eval(`document.querySelector('#qualityPick button.on').dataset.v`), 'low');
  assert.equal(await page.eval(`document.querySelector('#namesPick button.on').dataset.v`), 'off');
  assert.equal(await page.eval(`document.getElementById('volMusicVal').textContent`), '30%');
  assert.equal((await dbg(page, 'gfx()')).low, true, 'and Low graphics are on again');
});

// ---- Show bot names ------------------------------------------------------------------------------
// A bot a short way from the player, on screen. The game is paused first and the world arranged after,
// so that nothing moves, kills or dies in between (on a busy machine a run covers a lot in a second).
async function bringBot(page) {
  await page.eval('window.__player.shield = 1e5');
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
  await page.eval(`(() => {
    const g = window.__game, p = window.__player, b = g.worms.find((w) => w.ai && !w.dead);
    const dx = p.sx[0] + 220 - b.sx[0], dy = p.sy[0] - b.sy[0];
    b.sx = b.sx.map((x) => x + dx); b.sy = b.sy.map((y) => y + dy); b.updateBounds();
    window.__bot = b; b.kills = 3; b.name = 'Zork';
    b.mass = 1e6; g.updateLeaderboard(); // the biggest worm, so it is on the leaderboard (which lists the top 10)
  })()`);
  await page.frames(3);
}
const labels = (page) => dbg(page, 'namesDrawn()');

test('Show bot names off hides every bot label and nothing else (#13)', async (t) => {
  const page = await open({});
  t.after(() => page.close());
  await page.startRun('Hero');
  await bringBot(page);

  await t.test('on: bots are labelled, with their kill tag', async () => {
    const l = await labels(page);
    assert.ok(l.some((n) => n.label.startsWith('Zork') && /⚔\uFE0F?3/.test(n.label)), JSON.stringify(l.slice(0, 4)));
    assert.ok(l.some((n) => n.label === 'Hero'), 'and the player');
  });

  await t.test('a bot coming for you is red-orange', async () => {
    await page.eval('window.__bot.ai.retaliating = window.__player');
    await page.frames(3);
    assert.equal((await labels(page)).find((n) => n.label.startsWith('Zork')).color, '#ff5a1f');
  });

  await t.test('off: no bot has a name, a tag or a grudge colour; the player keeps theirs', async () => {
    await page.click('#pausedSettings');
    await page.click('#namesPick button[data-v="off"]');
    await page.click('#closeSettings');
    await page.frames(3);
    const l = await labels(page);
    assert.deepEqual(l.map((n) => n.label), ['Hero'], 'only the player is labelled');
    assert.equal(l[0].color, '#ffd60a', 'in the player colour');
  });

  await t.test('the leaderboard still lists the bot', async () => {
    await page.waitFor(`document.getElementById('lb').textContent.includes('Zork')`, 'the leaderboard to list the bot', 5000);
  });

  await t.test('on again: they come back at once, while paused', async () => {
    await page.click('#pausedSettings');
    await page.click('#namesPick button[data-v="on"]');
    await page.frames(3);
    assert.ok((await labels(page)).some((n) => n.label.startsWith('Zork') && /⚔\uFE0F?3/.test(n.label)));
    await page.click('#closeSettings');
  });
});

// ---- Graphics quality ----------------------------------------------------------------------------
// Pixels of the game canvas around (x, y) in world units, read back from the last drawn frame.
const patch = (page, x, y, rWorld) => page.eval(`(() => {
  const c = document.getElementById('game'), g = c.getContext('2d'), m = g.getTransform();
  const px = Math.round(m.a * ${x} + m.e), py = Math.round(m.d * ${y} + m.f), R = Math.round(m.a * ${rWorld});
  return Array.from(g.getImageData(px - R, py - R, 2 * R, 2 * R).data);
})()`);

test('graphics quality: Low draws less, High is as before (#13)', async (t) => {
  // A phone-sized screen at a device pixel ratio of 2.
  const page = await open({ width: 800, height: 600 }, { theme: 'classic' });
  t.after(() => page.close());
  await page.startRun('Hero');
  await page.eval(`(() => { const p = window.__player; p.shield = 1e5; p.mass = 400; })()`);
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
  // One red piece of food, 250 units to the side of the head (clear of the shielded worm, whose
  // see-through body pulses even while paused), and nothing else animated around it.
  const FOOD = `(() => { const g = window.__game, p = window.__player, a = p.angle + Math.PI / 2;
    g.food = [{ x: p.sx[0] + 250 * Math.cos(a), y: p.sy[0] + 250 * Math.sin(a), v: 2, r: 8, c: '#ff0000', life: Infinity, ph: 0, dead: false, natural: true }];
    g.powerups = []; g.specials = []; g.rebuildFoodGrid(); return [g.food[0].x, g.food[0].y]; })()`;
  const [fx, fy] = await page.eval(FOOD);
  await page.frames(3);
  const setQuality = async (v) => {
    await page.click('#pausedSettings');
    await page.click(`#qualityPick button[data-v="${v}"]`);
    await page.click('#closeSettings');
    await page.frames(3);
  };

  await t.test('High: food has its halo, bodies their highlight, canvas the full pixel ratio', async () => {
    const g = await dbg(page, 'gfx()');
    assert.equal(g.low, false);
    assert.ok(g.halos >= 1 && g.dots === 0, JSON.stringify(g));
    assert.ok(g.highlights >= 1 && g.ridges >= 1, `highlights ${g.highlights}, ridges ${g.ridges}`);
    assert.deepEqual(g.canvas, [800 * 2, 600 * 2], 'two canvas pixels per CSS pixel');
  });

  const halo = async () => {
    const withFood = await patch(page, fx, fy, 30);
    await page.eval(`window.__game.food = []; window.__game.rebuildFoodGrid()`);
    await page.frames(3);
    const without = await patch(page, fx, fy, 30);
    await page.eval(FOOD);
    await page.frames(3);
    return { withFood, without };
  };
  const ringDiffers = ({ withFood, without }) => {
    // The ring from 2.2 to 3 food radii out, where only the halo reaches; the dot itself ends at 1.3
    const side = Math.sqrt(withFood.length / 4), c = side / 2, scale = side / 60; // pixels per world unit
    let diff = 0;
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const d = Math.hypot(x - c, y - c) / scale / 8; // in food radii
      if (d < 2.2 || d > 3) continue;
      const i = (y * side + x) * 4;
      diff += Math.abs(withFood[i] - without[i]) + Math.abs(withFood[i + 1] - without[i + 1]) + Math.abs(withFood[i + 2] - without[i + 2]);
    }
    return diff;
  };

  await t.test('High: the halo tints the floor around the food', async () => {
    assert.ok(ringDiffers(await halo()) > 0, 'something is drawn around the dot');
  });

  await t.test('Low: a plain dot with no halo, bodies without a highlight, ridges and outline kept', async () => {
    await setQuality('low');
    const g = await dbg(page, 'gfx()');
    assert.equal(g.low, true);
    assert.ok(g.dots >= 1 && g.halos === 0, JSON.stringify(g));
    assert.equal(g.highlights, 0, 'no body highlight');
    assert.ok(g.ridges >= 1, 'ridges are still drawn');
    const { withFood, without } = await halo();
    assert.equal(ringDiffers({ withFood, without }), 0, 'nothing around the dot');
    // 6.5 world units out from the centre: inside the dot (it is about 9 to 12 units across its radius
    // as it pulses) and clear of its white centre, so the pixel is the food's own colour.
    const side = Math.sqrt(withFood.length / 4), at = (Math.round(side / 2) * side + Math.round(side / 2 + 6.5 * (side / 60))) * 4;
    assert.ok(withFood[at] > 200 && withFood[at + 1] < 60 && withFood[at + 2] < 60, `the dot itself is still food-coloured: rgb(${withFood[at]},${withFood[at + 1]},${withFood[at + 2]})`);
  });

  await t.test('Low: a quarter of the pixels on a screen with a pixel ratio of 2, at once', async () => {
    const g = await dbg(page, 'gfx()');
    assert.deepEqual(g.canvas, [800, 600]);
    assert.equal(g.dpr, 1);
    assert.equal(await page.eval(`document.getElementById('minimap').width`) <= 200, true);
  });

  await t.test('Low: the menu skin preview still has its highlight', async () => {
    await page.click('#endRun'); // from the pause panel, back to the menu
    await page.frames(5);
    assert.ok((await dbg(page, 'gfx()')).highlights >= 1, 'the preview worm is drawn in full');
  });

  await t.test('back to High: everything returns', async () => {
    await page.click('#openSettings');
    await page.click('#qualityPick button[data-v="high"]');
    await page.frames(3);
    assert.deepEqual((await dbg(page, 'gfx()')).canvas, [800 * 2, 600 * 2]);
    await page.click('#closeSettings');
  });
});

test('graphics quality: a screen with a pixel ratio of 1 draws the same size in both (#13)', async (t) => {
  const page = await open({ width: 1280, height: 720 }, { quality: 'low' });
  t.after(() => page.close());
  const low = (await dbg(page, 'gfx()')).canvas;
  await page.click('#openSettings');
  await page.click('#qualityPick button[data-v="high"]');
  assert.deepEqual((await dbg(page, 'gfx()')).canvas, low);
});

test('graphics quality changes nothing in the world (#13)', async (t) => {
  const page = await open({}, { theme: 'classic' });
  t.after(() => page.close());
  await page.startRun('Hero');
  await page.eval('window.__player.shield = 1e5');
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
  // savedAt is the clock time of the snapshot, not part of the world
  const world = () => page.eval('JSON.stringify({ ...window.__game.toJSON(), savedAt: 0 })');

  await t.test('switching while paused leaves the world exactly as it was', async () => {
    const before = await world();
    for (const v of ['low', 'high', 'low']) {
      await page.click('#pausedSettings');
      await page.click(`#qualityPick button[data-v="${v}"]`);
      await page.click('#closeSettings');
      await page.frames(2);
    }
    assert.equal(await world(), before);
  });

  for (const quality of ['high', 'low']) {
    await t.test(`${quality}: a head on a piece of food eats it, as in the other quality`, async () => {
      await page.click('#pausedSettings');
      await page.click(`#qualityPick button[data-v="${quality}"]`);
      await page.click('#closeSettings');
      await page.eval(`(() => { const g = window.__game, p = window.__player;
        if (!window.__counting) { window.__counting = true; g.on('eat', ({ worm }) => { if (worm === window.__player) window.__meals = (window.__meals || 0) + 1; }); }
        window.__meals = 0;
        g.food = [{ x: p.sx[0], y: p.sy[0], v: 5, r: 8, c: '#ff0000', life: Infinity, ph: 0, dead: false, natural: true }];
        g.foodTarget = 0; g.rebuildFoodGrid(); })()`);
      await page.click('#resume');
      await page.waitFor('window.__meals >= 1', 'the player to eat the food');
      await page.press('KeyP');
      await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
    });
  }

  await t.test('the engine knows nothing about drawing quality', async () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'engine.js'), 'utf8');
    assert.doesNotMatch(src, /quality|lowGfx|botNames/);
  });
});

// The point of Low graphics (#13): a slow device gets frames out faster. Headless Chrome has no GPU, so
// the canvas is filled in software, and CPU throttling (4x) makes it behave like a slow phone. On a
// screen with a pixel ratio of 2, Low fills a quarter of the pixels and skips the big halo sprites.
test('graphics quality: Low frames are measurably faster on a slow, sharp screen (#13)', async (t) => {
  const page = await open({ width: 800, height: 600 }, { botCount: 100, theme: 'classic' });
  t.after(() => page.close());
  await page.startRun('Bench');
  await page.eval('window.__player.shield = 1e6; window.__player.mass = 3000');
  await page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const median = () => page.eval(`new Promise((res) => {
    const ts = [], f = (t) => { ts.push(t); ts.length > 40 ? res(ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b)[20]) : requestAnimationFrame(f); };
    requestAnimationFrame(f);
  })`);
  const frame = async (q) => {
    await page.eval(`document.querySelector('#qualityPick button[data-v="${q}"]').click()`);
    await page.frames(5);
    return median();
  };
  // High, Low, High, Low: so that a machine that gets busier or quieter cannot make one look better.
  const high = [await frame('high')], low = [await frame('low')];
  high.push(await frame('high'));
  low.push(await frame('low'));
  const h = Math.min(...high), l = Math.min(...low);
  t.diagnostic(`median frame at 4x CPU throttle, pixel ratio 2: High ${h.toFixed(1)} ms, Low ${l.toFixed(1)} ms (${(h / l).toFixed(1)}x faster)`);
  assert.ok(l < h * 0.8, `Low ${l.toFixed(1)} ms is not clearly faster than High ${h.toFixed(1)} ms`);
});
