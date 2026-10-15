---
name: no-inline-imports
description: Keep imports at the top of the file and avoid inline imports. Apply whenever writing or editing code that adds, moves or reviews imports. Ported from cursor-team-kit's always-on rule.
---

# No inline imports

Always place imports at the top of the module. Avoid inline imports in function bodies, type annotations, or interface fields unless there is a strict circular-dependency reason and it is documented.

To make this always-on in a repo, add the rule above to that repo's CLAUDE.md.
