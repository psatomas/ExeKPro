# ExeKPro repository guide

ExeKPro is an early-stage execution-kernel protocol: today it demonstrates on-chain module selection and observability locally; its product direction is managed, policy-controlled on-chain execution for Web3 developers.

Before implementing protocol, SDK, API, or Cloud work, read [the current-state record](docs/planning/CURRENT_STATE.md), [MVP scope](docs/product/MVP_SCOPE.md), [system overview](docs/architecture/SYSTEM_OVERVIEW.md), [execution model](docs/architecture/EXECUTION_MODEL.md), and [security model](docs/architecture/SECURITY_MODEL.md). They distinguish current code from target design. Consult [ADR/index.md](docs/architecture/ADR/index.md) for unresolved decisions.

Do not treat a proposed ADR or target architecture as authorization to implement it. Resolve the ADR, document the decision, and define acceptance/security tests before making an architectural assumption executable.

Keep `.ai/` user-owned: never inspect, modify, move, stage, or delete it. Preserve existing application code and documentation unless a repository-evidenced correction is needed. Run the smallest relevant checks for changes (Solidity work normally uses `forge test` in `packages/contracts`; TypeScript work uses the workspace checks) and report checks not run.
