# Skills

Reusable skills for coding agents, organized by harness compatibility.

## Layout

```text
codex/      Codex-ready copies and Codex-specific metadata.
claude/     Claude Code-ready copies and Claude-specific adapters.
cursor/     Cursor-ready copies and Cursor-specific adapters.
grok-build/ Grok Build-ready copies and xAI-specific adapters.
shared/     Canonical harness-neutral sources.
catalog.yaml
```

Compatible skills are intentionally copied into each harness directory so a
consumer can install one section without discovering or importing another
harness's files. `shared/` remains the canonical source; copies should retain the
same `SKILL.md` and bundled scripts. Codex skills may also contain
`agents/openai.yaml` and other Codex metadata.

The catalog records intended harness compatibility. Read a skill's own `SKILL.md`
before installing or running it; compatibility metadata does not grant permissions
or make an unsafe skill safe.

## Pull only what a harness needs

Use sparse checkout to avoid downloading unrelated harness skills:

```sh
git clone --filter=blob:none --sparse https://github.com/mitchellbernstein/skills.git
cd skills
git sparse-checkout set codex shared
```

Replace `codex` with `claude`, `cursor`, or `grok-build` for another harness. For
only the Pi delegation skill in a given harness:

```sh
git sparse-checkout set codex/delegate-to-pi
# or: claude/delegate-to-pi, cursor/delegate-to-pi, grok-build/delegate-to-pi
```

Install or copy the contents of the selected harness directory into that harness's
skill directory. Keep `shared/` available when using canonical sources or catalog
metadata.

## Current skills

- `*/delegate-to-agent`: Choose an explicit local worker CLI—Pi/DeepSeek, OpenAI Codex, Claude Code, or Grok Build—and delegate bounded coding work with target-specific model and permission handling.
- `*/delegate-to-pi`: Delegate bounded implementation work to local Pi using DeepSeek V4 Flash by default; bootstraps Pi and refreshes its model catalog when needed, then the host agent supervises and verifies. Copies are available for Codex, Claude Code, Cursor, and Grok Build.
- `*/setup-xai-twilio-cloudflare-sip`: Configure and debug xAI Voice Agent phone routing through Twilio and optional Cloudflare Workers. Copies are available for all four harness sections.

`delegate-to-pi` remains for backwards compatibility. Use `delegate-to-agent`
when the task should explicitly select Codex, Claude, Grok Build, or Pi.

See [`catalog.yaml`](catalog.yaml) for machine-readable paths and compatibility.
