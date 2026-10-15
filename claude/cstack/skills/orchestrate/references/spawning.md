# Spawning tasks

The contract between `plan.json` entries and the Claude Code subagents the planner spawns. For the Cursor cloud-agent route, read `cursor-sdk/references/spawning.md`.

## Agent types

| Task type | `subagent_type` | Isolation | Default model |
|-----------|-----------------|-----------|---------------|
| worker | `orchestrate-worker` | `worktree` | `sonnet` |
| verifier | `orchestrate-verifier` | `worktree` | `opus` |
| subplanner | `orchestrate-subplanner` | none, runs in the main checkout | `opus` |

`orch ready --json` prints all three fields per task, plus `branch` and `startingRef`. Spawn exactly what it prints, with `run_in_background: true`. When the plugin's agents aren't available (cstack not installed as a plugin), use `subagent_type: "general-purpose"` with the same prompt and `isolation: "worktree"`. The rendered prompt carries the whole contract.

## Branch naming

The planned branch for a task is `orch/<rootSlug>/<task-name>`. A merge worker named `merge-<slice>` commits to `orch/<rootSlug>/<slice>`. Kebab-case is enforced on task names, so they feed branch names and file paths without escaping. Claude Code creates each worktree on its own temporary branch. The worker's prompt tells it to `git switch -c <planned branch> <startingRef>` first, so its commits land on the planned branch. Then it detaches HEAD when done, so other worktrees can check the branch out. Branches live independently until a merge task consolidates them (see `handoffs.md` → "Merges are tasks").

The handoff's `## Branch` line is authoritative. If a worker reports a different branch, `orch handoff` records it and logs the change to `attention.log`.

## Starting refs and dependencies

| Field | Controls | Default | Pair with |
|-------|----------|---------|-----------|
| `startingRef` | Which ref the worker branches from | `plan.baseBranch` | `dependsOn` when depending on another task's work |
| `dependsOn` | When the task is allowed to spawn | `[]` | The upstream branch recorded at handoff |

`startingRef` without `dependsOn` gives a point-in-time snapshot: whatever commits exist on that branch at spawn time, which may be nothing. Pair them unless you really mean "start from the current tip, even if empty".

Verifiers default `startingRef` to their target's branch and auto-include the target in `dependsOn`. The planner doesn't need to wire either explicitly.

Any task can set `verify`: a Markdown-formatted plan (setup, automated, manual, gotchas). Workers see it as a target spec. Verifiers inherit the target's `verify` as their recipe.

## Spawn design decisions

- **Local branches by default.** Worktrees share the repository's `.git`, so workers don't push. Set `plan.push: true` to have workers push to `origin`, for example so CI runs on each branch.
- **PRs are opt-in per task.** With `openPR: true`, the worker pushes and opens a draft PR against `plan.prBase ?? plan.baseBranch` with `gh pr create --draft`. Subplanners and verifiers never open PRs. They hand off to their parent.
- **PR base vs. worker starting ref.** `plan.baseBranch` is the starting ref for workers that don't name their own. `plan.prBase` (defaults to `baseBranch`) is where `openPR` workers aim their PRs.
- **No shared integration branch.** Each task is its own island until a merge task consolidates them. An auto-managed integration branch would smuggle planner-level coding decisions into infrastructure, which violates core principle 1.

## Task prompt contract

`orch prompt` renders prompts from `scopedGoal`, `brief`, `pathsAllowed`, `pathsForbidden`, `acceptance`, `verify`, `startingRef`, `type`, `openPR` and upstream handoffs. If the prompt doesn't match your intent, fix the plan entry. Don't patch the rendered prompt or the template. Every rendered prompt tells the agent:

- It's isolated. No communication with other agents.
- Commit only to its planned branch. No renames, rebases or force-pushes. Open a draft PR only if the task sets `openPR: true`.
- Its final message is the handoff, in the structure from `handoffs.md`. That's the only thing the planner reads.

Workers cannot ask clarifying questions mid-run. An under-specified `scopedGoal` produces silent drift. Write each task as if you'll never get another chance to steer it.

Subagents see the repository and anything you put in the prompt, not your conversation. For data several agents must share, commit a file to the base branch before spawning and reference it by path in `scopedGoal`. Never paste credentials into `scopedGoal`. It ends up in `prompts/` and in the handoffs.

## Slack visibility

When `SLACK_BOT_TOKEN` is set and the plan has a channel, `orch` owns Slack traffic. The first `ready` or `start` posts the kickoff message and records `plan.slackKickoffRef`. `start`, `handoff`, `fail` and `cancel` mirror each task's status in that thread. `ready` reads the `:rotating_light:` reaction for Andon. Rendered prompts include a Slack block so workers can leave notes with `orch comment`. If Slack fails, everything still works from disk.

## Tracking & recovery

`orch start` records the agent id and bumps `attempts`. `orch handoff` records the branch, status, verification and measurements. `orch fail` records the failure mode. A planner that loses its context (compaction, a resumed session) recovers the whole run from `state.json`, `handoffs/` and `attention.log`. Tasks still `running` with no live agent can be respawned.
