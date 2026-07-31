---
name: delegate-to-agent
description: Delegate bounded coding work to Pi/DeepSeek, Codex, Claude Code, or Grok Build using local CLIs; choose a target/model, bootstrap Pi only, and verify results.
---

# Delegate to an Agent CLI

Use a local coding-agent CLI as a bounded worker. The host agent remains
responsible for scope, safety, review, and final verification.

## Choose the target

| Target | CLI | Default model | Special setup |
| --- | --- | --- | --- |
| `pi` | `pi` | `deepseek-v4-flash` | The runner can install Pi and refresh its DeepSeek catalog. |
| `codex` | `codex exec` | `gpt-5.6-sol` | Codex CLI must already be installed and authenticated. |
| `claude` | `claude -p` | `sonnet` | Claude Code must already be installed and authenticated. |
| `grok-build` | `grok --single` | `grok-4.5` | Grok Build CLI must already be installed and authenticated. |

Aliases include `grok`, `openai`, `codex-cli`, `claude-code`, and `deepseek`.
Pass `--model` to override a default. The target is never inferred from the host
harness: explicitly choose the worker you want.

## Preconditions

1. Read every applicable `AGENTS.md`, `CLAUDE.md`, and repository instruction file.
2. Confirm the working directory is authorized. Never point a worker at a
   prohibited main worktree.
3. Inspect `git status --short` and preserve unrelated changes.
4. Give the worker explicit ownership: goal, permitted files/modules,
   constraints, acceptance criteria, and verification commands.
5. Treat every worker as sharing this workspace. It must not revert unrelated
   work.

## Run a delegation

Resolve the script path from the installed `delegate-to-agent` directory. Use a
task file for nontrivial briefs; keep that temporary file outside the repository
and remove it after the run.

```bash
python3 <skill-dir>/scripts/run_agent_delegate.py \
  --target codex \
  --workdir <authorized-worktree> \
  --mode worker \
  --model gpt-5.6-sol \
  --thinking high \
  --task-file <delegation-brief.md>
```

Examples for the other targets:

```bash
python3 <skill-dir>/scripts/run_agent_delegate.py --target claude --task-file brief.md
python3 <skill-dir>/scripts/run_agent_delegate.py --target grok-build --model grok-4.5 --task-file brief.md
python3 <skill-dir>/scripts/run_agent_delegate.py --target pi --model flash --task-file brief.md
```

Use `--mode reviewer` for independent read-only analysis. Use `--dry-run` to
check the worktree, executable, selected model, and Pi authentication without
calling a model. `--no-bootstrap` disables Pi installation/catalog refresh.

## Installation and authentication

The runner does not silently install native Codex, Claude Code, or Grok Build
CLIs. If one is missing, it reports the official installation hint and stops.
Those CLIs may use OAuth, a configured account, or their own API-key flow; let
the native CLI manage that authentication. Never read, print, pass, or commit
credentials, and never ask the user to paste a key into chat.

Pi is different: during a real run, the runner may install
`@earendil-works/pi-coding-agent` as the current user with npm
`--ignore-scripts`, refresh the DeepSeek model catalog, and use
`DEEPSEEK_API_KEY` or Pi's configured DeepSeek auth entry without printing it.
If Pi authentication is missing, stop and tell the user to configure it in the
parent environment or through Pi's `/login` flow.

## Safety boundaries

The bundled runner deliberately:

- gives workers coding tools only within the selected target's normal CLI;
- uses workspace-write/accept-edits for workers and read-only/plan settings for
  reviewers;
- disables persistence or memory where the target CLI supports it;
- asks workers not to commit, push, deploy, purchase, send messages, access
  credentials, or trigger provider/production effects;
- does not use dangerous permission bypass flags;
- does not delegate the host agent's final authorization or verification.

Do not delegate credentials, deployments, purchases, provider effects, external
messages, commits, pushes, destructive Git operations, or production mutations.
If a worker proposes an out-of-scope action, stop it and handle that action
directly under the applicable authorization and release controls.

## Supervise the result

After the CLI exits:

1. Treat timeout or nonzero status as incomplete.
2. Inspect `git status --short` and the relevant diff.
3. Reject out-of-scope changes and preserve pre-existing work.
4. Read changed code; do not accept the worker's summary as evidence.
5. Run narrow relevant tests independently.
6. Report target, model, delegated scope, changed files, verification, and
   residual risks.

If a worker fails, diagnose once and retry only with materially improved scope or
context. If the selected CLI or model is unavailable, report the exact blocker
and continue locally when the host agent can safely do so.
