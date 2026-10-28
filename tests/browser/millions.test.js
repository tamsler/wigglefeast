// Worms in the millions (#204): big scores show in full on every screen, are recorded, and survive
// export and import. Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, gameUrl, sleep } = require('../helpers/browser');

// The text of every number fits its box, in the given elements.
const FITS = (selector) => `[...document.querySelectorAll(${JSON.stringify(selector)})].map((e) => ({ text: e.textContent, fits: e.scrollWidth <= e.clientWidth + 0.5 }))`;

for (const [label, opts] of [['desktop', { width: 1280, height: 720 }], ['phone portrait', { width: 360, height: 640, mobile: true }]]) {
  test(`scores in the millions show in full on every screen and survive export and import (${label}, #204)`, async (t) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-millions-'));
    let page;
    t.after(async () => { if (page) await page.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
    page = await launch(opts);
    if (opts.mobile) await page.coarsePointer();
    await page.goto(gameUrl());
    await page.startRun();
    await page.eval('window.__player.shield = 1e9');

    await t.test('the score area', async () => {
      await page.eval('window.__player.mass = 1234567');
      await page.waitFor(`/^1,2\\d\\d,\\d{3}$/.test(document.getElementById('score').textContent)`, 'the score in full (the worm may eat a little on the way)');
      const [m] = await page.eval(FITS('#score'));
      assert.ok(m.fits, 'the score is not clipped');
    });

    await t.test('the game-over summary', async () => {
      await page.eval(`(() => { const p = window.__player; p.mass = 3456789; p.peak = 3456789; p.shield = 0; window.__game.kill(p, null); })()`);
      await page.waitFor(`!document.getElementById('death').classList.contains('hidden')`, 'the game-over screen');
      assert.equal(await page.eval(`document.getElementById('dScore').textContent`), '3,456,789');
      assert.equal(await page.eval(`document.getElementById('dPeak').textContent`), '3,456,789');
      assert.match(await page.eval(`document.getElementById('dBest').textContent`), /personal best/i);
      for (const m of await page.eval(FITS('#death .grid b'))) assert.ok(m.fits, `${m.text} is clipped`);
    });

    await t.test('the stats screen', async () => {
      await page.click('#toMenu');
      await page.click('#openStats');
      await page.waitFor(`!document.getElementById('statsScreen').classList.contains('hidden')`, 'the stats screen');
      const text = await page.eval(`document.getElementById('statsScreen').textContent`);
      assert.ok(text.includes('3,456,789'), 'the best score and the top run show it in full');
      assert.equal(await page.eval(`document.querySelector('#statsScreen .panel').scrollWidth <= document.querySelector('#statsScreen .panel').clientWidth + 0.5`), true, 'nothing overflows sideways');
      for (const m of await page.eval(FITS('#totals b, #bestByDiff b'))) assert.ok(m.fits, `${m.text} is clipped`);
      const stored = JSON.parse(await page.eval(`localStorage.getItem('wormarena.profile')`));
      assert.equal(stored.totals.best, 3456789);
      assert.equal(stored.top[0].peak, 3456789);
    });

    await t.test('export, then import into a fresh profile', async () => {
      const dl = path.join(tmp, 'downloads');
      fs.mkdirSync(dl);
      await page.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
      await page.click('#exportSave');
      let file, save;
      for (let i = 0; i < 100 && !save; i++) {
        await sleep(100);
        file = fs.readdirSync(dl).find((f) => f.endsWith('.json'));
        try { save = file && JSON.parse(fs.readFileSync(path.join(dl, file), 'utf8')); } catch { /* still writing */ }
      }
      assert.ok(save, 'export finished writing');
      assert.equal(save.profile.totals.best, 3456789);

      await page.eval(`localStorage.removeItem('wormarena.profile')`);
      await page.reload();
      await page.click('#openStats');
      assert.ok(!(await page.eval(`document.getElementById('statsScreen').textContent`)).includes('3,456,789'), 'the fresh profile starts empty');

      page.dialogs.length = 0;
      await page.setFile('#importFile', path.join(dl, file));
      await page.waitForDialog(/Replace your current/);
      await page.waitFor(`JSON.parse(localStorage.getItem('wormarena.profile')).totals.best === 3456789`, 'the imported best');
    });
  });
}
