# Handoffs

Handoffs are the only way information moves between nodes. Workers produce one; planners read them and decide. No status API, no cross-sibling chatter. That uniformity is what keeps the tree in motion without global coordination.

Every rendered prompt instructs the agent to end with a structured final message (status, branch, summary, notes, follow-ups). Exact format lives in the templates at `prompts/*.md`. On the Claude Code route the agent's final message arrives in its completion notification; the planner saves it to `<workspace>/inbox/<task>.md` and `orch handoff` stores it verbatim at `<workspace>/handoffs/<task-name>.md` with a traceability header. Don't enrich or sanitize; the planner needs the worker's words unfiltered.

## Measurements (worker handoff)

Workers self-report under `## Measurements`; format in `prompts/worker.md`. When a task declares `measurements[]`, `orch handoff` re-runs each command on the worker's branch and flags numeric drift >10% or unit mismatches to `attention.log`; the worker still hands off and the planner decides whether to respawn. Authoring details in `references/planner.md` → `measurements[]`.

## Reading handoffs

For each new `handoffs/*.md`:

1. **Status** other than `success`: decide whether to retry, repair, or clarify via a follow-up task.
2. **Branch**: note it; reference it if another task needs to build on it.
3. **What I did**: treat as fact, but skim for claims that don't match your expectations.
4. **Notes / concerns / deviations / findings / thoughts / feedback**: the richest section. Each bullet may become a new task. Worker feedback about scoping or task clarity is especially valuable: it tells you whether your plan's prompts are pulling their weight.
5. **Suggested follow-ups**: candidate tasks. Accept, reject, or consolidate.

`Status: blocked` is a single task's dead end; the planner retries, repairs, or clarifies and the tree keeps moving. Use an Andon instead (see `references/planner.md` → Failure recovery) only when continued spawning across the tree would waste effort.

## Synthetic failure handoffs

When a worker dies without writing its own handoff (turn or context limit, OOM, tool error, API overload or network drop), the planner runs `orch fail`, which writes `handoffs/<task>-failure.md` so the tree has a postmortem instead of silence.

```markdown
<!-- orchestrate failure handoff
task: <name>
branch: <actual or placeholder branch>
agentId: <agent id>
failureMode: cap-hit | oom | network-drop | tool-error | unknown
terminatedAt: <iso>
-->

# <name> — failure handoff

Status: error (agent terminated without writing a handoff)
Failure mode: cap-hit | oom | network-drop | tool-error | unknown
Agent: <agent id>
Started: <iso>
Terminated: <iso>
Duration: <ms>
Last activity: <iso> - <state.json note>
Last tool call: <name, or (unknown)>
Branch: <branch>
Agent error: <truncated error text>

## Suggested next steps
- <one bullet per option, planner picks>
```

Classifier heuristics (`orch fail`; pass `--mode` to override):
- `oom` when the error or output contains `out of memory` / `OOMKilled` / `exit code 137`
- `cap-hit` when the error mentions max turns, a timeout, or the context window / prompt being too long
- `tool-error` when the error mentions `tool_use_failed` or `tool-error`
- `network-drop` when the error matches `fetch failed` / `ETIMEDOUT` / `ECONN` / `socket` / `dns` / `disconnect` / `overloaded` / `529` / `API error`
- `unknown` otherwise

Default retry strategy by mode:
- `cap-hit` / `oom`: retry with smaller scope
- `network-drop`: retry as-is (treat as transient)
- `tool-error`: retry with a different `model`
- `unknown`: retry as-is once, then abandon

After 2 retries on the same task, prefer abandon (drop from `plan.json`, replan around it) over a 3rd attempt unless you have specific evidence the next retry will succeed.

## Finished-without-handoff sidecar

When an agent finishes but its final message has no `## Status` (or verifier `## Verification`) heading, `orch handoff` writes `handoffs/<task>-finished-no-handoff.md` alongside the raw `<task>.md`. Treat the raw body as the worker's intent; retry if it looks recoverable, abandon if not.

## Upstream handoffs in downstream prompts

Workers live on sibling branches. On the Claude Code route a worker could `git show` a sibling branch, but it doesn't know which ones matter or what they mean. If a downstream task depends on an upstream task's output, the planner must relay it.

`orch prompt` handles the relay. When rendering a task whose `dependsOn` includes handed-off tasks, it pastes each upstream handoff body into the downstream prompt. Read the rendered prompt before spawning.

Consequences:

- `dependsOn` is semantically meaningful, not just a scheduling gate. Use it whenever a downstream task needs upstream findings, even if Git-level ordering doesn't strictly require it.
- Undeclared `dependsOn` + needed upstream context = the worker guesses.
- Long fan-ins inflate prompt size. If it gets unwieldy, push summarization down into upstream handoffs rather than bloating the downstream prompt.
- Handoffs render verbatim: sloppy `## What I did` sections pollute every downstream task. The format is a shared-context commons; respect it.

## Producing your own handoff (subplanner)

A subplanner's final message is its handoff to its parent. Aggregate children upward; don't forward raw child handoffs. The parent has more global context but less local detail.

