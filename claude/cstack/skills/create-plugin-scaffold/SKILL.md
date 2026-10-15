---
name: create-plugin-scaffold
description: "Create a new Claude Code plugin scaffold with a valid .claude-plugin/plugin.json, component directories (skills, agents, hooks, MCP), and marketplace.json wiring. Use when starting a new Claude Code plugin, asking to create or scaffold a plugin, or adding a plugin to a multi-plugin marketplace repository."
argument-hint: "<plugin-name> [purpose]"
---

# Create plugin scaffold

## Trigger

You need to create a new Claude Code plugin from scratch and make it ready for local use or marketplace distribution. Load the `plugin-quality-gates` skill too. Its rules apply to every file you write here. For structure decisions (which components, how many), consult the `plugin-architect` subagent first when the use case is not already concrete.

## Required Inputs

- Plugin name (lowercase kebab-case)
- Plugin purpose and target users
- Component set to include (`skills`, `agents`, `hooks`, `mcpServers`, `lspServers`, `outputStyles`; `commands/` still loads but prefer `skills/` for new plugins)
- Repository style (`single-plugin` or `multi-plugin marketplace`)

If any input is missing and can't be inferred, ask with `AskUserQuestion` in one batch.

## Output Location

By default, create the plugin in the user's skills directory, where Claude Code loads it with no install step:

```
~/.claude/skills/<plugin-name>/
```

A plugin there (a folder with `.claude-plugin/plugin.json`) auto-loads at the next session as `<plugin-name>@skills-dir`, or right away after `/reload-plugins`. `claude plugin init <plugin-name> [--with skills agents hooks mcp lsp output-style]` creates exactly this layout and is the preferred starting point. Then edit the files it generates.

If the user explicitly asks for another location (inside an existing repo, a marketplace's `plugins/` folder, a specific directory), respect that. Test a plugin outside the skills directory with `claude --plugin-dir <path>`.

## Workflow

1. Validate plugin name format: lowercase kebab-case, starts and ends with an alphanumeric character. Reject reserved names: anything starting with `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-`, or equal to `claude`, `anthropic`, `claude-code`. Warn when `claude` or `anthropic` appears as a whole word elsewhere.
2. Determine the target directory:
   - Default: `~/.claude/skills/<plugin-name>/`. Run `claude plugin init <plugin-name> --description "<purpose>" --with <components>` when the CLI is available. It also fills `author` from `git config`.
   - Override: use the path the user specifies, if any.
   - Create the directory (and parents) if it does not exist.
3. Create base files inside the target directory:
   - `.claude-plugin/plugin.json` (only the manifest goes in `.claude-plugin/`; every component lives at the plugin root)
   - `README.md`
   - `LICENSE`
   - optional `CHANGELOG.md`
4. Populate `plugin.json`:
   - Required: `name`
   - Recommended: `version`, `description`, `author` (`{ "name": ... }`, optional `email`, `url`), `license` (SPDX), `keywords`, `homepage`, `repository`
   - Add explicit component paths only when non-default discovery is needed. Every path starts with `./` and stays inside the plugin. Note `agents`, `commands` and `outputStyles` replace their default folder while `skills` adds to it, and `hooks`/`mcpServers` merge with the default file.
   - Use `userConfig` for values the user must supply (API tokens with `"sensitive": true`) instead of asking them to edit settings.
5. Create component files with valid frontmatter:
   - Skills: `skills/<skill-name>/SKILL.md` with `name` (matching the folder) and `description` (what it does plus when to use it). Optional: `argument-hint`, `disable-model-invocation: true` for manual-only workflows, `allowed-tools`. Reference bundled files as `${CLAUDE_SKILL_DIR}/...` or `${CLAUDE_PLUGIN_ROOT}/...`.
   - Agents: `agents/<agent-name>.md` with `name`, `description`, optional `tools`/`disallowedTools`, `model` (`sonnet`, `opus`, `haiku`, `inherit`), `isolation: worktree`, `background`. Plugin agents ignore `permissionMode`, `mcpServers` and `hooks`.
   - Hooks: `hooks/hooks.json` shaped `{ "hooks": { "<Event>": [ { "matcher": "...", "hooks": [ { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/<script>" } ] } ] } }`. Scripts read JSON on stdin, exit 0 fast when there is nothing to do, and quote `${CLAUDE_PLUGIN_ROOT}`.
   - MCP: `.mcp.json` at the plugin root with `{ "mcpServers": { ... } }`. Use `${CLAUDE_PLUGIN_ROOT}` for bundled servers and `${CLAUDE_PLUGIN_DATA}` for installed dependencies or caches.
   - Commands (legacy): `commands/*.md`. Prefer a skill.
   - Cursor-style `.mdc` rules have no direct equivalent. Make each one a skill whose `description` says when it applies, or put always-on guidance in the consuming repo's `CLAUDE.md`. A `CLAUDE.md` at the plugin root is not loaded.
6. If the repository uses `.claude-plugin/marketplace.json`, add a plugin entry:
   - `name` (same as the manifest `name`)
   - `source` (`"./plugins/<plugin-name>"`, relative to the marketplace root and without `..`, or a `github` / `git-subdir` / `url` source object)
   - optional metadata (`description`, `version`, `category`, `tags`, `keywords`)
   - The marketplace file itself needs `name`, `owner: { "name": ... }`, `plugins: []`.
7. Ensure all manifest paths are relative, valid, and do not use absolute paths or parent traversal.
8. Run `claude plugin validate <plugin-dir>` (and `claude plugin validate <marketplace-root>` when you touched `marketplace.json`). Fix every error. Fix warnings unless the user accepts them. Use `--strict` when this will be checked in CI.

## Guardrails

- Keep the plugin focused on one use case.
- Prefer concise, actionable skill text over long prose.
- Do not reference files that do not exist.
- Use folder discovery defaults unless custom paths are required.
- Never write runtime state under `${CLAUDE_PLUGIN_ROOT}` (it moves on update). Use `${CLAUDE_PLUGIN_DATA}` or the project's `.claude/`.
- Always save to `~/.claude/skills/<plugin-name>/` unless the user provides a different path.

## Output

- Created file tree for the plugin (with full path to the output directory)
- Final `plugin.json`
- Marketplace entry (if applicable)
- `claude plugin validate` result and a short report of required fields and component metadata
- How to load it: next session or `/reload-plugins` for `~/.claude/skills/`, `claude --plugin-dir <path>` elsewhere, or `/plugin marketplace add <repo>` + `/plugin install <name>@<marketplace>` for a marketplace
