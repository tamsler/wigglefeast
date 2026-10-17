// Release check: versions only go up (#51). Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '..', '.github', 'scripts');

test('SemVer ordering used by the release check', () => {
  const gt = (a, b) => spawnSync('bash', ['-c', `. "${SCRIPTS}/semver.sh"; semver_gt "$1" "$2"`, 'x', a, b]).status === 0;
  const higher = [
    ['1.5.1', '1.5.0'], ['1.6.0', '1.5.9'], ['2.0.0', '1.99.99'], ['1.10.0', '1.9.0'],
    ['1.6.0', '1.6.0-beta.1'], ['1.6.0-beta.2', '1.6.0-beta.1'], ['1.6.0-beta.10', '1.6.0-beta.2'],
    ['1.6.0-rc.1', '1.6.0-beta.9'], ['1.6.0-alpha.beta', '1.6.0-alpha.1'], ['1.6.0-alpha.1', '1.6.0-alpha'],
  ];
  for (const [a, b] of higher) {
    assert.equal(gt(a, b), true, `${a} > ${b}`);
    assert.equal(gt(b, a), false, `not ${b} > ${a}`);
  }
  for (const v of ['1.5.0', '1.6.0-beta.1']) assert.equal(gt(v, v), false, `not ${v} > ${v}`);
});

test('check-version.sh accepts higher versions and rejects lower or reused ones', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-release-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: repo, stdio: 'pipe' }).toString();
  const write = (file, text) => fs.writeFileSync(path.join(repo, file), text);
  const version = (v) => write('sw.js', `const VERSION = '${v}';\n`);
  const check = () => spawnSync('bash', [path.join(SCRIPTS, 'check-version.sh'), 'main'], { cwd: repo, encoding: 'utf8' });

  git('init', '-q', '-b', 'main');
  version('1.5.0'); write('main.js', 'v1\n'); write('README.md', 'docs\n');
  git('add', '-A'); git('commit', '-qm', 'base'); git('tag', 'v1.5.0');
  git('tag', 'v1.5.2'); // pretend 1.5.2 shipped earlier, so it can't be reused
  git('checkout', '-qb', 'pr');

  const attempt = (v, file = 'main.js') => {
    git('checkout', '-q', 'pr'); git('reset', '-q', '--hard', 'main');
    write(file, `changed ${v}\n`);
    if (v) version(v);
    git('add', '-A');
    git('commit', '-qm', `try ${v}`);
    return check();
  };
  const ok = (r, what) => assert.equal(r.status, 0, `${what}: ${r.stdout}${r.stderr}`);
  const rejected = (r, what, re) => { assert.notEqual(r.status, 0, `${what} should fail`); assert.match(r.stdout, re); };

  ok(attempt('1.5.1'), 'higher patch');
  ok(attempt('1.6.0-beta.1'), 'prerelease of a higher version');
  rejected(attempt('1.4.9'), 'lower version', /must be higher/);
  rejected(attempt('1.5.0-rc.1'), 'prerelease of the current version', /must be higher/);
  rejected(attempt(null), 'no bump', /did not/);
  rejected(attempt('1.5.2'), 'reused tag', /already released/);
  ok(attempt(null, 'README.md'), 'docs-only change without a bump');
  fs.mkdirSync(path.join(repo, 'tools'), { recursive: true });
  ok(attempt(null, 'tools/make-icons.js'), 'tools-only change without a bump (#59)');
});
