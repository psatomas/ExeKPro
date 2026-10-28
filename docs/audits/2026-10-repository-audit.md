# Repository audit summary — October 2026

## Scope and evidence

This is a durable summary of audit context supplied for the knowledge-base task, checked against local `main` source at `7f9fbf9` on 2026-10-27. It is not a verbatim reproduction of an external audit and does not assert remote PR state, deployment status, or tests not run.

## Reusable baseline

The local proof of concept has useful contract decomposition, owner-gated registries, deterministic candidate selection, candidate-failure isolation during scoring, SDK client wiring, local deployment flow, browser-to-chain flow, and event observation. `ExecutionEngine`, `IntentRegistry`, `ModuleRegistry`, and SDK wiring are candidates for refactoring/extension, not proof of the target system.

## Material gaps

- No explicit customer request authorization: no signed request, nonce, expiry, spend/recipient bound, or replay protection.
- No ERC-20 settlement: placeholder Router and MEV modules return bytes rather than transfer or swap tokens.
- No kernel-enforced assets, routes, adapters, amount, recipient, or minimum-output constraints.
- No authoritative receipt: module-returned result bytes and simulation quotes are not settlement evidence.
- No durable, reorg-aware execution history; current indexer storage is in memory. API endpoints are read-only and unauthenticated.

## Security observations

The selected module may execute arbitrary module-defined logic and its revert reverts the transaction. Candidate preflight fault isolation does not make final execution safe. There is no engine-level reentrancy guard. The global module-active mapping complicates reuse across intent types. A single owner can immediately control governance surfaces. Token operation defenses have not been implemented because no token operation is present.

## Documentation conflicts

The root README describes selected-module execution as on-chain settlement,
although the current example modules are explicitly placeholders. The README,
landing material, and any other legacy claims about real settlement, live
modules, or material MEV protection require reconciliation with the actual
placeholder behavior before they are treated as product evidence. This is a
documented follow-up, not a change to legacy materials in this task. Existing
B2B/provisioning material can be read as settling a dedicated-deployment model;
the architecture decision remains open.

## Recommended path

First specify and approve a signed/constrained `SwapRequest` and validation rules. Then implement/test local direct and multi-hop settlement, enforce constraints and typed balance-delta receipts, extend the SDK, build durable history, and only then build a minimal Cloud workflow. Outstanding decisions are indexed in [ADR](../architecture/ADR/index.md).
