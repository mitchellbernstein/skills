---
name: delegate-to-pi
description: Delegate bounded coding work to local Pi with DeepSeek V4 Flash. Use for Pi or DeepSeek implementation, debugging, testing, refactoring, or review; worker edits, reviewer stays read-only.
---

# Delegate to Pi

Use Pi as bounded implementation worker. Keep the host agent responsible for scope, safety, review, and final verification.

## Preconditions

1. Read applicable `AGENTS.md` files before delegation.
2. Confirm current directory is task-authorized worktree. Never redirect Pi into a prohibited main worktree.
3. Inspect `git status --short` when inside Git repository. Preserve unrelated user or agent changes.
4. Give Pi explicit ownership: goal, permitted files/modules, constraints, acceptance criteria, and verification commands.
5. Treat Pi as another worker sharing workspace. Warn it other work may exist and it must not revert unrelated edits.

## Bootstrap Pi and DeepSeek

The bundled runner bootstraps missing local plumbing during a real run:

- If `pi` is absent, install the official `@earendil-works/pi-coding-agent` package with npm `--ignore-scripts` as the current user. Never use `sudo` or an install script.
- If V4 Flash is absent from Pi's catalog, run `pi update --models` once and recheck.
- Always pass `--provider deepseek --model deepseek-v4-flash`; a persisted `/model` choice is not required.
- Check `DEEPSEEK_API_KEY` and Pi's `auth.json` without printing values.

If authentication is missing, stop and ask the user to set `DEEPSEEK_API_KEY` in the parent shell or run `pi`, then `/login` and select DeepSeek. Never ask the user to paste a key into chat, pass it via `--api-key`, or write it to repository files. Retry after the user confirms setup.

Use `--no-bootstrap` when the user explicitly wants a no-install/no-refresh preflight.

## Select mode and model

- Default to `worker`: enable `read,bash,edit,write,grep,find,ls` so Pi can implement and test.
- Use `reviewer` only for independent analysis without edits.
- Default both `worker` and `reviewer` to `flash` with `high` thinking, including difficult work. Do not escalate to Pro automatically.
- Use `pro` only when user explicitly requests V4 Pro. Use `max` thinking only when user explicitly requests maximum reasoning or measured task evidence supports it.
- Split vague or oversized work into one bounded delegation at a time.

## Run delegation

Use bundled runner. Resolve the script path from this skill directory. In Claude Code, use `${CLAUDE_SKILL_DIR}/scripts/run_pi_delegate.py`; in other harnesses, use the equivalent installed skill path:

```bash
python3 <skill-dir>/scripts/run_pi_delegate.py \
  --workdir <authorized-worktree> \
  --mode worker \
  --model flash \
  --thinking high \
  --task-file <delegation-brief.md>
```

Prefer `--task-file` for nontrivial briefs. Put temporary brief outside repository, do not include secrets, then unlink it after run. `--task` is acceptable for short safely quoted text. Use `--dry-run` to validate setup without calling DeepSeek.

Runner deliberately:

- defaults every mode to official `deepseek-v4-flash`; accepts `deepseek-v4-pro` only as explicit override;
- grants full coding tools in worker mode;
- preserves `AGENTS.md` context;
- disables discovered Pi extensions, skills, and prompt templates for predictable execution;
- ignores unapproved project-local Pi resources;
- saves no Pi session;
- never prints or passes an API key on command line.

Do not delegate credentials, deployments, purchases, provider effects, external messages, commits, pushes, destructive Git operations, or production mutations. Those require direct user authorization and separate controlled handling by the host agent.

## Supervise result

After Pi exits:

1. Check exit status. Treat timeout or nonzero status as incomplete.
2. Inspect `git status --short` and relevant diff. Reject out-of-scope changes.
3. Read changed code; do not accept Pi summary as evidence.
4. Run narrow relevant tests independently. Pi-run tests are useful but not final verification.
5. Fix or revert only Pi-owned changes when needed; preserve pre-existing changes.
6. Report delegated scope, changed files, verification result, and residual risks.

## Forward progress

If Pi fails, diagnose once. Retry only with materially improved scope or context. Do not repeatedly spend model tokens on identical prompt. If Pi is unavailable, model missing, or credentials unresolved, report exact blocker and continue locally when within user scope.
