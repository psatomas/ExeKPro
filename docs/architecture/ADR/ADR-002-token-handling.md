# ADR-002: Input-token handling

Status: **Proposed**

## Decision required

Choose among prior approval to kernel/adapter, permit-based authorization, or temporary kernel custody. Decide whether fee-on-transfer and nonstandard ERC-20s are excluded from MVP.

## Tradeoffs

Prior approval is simplest but creates allowance risk. Permits improve UX but expand signature and token-compatibility surface. Temporary custody centralizes validation but adds custody and reentrancy obligations. The chosen model must define exact balance invariants and rollback tests.
