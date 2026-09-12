import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { Address, Chain, PublicClient } from "viem";
import type { ExecutionKernelClient } from "@execution-kernel-protocol/sdk";
import { createIndexer, type Indexer } from "@execution-kernel-protocol/indexer";
import { localAnvilDeployment, type KernelDeploymentConfig } from "@execution-kernel-protocol/config";
import { createKernelService } from "./services/kernelService.ts";
import { intentsRoutes } from "./routes/intentsRoutes.ts";
import { modulesRoutes } from "./routes/modulesRoutes.ts";
import { metricsRoutes } from "./routes/metricsRoutes.ts";
import { executionsRoutes } from "./routes/executionsRoutes.ts";

declare module "fastify" {
  interface FastifyInstance {
    kernel: ExecutionKernelClient;
    publicClient: PublicClient;
    indexer: Indexer;
  }
}

/**
 * Builds the Fastify app without starting it listening -- kept separate
 * from the listen() call below so this can be imported and driven directly
 * (e.g. via app.inject(...)) without binding a real port.
 *
 * Takes the kernel deployment explicitly (defaulting to localAnvilDeployment
 * for local dev), threaded straight through to createKernelService -- this
 * one process serves one configured deployment. No auth/multi-tenancy: a
 * second customer deployment means a second process, not a request-scoped
 * config here.
 *
 * `indexer` is built once here, from this same `config`/`publicClient` --
 * not a second, differently-configured one -- and decorated the same way
 * as `kernel`/`publicClient` above it. Indexer-backed routes
 * (executionsController, metricsController) read `request.server.indexer`
 * and call its `.sync()` before every read instead of each constructing
 * their own indexer and rescanning from block 0 per request (the previous
 * behavior, which also hardcoded `localAnvilAddresses` regardless of
 * `config` -- both fixed by routing through this one shared instance).
 * async because createIndexer() performs one synchronization before
 * resolving; Fastify's own `.ready()`/`.listen()` already await plugin
 * registration the same way (see the `cors` registration below), so this
 * isn't a new pattern for this file, just this function's own signature.
 */
export async function buildServer(config: KernelDeploymentConfig = localAnvilDeployment): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // Read-only GETs, no credentials/cookies -- open CORS is fine here.
  // apps/frontend calls this from a different port (3000) in local dev.
  app.register(cors, { origin: true });

  const { kernel, publicClient } = createKernelService(config);
  app.decorate("kernel", kernel);
  app.decorate("publicClient", publicClient);

  const indexer = await createIndexer({ publicClient, addresses: config.addresses });
  app.decorate("indexer", indexer);

  app.get("/health", async () => ({ status: "ok" }));

  app.register(intentsRoutes, { prefix: "/intents" });
  app.register(modulesRoutes, { prefix: "/modules" });
  app.register(metricsRoutes, { prefix: "/metrics" });
  app.register(executionsRoutes, { prefix: "/executions" });

  return app;
}

/**
 * Builds a KernelDeploymentConfig from KERNEL_RPC_URL/KERNEL_CHAIN_ID plus
 * the 5 KERNEL_*_ADDRESS env vars, for pointing one running api process at
 * a specific customer's kernel deployment without editing code. Returns
 * undefined (falling back to localAnvilDeployment) when none of these are
 * set -- the local-dev default stays zero-config. Throws if only some are
 * set, since a half-specified deployment is a configuration mistake, not a
 * partial default worth silently guessing around.
 *
 * The constructed Chain only carries what a read-only publicClient actually
 * needs (id + rpc url) -- name/nativeCurrency are cosmetic placeholders,
 * not a general multi-chain profile.
 */
function loadKernelDeploymentConfigFromEnv(): KernelDeploymentConfig | undefined {
  const {
    KERNEL_RPC_URL,
    KERNEL_CHAIN_ID,
    KERNEL_PROTOCOL_ROLES_ADDRESS,
    KERNEL_INTENT_REGISTRY_ADDRESS,
    KERNEL_MODULE_REGISTRY_ADDRESS,
    KERNEL_SCORE_POLICY_ADDRESS,
    KERNEL_EXECUTION_ENGINE_ADDRESS,
  } = process.env;

  const values = [
    KERNEL_RPC_URL,
    KERNEL_CHAIN_ID,
    KERNEL_PROTOCOL_ROLES_ADDRESS,
    KERNEL_INTENT_REGISTRY_ADDRESS,
    KERNEL_MODULE_REGISTRY_ADDRESS,
    KERNEL_SCORE_POLICY_ADDRESS,
    KERNEL_EXECUTION_ENGINE_ADDRESS,
  ];

  if (values.every((v) => v === undefined)) {
    return undefined;
  }
  if (values.some((v) => v === undefined)) {
    throw new Error(
      "partial kernel deployment env config: set KERNEL_RPC_URL, KERNEL_CHAIN_ID, and all 5 KERNEL_*_ADDRESS vars together, or none of them (to use the local anvil default)",
    );
  }

  const chain: Chain = {
    id: Number(KERNEL_CHAIN_ID),
    name: "Execution Kernel chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [KERNEL_RPC_URL!] } },
  };

  return {
    chain,
    addresses: {
      protocolRoles: KERNEL_PROTOCOL_ROLES_ADDRESS as Address,
      intentRegistry: KERNEL_INTENT_REGISTRY_ADDRESS as Address,
      moduleRegistry: KERNEL_MODULE_REGISTRY_ADDRESS as Address,
      scorePolicy: KERNEL_SCORE_POLICY_ADDRESS as Address,
      executionEngine: KERNEL_EXECUTION_ENGINE_ADDRESS as Address,
    },
  };
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const start = async () => {
    const app = await buildServer(loadKernelDeploymentConfigFromEnv());
    // 3000 collides with apps/frontend's default `next dev`/`next start` port
    // -- the two are meant to run side by side, so default this one off it.
    const port = Number(process.env.PORT ?? 4000);

    app.listen({ port, host: "0.0.0.0" }, (err) => {
      if (err) {
        app.log.error(err);
        process.exit(1);
      }
    });
  };

  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
