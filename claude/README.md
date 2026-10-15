# Claude Code skills

Claude Code-ready copies belong here. Keep each skill self-contained with a
`SKILL.md`; add Claude-specific adapters only when the harness needs them.

Install `claude/delegate-to-pi` at `~/.claude/skills/delegate-to-pi/` or in a
project's `.claude/skills/` directory. Claude Code invokes it as
`/delegate-to-pi` or loads it automatically when the description matches.
Bundled scripts can resolve their directory with `CLAUDE_SKILL_DIR`. The
matching canonical source remains in `shared/`.

For cross-agent delegation, install `claude/delegate-to-agent` and select the
target explicitly (`pi`, `codex`, `claude`, or `grok-build`).

## cstack plugin

`claude/cstack` is a full Claude Code plugin (skills, agents and hooks). It's an
**unofficial port** of https://github.com/cursor/plugins (MIT): pstack by Lauren
Tan (poteto) and related packs by Eric Zakariasson, Dylan Gattey and Cursor. Credit
belongs to them; see [its credits](cstack/README.md#credits). Install
it once at user scope and it's available in every project:

```sh
/plugin marketplace add mitchellbernstein/skills
/plugin install cstack@mitchell-skills
```

Pick up updates with `/plugin marketplace update mitchell-skills`. A daily task
re-syncs it from upstream; see `claude/cstack/UPSTREAM.md`.
