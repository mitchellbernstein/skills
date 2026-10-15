---
name: typescript-exhaustive-switch
description: Use exhaustive switch handling for TypeScript unions and enums. Apply whenever writing or reviewing a TypeScript switch over a discriminated union or enum. Ported from cursor-team-kit's always-on rule.
---

typescript-exhaustive-switch: In switch statements over discriminated unions or enums, use a `never` check in the default case so newly added variants cause compile-time failures until handled.

To make this always-on in a repo, add the rule above to that repo's CLAUDE.md.
