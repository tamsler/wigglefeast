#!/usr/bin/env bash
# Prints "true" when the changes since base can affect the game or its tests, "false" when they
# only touch docs and specs (#127). When in doubt (no diff, git error) it prints "true".
# Usage: .github/scripts/needs-tests.sh [base-ref]   (default: origin/main)
set -uo pipefail

base="${1:-origin/main}"
if ! changed=$(git diff --name-only "$base"...HEAD 2>/dev/null) || [ -z "$changed" ]; then
  echo true
  exit 0
fi
# Docs and specs: top-level Markdown, OpenSpec, Claude settings, the licence and .gitignore.
# Markdown elsewhere (say, a fixture under tests/) counts as code.
# Everything else (game files, tests, tools, workflows and these scripts) runs the tests.
code=$(echo "$changed" | grep -vE '(^[^/]+\.md$|^openspec/|^\.claude/|^LICENSE$|^\.gitignore$)' || true)
if [ -n "$code" ]; then echo true; else echo false; fi
