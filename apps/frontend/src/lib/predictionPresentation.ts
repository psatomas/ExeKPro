import type { Address } from "viem";
import type { SolveResult } from "@execution-kernel-protocol/execution-node";
import type { Bytes32 } from "@execution-kernel-protocol/types";

/** Inputs that uniquely identify the chain evaluation represented by a result. */
export interface PredictionRequest {
  executionEngine: Address;
  intentType: Bytes32;
  user: Address;
}

export type PredictionResult = SolveResult & { request: PredictionRequest };

type PredictionQueryState = {
  data: PredictionResult | undefined;
  status: "pending" | "error" | "success";
};

/**
 * React Query intentionally retains the last data while a refetch is in
 * flight. It must not be rendered after that refetch fails: its policy and
 * candidates describe an earlier evaluation. During a valid background
 * refetch `status` remains success, which keeps the current valid result on
 * screen without a loading flicker.
 */
export function getVisiblePrediction(
  query: PredictionQueryState,
  request: PredictionRequest | undefined,
): PredictionResult | undefined {
  if (query.status !== "success" || !query.data || !request) return undefined;

  const resultRequest = query.data.request;
  if (
    resultRequest.executionEngine.toLowerCase() !== request.executionEngine.toLowerCase() ||
    resultRequest.intentType !== request.intentType ||
    resultRequest.user.toLowerCase() !== request.user.toLowerCase()
  ) {
    return undefined;
  }

  return query.data;
}
