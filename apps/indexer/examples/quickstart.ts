/**
 * End-to-end example for @execution-kernel-protocol/indexer, run against a
 * real local anvil deployment — see packages/sdk/examples/quickstart.ts for
 * the exact deploy steps and addresses this expects.
 *
 * Runs two executeIntent() calls (one before, one after a governance
 * reweight, so each module wins once), then backfills every emitted event
 * and checks the derived metrics match.
 *
 * How to run: same anvil + forge create setup as
 * packages/sdk/examples/quickstart.ts, then:
 *   node apps/indexer/examples/quickstart.ts
 */
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createExecutionKernelClient } from "@execution-kernel-protocol/sdk";
import { localAnvil, localAnvilAddresses, localAnvilModules, ROUTE_INTENT_TYPE } from "@execution-kernel-protocol/config";
import { createIndexer } from "../src/index.ts";

const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const { routerModule, mevProtectionModule: mevModule } = localAnvilModules;
const ROUTE = ROUTE_INTENT_TYPE;

const account = privateKeyToAccount(PK);
const publicClient = createPublicClient({ chain: localAnvil, transport: http() });
const walletClient = createWalletClient({ chain: localAnvil, transport: http(), account });
const kernel = createExecutionKernelClient({ addresses: localAnvilAddresses, publicClient, walletClient });

async function main() {
  await kernel.intentRegistry.registerIntent(ROUTE, "Route");
  await kernel.moduleRegistry.registerModule(ROUTE, routerModule);
  await kernel.moduleRegistry.registerModule(ROUTE, mevModule);

  // Router wins under equal weights.
  await kernel.execution.executeIntent({ intentType: ROUTE, intentData: "0x" });

  // Reweight toward MEV protection, then MevProtectionModule wins.
  await kernel.scorePolicy.updateWeights({ qualityWeight: 1n, costWeight: 1n, mevWeight: 50n, latencyWeight: 1n });
  await kernel.execution.executeIntent({ intentType: ROUTE, intentData: "0x" });

  const indexer = await createIndexer({ publicClient, addresses: localAnvilAddresses });

  console.log("total executions:", indexer.totalExecutions());
  console.log("executions by module:", indexer.executionsByModule());
  console.log("intent registrations:", indexer.store.getIntentRegistrations());
  console.log("module registrations:", indexer.store.getModuleRegistrations());
  console.log("weights updates:", indexer.store.getWeightsUpdates());

  if (indexer.totalExecutions() !== 2) throw new Error(`expected 2 executions, got ${indexer.totalExecutions()}`);
  if (indexer.moduleWinRate(routerModule, ROUTE) !== 0.5) throw new Error("expected RouterModule to have won exactly 1 of 2");
  if (indexer.moduleWinRate(mevModule, ROUTE) !== 0.5) throw new Error("expected MevProtectionModule to have won exactly 1 of 2");
  if (indexer.store.getModuleRegistrations().length !== 2) throw new Error("expected 2 module registrations indexed");
  if (indexer.store.getIntentRegistrations().length !== 1) throw new Error("expected 1 intent registration indexed");
  if (indexer.store.getWeightsUpdates().length !== 1) throw new Error("expected 1 weights update indexed");

  console.log("\n✅ indexer smoke test passed end to end against live anvil deployment");
}

main().catch((err) => {
  console.error("❌ smoke test failed:", err);
  process.exit(1);
});
