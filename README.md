# Execution Kernel Protocol

[![CI](https://github.com/psatomas/execution-kernel-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/psatomas/execution-kernel-protocol/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/github/license/psatomas/execution-kernel-protocol)](LICENSE)

A composable execution infrastructure layer for Web3 intents. Instead of routing every intent through one monolithic solver, competing execution modules are simulated, scored, and the best-scoring one executes on-chain — a market of execution strategies rather than static execution logic.

Built with production intent: explicit trust boundaries, auditable access control, and rigor over speculative scope.

---

## Live Deployment

| URL | Serves | Worker |
| --- | --- | --- |
| `https://exekpro.com/` | ExeKPro Protocol Console (`apps/frontend`) | `exekpro-console` |
| `https://exekpro.com/about` | ExeKPro public website (`apps/landing`) | `exekpro-landing` |

Two independently deployed Cloudflare Workers behind one zone, split by path via Worker Routes (not a Custom Domain, which can't split a hostname by path) — see each app's own `wrangler.jsonc`. The console has no public kernel deployment behind it yet, though — it only reads/writes whatever chain the connecting wallet points at (see Getting Started below), since `packages/config` doesn't have a real testnet/mainnet entry yet.

---

## Getting Started (Local Development)

Prerequisites: Node 22+, [Foundry](https://book.getfoundry.sh/) (`anvil`/`forge`/`cast`), npm.

```bash
git clone https://github.com/psatomas/execution-kernel-protocol.git
cd execution-kernel-protocol
npm install

# 1. Deploy the kernel to a local anvil chain and register the demo ROUTE
#    intent + both example modules (starts anvil itself if it isn't already
#    running). See scripts/deploy-local.sh for exactly what this does.
./scripts/deploy-local.sh

# 2. In a separate terminal: the read-only API
npm run start --workspace=apps/api

# 3. In another separate terminal: the console
npm run dev --workspace=apps/frontend
```

Open `http://localhost:3000`, connect a wallet pointed at `http://127.0.0.1:8545` (chain id `31337`), and the `Route` intent should be selectable end to end — simulate & score both candidate modules, execute, and see the result flow through the indexer to the API back to the console.

| Service | Default port | Started by |
| --- | --- | --- |
| anvil (local chain) | `8545` | `scripts/deploy-local.sh` (or run `anvil` yourself first) |
| `apps/api` | `4000` | `npm run start --workspace=apps/api` |
| `apps/frontend` | `3000` | `npm run dev --workspace=apps/frontend` |

Other runnable, code-only examples against the same local deployment (no frontend/API involved) — each is a real end-to-end script, not a mock:

- `node packages/sdk/examples/quickstart.ts` — every SDK client (`intentBuilder`, registries, `scorePolicy`, `executionClient`), including a governance `updateWeights()` call.
- `node apps/execution-node/examples/quickstart.ts` — the off-chain process → solve → submit pipeline (`runIntent(...)`).
- `node apps/indexer/examples/quickstart.ts` — backfilling kernel events and deriving execution metrics.

To run the contract test suite: `forge test` from `packages/contracts/`. To run the frontend's own real end-to-end test (`e2e/full-flow.spec.ts` — a real headless browser, real wagmi, real chain, real `apps/api`): with `anvil`/`apps/api` already running as above, `npm run e2e` from `apps/frontend/`.

### Troubleshooting

- **Console shows "No intents registered yet." / step 2 onward is greyed out.** Not a bug — the chain your wallet is connected to genuinely has nothing registered on it yet. Run `./scripts/deploy-local.sh` (or restart `anvil` first if you'd already sent any transaction on it — the script requires a fresh chain, since the deployed addresses are only deterministic from nonce 0).
- **Console appears stuck on "Loading registered intents..." forever, no error shown.** Most likely your wallet is connected to a chain other than local anvil (check the network badge in the header — a red "Wrong network" badge confirms it). `packages/config` currently only has a `localAnvil` deployment entry; connecting via Sepolia or any other chain silently returns no data rather than an error, by design of today's `useKernelClient()` (see `apps/frontend/CLAUDE.md`) — switch your wallet to local anvil.
- **`scripts/deploy-local.sh` exits with "already has a nonce of N".** Your anvil chain isn't fresh — restart it (a new `anvil` process always starts at nonce 0) and re-run the script.

---

## System Overview

The Execution Kernel Protocol defines a standardized execution layer for Web3, where user intents are resolved by an on-chain kernel that ranks interchangeable execution strategies and runs the winner.

### Core Layers

- **Intent Layer** — standardized, owner-registered intent types that requests are declared against
- **Execution Layer** — the on-chain kernel (`ExecutionEngine`) that fetches candidate modules for an intent type, scores their simulated output, and executes the winner
- **Execution Modules** — composable, independently deployed strategy units (routing, MEV protection, liquidity selection, ...) that compete for selection
- **Observability Layer** — indexing and performance tracking of execution outcomes
- **SDK Layer** — developer interface for intent creation and execution integration

There is no separate settlement layer: the selected module's `execute()` call *is* the on-chain settlement — it performs the swap/route/transfer directly. A prior draft of this document named a standalone `SettlementRouter`; that idea is dropped until a concrete need for a settlement step distinct from module execution actually appears (e.g. batching or netting across multiple executed intents).

---

## Core Concept: Competitive Module Selection

Execution is not performed by a single solver, and — as currently implemented — not by a static pipeline either. Each registered intent type has a pool of candidate modules; every intent execution re-runs the competition:

```text
Intent (intentType, intentData)
  ↓
IntentRegistry.isIntentActive(intentType)?  — reject if not
  ↓
ModuleRegistry.getModules(intentType) — fetch active candidates
  ↓
for each candidate that supportsIntent(intentType):
    simulate() → ExecutionQuote → ScorePolicy.evaluate() → signed score
  ↓
highest-scoring module wins
  ↓
winning module .execute() — this *is* settlement, no separate step
```

Each module is:
- independently deployed and replaceable, without touching `ExecutionEngine`
- scored on the same standardized `ExecutionQuote` (cost, quality, MEV risk, latency)
- free to lose the competition on one call and win it on the next, as weights or on-chain conditions change

**Future direction, not yet built:** chaining multiple winning modules into a single execution graph (e.g. MEV-protect *then* route) rather than picking exactly one. Don't treat pipeline chaining as implemented until `ExecutionEngine` actually composes more than one module per intent.

---

## Repository Structure

```text
execution-kernel-protocol/

├── packages/
│
│   ├── contracts/                         # On-chain execution core
│   │   ├── src/
│   │   │   ├── core/
│   │   │   │   ├── ExecutionEngine.sol
│   │   │   │   └── IntentRegistry.sol
│   │   │   │
│   │   │   ├── modules/                   # Execution primitives
│   │   │   │   ├── ExecutionModuleBase.sol
│   │   │   │   ├── RouterModule.sol
│   │   │   │   └── MevProtectionModule.sol
│   │   │   │
│   │   │   ├── policy/
│   │   │   │   └── ScorePolicy.sol
│   │   │   │
│   │   │   ├── registry/
│   │   │   │   └── ModuleRegistry.sol
│   │   │   │
│   │   │   ├── access/
│   │   │   │   └── ProtocolRoles.sol      # single shared owner, see below
│   │   │   │
│   │   │   └── interfaces/
│   │   │
│   │   ├── test/
│   │   ├── script/
│   │   │   └── Deploy.s.sol
│   │   ├── foundry.toml
│   │   └── remappings.txt
│   │
│   ├── sdk/                               # Developer integration layer (wraps viem)
│   │   ├── src/
│   │   │   ├── abi/                       # hand-authored `as const` ABIs, one per contract
│   │   │   ├── intent/
│   │   │   │   ├── intentBuilder.ts
│   │   │   │   └── types.ts
│   │   │   │
│   │   │   ├── execution/
│   │   │   │   ├── executionClient.ts     # wraps ExecutionEngine
│   │   │   │   └── moduleClient.ts        # wraps IExecutionModule (any module address)
│   │   │   │
│   │   │   ├── registry/                  # intentRegistry/moduleRegistry/scorePolicy/protocolRoles clients
│   │   │   │
│   │   │   └── index.ts                   # createExecutionKernelClient(...) bundles all of the above
│   │   ├── examples/
│   │   │   └── quickstart.ts              # runnable end-to-end example against a local anvil deployment
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── types/                              # Shared protocol definitions (zero runtime deps)
│   │   ├── src/
│   │   │   ├── primitives.ts               # Address/Bytes32/Hex aliases
│   │   │   ├── intent.ts                   # mirrors IntentRegistry.sol
│   │   │   ├── execution.ts                # mirrors ExecutionQuote.sol, ScorePolicy.Weights
│   │   │   ├── module.ts                   # mirrors IExecutionModule.sol, ModuleRegistry.sol
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── config/                             # local-anvil chain/address config (no testnet yet)
│       ├── src/
│       │   ├── chains.ts                   # localAnvil: Chain
│       │   ├── addresses.ts                # localAnvilAddresses, localAnvilModules
│       │   ├── constants.ts                # ROUTE_INTENT_TYPE
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│
│   ├── execution-node/                    # Off-chain execution engine (consumes sdk)
│   │   ├── src/
│   │   │   ├── engine/
│   │   │   │   ├── intentProcessor.ts     # raw request -> Intent (labels intentType)
│   │   │   │   └── executionGraphBuilder.ts # off-chain, gas-free preview of what
│   │   │   │                                # ExecutionEngine would select right now
│   │   │   │
│   │   │   ├── solvers/
│   │   │   │   └── solver.ts              # one generic solver, not per-module — every
│   │   │   │                                # module is scored the same generic way, so
│   │   │   │                                # a routerSolver/mevSolver split would just
│   │   │   │                                # be duplicated boilerplate today
│   │   │   │
│   │   │   ├── execution/
│   │   │   │   └── executor.ts            # submits via sdk's executionClient
│   │   │   │
│   │   │   └── index.ts                   # runIntent(...) ties the pipeline together
│   │   ├── examples/
│   │   │   └── quickstart.ts              # runnable end-to-end example against a local anvil deployment
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── indexer/                            # Execution observability layer
│   │   ├── src/
│   │   │   ├── listeners/
│   │   │   │   └── eventListener.ts       # generic backfill/watch over any (address, abi, eventName)
│   │   │   ├── processors/
│   │   │   │   └── kernelEventProcessor.ts # backfills all 5 kernel contracts' events into the store
│   │   │   ├── metrics/
│   │   │   │   └── executionMetrics.ts    # totalExecutions/executionsByModule/moduleWinRate
│   │   │   ├── db/
│   │   │   │   └── memoryStore.ts         # in-memory store — swap for a real DB when persistence matters
│   │   │   └── index.ts                   # createIndexer(...) backfills into a fresh store
│   │   ├── examples/
│   │   │   └── quickstart.ts              # runnable end-to-end example against a local anvil deployment
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                                # Integration API layer (Fastify, read-only)
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   └── kernelService.ts       # one shared, read-only ExecutionKernelClient
│   │   │   ├── controllers/
│   │   │   │   ├── intentsController.ts
│   │   │   │   ├── modulesController.ts   # includes /predict — off-chain solve(), no gas spent
│   │   │   │   ├── metricsController.ts   # wraps apps/indexer (aggregate metrics)
│   │   │   │   └── executionsController.ts # raw per-tx history, most-recent-first
│   │   │   ├── routes/
│   │   │   │   ├── intentsRoutes.ts
│   │   │   │   ├── modulesRoutes.ts
│   │   │   │   ├── metricsRoutes.ts
│   │   │   │   └── executionsRoutes.ts
│   │   │   ├── utils/
│   │   │   │   └── json.ts                # bigint/Map -> JSON-safe, needed for every response
│   │   │   └── index.ts                   # buildServer(); no execute/submit route — see CLAUDE.md
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── frontend/                          # Protocol console (Next.js App Router + wagmi/viem)
│       ├── src/
│       │   ├── app/                       # App Router, not pages/ — see CLAUDE.md
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   ├── providers.tsx          # "use client" boundary: WagmiProvider + QueryClientProvider
│       │   │   └── globals.css            # design tokens: --bg/--surface/--border/--ink/--accent/status trio
│       │   ├── components/
│       │   │   ├── layout/AppHeader.tsx   # always-visible network identity + wallet
│       │   │   ├── wallet/ConnectWallet.tsx
│       │   │   ├── execution/             # ExecutionConsole.tsx (primary surface), CandidateModuleRow.tsx
│       │   │   ├── protocol/OverviewStats.tsx
│       │   │   ├── metrics/RecentExecutions.tsx
│       │   │   └── ui/                    # Badge, Panel, StatTile — shared primitives, few call sites each
│       │   ├── hooks/                     # useKernelClient, useIntents, useModules, usePrediction,
│       │   │                              # useExecutionMetrics, useRecentExecutions
│       │   ├── services/
│       │   │   └── kernelClient.ts        # pure wiring: wagmi's viem clients -> sdk's ExecutionKernelClient
│       │   └── lib/
│       │       └── wagmiConfig.ts         # localAnvil only, ssr: true — see CLAUDE.md
│       ├── e2e/
│       │   └── full-flow.spec.ts          # Playwright: the full flow end to end, real browser — see CLAUDE.md
│       ├── playwright.config.ts
│       ├── wrangler.jsonc                 # Worker name exekpro-console, Route exekpro.com/*
│       ├── open-next.config.ts
│       ├── package.json
│       └── tsconfig.json
│
│   └── landing/                            # exekpro.com/about — public marketing site (Next.js App Router)
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx              # metadata: title/description/OG/canonical, basePath-aware ("/about")
│       │   │   ├── page.tsx                # composes every section, in order
│       │   │   ├── globals.css             # single deliberate dark theme, not dual-theme like the console
│       │   │   ├── icon.png / apple-icon.png
│       │   │   └── opengraph-image-asset/route.tsx # generated OG image (next/og ImageResponse), a plain
│       │   │                                        # route rather than Next's file-convention — see CLAUDE.md
│       │   ├── components/
│       │   │   ├── layout/                 # SiteHeader, SiteFooter, Wordmark
│       │   │   ├── sections/               # Hero, Problem, HowItWorks, ExecutionQuoteSection,
│       │   │   │                           # ModularExecution, B2BDeployments, DeveloperExperience,
│       │   │   │                           # Validation, SecurityPrinciples, RoadmapStatus, FinalCTA
│       │   │   └── ui/                     # Container, SectionHeading, Pill, FlowDiagram, StatTile, CTALink
│       │   └── lib/
│       │       ├── links.ts                # GITHUB_URL/CONSOLE_URL/DOCS_URL
│       │       └── basePath.ts             # shared "/about" constant — next.config.ts + next/image src both use it
│       ├── wrangler.jsonc                  # Worker name exekpro-landing, Routes exekpro.com/about, exekpro.com/about/*
│       ├── open-next.config.ts
│       ├── package.json                    # deliberately no wagmi/viem/sdk deps — pure static marketing content
│       └── tsconfig.json
│
├── .github/workflows/
│   ├── ci.yml                              # forge test + npm run typecheck, every PR
│   ├── deploy-console.yml                  # apps/frontend -> exekpro-console, on push to main
│   └── deploy-landing.yml                  # apps/landing -> exekpro-landing, on push to main
│
├── scripts/
│   └── deploy-local.sh                     # one-command local kernel deploy + demo intent/module registration
│
├── docs/                                   # placeholder — not yet populated
│
├── package.json                           # npm workspaces root
├── tsconfig.base.json                     # shared strict TS config, extended per-package
├── .gitignore
├── LICENSE                                 # Apache-2.0
├── CONTRIBUTING.md
└── README.md
```

---

## Access Control

`ModuleRegistry` and `IntentRegistry` each currently hand-roll their own `owner` / `onlyOwner`. `ProtocolRoles` replaces that duplication with a single shared owner contract both registries defer to — one owner, one place to reason about protocol control, not independent per-registry admins. This is deliberately the simple model for now, not multi-role RBAC (distinct module-manager / intent-manager / protocol-admin roles) — revisit that split if and when different registries genuinely need independent operators.

---

## Build Order

1. Smart Contracts: Execution Modules + Registry + Engine
2. Execution Node: intent processing + module-selection orchestration
3. Indexer: execution metrics + performance feedback loop
4. SDK: developer integration surface
5. Frontend: intent-based interaction layer

---

## Core Design Principles

- Execution is modular, not monolithic
- Competing modules are scored transparently (`ScorePolicy`) and the best one wins — no hidden routing
- Trust boundaries are explicit: intent-type activation, module registration, and protocol ownership are each a single, auditable control point
- Built toward production: prefer explicit, tested logic over cleverness; expand scope (settlement, multi-role access, graph pipelining) only when a concrete need appears, not speculatively
- System performance is measured and observable by design
- SDK is the primary integration surface for external adoption

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — local setup (links back to Getting Started above), what to run before opening a PR, and commit conventions.

## License

[Apache License 2.0](LICENSE).

---

## Final Note

This protocol is an execution abstraction layer for Web3 applications: it lets a decentralized system express an intent once and have competing, independently deployed execution strategies fight for the right to fulfill it — with the trust boundary that governs *which* strategies are eligible kept small, explicit, and centrally owned.
