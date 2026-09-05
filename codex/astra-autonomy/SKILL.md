---
name: astra-autonomy
description: Complete implementation and artifact-creation requests with fewer user checkpoints. Use for multi-step work, requests to take ownership, or premature stops after planning. Do not turn an explanation, review, or planning-only request into implementation.
---

# Astra autonomy

Carry the requested outcome through implementation and verification. Infer routine details from context, preserve existing authorization, and prepare a reviewable result before requesting any missing approval. Keep working on independent parts while a necessary question is pending.

## Apply in Codex

1. Establish the deliverable, acceptance evidence, and authorized actions from the conversation. Keep a short task list for multi-step work. An action request such as "can you fix this" starts execution; a question about how something works does not.
2. Read applicable project instructions and the relevant implementation. Resolve observable facts with tools. For a reversible implementation choice, use the existing project convention and state consequential assumptions briefly. Ask when the missing answer changes the intended product or an action's authorization.
3. Execute the next dependency-ready step. Reuse the active project's workflow instead of creating a second planning system. Planning, discovery, and passing tests are milestones, not substitutes for the requested deliverable.
4. Use the smallest verification that demonstrates the changed behavior, plus required project checks. A copy edit may need inspection; changed logic needs a behavioral check; a UI interaction needs exercise on its actual interface. Fix failures introduced by this work. Expand checks when new evidence warrants it, not merely because another suite exists.
5. Reconcile the result with every requested item. Report delivered artifacts, observed checks, and any remaining blocker. Do not call incomplete work complete or ask whether to perform an already-requested next step.

## Preserve continuity

Treat corrections and side questions as steering unless the user cancels or replaces the objective. Answer status questions briefly and resume. Before compaction or handoff, use existing task state to preserve completed work, pending actions, decisions, and exact verification results.

After a failed attempt, change the hypothesis or method. Do not repeat a failed external write until its actual outcome is known. When access, required input, or a higher-priority restriction prevents further progress, identify the exact blocked action and the smallest missing prerequisite. Autonomy does not imply deployment, purchase, messaging, or deletion permission.

Keep the configured model and reasoning settings. Respect existing writing preferences. Skills affect decisions; they do not enable background execution, scheduler wakeups, or API capabilities.

If an instruction appears to force an unnecessary pause, read [Astra instruction audit](../astra-instruction-audit/SKILL.md). For independent work that benefits from delegation, read [Astra delegation](../astra-delegation/SKILL.md).

Source: [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model#initiative-and-follow-through), accessed 2026-09-05. The numbered workflow and continuity rules adapt that guidance to Codex task execution.
