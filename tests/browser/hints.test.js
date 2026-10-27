// First-run hints (#10): steer, boost, danger, power-ups, one at a time, until each has been seen.
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, gameUrl, sleep } = require('../helpers/browser');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'save-v1.json'), 'utf8'));
const ALL = ['steer', 'boost', 'danger', 'powerups'];

// A page on a fresh browser profile, with the hints seen so far set before the game loads
// (undefined: leave the profile as a new player's). edit(profile) can reshape the stored profile.
async function open(opts, seen, edit) {
  const page = await launch(opts);
  if (opts && opts.mobile) await page.coarsePointer();
  await page.goto(gameUrl());
  if (seen !== undefined || edit) {
    // edit: a function reshaping the profile, or a whole profile object to store as it is.
    const whole = edit && typeof edit === 'object' ? JSON.stringify(edit) : 'null';
    await page.eval(`(() => {
      const p = ${whole} || window.wigglefeastDebug.profile();
      if (!${whole !== 'null'}) {
        p.tips = Object.fromEntries(${JSON.stringify(seen || [])}.map((id) => [id, 1]));
        (${typeof edit === 'function' ? edit.toString() : '() => {}'})(p);
      }
      localStorage.setItem('wormarena.profile', JSON.stringify(p));
    })()`);
    await page.reload();
  }
  return page;
}
const tips = (page) => page.eval('window.wigglefeastDebug.tips()');
const current = (page, id) => page.waitFor(`window.wigglefeastDebug.tips().current === ${JSON.stringify(id)}`, `the ${id} hint`, 12000);
const storedTips = (page) => page.eval(`Object.keys(JSON.parse(localStorage.getItem('wormarena.profile')).tips || {})`);

