# Codex skills

Copy or sparse-checkout this directory into `~/.codex/skills`. Cross-harness
skills such as `delegate-to-pi` have a ready-to-install copy here as well as a
canonical source in `shared/`. Codex-only skills may include UI metadata under
`agents/`.

Use `codex/delegate-to-agent` when the worker should be selected explicitly
between Pi, Codex, Claude Code, and Grok Build.

## Astra skills

These skills adapt [OpenAI's Astra prompting guidance](https://developers.openai.com/api/docs/guides/latest-model)
for Codex. They preserve the configured model and reasoning settings. They do not
enable background execution or grant additional permissions.

Install all three from the repository root so the relative skill links resolve:

```sh
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R codex/astra-autonomy codex/astra-instruction-audit codex/astra-delegation \
  "${CODEX_HOME:-$HOME/.codex}/skills/"
```

Review any existing same-named skill directories before copying; this command
overwrites matching files. Start a new Codex task after installation.

Invoke `$astra-autonomy` with an implementation request. The other skills are
selected when instruction conflicts or independent work make them relevant.
For regular use, add this optional rule to your user or project `AGENTS.md`:

```markdown
For multi-step implementation or artifact-creation requests, use $astra-autonomy.
Apply its instruction-audit and delegation guidance when relevant. Preserve
actual permission boundaries and requests to plan, review, or explain only.
```

The published package passes structural validation. Its effect on completion,
interruptions, and delegation should be evaluated on your own tasks.
