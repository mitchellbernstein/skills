#!/usr/bin/env bash
# Run the published agent-compatibility scanner (ericzakariasson/agent-compatibility
# on npm) against a repo. Claude Code port of cursor/plugins agent-compatibility
# (Cursor, MIT); the scanner itself is not bundled.
#
# Usage: scan.sh [--json|--md|--text] [repo-path]   (default: --json .)
#
# Claude Code adaptation: the scanner credits only AGENTS.md for its
# "Agent workflow guidance" check. When the repo carries CLAUDE.md (or
# .claude/CLAUDE.md) and no AGENTS.md, the script sets that check's weight to 0
# through the scanner's documented --config override, so a Claude Code repo is
# neither credited nor penalized for the file name. A repo-root
# agent-compatibility.config.json is honored and merged.
# Exit codes: scanner's own on success; 3 when the scanner cannot run here
# (no node/npx, no network): a tool-environment problem, not a repo defect.
set -uo pipefail

FORMAT="--json"
case "${1:-}" in
  --json|--md|--text|--tui) FORMAT="$1"; shift ;;
esac
REPO="${1:-.}"
if [[ ! -d "$REPO" ]]; then
  echo "scan.sh: not a directory: $REPO" >&2
  exit 2
fi
REPO=$(cd "$REPO" && pwd)

if ! command -v npx >/dev/null 2>&1; then
  echo "scan.sh: npx not found; deterministic scan unavailable (tool environment, not the repo)." >&2
  exit 3
fi

TMP=$(mktemp -d "${TMPDIR:-/tmp}/agent-compat.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

ARGS=("$FORMAT" "$REPO")
USER_CFG="$REPO/agent-compatibility.config.json"
NEUTRALIZE=0
if [[ ! -f "$REPO/AGENTS.md" && ( -f "$REPO/CLAUDE.md" || -f "$REPO/.claude/CLAUDE.md" ) ]]; then
  NEUTRALIZE=1
fi

if [[ $NEUTRALIZE -eq 1 ]]; then
  CFG="$TMP/config.json"
  if [[ -f "$USER_CFG" ]] && command -v jq >/dev/null 2>&1; then
    jq '.weights = ((.weights // {}) + {"contributionOrAgentGuidance": 0})' "$USER_CFG" > "$CFG" 2>/dev/null \
      || echo '{"weights":{"contributionOrAgentGuidance":0}}' > "$CFG"
  else
    echo '{"weights":{"contributionOrAgentGuidance":0}}' > "$CFG"
  fi
  ARGS+=(--config "$CFG")
  echo "scan.sh: CLAUDE.md found and no AGENTS.md; agent-guidance check weighted 0 so the file name does not cost points." >&2
elif [[ -f "$USER_CFG" ]]; then
  ARGS+=(--config "$USER_CFG")
fi

OUT="$TMP/out"
ERR="$TMP/err"
# Run from a neutral directory so the repo's own npm config can't redirect npx.
(cd "$TMP" && npx -y agent-compatibility@latest "${ARGS[@]}") >"$OUT" 2>"$ERR"
CODE=$?
if [[ $CODE -ne 0 && ! -s "$OUT" ]]; then
  grep -v '^npm notice' "$ERR" >&2
  echo "scan.sh: scanner failed to run (exit $CODE); treat as tool-environment issue unless the error names the repo." >&2
  exit 3
fi
cat "$OUT"
exit $CODE
