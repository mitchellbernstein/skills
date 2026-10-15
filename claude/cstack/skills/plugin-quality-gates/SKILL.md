---
name: plugin-quality-gates
description: "Quality gates that apply whenever you create or edit a Claude Code plugin: any change to .claude-plugin/plugin.json or marketplace.json, or to a plugin's skills/*/SKILL.md, agents/*.md, hooks/hooks.json or .mcp.json. Keeps manifests, paths and component metadata valid. Load it before touching those files."
---

# Plugin quality gates

When creating or editing Claude Code plugins:

1. Ensure `.claude-plugin/plugin.json` exists and includes a valid kebab-case `name` that is not reserved (`claude-*`, `anthropic-*`, `cc-plugin-*`, `claude`, `claude-code`).
2. Keep paths relative and within the plugin directory: every manifest component path starts with `./`, with no absolute paths and no `..` traversal. In scripts and configs, reference bundled files through `${CLAUDE_PLUGIN_ROOT}` (quoted in shell commands) and persistent state through `${CLAUDE_PLUGIN_DATA}`, never by absolute path.
3. Match declared component paths to real files and folders. Remember that `agents`, `commands` and `outputStyles` replace their default folder, so a manifest entry can silently hide files.
4. Include YAML frontmatter for skills (`name` equal to the folder, plus `description`), agents (`name`, `description`) and commands (`description`) with the required metadata. Don't carry Cursor-only keys (`alwaysApply`, `globs`, `readonly`, `is_background`) into Claude Code files.
5. Keep plugin scope focused and document installation and usage in `README.md`.
6. Save new plugins to `~/.claude/skills/<plugin-name>/` by default (or scaffold there with `claude plugin init <plugin-name>`) so Claude Code loads them with no install step. Only use a different location when the user explicitly requests it.
7. Run `claude plugin validate <plugin-dir>` after every structural edit, and on the marketplace root after editing `marketplace.json`. Don't call the work done while it reports errors.
