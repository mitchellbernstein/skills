#!/bin/bash
# PostToolUse hook (Edit|Write|MultiEdit|NotebookEdit): remember that files
# changed since the last advisor consult.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/advisor-lib.sh"
HOOK_INPUT=$(cat)
advisor_require_enabled
advisor_bind_conversation "$HOOK_INPUT" || exit 0
FILE_PATH=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<< "$HOOK_INPUT")
case "$FILE_PATH" in
  */.claude/advisor/*) exit 0 ;;
esac
touch "$PENDING_FILE"
exit 0
