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
.claude-plugin/marketplace.json  Claude Code marketplace (cstack plugin)
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

| Skill | Use it for | Available in |
| --- | --- | --- |
| [astra-autonomy](codex/astra-autonomy/SKILL.md) | Finish authorized work with fewer checkpoints. Install with the other two Astra skills. | Codex |
| [astra-instruction-audit](codex/astra-instruction-audit/SKILL.md) | Find instructions causing unnecessary pauses or task drift. | Codex |
| [astra-delegation](codex/astra-delegation/SKILL.md) | Delegate independent work with clear ownership and verification. | Codex |
| [delegate-to-agent](shared/delegate-to-agent/SKILL.md) | Choose a Pi, Codex, Claude Code, or Grok Build worker. | All four |
| [delegate-to-pi](shared/delegate-to-pi/SKILL.md) | Delegate to Pi with DeepSeek V4 Flash; includes first-run setup. | All four |
| [audit-email-deliverability](shared/audit-email-deliverability/SKILL.md) | Diagnose and fix SPF, DKIM, DMARC, and report delivery. | All four |
| [record-browser-proof](shared/record-browser-proof/SKILL.md) | Record browser verification tied to the tested revision. | All four |
| [setup-xai-twilio-cloudflare-sip](shared/setup-xai-twilio-cloudflare-sip/SKILL.md) | Set up or debug xAI phone routing through Twilio and optional Cloudflare Workers. | All four |
| [cstack](claude/cstack/README.md) | Claude Code plugin: unofficial port of Cursor's pstack family (103 skills, 17 agents, hooks). **Not original work: see [Attribution](#attribution).** | Claude Code |

"All four" means Codex, Claude Code, Cursor, and Grok Build.

`delegate-to-pi` remains for backwards compatibility. Use `delegate-to-agent`
when the task should explicitly select Codex, Claude, Grok Build, or Pi.

See [`catalog.yaml`](catalog.yaml) for machine-readable paths and compatibility.

For the Astra skills, see [installation and activation](codex/README.md#astra-skills).

## Attribution

This repo holds two kinds of skills, and each is credited to whoever actually
wrote it:

- **Original** skills were written here. Everything in the Current skills table
  is original unless it's marked as a port.
- **Ports and adaptations** are other people's work, converted to run in another
  harness. They keep the original license, and their README and `catalog.yaml`
  entry name the original authors and link the upstream source. The changes made
  here are only adaptation work (tool names, paths, hooks). The ideas and
  content belong to the original authors.

Current ports:

| Here | Original work | Authors | License |
| --- | --- | --- | --- |
| [`claude/cstack`](claude/cstack/README.md) | [cursor/plugins](https://github.com/cursor/plugins): pstack, thermos, cursor-team-kit, cli-for-agent, teaching, dyl-stack, advisor, ralph-loop, agent-compatibility, create-plugin, continual-learning, orchestrate, cursor-sdk, origin-apps, grok-voice, docs-canvas, pr-review-canvas | Lauren Tan ([@poteto](https://github.com/poteto)), Eric Zakariasson, Dylan Gattey, and the Cursor team | MIT |

You're welcome to use any of it. If you use a port, credit its original authors,
not this repo. To add a port: keep the upstream LICENSE, add a credits section to
its README, and record `origin`, `upstream` and `authors` in `catalog.yaml`.

## Copy an install prompt

Paste a prompt into your coding agent. Edit the skill names to pick only what you
need. Installation includes bundled files and required skill dependencies; it
does not run the installed workflows.

### Astra skills for Codex

```text
Install astra-autonomy, astra-instruction-audit, and astra-delegation from https://github.com/mitchellbernstein/skills into my Codex skills directory. Use the codex/ copies, include their bundled files, and preserve unrelated installed skills. Add the optional Astra activation rule from codex/README.md to my user AGENTS.md without duplicating an existing rule.
```

### Pick individual skills

Replace the two example names with your choices from the table:

```text
Install only record-browser-proof and audit-email-deliverability from https://github.com/mitchellbernstein/skills for my current coding agent. Check catalog.yaml for compatibility, use the matching harness directory, and include bundled files and required skill dependencies. Preserve unrelated installed skills and existing global instructions.
```

### Install one skill for a specific agent

```text
Install only delegate-to-agent from https://github.com/mitchellbernstein/skills using the claude/ copy for Claude Code. Include bundled files and required skill dependencies. Preserve unrelated installed skills and existing global instructions.
```
