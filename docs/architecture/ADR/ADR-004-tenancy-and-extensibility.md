# ADR-004: Customer isolation and operation extensibility

Status: **Proposed**

## Decision required

Decide whether customer isolation is one kernel per customer, a namespaced/shared model, or another tenancy boundary. Separately decide how a typed swap request can coexist with future operation types without making a universal opaque payload authoritative again.

## Consequences

The current code has no per-tenant registry namespace and one shared owner. Existing B2B documentation presents dedicated deployments as a decision; this ADR keeps it open pending product and security approval.
