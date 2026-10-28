# Execution model

## Current flow — verified

1. A caller invokes `executeIntent(intentType, intentData)`.
2. The engine assigns `user = msg.sender`, checks intent activity, obtains active modules, and scores successful simulations.
3. It executes the selected module and emits `IntentExecuted` with module-provided opaque bytes.

Candidate simulation faults are skipped; selected-module failure reverts the transaction. This flow has no signature, nonce, deadline, route constraint, token handling, or settlement verification.

## Proposed authorized swap lifecycle

1. SDK constructs a typed `SwapRequest` that includes signer, nonce, deadline, input/output assets, amount, minimum output, recipient, adapter/route constraints, and route data or a route commitment.
2. Customer authorizes the exact request. The authorization mechanism is an open ADR.
3. Kernel validates signer authority, one-time nonce, expiry, typed constraints, and approved adapter/route.
4. Kernel invokes the adapter; it performs the actual local AMM call.
5. Kernel measures authoritative balance changes, checks minimum output and recipient semantics, and emits a typed receipt containing request identity and settlement evidence.

Any failure reverts atomically. Receipt data supplements transaction receipts; it must not be an adapter’s unsupported assertion.

## Settlement questions to resolve before M2

The following target semantics are required before Verified Swap Execution is
implemented; none is provided by the current engine or placeholder modules.

- **Balances and participants:** define which account supplies input, which
  account receives output, which balances are measured before and after the
  call, and how the kernel identifies those participants.
- **Input-consumption limits:** define whether the authorized input amount is
  exact or a maximum, how token fees/nonstandard transfers affect accounting,
  and how the kernel proves the adapter did not consume more than authorized.
- **Adapter effects and trust boundary:** define the adapter's permitted calls,
  token approvals/custody interactions, route data, and all effects the kernel
  must validate rather than trust from adapter-returned data.
- **Verifiable receipt:** define the receipt fields and event/transaction
  evidence needed to link a request to measured settlement, distinguish it from
  a module assertion, and support later indexing.

## Authorization alternatives

| Alternative | Benefit | Tradeoff |
| --- | --- | --- |
| Direct wallet call | Smallest surface | Does not independently bind an off-chain prepared request. |
| EIP-712 per-swap signature | Relayer-compatible, explicit parameter binding | Requires signature validation and nonce design. |
| Persistent policy/delegation | Better recurring UX | Broad authority and revocation complexity. |

The authorization model remains **Proposed**, not implemented or accepted.
Direct wallet and relayed execution are submission paths that may be compatible
with the chosen authorization model; they do not decide it. See
[ADR-001](ADR/ADR-001-swap-authorization.md).

## Adapter and failure duties

Adapters must be approved, constrained to route semantics, and unable to replace kernel validation. Token custody/approvals, permit support, fee-on-transfer behavior, route encoding, and whether automatic scoring selects routes are unresolved. Failures in authorization, policy, adapter call, or verification revert the operation. See [SECURITY_MODEL.md](SECURITY_MODEL.md).
