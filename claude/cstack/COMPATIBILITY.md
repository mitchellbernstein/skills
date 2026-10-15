# Compatibility ledger

Every upstream item from [cursor/plugins](https://github.com/cursor/plugins) at `e5136d8` and where it lives in cstack. Status: **ported** (same behavior, names mapped), **adapted** (reworked to a Claude Code mechanism), **not-portable** (no Claude Code equivalent; reason given).

Totals: 127 items, 24 adapted, 103 ported, 0 not-portable.

Pack-level manifests, READMEs, CHANGELOGs and logo assets are not ported; credits live in README.md and LICENSES/.

| Pack | Kind | Upstream | cstack | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| pstack | skill | `skills/architect` | `skills/architect` | ported |  |
| pstack | skill | `skills/arena` | `skills/arena` | ported |  |
| pstack | skill | `skills/automate-me` | `skills/automate-me` | ported |  |
| pstack | skill | `skills/benchmark-checklist` | `skills/benchmark-checklist` | ported |  |
| pstack | skill | `skills/blast-radius` | `skills/blast-radius` | ported |  |
| pstack | skill | `skills/bro` | `skills/bro` | ported |  |
| pstack | skill | `skills/correct` | `skills/correct` | ported |  |
| pstack | skill | `skills/create-verification-skill` | `skills/create-verification-skill` | ported |  |
| pstack | skill | `skills/figure-it-out` | `skills/figure-it-out` | ported |  |
| pstack | skill | `skills/how` | `skills/how` | ported |  |
| pstack | skill | `skills/in-your-own-words` | `skills/in-your-own-words` | ported |  |
| pstack | skill | `skills/interrogate` | `skills/interrogate` | ported |  |
| pstack | skill | `skills/ketchup` | `skills/ketchup` | adapted | any charting tool or Mermaid instead of Cursor `/visualize` |
| pstack | skill | `skills/maintain-verification-skill` | `skills/maintain-verification-skill` | ported |  |
| pstack | skill | `skills/make-bot-ui` | `skills/make-bot-ui` | adapted | Grok Bot webhook -> Claude Code routine API trigger; local `.env` token |
| pstack | skill | `skills/no-comments` | `skills/no-comments` | ported |  |
| pstack | skill | `skills/poteto-help` | `skills/poteto-help` | ported |  |
| pstack | skill | `skills/poteto-mode` | `skills/poteto-mode` | adapted | per-spawn reasoning -> Agent `effort`; fast mode is per session |
| pstack | skill | `skills/principle-attack-the-premise` | `skills/principle-attack-the-premise` | ported |  |
| pstack | skill | `skills/principle-boundary-discipline` | `skills/principle-boundary-discipline` | ported |  |
| pstack | skill | `skills/principle-build-the-lever` | `skills/principle-build-the-lever` | ported |  |
| pstack | skill | `skills/principle-encode-lessons-in-structure` | `skills/principle-encode-lessons-in-structure` | ported |  |
| pstack | skill | `skills/principle-exhaust-the-design-space` | `skills/principle-exhaust-the-design-space` | ported |  |
| pstack | skill | `skills/principle-experience-first` | `skills/principle-experience-first` | ported |  |
| pstack | skill | `skills/principle-explain-the-number` | `skills/principle-explain-the-number` | ported |  |
| pstack | skill | `skills/principle-fix-root-causes` | `skills/principle-fix-root-causes` | ported |  |
| pstack | skill | `skills/principle-foundational-thinking` | `skills/principle-foundational-thinking` | ported |  |
| pstack | skill | `skills/principle-guard-the-context-window` | `skills/principle-guard-the-context-window` | ported |  |
| pstack | skill | `skills/principle-laziness-protocol` | `skills/principle-laziness-protocol` | ported |  |
| pstack | skill | `skills/principle-make-operations-idempotent` | `skills/principle-make-operations-idempotent` | ported |  |
| pstack | skill | `skills/principle-migrate-callers-then-delete-legacy-apis` | `skills/principle-migrate-callers-then-delete-legacy-apis` | ported |  |
| pstack | skill | `skills/principle-minimize-reader-load` | `skills/principle-minimize-reader-load` | ported |  |
| pstack | skill | `skills/principle-model-the-domain` | `skills/principle-model-the-domain` | ported |  |
| pstack | skill | `skills/principle-never-block-on-the-human` | `skills/principle-never-block-on-the-human` | ported |  |
| pstack | skill | `skills/principle-outcome-oriented-execution` | `skills/principle-outcome-oriented-execution` | ported |  |
| pstack | skill | `skills/principle-prove-it-works` | `skills/principle-prove-it-works` | ported |  |
| pstack | skill | `skills/principle-redesign-from-first-principles` | `skills/principle-redesign-from-first-principles` | ported |  |
| pstack | skill | `skills/principle-separate-before-serializing-shared-state` | `skills/principle-separate-before-serializing-shared-state` | ported |  |
| pstack | skill | `skills/principle-sequence-verifiable-units` | `skills/principle-sequence-verifiable-units` | ported |  |
| pstack | skill | `skills/principle-subtract-before-you-add` | `skills/principle-subtract-before-you-add` | ported |  |
| pstack | skill | `skills/principle-test-behavior-not-implementation` | `skills/principle-test-behavior-not-implementation` | ported |  |
| pstack | skill | `skills/principle-type-system-discipline` | `skills/principle-type-system-discipline` | ported |  |
| pstack | skill | `skills/recall` | `skills/recall` | ported |  |
| pstack | skill | `skills/reflect` | `skills/reflect` | ported |  |
| pstack | skill | `skills/setup-pstack` | `skills/setup-pstack` | ported |  |
| pstack | skill | `skills/sharpen` | `skills/sharpen` | ported |  |
| pstack | skill | `skills/show-me-your-work` | `skills/show-me-your-work` | ported |  |
| pstack | skill | `skills/swarm` | `skills/swarm` | ported |  |
| pstack | skill | `skills/tdd` | `skills/tdd` | ported |  |
| pstack | skill | `skills/teach` | `skills/teach` | ported |  |
| pstack | skill | `skills/technical-writing` | `skills/technical-writing` | ported |  |
| pstack | skill | `skills/typescript-best-practices` | `skills/typescript-best-practices` | ported |  |
| pstack | skill | `skills/unslop` | `skills/unslop` | ported |  |
| pstack | skill | `skills/why` | `skills/why` | ported |  |
| pstack | agent | `agents/comment-sicko.md` | `agents/comment-sicko.md` | ported | model and tool names mapped |
| pstack | agent | `agents/poteto-agent.md` | `agents/poteto-agent.md` | ported | model and tool names mapped |
| pstack | automation | `automations/benny` | `automations/benny` | adapted | Cursor automations -> Claude Code routines (API trigger or hourly schedule); no native Slack trigger |
| thermos | skill | `skills/thermo-nuclear-code-quality-review` | `skills/thermo-nuclear-code-quality-review` | ported |  |
| thermos | skill | `skills/thermo-nuclear-review` | `skills/thermo-nuclear-review` | ported |  |
| thermos | skill | `skills/thermos` | `skills/thermos` | ported |  |
| thermos | agent | `agents/thermo-nuclear-code-quality-review-subagent.md` | `agents/thermo-nuclear-code-quality-review-subagent.md` | ported | model and tool names mapped |
| thermos | agent | `agents/thermo-nuclear-review-subagent.md` | `agents/thermo-nuclear-review-subagent.md` | ported | model and tool names mapped |
| cursor-team-kit | skill | `skills/check-compiler-errors` | `skills/check-compiler-errors` | ported |  |
| cursor-team-kit | skill | `skills/control-cli` | `skills/control-cli` | ported |  |
| cursor-team-kit | skill | `skills/control-ui` | `skills/control-ui` | ported |  |
| cursor-team-kit | skill | `skills/deslop` | `skills/deslop` | ported |  |
| cursor-team-kit | skill | `skills/fix-ci` | `skills/fix-ci` | ported |  |
| cursor-team-kit | skill | `skills/fix-merge-conflicts` | `skills/fix-merge-conflicts` | ported |  |
| cursor-team-kit | skill | `skills/get-pr-comments` | `skills/get-pr-comments` | ported |  |
| cursor-team-kit | skill | `skills/loop-on-ci` | `skills/loop-on-ci` | ported |  |
| cursor-team-kit | skill | `skills/make-pr-easy-to-review` | `skills/make-pr-easy-to-review` | ported |  |
| cursor-team-kit | skill | `skills/new-branch-and-pr` | `skills/new-branch-and-pr` | ported |  |
| cursor-team-kit | skill | `skills/pr-review-canvas` | `skills/pr-review-canvas` | adapted | self-contained HTML page instead of a Cursor Canvas |
| cursor-team-kit | skill | `skills/review-and-ship` | `skills/review-and-ship` | ported |  |
| cursor-team-kit | skill | `skills/run-smoke-tests` | `skills/run-smoke-tests` | ported |  |
| cursor-team-kit | skill | `skills/thermo-nuclear-code-quality-review` | `skills/thermo-nuclear-code-quality-review` | ported |  |
| cursor-team-kit | skill | `skills/verify-this` | `skills/verify-this` | ported |  |
| cursor-team-kit | skill | `skills/weekly-review` | `skills/weekly-review` | ported |  |
| cursor-team-kit | skill | `skills/what-did-i-get-done` | `skills/what-did-i-get-done` | ported |  |
| cursor-team-kit | skill | `skills/workflow-from-chats` | `skills/workflow-from-chats` | adapted | reads Claude Code transcripts |
| cursor-team-kit | agent | `agents/ci-watcher.md` | `agents/ci-watcher.md` | ported | model and tool names mapped |
| cursor-team-kit | agent | `agents/thermo-nuclear-code-quality-review.md` | `agents/thermo-nuclear-code-quality-review.md` | ported | model and tool names mapped |
| cursor-team-kit | rule | `rules/no-inline-imports.mdc` | `skills/no-inline-imports` | adapted | always-on rule -> skill; add to CLAUDE.md to make it always-on |
| cursor-team-kit | rule | `rules/typescript-exhaustive-switch.mdc` | `skills/typescript-exhaustive-switch` | adapted | always-on rule -> skill; add to CLAUDE.md to make it always-on |
| cli-for-agent | skill | `skills/cli-for-agents` | `skills/cli-for-agents` | ported |  |
| teaching | skill | `skills/create-learning-path` | `skills/create-learning-path` | ported |  |
| teaching | skill | `skills/run-learning-retrospective` | `skills/run-learning-retrospective` | ported |  |
| dyl-stack | skill | `skills/build-figma` | `skills/build-figma` | ported |  |
| dyl-stack | skill | `skills/dyl-mode` | `skills/dyl-mode` | ported |  |
| dyl-stack | skill | `skills/dyl-ready-pr` | `skills/dyl-ready-pr` | ported |  |
| dyl-stack | skill | `skills/dyl-review` | `skills/dyl-review` | ported |  |
| dyl-stack | skill | `skills/principle-the-algorithm` | `skills/principle-the-algorithm` | ported |  |
| dyl-stack | agent | `agents/dyl-agent.md` | `agents/dyl-agent.md` | ported | model and tool names mapped |
| advisor | skill | `skills/advisor` | `skills/advisor` | ported |  |
| advisor | agent | `agents/advisor-subagent.md` | `agents/advisor-subagent.md` | ported | model and tool names mapped |
| advisor | hook | `hooks/capture-response.sh` | `hooks/advisor-stop.sh` | adapted | folded into the Stop hook (Claude Code passes the last reply) |
| advisor | hook | `hooks/lib.sh` | `hooks/advisor-lib.sh` | adapted | Cursor hook event -> Claude Code hook event |
| advisor | hook | `hooks/mark-pending.sh` | `hooks/advisor-mark-pending.sh` | adapted | Cursor hook event -> Claude Code hook event |
| advisor | hook | `hooks/record-consult.sh` | `hooks/advisor-record-consult.sh` | adapted | Cursor hook event -> Claude Code hook event |
| advisor | hook | `hooks/stop-hook.sh` | `hooks/advisor-stop.sh` | adapted | Cursor hook event -> Claude Code hook event |
| ralph-loop | skill | `skills/cancel-ralph` | `skills/cancel-ralph` | ported |  |
| ralph-loop | skill | `skills/ralph-loop` | `skills/ralph-loop` | ported |  |
| ralph-loop | skill | `skills/ralph-loop-help` | `skills/ralph-loop-help` | ported |  |
| ralph-loop | hook | `hooks/capture-response.sh` | `hooks/ralph-stop.sh` | adapted | folded into the Stop hook (Claude Code passes the last reply) |
| ralph-loop | hook | `hooks/stop-hook.sh` | `hooks/ralph-stop.sh` | adapted | Cursor hook event -> Claude Code hook event |
| agent-compatibility | skill | `skills/check-agent-compatibility` | `skills/check-agent-compatibility` | adapted | npm CLI via `scripts/scan.sh`; CLAUDE.md counts as agent guidance |
| agent-compatibility | agent | `agents/compatibility-scan-review.md` | `agents/compatibility-scan-review.md` | ported | model and tool names mapped |
| agent-compatibility | agent | `agents/docs-reliability-review.md` | `agents/docs-reliability-review.md` | ported | model and tool names mapped |
| agent-compatibility | agent | `agents/startup-review.md` | `agents/startup-review.md` | ported | model and tool names mapped |
| agent-compatibility | agent | `agents/validation-review.md` | `agents/validation-review.md` | ported | model and tool names mapped |
| create-plugin | skill | `skills/create-plugin-scaffold` | `skills/create-plugin-scaffold` | adapted | targets Claude Code plugin format |
| create-plugin | skill | `skills/review-plugin-submission` | `skills/review-plugin-submission` | adapted | targets Claude Code plugin format; `claude plugin validate --strict` |
| create-plugin | agent | `agents/plugin-architect.md` | `agents/plugin-architect.md` | ported | model and tool names mapped |
| create-plugin | rule | `rules/plugin-quality-gates.mdc` | `skills/plugin-quality-gates` | adapted | always-on rule -> skill; add to CLAUDE.md to make it always-on |
| continual-learning | skill | `skills/continual-learning` | `skills/continual-learning` | adapted | bash Stop hook, opt-in per project; updates CLAUDE.md or AGENTS.md |
| continual-learning | agent | `agents/agents-memory-updater.md` | `agents/agents-memory-updater.md` | ported | model and tool names mapped |
| continual-learning | hook | `hooks/continual-learning-stop.ts` | `hooks/continual-learning-stop.sh` | adapted | Cursor hook event -> Claude Code hook event |
| orchestrate | skill | `skills/orchestrate` | `skills/orchestrate` | adapted | Claude Code subagents by default; Cursor SDK route vendored under `cursor-sdk/` |
| cursor-sdk | skill | `skills/cursor-sdk` | `skills/cursor-sdk` | ported |  |
| origin-apps | skill | `skills/origin-api` | `skills/origin-api` | ported |  |
| origin-apps | skill | `skills/port-github-app-to-origin` | `skills/port-github-app-to-origin` | ported |  |
| grok-voice | skill | `skills/add-dictation` | `skills/add-dictation` | ported |  |
| grok-voice | skill | `skills/add-read-aloud` | `skills/add-read-aloud` | ported |  |
| grok-voice | skill | `skills/add-voice` | `skills/add-voice` | ported |  |
| grok-voice | skill | `skills/debug-voice` | `skills/debug-voice` | ported |  |
| docs-canvas | skill | `skills/docs-canvas` | `skills/docs-canvas` | adapted | self-contained HTML page instead of a Cursor Canvas |
| pr-review-canvas | skill | `skills/pr-review-canvas` | `skills/pr-review-canvas` | adapted | self-contained HTML page instead of a Cursor Canvas |
