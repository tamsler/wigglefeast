// Sound effects and music (#9). Headless Chrome can't be listened to, so these tests read the
// audio module's log of what actually played, and its state. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const STATE = 'window.WormAudio.state()';
const LOG = 'window.WormAudio.log().map((e) => e.name)';

// The audio log keeps only the newest 50 entries, so "how many were there before" plus slice() goes
// wrong once it is full (#216). Mark the time instead, and ask for what was logged since.
const mark = (page) => page.eval('performance.now()');
const since = (page, m) => page.eval(`window.WormAudio.log().filter((e) => e.at >= ${m}).map((e) => e.name)`);

test('audio module', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());

  await t.test('silent and locked until unlocked', async () => {
    const s = await page.eval(STATE);
    assert.equal(s.available, true);
    assert.equal(s.unlocked, false);
    await page.eval(`window.WormAudio.play('powerup')`);
    assert.deepEqual(await page.eval(LOG), [], 'nothing plays before an unlock');
  });

  await t.test('after unlocking, sounds play and are logged', async () => {
    await page.eval('window.WormAudio.unlock()');
    assert.equal((await page.eval(STATE)).unlocked, true);
    await page.eval(`window.WormAudio.play('powerup')`);
    assert.deepEqual((await page.eval(LOG)).slice(-1), ['powerup']);
  });

  await t.test('at most 12 eating pops per second', async () => {
    // A frozen clock, so a slow machine can't refill the allowance in the middle of the loop (#216).
    const pops = (advance) => page.eval(`(() => {
      const real = performance.now.bind(performance), t = real() + ${advance};
      performance.now = () => t;
      try {
        const m = t;
        for (let i = 0; i < 40; i++) window.WormAudio.play('eat', { size: 0.2 });
        return window.WormAudio.log().filter((e) => e.at >= m && e.name === 'eat').length;
      } finally { performance.now = real; }
    })()`);
    // Leaves the page's eat clock a second ahead, so keep this the last test on this page.
    assert.equal(await pops(0), 12, 'a full second of pops at once');
    assert.equal(await pops(1000), 12, 'and a second later, another 12');
  });
});

// Review of #172: the first real gesture can come while the game is quiet (here: paused); audio
// must then start suspended, and run once the game resumes.
test('unlocking while quiet stays quiet', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun(); // element.click(): no real gesture, so audio is still locked
  await page.click('#pauseBtn');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
  await page.waitFor('window.WormAudio.state().quiet', 'quiet while paused');
  assert.equal((await page.eval('window.WormAudio.state()')).unlocked, false);
  const [x, y] = await page.center('#pausedTitle');
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  assert.equal((await page.eval('window.WormAudio.state()')).unlocked, true);
  await page.waitFor(`window.WormAudio.state().context === 'suspended'`, 'audio created suspended while paused');
  await page.click('#resume');
  await page.waitFor(`window.WormAudio.state().context === 'running'`, 'audio running after resume');
});

test('no Web Audio: the game still plays, silently', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: 'delete window.AudioContext; delete window.webkitAudioContext;' });
  await page.goto(gameUrl());
  page.exceptions.length = 0;
  await page.startRun();
  await page.frames(30);
  await page.eval(`window.WormAudio.unlock(); window.WormAudio.play('kill'); window.WormAudio.boost(true); window.WormAudio.music(true)`);
  await page.frames(10);
  assert.deepEqual(page.exceptions, []);
  const s = await page.eval(STATE);
  assert.equal(s.available, false);
  assert.equal(s.unlocked, false);
  assert.deepEqual(await page.eval(LOG), []);
});

