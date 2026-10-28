import {
  AbiDecodingDataSizeInvalidError,
  AbiDecodingDataSizeTooSmallError,
  AbiDecodingZeroDataError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  encodeAbiParameters,
} from "viem";
import type { Address } from "viem";
import type { ExecutionKernelClient } from "@execution-kernel-protocol/sdk";
import type { Bytes32, ExecutionQuote, ExecutionScore, Hex, ScorePolicyWeights } from "@execution-kernel-protocol/types";

export type CandidateSkipReason = "support check failed" | "simulation failed" | "quote evaluation failed";

/**
 * One registered module's live standing for an intent, as ExecutionEngine
 * would compute it right now: its ExecutionQuote and the ScorePolicy score
 * evaluate() gives that quote under the CURRENT on-chain weights.
 */
export interface ExecutionCandidate {
  module: Address;
  supportsIntent: boolean;
  /** Present only when supportsIntent is true and the simulation succeeds. */
  quote?: ExecutionQuote;
  score?: ExecutionScore;
  /** The engine skips a candidate when the corresponding call reverts. */
  skipReason?: CandidateSkipReason;
}

export interface ExecutionGraph {
  intentType: Bytes32;
  /** Every value in this graph was read against this exact block. */
  snapshot: { blockNumber: bigint; weights: ScorePolicyWeights };
  candidates: ExecutionCandidate[];
  /**
   * The module ExecutionEngine._selectBestModule would currently pick:
   * highest score among evaluable candidates, first registry-returned wins ties
   * (matches `score > bestScore`, not `>=`, in ExecutionEngine.sol).
   * undefined if no registered module supports this intent, or none are
   * registered at all — executeIntent() would revert in either case.
   */
  predictedWinner?: ExecutionCandidate;
}

/**
 * ExecutionEngine catches failures caused by invoking one module, but it
 * cannot catch a node or transport outage before it obtains a result. Keep
 * that distinction off-chain: only a confirmed revert or malformed module
 * return is an eligible candidate skip. Everything else invalidates the
 * snapshot, so callers never present a partial graph as a reliable winner.
 */
function isCandidateCallFailure(error: unknown): boolean {
  const seen = new Set<object>();
  let current = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    if (
      current instanceof ContractFunctionRevertedError ||
      current instanceof ContractFunctionZeroDataError ||
      current instanceof AbiDecodingDataSizeInvalidError ||
      current instanceof AbiDecodingDataSizeTooSmallError ||
      current instanceof AbiDecodingZeroDataError
    ) {
      return true;
    }
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/**
 * Captures a block first, then reads the registry, weights, support checks,
 * quotes, and scores against that block. This keeps a displayed score breakdown
 * coherent even if governance updates weights while the evaluation is running.
 * Per-candidate failures are isolated to match ExecutionEngine's try/catch
 * selection loop; Promise.all preserves ModuleRegistry's returned order.
 *
 * This is a flat one-round scoring pass, matching the actually-implemented
 * "competing modules, single winner" selection model — not a multi-step
 * execution pipeline. See the README's Core Concept section for why: chained
 * multi-module graphs are a future direction, not built yet, so this builder
 * doesn't pretend to compose one.
 */
export async function buildExecutionGraph(
  kernel: ExecutionKernelClient,
  intentType: Bytes32,
  user: Address,
  intentData: Hex,
): Promise<ExecutionGraph> {
  const blockNumber = await kernel.getBlockNumber();
  const [modules, weights] = await Promise.all([
    kernel.moduleRegistry.getModules(intentType, blockNumber),
    kernel.scorePolicy.getWeights(blockNumber),
  ]);
  const context = encodeAbiParameters([{ type: "bytes32" }], [intentType]);

  const candidates: ExecutionCandidate[] = await Promise.all(
    modules.map(async (module): Promise<ExecutionCandidate> => {
      let supportsIntent: boolean;
      try {
        supportsIntent = await kernel.module.supportsIntent(module, intentType, blockNumber);
      } catch (error) {
        if (!isCandidateCallFailure(error)) throw error;
        return { module, supportsIntent: false, skipReason: "support check failed" };
      }

      if (!supportsIntent) {
        return { module, supportsIntent };
      }

      let quote: ExecutionQuote;
      try {
        quote = await kernel.module.simulateQuote(module, user, intentData, context, blockNumber);
      } catch (error) {
        if (!isCandidateCallFailure(error)) throw error;
        return { module, supportsIntent, skipReason: "simulation failed" };
      }

      try {
        const score = await kernel.scorePolicy.evaluate(quote, blockNumber);
        return { module, supportsIntent, quote, score };
      } catch (error) {
        if (!isCandidateCallFailure(error)) throw error;
        return { module, supportsIntent, quote, skipReason: "quote evaluation failed" };
      }
    }),
  );

  let predictedWinner: ExecutionCandidate | undefined;
  for (const candidate of candidates) {
    if (candidate.score === undefined) continue;
    if (!predictedWinner || candidate.score > predictedWinner.score!) {
      predictedWinner = candidate;
    }
  }

  return { intentType, snapshot: { blockNumber, weights }, candidates, predictedWinner };
}
