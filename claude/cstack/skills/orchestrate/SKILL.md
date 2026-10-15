---
name: orchestrate
description: "Use only when the user explicitly types /orchestrate followed by a goal: decompose a large task into a plan.json task graph, then fan it out across parallel Claude Code subagents (workers and verifiers in isolated git worktrees, optional recursive subplanners) and drive it to convergence through structured handoffs, with an optional Cursor cloud-agent route via the Cursor SDK. Do not invoke autonomously."
disable-model-invocation: true
argument-hint: "<goal>"
---

# Orchestrate

An explicit `/orchestrate <goal>` fans out a large task across parallel agents. Workers don't talk to each other. They talk up through structured handoffs. The planner writes `plan.json`. A bookkeeping script renders prompts, tracks state and parses handoffs. The planner reads the handoffs to decide what comes next. Long-running agent loops drift, and a script with a JSON state file keeps its footing.

Goal: $ARGUMENTS

## Two routes

1. **Claude Code subagents (default).** This chat is the root planner. Workers and verifiers are background `Agent` subagents, each in its own git worktree (`isolation: "worktree"`). Subplanners are subagents that run their own plan. The bookkeeping script is `node "${CLAUDE_PLUGIN_ROOT}/skills/orchestrate/scripts/orch.mjs"`. It needs Node 18+ and git, and has no install step. Read `references/planner.md`.
2. **Cursor cloud agents (optional).** Use this only when the user asks for Cursor cloud agents and `CURSOR_API_KEY` is set. Each node is a Cursor cloud agent on its own VM, and the root planner runs in the cloud. This chat dispatches once and returns the run URL. Read `references/cursor-cloud.md`. It points to the upstream implementation, which is vendored unchanged under `cursor-sdk/`.

If the user doesn't say which, use route 1. If they ask for Cursor and `CURSOR_API_KEY` is unset, say so and offer route 1.

This is the standalone orchestrate skill from cursor/plugins. pstack's `poteto-mode` also has an Orchestrate playbook (`playbooks/orchestrate.md`) for standing multi-day programs run from a coordinator chat with a store of TSV ledgers. Use that one inside `/poteto-mode`. Use this one for a single `/orchestrate <goal>` run with a task graph and verifiers.

## Setup (route 1)

- A git repository, with `.orchestrate/` added to `.git/info/exclude`.
- Optional Slack visibility: `SLACK_BOT_TOKEN` plus `plan.slackChannel` or `SLACK_CHANNEL_ID`. The script posts a kickoff message, mirrors task status in its thread, and reads a `:rotating_light:` reaction as Andon. When the token is unset, the script records notes in `attention.log` instead. Correctness doesn't depend on Slack.

## Core principles

These rules make the tree self-converging without global coordination.

1. **Planners own scopes and publish tasks. They do no coding.** Writing `plan.json`, reading handoffs, and deciding what's next are planner work. Editing files, running `git merge`, and fixing conflicts inline are not. If a planner feels the urge to code, it publishes a task for a worker instead.
2. **Planners don't know who picks up their tasks.** The script picks the agent type, model default and isolation for each task. The planner's mental model stays at the task level.
3. **Workers are isolated.** One task, one worktree, no channel to any other agent. One handoff when done.
4. **Subplanners are recursive planners.** A planner publishes a "subplan this slice" task. The subplanner fully owns that slice and hands back an aggregated handoff. Claude Code allows three subagent layers below the main chat by default, so keep recursion shallow.
5. **Continuous motion via handoffs.** A planner that thought it was done can receive a late handoff and replan. Nothing is "finished" until the planner decides to stop publishing.
6. **Propagation, not synchronization.** No cross-talk between siblings. No shared state between levels. Each level sees only its children's handoffs.

## Node types

| Node           | Runs the loop? | Scope                            | Output                                  | Claude Code agent |
| -------------- | -------------- | -------------------------------- | --------------------------------------- | ----------------- |
| Planner        | yes            | Entire user goal                 | User-facing message + optional PR       | this chat |
| Subplanner (↻) | yes            | One slice of parent's scope      | Handoff to parent                       | `orchestrate-subplanner` |
| Worker         | no             | One concrete task                | Handoff to spawning planner             | `orchestrate-worker` (worktree) |
| Verifier       | no             | One target's acceptance criteria | Verdict handoff to spawning planner     | `orchestrate-verifier` (worktree) |
| Git            | n/a            | Shared medium                    | Branches (code) + `handoffs/` (meaning) | |

## Role

**Root planner (route 1).** You received `/orchestrate <goal>` in this chat. Clarify only if the goal is missing or ambiguous: the user chose orchestration deliberately, so push back only if the task is genuinely trivial. Then discover enough to decompose, write `.orchestrate/<rootSlug>/plan.json`, and drive it per `references/planner.md`. Read `references/handoffs.md` before reading your first handoff, and `references/spawning.md` for the spawn contract. Report to the user when every task is terminal and you've stopped publishing.

**Subplanner.** You were spawned as `orchestrate-subplanner` with a prompt that opens "You are a subplanner for:". Follow `references/planner.md` with the workspace your prompt names.

**Dispatcher (route 2).** Run the kickoff CLI per `references/cursor-cloud.md`, return the URL, and stop. You are not the planner.

`disable-model-invocation: true` means this skill loads only on explicit invocation. Subplanners read its files by path from their rendered prompt.
