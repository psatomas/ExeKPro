import type { Address } from "viem";
import type { ExecutionKernelClient } from "@execution-kernel-protocol/sdk";
import type { Bytes32, Hex } from "@execution-kernel-protocol/types";
import { buildExecutionGraph, type ExecutionCandidate, type ExecutionGraph } from "../engine/executionGraphBuilder.ts";

export interface SolveResult {
  intentType: Bytes32;
  snapshot: ExecutionGraph["snapshot"];
  winner: ExecutionCandidate;
  candidates: ExecutionCandidate[];
}

/**
 * Predicts which registered module ExecutionEngine.executeIntent() would
 * select right now, without submitting a transaction.
 *
 * One generic solver, not one per module (routerSolver/mevSolver as
 * originally sketched in the README's repository layout) — every module
 * implements the same generic IExecutionModule interface and gets scored by
 * the same ScorePolicy, so there's no module-specific off-chain decision to
 * make today. Revisit this if a module ever needs real off-chain
 * precomputation (e.g. an actual DEX-routing search) that can't be
 * expressed as just calling simulate().
 */
export async function solve(
  kernel: ExecutionKernelClient,
  intentType: Bytes32,
  user: Address,
  intentData: Hex,
): Promise<SolveResult> {
  const graph = await buildExecutionGraph(kernel, intentType, user, intentData);

  if (!graph.predictedWinner) {
    throw new Error(`no module currently supports intentType ${intentType} (or none are registered)`);
  }

  return { intentType, snapshot: graph.snapshot, winner: graph.predictedWinner, candidates: graph.candidates };
}
