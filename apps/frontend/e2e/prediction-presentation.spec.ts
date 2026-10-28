import { expect, test } from "@playwright/test";
import type { PredictionResult } from "../src/lib/predictionPresentation.ts";
import { getVisiblePrediction } from "../src/lib/predictionPresentation.ts";

const request = {
  executionEngine: "0x0000000000000000000000000000000000000001" as const,
  intentType: "0x0000000000000000000000000000000000000000000000000000000000000001" as const,
  user: "0x0000000000000000000000000000000000000002" as const,
};
const result: PredictionResult = {
  intentType: request.intentType,
  request,
  snapshot: {
    blockNumber: 123n,
    weights: { qualityWeight: 1n, costWeight: 1n, mevWeight: 1n, latencyWeight: 1n },
  },
  winner: { module: "0x0000000000000000000000000000000000000003", supportsIntent: true, score: 1n },
  candidates: [{ module: "0x0000000000000000000000000000000000000003", supportsIntent: true, score: 1n }],
};

test("hides an earlier snapshot after refresh failure and shows the recovered evaluation", () => {
  expect(getVisiblePrediction({ status: "success", data: result }, request)).toBe(result);

  // React Query preserves `data` from the previous success on a failed
  // refetch. It is not a current prediction and must not reach the console.
  expect(getVisiblePrediction({ status: "error", data: result }, request)).toBeUndefined();

  const recovered = { ...result, snapshot: { ...result.snapshot, blockNumber: 124n } };
  expect(getVisiblePrediction({ status: "success", data: recovered }, request)).toBe(recovered);
});
