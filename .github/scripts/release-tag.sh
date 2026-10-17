#!/usr/bin/env bash
# Tags and releases the VERSION in sw.js if it has not been released yet.
# Runs on every push to main. Usage: .github/scripts/release-tag.sh [commit]
# Set DRY_RUN=1 to print what would happen without creating anything.
set -euo pipefail

target="${1:-$(git rev-parse HEAD)}"
version=$(git show "$target:sw.js" | sed -nE "s/^const VERSION = '([^']+)';.*/\1/p" | head -1)
if [ -z "$version" ]; then
  echo "::error file=sw.js::No VERSION found in sw.js"
  exit 1
fi
tag="v$version"

if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "$tag already exists; nothing to release."
  exit 0
fi

flags=(--target "$target" --title "Wigglefeast $version" --generate-notes)
case "$version" in *-*) flags+=(--prerelease) ;; *) flags+=(--latest) ;; esac

if [ -n "${DRY_RUN:-}" ]; then
  echo "Would run: gh release create $tag ${flags[*]}"
  exit 0
fi
gh release create "$tag" "${flags[@]}"
echo "Released $tag at $target"
