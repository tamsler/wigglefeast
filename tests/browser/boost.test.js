// Boost indicator: arrows in front of the head and the BOOST badge (#37, #41). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl } = require('../helpers/browser');

const shown = (sel) => `document.querySelector(${JSON.stringify(sel)}).getClientRects().length > 0`;

test('boost indicator', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  const arrows = () => page.eval('window.wigglefeastDebug.boostArrows()');
  const badge = () => page.eval(shown('#boostBadge'));
  const noArrows = () => page.waitFor('window.wigglefeastDebug.boostArrows() === 0', 'arrows to go');

  await t.test('no badge in the menu', async () => {
    assert.equal(await badge(), false);
  });

  await page.startRun();
  // Only the player in an empty world: any arrows are the player's, and no food
  // or power-up can change whether it is able to boost.
  await page.eval(`const g = window.__game;
    Object.assign(g, { worms: [window.__player], respawnQueue: [], food: [], powerups: [], foodTarget: 0, powerupTarget: 0 });
    g.settings.botCount = 0; g.rebuildFoodGrid();
    Object.assign(window.__player, { shield: 1e9, mass: 200 })`);

  await t.test('not boosting: no arrows and no badge', async () => {
    await noArrows();
    assert.equal(await badge(), false);
  });

  await t.test('boosting shows the arrows and the badge; releasing clears both', async () => {
    await page.key('keyDown', 'Space');
    await page.waitFor(`${shown('#boostBadge')} && window.wigglefeastDebug.boostArrows() === 1`, 'badge and arrows while boosting');
    await page.key('keyUp', 'Space');
    await page.waitFor(`!(${shown('#boostBadge')})`, 'badge to hide on release');
    await noArrows();
  });

  await t.test('boost held at mass 12 or less: nothing shows', async () => {
    await page.eval('window.__player.mass = 12');
    await page.key('keyDown', 'Space');
    await page.frames(30);
    assert.equal(await page.eval('window.__player.wantBoost'), true, 'boost is held');
    assert.equal(await badge(), false);
    assert.equal(await arrows(), 0);
    await page.key('keyUp', 'Space');
  });

  await t.test('speed power-up alone shows nothing; holding boost with it does', async () => {
    await page.eval('window.__player.pw.speed = 10');
    await page.frames(30);
    assert.equal(await badge(), false);
    assert.equal(await arrows(), 0);
    await page.key('keyDown', 'Space'); // boosting is free with the speed power-up, even at mass 12
    await page.waitFor(`${shown('#boostBadge')} && window.wigglefeastDebug.boostArrows() === 1`, 'badge and arrows with speed + boost');
    await page.key('keyUp', 'Space');
    await page.eval('window.__player.pw.speed = 0; window.__player.mass = 200');
    await page.waitFor(`!(${shown('#boostBadge')})`, 'badge to hide');
  });

  await t.test('the touch boost button shows the badge too', async () => {
    await page.coarsePointer();
    await page.waitFor(shown('#boostBtn'), 'touch buttons');
    const [x, y] = await page.center('#boostBtn');
    await page.touch('touchStart', [[1, x, y]]);
    await page.waitFor(shown('#boostBadge'), 'badge while the button is held');
    await page.touch('touchEnd', []);
    await page.waitFor(`!(${shown('#boostBadge')})`, 'badge to hide on lift');
  });

  await t.test('hidden after death', async () => {
    await page.key('keyDown', 'Space');
    await page.waitFor(shown('#boostBadge'), 'badge while boosting');
    await page.eval('window.__game.kill(window.__player, null)');
    await page.waitFor(`!(${shown('#boostBadge')})`, 'badge to hide after death');
    await page.key('keyUp', 'Space');
  });
});
