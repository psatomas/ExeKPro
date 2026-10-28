# ADR-003: Adapter registration and governance

Status: **Proposed**

## Context and alternatives

Current registration is controlled by a single owner and module activity is global by address. Choose vetted immutable adapters per deployment, a governed allowlist with role separation/timelock, or another explicit model.

## Consequences

Adapters are a security boundary: self-reported quotes/results cannot establish settlement. Any upgrade, registration, emergency-disable, and audit policy must be documented before production claims.
