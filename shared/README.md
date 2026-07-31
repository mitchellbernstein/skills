# Shared skill sources

These are the canonical sources for skills that work across harnesses. Matching
install-ready copies are mirrored under `codex/`, `claude/`, `cursor/`, and
`grok-build/` so each harness section can be fetched independently.

Skills here should avoid harness-specific commands and metadata. Each consumer
must still review the skill before installation, especially when it can call APIs,
run shell commands, or change external state.
