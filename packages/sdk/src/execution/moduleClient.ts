import { decodeAbiParameters } from "viem";
import type { Address, PublicClient } from "viem";
import type { Bytes32, ExecutionModuleInfo, ExecutionQuote, Hex } from "@execution-kernel-protocol/types";
import { executionModuleAbi } from "../abi/index.ts";

const executionQuoteComponents = [
  { name: "tag", type: "string" },
  { name: "executionCost", type: "uint256" },
  { name: "executionQuality", type: "uint256" },
  { name: "mevRisk", type: "uint256" },
  { name: "latencyScore", type: "uint256" },
] as const;

export interface ModuleClientConfig {
  publicClient: PublicClient;
}

/**
 * Wraps packages/contracts/src/interfaces/IExecutionModule.sol — callable
 * against any module address, not tied to one specific module.
 */
export function createModuleClient(config: ModuleClientConfig) {
  const { publicClient } = config;

  return {
    async getModuleInfo(module: Address): Promise<ExecutionModuleInfo> {
      const [moduleId, name, version] = await Promise.all([
        publicClient.readContract({ address: module, abi: executionModuleAbi, functionName: "moduleId" }),
        publicClient.readContract({ address: module, abi: executionModuleAbi, functionName: "name" }),
        publicClient.readContract({ address: module, abi: executionModuleAbi, functionName: "version" }),
      ]);

      return { address: module, moduleId, name, version };
    },

    async supportsIntent(module: Address, intentType: Bytes32, blockNumber?: bigint): Promise<boolean> {
      return publicClient.readContract({
        address: module,
        abi: executionModuleAbi,
        functionName: "supportsIntent",
        args: [intentType],
        blockNumber,
      });
    },

    async estimateCost(module: Address, intentData: Hex): Promise<bigint> {
      return publicClient.readContract({
        address: module,
        abi: executionModuleAbi,
        functionName: "estimateCost",
        args: [intentData],
      });
    },

    /**
     * Calls simulate() directly on a module and decodes the return as an
     * ExecutionQuote — the same decode ExecutionEngine._selectBestModule
     * performs internally, exposed so callers can preview a module's quote
     * before executeIntent() runs the real selection across all modules.
     */
    async simulateQuote(module: Address, user: Address, intentData: Hex, context: Hex, blockNumber?: bigint): Promise<ExecutionQuote> {
      const raw = await publicClient.readContract({
        address: module,
        abi: executionModuleAbi,
        functionName: "simulate",
        args: [user, intentData, context],
        blockNumber,
      });

      const [quote] = decodeAbiParameters(
        [{ type: "tuple", components: executionQuoteComponents }],
        raw,
      );

      return quote as unknown as ExecutionQuote;
    },
  };
}

export type ModuleClient = ReturnType<typeof createModuleClient>;
