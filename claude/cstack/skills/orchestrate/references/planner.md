Operating manual for the root planner and subplanners on the Claude Code route. For the Cursor cloud-agent route, read `cursor-sdk/references/planner.md` instead.

# Planner

Root and subplanners behave the same way. The root is the chat that received `/orchestrate` and reports to the user. A subplanner is an `orchestrate-subplanner` subagent and reports to its parent with a handoff.

## Prerequisites

- `node` 18+ and `git` on PATH. The bookkeeping script has no dependencies: `node "${CLAUDE_PLUGIN_ROOT}/skills/orchestrate/scripts/orch.mjs"`, written `orch` below.
- A git repository. Workers and verifiers run with `isolation: "worktree"`, so they need git.
- Worktrees branch from the repository's default branch unless the user's `worktree.baseRef` setting is `"head"`. Workers don't depend on that: each one runs `git switch -c <branch> <startingRef>` from the startingRef its prompt names.
- Claude Code runs subagents in the background. When one finishes, you get a notification with its final message. That notification is the handoff.
- Slack is optional and needs `SLACK_BOT_TOKEN` plus `plan.slackChannel` or `SLACK_CHANNEL_ID`. Scopes: `chat:write`, `chat:write.customize`, `chat:write.public`, `reactions:read`, `reactions:write`, `files:write`, `files:read`, `channels:history` (`groups:history` for private channels). Slack failures go to `attention.log`, and the run continues.

## Source of truth

Git and disk are the substrate.

- `plan.json` carries the task graph, Slack config, and model choices. You write it.
- `state.json` carries task status, agent ids, branch names, attempts, verification and Slack timestamps. Only `orch` writes it.
- `handoffs/*.md` carries worker and verifier output, verbatim, with a traceability header.
- `attention.log` carries operator-visible failures and decisions: measurement drift, missing handoffs, failures, Andon.
- `prompts/<task>.md` holds the rendered spawn prompt for each task, kept for audit.

Branches carry code. Workers commit to `orch/<rootSlug>/<task>` in their own worktree. All worktrees share the repository's `.git`, so a branch committed in one is visible everywhere without a push. Merge workers named `merge-<slice>` commit to `orch/<rootSlug>/<slice>`.

## Phase 1: publish tasks

Write `plan.json` at `<workspace>`. The default workspace is `.orchestrate/<rootSlug>/` at the repository root. Add `.orchestrate/` to `.git/info/exclude` so the bookkeeping never lands in a commit.

```json
{
  "$schema": "<orchestrate skill dir>/schemas/plan.schema.json",
  "goal": "<verbatim user goal>",
  "summary": "ship the dark-mode toggle end to end",
  "rootSlug": "dark-mode",
  "baseBranch": "main",
  "tasks": [
    {
      "name": "frontend-toggle",
      "type": "worker",
      "scopedGoal": "Add a Settings UI toggle that flips `useDarkMode` in localStorage.",
      "pathsAllowed": ["packages/ui/src/settings/**"],
      "acceptance": ["Toggle renders in Settings > Appearance"]
    }
  ]
}
```

Run `orch validate <workspace>` after every edit to `plan.json`. It checks the schema (kebab-case names, known fields, verifier targets, `dependsOn` targets, cycles) and syncs `state.json`: new tasks become `pending`, and removed tasks become `pruned`.

`summary` is for the human in the Slack thread. `goal` is the agent's full context. Set `"push": true` when workers should push their branches to `origin`. Tasks with `openPR: true` always push and open a draft PR with `gh pr create --draft`.

Planning rules:

