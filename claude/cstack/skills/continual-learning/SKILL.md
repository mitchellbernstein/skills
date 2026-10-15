---
name: continual-learning
description: "Orchestrate continual learning: delegate transcript mining and CLAUDE.md (or AGENTS.md) memory updates to the agents-memory-updater subagent, or enable/disable the continual-learning Stop hook for a project. Use when the user asks to mine prior chats, keep CLAUDE.md current from what they keep telling you, run the continual-learning loop, or when the continual-learning hook asks for a run."
argument-hint: "[run|enable|disable|status]"
---

# Continual Learning

Keep the project's memory file current by delegating the memory update flow to one subagent. The memory file is `CLAUDE.md`. When the repo uses `AGENTS.md` instead (no `CLAUDE.md`, or a `CLAUDE.md` that only imports `@AGENTS.md`), the updater writes `AGENTS.md`. Claude Code reads either one.

## Trigger

Use when the user asks to mine prior chats, maintain `CLAUDE.md`/`AGENTS.md`, or run the continual-learning loop, or when the cstack Stop hook says continual learning is due.

## Workflow

Argument `$ARGUMENTS` (default `run`):

- `run`:
  1. Call `agents-memory-updater` (`Agent`, `subagent_type: "agents-memory-updater"`, foreground) with the project root path.
  2. Return the updater result.
- `enable`: create `.claude/hooks/state/continual-learning.json` containing `{"version": 1}` with the file-writing tool. The plugin's Stop hook is a no-op in projects without that file. Tell the user the cadence (10 turns and 120 minutes by default; `CONTINUAL_LEARNING_TRIAL_MODE=1` uses 3 turns and 15 minutes for the first 24 hours). Offer to add `.claude/hooks/state/` to `.gitignore`.
- `disable`: set `"enabled": false` in that file (keep the other fields).
- `status`: run `bash "${CLAUDE_PLUGIN_ROOT}/skills/continual-learning/scripts/transcript-delta.sh" status` from the project root and report it.

## Guardrails

- Keep the parent skill orchestration-only.
- Do not mine transcripts or edit files in the parent flow (`enable`/`disable` only touch the state file).
- Do not bypass the subagent.

## How the hook decides

The Stop hook (`hooks/continual-learning-stop.sh` in this plugin) counts completed turns in `.claude/hooks/state/continual-learning.json`. When the turn and minute thresholds pass and the transcript has grown since the last run, it adds a note at the end of the turn asking for this skill. It never blocks a stop, skips re-entrant stops, and does nothing when `jq` is missing. Env overrides: `CONTINUAL_LEARNING_MIN_TURNS`, `CONTINUAL_LEARNING_MIN_MINUTES`, `CONTINUAL_LEARNING_TRIAL_MODE`, `CONTINUAL_LEARNING_TRIAL_MIN_TURNS`, `CONTINUAL_LEARNING_TRIAL_MIN_MINUTES`, `CONTINUAL_LEARNING_TRIAL_DURATION_MINUTES` (legacy `CONTINUOUS_LEARNING_*` names also work), and `CONTINUAL_LEARNING_ENABLED=1` to run in every project without the state file.
