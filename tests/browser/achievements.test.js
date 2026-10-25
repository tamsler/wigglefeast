// Achievements and unlockable skins (#14). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl, sleep } = require('../helpers/browser');

// A valid stored profile; runs and totals overridable.
const run = (o = {}) => ({ date: 1700000000000, name: 'Me', score: 100, peak: 100, kills: 0, eaten: 10, time: 30, by: 'Bot', diff: 'normal', bots: 30, ...o });
const profile = (totals = {}, extra = {}) => ({
  v: 1,
  totals: { games: 1, kills: 0, time: 30, eaten: 10, best: 100, bestByDiff: { easy: 0, normal: 100, hard: 0, expert: 0 }, ...totals },
  top: [run()], recent: [run()], ...extra,
});
async function startWith(page, prof) {
  await page.eval(`localStorage.clear(); localStorage.setItem('wormarena.profile', ${JSON.stringify(JSON.stringify(prof))})`);
  await page.reload();
}
const ach = (page) => page.eval('window.wigglefeastDebug.achievements()');
const toasts = (page) => page.eval('window.wigglefeastDebug.toasts()');
const unlockAudio = async (page) => {
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 });
};

test('achievements from saved stats', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());

  await t.test('an older profile loads with zero counters', async () => {
    await startWith(page, profile());
    const p = await page.eval('window.wigglefeastDebug.profile()');
    assert.equal(p.totals.specials, 0);
    assert.equal(p.totals.firsts, 0);
    assert.deepEqual(p.ach, {});
  });

  await t.test('valid achievements are kept; damaged entries are dropped, not the profile', async () => {
    await startWith(page, profile({}, { ach: { board: 1700000000123, bogus: 5, snack: -1, hunter: 'yes', stargazer: null } }));
    assert.deepEqual(await ach(page), { board: 1700000000123 });
    const p = await page.eval(`JSON.parse(localStorage.getItem('wormarena.profile'))`);
    assert.equal(p.totals.games, 1, 'the rest of the profile is kept');
  });

  await t.test('past play counts, silently', async () => {
    await startWith(page, profile(
      { games: 8, kills: 120, best: 6000, bestByDiff: { easy: 0, normal: 6000, hard: 5200, expert: 10500 } },
      { top: [run({ peak: 6000, kills: 12 })], recent: [run({ time: 1260 })] },
    ));
    assert.deepEqual(Object.keys(await ach(page)).sort(), ['apex', 'expert', 'firstbite', 'hang', 'hard', 'hunter', 'marathon', 'noodle', 'snack'].sort());
    assert.deepEqual(await toasts(page), [], 'no pop-ups for past play');
  });
});

test('earning achievements in a run', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await startWith(page, profile({ specials: 24 }));
  await unlockAudio(page);
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');
  const has = (id) => page.waitFor(`!!window.wigglefeastDebug.achievements().${id}`, id);

  await t.test('reaching 1,000 earns Snack Time with a pop-up and fanfare, saved at once', async () => {
    await page.eval('window.__player.mass = 1000');
    await has('snack');
    await page.waitFor(`!document.getElementById('achToast').classList.contains('hidden')`, 'pop-up');
    assert.equal(await page.eval(`document.getElementById('achToastName').textContent`), 'Snack Time');
    assert.ok((await page.eval('window.wigglefeastDebug.sounds()')).includes('achievement'), 'fanfare');
    const stored = await page.eval(`JSON.parse(localStorage.getItem('wormarena.profile')).ach`);
    assert.ok(stored.snack > 0, 'saved before the run ends');
  });

  await t.test('the 10th kill in a run earns Hungry Hunter', async () => {
    await page.eval(`(() => { const g = window.__game, p = window.__player; p.kills = 9; g.kill(g.worms.find((w) => w.ai && !w.dead), p, 'body'); })()`);
    await has('hunter');
  });

  await t.test('the 25th special food earns Stargazer', async () => {
    await page.eval(`window.__game.emit('special', { worm: window.__player, kind: 'nova', value: 25 })`);
    await has('stargazer');
  });

  await t.test('time while paused does not count', async () => {
    await page.eval('window.__player.born = window.__game.time - 299.4');
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'pause');
    await sleep(1500);
    assert.equal((await ach(page)).hang, undefined, 'not earned while paused');
    await page.press('KeyP');
    await has('hang');
  });

  await t.test('being first on the leaderboard earns Top of the Board', async () => {
    await page.eval('window.__player.mass = 60000');
    await has('board');
  });

  await t.test('achievements earned mid-run survive a reload and are not shown again', async () => {
    await page.reload();
    const a = await ach(page);
    assert.ok(a.snack && a.hunter && a.stargazer && a.hang && a.board);
    // A later run reaching 1,000 again.
    if (await page.eval(`!document.getElementById('menu').classList.contains('hidden')`)) await page.startRun();
    else { await page.press('KeyP'); await page.waitFor(`document.getElementById('paused').classList.contains('hidden')`, 'resumed'); }
    await page.eval('window.__player.shield = 1e9; window.__player.mass = Math.max(window.__player.mass, 2000)');
    await sleep(1200);
    assert.ok(!(await toasts(page)).includes('snack'), 'Snack Time is not shown again');
  });
});