- Merges are tasks. Publish a worker whose `scopedGoal` says which branches to merge, conflict intent, and verification. Name it `merge-<slice>` to get the merge-worker branch discipline.
- Prefer a worker unless you can name the decomposition a subplanner would do. Subplanners cost a layer of nesting, and Claude Code allows three subagent layers below the main chat by default (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`). So a root can have subplanners whose children are workers, and a sub-subplanner gets no `Agent` tool.
- One worker can carry a lot: multi-file slices, multi-step refactors, full repro/fix/test cycles. Each spawn costs tokens, a worktree and your own drain time. Default to fewer, broader workers. Reach for finer granularity only when a slice is genuinely independent or has real contention risk.
- Default to verifiers. Use `type: "verifier"` and `verifies: "<target-task-name>"`. A verifier depends on its target automatically and starts from the target's branch.
- Use `verify` for the concrete check recipe. Workers read it as target behavior. Verifiers inherit it from their target.
- Add `measurements[]` for quantitative claims. `orch handoff` re-runs each command on the worker's branch in a throwaway worktree, with an allowlisted environment and a scratch `HOME`, and logs drift over 10% or unit mismatches.
- Keep fan-in small. If a task needs many upstream handoffs, publish an aggregation worker first.
- Minimize path overlap. List forbidden paths when sibling ownership matters.
- Put task specs in `plan.tasks[]`. Put shared artifacts in git and reference them by path.
- Pick `model` per task (`sonnet`, `opus`, `haiku`, `inherit`). Defaults are `sonnet` for workers and `opus` for verifiers and subplanners. `orch models` prints the guidance. When the user ran `/setup-pstack`, prefer the matching role lines in `~/.claude/cstack-models.md`.

## Phase 2: drive the workspace

You are the heartbeat. There is no long-running loop process: the loop is you, draining notifications.

1. `orch ready <workspace> --json` lists the tasks to spawn now. Those are pending tasks whose dependencies have all handed off, with no Andon raised and `maxAttempts` not exceeded. Each row gives `subagent_type`, `model`, `isolation`, `branch` and `startingRef`.
2. For each ready task, render its prompt with `orch prompt <workspace> <task> --out -` and spawn it. Put every ready task's `Agent` call in one message:
   - `subagent_type`: the row's value (`orchestrate-worker`, `orchestrate-verifier` or `orchestrate-subplanner`)
   - `model`: the row's value
   - `isolation: "worktree"` for workers and verifiers. Subplanners run without isolation, in the main checkout, because they write planner state.
   - `run_in_background: true`
   - `prompt`: the rendered prompt, verbatim. Don't edit it. Fix `plan.json` instead and re-render.
3. Right after spawning, run `orch start <workspace> <task> --agent-id <id>` for each one.
4. When an agent's completion notification arrives, save its final message verbatim to `<workspace>/inbox/<task>.md` with the file-writing tool, then run `orch handoff <workspace> <task> <workspace>/inbox/<task>.md`. The script stores the handoff, parses `## Status`, `## Branch` and `## Verification`, re-runs measurements, writes a `-finished-no-handoff.md` sidecar when the structure is missing, and points pending verifiers at the real branch.
5. When an agent dies without a final message (error, killed, out of turns or context), run `orch fail <workspace> <task> --error "<what you saw>"`. It classifies the failure mode and writes `handoffs/<task>-failure.md`.
6. Read the new handoffs (see `handoffs.md`), edit `plan.json` if needed, run `orch validate`, and go back to step 1.

Don't end your turn while any task is `pending` or `running` (`orch status <workspace>`). While agents run and nothing is ready, wait for the next notification. Don't poll. When every task is terminal and you've decided to stop publishing, report to the user (root) or write your handoff (subplanner).

To stop a running agent, use `TaskStop` with its id, then `orch cancel <workspace> <task>`. To retry, run `orch respawn <workspace> <task>`. It goes back to `pending`, and the next `ready` lists it. A respawned worker continues on its existing branch. To drop a pending task, run `orch prune`, or remove it from `plan.json`.

## Comments

`orch comment "<note>" --workspace <workspace> [--sender <name>] [--file <path>] [--criticality required]` posts in the Slack run thread when Slack is configured, and otherwise records the note in `attention.log`. For Linear, GitHub or other trackers, call the relevant MCP directly. Orchestrate doesn't route those systems.

## Failure recovery

`orch` handles bookkeeping. The planner handles meaning.

- Failure modes: `cap-hit` (turn, context or time limit), `oom`, `network-drop` (API overload, connection errors), `tool-error`, `unknown`. The failure handoff lists retry options for each mode.
- A blocked handoff is a planner decision: respawn, split, escalate, or drop.
- Downstream tasks stay `pending` when an upstream fails. Fix the upstream and respawn it, or `cancel` the downstream work.
- `maxAttempts` caps spawning per task. When it's exceeded, `ready` marks the task `error`. Raise it in the task definition only when another attempt is intentional.
- A worker that can't check out its branch because an old worktree holds it hands off `blocked`. Remove the stale worktree (`git worktree list`, `git worktree remove`) and respawn.

### Andon

Andon pauses new spawns across the tree. Raise it only when continued spawning would produce garbage for the tree: bad upstream output, broken acceptance, or unrecoverable auth or infra. A task's own snag belongs in its handoff, not Andon.

```bash
orch andon raise --reason "<why>" <workspace>
orch andon clear [--note "<what changed>"] <workspace>
```

While Andon is up, `ready` returns nothing. Subplanner workspaces set `andonStatePath` to the root's `state.json`, so one raise pauses the whole tree. With Slack configured, a `:rotating_light:` reaction on the kickoff message raises Andon and removing it clears it. The root's `ready` polls the reaction.

## Finding agents

`orch tree <workspace>` shows the task tree with status, branch, agent id and verification, and recurses into subplanner workspaces (`.orchestrate/<subplanner-name>/`). `orch list <workspace> [--status s] [--json]` shows a flat table. Use the agent ids with `TaskStop`, or to resume a finished agent with a follow-up.

## Cleaning up

Worktrees with commits stay on disk until Claude Code's periodic sweep removes them, or until you run `git worktree remove`. After the run, list them with `git worktree list` and offer to prune the `orch/<rootSlug>/*` worktrees whose branches are merged or abandoned. Branches survive worktree removal.
