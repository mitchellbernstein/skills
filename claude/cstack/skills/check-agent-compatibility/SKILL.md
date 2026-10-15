---
name: check-agent-compatibility
description: "Run the full repository agent-compatibility pass: the agent-compatibility CLI score, plus startup, validation-loop and docs-reliability reviews, blended into one score and a short list of top fixes. Use when the user asks how agent-friendly a repo is, for an agent-compatibility score or audit, or /check-agent-compatibility."
argument-hint: "[repo-path]"
---

# Check agent compatibility

## Trigger

Use when the user wants the full compatibility pass for a repo. The repo is `$ARGUMENTS` when given, otherwise the current working directory.

## Scanner

The deterministic score comes from the published `agent-compatibility` npm CLI. It is not bundled. Run it through the port's wrapper, which needs `node`/`npx` and network access to npm:

    bash "${CLAUDE_PLUGIN_ROOT}/skills/check-agent-compatibility/scripts/scan.sh" [--json|--md|--text] <repo-path>

The wrapper runs `npx -y agent-compatibility@latest`, honors a repo-root `agent-compatibility.config.json`, and exits 3 when the scanner can't run in this environment. The scanner credits only `AGENTS.md` for its agent-guidance check, so when the repo has `CLAUDE.md` and no `AGENTS.md` the wrapper weights that check 0 through the CLI's `--config` override. A Claude Code repo isn't docked for the file name.

## Workflow

1. Launch the `compatibility-scan-review` subagent (`Agent`, `subagent_type: "compatibility-scan-review"`) on the repo path. It runs the CLI and returns the raw `Deterministic Compatibility Score` and main problems. Wait for it.
2. In one message, launch three subagents in parallel, one `Agent` call each, and paste the scan result from step 1 into every prompt so none of them re-runs the scanner:
   - `startup-review` to verify whether an agent can actually boot the repo.
   - `validation-review` to check whether an agent can verify a small change without an unnecessarily heavy loop.
   - `docs-reliability-review` to see whether the documented setup and run paths reliably match reality.
3. Use one subagent per task. Do not collapse these checks into one agent prompt.
4. Compute an internal workflow score as the rounded average of:
   - `Startup Compatibility Score`
   - `Validation Loop Score`
   - `Docs Reliability Score`
5. Compute an `Agent Compatibility Score` as:
   - `round((deterministic_score * 0.7) + (workflow_score * 0.3))`
   - If the deterministic scan was unavailable because of the tool environment, use the workflow score alone and say so on its own line.
6. Synthesize the results into one final response.

When scoring internally, use specific non-round workflow scores for the behavioral checks rather than coarse round buckets. If startup, validation, or docs mostly work, treat them as good-with-friction rather than defaulting to the mid-60s. Do not create a low workflow score just because logs are noisy or the error text is rough.

## Output

Respond in markdown, but keep it minimal. Do not use fenced code blocks.

Show only one score, as a level-two heading: `## Agent Compatibility Score: N/100`. Do not show how it was computed, including weights, formula, deterministic score, workflow score, per-check scores, or arithmetic, unless the user explicitly asks for a breakdown.

Then a flat, prioritized list labeled `Top fixes` with one issue per line, each line starting with `- `.

If the deterministic scanner cannot be run because of tool environment issues, say that separately and do not treat it as a repo defect or penalize the repo. Fold deterministic and behavioral findings into that one list instead of separate sections. Focus on the fixes that would most improve real agent workflows. Do not include a separate summary unless the user asks for more detail.

A missing `AGENTS.md` is not a fix to recommend when the repo has a `CLAUDE.md`. Claude Code reads either one. Recommend `AGENTS.md` only when the user says other agents (Cursor, Codex) must read the guidance too, and then suggest `@AGENTS.md` imported from `CLAUDE.md` so one file serves both.

Example shape:

## Agent Compatibility Score: 72/100

Top fixes
- First issue
- Second issue
- Third issue

## Breakdown on request

If the user asks for the breakdown, show the four component scores (Deterministic, Startup, Validation Loop, Docs Reliability), the formula above, and each agent's Problems list. Mention that the CLI's accelerator layer (committed agent tooling such as `.claude/agents`, `.claude/commands`, `.cursor/` rules, MCP config) informs recommendations but doesn't change the deterministic score.

## Running one check

Each agent works on its own. "Just run the scanner" → `compatibility-scan-review` alone (or the wrapper with `--md` for a direct report). "Can an agent boot this repo?" → `startup-review` alone. The other two agents run the scan once themselves when no scan result is in their prompt.
