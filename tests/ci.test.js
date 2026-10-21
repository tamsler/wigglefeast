// CI: pull requests that only touch docs and specs skip the test shards (#127).
// Run with `node --test "tests/**/*.test.js"`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '..', '.github', 'scripts', 'needs-tests.sh');

test('needs-tests.sh runs the tests unless a change only touches docs and specs', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-ci-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: repo, stdio: 'pipe' }).toString();
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), text);
  };
  const needs = (base = 'main') => spawnSync('bash', [SCRIPT, base], { cwd: repo, encoding: 'utf8' }).stdout.trim();

  git('init', '-q', '-b', 'main');
  write('main.js', 'v1\n'); write('README.md', 'docs\n');
  git('add', '-A'); git('commit', '-qm', 'base');
  git('checkout', '-qb', 'pr');
  const change = (...files) => {
    git('checkout', '-q', 'pr'); git('reset', '-q', '--hard', 'main');
    for (const f of files) write(f, `changed ${f}\n`);
    git('add', '-A'); git('commit', '-qm', `change ${files.join(' ')}`);
    return needs();
  };

  // Docs and specs only: no tests.
  assert.equal(change('README.md'), 'false', 'README');
  assert.equal(change('openspec/specs/bots/spec.md', 'openspec/changes/x/tasks.md', 'openspec/config.yaml'), 'false', 'OpenSpec');
  assert.equal(change('.claude/CLAUDE.md', '.claude/agents/pr-reviewer.md', 'LICENSE', '.gitignore'), 'false', 'Claude settings, licence');
  // Anything else runs them, even mixed with docs.
  assert.equal(change('main.js'), 'true', 'game file');
  assert.equal(change('README.md', 'engine.js'), 'true', 'docs and code');
  assert.equal(change('tests/engine.test.js'), 'true', 'tests');
  assert.equal(change('tools/balance.js'), 'true', 'tools');
  assert.equal(change('.github/workflows/tests.yml'), 'true', 'workflow');
  assert.equal(change('.github/scripts/needs-tests.sh'), 'true', 'CI scripts');
  assert.equal(change('icons/icon-192.png'), 'true', 'icons ship with the game');
  // When in doubt, run them: no changes, or a base that doesn't exist.
  git('checkout', '-q', 'pr'); git('reset', '-q', '--hard', 'main');
  assert.equal(needs(), 'true', 'nothing changed');
  assert.equal(needs('no-such-branch'), 'true', 'unknown base');
});
