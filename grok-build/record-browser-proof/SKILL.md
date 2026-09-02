---
name: record-browser-proof
description: Record privacy-safe browser verification videos with agent-browser, fixed viewport, minimum duration, revision metadata, and checksum; use when developers need reviewable visual proof backed by real assertions.
---

# Record browser proof

Record a browser flow only after its route, test data, and stable selectors are
ready. Video is review evidence. UI assertions, API or database observations,
console output, and page-error checks still decide whether a feature passed.

This skill works from Codex, Claude Code, Cursor, and Grok Build because each
harness invokes the same bundled shell helper and `agent-browser` session.

## Requirements

- `agent-browser`
- `ffprobe`
- `python3`
- Git
- `shasum` or `sha256sum`

Do not install missing tools or browser binaries without user authorization.

## Safety

- Use synthetic or explicitly approved non-sensitive test data.
- Never record PHI, credentials, session tokens, payment details, private
  messages, production customer records, or unrelated browser tabs.
- Use an isolated `agent-browser` session, never a developer's normal profile.
- Pass an HTTP(S) URL without credentials, query parameters, or fragments. The
  helper rejects unsafe recording URLs because they are written to metadata.
- Record production only when the user explicitly authorizes that environment.
- Keep videos out of Git unless their content is intentionally public and small.

## Record

Resolve `SKILL_DIR` to the installed `record-browser-proof` directory. Start on
the exact route and use a 16:10 or 16:9 viewport that preserves the product's
normal responsive layout.

```bash
SKILL_DIR=/path/to/record-browser-proof
PROOF=.artifacts/browser-proof/signup.webm
SESSION=proof-signup

"$SKILL_DIR/scripts/browser-proof" \
  start "$SESSION" "$PROOF" "http://127.0.0.1:5173/signup" 1440 900

# Drive real user actions in the same session. Prefer roles, labels, and fresh
# accessibility snapshots over screen coordinates.
agent-browser --session "$SESSION" find role button click --name "Continue"
agent-browser --session "$SESSION" wait --text "Check your email"

"$SKILL_DIR/scripts/browser-proof" stop "$PROOF" 5
agent-browser --session "$SESSION" close
```

`start` opens the route, fixes the viewport before and after recorder context
creation, and adds a lead-in. `stop` adds a lead-out and fails when duration is
too short or dimensions changed. Successful output contains:

- `<name>.webm`
- `<name>.proof.json` containing safe URL, viewport, duration, SHA-256, byte
  count, Git revision, dirty state, timestamp, and media-check result

A verified build harness may set `BROWSER_PROOF_REVISION` and
`BROWSER_PROOF_DIRTY=true|false` only after locking source before evidence files
are created. Never use those variables to hide source changes.

## Verify and hand off

Re-check a received or retained bundle without replaying it:

```bash
"$SKILL_DIR/scripts/browser-proof" verify "$PROOF" 5
```

`verify` recalculates checksum, byte count, duration, and dimensions and compares
them with the manifest. It detects truncated, replaced, or undersized media.

Also retain evidence from the surrounding verification recipe:

- action and expected result;
- accessibility snapshot or stable UI assertion;
- API or database observation for persisted mutations;
- browser console and page errors;
- exact revision or source fingerprint;
- explicit skipped provider or environment boundaries.

Share video with `.proof.json` and the assertion evidence that passed. Video
without assertions is a demo, not verification.

## Interrupted runs and cleanup

```bash
"$SKILL_DIR/scripts/browser-proof" abort "$PROOF"
agent-browser --session "$SESSION" close
```

`abort` stops the recorder but does not mark the artifact as proof. Stop only
task-owned processes and sessions. Remove disposable test data while retaining
approved evidence. Confirm no task-owned browser, server, or database process
remains before claiming completion.
