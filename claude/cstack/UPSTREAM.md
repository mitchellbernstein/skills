# Upstream tracking

cstack is ported from https://github.com/cursor/plugins (MIT).

Last synced upstream commit: `e5136d82418d2db3165ea1050d17577cd618cc05` (2026-10-15)
pstack upstream version at sync: 0.15.25

Ported directories: pstack, thermos, cursor-team-kit, cli-for-agent, teaching, dyl-stack, advisor, ralph-loop, agent-compatibility, create-plugin, continual-learning, orchestrate, cursor-sdk, origin-apps, grok-voice, docs-canvas, pr-review-canvas. Not ported: `third_party/` (vendor integrations, not Cursor or pstack work).

To sync: diff those directories between the commit above and upstream `main`, re-apply the port rules in README.md ("What changed in the port") to the changed files, update the commit and version above, and update COMPATIBILITY.md, and note the change in the PR.

Home: this plugin lives at `claude/cstack` in mitchellbernstein/skills (moved from bc-receptionist `plugins/cstack` on 2026-10-15).
