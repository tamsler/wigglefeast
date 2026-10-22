#!/usr/bin/env bash
# Reads Chrome's files once so the first launch in a CI shard doesn't wait on a cold disk (#134).
# On a fresh runner the first launch took 8-10 s, against 0.3-0.5 s once the files had been read.
# Most of the ~440 MB is one binary, so big files are read in parallel chunks, small ones 8 at a
# time. Writes how long it took to $1 (default: $RUNNER_TEMP/warm-chrome.txt).
set -u
out=${1:-${RUNNER_TEMP:-/tmp}/warm-chrome.txt}
start=$(date +%s%N)
chrome=$(command -v google-chrome) || exit 0 # not installed: nothing to warm
dir=$(dirname "$(readlink -f "$chrome")")
find "$dir" -type f -size -32M -print0 | xargs -0 -r -P 8 cat > /dev/null 2>&1 &
while IFS= read -r -d '' f; do
  mb=$(( ($(stat -c %s "$f") + 1048575) / 1048576 )); per=$(( (mb + 7) / 8 ))
  for i in 0 1 2 3 4 5 6 7; do dd if="$f" of=/dev/null bs=1M skip=$(( i * per )) count="$per" status=none & done
done < <(find "$dir" -type f -size +32M -print0)
wait
echo "warmed $dir in $(( ($(date +%s%N) - start) / 1000000 )) ms" > "$out"
