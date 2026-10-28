# Backlog guidelines

## Issue convention

Use one outcome-oriented title, a problem statement, scope/non-scope, repository area, owner, priority, dependencies, risks, and testable acceptance criteria. Every implementation issue must distinguish verified current behavior from proposed target behavior and link repository evidence and/or the governing product, architecture, security, or ADR document. Do not represent a Proposed ADR as decided work.

## Priorities

| Priority | Meaning |
| --- | --- |
| P0 | Blocks security, verified execution, or an agreed milestone. |
| P1 | Required for usable developer workflow or reliable milestone completion. |
| P2 | Valuable after core lifecycle is proven. |
| P3 | Research, optimization, or deferred work. |

## Definition of Ready

Problem and desired outcome are clear; decision dependencies are resolved or explicitly called out; acceptance criteria and owner are present; security implications and test approach are identified.

## Definition of Done

Implementation is scoped to the issue; acceptance and relevant regression/security tests pass; documentation and ADR status are updated when the decision changed; reviewer can reproduce the evidence; no unapproved architectural assumption is hidden in code.

## Branch, PR, and review conventions

Use a focused branch and PR. Describe current behavior versus target behavior, decision links, migrations, tests run/not run, and operational/security implications. Keep unrelated changes out. Do not merge based on documentation language alone; approval of a Proposed ADR must be explicit.
