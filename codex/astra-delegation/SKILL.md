---
name: astra-delegation
description: Delegate bounded independent work during a larger coding or research task when concurrent agents can reduce elapsed time or add useful independent evidence. Use for separable investigations, disjoint implementation work, or an independent verification pass; keep small dependent tasks local.
---

# Astra delegation

Make delegation deliberate. Specify independent assignments and keep agent messages readable. The parent owns integration and verification.

## Dispatch contract

Use available collaboration tools only when session rules permit delegation. This skill requests parallel agents for qualifying independent work, but does not override a higher-priority restriction. If tools are unavailable or delegation is prohibited, continue locally and state the limitation only when it affects the outcome.

Before spawning, identify useful work the parent can do concurrently. Do not split one tightly coupled change merely to increase agent count. Retain the configured model and effort unless the user or applicable instructions choose otherwise.

Give each worker these details:

- The bounded outcome and evidence required for acceptance.
- Relevant paths and context needed to begin.
- Owned files or a read-only responsibility; use separate worktrees when required by the project.
- Constraints, including that other agents share the codebase and their changes must not be reverted.
- Expected return containing artifacts, checks actually run, and unresolved issues.

Start independent workers together, then do the parent's work. Serialize dependent steps, shared-file mutations, and memory-heavy commands. Use a bounded wait after integration is otherwise ready; do not repeat the worker's assignment while waiting.

Inspect returned artifacts before accepting completion. Resolve integration issues, run checks against the combined change, and verify every worker has finished or been stopped before cleanup. A worker's summary is a lead to inspect, not acceptance evidence.

Source: [OpenAI subagent guidance](https://developers.openai.com/api/docs/guides/latest-model#subagent-delegation), accessed 2026-09-05. The dispatch contract applies ownership, process-cleanup, and model-preservation conventions.
