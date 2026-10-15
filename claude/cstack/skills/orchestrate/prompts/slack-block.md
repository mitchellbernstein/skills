
Slack visibility (optional; the run mirrors into a Slack thread):
- The planner's script mirrors your task status in channel `{{channel}}`, thread `{{threadTs}}`. Don't post to the channel root.
- Post a note only when silence would hide useful context: blocked work, changed assumptions, surprising findings. Write like a human typing in Slack: short, terse, intent-first, no bot-speak, no em-dashes.
- `{{orch}} comment "<note>" --workspace {{workspace}} --sender {{taskName}}` posts in the run thread. Add `--file <path>` to attach an artifact, and `--criticality required` only for messages that must land.
- If posting fails, keep working and say so in your handoff.
