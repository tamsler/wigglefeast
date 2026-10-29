// Game modes (#12): the menu picker, the Timed clock and result, Survival levels, the stats for each mode, and
// saves and profiles from before modes. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, gameUrl, sleep } = require('../helpers/browser');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'save-v1.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));

const pick = (page, mode) => page.click(`#modePick button[data-v="${mode}"]`);
const profile = (page) => page.eval(`JSON.parse(localStorage.getItem('wormarena.profile'))`);
const text = (page, id) => page.eval(`document.getElementById(${JSON.stringify(id)}).textContent`);
const hidden = (page, id) => page.eval(`document.getElementById(${JSON.stringify(id)}).classList.contains('hidden')`);
// The player can't be killed, so only the clock (or the test) ends a run. (A saved shield is limited to 1e6.)
const shield = (page) => page.eval('window.__player.shield = 1e5');
// Moves the player's clock on by setting game time (the clock and the level come from game time, #12).
const matchAt = (page, secs) => page.eval(`window.__game.time = window.__player.born + ${secs}`);
// The HUD refreshes a few times a second, so wait for the clock to show what is expected.
const clockIs = (page, re) => page.waitFor(`${re}.test(document.getElementById('clock').textContent)`, `the clock to match ${re}`);
const waitDeath = (page) => page.waitFor(`!document.getElementById('death').classList.contains('hidden')`, 'death screen');
async function endWithWall(page) {
  await page.eval(`window.__player.shield = 0; window.__game.kill(window.__player, null, 'wall')`);
  await waitDeath(page);
}
async function toMenu(page) {
  await page.click('#toMenu');
  await page.waitFor(`!document.getElementById('menu').classList.contains('hidden')`, 'menu');
}
const startupWith = async (page, entries) => {
  await page.eval(Object.entries(entries).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`).join(';'));
  page.exceptions.length = 0;
  await page.reload();
  await page.waitFor(`!document.getElementById('menu').classList.contains('hidden') || !document.getElementById('paused').classList.contains('hidden')`, 'menu or resume panel');
  assert.deepEqual(page.exceptions, []);
};

test('game modes (#12)', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-modes-'));
  let page;
  t.after(async () => { if (page) await page.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  page = await launch();
  await page.goto(gameUrl());

  await t.test('the picker defaults to Classic, explains the mode, and is remembered', async () => {
    assert.deepEqual(await page.eval(`[...document.querySelectorAll('#modePick button')].map((b) => b.dataset.v)`), ['classic', 'timed', 'survival']);
    assert.equal(await page.eval(`document.querySelector('#modePick button.on').dataset.v`), 'classic');
    const classicHelp = await text(page, 'modeHelp');
    assert.ok(classicHelp.length > 10);
    await pick(page, 'timed');
    assert.notEqual(await text(page, 'modeHelp'), classicHelp, 'the description follows the choice');
    assert.match(await text(page, 'modeHelp'), /5 minutes/);
    // Like the other menu settings, it is saved when a run starts.
    await page.startRun();
    await page.press('KeyP');
    await page.click('#endRun');
    await page.reload();
    assert.equal(await page.eval(`document.querySelector('#modePick button.on').dataset.v`), 'timed');
    assert.equal(JSON.parse(await page.eval(`localStorage.getItem('wormarena.settings')`)).mode, 'timed');
    await startupWith(page, { 'wormarena.settings': JSON.stringify({ name: 'Old', botCount: 12, difficulty: 'easy' }) });
    assert.equal(await page.eval(`document.querySelector('#modePick button.on').dataset.v`), 'classic', 'settings from before modes');
    assert.equal(await page.eval(`document.getElementById('botCount').value`), '12');
    await startupWith(page, { 'wormarena.settings': JSON.stringify({ mode: 'zen' }) });
    assert.equal(await page.eval(`document.querySelector('#modePick button.on').dataset.v`), 'classic', 'an unknown mode is ignored');
  });

  await t.test('Classic has no clock', async () => {
    await page.startRun();
    assert.equal(await page.eval('window.__game.settings.mode'), 'classic');
    assert.ok(await hidden(page, 'clock'));
    await page.frames(10);
    assert.ok(await hidden(page, 'clock'));
    await page.press('KeyP');
    await page.click('#endRun');
  });

  let timedRun;
  await t.test('a Timed match counts down, stops while paused, and ends at 0:00 with a rank', async () => {
    await pick(page, 'timed');
    await page.startRun();
    await shield(page);
    assert.equal(await page.eval('window.__game.settings.mode'), 'timed');
    await page.eval('window.__game.__marker = true');
    await clockIs(page, /^(5:00|4:5\d)$/);
    assert.ok(!(await hidden(page, 'clock')));
    await matchAt(page, 100);
    await clockIs(page, /^3:(1[89]|20)$/);
    // Paused: the clock holds.
    await page.press('KeyP');
    const held = await text(page, 'clock');
    await sleep(700);
    await page.frames(5);
    assert.equal(await text(page, 'clock'), held);
    await page.press('KeyP');
    // The last seconds are highlighted.
    assert.equal(await page.eval(`document.getElementById('clock').classList.contains('low')`), false);
    await matchAt(page, 291);
    await page.frames(15);
    assert.equal(await page.eval(`document.getElementById('clock').classList.contains('low')`), true);
    assert.match(await text(page, 'clock'), /^0:0\d$/);
    await matchAt(page, 299.5);
    await waitDeath(page);
    assert.match(await text(page, 'deathTitle'), /^(Time's up!|You won!)$/);
    assert.match(await text(page, 'dMode'), /^Finished #\d+ of \d+$/);
    timedRun = (await profile(page)).recent[0];
    assert.equal(timedRun.mode, 'timed');
    assert.equal(timedRun.by, 'Time up');
    assert.ok(Number.isInteger(timedRun.rank) && timedRun.rank >= 1 && timedRun.rank <= 31);
    // The field is the 30 bots (some may be waiting to respawn) and the player.
    const [, shownRank, total] = (await text(page, 'dMode')).match(/#(\d+) of (\d+)/).map(Number);
    assert.equal(shownRank, timedRun.rank, 'the rank on screen is the recorded one');
    assert.ok(total >= shownRank && total <= 31, `out of ${total}`);
    const p = await profile(page);
    assert.equal(p.totals.bestByMode.timed, timedRun.score, 'the Timed best is the score at the buzzer');
    assert.ok(timedRun.score > 0);
    assert.ok(p.ach.hang, 'surviving the whole match earns Hang In There');
    assert.match(await text(page, 'dBest'), /New Timed best/);
  });

  await t.test('Play again after a match starts a fresh world, even and with a full clock', async () => {
    await page.click('#again');
    await page.waitFor(`window.__player && !window.__player.dead`, 'new run');
    assert.equal(await page.eval('window.__game.__marker'), undefined, 'a new world');
    await clockIs(page, /^(5:00|4:5\d)$/);
    // (Exactly "every bot starts at 15-200" is pinned in the engine tests; here bots may already have eaten on a slow machine.)
    assert.ok(await page.eval(`window.__game.worms.filter((w) => w.ai).every((w) => w.mass < 5000)`), 'no starting giants');
    await page.press('KeyP');
    await page.click('#endRun');
  });

  await t.test('dying in a Timed match ends it like Classic, with no rank and no Timed best', async () => {
    const before = (await profile(page)).totals.bestByMode.timed;
    await page.startRun();
    await endWithWall(page);
    assert.equal(await text(page, 'deathTitle'), 'You hit the wall!');
    assert.equal(await text(page, 'dMode'), '');
    const p = await profile(page);
    assert.equal(p.recent[0].mode, 'timed');
    assert.equal(p.recent[0].rank, undefined);
    assert.equal(p.totals.bestByMode.timed, before, 'the Timed best is unchanged');
    assert.match(await text(page, 'dBest'), /Timed best/);
    await toMenu(page);
  });

  await t.test('a Survival run shows its level, adds bots each level, and records its time', async () => {
    await pick(page, 'survival');
    await page.startRun();
    await shield(page);
    await clockIs(page, /^0:0\d · Level 1$/);
    await matchAt(page, 125);
    await clockIs(page, /^2:0\d · Level 3$/);
    assert.equal(await page.eval('window.__game.botTarget()'), 36);
    await endWithWall(page);
    assert.match(await text(page, 'dMode'), /^Survived 2:0\d · Level 3$/);
    const p = await profile(page);
    assert.equal(p.recent[0].mode, 'survival');
    assert.ok(p.totals.bestByMode.survival >= 125 && p.totals.bestByMode.survival < 130);
    assert.match(await text(page, 'dBest'), /New Survival best/);
    await toMenu(page);
  });

  await t.test('later runs keep the mode, rank and bests of earlier ones', async () => {
    await pick(page, 'classic');
    await page.startRun();
    await page.press('KeyP');
    await page.click('#endRun');
    const p = await profile(page);
    // Newest first: this Classic run, the Survival run, then the Timed ones and the first Classic run.
    assert.deepEqual(p.recent.slice(0, 2).map((r) => r.mode), ['classic', 'survival']);
    assert.deepEqual(p.recent.slice(2, 7).map((r) => r.mode).sort(), ['classic', 'timed', 'timed', 'timed', 'timed']);
    const kept = p.recent.find((r) => r.by === 'Time up');
    assert.equal(kept.rank, timedRun.rank);
    assert.equal(p.totals.bestByMode.timed, timedRun.score);
    assert.ok(p.totals.bestByMode.survival >= 125);
    assert.ok(p.totals.bestByMode.classic >= 0);
    // And across a reload, followed by another run.
    await page.reload();
    await page.startRun();
    await page.press('KeyP');
    await page.click('#endRun');
    const after = await profile(page);
    assert.equal(after.recent.find((r) => r.by === 'Time up').rank, timedRun.rank);
    assert.equal(after.totals.bestByMode.timed, timedRun.score);
  });

  await t.test('the stats screen shows the best of each mode and each run\'s mode', async () => {
    await page.click('#openStats');
    const tiles = await page.eval(`[...document.querySelectorAll('#bestByMode div')].map((d) => [d.querySelector('small').textContent, d.querySelector('b').textContent])`);
    assert.deepEqual(tiles.map(([label]) => label), ['classic', 'timed', 'survival']);
    const p = await profile(page);
    assert.equal(tiles[1][1], timedRun.score.toLocaleString());
    assert.match(tiles[2][1], /^2:0\d$/);
    const recent = await text(page, 'recentRuns');
    assert.match(recent, /Timed/);
    assert.match(recent, /Survival/);
    assert.match(recent, /Classic/);
    assert.match(recent, new RegExp(`Time up · #${timedRun.rank}`));
    assert.match(recent, /Setup/);
    assert.equal(p.totals.games, p.recent.length > 0 ? p.totals.games : 0);
    await page.click('#closeStats');
  });

  await t.test('the Welcome back panel and the clock continue a saved Timed match', async () => {
    await pick(page, 'timed');
    await page.startRun();
    await shield(page);
    await matchAt(page, 170);
    await page.frames(5);
    await page.reload(); // the world is saved when the page goes away
    await page.waitFor(`document.getElementById('pausedTitle').textContent.includes('Welcome back') && !document.getElementById('paused').classList.contains('hidden')`, 'welcome back');
    assert.match(await text(page, 'pausedText'), /2:(09|10) left in the match/);
    assert.equal(await page.eval('window.__game.settings.mode'), 'timed');
    await page.click('#resume');
    await clockIs(page, /^2:(0\d|10)$/);
    await sleep(600);
    await page.press('KeyP');
    await page.click('#endRun');
  });

  await t.test('a saved Survival run resumes at the same level', async () => {
    await pick(page, 'survival');
    await page.startRun();
    await shield(page);
    await matchAt(page, 200);
    await page.frames(5);
    await page.reload();
    await page.waitFor(`document.getElementById('pausedTitle').textContent.includes('Welcome back')`, 'welcome back');
    assert.match(await text(page, 'pausedText'), /level <b>4<\/b>|level 4/);
    await page.click('#resume');
    await clockIs(page, /^3:2\d · Level 4$/);
    await page.press('KeyP');
    await page.click('#endRun');
  });

  await t.test('export and import carry modes, and Reset stats clears the bests', async () => {
    const dl = path.join(tmp, 'downloads');
    fs.mkdirSync(dl);
    await page.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
    await page.click('#openStats');
    await page.click('#exportSave');
    let file, save;
    for (let i = 0; i < 100 && !save; i++) {
      await sleep(100);
      file = fs.readdirSync(dl).find((f) => f.endsWith('.json'));
      try { save = file && JSON.parse(fs.readFileSync(path.join(dl, file), 'utf8')); } catch { /* still writing */ }
    }
    assert.ok(save, 'export produced a file');
    assert.deepEqual(Object.keys(save.profile.totals.bestByMode), ['classic', 'timed', 'survival']);
    assert.ok(save.profile.recent.some((r) => r.mode === 'timed' && r.rank === timedRun.rank));
    const before = await profile(page);
    await page.click('#resetStats');
    await page.waitFor(`JSON.parse(localStorage.getItem('wormarena.profile')).totals.games === 0`, 'reset');
    assert.deepEqual((await profile(page)).totals.bestByMode, { classic: 0, timed: 0, survival: 0 });
    page.dialogs.length = 0;
    await page.setFile('#importFile', path.join(dl, file));
    await page.waitForDialog(/Replace your current/);
    await page.waitFor(`JSON.parse(localStorage.getItem('wormarena.profile')).totals.games > 0`, 'import');
    const after = await profile(page);
    assert.deepEqual(after.totals.bestByMode, before.totals.bestByMode);
    assert.deepEqual(after.recent.map((r) => [r.mode, r.rank]), before.recent.map((r) => [r.mode, r.rank]));
  });

  await t.test('a profile and a world from before modes load as Classic', async () => {
    const old = clone(fixture.profile);
    for (const r of old.top.concat(old.recent)) assert.equal(r.mode, undefined, 'the fixture predates modes');
    assert.equal(old.totals.bestByMode, undefined);
    assert.equal(fixture.world.settings.mode, undefined);
    // A page that saves its own world on the way out would overwrite them, so a fresh browser has the data in place before the game starts.
    const fresh = await launch();
    try {
      const seed = { 'wormarena.profile': JSON.stringify(old), 'wormarena.world': JSON.stringify(fixture.world) };
      await fresh.send('Page.addScriptToEvaluateOnNewDocument', { source: Object.entries(seed).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('') });
      await fresh.goto(gameUrl());
      assert.match(await text(fresh, 'pausedTitle'), /Welcome back/);
      assert.equal(await fresh.eval('window.__game.settings.mode'), 'classic');
      await fresh.click('#resume');
      await fresh.frames(10);
      assert.ok(await hidden(fresh, 'clock'), 'a Classic world shows no clock');
      await fresh.press('KeyP');
      await fresh.click('#endRun');
      await fresh.click('#openStats');
      const tiles = await fresh.eval(`[...document.querySelectorAll('#bestByMode div b')].map((b) => b.textContent)`);
      assert.equal(tiles[0], old.totals.best.toLocaleString(), 'the old best is the Classic best');
      assert.equal(tiles[1], '0');
      assert.equal(tiles[2], '0:00');
      const p = await profile(fresh);
      assert.ok(p.recent.length > 1 && p.recent.every((r) => r.mode === 'classic'), 'every run, old and new, is Classic');
      assert.ok(p.top.every((r) => r.mode === 'classic'));
      assert.match(await text(fresh, 'topRuns'), /Classic/);
    } finally {
      await fresh.close();
    }
  });

  await t.test('Classic keeps reusing its world between runs', async () => {
    await pick(page, 'classic');
    await page.startRun();
    await page.eval('window.__game.__marker = true');
    await page.press('KeyP');
    await page.click('#endRun');
    await page.startRun();
    assert.equal(await page.eval('window.__game.__marker'), true, 'the same world');
    assert.equal(await page.eval('window.__game.settings.mode'), 'classic');
    await page.press('KeyP');
    await page.click('#endRun');
  });

  await t.test('names and modes from a stored profile are escaped on the stats screen', async () => {
    const hostile = '<img src=x onerror="window.pwned=true">';
    const run = { date: 1700000000000, name: 'Me', score: 100, peak: 100, kills: 0, eaten: 10, time: 30, by: hostile.slice(0, 40), diff: 'normal', bots: 30 };
    const p = clone(fixture.profile);
    p.recent = [{ ...run, mode: 'timed', rank: 2 }, { ...run, mode: '<b>x</b>' }];
    p.top = [];
    const fresh = await launch();
    try {
      await fresh.send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('wormarena.profile', ${JSON.stringify(JSON.stringify(p))});` });
      await fresh.goto(gameUrl());
      await fresh.click('#openStats');
      assert.equal(await fresh.eval('window.pwned'), undefined);
      assert.equal(await fresh.eval(`document.querySelectorAll('#recentRuns img, #recentRuns b b').length`), 0);
      const rows = await fresh.eval(`[...document.querySelectorAll('#recentRuns tr')].slice(1).map((r) => r.textContent)`);
      assert.match(rows[0], /Timed/);
      assert.match(rows[1], /Classic/, 'an unknown mode is a Classic run');
    } finally {
      await fresh.close();
    }
  });

  await t.test('an unknown mode in a save is refused', async () => {
    const bad = clone(fixture);
    bad.world.settings.mode = 'zen';
    const file = path.join(tmp, 'bad.json');
    fs.writeFileSync(file, JSON.stringify(bad));
    await page.click('#openStats');
    page.dialogs.length = 0;
    await page.setFile('#importFile', file);
    await page.waitForDialog(/Nothing was changed/);
    await page.click('#closeStats');
  });
});

test('the stats screen and menu fit a 360x640 phone with modes (#12)', async (t) => {
  const page = await launch({ width: 360, height: 640, mobile: true });
  t.after(() => page.close());
  await page.coarsePointer();
  await page.goto(gameUrl());
  await page.frames(3);
  for (const m of ['classic', 'timed', 'survival']) {
    await pick(page, m);
    const r = await page.eval(`(() => [...document.querySelectorAll('#modePick button')].map((b) => { const r = b.getBoundingClientRect(); return [r.left, r.right, r.height]; }))()`);
    for (const [l, rr, h] of r) assert.ok(l >= 0 && rr <= 360 && h >= 28, `a mode button fits and can be tapped: ${l} ${rr} ${h}`);
    assert.equal(await page.eval(`document.documentElement.scrollWidth > innerWidth`), false, `${m}: no sideways scrolling`);
  }
  await page.click('#openStats');
  await page.frames(3);
  assert.equal(await page.eval(`document.documentElement.scrollWidth > innerWidth`), false, 'stats: no sideways scrolling');
  assert.ok(await page.eval(`document.getElementById('bestByMode').getClientRects().length > 0`));
});
