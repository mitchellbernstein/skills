# benny

benny gives you two claude code routines for slack issue reports. one triages each report. the other reproduces confirmed bugs and may prepare a small draft fix.

the files in this directory are dormant setup and automation sources. they do not appear as slash skills.

> **port note.** upstream, benny runs as two cursor automations with a native slack trigger. this port runs it as two [claude code routines](https://code.claude.com/docs/en/routines). routines have no slack trigger, so each report reaches a routine through its api trigger (a relay POSTs the report to the routine's `/fire` endpoint) or through a scheduled routine that polls the channel. routines run in the cloud and do not load plugins, so setup copies the pstack skills benny needs into the target repository. [`FOR_AGENTS.md`](./FOR_AGENTS.md) and [`setup-benny`](./skills/setup-benny/SKILL.md) cover both.

## set it up

1. point claude code at [`FOR_AGENTS.md`](./FOR_AGENTS.md) and name the target repository.
2. let setup merge this whole directory into the target at `.claude/automations/benny/`. it must preserve destination-only files and review conflicts instead of overwriting local edits.
3. let setup copy the shared pstack skills benny reads (`how`, `why`, `tdd`, `unslop`, and the principle skills it names) into the target repository's `.claude/skills/`, because a routine reads skills committed to the cloned repository, not plugins.
4. keep user-owned configuration outside the copied pack, for example in `.claude/benny/`. adapt [`configuration.example.yaml`](./templates/configuration.example.yaml) and [`feature-map.example.md`](./skills/reproduce-and-fix-issues/references/feature-map.example.md).
5. commit `.claude/automations/benny/`, the copied skills, and any secret-free configuration before enabling either routine.
6. create each routine at [claude.ai/code/routines](https://claude.ai/code/routines), wire its trigger, then send a harmless test report and verify every source-channel post stays in the original thread.
