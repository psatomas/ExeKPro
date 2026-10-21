import type { Account, Address, Hash, PublicClient, WalletClient } from "viem";
import type { Bytes32 } from "@execution-kernel-protocol/types";
import { moduleRegistryAbi } from "../abi/index.ts";

export interface ModuleRegistryClientConfig {
  address: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

/** Wraps packages/contracts/src/registry/ModuleRegistry.sol. */
export function createModuleRegistryClient(config: ModuleRegistryClientConfig) {
  const { address, publicClient, walletClient } = config;

  function requireWrite(): WalletClient {
    if (!walletClient) {
      throw new Error("this call requires a walletClient (and is onlyOwner on-chain)");
    }
    return walletClient;
  }

  return {
    address,

    async getModules(intentType: Bytes32, blockNumber?: bigint): Promise<readonly Address[]> {
      return publicClient.readContract({
        address,
        abi: moduleRegistryAbi,
        functionName: "getModules",
        args: [intentType],
        blockNumber,
      });
    },

    async isModuleActive(module: Address): Promise<boolean> {
      return publicClient.readContract({
        address,
        abi: moduleRegistryAbi,
        functionName: "isModuleActive",
        args: [module],
      });
    },

    /** onlyOwner on-chain — reverts unless the walletClient's account is the ProtocolRoles owner. */
    async registerModule(intentType: Bytes32, module: Address, account?: Account | Address): Promise<Hash> {
      const wallet = requireWrite();
      const sender = account ?? wallet.account;
      if (!sender) throw new Error("registerModule requires an account");

      const { request } = await publicClient.simulateContract({
        address,
        abi: moduleRegistryAbi,
        functionName: "registerModule",
        args: [intentType, module],
        account: sender,
      });

      return wallet.writeContract(request);
    },

    /** onlyOwner on-chain. */
    async removeModule(intentType: Bytes32, module: Address, account?: Account | Address): Promise<Hash> {
      const wallet = requireWrite();
      const sender = account ?? wallet.account;
      if (!sender) throw new Error("removeModule requires an account");

      const { request } = await publicClient.simulateContract({
        address,
        abi: moduleRegistryAbi,
        functionName: "removeModule",
        args: [intentType, module],
        account: sender,
      });

      return wallet.writeContract(request);
    },
  };
}

export type ModuleRegistryClient = ReturnType<typeof createModuleRegistryClient>;
