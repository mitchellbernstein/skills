---
name: astra-instruction-audit
description: Diagnose conflicting skills or AGENTS.md instructions that cause repeated approval requests, premature stops, excessive verification, or task drift. Use when such behavior appears or the user requests an instruction audit; avoid scanning the whole skill library during ordinary tasks.
---

# Astra instruction audit

Identify the instruction responsible for the observed behavior. When it causes a pause or deviation, link the exact file, quote the relevant clause, and distinguish its explicit requirement from your interpretation. User instructions outrank skill guidelines, subject to system and developer requirements.

## Trace the behavior

1. Start with one concrete unwanted behavior and the requested outcome. Read the applicable AGENTS.md files and skills actually loaded for that task. Follow only references that could control the disputed action.
2. Record the file and line, triggering condition, required action, and instruction authority. Compare the clause with the user's current request and earlier authorization. Distinguish a default workflow checkpoint from a prerequisite that remains unmet.
3. Classify the cause as a genuine authorization boundary, missing fact, ambiguous trigger, contradictory instructions, or an unnecessary interpretation. Retrieve observable missing facts directly. Honor real boundaries and continue independent authorized work.
4. If instruction editing was requested, change the smallest owned instruction that controls the behavior. Otherwise apply the correct precedence to the current task and report the proposed edit. Avoid modifying cached plugin files that updates can replace.
5. Check a matching and a nonmatching scenario. For example, "implement this fix" should proceed with reversible work; "explain this fix" should remain read-only. A previous approval applies only to its actual scope.

Return actionable findings with exact locations and consequences. Do not invent conflicts from keywords alone. Do not weaken a legitimate prerequisite to improve an autonomy score.

Source: [OpenAI instruction-following guidance](https://developers.openai.com/api/docs/guides/latest-model#instruction-following), accessed 2026-09-05. The tracing method is a local diagnostic procedure for Codex skills and project instructions.
