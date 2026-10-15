---
name: pr-review-canvas
description: "Render a PR diff review as a self-contained HTML page that groups changes by reviewer importance (core logic first, wiring condensed, boilerplate summarized), adds pseudocode and before/after example traces for dense logic, and flags tricky hunks with callouts. Use when reviewing a pull request, summarizing a diff for review, or when the user asks for a PR review canvas, diff walkthrough, or change-set overview."
argument-hint: "<PR URL or number>"
---

# PR Review Canvas

Build a single self-contained HTML page that presents a PR diff reorganized for reviewer comprehension, not in file-tree order.

Upstream this renders to a Cursor Canvas. Claude Code has no canvas, so the output is one `.html` file with the same information design. The user opens it in a browser, or you publish it when a publishing tool is available.

## Output contract

- One file, `pr-<number>-review.html`. Write it to `.claude/canvases/` in the project unless the user names a path (offer to add that folder to `.gitignore`), or to the session scratchpad outside a repo. Print the absolute path, plus `open <path>` (macOS) or `xdg-open <path>` (Linux).
- Self-contained: inline CSS and JS, no build step, works offline from `file://`. Optional pinned-version CDN scripts (e.g. highlight.js) only if the page still reads correctly without them.
- Light and dark themes via CSS custom properties, switched with `prefers-color-scheme`. Diff colours (added, removed, context) are defined for both themes, and lines also carry `+`/`-` markers so colour isn't the only signal.
- Readable at phone width: diff blocks scroll horizontally inside their own box, and the page itself never does.
- If the session has an Artifact or page-publishing tool, offer to publish the same HTML for a shareable private link. A PR diff can contain unreleased or private code, so don't publish without the user's say-so. If a design-guidance skill (`artifact-design`, `frontend-design`) is available, load it first.

## Gather the diff

Expect a GitHub PR link (a full URL like `https://github.com/<owner>/<repo>/pull/<n>`, or an equivalent `gh`-resolvable reference). Use `gh pr diff <pr>` to collect every file's path, additions, deletions, and hunks. `gh pr view <pr> --json title,body,author,baseRefName,headRefName,files,commits` gives the metadata header and per-file stats.

**If the user didn't provide a PR link, stop and ask** with `AskUserQuestion`. Do not guess at the current branch, infer from recent history, or fall back to a local `git diff`. Ask which diff they want to review (a specific PR URL or number) and wait for the reply before continuing.

Read the surrounding code for every core hunk, not just the diff, so the commentary is grounded.

## Group changes for comprehension

Do **not** present files in alphabetical or tree order. Reorganize into sections ordered by reviewer value:

1. **Core logic**: new behavior, algorithm changes, state transitions, API surface changes. Show full diffs with surrounding context.
2. **Wiring & integration**: route registration, dependency injection, config plumbing that connects the core logic. Condensed: enough to confirm correctness, collapsed in `<details>` by default.
3. **Boilerplate & mechanical**: import reordering, renames, generated code, formatting, type re-exports. Summarize as a list of file names and stats. No inline diffs unless specifically relevant.

Lead with core logic. The reviewer's attention is freshest at the top. A header card above the sections gives the PR title, author, base←head, file and line counts, and a two-sentence "what this PR does". A sticky mini-nav lists the three sections and every callout.

## Render the diff

- Each hunk is a `<pre>` table or grid with old/new line numbers, `+`/`-`/context markers, and HTML-escaped content. Unified view by default. A side-by-side toggle is welcome for core hunks.
- File headers show path, status (added, modified, renamed, deleted) and `+N −M`, and link to the file on GitHub at the head commit (`https://github.com/<owner>/<repo>/blob/<headSha>/<path>#L<n>`).
- Keep the page fast: collapse very long hunks behind "show N more lines".

## Distill complex logic into pseudocode

When a core change involves dense or intricate logic (deeply nested conditions, state machines, retry/backoff flows, multi-step transformations), add a short pseudocode summary next to the diff. The pseudocode should strip away language syntax, error handling, and boilerplate to expose the essential algorithm or control flow in a few lines. This lets the reviewer confirm intent before reading the real code.

Only do this when the actual diff is hard to scan. Straightforward changes don't need a pseudocode mirror.

## Trace tricky logic on a concrete example

Pseudocode shows the shape of the change, and an example trace shows it executing. When a hunk changes behavior in a way that's hard to predict from reading it (reordered effects, new short-circuits, altered edge cases), pick a concrete input and walk it through the old and new code paths side by side. Highlight the step where they diverge and what the observable outcome is. Keep the input small and realistic.

Use this for genuinely surprising behavior changes, not every core hunk.

## Call attention to tricky things

When a hunk contains something surprising, risky, or easy to miss, visually separate it from the surrounding diff. Pair it with a short tag ("Subtle", "Breaking", "Race condition", "Perf") and a one-sentence explanation, so the reviewer sees the concern and the code together.

Reserve these callouts for genuinely tricky items, because overuse destroys signal.

## Tone and content

Write reviewer-facing commentary, not a changelog. Focus on:
- **Why** something changed, not just what changed.
- Interactions between files, e.g. "The new validator in `core.ts` is invoked by the route added in `routes.ts`."
- Anything the diff alone doesn't make obvious.

Keep commentary terse. One or two sentences per note.

## Be creative

The sections above are a floor, not a ceiling. The goal is the fastest possible path for the reviewer to understand this specific change. Look at the diff in front of you and ask what representation would actually help: a tiny state diagram, a before/after call graph, a table of input→output pairs, a timeline of commits, a confidence annotation per file, a single large callout with everything else collapsed, whatever fits the change.

Plain HTML covers what the canvas SDK offered: inline SVG for charts and DAG layouts, tables, diff views, cards, stat tiles, and a few lines of JS for interactive state (toggles, filters, "mark file reviewed" checkboxes kept in `localStorage`, wrapped in try/catch). Reach for whatever best serves the change at hand. A review of a refactor looks different from a review of a bug fix, which looks different from a review of a new feature. Let the page reflect that.

## Before you hand it over

Check the page renders (headless screenshot or browser tool if available, otherwise parse the HTML), that every changed file from `gh pr diff` appears in exactly one section, and that code is escaped. Then give the path and a one-line verdict-free summary. This page explains the change. It doesn't approve it.
