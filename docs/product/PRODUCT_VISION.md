# Product vision

## Positioning

ExeKPro (Execution Kernel Protocol) is a managed execution platform that helps Web3 developers integrate, control, and monitor on-chain operations through a unified API and programmable execution policies. Its promise is **reliable on-chain execution, without the infrastructure overhead**.

It is not positioned exclusively as a DEX aggregator, trading bot, custodial wallet, treasury product, or autonomous-agent platform.

## Who it serves

Primary users are protocol and application developers who need an integration surface for constrained on-chain operations. Potential buyers are teams that own product and operations for DeFi applications, wallets, treasury workflows, or other applications that need policy and execution evidence without owning all supporting infrastructure.

## Product layers

| Layer | Intended responsibility |
| --- | --- |
| **Kernel** | On-chain enforcement, customer-controlled authorization, approved adapters, constraints, and verifiable outcomes. |
| **API & SDK** | Prepare an operation, obtain authorization, submit it, and inspect outcome data through a consistent developer surface. |
| **Cloud** | Managed projects, monitoring, policy configuration, operational visibility, and eventually SaaS capabilities. |

The Kernel is the authority for execution constraints; API/SDK and Cloud must not be able to change a customer-authorized operation.

## Extensibility

The near-term proof point is a verified ERC-20 swap. The longer-term model should admit other operation types without assuming swaps are the only use case. AI recommendations and autonomous economic systems are explicitly deferred from the initial MVP.

## Commercial hypotheses, not facts

The value proposition, target buyer, managed-Cloud demand, and willingness to pay are hypotheses. No customer traction, production readiness, or commercial validation is claimed here. See [product validation](PRODUCT_VALIDATION.md) and [the roadmap](../planning/ROADMAP.md).
