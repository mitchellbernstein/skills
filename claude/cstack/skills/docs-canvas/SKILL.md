---
name: docs-canvas
description: "Render documentation (architecture notes, API references, design docs, runbooks, codebase walkthroughs) as a self-contained, navigable HTML page with an overview card, sticky table of contents, mixed prose/code/diagram sections and a references block, which the user opens locally or publishes. Use when the user asks for a docs canvas, documentation overview, architecture walkthrough, API reference page, or to render structured documentation as an interactive page."
argument-hint: "[source: docs dir, file, URL, or question]"
---

# Docs Canvas

Build a single self-contained HTML page that presents documentation (architecture notes, API references, design docs, runbooks, or codebase walkthroughs) as an interactive, navigable surface rather than as a flat markdown file.

Upstream this renders to a Cursor Canvas. Claude Code has no canvas, so the output is one `.html` file with the same information design. The user opens it in a browser, or you publish it when a publishing tool is available.

## Output contract

- One file, `docs-<slug>.html`. Write it to `.claude/canvases/` in the project unless the user names a path (offer to add that folder to `.gitignore`), or to the session scratchpad outside a repo. Print the absolute path, plus `open <path>` (macOS) or `xdg-open <path>` (Linux).
- Self-contained: inline CSS and JS. No build step, no framework. The page must work offline from `file://`. Optional CDN scripts (pinned exact versions only, e.g. Mermaid for diagrams or highlight.js for syntax colour) are fine if the page still reads correctly when they fail to load. Prefer inline SVG for diagrams.
- Light and dark themes via CSS custom properties on `:root`, switched with `@media (prefers-color-scheme: dark)`. Give `body` an explicit background.
- Readable at phone width: a single column under ~760px, with the TOC collapsing to a top `<details>` menu.
- Accessible: semantic headings in order, `<nav aria-label="Contents">`, visible focus styles, and colour that never carries meaning alone.
- If the session has an Artifact or page-publishing tool, offer to publish the same HTML so the user gets a shareable private link. If the session has a design-guidance skill (`artifact-design`, `frontend-design`), load it before writing the page.

## Gather the source material

Accept any of: a directory of markdown files, a single doc URL, an inline outline, or a question to answer from the codebase. Collect headings, code blocks, diagrams, and any cross-references between documents. For a codebase question, read the code first. Every claim in the page should trace to a file you opened.

## Plan the page layout

Decide the top-level structure before writing any markup. A docs page usually has:

1. **Overview**: a short summary card with the purpose of the doc, scope, and audience.
2. **Table of contents**: a navigable list of sections, sticky in a left rail on wide screens so the reader can jump around. Highlight the current section as the reader scrolls (IntersectionObserver, a few lines of JS).
3. **Body sections**: one section per logical unit (architecture, API, examples, gotchas). Each section can mix prose, code blocks, diagrams, and callouts. Give every section an `id` and a copy-link anchor.
4. **References**: links to related docs, source files, RFCs, and external material.

## Render with plain HTML primitives

These are the Canvas primitives, mapped to HTML:

- Cards and sections (`<section>` with a bordered surface) group related content visually.
- Code blocks: `<pre><code class="language-x">` with HTML-escaped content and a copy button. Lightweight inline token colouring, or optional highlight.js.
- Diagrams: inline SVG for architecture and flow (boxes plus arrows, DAG layout by hand), or Mermaid `<pre class="mermaid">` with the source still readable when the script is absent.
- Callouts for "Important", "Warning", "Note" and "Deprecated": a labelled box with an icon or word, not colour alone.
- Tables for API parameter lists and option matrices, with a sticky header for long ones.
- `<details>` for long optional material such as full schemas and verbose logs.

## Tone and content

Write reader-facing prose. Lead with the answer or the headline, then explain. Keep examples small and runnable. Cite source files as `path/to/file.ts:42`, and link them with `vscode://file/<abs-path>:<line>` (or a repo URL when the user prefers) so readers can jump in.

## Be creative

The sections above are a floor, not a ceiling. The goal is the fastest possible path for the reader to understand the topic. Look at the source material in front of you and ask what representation would actually help: a diagram, a sequence chart, a side-by-side comparison, a decision tree, a glossary, a curated FAQ, a single large worked example, whatever fits. Small interactions are welcome when they earn their place: a filter box over a long API table, tabs for per-language examples, a toggle between overview and detail.

## Before you hand it over

Open the file with a headless check if one is available (`npx playwright screenshot`, a browser tool, or at least an HTML parse). Confirm the TOC links resolve, code is escaped, and nothing overflows horizontally at 375px. Then give the path and a one-line summary of what the page covers.
