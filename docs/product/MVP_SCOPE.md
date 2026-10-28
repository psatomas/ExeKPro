# MVP scope — First Verified Execution

## Definition

The first MVP milestone is a genuine ERC-20 swap executed through ExeKPro in one local Anvil environment. It is complete only when on-chain state, not a module-returned claim, proves settlement.

## Required capability

- Real ERC-20 transfers and settlement for one direct AMM route and one multi-hop AMM route.
- Customer-controlled authorization, a replay-resistant nonce, deadline, and typed swap parameters.
- Enforceable approved assets, adapters/routes, recipient, input amount, and minimum output.
- Approved adapter execution and post-execution balance-delta verification.
- Typed execution evidence/receipt and an SDK workflow to prepare, authorize, submit, and inspect it.
- Automated positive, negative, and adversarial tests.

## Nonfunctional and security requirements

The local environment must be deterministic and atomic. Authorization must bind the parameters the kernel enforces. An expired, altered, replayed, unauthorized, invalid-route, unapproved-adapter, or minimum-output-breaching request must fail. A failed execution must not leave partial token movement or a consumed authorization unless that behavior is explicitly designed and tested.

## Excluded from this MVP

- Production DEX, multi-chain, relayer, billing, or hosted signing support.
- Cloud tenancy, full dashboard administration, durable indexer, or subscription functionality.
- Autonomous AI execution and automatic economic agents.
- A requirement that score-based winner selection decide the first verified swap; two proven route strategies are required, but routing-selection semantics remain open.

## Acceptance and success criteria

Acceptance is a reproducible SDK-driven local flow that signs/authorizes a swap, executes either route, and verifies actual balances and a typed receipt. Tests must cover successful direct and multi-hop execution plus signer mismatch, replay, expiry, parameter tampering, wrong route, slippage, unapproved adapter, and rollback.

Success metrics are initially engineering evidence: both route tests pass, all required rejection cases pass, and no raw ABI construction is required of an SDK consumer. Product metrics are defined only after customer interviews; see [PRODUCT_VALIDATION.md](PRODUCT_VALIDATION.md).

For target semantics and choices, read [the execution model](../architecture/EXECUTION_MODEL.md) and [security model](../architecture/SECURITY_MODEL.md).
