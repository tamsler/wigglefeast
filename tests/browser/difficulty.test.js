// Difficulty levels in the menu and on the stats screen, Expert included (#78).
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, gameUrl } = require('../helpers/browser');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'save-v1.json'), 'utf8'));
const bestTiles = `[...document.querySelectorAll('#bestByDiff div')].map((d) => [d.querySelector('small').textContent, d.querySelector('b').textContent])`;

test('difficulty levels', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());

  await t.test('the menu offers four levels; Expert starts an Expert world and is remembered', async () => {
    assert.deepEqual(await page.eval(`[...document.querySelectorAll('#difficulty button')].map((b) => b.dataset.v)`), ['easy', 'normal', 'hard', 'expert']);
    await page.click('#difficulty button[data-v="expert"]');
    await page.startRun();
    assert.equal(await page.eval('window.__game.settings.difficulty'), 'expert');
    await page.press('KeyP');
    await page.click('#endRun');
    await page.reload();
    assert.equal(await page.eval(`document.querySelector('#difficulty button.on').dataset.v`), 'expert');
    assert.equal(JSON.parse(await page.eval(`localStorage.getItem('wormarena.settings')`)).difficulty, 'expert');
  });

  await t.test('an Expert run counts as the Expert best and is listed as expert', async () => {
    await page.click('#openStats');
    const tiles = await page.eval(bestTiles);
    assert.deepEqual(tiles.map(([label]) => label), ['easy', 'normal', 'hard', 'expert']);
    const profile = JSON.parse(await page.eval(`localStorage.getItem('wormarena.profile')`));
    assert.equal(profile.recent[0].diff, 'expert');
    assert.ok(profile.totals.bestByDiff.expert > 0, 'the Expert best is recorded');
    assert.notEqual(tiles[3][1], '0', 'and shown');
    assert.match(await page.eval(`document.getElementById('recentRuns').textContent`), /expert/);
    await page.click('#closeStats');
  });

  await t.test('a profile from before Expert loads with all its runs and an Expert best of 0', async () => {
    assert.ok(!('expert' in fixture.profile.totals.bestByDiff), 'the fixture predates Expert');
    await page.eval(`localStorage.setItem('wormarena.profile', ${JSON.stringify(JSON.stringify(fixture.profile))})`);
    await page.reload();
    await page.click('#openStats');
    assert.deepEqual(await page.eval(bestTiles), [['easy', '0'], ['normal', '530'], ['hard', '210'], ['expert', '0']]);
    assert.equal(await page.eval(`document.querySelectorAll('#recentRuns tr td').length > 0`), true);
    const kept = JSON.parse(await page.eval(`localStorage.getItem('wormarena.profile')`));
    assert.equal(kept.recent.length, fixture.profile.recent.length);
    assert.equal(kept.top.length, fixture.profile.top.length);
  });
});