// #9: the player's actions make sounds; bots stay silent; music follows the run.
test('sounds follow the game', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const sounds = () => page.eval('window.wigglefeastDebug.sounds()');
  const state = () => page.eval('window.wigglefeastDebug.audioState()');
  // What got logged while running fn.
  const during = async (fn) => {
    const m = await mark(page);
    await fn();
    await page.frames(3);
    return since(page, m);
  };

  await t.test('the first real click unlocks audio; Play swooshes', async () => {
    assert.equal((await state()).unlocked, false);
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 });
    assert.equal((await state()).unlocked, true);
    const got = await during(() => page.startRun());
    assert.ok(got.includes('start'), `start swoosh: ${got}`);
    await page.eval('window.__player.shield = 1e9');
  });

  // #216: the sound log keeps only the newest 50, and a busy run on a slow machine fills it. The
  // checks below must still see every new sound then.
  await t.test('a full sound log still shows new sounds', async () => {
    await page.eval(`for (let i = 0; i < 60; i++) window.WormAudio.play('powerup')`);
    assert.equal((await sounds()).length, 50, 'the log is full');
    const got = await during(() => page.eval(`window.WormAudio.play('special')`));
    assert.deepEqual(got.filter((n) => n === 'special'), ['special']);
  });

  await t.test('music plays during the run', async () => {
    await page.waitFor('window.wigglefeastDebug.audioState().musicPlaying', 'music');
  });

  await t.test('eating food pops', async () => {
    const m = await mark(page);
    await page.eval(`(() => {
      const g = window.__game, p = window.__player;
      g.food.push({ x: p.sx[0], y: p.sy[0], v: 2, r: 5, c: '#fff', life: Infinity, ph: 0, dead: false, natural: true });
      g.rebuildFoodGrid();
    })()`);
    // Wait for it rather than a fixed number of frames: a busy machine may need a few more.
    await page.waitFor(`window.WormAudio.log().some((e) => e.at >= ${m} && e.name === 'eat')`, 'eating pop', 5000);
  });

  await t.test('power-ups, special food and kills', async () => {
    let got = await during(() => page.eval(`window.__game.emit('powerup', { worm: window.__player, type: 'magnet' })`));
    assert.ok(got.includes('powerup'), `powerup: ${got}`); // the worm may eat food meanwhile
    got = await during(() => page.eval(`window.__game.emit('special', { worm: window.__player, kind: 'nova', value: 25 })`));
    assert.ok(got.includes('special'), `special: ${got}`);
    got = await during(() => page.eval(`(() => { const g = window.__game, b = g.worms.find((w) => w.ai && !w.dead); g.kill(b, window.__player, 'body'); })()`));
    assert.ok(got.includes('kill'), `kill: ${got}`);
  });

  await t.test('bots make no sound', async () => {
    // The kill above earned First Bite (#14); let its fanfare play before listening.
    await page.waitFor(`window.wigglefeastDebug.toasts().includes('firstbite')`, 'First Bite fanfare');
    // The mark is taken in the same synchronous step that clears the food, so no frame can run
    // between them and let the player eat something and log a pop of its own (#216).
    const m = await page.eval(`(() => {
      const g = window.__game, b = g.worms.find((w) => w.ai && !w.dead);
      // So the player eats and picks up nothing meanwhile.
      Object.assign(g, { food: [], foodTarget: 0, powerups: [], powerupTarget: 0, specials: [], specialTarget: 0 }); g.rebuildFoodGrid();
      const m = performance.now();
      g.emit('eat', { worm: b, r: 5 });
      g.emit('powerup', { worm: b, type: 'magnet' });
      g.emit('special', { worm: b, kind: 'nova', value: 25 });
      b.boosting = true;
      b.sx = b.sx.map((x) => x + 5000); b.updateBounds(); // far away, so the player can't eat what it drops
      g.kill(b, null, 'wall');
      return m;
    })()`);
    await page.frames(3);
    assert.deepEqual(await since(page, m), []);
    assert.equal((await state()).boosting, false, 'a boosting bot makes no whoosh');
  });

  await t.test('boosting whooshes while held', async () => {
    await page.eval('window.__player.mass = 300');
    await page.key('keyDown', 'Space');
    await page.waitFor('window.wigglefeastDebug.audioState().boosting', 'boost whoosh');
    await page.key('keyUp', 'Space');
    await page.waitFor('!window.wigglefeastDebug.audioState().boosting', 'whoosh to stop');
  });

  await t.test('pausing goes quiet; resuming brings the music back', async () => {
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
    await page.frames(2);
    const s = await state();
    assert.equal(s.quiet, true);
    assert.equal(s.musicPlaying, false);
    await page.press('KeyP');
    await page.waitFor('window.wigglefeastDebug.audioState().musicPlaying', 'music back');
  });

  await t.test('dying plays the death sound and stops the music', async () => {
    const got = await during(() => page.eval(`(() => { const g = window.__game, b = g.worms.find((w) => w.ai && !w.dead); window.__player.shield = 0; g.kill(window.__player, b, 'body'); })()`));
    assert.ok(got.includes('death'), `death: ${got}`);
    await page.waitFor('!window.wigglefeastDebug.audioState().musicPlaying', 'music to stop');
  });

  await t.test('ending a run from the pause menu is not a death', async () => {
    await page.click('#again');
    await page.waitFor('window.__player && !window.__player.dead', 'new run');
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
    const got = await during(() => page.click('#endRun'));
    assert.ok(!got.includes('death'), `no death sound: ${got}`);
  });

  await t.test('the clock running out in a Timed match is not a death either (#12)', async () => {
    await page.waitFor(`!document.getElementById('menu').classList.contains('hidden')`, 'menu');
    await page.click('#modePick button[data-v="timed"]');
    await page.startRun();
    await page.eval('window.__player.shield = 1e5; window.__game.time = window.__player.born + 299.9');
    const got = await during(() => page.waitFor(`!document.getElementById('death').classList.contains('hidden')`, 'the result screen'));
    assert.ok(!got.includes('death'), `no death sound: ${got}`);
  });
});

