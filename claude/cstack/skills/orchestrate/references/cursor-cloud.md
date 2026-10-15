# Optional route: Cursor cloud agents via the Cursor SDK

Use this route only when the user asks for Cursor cloud agents and has a Cursor API key. It is the upstream orchestrate implementation, vendored unchanged under `cursor-sdk/`. Each node is a Cursor cloud agent on its own VM with hours of runtime. A TypeScript script drives the spawn, wait and handoff loop, and the root planner runs in the cloud, not in this chat.

## What's in `cursor-sdk/`

- `scripts/`: the upstream Bun CLI (`cli.ts` with `kickoff`, `run`, `spawn`, `respawn`, `kill`, `kill-tree`, `tail`, `tree`, `list`, `status`, `crawl`, `prompt`, `comment`, `andon`, `models`) and its tests.
- `prompts/`: the cloud-agent prompt templates (root, worker, subplanner, verifier, failure sidecars, Slack and Andon blocks).
- `schemas/`: `plan.schema.json` and `state.schema.json` for this route (`repoUrl` is required).
- `references/`: the upstream dispatcher, planner, spawning and handoffs manuals. Read them in place of this skill's `references/` when you run this route.

## Setup

1. `bun` on PATH.
2. `CURSOR_API_KEY`: a personal user API key from <https://cursor.com/dashboard/integrations> (it starts with `cursor_`). Team service-account keys also work. For the auth model and error taxonomy, use the cstack `cursor-sdk` skill when it's installed.
3. Install once: `cd "${CLAUDE_PLUGIN_ROOT}/skills/orchestrate/cursor-sdk/scripts" && bun install`. The scripts sit outside any host workspace on purpose. Claude Code can also keep `node_modules` in `${CLAUDE_PLUGIN_DATA}`, but `bun` resolves from the script's directory, so install in place.
4. Optional Slack: `SLACK_BOT_TOKEN` plus `--slack-channel <id>` or `SLACK_CHANNEL_ID`. Scopes are listed in `cursor-sdk/references/planner.md`.
5. The repository must be pushed to GitHub. Cloud agents clone `repoUrl` (auto-detected from `git config --get remote.origin.url`) and work on pushed branches.

## Dispatch

You are the dispatcher: one-shot. Follow `cursor-sdk/references/dispatcher.md`:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/orchestrate/cursor-sdk/scripts/cli.ts" kickoff "<goal>" \
  [--repo <url>] [--ref main] [--model claude-opus-4-8] [--slack-channel <id>] [--dispatcher-name "<first name>"]
```

The CLI prints `{ agentId, runId, status, url }`. Return the URL to the user and stop. The cloud root planner reads `prompts/root.md`, loads the orchestrate skill from Cursor's own plugin (not this port), and self-drives with `bun cli.ts run --root <workspace>`.

`--model` takes Cursor model slugs (`claude-opus-4-8`, `opus-max`, `gpt-5.5-high-fast` and others; `bun cli.ts models` prints the catalog). These are Cursor-side ids, not Claude Code's `sonnet` / `opus`.

## Observe and control from Claude Code

- `bun cli.ts crawl <repo-path> <root-branch> <root-slug>` gives a deep tree view across planner branches. Run `git fetch` first.
- `bun cli.ts status <workspace>`, `tree`, `list` and `tail` show progress.
- `bun cli.ts kill-tree <repo-path> <root-branch> <root-slug> [--agent-id <id>]` cancels running cloud agents.
- `bun cli.ts andon raise --reason "<why>" --workspace <ws>` and `andon clear` pause and resume the tree.

## Running the planner loop locally against cloud workers

Upstream also supports running the planner loop in a local session while workers run in the cloud. Write `plan.json` with `repoUrl`, then run `bun cli.ts run --root <workspace>` in the foreground (exit code 100 means a planned checkpoint: rerun it). In Claude Code, run it with the Bash tool and a long `timeout`, not `run_in_background`, because the script is the heartbeat. Read `cursor-sdk/references/planner.md` for the full contract.

## Tests

`cd cursor-sdk/scripts && bun install && bun test` runs the upstream suite (209 tests, no network).