| Field | Rule |
|-------|------|
| `Status` | `success` only if every acceptance criterion is met. `partial` if any child was partial. `blocked` if any hard blocker remains. |
| `Branch` | The actual deliverable branch you are handing up, not your bookkeeping branch (`orch/<parent-rootSlug>/<your-name>`). Usually it is the last merge-task's output within your subtree. After orphan recovery, or if an integration worker merged into a child's branch, the deliverable may be that child branch instead. Downstream tasks build on whatever you name here, so name the real deliverable explicitly. |
| `What my subtree did` | One bullet per meaningful slice, not per child. The parent cares about work, not your org chart. |
| `Notes / concerns` | Surface anything a sibling subtree or the root might collide with. Silence on real risk is worse than redundant trivia. |
| `Suggested follow-ups` | Tasks for your parent's scope, not yours. |

## Verifier handoffs

A verifier's final message is a verdict on one target task's acceptance criteria. It is not an implementation summary.

```markdown
## Verification
<one of: live-ui-verified | unit-test-verified | type-check-only | verifier-blocked | verifier-failed>

## Target
`<target-name>` on branch `<target-branch>`

## Branch
`<verifier-branch>` (or "(no branch)" if you committed nothing)

## Execution
- <command run> → <outcome>
- <test suite> → <pass/fail counts>
- <manual repro step> → <observed behavior>
(list every meaningful thing you actually ran; this section is what distinguishes a real verification from pattern-matching)

## Findings
Per acceptance criterion:
- [x] <criterion text>: <evidence> (met | not met | n/a)
Other findings (severity-ordered):
- (high) <finding>: evidence
- (med) <finding>: evidence
- (low) <finding>: evidence

## Notes & suggestions
- <anything the planner should know: flaky tests, adjacent issues noticed, suggestions for follow-up tasks>
```

`## Verification` is parsed by `orch handoff` and persisted on the *target* task's state row (`tasks[].verification` in `state.json`) so post-run classifiers bucket "fixed-and-verified" by quality instead of treating every non-failure as equivalent. Authoritative definitions live in `prompts/verifier.md`. Short version:

| Value | Meaning | Planner response |
|---|---|---|
| `live-ui-verified` | Verifier reproduced the bug live and confirmed the fix removes it. | Trust as shipped; no follow-up unless other findings surfaced. |
| `unit-test-verified` | Targeted test exercises the changed code path and passes. | Acceptable for non-UI bugs. For UI bugs, follow up with a `live-ui-verified` pass once env permits. |
| `type-check-only` | Only type-check / build passes. | Weak; only sufficient for typing-only changes. Anything behavioral needs a stronger verifier. |
| `verifier-blocked` | Verifier hit env failures (Docker rate limit, ports, missing creds). | Fix may be correct but unproven. Re-spawn the verifier once the env is healthy, or escalate. Don't count as verified. |
| `verifier-failed` | Verifier ran and the fix did not resolve the bug. | Follow-up fix task, not auto-respawn. |

Workers and subplanners may also write a `## Verification` line to self-report their own evidence. A later verifier overrides that self-report on the same target row.

`orch` also accepts the legacy `## Verdict pass | fail | inconclusive` shape and migrates it to the most conservative new value: `pass` → `type-check-only`, `fail` → `verifier-failed`, `inconclusive` → `verifier-blocked`. New verifier prompts emit `## Verification` directly.

Publish verifiers explicitly in `plan.json`:

```json
{
  "name": "frontend-toggle",
  "type": "worker",
  "scopedGoal": "Add a Settings → Appearance toggle that persists `editor.experimentalDarkMode` through the existing settings service.",
  "pathsAllowed": ["packages/ui/src/settings/**"],
  "acceptance": [
    "Toggle renders in Settings → Appearance",
    "Toggling on persists `editor.experimentalDarkMode=true`",
    "Reloading Settings shows the persisted toggle state"
  ],
  "verify": "## Setup\n- Start the Settings UI dev environment with the existing repo workflow.\n\n## Automated\n- Run the focused Settings UI test that covers Appearance settings persistence.\n\n## Manual\n- Open Settings → Appearance, toggle dark mode on, reload Settings, and confirm the toggle remains on.\n\n## Gotchas\n- Make sure the test account starts with no existing `editor.experimentalDarkMode` override."
},
{
  "name": "verify-frontend-toggle",
  "type": "verifier",
  "verifies": "frontend-toggle",
  "scopedGoal": "Verify the Settings → Appearance toggle works against every acceptance criterion by running the UI test or manually exercising the screen.",
  "acceptance": ["Verification section includes execution evidence for all frontend-toggle acceptance criteria"]
}
```

## Merges are tasks

Because planners don't code, merges happen via tasks. Publish a worker whose `scopedGoal` names both branches and the resolution policy, with `dependsOn` gating both siblings:

```json
{
  "name": "merge-frontend-and-theme",
  "type": "worker",
  "scopedGoal": "Merge `orch/dark-mode/frontend-toggle` into the current branch. On conflict in `packages/ui/src/settings/Settings.tsx`, prefer frontend-toggle's hook wiring. After merge, verify `pnpm -w typecheck` passes.",
  "startingRef": "orch/dark-mode/theme-system",
  "dependsOn": ["frontend-toggle", "theme-system"],
  "acceptance": ["Merge committed with both parents in history", "pnpm -w typecheck passes"]
}
```

Its handoff tells you whether the merge succeeded, whether conflicts were non-obvious, and whether acceptance held. Treat it like any other handoff.

## Continuous motion

A planner isn't strictly "done" while children might still produce handoffs. If one arrives after you've summarized or sent your handoff up:

- Read it.
- If it changes your conclusion, say so: "one more worker just came back with X, revising".
- Publish follow-ups if needed.
- Produce a fresh handoff / summary.

Hard stop only when you've decided to stop publishing and every in-flight task is terminal.
