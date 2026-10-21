"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { solve } from "@execution-kernel-protocol/execution-node";
import type { ExecutionKernelClient } from "@execution-kernel-protocol/sdk";
import type { Bytes32 } from "@execution-kernel-protocol/types";
import type { PredictionResult } from "@/lib/predictionPresentation";

/**
 * Off-chain, gas-free prediction of which registered module would currently
 * win selection -- wraps execution-node's solve(), same as apps/api's
 * /modules/:intentType/predict route. Requires a connected wallet address
 * only because solve()/simulate() need a `user` argument, not because
 * anything is submitted.
 */
export function usePrediction(
  kernel: ExecutionKernelClient | undefined,
  intentType: Bytes32 | undefined,
  user: Address | undefined,
) {
  return useQuery({
    queryKey: ["prediction", kernel?.execution.address, intentType, user],
    queryFn: async (): Promise<PredictionResult> => ({
      ...(await solve(kernel!, intentType!, user!, "0x")),
      request: {
        executionEngine: kernel!.execution.address,
        intentType: intentType!,
        user: user!,
      },
    }),
    enabled: !!kernel && !!intentType && !!user,
    retry: false,
  });
}
