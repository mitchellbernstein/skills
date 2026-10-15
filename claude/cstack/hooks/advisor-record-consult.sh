#!/bin/bash
# SubagentStop hook (matcher: advisor-subagent): count the consult, clear the
# pending marker, and append the advice to .claude/advisor/log.md.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/advisor-lib.sh"
HOOK_INPUT=$(cat)
advisor_require_enabled
advisor_bind_conversation "$HOOK_INPUT" || exit 0

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
advisor_state_update '.consults = ((.consults // 0) + 1) | .last_consult_at = $now' --arg now "$NOW"
rm -f "$PENDING_FILE"

SUMMARY=$(jq -r '.last_assistant_message // empty' <<< "$HOOK_INPUT" | head -c 6000)
{
  printf '## %s — Advisor consult\n\n' "$NOW"
  if [[ -n "$SUMMARY" ]]; then printf '%s\n\n' "$SUMMARY"; else printf '_No summary captured._\n\n'; fi
} >> "$LOG_FILE"
exit 0
