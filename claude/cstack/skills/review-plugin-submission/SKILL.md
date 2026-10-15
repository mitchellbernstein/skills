---
name: review-plugin-submission
description: "Audit a Claude Code plugin for marketplace readiness: runs claude plugin validate, then checks the manifest, component discovery paths, skill/agent/hook metadata, marketplace.json registration and README quality. Use before publishing a plugin, submitting it to a marketplace, or releasing a new version."
argument-hint: "[plugin-dir]"
---

# Review plugin submission

## Trigger

A Claude Code plugin is implemented and needs a final quality check before submission or release. The plugin directory is `$ARGUMENTS` when given, otherwise the current directory. The rules in the `plugin-quality-gates` skill are the bar.

## Workflow

1. Run the authoritative check first: `claude plugin validate <plugin-dir> --strict`. If the plugin sits in a marketplace repo, also run `claude plugin validate <marketplace-root>`. Record every error and warning verbatim. Then work through the sections below for what the validator doesn't cover.
2. Verify manifest validity:
   - `.claude-plugin/plugin.json` exists and parses
   - `name` is valid lowercase kebab-case and not reserved (`claude-*`, `anthropic-*`, `cc-plugin-*`, `claude`, `claude-code`)
   - metadata fields are coherent (`description`, `version`, `author.name`, `license`, `homepage` parses as a URL)
   - nothing but `plugin.json` (and `marketplace.json`) lives inside `.claude-plugin/`
3. Verify component discoverability:
   - Skills in `skills/*/SKILL.md`
   - Agents in `agents/*.md`
   - Hooks in `hooks/hooks.json` (with the top-level `"hooks"` wrapper)
   - MCP config in `.mcp.json` (or `mcpServers` override)
   - LSP config in `.lsp.json`, output styles in `output-styles/`, legacy commands in `commands/`
   - Manifest overrides: `agents`/`commands`/`outputStyles` replace their default folder (a leftover default folder is silently ignored), `skills` adds to it
4. Verify component metadata:
   - Skills include `name` (equal to the folder name) and `description` (what plus when)
   - Agents include `name` and `description`. Flag `permissionMode`, `mcpServers` or `hooks` in a plugin agent, since plugin agents ignore them
   - Hook commands quote `"${CLAUDE_PLUGIN_ROOT}"`, the scripts exist and are executable, and each script exits 0 on synthetic input for its event (pipe a sample payload in and time it)
   - No `.mdc` rules or Cursor-only frontmatter (`alwaysApply`, `globs`, `readonly`, `is_background`) left over from a port
5. Verify repository integration:
   - For marketplace repos, a plugin entry exists in `.claude-plugin/marketplace.json`
   - `source` resolves to the plugin directory without `..`, and entry `name` equals the manifest `name`. Names are unique across the marketplace
   - Smoke-install when practical: `claude plugin marketplace add <root>` then `claude plugin install <name>@<marketplace>` and `claude plugin details <name>` lists the expected components
6. Verify documentation quality:
   - `README.md` states purpose, installation (`/plugin marketplace add ...`, `/plugin install ...`), and component coverage
   - `LICENSE` present. Ported or derived content credits its original authors
   - optional `icon` path is valid and inside the plugin

## Checklist

- `claude plugin validate --strict` passes
- Manifest exists and parses as valid JSON
- All declared paths exist, are relative (`./`), and stay inside the plugin
- No broken file references (`${CLAUDE_PLUGIN_ROOT}/...` and `${CLAUDE_SKILL_DIR}/...` targets exist)
- No missing frontmatter on skills/agents/commands
- Hooks are fast, never block on missing tools, and exit 0 on unrelated input
- Plugin scope is clear and focused
- Marketplace registration complete (if multi-plugin repo)

## Output

- Pass/fail report by section
- Prioritized fix list
- Final submission recommendation