test('achievement pop-ups', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());

  await t.test('two at once show one after the other; Big Noodle says Rainbow unlocked', async () => {
    await startWith(page, profile());
    await unlockAudio(page);
    await page.startRun();
    await page.eval('window.__player.shield = 1e9; window.__player.mass = 5000');
    await page.waitFor(`window.wigglefeastDebug.toasts().length === 1`, 'first pop-up');
    assert.deepEqual(await toasts(page), ['snack'], 'one at a time');
    await page.waitFor(`window.wigglefeastDebug.toasts().length === 2`, 'second pop-up', 6000);
    assert.deepEqual(await toasts(page), ['snack', 'noodle']);
    assert.equal(await page.eval(`document.getElementById('achToastSkin').textContent`), 'Rainbow unlocked!');
  });

  await t.test('with sound off the pop-up shows but no fanfare plays', async () => {
    await page.press('KeyM'); // sound off
    const before = (await page.eval('window.wigglefeastDebug.sounds()')).length;
    await page.eval(`window.__player.kills = 0; (() => { const g = window.__game; g.kill(g.worms.find((w) => w.ai && !w.dead), window.__player, 'body'); })()`);
    await page.waitFor(`window.wigglefeastDebug.toasts().includes('firstbite')`, 'First Bite pop-up', 8000);
    const after = (await page.eval('window.wigglefeastDebug.sounds()')).slice(before);
    assert.ok(!after.includes('achievement'), `no fanfare: ${after}`);
    await page.press('KeyM');
  });
});

test('locked skins in the picker', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const skinName = () => page.eval(`document.getElementById('skinName').textContent`);

  await t.test('tapping a locked skin keeps the current one and says what unlocks it', async () => {
    await startWith(page, profile());
    assert.equal(await page.eval(`document.querySelectorAll('#skins button.locked').length`), 6);
    assert.equal(await page.eval(`document.querySelector('#skins button[title="Cosmic"]').getAttribute('aria-label')`), 'Cosmic (locked)');
    const before = await skinName();
    await page.click('#skins button[title="Cosmic"]');
    assert.equal(await skinName(), 'Reach 10,000 on Expert to unlock Cosmic');
    assert.equal(await page.eval(`JSON.parse(localStorage.getItem('wormarena.settings') || '{}').skin ?? 0`), 0);
    await page.waitFor(`document.getElementById('skinName').textContent === ${JSON.stringify(before)}`, 'name back', 6000);
  });

  await t.test('an earned reward can be picked and worn', async () => {
    await startWith(page, profile({ best: 6000, bestByDiff: { easy: 0, normal: 6000, hard: 0, expert: 0 } }));
    assert.equal(await page.eval(`document.querySelector('#skins button[title="Rainbow"]').classList.contains('locked')`), false);
    await page.click('#skins button[title="Rainbow"]');
    assert.equal(await skinName(), 'Rainbow');
    await page.startRun();
    assert.equal(await page.eval('window.__player.skin.name'), 'Rainbow');
  });

  await t.test('a reward earned during a run is unlocked back at the menu', async () => {
    await page.press('KeyP'); // end the previous run, or the reload resumes it from the autosave
    await page.click('#endRun');
    await page.waitFor(`!document.getElementById('menu').classList.contains('hidden')`, 'menu');
    await startWith(page, profile());
    await page.startRun();
    await page.eval('window.__player.shield = 1e9; window.__player.mass = 5000');
    await page.waitFor('!!window.wigglefeastDebug.achievements().noodle', 'Big Noodle');
    await page.press('KeyP');
    await page.click('#endRun');
    await page.waitFor(`!document.getElementById('menu').classList.contains('hidden')`, 'menu');
    assert.equal(await page.eval(`document.querySelector('#skins button[title="Rainbow"]').classList.contains('locked')`), false);
  });

  await t.test('a remembered locked skin still loads', async () => {
    await page.eval(`localStorage.clear(); localStorage.setItem('wormarena.settings', JSON.stringify({ name: 'Old', skin: 8, botCount: 30, difficulty: 'normal' }))`);
    await page.reload();
    assert.equal(await skinName(), 'Lavender');
    assert.equal(await page.eval(`document.querySelectorAll('#skins button.on').length`), 0, 'no swatch selected');
    await page.startRun('Old');
    assert.equal(await page.eval('window.__player.skin.name'), 'Lavender');
  });
});

