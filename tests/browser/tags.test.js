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

// Leaderboard columns and the score area (#193). Run with `node --test "tests/**/*.test.js"`.
const SIZES = [
  ['desktop', { width: 1280, height: 720 }, false],
  ['phone portrait', { width: 360, height: 640, mobile: true }, true],
  ['phone landscape', { width: 640, height: 360, mobile: true }, true],
];
for (const [label, opts, coarse] of SIZES) {
  for (const leading of [false, true]) {
    test(`leaderboard columns line up and show kills (${label}, player ${leading ? 'in the top 10' : 'below the gap'}, #193)`, async (t) => {
      let page;
      t.after(() => page && page.close());
      page = await launch(opts);
      if (coarse) await page.coarsePointer(true); // the compact leaderboard is for touch screens
      await page.goto(gameUrl());
      await page.startRun();
      await page.eval(`(() => { const p = window.__player; p.shield = 1e9; if (${leading}) p.mass = 5e4; })()`); // 50,000: about the biggest score that fits the phone columns
      if (leading) await page.waitFor(`window.__game.leaderboard[0] === window.__player`, 'the player to lead');
      // Freeze the world with everyone's kills set, so nothing moves or kills while the rows are read.
      await page.eval(`(() => {
        const g = window.__game, p = window.__player;
        for (const w of g.worms) w.kills = 0;
        const bot = g.leaderboard.find((w) => w !== p);
        bot.name = 'Averyveryveryverylongwormname'; bot.kills = 7; p.kills = 2;
        g.update = () => {};
      })()`);
      await page.waitFor(`[...document.querySelectorAll('#lb .k')].some((e) => e.textContent === '7')`, 'the kills in the leaderboard');
      const hud = await page.eval(`(() => {
        const panel = document.getElementById('leaderboard').getBoundingClientRect(), box = (el) => el.getBoundingClientRect();
        const head = [...document.querySelectorAll('#lbHead span')];
        return {
          panelRight: panel.right, headText: head.map((e) => e.textContent), headKillsRight: box(head[2]).right, headScoreRight: box(head[3]).right,
          gap: !!document.querySelector('#lb li.gap'),
          rows: [...document.querySelectorAll('#lb li:not(.gap)')].filter((li) => li.getBoundingClientRect().height > 0).map((li) => {
            const q = (sel) => li.querySelector(sel), n = box(q('.n')), k = box(q('.k')), m = box(q('.m'));
            return { me: li.classList.contains('me'), rank: q('.r').textContent, name: q('.n').textContent, kills: q('.k').textContent, quiet: q('.k').classList.contains('z'),
              killsRight: k.right, scoreRight: m.right, inside: m.right <= panel.right && n.left >= panel.left, ordered: n.right <= k.left + 0.5 && k.right <= m.left + 0.5, fits: li.scrollWidth <= li.clientWidth };
          }),
        };
      })()`);
      const me = hud.rows.find((r) => r.me), killer = hud.rows.find((r) => r.name.startsWith('Averyvery'));
      assert.deepEqual(hud.headText, ['', '', 'Kills', 'Score'], 'the columns are named');
      assert.equal(me.kills, '2', "the player's row shows their kills");
      assert.equal(me.rank, String(await page.eval('window.__game.rankOf(window.__player)')), 'and their rank');
      assert.equal(hud.gap, !leading, leading ? 'the player is in the top 10: no gap' : 'the player is below the top 10: a gap, then their row');
      assert.ok(leading ? Number(me.rank) === 1 : Number(me.rank) > 10, `rank ${me.rank}`);
      if (!leading) assert.equal(killer.kills, '7', 'a killer in the top 10 shows its kills');
      assert.ok(hud.rows.some((r) => r.kills === '0' && r.quiet), 'a worm with no kills shows a quiet 0, no icon');
      assert.ok(hud.rows.every((r) => !/\u2694/.test(r.kills)), 'no sword icons in the leaderboard');
      // Every row's kills end at the same x, and so do the scores, which are also where the headers end.
      const edges = (key) => new Set(hud.rows.map((r) => Math.round(r[key])));
      assert.equal(edges('killsRight').size, 1, `kills line up: ${[...edges('killsRight')]}`);
      assert.equal(edges('scoreRight').size, 1, `scores line up: ${[...edges('scoreRight')]}`);
      assert.equal(Math.round(hud.headKillsRight), [...edges('killsRight')][0], 'the Kills header sits over the kills');
      assert.equal(Math.round(hud.headScoreRight), [...edges('scoreRight')][0], 'the Score header sits over the scores');
      assert.ok(hud.rows.every((r) => r.inside && r.ordered && r.fits), JSON.stringify(hud.rows.filter((r) => !(r.inside && r.ordered && r.fits))));

      const stats = await page.eval(`document.getElementById('stats').textContent`);
      assert.ok(/\d/.test(stats) && !/Rank|Kills/i.test(stats), `the score area is only the score: ${JSON.stringify(stats)}`);
    });
  }
}

// A 3-digit rank (the player can be 151st with 150 bots) must not run into the name (#199).
for (const [label, opts, coarse] of SIZES) {
  test(`a 3-digit rank has room next to the name (${label}, #199)`, async (t) => {
    let page;
    t.after(() => page && page.close());
    page = await launch(opts);
    if (coarse) await page.coarsePointer();
    await page.goto(gameUrl());
    await page.startRun();
    // The widest case: the player's bold gold row with rank 151, measured in the real list.
    const m = await page.eval(`(() => {
      const lb = document.getElementById('lb'), li = document.createElement('li');
      li.className = 'me big'; // as row() builds it for a rank over 99
      li.innerHTML = '<span class="r">151</span><span class="n">Thomas</span><span class="k z">0</span><span class="m">35</span>';
      lb.appendChild(li);
      const r = li.querySelector('.r'), n = li.querySelector('.n');
      const out = { fits: r.scrollWidth <= r.clientWidth, gap: n.getBoundingClientRect().left - r.getBoundingClientRect().left - r.scrollWidth };
      li.remove();
      return out;
    })()`);
    assert.ok(m.fits, `the rank's text is wider than its column: ${JSON.stringify(m)}`);
    assert.ok(m.gap >= 3, `only ${m.gap.toFixed(1)}px between the rank and the name`);
  });
}

test('in a 150-bot world the real own row has a 3-digit rank and room for it (#199)', async (t) => {
  const page = await launch({ width: 1280, height: 720 });
  t.after(() => page.close());
  await page.goto(gameUrl());
  await page.eval(`localStorage.setItem('wormarena.settings', JSON.stringify({ name: 'Thomas', skin: 0, botCount: 150, difficulty: 'normal', theme: 'auto', sound: false, music: false }))`);
  await page.reload();
  await page.startRun();
  await page.eval('window.__player.shield = 1e9');
  await page.waitFor(`document.querySelector('#lb li.me .r') && Number(document.querySelector('#lb li.me .r').textContent) > 99`, 'a rank over 99');
  const m = await page.eval(`(() => {
    const li = document.querySelector('#lb li.me'), r = li.querySelector('.r'), n = li.querySelector('.n');
    return { big: li.classList.contains('big'), rank: r.textContent, fits: r.scrollWidth <= r.clientWidth, gap: n.getBoundingClientRect().left - r.getBoundingClientRect().left - r.scrollWidth,
      ordered: n.getBoundingClientRect().right <= li.querySelector('.k').getBoundingClientRect().left + 0.5 };
  })()`);
  assert.ok(m.big && m.fits && m.gap >= 3 && m.ordered, JSON.stringify(m));
});
