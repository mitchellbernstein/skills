# Skills

Reusable skills for coding agents, organized by harness compatibility.

## Layout

```text
codex/     Codex-specific skills and metadata.
claude/    Claude-compatible skills and Claude-specific adapters.
grok/      Grok/xAI-compatible skills and xAI-specific adapters.
shared/    Harness-neutral skills usable by multiple agents.
catalog.yaml
```

Each skill folder contains a required `SKILL.md`. Codex skills may also contain
`agents/openai.yaml` and bundled scripts or references. Claude and Grok may ignore
that optional Codex metadata while using the same `SKILL.md` when compatible.

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

Replace `codex` with `claude` or `grok` for another harness. For one Codex skill:

```sh
git sparse-checkout set shared/delegate-to-pi
```

Install or copy the contents of the selected harness directory into that harness's
skill directory. Keep `shared/` available when selected skills reference it.

## Current skills

- `shared/delegate-to-pi`: Delegate bounded implementation work to local Pi using DeepSeek V4 Flash by default; the host agent supervises and verifies. Works with Codex and Claude Code.
- `shared/setup-xai-twilio-cloudflare-sip`: Configure and debug xAI Voice Agent phone routing through Twilio and optional Cloudflare Workers.

See [`catalog.yaml`](catalog.yaml) for machine-readable paths and compatibility.
