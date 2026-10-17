// Save import/export and stored-data safety (#18, #19, #26). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, gameUrl, sleep } = require('../helpers/browser');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'save-v1.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const PAYLOAD = '<img src="nope.png" onerror="window.pwned=true">';

test('save import and stored data', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-import-'));
  let page;
  t.after(async () => { if (page) await page.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  page = await launch();

  const storedProfile = () => page.eval(`localStorage.getItem('wormarena.profile')`);
  const importFile = async (name, data) => {
    const file = path.join(tmp, name);
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
    page.dialogs.length = 0;
    await page.setFile('#importFile', file);
    // The import handler either rejects (one alert, then returns) or asks to confirm
    // and then applies synchronously, so this dialog marks the decision point.
    const dialogs = await page.waitForDialog(/Nothing was changed|Replace your current/);
    await page.frames(5);
    return dialogs;
  };

  await page.goto(gameUrl());
  await page.startRun();
  await page.press('KeyP');
  await page.click('#endRun');
  await page.click('#openStats');

  await t.test('export downloads a save with the recorded run', async () => {
    const dl = path.join(tmp, 'downloads');
    fs.mkdirSync(dl);
    await page.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
    await page.click('#exportSave');
    let file;
    for (let i = 0; i < 100 && !file; i++) { await sleep(100); file = fs.readdirSync(dl).find((f) => f.endsWith('.json')); }
    assert.ok(file, 'export produced a file');
    const save = JSON.parse(fs.readFileSync(path.join(dl, file), 'utf8'));
    assert.equal(save.app, 'wigglefeast');
    assert.equal(save.profile.recent.length, 1);
    assert.ok(save.world);
  });

  const before = await storedProfile();

  await t.test('a save carrying HTML/JS is rejected and nothing runs (#18)', async () => {
    const d = clone(fixture);
    d.profile.top[0].diff = PAYLOAD;
    d.profile.recent[0].diff = PAYLOAD;
    const dialogs = await importFile('payload.json', d);
    assert.ok(dialogs.some((m) => /not a valid Wigglefeast save/.test(m)), JSON.stringify(dialogs));
    assert.notEqual(await page.eval('window.pwned'), true);
    assert.equal(await storedProfile(), before);
  });

  await t.test('an invalid world is rejected before confirmation and changes nothing (#19)', async () => {
    const d = clone(fixture);
    d.profile.totals.best = 987654321;
    d.world.app = 'not-a-save';
    const dialogs = await importFile('bad-world.json', d);
    assert.ok(dialogs.some((m) => /Nothing was changed/.test(m)));
    assert.ok(!dialogs.some((m) => /Replace your current/.test(m)), 'did not ask to confirm');
    assert.equal(await storedProfile(), before);
  });

  await t.test('an incomplete profile is rejected (#19)', async () => {
    const d = clone(fixture);
    d.profile = { v: 1, totals: { games: 1 }, top: [], recent: [] };
    assert.ok((await importFile('bad-profile.json', d)).some((m) => /Nothing was changed/.test(m)));
    assert.equal(await storedProfile(), before);
  });

  await t.test('a malformed worm is rejected (#19)', async () => {
    const d = clone(fixture);
    d.world.worms[0].sx = 'oops';
    assert.ok((await importFile('bad-worm.json', d)).some((m) => /Nothing was changed/.test(m)));
    assert.equal(await storedProfile(), before);
  });

  await t.test('a valid save imports and shows on the stats screen', async () => {
    const dialogs = await importFile('valid.json', fixture);
    assert.ok(dialogs.some((m) => /Replace your current/.test(m)));
    await page.waitFor(`JSON.parse(localStorage.getItem('wormarena.profile')).totals.best === 530`, 'imported best');
    // The fixture world has a live player, so the game resumes on "Welcome back".
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'welcome back panel');
    assert.match(await page.eval(`document.getElementById('pausedTitle').textContent`), /Welcome back/);
  });

  await t.test('a save from before the rename (worm-arena) imports', async () => {
    await page.click('#endRun');
    await page.click('#openStats');
    const d = clone(fixture);
    d.app = 'worm-arena';
    d.world.app = 'worm-arena';
    d.profile.totals.best = 777;
    await importFile('legacy.json', d);
    await page.waitFor(`JSON.parse(localStorage.getItem('wormarena.profile')).totals.best === 777`, 'legacy import');
  });

  const startupWith = async (key, value) => {
    await page.eval(`localStorage.removeItem('wormarena.profile-corrupt'); localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`);
    page.exceptions.length = 0;
    await page.reload();
    await page.waitFor(`document.getElementById('menu').classList.contains('hidden') === false || !document.getElementById('paused').classList.contains('hidden')`, 'menu or resume panel');
    const frames = await page.eval(`new Promise((r) => { let n = 0; const f = () => (++n < 5 ? requestAnimationFrame(f) : r(n)); requestAnimationFrame(f); })`);
    assert.equal(frames, 5, 'game loop running');
    assert.deepEqual(page.exceptions, []);
  };

  await t.test('a stored profile with missing fields no longer stops startup (#19)', async () => {
    await startupWith('wormarena.profile', JSON.stringify({ v: 1, totals: { games: 1 }, top: [], recent: [] }));
    assert.ok(await page.eval(`localStorage.getItem('wormarena.profile-corrupt') !== null`), 'kept as backup');
    assert.equal(await page.eval(`JSON.parse(localStorage.getItem('wormarena.profile')).totals.games`), 0);
  });

  await t.test('a stored payload never runs (#18)', async () => {
    const p = clone(fixture.profile);
    p.top[0].diff = PAYLOAD;
    await startupWith('wormarena.profile', JSON.stringify(p));
    await page.eval(`document.getElementById('menu').classList.contains('hidden') || document.getElementById('openStats').click()`);
    await page.frames(10);
    assert.notEqual(await page.eval('window.pwned'), true);
  });

  await t.test('profile text that is not JSON is backed up verbatim', async () => {
    await startupWith('wormarena.profile', '{not json');
    assert.equal(await page.eval(`localStorage.getItem('wormarena.profile-corrupt')`), '{not json');
  });

  await t.test('corrupted stored settings fall back to defaults (#26)', async () => {
    await page.eval(`localStorage.removeItem('wormarena.world')`);
    await startupWith('wormarena.settings', JSON.stringify({ name: 42, skin: 99, botCount: 'x', difficulty: '__proto__' }));
    assert.equal(await page.eval(`document.getElementById('skinName').textContent`), 'Cherry Pop');
    assert.equal(await page.eval(`document.getElementById('botCountVal').textContent`), '30');
  });
});