// #9: sound and music toggles, remembered between sessions, and the M key.
test('sound and music toggles', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const state = () => page.eval('window.wigglefeastDebug.audioState()');
  const pressed = (which) => page.eval(`document.querySelector('#menu .audioToggles button[data-toggle="${which}"]').getAttribute('aria-pressed')`);
  const saved = () => page.eval(`JSON.parse(localStorage.getItem('wormarena.settings') || '{}')`);
  const unlock = async () => {
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 });
  };
  const logged = async (name) => {
    const m = await mark(page);
    await page.eval(`window.WormAudio.play('${name}')`);
    return (await since(page, m)).includes(name);
  };

  await t.test('both start on', async () => {
    assert.equal(await pressed('sound'), 'true');
    assert.equal(await pressed('music'), 'true');
    const s = await state();
    assert.equal(s.sound, true);
    assert.equal(s.music, true);
  });

  await t.test('sound off silences effects and music, and is remembered', async () => {
    await page.click('#menu .audioToggles button[data-toggle="sound"]');
    assert.equal((await saved()).sound, false, 'saved at once');
    await page.reload();
    assert.equal(await pressed('sound'), 'false');
    await unlock();
    assert.equal(await logged('powerup'), false, 'no effects');
    await page.startRun();
    await page.frames(10);
    assert.equal((await state()).musicPlaying, false, 'no music');
    await page.press('KeyP');
    await page.click('#endRun');
  });

  await t.test('music off keeps effects, and is remembered', async () => {
    await page.click('#menu .audioToggles button[data-toggle="sound"]');
    await page.click('#menu .audioToggles button[data-toggle="music"]');
    await page.reload();
    assert.equal(await pressed('sound'), 'true');
    assert.equal(await pressed('music'), 'false');
    await unlock();
    assert.equal(await logged('powerup'), true, 'effects play');
    await page.startRun();
    await page.frames(10);
    assert.equal((await state()).musicPlaying, false, 'no music');
    await page.press('KeyP');
    await page.click('#endRun');
    await page.click('#menu .audioToggles button[data-toggle="music"]');
  });

  await t.test('M toggles sound, but not while typing a nickname', async () => {
    await page.press('KeyM');
    assert.equal((await state()).sound, false);
    await page.press('KeyM');
    assert.equal((await state()).sound, true);
    await page.eval(`document.getElementById('name').focus()`);
    await page.press('KeyM');
    assert.equal((await state()).sound, true, 'typing m in the nickname leaves sound on');
    await page.eval(`document.getElementById('name').value = ''; document.getElementById('name').blur()`);
  });

  await t.test('Ctrl+M and Cmd+M leave sound alone', async () => {
    for (const modifiers of [2, 4]) { // Ctrl, Meta
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyM', key: 'm', windowsVirtualKeyCode: 77, modifiers });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyM', key: 'm', windowsVirtualKeyCode: 77, modifiers });
    }
    assert.equal((await state()).sound, true);
  });

  await t.test('M during play shows a short message', async () => {
    await page.startRun();
    await page.press('KeyM');
    await page.waitFor(`[...document.querySelectorAll('#feed div')].some((d) => d.textContent.includes('Sound off'))`, 'feed message');
    await page.press('KeyM');
    assert.equal((await state()).sound, true);
  });

  await t.test('settings saved before sound existed load with both on', async () => {
    await page.eval(`localStorage.removeItem('wormarena.world');
      localStorage.setItem('wormarena.settings', JSON.stringify({ name: 'Old', skin: 3, botCount: 40, difficulty: 'hard', theme: 'classic' }))`);
    await page.reload();
    const s = await state();
    assert.equal(s.sound, true);
    assert.equal(s.music, true);
    assert.equal(await page.eval(`document.getElementById('botCountVal').textContent`), '40', 'other settings kept');
    assert.equal(await page.eval(`document.querySelector('#difficulty button.on').dataset.v`), 'hard');
  });
});

