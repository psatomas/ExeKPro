import type { ScorePolicyWeights } from "@execution-kernel-protocol/types";
import { PanelRow } from "@/components/ui/Panel";

const WEIGHTS: { key: keyof ScorePolicyWeights; label: string; sign: "+" | "−" }[] = [
  { key: "qualityWeight", label: "Quality", sign: "+" },
  { key: "costWeight", label: "Cost", sign: "−" },
  { key: "mevWeight", label: "MEV", sign: "−" },
  { key: "latencyWeight", label: "Latency", sign: "−" },
];

/**
 * A direct rendering of ScorePolicy._evaluate() and ExecutionEngine's strict
 * comparison. Values are fetched from the deployed ScorePolicy; this does not
 * offer policy editing from the console.
 */
export function ScoringPolicy({ weights, blockNumber }: { weights: ScorePolicyWeights; blockNumber: bigint }) {
  return (
    <div className="flex flex-col">
      <div className="rounded-md border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink">
        score = (quality × quality weight) − (cost × cost weight) − (MEV risk × MEV weight) − (latency × latency weight)
      </div>
      <p className="mt-2 font-mono text-xs text-faint">Evaluation snapshot: block {blockNumber.toString()}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {WEIGHTS.map(({ key, label, sign }) => (
          <div key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-xs text-muted">{sign} {label}</span>
            <span className="font-mono text-sm tabular-nums text-ink">{weights[key].toString()}</span>
          </div>
        ))}
      </div>
      <PanelRow className="mt-3 text-xs leading-relaxed text-muted">
        Highest signed score wins. Equal scores retain the first eligible module returned by the registry because the engine replaces a winner only when a score is strictly greater.
      </PanelRow>
      <p className="mt-3 text-xs leading-relaxed text-faint">
        Eligibility requires an active registered module that supports this intent and returns a decodable quote that the policy can evaluate. Candidate rows retain the registry order and identify calls that could not be evaluated at this snapshot; the engine skips reverts at those same stages.
      </p>
    </div>
  );
}
