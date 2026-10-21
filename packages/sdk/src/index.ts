import type { Address, PublicClient, WalletClient } from "viem";
import { createIntentRegistryClient } from "./registry/intentRegistryClient.ts";
import { createModuleRegistryClient } from "./registry/moduleRegistryClient.ts";
import { createScorePolicyClient } from "./registry/scorePolicyClient.ts";
import { createProtocolRolesClient } from "./registry/protocolRolesClient.ts";
import { createExecutionClient } from "./execution/executionClient.ts";
import { createModuleClient } from "./execution/moduleClient.ts";

export * from "./abi/index.ts";
export * from "./intent/types.ts";
export * from "./intent/intentBuilder.ts";
export * from "./execution/executionClient.ts";
export * from "./execution/moduleClient.ts";
export * from "./registry/intentRegistryClient.ts";
export * from "./registry/moduleRegistryClient.ts";
export * from "./registry/scorePolicyClient.ts";
export * from "./registry/protocolRolesClient.ts";

/** Addresses of one deployed execution kernel, as produced by script/Deploy.s.sol. */
export interface ExecutionKernelAddresses {
  protocolRoles: Address;
  intentRegistry: Address;
  moduleRegistry: Address;
  scorePolicy: Address;
  executionEngine: Address;
}

export interface CreateExecutionKernelClientConfig {
  addresses: ExecutionKernelAddresses;
  publicClient: PublicClient;
  /** Omit for a read-only client; required for any onlyOwner/executeIntent call. */
  walletClient?: WalletClient;
}

/**
 * Bundles every per-contract client against one deployed kernel. This is
 * the typed client CLAUDE.md's sdk description names — intentBuilder is
 * imported separately (it's stateless, no addresses/client needed).
 */
export function createExecutionKernelClient(config: CreateExecutionKernelClientConfig) {
  const { addresses, publicClient, walletClient } = config;

  return {
    /**
     * Captures a chain head for a coherent read-only evaluation snapshot.
     * Callers pass the returned block number to every subsequent contract
     * read, rather than mixing data from independently advancing heads.
     */
    getBlockNumber: () => publicClient.getBlockNumber({ cacheTime: 0 }),
    protocolRoles: createProtocolRolesClient({ address: addresses.protocolRoles, publicClient, walletClient }),
    intentRegistry: createIntentRegistryClient({ address: addresses.intentRegistry, publicClient, walletClient }),
    moduleRegistry: createModuleRegistryClient({ address: addresses.moduleRegistry, publicClient, walletClient }),
    scorePolicy: createScorePolicyClient({ address: addresses.scorePolicy, publicClient, walletClient }),
    execution: createExecutionClient({ address: addresses.executionEngine, publicClient, walletClient }),
    module: createModuleClient({ publicClient }),
  };
}

export type ExecutionKernelClient = ReturnType<typeof createExecutionKernelClient>;
