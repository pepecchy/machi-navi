#!/usr/bin/env bash
# Single entry point. Prints only failures.
set -uo pipefail
cd "$(dirname "$0")"

quiet() { # run a step; show its output only when it fails
  local name="$1"; shift
  local out
  if ! out="$("$@" 2>&1)"; then
    echo "FAIL [$name]"; echo "$out" | tail -40; return 1
  fi
}

case "${1:-}" in
  check)
    rc=0
    node gate/check.ts || rc=1
    quiet calc npx vitest run || rc=1
    if quiet build npx astro build; then node gate/site.ts || rc=1; else rc=1; fi
    [ "$rc" = 0 ] && echo "ok"
    exit "$rc" ;;
  build) npx astro build ;;
  drift) node gate/drift.ts ;;
  fetch) shift; node gate/fetch.ts "$@" ;;
  *) echo "usage: ./x check | build | drift | fetch <url>"; exit 2 ;;
esac