test('achievements on the stats screen', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await startWith(page, profile({ best: 3200, bestByDiff: { easy: 0, normal: 3200, hard: 0, expert: 0 } }));
  await page.click('#openStats');
  await page.click('#achTitle'); // the Achievements tab
  assert.equal(await page.eval(`document.getElementById('achPane').classList.contains('hidden')`), false);
  const row = (id) => page.eval(`document.querySelector('#achList .ach[data-id="${id}"]').textContent`);
  assert.equal(await page.eval(`document.querySelectorAll('#achList .ach').length`), 14);
  assert.equal(await page.eval(`document.getElementById('achTitle').textContent`), '🏆 Achievements 1 / 14', 'Snack Time is earned');
  const noodle = await row('noodle');
  assert.match(noodle, /3,200 \/ 5,000/);
  assert.match(noodle, /Unlocks Rainbow/);
  assert.match(await row('snack'), /Earned/);
  assert.match(await row('hang'), /30s \/ 5m/, 'time goals show as durations');
});

test('achievements in exports, imports and reset', async (t) => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-ach-'));
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'save-v1.json'), 'utf8'));
  let page;
  t.after(() => { if (page) page.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  page = await launch();
  await page.goto(gameUrl());
  const importFile = async (name, data) => {
    const file = path.join(tmp, name);
    fs.writeFileSync(file, JSON.stringify(data));
    page.dialogs.length = 0;
    await page.setFile('#importFile', file);
    await page.waitForDialog(/Nothing was changed|Replace your current/);
    await page.frames(5);
  };

  await t.test('an export carries achievements and the counters', async () => {
    await startWith(page, profile({ specials: 3, firsts: 2 }, { ach: { board: 1700000000123 } }));
    await page.eval(`(() => { window.__blobs = []; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { window.__blobs.push(b); return orig(b); }; })()`);
    await page.click('#openStats');
    await page.click('#exportSave');
    const data = JSON.parse(await page.eval('window.__blobs[0].text()'));
    assert.equal(data.profile.ach.board, 1700000000123);
    assert.equal(data.profile.totals.specials, 3);
    assert.equal(data.profile.totals.firsts, 2);
  });

  await t.test('importing a save keeps its achievements; an older one earns what its stats prove', async () => {
    const withBoard = JSON.parse(JSON.stringify(fixture));
    withBoard.profile.ach = { board: 1700000000999 };
    await importFile('with-board.json', withBoard);
    assert.equal((await ach(page)).board, 1700000000999);
    await importFile('old.json', fixture); // from before achievements: no ach at all
    const a = await ach(page);
    assert.equal(a.board, undefined, 'the import replaces achievements');
    const best = fixture.profile.totals.best;
    assert.equal(!!a.snack, best >= 1000, `Snack Time follows the file's best (${best})`);
  });

  await t.test('reset stats clears achievements and locks the rewards again', async () => {
    await startWith(page, profile({ best: 6000, bestByDiff: { easy: 0, normal: 6000, hard: 0, expert: 0 } }));
    await page.click('#skins button[title="Rainbow"]');
    await page.click('#openStats');
    await page.click('#resetStats');
    await page.frames(3);
    assert.deepEqual(await ach(page), {});
    await page.click('#closeStats');
    assert.equal(await page.eval(`document.querySelector('#skins button[title="Rainbow"]').classList.contains('locked')`), true);
    assert.equal(await page.eval(`document.getElementById('skinName').textContent`), 'Rainbow', 'a picked reward stays worn until another skin is picked');
  });
});

// The Achievements tab fits a laptop screen without scrolling, like the other menus (#21).
test('the achievements tab fits a laptop screen', async (t) => {
  const page = await launch({ width: 1280, height: 713 });
  t.after(() => page.close());
  await page.goto(gameUrl());
  await page.click('#openStats');
  await page.click('#achTitle');
  await page.frames(2);
  assert.equal(await page.eval(`(() => { const p = document.querySelector('#statsScreen .panel'); return p.scrollHeight - p.clientHeight; })()`), 0);
});
