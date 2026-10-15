#!/bin/bash
# Ralph Loop Stop hook (Claude Code). When a turn ends and a loop is active,
# block the stop and feed the same prompt back for another iteration.
#
# Input:  { "session_id", "transcript_path", "stop_hook_active", "last_assistant_message", ... }
# Output: { "decision": "block", "reason": "<text>" } to continue, or exit 0 to stop.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
STATE_FILE="$PROJECT_DIR/.claude/ralph/scratchpad.md"

[[ -f "$STATE_FILE" ]] || exit 0

FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$STATE_FILE")
ITERATION=$(echo "$FRONTMATTER" | grep '^iteration:' | sed 's/iteration: *//')
MAX_ITERATIONS=$(echo "$FRONTMATTER" | grep '^max_iterations:' | sed 's/max_iterations: *//')
COMPLETION_PROMISE=$(echo "$FRONTMATTER" | grep '^completion_promise:' | sed 's/completion_promise: *//' | sed 's/^"\(.*\)"$/\1/')

if [[ ! "$ITERATION" =~ ^[0-9]+$ ]] || [[ ! "$MAX_ITERATIONS" =~ ^[0-9]+$ ]]; then
  echo "Ralph loop: state file corrupted. Stopping." >&2
  rm -f "$STATE_FILE"
  exit 0
fi

# Completion promise: <promise>TEXT</promise> in the last response ends the loop.
if [[ "$COMPLETION_PROMISE" != "null" && -n "$COMPLETION_PROMISE" ]]; then
  RESPONSE=$(last_assistant_text "$HOOK_INPUT")
  PROMISE_TEXT=$(printf '%s' "$RESPONSE" | perl -0777 -ne 'if (/<promise>(.*?)<\/promise>/s) { $t=$1; $t =~ s/^\s+|\s+$//g; $t =~ s/\s+/ /g; print $t }' 2>/dev/null || true)
  if [[ -n "$PROMISE_TEXT" && "$PROMISE_TEXT" == "$COMPLETION_PROMISE" ]]; then
    echo "Ralph loop: completion promise fulfilled at iteration $ITERATION." >&2
    rm -f "$STATE_FILE"
    exit 0
  fi
fi

if [[ $MAX_ITERATIONS -gt 0 && $ITERATION -ge $MAX_ITERATIONS ]]; then
  echo "Ralph loop: max iterations ($MAX_ITERATIONS) reached." >&2
  rm -f "$STATE_FILE"
  exit 0
fi

PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' "$STATE_FILE")
if [[ -z "$PROMPT_TEXT" ]]; then
  echo "Ralph loop: no prompt text found in state file. Stopping." >&2
  rm -f "$STATE_FILE"
  exit 0
fi

NEXT=$((ITERATION + 1))
TMP="${STATE_FILE}.tmp.$$"
sed "s/^iteration: .*/iteration: $NEXT/" "$STATE_FILE" > "$TMP" && mv "$TMP" "$STATE_FILE"

if [[ "$COMPLETION_PROMISE" != "null" && -n "$COMPLETION_PROMISE" ]]; then
  HEADER="[Ralph loop iteration $NEXT. To complete: output <promise>$COMPLETION_PROMISE</promise> ONLY when genuinely true.]"
else
  HEADER="[Ralph loop iteration $NEXT.]"
fi

jq -n --arg reason "$HEADER

$PROMPT_TEXT" '{"decision": "block", "reason": $reason}'
exit 0
