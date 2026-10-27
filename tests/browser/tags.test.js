// Reputation tags on worm names (#83, #126). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, gameUrl, sleep } = require('../helpers/browser');

test('reputation tags', async (t) => {
  let page;
  t.after(() => page && page.close());
  page = await launch();
  await page.goto(gameUrl());
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');
  await page.press('KeyP');
  await page.waitFor(`!document.getElementById('paused').classList.contains('hidden')`, 'the game to pause');

  // Three bots placed just beside the player, so their names are on screen: two kills (one of
  // them long ago); no kills; retaliating against the player.
  const names = await page.eval(`(() => {
    const g = window.__game, p = window.__player;
    const bots = g.worms.filter((w) => w.ai).slice(0, 3);
    bots.forEach((b, i) => {
      const x = p.x - 200 + i * 200, y = p.y + 150;
      for (let k = 0; k < b.sx.length; k++) { b.sx[k] = x - k * 4; b.sy[k] = y; }
      b.updateBounds();
    });
    bots[0].kills = 2;
    bots[1].kills = 0;
    bots[2].kills = 0;
    bots[2].ai.retaliating = p;
    return bots.map((b) => b.name);
  })()`);
  // Records what the next frames draw as text, with the colour each was filled in.
  const capture = async () => {
    await page.eval(`(() => {
      const proto = CanvasRenderingContext2D.prototype;
      if (!proto.__fillText) proto.__fillText = proto.fillText;
      window.__texts = [];
      proto.fillText = function (text, ...rest) { window.__texts.push({ text, fill: this.fillStyle }); return proto.__fillText.call(this, text, ...rest); };
    })()`);
    await sleep(300);
    const texts = await page.eval('window.__texts');
    return (name) => texts.filter((x) => typeof x.text === 'string' && x.text.startsWith(name));
  };
  let drawn = await capture();

  await t.test("a worm's total kills show after its name (#126)", () => {
    assert.ok(drawn(names[0]).some((x) => x.text === `${names[0]} \u2694\uFE0F2`), JSON.stringify(drawn(names[0]).slice(0, 2)));
  });

  await t.test('a worm with no kills has no tag', () => {
    const d = drawn(names[1]);
    assert.ok(d.length > 0 && d.every((x) => x.text === names[1]), JSON.stringify(d.slice(0, 2)));
  });

  await t.test("kills don't fade: a minute later the tag is the same (#126)", async () => {
    await page.eval('window.__game.time += 61');
    drawn = await capture();
    assert.ok(drawn(names[0]).some((x) => x.text === `${names[0]} \u2694\uFE0F2`), JSON.stringify(drawn(names[0]).slice(0, 2)));
  });

  await t.test("the player's own name has no tag, however many kills (#193)", async () => {
    const me = await page.eval(`(() => { window.__player.kills = 2; return window.__player.name; })()`);
    drawn = await capture();
    const d = drawn(me);
    assert.ok(d.length > 0 && d.every((x) => x.text === me && x.fill === '#ffd60a'), JSON.stringify(d.slice(0, 2)));
  });

  await t.test('a bot retaliating against the player has its name in red-orange, without a tag', () => {
    const d = drawn(names[2]);
    assert.ok(d.length > 0, 'its name is drawn');
    assert.ok(d.every((x) => x.text === names[2] && x.fill === '#ff5a1f'), JSON.stringify(d.slice(0, 2)));
  });
});

// Leaderboard rows and the score area (#193). Run with `node --test "tests/**/*.test.js"`.
const KILLS = '\u2694\uFE0F';
for (const [label, opts] of [['desktop', { width: 1280, height: 720 }], ['phone portrait', { width: 360, height: 640, mobile: true }], ['phone landscape', { width: 640, height: 360, mobile: true }]]) {
  test(`leaderboard shows kills, and the score area only the score (${label}, #193)`, async (t) => {
    let page;
    t.after(() => page && page.close());
    page = await launch(opts);
    await page.goto(gameUrl());
    await page.startRun();
    await page.eval('window.__player.shield = 1e9');
    const rowsOf = () => page.eval(`(() => {
      const panel = document.getElementById('leaderboard').getBoundingClientRect();
      return { panelWidth: panel.width, rows: [...document.querySelectorAll('#lb li:not(.gap)')].map((li) => {
        const r = (sel) => li.querySelector(sel), box = (el) => el && el.getBoundingClientRect();
        const m = box(r('.m')), k = box(r('.k')), n = box(r('.n'));
        return { me: li.classList.contains('me'), rank: r('.r').textContent, name: r('.n').textContent, kills: r('.k') && r('.k').textContent,
          scoreInside: m.right <= panel.right && m.left >= panel.left, ordered: (!k || (n.right <= k.left + 0.5 && k.right <= m.left + 0.5)), fits: li.scrollWidth <= li.clientWidth };
      }) };
    })()`);
    const before = await rowsOf();
    assert.ok(before.rows.every((r) => r.kills === null), 'nobody has killed yet: no ⚔ in any row');

    // The top worm (a bot, with a very long name) has 7 kills, the player 2.
    await page.eval(`(() => {
      const g = window.__game, p = window.__player, top = g.leaderboard.find((w) => w !== p);
      top.name = 'Averyveryveryverylongwormname'; top.kills = 7; p.kills = 2;
      g.update = () => {}; // freeze the world, so nobody's rank moves while we read the rows
    })()`);
    await page.waitFor(`document.querySelectorAll('#lb li .k').length >= 2`, 'kills in the leaderboard');
    const after = await rowsOf();
    const me = after.rows.find((r) => r.me), top = after.rows.find((r) => r.name.startsWith('Averyvery'));
    assert.equal(me.kills, `${KILLS}2`, "the player's own row shows their kills");
    assert.equal(me.rank, String(await page.eval('window.__game.rankOf(window.__player)')), "and their rank");
    assert.equal(top.kills, `${KILLS}7`, "a killer in the top 10 shows its kills");
    assert.ok(after.rows.some((r) => r.kills === null), 'a worm with no kills has no ⚔');
    assert.ok(after.rows.every((r) => r.scoreInside && r.ordered && r.fits), JSON.stringify(after.rows.filter((r) => !(r.scoreInside && r.ordered && r.fits))));
    assert.equal(after.panelWidth, before.panelWidth, 'the panel is no wider with kills in it');

    const stats = await page.eval(`document.getElementById('stats').textContent`);
    assert.ok(/\d/.test(stats) && !/Rank|Kills/i.test(stats), `the score area is only the score: ${JSON.stringify(stats)}`);
  });
}
