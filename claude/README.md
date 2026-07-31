# Claude skills

Claude-specific skills belong here. Keep each skill self-contained with a
`SKILL.md`; add Claude-specific adapters only when the harness needs them.

Cross-harness skills live in `shared/`. Install `shared/delegate-to-pi` at
`~/.claude/skills/delegate-to-pi/` or in a project's `.claude/skills/` directory.
Claude Code invokes it as `/delegate-to-pi` or loads it automatically when the
description matches. Bundled scripts can resolve their directory with
`CLAUDE_SKILL_DIR`.
