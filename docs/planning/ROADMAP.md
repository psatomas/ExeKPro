# Roadmap

This roadmap is planning direction, not a statement of delivered functionality. Product validation runs alongside every milestone.

| Milestone | Outcome | Depends on | Exit criteria |
| --- | --- | --- | --- |
| M0 — Product & Architecture Foundation | Scope, current-state evidence, ADRs, and validation plan | None | This knowledge base reviewed; material decisions remain explicitly Proposed. |
| M1 — Kernel Refactoring | Typed authorization/constraint foundation | M0, ADR-001/002/003 approval | Accepted authorization, token-movement, and adapter-authorization semantics are enforced; tests reject signer, nonce, expiry, and altered request fields. |
| M2 — Verified Swap Execution | Local direct and multi-hop ERC-20 settlement | M1 | Successful direct and multi-hop ERC-20 swaps prove actual settlement through authoritative balance verification; route/min-out enforcement, invalid-route, unapproved-adapter, and atomic-rollback negative tests pass. |
| M3 — Developer Integration | SDK-first preparation, authorization, submission, receipt inspection | M2 | A developer completes the flow without raw ABI assembly. |
| M4 — Execution Infrastructure | Durable canonical history and operational status | Typed receipt/event model | Dedupe, finality policy, restart recovery, reorg rollback, status API. |
| M5 — ExeKPro Cloud MVP | Project-scoped visibility and policy workflow | M4, tenancy decision | Authenticated project isolation, basic policy audit trail, execution history. |

## Dependencies and deferrals

Authorization semantics precede adapters; adapters precede receipts and SDK workflow; typed receipts precede durable history; durable history and tenancy precede Cloud. Score-policy reassessment follows real adapters rather than blocking M2. AI-assisted recommendations and autonomous economic systems are deferred beyond M5.

## Validation workstream

Interview target developers and buyers during M0–M3; test problem severity, authority requirements, evidence needs, integration friction, and willingness-to-pay. See [PRODUCT_VALIDATION.md](../product/PRODUCT_VALIDATION.md).
