// One active game across tabs and windows (#45). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');
const { serve } = require('../helpers/server');

test('a second tab shares storage with the first', async (t) => {
  let page, other, server;
  t.after(async () => { if (other) await other.close(); if (page) await page.close(); if (server) await server.close(); });
  server = await serve();
  page = await launch();
  other = await page.newTab();
  for (const [where, url] of [['http', server.url + 'tests/fixtures/save-v1.json'], ['file://', gameUrl()]]) {
    await page.goto(url);
    await other.goto(url);
    await other.eval(`window.__events = []; addEventListener('storage', (e) => window.__events.push(e.key))`);
    await page.eval(`localStorage.setItem('probe', ${JSON.stringify(where)})`);
    // Chrome copies localStorage between tabs asynchronously, so the other tab may see the old
    // value for a moment (#162): wait for it rather than reading once.
    await other.waitFor(`localStorage.getItem('probe') === ${JSON.stringify(where)}`, `${where}: storage is shared`, 5000);
    await page.frames(5);
    const events = await other.eval('window.__events');
    // The game must not rely on these events (design decision 3); this just records what Chrome does.
    t.diagnostic(`${where}: storage event delivered to the other tab: ${events.includes('probe')}`);
    if (where === 'http') assert.ok(events.includes('probe'), 'storage events reach other tabs over http');
  }
});

test('one active game across tabs (#45)', async (t) => {
  let a, b, server;
  t.after(async () => { if (b) await b.close(); if (a) await a.close(); if (server) await server.close(); });
  server = await serve();
  a = await launch();
  const standby = (p) => p.eval(`!document.getElementById('standby').classList.contains('hidden')`);
  const front = (p) => p.send('Page.bringToFront');

  await t.test('the first tab is active, and stays active after a reload', async () => {
    await a.goto(server.url);
    assert.equal(await standby(a), false);
    await a.reload();
    assert.equal(await standby(a), false, 'a reload does not show the panel');
  });

  await t.test('a second tab stands by, frozen', async () => {
    b = await a.newTab();
    await b.goto(server.url);
    await front(b);
    assert.equal(await standby(b), true, 'panel in the second tab');
    const t0 = await b.eval('window.__game.time');
    await b.frames(10);
    assert.equal(await b.eval('window.__game.time'), t0, 'its world does not advance');
    await front(a);
    assert.equal(await standby(a), false, 'the first tab keeps playing');
  });

  await t.test('a standby tab never writes to storage', async () => {
    await a.startRun('Alpha');
    await a.eval('window.__player.shield = 1e5'); // within save validation (#46), so a handed-over world restores
    // Record every storage write tab B makes; tab A keeps autosaving meanwhile, as it should.
    await b.eval(`window.__writes = []; for (const m of ['setItem', 'removeItem']) {
      const orig = Storage.prototype[m];
      Storage.prototype[m] = function (k, ...rest) { window.__writes.push(m + ' ' + k); return orig.call(this, k, ...rest); };
    }`);
    await b.eval(`window.dispatchEvent(new Event('beforeunload')); window.dispatchEvent(new Event('pagehide'))`);
    await new Promise((r) => setTimeout(r, 11000)); // past tab B's 10 s autosave and its heartbeats
    assert.deepEqual(await b.eval('window.__writes'), [], 'no writes from the standby tab');
  });

  await t.test('Play here hands a run in progress over to this tab', async () => {
    await front(b);
    await b.click('#playHere');
    await b.waitFor(`document.getElementById('pausedTitle').textContent.includes('Welcome back') && !document.getElementById('paused').classList.contains('hidden')`, 'welcome back in B');
    await a.waitFor(`!document.getElementById('standby').classList.contains('hidden')`, 'A on the panel');
    const score = Math.round(await a.eval('window.__player.mass')).toLocaleString();
    const text = await b.eval(`document.getElementById('pausedText').textContent`);
    assert.match(text, /Alpha/);
    assert.ok(text.includes(score), `same score as A when it handed over (${score}): ${text}`);
  });

  await t.test('runs finished in both tabs are kept', async () => {
    await b.click('#endRun'); // Alpha's run, now in B
    await b.waitFor(`JSON.parse(localStorage.getItem('wormarena.profile')).totals.games === 1`, 'first run recorded');
    await front(a);
    await a.click('#playHere');
    await a.waitFor(`!document.getElementById('menu').classList.contains('hidden')`, 'A back at the menu');
    await a.startRun('Beta');
    await a.press('KeyP');
    await a.click('#endRun');
    const profile = await a.eval(`JSON.parse(localStorage.getItem('wormarena.profile'))`);
    assert.equal(profile.totals.games, 2);
    assert.deepEqual(profile.recent.map((r) => r.name).sort(), ['Alpha', 'Beta']);
    assert.equal(await standby(b), true, 'B stood by when A took over');
  });

  await t.test('a run is added to stats another writer changed meanwhile', async () => {
    await a.eval(`{ const p = JSON.parse(localStorage.getItem('wormarena.profile'));
      p.recent.unshift({ ...p.recent[0], name: 'Elsewhere', date: Date.now() }); p.totals.games++;
      localStorage.setItem('wormarena.profile', JSON.stringify(p)); }`);
    await a.startRun('Gamma');
    await a.press('KeyP');
    await a.click('#endRun');
    const profile = await a.eval(`JSON.parse(localStorage.getItem('wormarena.profile'))`);
    assert.equal(profile.totals.games, 4);
    assert.ok(['Elsewhere', 'Gamma'].every((n) => profile.recent.some((r) => r.name === n)));
  });

  await t.test('a stale owner is taken over at once; an unresponsive one after about 2 s', async () => {
    await front(b);
    await b.eval(`localStorage.setItem('wormarena.session', JSON.stringify({ id: 'gone', at: Date.now() - 10000 }))`);
    let t0 = Date.now();
    await b.click('#playHere');
    await b.waitFor(`document.getElementById('standby').classList.contains('hidden')`, 'B takes over');
    assert.ok(Date.now() - t0 < 1500, 'a stale session is taken over without waiting');
    await a.waitFor(`!document.getElementById('standby').classList.contains('hidden')`, 'A stands by');

    // A session that looks alive but never answers (e.g. a frozen window).
    await b.eval(`localStorage.setItem('wormarena.session', JSON.stringify({ id: 'frozen', at: Date.now() }))`);
    await b.waitFor(`!document.getElementById('standby').classList.contains('hidden')`, 'B notices it lost the session');
    t0 = Date.now();
    await b.click('#playHere');
    await b.waitFor(`document.getElementById('standby').classList.contains('hidden')`, 'B takes over after waiting');
    const waited = Date.now() - t0;
    assert.ok(waited >= 1800 && waited < 4000, `waited ${waited} ms`);
  });

  const games = (p) => p.eval(`JSON.parse(localStorage.getItem('wormarena.profile')).totals.games`);

  await t.test('taking over picks up the other window\'s settings', async () => {
    await b.startRun('Zed'); // B is active: stores name Zed
    await b.press('KeyP');
    await b.click('#endRun');
    await front(a);
    await a.click('#playHere');
    await a.waitFor(`document.getElementById('standby').classList.contains('hidden')`, 'A takes over');
    assert.equal(await a.eval(`document.getElementById('name').value`), 'Zed');
  });

  await t.test('a run that ends after another window took over is not recorded or shown', async () => {
    await a.startRun('Late');
    const before = await games(a);
    // Another window takes over, and this one dies before noticing (same instant).
    await a.eval(`localStorage.setItem('wormarena.session', JSON.stringify({ id: 'other', at: Date.now() })); window.__game.kill(window.__player, null)`);
    await new Promise((r) => setTimeout(r, 1500)); // past the death screen's delay
    assert.equal(await standby(a), true, 'standby panel');
    assert.equal(await a.eval(`document.getElementById('death').classList.contains('hidden')`), true, 'no death screen over the panel');
    assert.equal(await games(a), before, 'the late run is not recorded');
  });

  await t.test('an import finished after another window took over changes nothing', async () => {
    const before = await a.eval(`localStorage.getItem('wormarena.profile')`);
    a.dialogs.length = 0;
    await a.setFile('#importFile', require('node:path').join(__dirname, '..', 'fixtures', 'save-v1.json'));
    await new Promise((r) => setTimeout(r, 500));
    assert.deepEqual(a.dialogs, [], 'no confirmation asked');
    assert.equal(await a.eval(`localStorage.getItem('wormarena.profile')`), before);
    assert.equal(await standby(a), true, 'still on the standby panel');
  });
});

