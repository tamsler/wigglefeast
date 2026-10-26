// Robustness fixes from the full code review (#185). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, gameUrl, sleep } = require('../helpers/browser');

const hidden = (id) => `document.getElementById('${id}').classList.contains('hidden')`;
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'save-v1.json'), 'utf8'));

test('frame loop and saves', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');

  await t.test('game time never runs backwards after a resume', async () => {
    await page.click('#pauseBtn');
    await page.waitFor(`!${hidden('paused')}`, 'pause');
    // Resume stamps the frame clock from performance.now(); make that later than the next frame's time.
    await page.eval(`(() => {
      const real = performance.now.bind(performance);
      performance.now = () => real() + 5000;
      window.__game.__min = window.__game.time;
      const g = window.__game, update = g.update;
      g.update = function (dt) { if (dt < 0) window.__negative = dt; return update.call(this, dt); };
      setTimeout(() => { performance.now = real; }, 500);
    })()`);
    await page.click('#resume');
    await page.frames(5);
    assert.equal(await page.eval('window.__negative'), undefined, 'update() was never called with a negative step');
  });

  await t.test('an exception in one frame does not stop the loop', async () => {
    await page.eval(`(() => {
      const g = window.__game;
      window.__realUpdate = g.update;
      g.update = () => { throw new Error('boom'); };
    })()`);
    await page.frames(3);
    await page.eval('window.__game.update = window.__realUpdate');
    const t0 = await page.eval('window.__game.time');
    await page.frames(10);
    assert.ok((await page.eval('window.__game.time')) > t0, 'the game runs again once the fault is gone');
    page.exceptions.length = 0;
  });

  await t.test('a failed world save keeps the last good one (#185)', async () => {
    await page.eval(`window.dispatchEvent(new Event('beforeunload'))`);
    const good = await page.eval(`localStorage.getItem('wormarena.world')`);
    assert.ok(good, 'the world was saved');
    const failed = await page.eval(`(() => {
      const set = Storage.prototype.setItem;
      let failed = 0;
      Storage.prototype.setItem = function (k, v) { if (k === 'wormarena.world') { failed++; throw new DOMException('full', 'QuotaExceededError'); } return set.call(this, k, v); };
      window.dispatchEvent(new Event('beforeunload'));
      Storage.prototype.setItem = set;
      return failed;
    })()`);
    assert.equal(failed, 1, 'the save was attempted and failed');
    assert.equal(await page.eval(`localStorage.getItem('wormarena.world')`), good);
  });

  await t.test('the nickname field stays selectable (#185)', async () => {
    assert.equal(await page.eval(`getComputedStyle(document.getElementById('name')).userSelect`), 'text');
  });
});

test('stopping the music cuts off the notes already scheduled (#185)', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.eval(`(() => {
    window.__disconnects = 0;
    const d = GainNode.prototype.disconnect;
    GainNode.prototype.disconnect = function (...a) { window.__disconnects++; return d.apply(this, a); };
    window.WormAudio.unlock();
  })()`);
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');
  await page.waitFor('window.WormAudio.state().musicPlaying', 'music playing');
  await page.click('#pauseBtn'); // the game stops the music and suspends the context together
  await page.waitFor('!window.WormAudio.state().musicPlaying', 'music stopped');
  await sleep(500);
  assert.equal(await page.eval('window.__disconnects'), 1, 'the old music bus, with its queued notes, is dropped');
  await page.click('#resume');
  await page.waitFor('window.WormAudio.state().musicPlaying', 'music plays again on a fresh bus');
});

test('startup survives another window taking over at once (#185)', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  // A profile whose achievements are not recorded yet, so the first checkAchievements() saves it.
  const profile = JSON.stringify({ ...fixture.profile, ach: {} });
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      try { localStorage.setItem('wormarena.profile', ${JSON.stringify(profile)}); } catch (e) {}
      const get = Storage.prototype.getItem;
      let reads = 0;
      Storage.prototype.getItem = function (k) {
        // The first read decides we are active; every later one shows another window owning the session.
        if (k === 'wormarena.session' && ++reads > 1) return JSON.stringify({ id: 'other-window', at: Date.now() });
        return get.call(this, k);
      };
    })()`,
  });
  await page.goto(gameUrl());
  await page.waitFor(`!${hidden('standby')}`, 'standby screen');
  assert.deepEqual(page.exceptions, []);
});
