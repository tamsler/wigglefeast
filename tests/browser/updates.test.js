// Offline play and the release update flow (offline-app and release-updates specs, #15).
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, gameUrl, sleep } = require('../helpers/browser');
const { serve } = require('../helpers/server');

const SW = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
const CURRENT = SW.match(/^const VERSION = '([^']+)';/m)[1];
const FILES = [...SW.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

const caches = (page) => page.eval(`caches.keys().then((k) => k.sort())`);
const waiting = (page) => page.eval(`navigator.serviceWorker.getRegistration().then((r) => !!(r && r.waiting))`);
const checkForUpdate = (page) => page.eval(`navigator.serviceWorker.getRegistration().then((r) => r.update()).then(() => true, () => true)`);
const bannerShown = (page) => page.eval(`!document.getElementById('updateBanner').classList.contains('hidden')`);
const versionLabel = (page) => page.eval(`document.getElementById('version').textContent`);

test('offline play and release updates', async (t) => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-updates-'));
  let page, server;
  t.after(async () => { if (page) await page.close(); if (server) await server.close(); fs.rmSync(profile, { recursive: true, force: true }); });
  server = await serve();
  page = await launch({ profile });

  await t.test('first visit installs the whole release and does not reload itself', async () => {
    await page.goto(server.url);
    await page.waitFor(`navigator.serviceWorker.controller`, 'service worker to take control');
    await page.eval('window.__marker = 1');
    await page.waitFor(`document.getElementById('version').textContent`, 'version label');
    assert.equal(await versionLabel(page), `v${CURRENT}`);
    assert.deepEqual(await caches(page), [`wigglefeast-${CURRENT}`]);
    const cached = await page.eval(`caches.open('wigglefeast-${CURRENT}').then((c) => c.keys()).then((k) => k.map((r) => new URL(r.url).pathname.slice(1)).sort())`);
    assert.deepEqual(cached, [...FILES].sort(), 'every file in FILES is cached, and nothing else');
    await sleep(1500);
    assert.equal(await page.eval('window.__marker'), 1, 'page was not reloaded');
  });

  await t.test('loads and plays with the server offline', async () => {
    server.setOnline(false);
    await page.reload();
    await page.waitFor(`document.getElementById('version').textContent`, 'version label offline');
    assert.equal(await versionLabel(page), `v${CURRENT}`);
    await page.startRun();
    await page.press('KeyP');
    await page.click('#endRun');
    server.setOnline(true);
  });

  await t.test('a new release waits during a run, shows on pause, and Reload resumes the run', async () => {
    server.setVersion('90.0.0-test');
    await page.reload();
    await page.startRun();
    await checkForUpdate(page);
    await page.waitFor(`navigator.serviceWorker.getRegistration().then((r) => !!(r && r.waiting))`, 'new release downloaded');
    await page.frames(10);
    assert.equal(await bannerShown(page), false, 'no banner during a run');
    await page.press('KeyP');
    await page.waitFor(`!document.getElementById('updateBanner').classList.contains('hidden')`, 'banner on pause');
    assert.equal(await page.eval(`document.getElementById('updateText').textContent`), 'Version 90.0.0-test is ready');
    // The HUD refreshes every 0.15 s, so wait until it shows the paused worm's real score.
    const score = await page.waitFor(`(() => { const t = document.getElementById('score').textContent;
      return t === Math.round(window.__player.mass).toLocaleString() && t; })()`, 'HUD score to catch up');
    await page.click('#updateReload');
    await page.waitFor(`document.getElementById('version').textContent === 'v90.0.0-test'`, 'new version after reload');
    await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'resume panel after reload');
    assert.match(await page.eval(`document.getElementById('pausedTitle').textContent`), /Welcome back/);
    assert.equal(await page.eval(`document.getElementById('score').textContent`), score, 'same score after reload');
    assert.equal(await page.eval(`window.__player && window.__player.name`), 'Tester', 'restored player visible to tests');
    assert.deepEqual(await caches(page), ['wigglefeast-90.0.0-test']);
  });

  await t.test('the banner appears on the death screen (#15)', async () => {
    await page.click('#endRun');
    await page.startRun();
    server.setVersion('91.0.0-test');
    await checkForUpdate(page);
    await page.waitFor(`navigator.serviceWorker.getRegistration().then((r) => !!(r && r.waiting))`, 'new release downloaded');
    await page.frames(10);
    assert.equal(await bannerShown(page), false, 'no banner during a run');
    await page.eval('window.__game.kill(window.__player, null)');
    await page.waitFor(`!document.getElementById('updateBanner').classList.contains('hidden')`, 'banner on death screen');
    await page.click('#updateReload');
    await page.waitFor(`document.getElementById('version').textContent === 'v91.0.0-test'`, 'new version after reload');
    assert.equal(await page.eval(`!document.getElementById('menu').classList.contains('hidden')`), true, 'back on the main menu');
  });

  await t.test('a dismissed update takes over on the next launch', async () => {
    server.setVersion('92.0.0-test');
    await checkForUpdate(page);
    await page.waitFor(`navigator.serviceWorker.getRegistration().then((r) => !!(r && r.waiting))`, 'new release downloaded');
    await page.waitFor(`!document.getElementById('updateBanner').classList.contains('hidden')`, 'banner on menu');
    await page.click('#updateDismiss');
    await page.frames(5);
    assert.equal(await bannerShown(page), false, 'dismissed');
    assert.equal(await versionLabel(page), 'v91.0.0-test', 'still the current release');
    await page.close();
    page = await launch({ profile });
    await page.goto(server.url);
    await page.waitFor(`document.getElementById('version').textContent === 'v92.0.0-test'`, 'new release after relaunch');
    assert.deepEqual(await caches(page), ['wigglefeast-92.0.0-test']);
    assert.equal(await waiting(page), false);
  });

  await t.test('opened from disk it shows "local" and has no service worker', async () => {
    await page.goto(gameUrl());
    await page.waitFor(`document.getElementById('version').textContent`, 'version label');
    assert.equal(await versionLabel(page), 'local');
    assert.deepEqual(page.exceptions, []);
  });
});
