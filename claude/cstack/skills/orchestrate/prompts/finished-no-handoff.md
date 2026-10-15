<!-- orchestrate finished-no-handoff
task: {{taskName}}
branch: {{branch}}
agentId: {{agentId}}
resultStatus: {{resultStatus}}
terminatedAt: {{terminatedAt}}
-->

# {{taskName}} finished without handoff

Status: {{resultStatus}} (agent ended cleanly but never wrote a `## Status` or `## Verification` handoff)
Agent: {{agentId}}
Branch: {{branch}}
Terminated: {{terminatedAt}}

## Suggested next steps
- Inspect the raw handoff at `handoffs/{{taskName}}.md` to see what the worker actually emitted.
- Check the branch for commits: `git log --oneline {{branch}}`.
- Retry as-is if this looks like a prompt-misfire (worker produced prose but not the structured template).
- Abandon: skip task, replan around it if the goal genuinely has no acceptable output.{{rawSnippetBlock}}
