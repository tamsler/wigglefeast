// Sound effects and music (#9). Headless Chrome can't be listened to, so these tests read the
// audio module's log of what actually played, and its state. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const STATE = 'window.WormAudio.state()';
const LOG = 'window.WormAudio.log().map((e) => e.name)';

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
    const n = await page.eval(`(() => {
      const before = window.WormAudio.log().length;
      for (let i = 0; i < 40; i++) window.WormAudio.play('eat', { size: 0.2 });
      return window.WormAudio.log().slice(before).filter((e) => e.name === 'eat').length;
    })()`);
    assert.ok(n <= 12 && n >= 10, `${n} pops logged from 40 within a moment`);
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
    const n = (await sounds()).length;
    await fn();
    await page.frames(3);
    return (await sounds()).slice(n);
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

  await t.test('music plays during the run', async () => {
    await page.waitFor('window.wigglefeastDebug.audioState().musicPlaying', 'music');
  });

  await t.test('eating food pops', async () => {
    const n = (await sounds()).length;
    await page.eval(`(() => {
      const g = window.__game, p = window.__player;
      g.food.push({ x: p.sx[0], y: p.sy[0], v: 2, r: 5, c: '#fff', life: Infinity, ph: 0, dead: false, natural: true });
      g.rebuildFoodGrid();
    })()`);
    // Wait for it rather than a fixed number of frames: a busy machine may need a few more.
    await page.waitFor(`window.wigglefeastDebug.sounds().slice(${n}).includes('eat')`, 'eating pop', 5000);
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
    const got = await during(() => page.eval(`(() => {
      const g = window.__game, b = g.worms.find((w) => w.ai && !w.dead);
      // So the player eats and picks up nothing meanwhile.
      Object.assign(g, { food: [], foodTarget: 0, powerups: [], powerupTarget: 0, specials: [], specialTarget: 0 }); g.rebuildFoodGrid();
      g.emit('eat', { worm: b, r: 5 });
      g.emit('powerup', { worm: b, type: 'magnet' });
      g.emit('special', { worm: b, kind: 'nova', value: 25 });
      b.boosting = true;
      b.sx = b.sx.map((x) => x + 5000); b.updateBounds(); // far away, so the player can't eat what it drops
      g.kill(b, null, 'wall');
    })()`));
    assert.deepEqual(got, []);
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
    const n = (await page.eval('window.wigglefeastDebug.sounds()')).length;
    await page.eval(`window.WormAudio.play('${name}')`);
    return (await page.eval('window.wigglefeastDebug.sounds()')).length > n;
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
