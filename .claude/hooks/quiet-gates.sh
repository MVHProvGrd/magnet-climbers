#!/bin/bash
# Stop hook: run typecheck + the unit tests mechanically; print NOTHING when green.
# Red → exit 2 with the failing lines on stderr, so the model fixes it instead of
# stopping. Skips on stop_hook_active (never loop), on a clean tree with nothing
# unpushed (nothing to gate), when node_modules is missing, and when this exact
# tree state already passed (stamp in .git/quiet-gates.pass).
set -u
DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$DIR" || exit 0
INPUT="$(cat 2>/dev/null || true)"
case "$INPUT" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;; esac
command -v node >/dev/null 2>&1 || exit 0
command -v git  >/dev/null 2>&1 || exit 0
[ -d node_modules ] || exit 0

DIRTY="$(git status --porcelain 2>/dev/null)"
AHEAD="$(git log --oneline '@{u}..HEAD' 2>/dev/null)"
[ -z "$DIRTY" ] && [ -z "$AHEAD" ] && exit 0

STAMP="$( { git rev-parse HEAD 2>/dev/null; git diff HEAD 2>/dev/null; printf '%s' "$DIRTY"; } | git hash-object --stdin 2>/dev/null )"
PASSFILE="$(git rev-parse --git-dir 2>/dev/null)/quiet-gates.pass"
[ -n "$STAMP" ] && [ -f "$PASSFILE" ] && [ "$(cat "$PASSFILE" 2>/dev/null)" = "$STAMP" ] && exit 0

GATES=(
  "npm run -s typecheck"
  "npm test"
)
LOG="$(mktemp 2>/dev/null || echo "/tmp/quiet-gates.$$")"
for g in "${GATES[@]}"; do
  if ! bash -c "$g" >"$LOG" 2>&1; then
    { echo "quiet-gates: FAILED → $g"; echo "(fix it before stopping; passing runs print nothing)"; echo "----- last 60 lines -----"; tail -n 60 "$LOG"; } >&2
    rm -f "$LOG"; exit 2
  fi
done
rm -f "$LOG"
[ -n "$STAMP" ] && printf '%s' "$STAMP" > "$PASSFILE" 2>/dev/null
exit 0