test('a new player gets the four hints in order, each after the one before (#10)', async (t) => {
  const page = await open({ width: 1280, height: 720 });
  t.after(() => page.close());
  await page.startRun();
  await page.eval(`window.__player.shield = 1e9`); // a bot must not end the run while the hints take their time

  await current(page, 'steer');
  assert.equal(await page.eval(`document.querySelector('#tip .desk').textContent`), 'Move the mouse to steer');
  assert.equal(await page.eval(`getComputedStyle(document.querySelector('#tip .touch')).display`), 'none', 'desktop wording only');

  // Turning at once doesn't end it: every hint stays at least 2.5 seconds.
  await page.key('keyDown', 'ArrowLeft');
  await sleep(1200);
  assert.equal((await tips(page)).current, 'steer', 'still up after 1.2 s of turning');
  await current(page, 'boost');
  await page.key('keyUp', 'ArrowLeft');

  // It waits for the player to boost, however long that takes.
  await sleep(3200);
  assert.equal((await tips(page)).current, 'boost');
  await page.key('keyDown', 'Space');
  await current(page, 'danger');
  await page.key('keyUp', 'Space');
  assert.match(await page.eval(`document.querySelector('#tip .desk').textContent`), /Don't hit other worms with your head/);

  // The last two end by themselves after 6 seconds on screen.
  await page.waitFor(`window.wigglefeastDebug.tips().current === 'powerups'`, 'the power-up hint', 9000);
  await page.waitFor(`window.wigglefeastDebug.tips().current === null && window.wigglefeastDebug.tips().seen.length === 4`, 'all four seen', 9000);
  assert.deepEqual((await storedTips(page)).sort(), [...ALL].sort(), 'saved with the profile as they were seen');
});

test('collecting a power-up ends the power-up hint (#10)', async (t) => {
  const page = await open({ width: 1280, height: 720 }, ['steer', 'boost', 'danger']);
  t.after(() => page.close());
  await page.startRun();
  await current(page, 'powerups');
  await sleep(2700); // past its 2.5 s minimum
  await page.eval(`(() => { const g = window.__game, p = window.__player; g.emit('powerup', { worm: p, type: 'magnet' }); })()`);
  await page.waitFor(`window.wigglefeastDebug.tips().seen.includes('powerups')`, 'the hint to end', 3000);
});

test('pausing hides the hint and stops its clock (#10)', async (t) => {
  const page = await open({ width: 1280, height: 720 });
  t.after(() => page.close());
  await page.startRun();
  await current(page, 'steer');
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the pause panel');
  assert.equal((await tips(page)).current, null, 'hidden while paused');
  await sleep(3500); // longer than its minimum: it must not count
  await page.press('KeyP');
  await current(page, 'steer');
  // Turn straight away: if the paused seconds had counted, it would end at once.
  await page.key('keyDown', 'ArrowLeft');
  await sleep(700);
  assert.equal((await tips(page)).current, 'steer', 'still up: the paused time did not count');
  await page.key('keyUp', 'ArrowLeft');
});

test('hints leave a player who has seen them alone, and older profiles count by games played (#10)', async (t) => {
  await t.test('all four seen: nothing shows', async () => {
    const page = await open({ width: 1280, height: 720 }, ALL);
    try {
      await page.startRun();
      await sleep(3000);
      assert.equal((await tips(page)).current, null);
      assert.equal(await page.eval(`document.getElementById('tip').classList.contains('on')`), false);
    } finally { await page.close(); }
  });

  await t.test('the first hint seen is skipped on the next run', async () => {
    const page = await open({ width: 1280, height: 720 }, ['steer']);
    try {
      await page.startRun();
      await current(page, 'boost');
    } finally { await page.close(); }
  });

  await t.test('a profile from before hints, with games played, has seen everything', async () => {
    const page = await open({ width: 1280, height: 720 }, undefined, (p) => { delete p.tips; p.totals.games = 2; });
    try {
      assert.deepEqual((await tips(page)).seen.sort(), [...ALL].sort());
      await page.startRun();
      await sleep(2500);
      assert.equal((await tips(page)).current, null);
    } finally { await page.close(); }
  });

  await t.test('the committed save-v1.json profile (2 games) shows no hints', async () => {
    const page = await open({ width: 1280, height: 720 }, undefined, fixture.profile);
    try {
      assert.deepEqual((await tips(page)).seen.sort(), [...ALL].sort());
    } finally { await page.close(); }
  });

  await t.test('a profile from before hints, with no games, still gets them', async () => {
    const page = await open({ width: 1280, height: 720 }, undefined, (p) => { delete p.tips; p.totals.games = 0; });
    try {
      assert.deepEqual((await tips(page)).seen, []);
      await page.startRun();
      await current(page, 'steer');
    } finally { await page.close(); }
  });

  await t.test('unknown or damaged entries are dropped without losing the profile', async () => {
    const page = await open({ width: 1280, height: 720 }, undefined, (p) => { p.tips = { steer: 5, bogus: 3, boost: -1, danger: 'x', powerups: null }; });
    try {
      assert.deepEqual((await tips(page)).seen, ['steer']);
      assert.ok(await page.eval('window.wigglefeastDebug.profile().totals.games >= 0'), 'the profile loaded');
    } finally { await page.close(); }
  });
});

test('touch screens get the touch wording (#10)', async (t) => {
  const page = await open({ width: 360, height: 640, mobile: true });
  t.after(() => page.close());
  await page.startRun();
  await current(page, 'steer');
  assert.equal(await page.eval(`getComputedStyle(document.querySelector('#tip .desk')).display`), 'none');
  assert.equal(await page.eval(`document.querySelector('#tip .touch').textContent`), 'Drag to steer');
});

// The hint sits clear of every other HUD element and of the player's head, which the camera holds at
// the middle of the screen, and it takes no clicks. The longest text is the boost hint.
for (const [label, opts] of [['desktop', { width: 1280, height: 720 }], ['small desktop window', { width: 800, height: 600 }],
  ['phone portrait', { width: 360, height: 640, mobile: true }], ['phone landscape', { width: 640, height: 360, mobile: true }]]) {
  test(`the hint doesn't overlap the HUD, the head, or take input (${label}, #10)`, async (t) => {
    const page = await open(opts, ['steer']);
    t.after(() => page.close());
    await page.startRun();
    await current(page, 'boost');
    await page.eval(`window.__player.shield = 1e9`);
    await sleep(400); // the fade-in
    const m = await page.eval(`(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const tip = box(document.getElementById('tip'));
      const others = ['#stats', '#leaderboard', '#minimap', '#powerups', '#boostBtn', '#pauseBtn', '#feed']
        .map((s) => [s, document.querySelector(s)]).filter(([, el]) => el && el.getClientRects().length > 0 && box(el).w > 0)
        .map(([s, el]) => [s, box(el)]);
      const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const cx = innerWidth / 2, cy = innerHeight / 2, head = 40; // the head's neighbourhood, in CSS pixels
      const nearHead = tip.l < cx + head && tip.r > cx - head && tip.t < cy + head && tip.b > cy - head;
      const at = document.elementFromPoint(tip.l + tip.w / 2, tip.t + tip.h / 2);
      return { tip, overlaps: others.filter(([, b]) => hit(tip, b)).map(([s]) => s), nearHead, inside: tip.l >= 0 && tip.r <= innerWidth && tip.b <= innerHeight,
        pointerEvents: getComputedStyle(document.getElementById('tip')).pointerEvents, takesHits: !!at && !!at.closest('#tip'), role: document.getElementById('tip').getAttribute('role') };
    })()`);
    assert.deepEqual(m.overlaps, [], `overlaps ${m.overlaps}`);
    assert.equal(m.nearHead, false, 'clear of the head');
    assert.equal(m.inside, true, 'inside the screen');
    assert.equal(m.pointerEvents, 'none');
    assert.equal(m.takesHits, false, 'a click or tap at the hint goes through it');
    assert.equal(m.role, 'status');
  });
}

test('Show tips again turns them back on; Reset stats leaves them alone (#10)', async (t) => {
  const page = await open({ width: 1280, height: 720 }, ALL);
  t.after(() => page.close());
  await page.startRun();
  await sleep(1500);
  assert.equal((await tips(page)).current, null);
  await page.press('KeyP');
  await page.click('#endRun');
  await page.click('#openStats');

  // Reset stats keeps what was seen.
  await page.click('#resetStats');
  await page.frames(3);
  assert.deepEqual((await storedTips(page)).sort(), [...ALL].sort(), 'tips kept after Reset stats');

  await page.click('#showTips');
  assert.match(await page.eval(`document.getElementById('showTips').textContent`), /Tips on/);
  assert.deepEqual(await storedTips(page), [], 'forgotten and saved');
  await page.click('#closeStats');
  await page.startRun();
  await current(page, 'steer');
});

test('importing a save carries its seen hints (#10)', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-hints-'));
  const page = await open({ width: 1280, height: 720 }, ALL);
  t.after(async () => { await page.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  const save = JSON.parse(JSON.stringify(fixture));
  save.profile.tips = { steer: 1, boost: 2 };
  const file = path.join(tmp, 'save.json');
  fs.writeFileSync(file, JSON.stringify(save));
  await page.startRun();
  await page.press('KeyP');
  await page.click('#endRun');
  await page.click('#openStats');
  page.dialogs.length = 0;
  await page.setFile('#importFile', file);
  await page.waitForDialog(/Replace your current/);
  await page.frames(5);
  assert.deepEqual((await tips(page)).seen.sort(), ['boost', 'steer']);
});

test('a mouse window too short to fit the hint shows none, and none count as seen (#10)', async (t) => {
  const page = await open({ width: 640, height: 360 });
  t.after(() => page.close());
  await page.startRun();
  await page.eval(`window.__player.shield = 1e9`);
  await page.key('keyDown', 'ArrowLeft');
  await sleep(3500); // long enough to have ended the steer hint if it had been showing
  await page.key('keyUp', 'ArrowLeft');
  assert.deepEqual(await tips(page), { current: null, seen: [] });
});
