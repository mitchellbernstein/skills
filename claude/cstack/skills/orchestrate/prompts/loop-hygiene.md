Loop hygiene:
- The loop is: `{{orch}} ready {{workspace}} --json` → for each ready task, `{{orch}} prompt {{workspace}} <task> --out -`, spawn it with the `Agent` tool (the `subagent_type` and `model` that `ready` printed, `run_in_background: true`, the rendered prompt verbatim), then `{{orch}} start {{workspace}} <task> --agent-id <id>`.
- When an agent finishes, save its final message verbatim to `{{workspace}}/inbox/<task>.md` and run `{{orch}} handoff {{workspace}} <task> {{workspace}}/inbox/<task>.md`. When it dies without a final message (error, killed, out of turns or context), run `{{orch}} fail {{workspace}} <task> --error "<what you saw>"`; the script writes `handoffs/<task>-failure.md`.
- After every handoff or failure, run `ready` again. Don't end your turn while this workspace has non-terminal tasks (`{{orch}} status {{workspace}}`).

Reacting to failure handoffs:
For each task with `status: "error"` and a matching `handoffs/<task>-failure.md`, read the `Failure mode` line and decide:
- `cap-hit` or `oom`: retry with smaller scope (split into narrower tasks, tighter `pathsAllowed`, leaner `scopedGoal`).
- `network-drop`: retry as-is; treat as transient.
- `tool-error`: retry with a different `model`.
- `unknown`: read the `Last activity` and `Agent error` lines; if no signal, treat as transient and retry as-is; abandon if it fails again.
For `<task>-finished-no-handoff.md`, read the raw snippet at `handoffs/<task>.md` and decide whether the worker's intent was recoverable; retry or abandon.
Retry with `{{orch}} respawn {{workspace}} <task>` (after editing plan.json if the scope changes). After 2 retries on the same task, prefer abandon (drop the task from `plan.json`, replan around it) over a 3rd attempt unless you have specific evidence the next retry will succeed.
