# cstack

> **Unofficial port, not original work.** cstack repackages skills, agents and hooks from [cursor/plugins](https://github.com/cursor/plugins) so they run in Claude Code. The ideas and content belong to the authors below. This repo only adds the Claude Code adaptation. It isn't affiliated with or endorsed by them or by Cursor.

## Credits

| Upstream pack | Author | License |
| --- | --- | --- |
| pstack | Lauren Tan ([@poteto](https://github.com/poteto)) | MIT |
| cursor-team-kit, cli-for-agent | Eric Zakariasson | MIT |
| dyl-stack | Dylan Gattey | MIT |
| thermos, teaching, advisor, ralph-loop | Cursor | MIT |

The original copyright and license notice is kept in [LICENSE](LICENSE). If you use these skills, credit the authors above.

Install:

    /plugin marketplace add mitchellbernstein/skills
    /plugin install cstack@mitchell-skills

## What changed in the port
- Cursor tool names mapped: `Task` -> `Agent`, `AskQuestion` -> `AskUserQuestion`, `generalPurpose` -> `general-purpose`.
- Model slugs (grok / claude-opus-*) mapped to `sonnet` / `opus`. `/setup-pstack` writes `~/.claude/cstack-models.md`.
- `.cursor/...` paths mapped to `.claude/...`; transcripts live in `~/.claude/projects/<slug>/<session-id>.jsonl`.
- Cursor built-ins (`create-skill`) mapped to `skill-creator`.
- Dropped: `make-bot-ui` (Grok Bot), `pr-review-canvas`, `workflow-from-chats` (Cursor-only) and the benny automations. `continual-learning` is not ported (reads Cursor transcripts).
- Cursor `.mdc` rules from cursor-team-kit are not ported; add them to `CLAUDE.md` if wanted.

Hooks (`ralph-loop`, `advisor`) are ported to Claude Code Stop / PostToolUse / SubagentStop hooks and smoke-tested with synthetic input, not yet in a live session.
