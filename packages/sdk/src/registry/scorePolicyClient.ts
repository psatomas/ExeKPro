import type { Account, Address, Hash, PublicClient, WalletClient } from "viem";
import type { ExecutionQuote, ExecutionScore, ScorePolicyWeights } from "@execution-kernel-protocol/types";
import { scorePolicyAbi } from "../abi/index.ts";

export interface ScorePolicyClientConfig {
  address: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

/** Wraps packages/contracts/src/policy/ScorePolicy.sol. */
export function createScorePolicyClient(config: ScorePolicyClientConfig) {
  const { address, publicClient, walletClient } = config;

  return {
    address,

    async getWeights(blockNumber?: bigint): Promise<ScorePolicyWeights> {
      const [qualityWeight, costWeight, mevWeight, latencyWeight] = await publicClient.readContract({
        address,
        abi: scorePolicyAbi,
        functionName: "weights",
        blockNumber,
      });

      return { qualityWeight, costWeight, mevWeight, latencyWeight };
    },

    /** Read-only — same scoring evaluate() does on-chain, without needing a module's live quote. */
    async evaluate(quote: ExecutionQuote, blockNumber?: bigint): Promise<ExecutionScore> {
      return publicClient.readContract({
        address,
        abi: scorePolicyAbi,
        functionName: "evaluate",
        args: [quote],
        blockNumber,
      });
    },

    /**
     * onlyOwner on-chain — reverts unless the walletClient's account is
     * the ProtocolRoles owner. Takes effect immediately on this
     * already-deployed ScorePolicy, no redeploy.
     */
    async updateWeights(weights: ScorePolicyWeights, account?: Account | Address): Promise<Hash> {
      if (!walletClient) {
        throw new Error("updateWeights requires a walletClient (and is onlyOwner on-chain)");
      }
      const sender = account ?? walletClient.account;
      if (!sender) throw new Error("updateWeights requires an account");

      const { request } = await publicClient.simulateContract({
        address,
        abi: scorePolicyAbi,
        functionName: "updateWeights",
        args: [weights.qualityWeight, weights.costWeight, weights.mevWeight, weights.latencyWeight],
        account: sender,
      });

      return walletClient.writeContract(request);
    },
  };
}

export type ScorePolicyClient = ReturnType<typeof createScorePolicyClient>;
