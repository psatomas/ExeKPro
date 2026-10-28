# Security model

## Current protections and limitations

Current registries and score weights are owner-gated, and candidate simulation failures are isolated. These are not swap-security guarantees. Current execution uses `msg.sender` only, emits opaque bytes, lacks an engine reentrancy guard, and calls a selected module directly. No token custody, approval, route validation, signature, nonce, deadline, or settlement checks exist.

## Target threat model

| Threat | Target control |
| --- | --- |
| Altered, stolen, or replayed request | Bind all parameters to authorization; signer validation, nonce consumption, deadline, and domain separation. |
| Excess spend, wrong recipient/asset/route | Kernel validates typed constraints before adapter invocation. |
| Slippage or false adapter result | Measure authoritative balance deltas and enforce minimum output. |
| Malicious/faulty adapter | Adapter allowlist, narrow interface, constrained calldata, revert-on-failure, and adversarial tests. |
| Reentrancy/external token behavior | Explicit state-update ordering, reentrancy analysis/guard as appropriate, safe token handling, and hostile-token tests. |
| Governance misuse | Separate roles/timelock or immutable adapter policy only after an explicit governance decision. |

## Token and settlement assumptions to resolve

The MVP must explicitly choose pre-approval, temporary custody, permit, or another input-token model. It must either exclude nonstandard/fee-on-transfer tokens or define balance-accounting support. The settlement invariant is: for a successful request, actual state change satisfies the exact authorized constraints and evidence identifies the request; otherwise the transaction reverts without partial settlement.

## Required tests

Test direct and multi-hop success; altered fields, signer mismatch, replay, expiry, bad route, unapproved adapter, minimum-output breach, adapter fault/malicious result, reentrancy-relevant callback, approval failure, and atomic rollback. Existing selection/scoring tests do not cover these target controls.
