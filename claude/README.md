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
