# cstack

> **Unofficial port, not original work.** cstack repackages skills, agents and hooks from [cursor/plugins](https://github.com/cursor/plugins) so they run in Claude Code. The ideas and content belong to the authors below. This repo only adds the Claude Code adaptation. It isn't affiliated with or endorsed by them or by Cursor.

## Credits

| Upstream pack | Author | License |
| --- | --- | --- |
| pstack | Lauren Tan ([@poteto](https://github.com/poteto)) | MIT |
| cursor-team-kit, cli-for-agent, continual-learning, grok-voice | Eric Zakariasson | MIT |
| dyl-stack | Dylan Gattey | MIT |
| thermos, teaching, advisor, ralph-loop, agent-compatibility, create-plugin, orchestrate, cursor-sdk, origin-apps, docs-canvas, pr-review-canvas | Cursor | MIT |

Each pack's original copyright and license notice is kept in [LICENSES/](LICENSES) (pstack's also in [LICENSE](LICENSE)). If you use these skills, credit the authors above. [COMPATIBILITY.md](COMPATIBILITY.md) maps every upstream item to its place here.

Install in Claude Code:

    claude plugin marketplace add mitchellbernstein/skills
    claude plugin install cstack@mitchell-skills

In the Claude app: Customize > Plugins > Add > Add marketplace > `mitchellbernstein/skills`, then Add cstack. Skills work in chat; agents and hooks run in Cowork and Claude Code.

## What changed in the port
- Cursor tool names mapped: `Task` -> `Agent`, `AskQuestion` -> `AskUserQuestion`, `generalPurpose` -> `general-purpose`.
- Model slugs (grok / claude-opus-*) mapped to `sonnet` / `opus` (`fast` -> `haiku`). Per-spawn reasoning level maps to the `Agent` call's `effort`; Claude Code sets fast mode per session, so per-spawn speed is dropped. `/setup-pstack` writes `~/.claude/cstack-models.md`, and its budget sets the starting effort.
- Agent frontmatter: `is_background` -> `background`; `readonly` -> a `tools` allowlist or `disallowedTools: Write, Edit`. Skill frontmatter such as `disable-model-invocation` is kept as upstream has it.
- `.cursor/...` paths mapped to `.claude/...`; transcripts live in `~/.claude/projects/<slug>/<session-id>.jsonl` (slug: every non-alphanumeric character becomes `-`).
- Cursor built-ins (`create-skill`) mapped to `skill-creator`. Claude Code has no Custom Modes; start each task with `/poteto-mode`.
- Cursor's always-applied `pstack-models.mdc` becomes `~/.claude/cstack-models.md`. Claude Code doesn't auto-load it, so every skill that spawns subagents reads it by that path.
- Cursor `.mdc` rules (cursor-team-kit, create-plugin) are skills whose description says when they apply; add one to a repo's `CLAUDE.md` to make it always-on.
- `make-bot-ui` and the benny automations (`automations/benny`) target Claude Code routines instead of Grok Bot / Cursor automations. Routines have no Slack trigger, so benny needs a relay calling the routine's API trigger, or an hourly schedule.
- agent-compatibility: the `agent-compatibility` npm CLI runs through `scripts/scan.sh`; when a repo has `CLAUDE.md` and no `AGENTS.md`, the CLI's AGENTS.md-only guidance check is weighted 0 so Claude Code repos aren't docked.
- create-plugin: targets Claude Code plugins (`.claude-plugin/plugin.json`, `marketplace.json`, `claude plugin init` / `validate`).
- continual-learning: Stop hook rewritten in bash (`jq`, no install), opt-in per project via `/continual-learning enable`; reads Claude Code transcripts incrementally and updates `CLAUDE.md` (or `AGENTS.md` when the repo uses it).
- orchestrate: by default fans out Claude Code subagents (background, worktree isolation) with `scripts/orch.mjs` for plan, state and handoffs; the Cursor SDK cloud-agent route is vendored unchanged under `skills/orchestrate/cursor-sdk/` and needs `CURSOR_API_KEY`. Distinct from poteto-mode's Orchestrate playbook.
- docs-canvas, pr-review-canvas: render a self-contained HTML page instead of a Cursor Canvas, with the same information design.
- Cursor's `afterAgentResponse` capture hooks are folded into the Stop hooks, since Claude Code passes the last reply to Stop.

Hooks (`ralph-loop`, `advisor`, `continual-learning`) are ported to Claude Code Stop / PostToolUse / SubagentStop hooks and smoke-tested with synthetic input. `continual-learning` is off until enabled per project.
