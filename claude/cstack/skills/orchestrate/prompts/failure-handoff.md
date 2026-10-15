<!-- orchestrate failure handoff
task: {{taskName}}
branch: {{branch}}
agentId: {{agentId}}
failureMode: {{failureMode}}
terminatedAt: {{terminatedAt}}
-->

# {{taskName}} failure handoff

Status: error (agent terminated without writing a handoff)
Failure mode: {{failureMode}}
Agent: {{agentId}}
Started: {{startedAt}}
Terminated: {{terminatedAt}}
Duration: {{duration}}
Last activity: {{lastActivityLine}}
Last tool call: {{lastToolCall}}
Branch: {{branch}}
Agent error: {{agentError}}

## Suggested next steps
{{suggestions}}
