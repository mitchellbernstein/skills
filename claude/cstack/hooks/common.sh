#!/bin/bash
# Shared helpers for cstack hooks. Source this file; do not run it.

# Last assistant text: the hook input field when present, else the transcript tail.
last_assistant_text() {
  local input="$1" text path
  text=$(jq -r '.last_assistant_message // empty' <<< "$input" 2>/dev/null)
  if [[ -z "$text" ]]; then
    path=$(jq -r '.transcript_path // empty' <<< "$input" 2>/dev/null)
    if [[ -n "$path" && -f "$path" ]]; then
      text=$(tail -n 200 "$path" | jq -rs '[.[] | select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text] | last // empty' 2>/dev/null)
    fi
  fi
  printf '%s' "$text"
}
