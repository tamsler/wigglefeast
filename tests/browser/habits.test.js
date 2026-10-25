// The player's habits are kept between games, outside saves and exports (#135).
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, gameUrl, sleep } = require('../helpers/browser');

const KEY = 'wormarena.habits';
const FRESH = { v: 1, away: 0, toward: 0, straight: 0, boost: 0, still: 0 };
const LEARNED = { v: 1, away: 7.5, toward: 1.25, straight: 0.5, boost: 4, still: 5.25 };

test('the player\'s habits', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-habits-'));
  let page;
  t.after(async () => { if (page) await page.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  page = await launch();
  const stored = () => page.eval(`JSON.parse(localStorage.getItem('${KEY}'))`);
  const inGame = () => page.eval('JSON.parse(JSON.stringify(window.__game.habits))');
  // The page saves its own record as it closes, so store this one after that.
  const startupWith = async (raw) => {
    await page.eval(`addEventListener('pagehide', () => localStorage.setItem('${KEY}', ${JSON.stringify(raw)}))`);
    page.exceptions.length = 0;
    await page.reload();
    await page.waitFor('!!window.__game', 'game');
    await page.frames(5);
    assert.deepEqual(page.exceptions, []);
  };

  await page.goto(gameUrl());

  await t.test('a stored record reaches every new game', async () => {
    await startupWith(JSON.stringify(LEARNED));
    assert.deepEqual(await inGame(), LEARNED, 'the menu\'s world');
    await page.click('#difficulty button[data-v="hard"]'); // a new world, not the restored one
    await page.startRun();
    assert.equal(await page.eval('window.__game.settings.difficulty'), 'hard');
    assert.deepEqual(await inGame(), LEARNED, 'a new hard world');
  });

  await t.test('what the bots learn survives a reload', async () => {
    // As if the bots had watched one more cut-off; ending the run saves it with the world.
    await page.eval('window.__game.habits.away += 1');
    await page.press('KeyP');
    await page.click('#endRun');
    await page.waitFor(`JSON.parse(localStorage.getItem('${KEY}')).away === ${LEARNED.away + 1}`, 'habits saved at run end');
    await page.reload();
    await page.waitFor('!!window.__game', 'game');
    assert.deepEqual(await inGame(), { ...LEARNED, away: LEARNED.away + 1 });
    assert.equal(await page.eval(`JSON.parse(localStorage.getItem('wormarena.world')).habits`), undefined, 'not part of the world save');
  });

  await t.test('an export leaves the habits out', async () => {
    await page.click('#openStats');
    const dl = path.join(tmp, 'downloads');
    fs.mkdirSync(dl);
    await page.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
    await page.click('#exportSave');
    let save;
    for (let i = 0; i < 100 && !save; i++) {
      await sleep(100);
      const file = fs.readdirSync(dl).find((f) => f.endsWith('.json'));
      try { save = file && JSON.parse(fs.readFileSync(path.join(dl, file), 'utf8')); } catch { /* still writing */ }
    }
    assert.ok(save && save.world, 'exported a save');
    const text = JSON.stringify(save);
    assert.ok(!/habits|"toward"|"straight"/.test(text), 'no habits in the export');
  });

  await t.test('reset stats forgets the habits', async () => {
    page.dialogs.length = 0;
    await page.click('#resetStats');
    await page.waitForDialog(/Reset all stats/);
    assert.deepEqual(await stored(), FRESH);
    assert.deepEqual(await inGame(), FRESH, 'the running world forgets them too');
  });

  await t.test('a damaged record starts empty, without errors', async () => {
    for (const raw of ['{not json', JSON.stringify({ ...LEARNED, away: -3 }), JSON.stringify({ ...LEARNED, v: 9 }), JSON.stringify([1, 2]), JSON.stringify({ ...LEARNED, boost: 1e300 })]) {
      await startupWith(raw);
      assert.deepEqual(await inGame(), FRESH, raw);
    }
  });
});