// #13: master, effects and music volume, set in Settings. 100% on all three is today's loudness.
// What is heard is measured, not read from the gain nodes (which the browser can report stale while
// nothing plays): a tap on the master output records the peak level while one effect plays.
test('volume levels', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const C = window.AudioContext, make = C.prototype.createGain;
    window.__gains = [];
    C.prototype.createGain = function () {
      const g = make.call(this);
      window.__gains.push(g);
      if (window.__gains.length === 2) { // the master gain is made first, the effects gain second
        window.__tap = this.createAnalyser();
        window.__tap.fftSize = 2048;
        window.__gains[0].connect(window.__tap);
      }
      return g;
    };
  })()` });
  await page.goto(gameUrl());
  const state = () => page.eval('window.wigglefeastDebug.audioState()');
  const slide = (id, v) => page.eval(`(() => { const e = document.getElementById('${id}'); e.value = ${v}; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); })()`);
  const eats = () => page.eval(`window.wigglefeastDebug.sounds().filter((n) => n === 'eat').length`);
  // The highest level at the master output while one eating pop plays, after a short wait so that a
  // volume change has finished ramping and earlier sounds have died away.
  const peak = () => page.eval(`new Promise((res) => setTimeout(() => {
    let max = 0; const t0 = performance.now(), buf = new Float32Array(window.__tap.fftSize);
    window.WormAudio.play('eat', { size: 0.5 });
    (function sample() {
      window.__tap.getFloatTimeDomainData(buf);
      for (const v of buf) max = Math.max(max, Math.abs(v));
      performance.now() - t0 < 250 ? requestAnimationFrame(sample) : res(max);
    })();
  }, 250))`);
  const ratio = async (base) => (await peak()) / base;
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 });
  let base;

  await t.test('100% on all three is exactly as loud as before volume existed', async () => {
    const s = await state();
    assert.deepEqual(s.volumes, { master: 1, effects: 1, music: 1 });
    assert.deepEqual(s.levels, { effects: 0.7, music: 0.7 });
    base = await peak();
    // 0.7 master level x the pop's own 0.2 volume at this size
    assert.ok(base > 0.12 && base < 0.16, `an eating pop peaks at ${base}`);
  });

  await t.test('Master scales effects and music together', async () => {
    await page.click('#openSettings');
    await slide('volMaster', 50);
    assert.equal(await page.eval(`document.getElementById('volMasterVal').textContent`), '50%');
    const r = await ratio(base);
    assert.ok(Math.abs(r - 0.5) < 0.05, `the pop is ${r} of its old level`);
    const s = await state();
    assert.ok(Math.abs(s.levels.effects - 0.35) < 0.001 && Math.abs(s.levels.music - 0.35) < 0.001, JSON.stringify(s.levels));
  });

  await t.test('Effects scales only the effects', async () => {
    await slide('volMaster', 100);
    await slide('volSfx', 0);
    assert.ok((await peak()) < 0.001, 'silent at 0%');
    const s = await state();
    assert.deepEqual([s.levels.effects, s.levels.music], [0, 0.7], 'the music keeps its level');
    await slide('volSfx', 60);
    const r = await ratio(base);
    assert.ok(Math.abs(r - 0.6) < 0.06, `the pop is ${r} of its old level`);
  });

  await t.test('releasing the Effects slider plays one effect to judge it by, unless it is at 0%', async () => {
    await slide('volSfx', 0);
    const n = await eats();
    await slide('volSfx', 0);
    assert.equal(await eats(), n, 'nothing at 0%');
    await slide('volSfx', 60);
    assert.equal(await eats(), n + 1, 'one pop at 60%');
  });

  await t.test('Music scales only the music, once it plays', async () => {
    await slide('volSfx', 100);
    await slide('volMusic', 25);
    const s = await state();
    assert.ok(Math.abs(s.levels.music - 0.175) < 0.001 && s.levels.effects === 0.7, JSON.stringify(s.levels));
    await page.click('#closeSettings');
    await page.startRun();
    await page.waitFor('window.wigglefeastDebug.audioState().musicPlaying', 'music');
    // The music node is busy while it plays, so its gain can be read.
    await page.waitFor(`Math.abs(window.wigglefeastDebug.audioState().gains.music - 0.25) < 0.02`, 'the music gain to follow the slider', 5000);
  });

  await t.test('the mute buttons and M stay mutes at any level, and unmute to the level that was set', async () => {
    // Back to the menu first: the run's music would add to the level measured below.
    await page.press('KeyP');
    await page.click('#endRun');
    await page.waitFor(`!document.getElementById('menu').classList.contains('hidden')`, 'the menu');
    await page.click('#openSettings');
    await slide('volMaster', 80);
    await page.click('#closeSettings');
    await page.press('KeyM');
    let s = await state();
    assert.deepEqual([s.sound, s.levels.effects, s.levels.music], [false, 0, 0], 'muted');
    assert.ok((await peak()) < 0.001, 'silent');
    await page.press('KeyM');
    s = await state();
    assert.ok(Math.abs(s.levels.effects - 0.56) < 0.001, 'back at 80% of the old level');
    const r = await ratio(base);
    assert.ok(Math.abs(r - 0.8) < 0.08, `the pop is ${r} of its old level`);
  });

  await t.test('moving a slider while muted does not unmute', async () => {
    await page.click('#menu .audioToggles button[data-toggle="music"]');
    await page.click('#openSettings');
    await slide('volMusic', 90);
    const s = await state();
    assert.deepEqual([s.music, s.musicPlaying, s.volumes.music], [false, false, 0.9]);
    await page.click('#closeSettings');
    await page.click('#menu .audioToggles button[data-toggle="music"]');
    assert.equal((await state()).music, true, 'unmuted, at the level that was set');
    assert.equal((await state()).volumes.music, 0.9);
  });

  await t.test('levels are remembered', async () => {
    await page.reload();
    const s = await state();
    assert.deepEqual(s.volumes, { master: 0.8, effects: 1, music: 0.9 });
    await page.click('#openSettings');
    assert.equal(await page.eval(`document.getElementById('volMaster').value`), '80');
    assert.equal(await page.eval(`document.getElementById('volMusicVal').textContent`), '90%');
  });
});
