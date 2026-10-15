---
name: setup-benny
description: Configure Benny and prepare its triage and repro routines. Use when installing Benny or changing its Slack, tracker, repository, routing, control, model, or budget settings.
disable-model-invocation: true
---

# Set up Benny

Benny ships as a dormant automation pack inside cstack's port of pstack. The plugin manifest exposes only the normal skill root; this file and the two operational files are not slash skills.

The human enters setup by pointing Claude Code at the pack's `FOR_AGENTS.md`. The bootstrap flow copies the whole pack into the target repository, then reads this file directly at `.claude/automations/benny/skills/setup-benny/SKILL.md`.

Benny needs external configuration and two [Claude Code routines](https://code.claude.com/docs/en/routines). Upstream runs them as Cursor automations with a native Slack trigger. Routines have no Slack trigger, so step 7 wires each one through an API trigger or a schedule. Routines are in research preview, so check the linked docs when a step does not match what the user sees.

Do not create or update a routine until the user explicitly asks. Never put a secret value in plugin files, prompts, or committed configuration.

## 1. Copy the pack and the shared pstack skills

Do this before asking for Benny configuration and before drafting any routine.

Ask which repository will run the routines. The source pack is the directory containing `FOR_AGENTS.md`. The destination is `<target-repository>/.claude/automations/benny/`.

Merge the entire source pack into the destination:

1. Create the destination when it is absent.
2. Copy every source file to the same relative path.
3. Preserve destination-only files. Never delete unrelated files during install or refresh.
4. Keep user-owned configuration, feature maps, and routing maps outside the destination. Never overwrite them.
5. When an existing source-managed file differs, inspect the diff and merge without discarding local edits. If ownership is ambiguous, stop and ask before replacing it.
6. Verify that the destination contains `FOR_AGENTS.md`, this setup file, both operational files, their references, and the templates.

If this file is already being read from the target destination, treat the copy as complete and run the same verification before continuing.

A routine runs as a cloud session that clones the repository. It reads skills committed under the repository's `.claude/skills/`, and it does not load plugins, even ones a committed `.claude/settings.json` enables. So copy these shared skills from the installed cstack plugin into `<target-repository>/.claude/skills/<name>/`, each with its whole directory:

- `how`
- `why`
- `tdd`
- `unslop`
- `principle-separate-before-serializing-shared-state`
- `principle-minimize-reader-load`
- `principle-guard-the-context-window`
- `principle-sequence-verifiable-units`
- `principle-fix-root-causes`
- `principle-prove-it-works`

If the repository already has a project skill with one of these names, stop and ask before replacing it. Record the cstack version the copies came from in a short note beside the user-owned configuration, so a later refresh knows what to update.

Start a fresh session rooted in the target repository with no user-scoped cstack plugin, such as a cloud session at [claude.ai/code](https://claude.ai/code) on that repository. Verify that each shared skill above resolves there. Do not count a skill loaded from the current session or a user-scoped plugin.

If any shared dependency does not resolve, stop and explain the failure.

The Benny files are read directly from `.claude/automations/benny/`. Do not add that directory to a plugin manifest or expect its `SKILL.md` files to appear in the slash-skill list.

Tell the user that `.claude/automations/benny/`, the copied skills, and any referenced secret-free configuration must be committed before either routine is enabled. Do not commit them unless the user asks.

Once this check passes, routine prompts may read the committed operational files by their stable repository-relative paths. They must not embed a plugin cache path or copy the file contents.

## 2. Adapt the configuration

Open these copied examples:

- `../../templates/configuration.example.yaml`
- `../reproduce-and-fix-issues/references/feature-map.example.md`

Create user-owned copies outside `.claude/automations/benny/`. These are configuration files, not pack files. Example locations:

- Project config, such as `.claude/benny/configuration.yaml`
- Project feature map, such as `.claude/benny/feature-map.md`
- Project routing map, such as `.claude/benny/routing.md`
- User config, such as `~/.config/benny/configuration.yaml`
- User feature map, such as `~/.config/benny/feature-map.md`

Fill one feature-map section for every user-facing feature the automation may reproduce. Keep it at the user point of view. Do not freeze implementation details or current code paths in the map.

Do not edit the copied examples. Pack refreshes may update source-managed files after conflict review, but they must never touch the user-owned copies.

Prefer committed, secret-free files in the target repository, because a routine reads only what its clone contains. Otherwise paraphrase the required values into the routine prompt. Reference a repository file only after confirming that it is committed on the branch the routine clones.

Use stable repository-relative paths for committed pack and configuration files. Never reference the plugin source directory or a plugin cache path from a routine.

## 3. Fill the required choices

Ask for or confirm:

- Source Slack channel ID
- Optional operations or status channel ID
- Repository URL and default branch
- Triage identity or Slack user ID
- Issue tracker type, team, project, labels, and intake status
- Tracker adapter skill or MCP actions
- Optional routing map path
- Required control skill name
- Required user-facing feature-map path
- Status emoji strings
- Pull request URL format
- Polling and effort budgets
- Trigger path: an API trigger fed by a relay, or a scheduled poll (step 7)
- Model for triage, repro, code work, and media review

The routine form's model selector sets the model for the whole run. Use only models shown there, and `opus`, `sonnet`, or `haiku` for subagents a run spawns. Do not guess a model and do not carry over a private default.

The source channel, triage identity, repository, tracker adapter, control skill, and feature map must be explicit. Fail setup if any required value stays ambiguous.

Use pstack's `unslop` skill on the final routine names and prompts before saving them.

## 4. Check integration capabilities

The triage automation needs:

- Read access to the configured source Slack channel and its threads
- Thread-reply access in that channel
- Attachment metadata and file download access when reports include media
- Search, read, create, and update access through the configured issue-tracker adapter

The repro automation needs:

- Read access to the source thread
- Thread-reply access in the source channel
- Optional post and edit access in the configured operations channel
- Repository read and history access
- A pull request action that can open a draft pull request
- The configured control-adapter skill

Prefer the Slack connector included in the routine for reads and posts. Remove every connector the routine does not need, because a run uses every included connector without asking. The optional `BENNY_SLACK_BOT_TOKEN` may fill a narrow gap such as editing one operations status message or downloading an attachment. Store it as a network secret on the routine's cloud environment, not in YAML or a plain environment variable that anyone using the environment can read. Add `slack.com` and `files.slack.com` to the environment's allowed domains when the run calls Slack directly.

Do not use undocumented integration endpoints.

## 5. Prepare the routing map

If the user wants reroutes or owner pings:

1. Copy `../triage-issue-reports/references/routing.example.md` outside `.claude/automations/benny/`.
2. Replace every placeholder with public or organization-local values.
3. Keep owner pings off by default.
4. Allow a ping only for a configured feature owner or a confirmed likely regression author.

If no routing map is configured, triage may classify a report but must not guess a destination or owner.

## 6. Verify the control adapter

Read `../reproduce-and-fix-issues/references/control-adapter.md` and the user's completed feature map.

Confirm that the named skill can:

- Bring up the target app
- Navigate every mapped feature through the real UI
- Exercise mapped states through declared adapter actions
- Inspect state without forcing the result
- Capture screenshots
- Start and stop a recording
- Clean up its processes and temporary data

If any capability is missing, leave the repro routine disabled. A routine runs on Anthropic's cloud (or the organization's self-hosted environment), so the adapter must work there: a browser or app it can start in that environment, or a remote test environment it can reach through the environment's network allowlist. An adapter that drives only the user's own computer cannot serve a routine. It must fail closed rather than claim a reproduction it did not perform.

## 7. Prepare the routines

Ask whether this is first-time creation or configuration of existing routines.

Read `../../FOR_AGENTS.md` from the copied pack as the primary user-intent source for either path. Use it to understand the two triggers, tools, instructions, outcomes, and shared rules.

### Choose the trigger path

Routines have no Slack trigger. Pick one path with the user and record it in the configuration:

- **API trigger (preferred).** Each routine gets an API trigger, a per-routine `/fire` URL and bearer token from the routine's edit form. A relay the user already runs, such as a Slack workflow with a webhook step or a small Slack app, POSTs each new top-level report in the source channel to the triage routine and to the repro routine. The body is `{"text": "<JSON with source_channel_id, message_ts, and thread_ts>"}`, and the request carries the headers the routines docs list (`Authorization: Bearer <token>`, `anthropic-beta`, `anthropic-version`, `Content-Type`). The token is shown once and lives only in the relay's secret store. The run receives the text inside a `<routine-fire-payload>` block marked untrusted, so the routine prompt must say to read the trigger coordinates from that block and to validate them against configuration.
- **Schedule (fallback).** A scheduled routine runs at most hourly. Each run reads the source channel through the Slack connector, finds top-level reports with no Benny marker in their thread, and processes each one with its own frozen coordinates. Hourly polling adds latency, and the configured budgets must fit inside one run.

Claude Code has no way to fire a routine from Slack without a relay or a schedule. If the user has neither, stop and say so.

### First-time creation

Create one routine at a time. Routines are created at [claude.ai/code/routines](https://claude.ai/code/routines) with **New routine**. `/schedule` in the CLI can create a scheduled routine but cannot add an API trigger.

For each routine:

1. Read the matching copied prompt template as secondary internal source material.
2. Turn `FOR_AGENTS.md`, the finished Benny configuration, and the template intent into a complete, self-contained routine prompt. Routines run without stopping for approval, so the prompt must state every boundary itself.
3. Tell the prompt to read and follow its exact committed operational file under `.claude/automations/benny/`.
4. Use the stable repository-relative path, not a plugin source or cache path. Do not copy the operational file contents into the prompt.
5. Confirm that the copied pack, the copied skills, and any referenced configuration are committed on the branch the routine clones.
6. Draft the rest of the form: name, model, the target repository, the cloud environment and its network access, only the connectors the routine needs, and the trigger from the chosen path.
7. Show the user the full draft and wait for approval. The user creates the routine and adds its trigger. For an API trigger, the user generates the token and puts it straight into the relay's secret store, never in chat.
8. Finish this routine, including its trigger wiring, before starting the next one.

The triage routine draft, filled from configuration:

- Name `benny-triage`.
- Read and follow `.claude/automations/benny/skills/triage-issue-reports/SKILL.md` for every run.
- Trigger on each new top-level report in the configured source Slack channel, through the chosen path.
- Read the triggering thread and reply only inside it.
- Use the configured issue-tracker connector.
- Classify, inspect evidence, trace cause, dedupe, and create only clear new bugs.
- End one thread-only verdict with the configured `[benny:bug]`, `[benny:performance]`, or `[benny:other]` marker and optional tracker URL.
- Never post a source-channel root message.

After the triage routine is created and wired, the repro and fix routine draft:

- Name `benny-reproduce`.
- Read and follow `.claude/automations/benny/skills/reproduce-and-fix-issues/SKILL.md` for every run.
- Trigger on the same new top-level reports in the configured source Slack channel, through the chosen path.
- Use the configured repository and default branch. Routines push to `claude/`-prefixed branches unless the prompt says otherwise.
- Read the source thread and reply only inside it.
- Include pull request creation and the configured tracker, control-adapter, and feature-map requirements. Paraphrase mapped user paths and states unless the feature map is committed in the same repository.
- Wait for a trusted triage marker before acting.
- Reproduce the exact symptom twice through the mapped real UI and capture evidence.
- Verify an existing fix without authoring over it.
- Attempt an optional bounded fix only after confirmed repro, then open a draft pull request when proof and checks pass.
- Never post a source-channel root message.

### Existing routines

Finish configuration, routing, control-adapter, and feature-map validation. Then give the user this concise checklist to apply in each routine's edit form at [claude.ai/code/routines](https://claude.ai/code/routines).

For the existing triage routine, update:

- Name and prompt
- Direct instruction to read `.claude/automations/benny/skills/triage-issue-reports/SKILL.md`
- Trigger path and source channel
- Slack connector with thread read and reply
- Issue-tracker connector
- Paraphrased triage instructions, thread-only rule, and Benny verdict markers

For the existing repro routine, update:

- Name and prompt
- Direct instruction to read `.claude/automations/benny/skills/reproduce-and-fix-issues/SKILL.md`
- Matching trigger path and source channel
- Repository and default branch
- Slack connector with thread read and reply
- Pull request access through the connected GitHub identity
- Tracker, control-adapter, and feature-map requirements
- Paraphrased marker wait, evidence, verification, and bounded-fix instructions

Do not create replacements or duplicates. `/schedule list` and `/schedule update` in the CLI can also inspect and change existing routines.

### Creation boundary

Never call an undocumented routines endpoint, and never create or fire a routine without the user's explicit go. Never handle a routine token in chat or in a file you read back.

Do not enable normal traffic on either routine until the thread-safety test passes.

## 8. Test thread safety

Use a test channel or a harmless test report. With an API trigger, the user can also send the test with **Run now** and the same JSON as text.

Before testing, confirm that `.claude/automations/benny/`, the copied skills, and every referenced secret-free configuration file are committed on the branch the routines clone. Confirm that both routine prompts point at their exact committed operational files. If any check fails, stop. Tell the user that the routine cannot be enabled yet.

Verify:

1. Triage stores the root `thread_ts` and posts exactly one verdict as a reply.
2. The verdict contains one configured marker.
3. Repro accepts the marker only from the configured triage identity.
4. Repro keeps the same immutable source coordinates.
5. No source-channel root message appears.
6. A delegated worker cannot use any Slack write action.
7. Missing coordinates, a deleted parent, or a failed preflight produces no post and no tracker issue.

Enable normal traffic only after all seven checks pass.
