# Wigglefeast: how we work

Single-player snake-style browser game. Plain HTML/CSS/JS, no build step, no dependencies. It must keep working when `index.html` is opened from disk (`file://`). `openspec/specs/` describes current behavior; `README.md` covers releasing.

## Workflow
- **Every change has a GitHub issue** in tamsler/wigglefeast and lands through a branch and a PR whose description says `Closes #N`.
- **Features** (label `needs-openspec`) are planned first with OpenSpec: `/opsx:propose`, wait for the user to approve the plan, then `/opsx:apply`, then `/opsx:archive` after merge. **Bugs and chores** skip OpenSpec.
- **Releases**: any PR that changes a shipped game file bumps `VERSION` in `sw.js` (semver, never reused). New files the game loads go into `FILES` in `sw.js`. The *Version check* workflow enforces the bump; merging tags `v<VERSION>` and publishes a GitHub Release automatically.
- **Review before merge**: after opening a PR, run the `pr-reviewer` agent (`.claude/agents/pr-reviewer.md`, a different model) on it. Verify each finding yourself, fix the real ones, note dismissed ones with a reason in the PR, and only then merge.
- **Merging**: Claude may squash-merge its own PRs once checks pass and the review is addressed (GitHub won't let the author approve their own PR).
- **Verify in a real browser** (headless Chrome is fine) for anything touching the UI, input, saves or the service worker, and run the engine simulations when `engine.js` changes. Saved data must stay backward compatible.
