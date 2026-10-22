// A small brain by an Expert bot's head while the game watches it cut the player off (#138).
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

test('learning cue', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const cues = () => page.eval('window.wigglefeastDebug.learningCues()');
  const cue = (id) => page.eval(`window.wigglefeastDebug.learningCue(${id})`);

  // Starts a run on a level, pauses it, and puts a bot just ahead of the player on its left.
  const scene = async (level) => {
    await page.click(`#difficulty button[data-v="${level}"]`);
    await page.startRun();
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');
    return page.eval(`(() => {
      const g = window.__game, p = window.__player, b = g.worms.find((w) => w.ai);
      const c = Math.cos(p.angle), s = Math.sin(p.angle), x = p.x + c * 150 - s * 120, y = p.y + s * 150 + c * 120;
      for (let k = 0; k < b.sx.length; k++) { b.sx[k] = x - c * k * 4; b.sy[k] = y - s * k * 4; }
      b.angle = b.targetAngle = p.angle;
      b.updateBounds();
      return b.id;
    })()`);
  };
  const watch = (id) => page.eval(`window.__game.encounter = { bot: window.__game.worms.find((w) => w.id === ${id}), start: window.__game.time }`);
  const stopWatching = () => page.eval('window.__game.encounter = null');
  const endRun = async () => { await stopWatching(); await page.click('#endRun'); await page.frames(5); };

  await t.test('an expert bot being watched shows a brain, and only that bot', async () => {
    page.exceptions.length = 0;
    const id = await scene('expert');
    await page.frames(5);
    assert.equal(await cues(), 0, 'nobody is being watched yet');
    await watch(id);
    await page.frames(5);
    assert.equal(await cues(), 1);
    assert.ok((await cue(id)) >= 0.7, 'drawn clearly while watching');
  });

  await t.test('the brain fades out once the watching ends', async () => {
    const id = await page.eval('window.__game.encounter.bot.id');
    await stopWatching();
    // Polled, not slept: a slow machine can't skip past the fade (review).
    await page.waitFor(`(() => { const a = window.wigglefeastDebug.learningCue(${id}); return a > 0 && a < 0.75; })()`, 'the brain fading', 2000);
    await page.waitFor('window.wigglefeastDebug.learningCues() === 0', 'the brain gone about a second later', 2000);
    assert.deepEqual(page.exceptions, []);
    await endRun();
  });

  await t.test('a real cut-off on expert shows the brain', async () => {
    const id = await scene('expert');
    await page.eval(`(() => {
      const g = window.__game, p = window.__player, b = g.worms.find((w) => w.id === ${id});
      p.shield = 0;
      b.ai.prey = p; b.ai.mode = 'cut'; b.ai.huntUntil = 1e9; b.thinkT = 1e9; // keeps cutting in, no re-plan
    })()`);
    await page.press('KeyP'); // resume
    await page.waitFor(`window.wigglefeastDebug.learningCue(${id}) > 0`, 'the brain on the cutter', 3000);
    await page.press('KeyP');
    await endRun();
  });

  await t.test('no brain on hard', async () => {
    page.exceptions.length = 0;
    const id = await scene('hard');
    await watch(id);
    await page.frames(10);
    assert.equal(await cues(), 0);
    assert.deepEqual(page.exceptions, []);
  });
});
