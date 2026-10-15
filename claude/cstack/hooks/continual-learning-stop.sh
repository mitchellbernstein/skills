#!/bin/bash
# Continual-learning Stop hook (Claude Code). Port of cursor/plugins
# continual-learning/hooks/continual-learning-stop.ts (Eric Zakariasson, MIT).
#
# Counts completed turns. When enough turns and minutes have passed since the
# last run and the transcript has grown, it asks the agent (once) to run the
# continual-learning skill. Never blocks: every path exits 0, and the nudge
# goes through Stop's non-error additionalContext, not decision:block.
#
# Off by default. Turn it on per project by creating
# .claude/hooks/state/continual-learning.json (the skill's "enable" step), or
# for every project with CONTINUAL_LEARNING_ENABLED=1.
#
# Input:  { "session_id", "transcript_path", "cwd", "stop_hook_active", "prompt_id"?, ... }
# Output: {} or { "hookSpecificOutput": { "hookEventName": "Stop", "additionalContext": "..." } }

emit_empty() { printf '{}\n'; exit 0; }
trap 'emit_empty' ERR
command -v jq >/dev/null 2>&1 || emit_empty

INPUT=$(cat 2>/dev/null || true)
[[ -n "$INPUT" ]] || emit_empty

PROJECT="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd // empty' <<< "$INPUT" 2>/dev/null)}"
[[ -n "$PROJECT" && -d "$PROJECT" ]] || emit_empty
STATE_DIR="$PROJECT/.claude/hooks/state"
STATE="$STATE_DIR/continual-learning.json"
INDEX="$STATE_DIR/continual-learning-index.json"

env_bool() { case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in 1|true|yes|on) return 0 ;; *) return 1 ;; esac; }
# Primary name, then the upstream legacy CONTINUOUS_ name, then the default.
env_int() {
  local v="${!1:-${!2:-}}"
  [[ "$v" =~ ^[1-9][0-9]*$ ]] && echo "$v" || echo "$3"
}

if [[ ! -f "$STATE" ]] && ! env_bool "${CONTINUAL_LEARNING_ENABLED:-}"; then emit_empty; fi

# Our own nudge re-entered Stop: don't count it, don't nudge again.
[[ "$(jq -r '.stop_hook_active // false' <<< "$INPUT" 2>/dev/null)" == "true" ]] && emit_empty

STATE_JSON='{}'
[[ -f "$STATE" ]] && STATE_JSON=$(jq -c 'if type == "object" then . else {} end' "$STATE" 2>/dev/null || echo '{}')
[[ "$(jq -r '.enabled // true' <<< "$STATE_JSON")" == "false" ]] && emit_empty

# Dedupe re-delivery of the same turn (upstream used generation_id).
TURN_ID=$(jq -r '.prompt_id // empty' <<< "$INPUT" 2>/dev/null)
if [[ -n "$TURN_ID" && "$TURN_ID" == "$(jq -r '.lastProcessedTurnId // empty' <<< "$STATE_JSON")" ]]; then emit_empty; fi

NOW=$(( $(date +%s) * 1000 ))
TRANSCRIPT=$(jq -r '.transcript_path // empty' <<< "$INPUT" 2>/dev/null)
T_MTIME=null
if [[ -n "$TRANSCRIPT" && -f "$TRANSCRIPT" ]]; then
  s=$(stat -c %Y "$TRANSCRIPT" 2>/dev/null || stat -f %m "$TRANSCRIPT" 2>/dev/null || echo "")
  [[ -n "$s" ]] && T_MTIME=$(( s * 1000 ))
fi

MIN_TURNS=$(env_int CONTINUAL_LEARNING_MIN_TURNS CONTINUOUS_LEARNING_MIN_TURNS 10)
MIN_MINUTES=$(env_int CONTINUAL_LEARNING_MIN_MINUTES CONTINUOUS_LEARNING_MIN_MINUTES 120)
TRIAL_TURNS=$(env_int CONTINUAL_LEARNING_TRIAL_MIN_TURNS CONTINUOUS_LEARNING_TRIAL_MIN_TURNS 3)
TRIAL_MINUTES=$(env_int CONTINUAL_LEARNING_TRIAL_MIN_MINUTES CONTINUOUS_LEARNING_TRIAL_MIN_MINUTES 15)
TRIAL_DURATION=$(env_int CONTINUAL_LEARNING_TRIAL_DURATION_MINUTES CONTINUOUS_LEARNING_TRIAL_DURATION_MINUTES 1440)
TRIAL=false
env_bool "${CONTINUAL_LEARNING_TRIAL_MODE:-${CONTINUOUS_LEARNING_TRIAL_MODE:-}}" && TRIAL=true

RESULT=$(jq -c -n \
  --argjson s "$STATE_JSON" --argjson now "$NOW" --argjson tm "$T_MTIME" \
  --arg turn "$TURN_ID" --argjson trial "$TRIAL" \
  --argjson minTurns "$MIN_TURNS" --argjson minMinutes "$MIN_MINUTES" \
  --argjson trialTurns "$TRIAL_TURNS" --argjson trialMinutes "$TRIAL_MINUTES" \
  --argjson trialDuration "$TRIAL_DURATION" '
  def num(x; d): if (x | type) == "number" then x else d end;
  ($s | num(.lastRunAtMs; 0)) as $lastRun
  | (($s | num(.turnsSinceLastRun; 0)) + 1) as $turns
  | ($s.lastTranscriptMtimeMs | if type == "number" then . else null end) as $lastT
  | (if $trial and ($s.trialStartedAtMs | type) != "number" then $now else $s.trialStartedAtMs end) as $trialStart
  | ($trial and ($trialStart | type) == "number" and ($now - $trialStart) < ($trialDuration * 60000)) as $inTrial
  | (if $inTrial then $trialTurns else $minTurns end) as $effTurns
  | (if $inTrial then $trialMinutes else $minMinutes end) as $effMinutes
  | (if $lastRun > 0 then (($now - $lastRun) / 60000 | floor) else 1e12 end) as $mins
  | ($tm != null and ($lastT == null or $tm > $lastT)) as $advanced
  | ($turns >= $effTurns and $mins >= $effMinutes and $advanced) as $fire
  | {
      fire: $fire,
      state: ($s + {
        version: 1,
        lastProcessedTurnId: (if $turn == "" then null else $turn end),
        trialStartedAtMs: $trialStart
      } + (if $fire
           then {lastRunAtMs: $now, turnsSinceLastRun: 0, lastTranscriptMtimeMs: $tm}
           else {turnsSinceLastRun: $turns} end))
    }' 2>/dev/null) || emit_empty

mkdir -p "$STATE_DIR" 2>/dev/null || emit_empty
TMP="$STATE.tmp.$$"
if jq '.state' <<< "$RESULT" > "$TMP" 2>/dev/null; then mv "$TMP" "$STATE"; else rm -f "$TMP"; emit_empty; fi

if [[ "$(jq -r '.fire' <<< "$RESULT")" == "true" ]]; then
  MSG="Continual learning is due for this project. Run the \`continual-learning\` skill now: it delegates to the \`agents-memory-updater\` subagent, which reads only transcripts that are new or changed since the index at \`$INDEX\`, updates the project's CLAUDE.md (or AGENTS.md when the repo uses that instead) with high-signal recurring user corrections and durable workspace facts only, and refreshes the index. Exclude one-off or transient details and secrets. If no meaningful updates exist, reply exactly: No high-signal memory updates."
  jq -n --arg ctx "$MSG" '{hookSpecificOutput: {hookEventName: "Stop", additionalContext: $ctx}}'
  exit 0
fi
emit_empty
