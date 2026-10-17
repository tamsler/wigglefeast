#!/usr/bin/env bash
# Fails when shipped game files changed without a VERSION bump in sw.js.
# Usage: .github/scripts/check-version.sh [base-ref]   (default: origin/main)
set -euo pipefail

base="${1:-origin/main}"
shipped=$(git diff --name-only "$base"...HEAD | grep -vE '^(README\.md|\.gitignore|openspec/|\.github/|\.claude/)' || true)

if [ -z "$shipped" ]; then
  echo "No shipped game files changed; no version bump needed."
  exit 0
fi

version_of() { sed -nE "s/^const VERSION = '([^']+)';.*/\1/p" | head -1; }
old=$(git show "$base:sw.js" 2>/dev/null | version_of || true)
new=$(version_of < sw.js || true)

if [ -z "$new" ]; then
  echo "::error file=sw.js::sw.js must declare the release as: const VERSION = 'x.y.z';"
  exit 1
fi
if [ "$old" = "$new" ]; then
  echo "::error file=sw.js::Shipped files changed but the release version did not. Bump VERSION in sw.js (currently $new)."
  echo "Changed shipped files:"
  echo "$shipped" | sed 's/^/  /'
  exit 1
fi
if ! echo "$new" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
  echo "::error file=sw.js::VERSION '$new' must look like 1.2.3 (optionally with a suffix such as 1.2.3-beta.1)."
  exit 1
fi
if git rev-parse -q --verify "refs/tags/v$new" >/dev/null; then
  echo "::error file=sw.js::Version $new was already released (tag v$new). Use a higher version; versions are never reused."
  exit 1
fi
echo "Release version changed: ${old:-none} -> $new"
