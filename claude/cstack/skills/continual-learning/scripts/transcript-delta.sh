#!/usr/bin/env bash
# Incremental Claude Code transcript reader for continual-learning.
# Claude Code port of cursor/plugins continual-learning (Eric Zakariasson, MIT).
#
#   transcript-delta.sh target            print the memory file to update
#   transcript-delta.sh delta [--max-chars N] [--dir DIR]
#                                         print new user/assistant text from
#                                         main-session transcripts that are new
#                                         or grew since the index; record what
#                                         was printed in a pending file
#   transcript-delta.sh commit [--dir DIR] fold the pending file into the index
#                                         and drop entries for deleted files
#   transcript-delta.sh status [--dir DIR] show index and transcript counts
#
# Transcripts: ${CLAUDE_CONFIG_DIR:-~/.claude}/projects/<slug>/<session-id>.jsonl,
# where <slug> is the project path with every non-alphanumeric character
# replaced by "-". Subagent transcripts (<session-id>/subagents/) are skipped.
# State lives in <project>/.claude/hooks/state/.
set -uo pipefail
command -v jq >/dev/null 2>&1 || { echo "transcript-delta: jq is required" >&2; exit 2; }

CMD="${1:-delta}"; shift || true
MAX_CHARS=60000
DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-chars) MAX_CHARS="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    *) echo "transcript-delta: unknown arg $1" >&2; exit 2 ;;
  esac
done

PROJECT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROJECT=$(cd "$PROJECT" 2>/dev/null && pwd -P || echo "$PROJECT")
STATE_DIR="$PROJECT/.claude/hooks/state"
INDEX="$STATE_DIR/continual-learning-index.json"
PENDING="$STATE_DIR/continual-learning-pending.json"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

mtime_ms() {
  local s
  s=$(stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null) || return 1
  echo $(( s * 1000 ))
}

