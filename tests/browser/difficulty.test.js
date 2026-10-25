// Difficulty levels in the menu and on the stats screen: three levels, Hard being what was Expert
// (#78, #177). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, gameUrl } = require('../helpers/browser');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'save-v1.json'), 'utf8'));
const bestTiles = `[...document.querySelectorAll('#bestByDiff div')].map((d) => [d.querySelector('small').textContent, d.querySelector('b').textContent])`;
const run = (o) => ({ date: 1700000000000, name: 'Me', score: 100, peak: 100, kills: 0, eaten: 10, time: 30, by: 'Bot', diff: 'normal', bots: 30, ...o });

test('difficulty levels', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());

  await t.test('the menu offers three levels; Hard starts a Hard world and is remembered', async () => {
    assert.deepEqual(await page.eval(`[...document.querySelectorAll('#difficulty button')].map((b) => b.dataset.v)`), ['easy', 'normal', 'hard']);
    await page.click('#difficulty button[data-v="hard"]');
    await page.startRun();
    assert.equal(await page.eval('window.__game.settings.difficulty'), 'hard');
    await page.press('KeyP');
    await page.click('#endRun');
    await page.reload();
    assert.equal(await page.eval(`document.querySelector('#difficulty button.on').dataset.v`), 'hard');
    assert.equal(JSON.parse(await page.eval(`localStorage.getItem('wormarena.settings')`)).difficulty, 'hard');
  });

  await t.test('a Hard run counts as the Hard best and is listed as hard', async () => {
    await page.click('#openStats');
    const tiles = await page.eval(bestTiles);
    assert.deepEqual(tiles.map(([label]) => label), ['easy', 'normal', 'hard']);
    const profile = JSON.parse(await page.eval(`localStorage.getItem('wormarena.profile')`));
    assert.equal(profile.recent[0].diff, 'hard');
    assert.ok(profile.totals.bestByDiff.hard > 0, 'the Hard best is recorded');
    assert.notEqual(tiles[2][1], '0', 'and shown');
    assert.match(await page.eval(`document.getElementById('recentRuns').textContent`), /hard/);
    await page.click('#closeStats');
  });

  await t.test('a remembered Expert or Hard choice selects Hard', async () => {
    for (const old of ['expert', 'hard']) {
      await page.eval(`localStorage.removeItem('wormarena.world'); localStorage.setItem('wormarena.settings', JSON.stringify({ name: 'Old', skin: 0, botCount: 30, difficulty: '${old}' }))`);
      await page.reload();
      assert.equal(await page.eval(`document.querySelector('#difficulty button.on').dataset.v`), 'hard', old);
    }
  });

  await t.test('a profile with Expert runs lists them as hard, with the higher best as the Hard best', async () => {
    const prof = {
      v: 1,
      totals: { games: 2, kills: 0, time: 60, eaten: 20, best: 7000, bestByDiff: { easy: 0, normal: 100, hard: 3000, expert: 7000 } },
      top: [run({ peak: 7000, diff: 'expert' }), run({ peak: 3000, diff: 'hard' })], recent: [run({ peak: 7000, diff: 'expert' })],
    };
    await page.eval(`localStorage.removeItem('wormarena.world'); localStorage.setItem('wormarena.profile', ${JSON.stringify(JSON.stringify(prof))})`);
    await page.reload();
    await page.click('#openStats');
    assert.deepEqual(await page.eval(bestTiles), [['easy', '0'], ['normal', '100'], ['hard', '7,000']]);
    const p = await page.eval('window.wigglefeastDebug.profile()');
    assert.deepEqual(p.top.map((r) => r.diff), ['hard', 'hard']);
    assert.equal(p.recent[0].diff, 'hard');
    assert.deepEqual(Object.keys(p.totals.bestByDiff), ['easy', 'normal', 'hard'], 'only three levels kept');
    assert.doesNotMatch(await page.eval(`document.getElementById('topRuns').textContent`), /expert/);
    await page.click('#closeStats');
  });

  await t.test('a profile from before Expert loads with all its runs', async () => {
    assert.ok(!('expert' in fixture.profile.totals.bestByDiff), 'the fixture predates Expert');
    await page.eval(`localStorage.setItem('wormarena.profile', ${JSON.stringify(JSON.stringify(fixture.profile))})`);
    await page.reload();
    await page.click('#openStats');
    assert.deepEqual(await page.eval(bestTiles), [['easy', '0'], ['normal', '530'], ['hard', '210']]);
    assert.equal(await page.eval(`document.querySelectorAll('#recentRuns tr td').length > 0`), true);
    const kept = JSON.parse(await page.eval(`localStorage.getItem('wormarena.profile')`));
    assert.equal(kept.recent.length, fixture.profile.recent.length);
    assert.equal(kept.top.length, fixture.profile.top.length);
  });

  await t.test('importing an export with Expert data gives Hard runs and a Hard best', async () => {
    const os = require('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-diff-'));
    const data = JSON.parse(JSON.stringify(fixture));
    data.profile.totals.bestByDiff = { easy: 0, normal: 530, hard: 210, expert: 9000 };
    data.profile.top.unshift(run({ peak: 9000, diff: 'expert' }));
    data.world.settings.difficulty = 'expert';
    const file = path.join(tmp, 'old-expert.json');
    fs.writeFileSync(file, JSON.stringify(data));
    page.dialogs.length = 0;
    await page.setFile('#importFile', file);
    await page.waitForDialog(/Nothing was changed|Replace your current/);
    await page.frames(5);
    fs.rmSync(tmp, { recursive: true, force: true });
    const p = await page.eval('window.wigglefeastDebug.profile()');
    assert.equal(p.totals.bestByDiff.hard, 9000);
    assert.equal(p.top[0].diff, 'hard');
    assert.equal(await page.eval('window.__game.settings.difficulty'), 'hard', 'the world loads on hard');
  });
});
