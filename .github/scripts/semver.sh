# SemVer precedence for the release checks (sourced, not run). Plain Bash 3.2+, no dependencies.
# semver_gt A B: succeeds when version A is higher than version B (https://semver.org/#spec-item-11).
# Both must look like 1.2.3 or 1.2.3-pre.release; build metadata (+...) isn't used here.
semver_gt() {
  local LC_ALL=C IFS=.
  local a="$1" b="$2" a_pre="" b_pre=""
  local a_core="${a%%-*}" b_core="${b%%-*}"
  case "$a" in *-*) a_pre="${a#*-}" ;; esac
  case "$b" in *-*) b_pre="${b#*-}" ;; esac
  local ac=($a_core) bc=($b_core) i
  for i in 0 1 2; do
    if (( 10#${ac[i]} > 10#${bc[i]} )); then return 0; fi
    if (( 10#${ac[i]} < 10#${bc[i]} )); then return 1; fi
  done
  # Same major.minor.patch: a release outranks any prerelease of it.
  if [ -z "$a_pre" ]; then [ -n "$b_pre" ]; return; fi
  if [ -z "$b_pre" ]; then return 1; fi
  # Compare prerelease identifiers left to right: numbers numerically, numbers below
  # words, words in ASCII order; if all shared ones are equal, more identifiers wins.
  local ap=($a_pre) bp=($b_pre) x y
  for ((i = 0; ; i++)); do
    x="${ap[i]-}" y="${bp[i]-}"
    if [ -z "$x" ]; then return 1; fi
    if [ -z "$y" ]; then return 0; fi
    if [[ "$x" =~ ^[0-9]+$ && "$y" =~ ^[0-9]+$ ]]; then
      if (( 10#$x > 10#$y )); then return 0; fi
      if (( 10#$x < 10#$y )); then return 1; fi
    elif [[ "$x" =~ ^[0-9]+$ ]]; then return 1
    elif [[ "$y" =~ ^[0-9]+$ ]]; then return 0
    elif [[ "$x" > "$y" ]]; then return 0
    elif [[ "$x" < "$y" ]]; then return 1
    fi
  done
}