resolve_dir() {
  [[ -n "$DIR" ]] && { echo "$DIR"; return; }
  [[ -n "${CL_TRANSCRIPT_DIR:-}" ]] && { echo "$CL_TRANSCRIPT_DIR"; return; }
  local slug cand
  slug=$(printf '%s' "$PROJECT" | sed 's/[^A-Za-z0-9]/-/g')
  cand="$CONFIG_DIR/projects/$slug"
  if [[ -d "$cand" ]]; then echo "$cand"; return; fi
  # Long paths get a shortened slug; fall back to the transcript that records this cwd.
  local f
  for f in "$CONFIG_DIR"/projects/*/*.jsonl; do
    [[ -f "$f" ]] || continue
    if head -n 20 "$f" | grep -qF "\"cwd\":\"$PROJECT\""; then dirname "$f"; return; fi
  done
  echo "$cand"
}

target() {
  # CLAUDE.md is the default. AGENTS.md is the target when the repo uses it:
  # no CLAUDE.md at all, or a CLAUDE.md that only imports @AGENTS.md.
  local c="" a="$PROJECT/AGENTS.md"
  [[ -f "$PROJECT/CLAUDE.md" ]] && c="$PROJECT/CLAUDE.md"
  [[ -z "$c" && -f "$PROJECT/.claude/CLAUDE.md" ]] && c="$PROJECT/.claude/CLAUDE.md"
  if [[ -z "$c" ]]; then
    [[ -f "$a" ]] && { echo "$a"; return; }
    echo "$PROJECT/CLAUDE.md"; return
  fi
  if [[ -f "$a" ]] && grep -qE '^[[:space:]]*@\.?/?AGENTS\.md[[:space:]]*$' "$c" \
     && [[ $(grep -cvE '^[[:space:]]*(@\.?/?AGENTS\.md)?[[:space:]]*$|^#' "$c") -eq 0 ]]; then
    echo "$a"; return
  fi
  echo "$c"
}

read_index() { [[ -f "$INDEX" ]] && jq -c '.files // {}' "$INDEX" 2>/dev/null || echo '{}'; }

# jq program: one JSONL line in, compact "U:"/"A:" text out (or nothing).
EXTRACT='
def clean: gsub("<system-reminder>[\\s\\S]*?</system-reminder>"; "") | gsub("^\\s+|\\s+$"; "");
def cut($n): if length > $n then .[0:$n] + " …[+\(length - $n) chars]" else . end;
select(.isSidechain != true and .isMeta != true)
| if .type == "user" then
    (.message.content
     | if type == "string" then . elif type == "array" then [ .[] | select(.type == "text") | .text ] | join("\n") else "" end
     | clean) as $t
    | select($t != "" and ($t | startswith("<command-") | not) and ($t | startswith("[Request interrupted") | not)
             and ($t | startswith("<local-command") | not))
    | "U: " + ($t | cut(2000))
  elif .type == "assistant" then
    ([ .message.content[]? | select(.type == "text") | .text ] | join("\n") | clean) as $t
    | select($t != "")
    | "A: " + ($t | cut(600))
  else empty end'

delta() {
  local tdir idx files f lines prev mt body used=0 printed='{}' deferred=0
  tdir=$(resolve_dir)
  echo "Transcript dir: $tdir"
  echo "Memory file: $(target)"
  if [[ ! -d "$tdir" ]]; then echo "No transcripts for this project."; return 0; fi
  idx=$(read_index)
  mkdir -p "$STATE_DIR"
  # Oldest first so a size cap defers the newest, which the next run picks up.
  files=$(ls -1tr "$tdir"/*.jsonl 2>/dev/null)
  while IFS= read -r f; do
    [[ -n "$f" && -f "$f" ]] || continue
    mt=$(mtime_ms "$f") || continue
    lines=$(wc -l < "$f" | tr -d ' ')
    prev=$(jq -r --arg p "$f" '.[$p] // empty | "\(.mtimeMs) \(.lines)"' <<< "$idx")
    local pm=0 pl=0
    [[ -n "$prev" ]] && read -r pm pl <<< "$prev"
    [[ "$mt" -le "$pm" && "$lines" -le "$pl" ]] && continue
    [[ "$lines" -lt "$pl" ]] && pl=0   # rewritten file: read it whole
    body=$(tail -n +"$((pl + 1))" "$f" | jq -r "$EXTRACT" 2>/dev/null)
    if [[ -n "$body" ]]; then
      if (( used > 0 && used + ${#body} > MAX_CHARS )); then deferred=$((deferred + 1)); continue; fi
      # One oversized transcript alone: keep its most recent part.
      (( ${#body} > MAX_CHARS )) && body="…[earlier lines of this delta omitted]"$'\n'"${body: -MAX_CHARS}"
      printf '\n### %s (lines %d-%d)\n%s\n' "$(basename "$f")" "$((pl + 1))" "$lines" "$body"
      used=$((used + ${#body}))
    fi
    printed=$(jq -c --arg p "$f" --argjson m "$mt" --argjson l "$lines" '.[$p] = {mtimeMs: $m, lines: $l}' <<< "$printed")
  done <<< "$files"
  echo "$printed" > "$PENDING"
  echo
  echo "Pending: $(jq 'length' <<< "$printed") transcript(s) recorded for commit; $deferred deferred by the ${MAX_CHARS}-char cap."
  [[ "$printed" == '{}' ]] && echo "No new transcript content."
  return 0
}

commit() {
  local idx pend tmp
  mkdir -p "$STATE_DIR"
  idx=$(read_index)
  pend='{}'; [[ -f "$PENDING" ]] && pend=$(cat "$PENDING")
  idx=$(jq -c --argjson p "$pend" '. + $p' <<< "$idx")
  # Drop entries for transcripts that no longer exist.
  local keep='{}' k
  while IFS= read -r k; do
    [[ -n "$k" && -f "$k" ]] && keep=$(jq -c --arg k "$k" --argjson v "$(jq -c --arg k "$k" '.[$k]' <<< "$idx")" '.[$k] = $v' <<< "$keep")
  done < <(jq -r 'keys[]' <<< "$idx")
  tmp="$INDEX.tmp.$$"
  jq -n --argjson files "$keep" '{version: 1, updatedAt: (now | todate), files: $files}' > "$tmp" && mv "$tmp" "$INDEX"
  rm -f "$PENDING"
  echo "Index: $(jq '.files | length' "$INDEX") transcript(s) at $INDEX"
}

status() {
  local tdir; tdir=$(resolve_dir)
  echo "Project: $PROJECT"
  echo "Transcript dir: $tdir ($(ls -1 "$tdir"/*.jsonl 2>/dev/null | wc -l | tr -d ' ') transcripts)"
  echo "Memory file: $(target)"
  echo "Indexed: $(read_index | jq 'length')"
  [[ -f "$STATE_DIR/continual-learning.json" ]] && jq -c . "$STATE_DIR/continual-learning.json"
  return 0
}

case "$CMD" in
  target) target ;;
  delta) delta ;;
  commit) commit ;;
  status) status ;;
  *) echo "usage: transcript-delta.sh target|delta|commit|status [--dir DIR] [--max-chars N]" >&2; exit 2 ;;
esac
