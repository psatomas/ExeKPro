import assert from "node:assert/strict";
import test from "node:test";
import { ContractFunctionRevertedError, ContractFunctionZeroDataError, RpcRequestError, type Address } from "viem";
import { buildExecutionGraph } from "../src/engine/executionGraphBuilder.ts";
import type { ExecutionKernelClient } from "@execution-kernel-protocol/sdk";
import type { Bytes32, ExecutionQuote, ScorePolicyWeights } from "@execution-kernel-protocol/types";

const intentType = "0x0000000000000000000000000000000000000000000000000000000000000001" as Bytes32;
const user = "0x0000000000000000000000000000000000000001" as Address;
const modules = [
  "0x0000000000000000000000000000000000000011",
  "0x0000000000000000000000000000000000000022",
  "0x0000000000000000000000000000000000000033",
] as Address[];
const blockNumber = 123n;
const weights: ScorePolicyWeights = { qualityWeight: 1n, costWeight: 2n, mevWeight: 3n, latencyWeight: 4n };
const quote: ExecutionQuote = { tag: "fixture", executionQuality: 100n, executionCost: 2n, mevRisk: 1n, latencyScore: 3n };
const revertedCandidateCall = () => new ContractFunctionRevertedError({ abi: [], functionName: "simulate" });
const malformedCandidateReturn = () => new ContractFunctionZeroDataError({ functionName: "simulate" });
const rpcFailure = () => new RpcRequestError({
  body: { method: "eth_call" },
  error: Object.assign(new Error("node unavailable"), { code: -32000 }),
  url: "http://127.0.0.1:8545",
});

function kernelFixture(overrides: Partial<Record<"getBlockNumber" | "getModules" | "getWeights" | "supportsIntent" | "simulateQuote" | "evaluate", unknown>> = {}) {
  const calls: Array<{ name: string; block?: bigint; module?: Address }> = [];
  const fixture = {
    getBlockNumber: async () => {
      calls.push({ name: "getBlockNumber" });
      if (typeof overrides.getBlockNumber === "function") return (overrides.getBlockNumber as () => Promise<bigint>)();
      return blockNumber;
    },
    moduleRegistry: {
      getModules: async (_intentType: Bytes32, atBlock?: bigint) => {
        calls.push({ name: "getModules", block: atBlock });
        if (typeof overrides.getModules === "function") return (overrides.getModules as () => Promise<Address[]>)();
        return modules;
      },
    },
    scorePolicy: {
      getWeights: async (atBlock?: bigint) => {
        calls.push({ name: "getWeights", block: atBlock });
        if (typeof overrides.getWeights === "function") return (overrides.getWeights as () => Promise<ScorePolicyWeights>)();
        return weights;
      },
      evaluate: async (_quote: ExecutionQuote, atBlock?: bigint) => {
        calls.push({ name: "evaluate", block: atBlock });
        if (typeof overrides.evaluate === "function") return (overrides.evaluate as () => Promise<bigint>)();
        return 10n;
      },
    },
    module: {
      supportsIntent: async (module: Address, _intentType: Bytes32, atBlock?: bigint) => {
        calls.push({ name: "supportsIntent", block: atBlock, module });
        if (typeof overrides.supportsIntent === "function") return (overrides.supportsIntent as (module: Address) => Promise<boolean>)(module);
        return true;
      },
      simulateQuote: async (module: Address, _user: Address, _intentData: `0x${string}`, _context: `0x${string}`, atBlock?: bigint) => {
        calls.push({ name: "simulateQuote", block: atBlock, module });
        if (typeof overrides.simulateQuote === "function") return (overrides.simulateQuote as (module: Address) => Promise<ExecutionQuote>)(module);
        return quote;
      },
    },
  };
  return { kernel: fixture as unknown as ExecutionKernelClient, calls };
}

test("captures one block and pins registry, policy, module, and score reads to it", async () => {
  const { kernel, calls } = kernelFixture();
  const graph = await buildExecutionGraph(kernel, intentType, user, "0x");

  assert.equal(graph.snapshot.blockNumber, blockNumber);
  assert.deepEqual(graph.snapshot.weights, weights);
  assert.equal(calls.filter(({ name }) => name === "getBlockNumber").length, 1);
  assert.deepEqual(calls.filter(({ name }) => name !== "getBlockNumber").map(({ block }) => block), Array(calls.length - 1).fill(blockNumber));
});

test("snapshot failures are global and do not return a partial graph", async () => {
  const { kernel } = kernelFixture({ getWeights: async () => { throw rpcFailure(); } });
  await assert.rejects(buildExecutionGraph(kernel, intentType, user, "0x"), RpcRequestError);
});

test("isolates candidate support, simulation, and quote-score failures while preserving registry order", async () => {
  const { kernel } = kernelFixture({
    supportsIntent: async (module: Address) => {
      if (module === modules[0]) throw revertedCandidateCall();
      return true;
    },
    simulateQuote: async (module: Address) => {
      if (module === modules[1]) throw revertedCandidateCall();
      return quote;
    },
    evaluate: async () => { throw malformedCandidateReturn(); },
  });
  const graph = await buildExecutionGraph(kernel, intentType, user, "0x");

  assert.deepEqual(graph.candidates.map(({ module }) => module), modules);
  assert.deepEqual(graph.candidates.map(({ skipReason }) => skipReason), ["support check failed", "simulation failed", "quote evaluation failed"]);
  assert.equal(graph.predictedWinner, undefined);
});

test("uses strict greater-than scoring so the first registry candidate wins a tie", async () => {
  const { kernel } = kernelFixture({ evaluate: async () => 10n });
  const graph = await buildExecutionGraph(kernel, intentType, user, "0x");

  assert.equal(graph.predictedWinner?.module, modules[0]);
  assert.deepEqual(graph.candidates.map(({ module }) => module), modules);
});

test("propagates infrastructure failures instead of marking a candidate ineligible", async () => {
  const { kernel } = kernelFixture({
    supportsIntent: async (module: Address) => {
      if (module === modules[1]) throw rpcFailure();
      return true;
    },
  });

  await assert.rejects(buildExecutionGraph(kernel, intentType, user, "0x"), RpcRequestError);
});
