# ADR-001: Per-swap authorization and replay protection

Status: **Proposed**

## Context

The current caller-bound opaque intent has no signature, nonce, deadline, or constrained request. Verified swaps require an authority model that binds the executed parameters.

## MVP requirements every chosen mechanism must meet

Whatever authorization mechanism is selected, it must bind the parameters the
kernel enforces, prevent replay through a defined one-time request/nonce rule,
and reject an expired authorization. It must also define who is authorized,
when authorization is consumed, and how an altered request is rejected. These
are First Verified Execution requirements, not properties provided by the
current caller-bound interface.

## Separate authorization from submission

**Customer authorization** answers who authorized the exact swap and which
parameters, nonce, and deadline are bound to that authority. **Transaction
submission** answers who broadcasts the transaction and pays gas. They are
separate concerns: a submission path must not be mistaken for proof that the
customer authorized an independently prepared request.

Direct wallet submission can have the customer broadcast a transaction from
their wallet. Relayed execution can have another party broadcast after
verifying customer authorization. Either path may be compatible with the
eventual authorization design; relaying is not required for the first MVP.

## Alternatives to decide

- Direct wallet-call authorization, with the kernel deriving authority from
  the caller and enforcing the request constraints.
- A signed per-swap request with nonce and deadline, such as an EIP-712
  typed-data design.
- Persistent delegated policy.

## Consequences to evaluate

The direct-call option has the smallest surface but may not independently bind
an off-chain prepared request. A bare direct wallet call that relies only on
`msg.sender` does not provide the MVP's defined replay and expiry protections:
the current execution interface has neither a request identity/nonce nor a
deadline. It could satisfy those requirements only if the selected design adds
defined request, nonce, and expiry enforcement to the kernel. A signed request
can support direct or relayed submission, but adds signature validation, nonce
storage, contract-wallet validation, and domain-separation test obligations.
Persistent delegation can improve recurring UX but broadens authority and adds
revocation complexity.

No authorization mechanism or submission path is accepted by this ADR. The
chosen design must define the relationship between customer authority, nonce
consumption, expiry, cancellation, and both direct and relayed submission.
