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

  await t.test('a bot retaliating against the player has its name in red-orange, without a tag', () => {
    const d = drawn(names[2]);
    assert.ok(d.length > 0, 'its name is drawn');
    assert.ok(d.every((x) => x.text === names[2] && x.fill === '#ff5a1f'), JSON.stringify(d.slice(0, 2)));
  });
});
