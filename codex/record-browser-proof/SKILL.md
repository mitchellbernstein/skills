---
name: record-browser-proof
description: Record privacy-safe browser verification videos with host browser automation or an optional agent-browser fallback, then bind real assertions to revision, viewport, duration, and checksum evidence.
---

# Record browser proof

Record a browser flow only after its route, synthetic data, and stable selectors
are ready. Video is review evidence. UI assertions, API or database observations,
console output, and page-error checks still decide whether a feature passed.

## Requirements

- `ffprobe`
- `python3`
- Git
- `shasum` or `sha256sum`
- A browser recorder that saves an isolated session as WebM

`agent-browser` is an optional recorder. Do not install browser tooling or browser
binaries without user authorization.

## Pick the recording path

Inspect the browser automation available in the current host. Use it only when
it can do all of the following:

- create an isolated browser context;
- set an exact viewport;
- save that context as a local WebM file;
- keep the same context for actions and assertions;
- stop recording and close only the task-owned context.

Use [Host recording](#host-recording) when those capabilities exist. Do not infer
recording support from navigation or screenshot support.

If the host cannot save WebM and `agent-browser` is already installed, use
[agent-browser recording](#agent-browser-recording). Otherwise, stop before
opening a browser. Tell the user that no compatible recording driver exists and
ask whether they authorize this setup:

```bash
npm install -g agent-browser && agent-browser install
```

Do not run either install command until the user authorizes it.

## Safety

- Use synthetic or explicitly approved non-sensitive test data.
- Never record PHI, credentials, session tokens, payment details, private
  messages, production customer records, or unrelated browser tabs.
- Use an isolated task-owned context, never a developer's normal profile.
- Pass an HTTP(S) URL without credentials, query parameters, or fragments. The
  helper rejects unsafe recording URLs because it stores the URL in metadata.
- Record production only when the user explicitly authorizes that environment.
- Keep videos out of Git unless their content is intentionally public and small.

## Host recording

Resolve `SKILL_DIR` to the installed `record-browser-proof` directory. `prepare`
writes and prints a capture plan with the safe URL, absolute WebM path, viewport,
Git revision, and dirty state.

```bash
SKILL_DIR=/path/to/record-browser-proof
PROOF=.artifacts/browser-proof/signup.webm

"$SKILL_DIR/scripts/browser-proof" \
  prepare "$PROOF" "http://127.0.0.1:5173/signup" 1440 900
```

Use the host recorder to open the plan URL in an isolated context. Set the plan
viewport, start WebM recording at the plan path, add a 2.6 second lead-in, drive
the flow and assertions, add a 2.6 second lead-out, stop recording, and close the
context. Then seal and verify the artifact:

```bash
"$SKILL_DIR/scripts/browser-proof" finalize "$PROOF" 5
"$SKILL_DIR/scripts/browser-proof" verify "$PROOF" 5
```

Do not call `finalize` until the recorder has flushed and closed the WebM file.

## agent-browser recording

Use one isolated session for recording, actions, and assertions:

```bash
SKILL_DIR=/path/to/record-browser-proof
PROOF=.artifacts/browser-proof/signup.webm
SESSION=proof-signup

"$SKILL_DIR/scripts/browser-proof" \
  start "$SESSION" "$PROOF" "http://127.0.0.1:5173/signup" 1440 900

agent-browser --session "$SESSION" find role button click --name "Continue"
agent-browser --session "$SESSION" wait --text "Check your email"

"$SKILL_DIR/scripts/browser-proof" stop "$PROOF" 5
agent-browser --session "$SESSION" close
"$SKILL_DIR/scripts/browser-proof" verify "$PROOF" 5
```

`start` fixes the viewport before and after recorder context creation. `stop`
adds a lead-out and fails when duration is too short or dimensions changed.

## Evidence bundle

Successful output contains:

- `<name>.webm`
- `<name>.proof.json` with the safe URL, viewport, duration, SHA-256, byte count,
  Git revision, dirty state, timestamp, recording driver, and media-check result

A verified build harness may set `BROWSER_PROOF_REVISION` and
`BROWSER_PROOF_DIRTY=true|false` only after locking source before evidence files
are created. Never use those variables to hide source changes.

Retain these checks from the surrounding verification recipe:

- the action and expected result;
- an accessibility snapshot or stable UI assertion;
- an API or database observation for persisted mutations;
- browser console and page errors;
- the exact revision or source fingerprint;
- explicit skipped provider or environment boundaries.

Share the video, `.proof.json`, and assertion evidence together. Video without
assertions is a demo, not verification.

`verify` recalculates the container, checksum, byte count, duration, and
dimensions. It rejects replaced, truncated, undersized, or non-WebM media.

## Interrupted runs and cleanup

Stop and close the selected host recorder before aborting its plan:

```bash
"$SKILL_DIR/scripts/browser-proof" abort "$PROOF"
```

For `agent-browser`, `abort` stops recording and closes the same session:

```bash
"$SKILL_DIR/scripts/browser-proof" abort "$PROOF"
```

`abort` never marks the artifact as proof. Stop only task-owned processes and
sessions. Remove disposable test data while retaining approved evidence. Confirm
that no task-owned browser, server, or database process remains before completion.
