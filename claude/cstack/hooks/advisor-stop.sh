#!/bin/bash
# Stop hook: if files changed since the last advisor consult and the turn ended
# without one, ask the agent (once per batch of edits) to run the pre-completion consult.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/advisor-lib.sh"
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
HOOK_INPUT=$(cat)
advisor_require_enabled
advisor_bind_conversation "$HOOK_INPUT" || exit 0

[[ "$(jq -r 'if .nudge == false then "false" else "true" end' "$STATE_FILE")" == "true" ]] || exit 0
[[ -f "$PENDING_FILE" ]] || exit 0

# The agent stopped to ask the user something: stay quiet, keep the marker armed.
LAST_CHAR=$(last_assistant_text "$HOOK_INPUT" | tr -d '[:space:]' | tail -c 1)
[[ "$LAST_CHAR" == "?" ]] && exit 0

rm -f "$PENDING_FILE"
MODEL=$(jq -r '.model // "the configured advisor model"' "$STATE_FILE")
MESSAGE="[Advisor] Files changed since the last advisor consult and the turn ended without one. If this work is done, or you were about to declare it done, run the pre-completion consult now per the advisor skill: build the briefing, spawn the \`advisor-subagent\` subagent (model: $MODEL), act on the verdict, and report it in one line. If the change was trivial, or you are waiting on the user, say so in one line and stop."
jq -n --arg reason "$MESSAGE" '{"decision": "block", "reason": $reason}'
exit 0