// Two windows press Play here at overlapping times while the owner doesn't answer (#74).
// The first takes over after the wait; the second must then get the first one's current
// world through a handover, not take over on its old timer and restore an older save.
test('competing Play here requests hand over the newest world (#74)', async (t) => {
  let a, b, c, server;
  t.after(async () => { for (const p of [c, b, a]) if (p) await p.close(); if (server) await server.close(); });
  server = await serve();
  a = await launch();
  const standby = (p) => p.eval(`!document.getElementById('standby').classList.contains('hidden')`);
  await a.goto(server.url);
  await a.startRun('Alpha');
  await a.eval(`window.__player.shield = 1e5; window.dispatchEvent(new Event('beforeunload'))`); // saved
  const saved = await a.eval(`JSON.parse(localStorage.getItem('wormarena.world')).time`);
  b = await a.newTab();
  c = await a.newTab();
  await b.goto(server.url);
  await c.goto(server.url);
  assert.equal(await standby(b), true);
  assert.equal(await standby(c), true);

  // The owner looks alive but never answers (e.g. a frozen window).
  await a.eval(`localStorage.setItem('wormarena.session', JSON.stringify({ id: 'frozen', at: Date.now() }))`);
  await a.waitFor(`!document.getElementById('standby').classList.contains('hidden')`, 'A stands by');
  // As soon as B takes over (before any timer can run), it marks its world, so we can
  // tell B's current world from the older save.
  await b.eval(`new MutationObserver((_, o) => {
    if (!document.getElementById('standby').classList.contains('hidden')) return;
    o.disconnect(); window.__player.mass = 4321; window.__game.time += 100; window.__tookOver = true;
  }).observe(document.getElementById('standby'), { attributes: true })`);
  await b.eval(`document.getElementById('playHere').click()`);
  await new Promise((r) => setTimeout(r, 500));
  await c.eval(`document.getElementById('playHere').click()`);

  // B may hand on to C at its next tick, before a poll of the panel would see it active.
  await b.waitFor('window.__tookOver === true', 'B takes over first');
  await c.waitFor(`document.getElementById('standby').classList.contains('hidden')`, 'C takes over next');
  await b.waitFor(`!document.getElementById('standby').classList.contains('hidden')`, 'B stands by');
  const time = await c.eval('window.__game.time');
  assert.ok(time >= saved + 100, `C continues B's world (time ${time}), not the older save (time ${saved})`);
  assert.equal(Math.round(await c.eval('window.__player.mass')), 4321, 'C has B\'s worm');
  assert.equal(await c.eval(`localStorage.getItem('wormarena.handover')`), null, 'no request left behind');
  await new Promise((r) => setTimeout(r, 3000)); // nothing still waiting takes over again
  assert.equal(await standby(c), false, 'C stays active');
  assert.equal(await standby(b), true, 'B stays on standby');
});
