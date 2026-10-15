---
name: finish-feature
description: Finish a feature request by driving the real product in a browser, recording proof, and diagnosing and fixing failures until it passes. Use before saying a feature or PR is done, or when asked to verify, QA, walk through, or record a feature.
---

# Finish feature

A feature is done when the real app passes a recorded walkthrough, not when tests are green. Evidence rule: never call work ready on a description alone.

## Loop

1. **List the claims.** One line per thing the change must do, plus the failure cases (empty, invalid, duplicate, permission).
2. **Pick the harness.**
   - If the repo ships its own verification skill (for example `verify-airhug-web` in bc-receptionist), use it and its feature recipes. Add a recipe there when the feature has none.
   - Anything else, or no `agent-browser` on this machine: run the app and drive it with Playwright/Chromium.
3. **Walk it.** Drive the real UI for every claim and failure case. Cover light and dark, and desktop, tablet and phone widths. Check console errors and page errors, and verify side effects in the API or DB.
4. **Record.** Use the `record-browser-proof` skill (or the repo verification skill's own recording mode) for motion; screenshots for static states. Synthetic data only, never PHI or production records.
5. **On any failure, diagnose before fixing.** Reproduce it, find the root cause with the `why` / `how` skills, fix the cause (not the symptom), add or extend a test, then go back to step 3. Never weaken an assertion or skip a check to get green.
6. **Hand off.** Save evidence under `/mnt/project-files/pr-evidence/<pr>/` when that folder exists, attach it to the reply and the PR, and state what was not verified (provider boundaries, real phone or SMS, production data).

## Done means

Every claim has a passing recorded run on the final commit, failures found along the way are listed with their cause, and anything skipped is said plainly.
