import type { ExecutionModuleInfo, ScorePolicyWeights } from "@execution-kernel-protocol/types";
import type { ExecutionCandidate } from "@execution-kernel-protocol/execution-node";
import { Badge } from "@/components/ui/Badge";

function signed(value: bigint) {
  return value >= 0n ? `+${value.toString()}` : value.toString();
}

/**
 * One candidate module's real standing in the current scoring round --
 * this is the row that makes module competition visible at all: previously
 * only the winner was ever rendered, so a viewer had no way to see that a
 * competition happened, just its outcome.
 */
export function CandidateModuleRow({
  candidate,
  moduleInfo,
  isWinner,
  weights,
}: {
  candidate: ExecutionCandidate;
  moduleInfo?: ExecutionModuleInfo;
  isWinner: boolean;
  weights: ScorePolicyWeights | undefined;
}) {
  const contributions = candidate.quote && weights
    ? [
        { label: "Quality", value: candidate.quote.executionQuality * weights.qualityWeight },
        { label: "Cost", value: -(candidate.quote.executionCost * weights.costWeight) },
        { label: "MEV", value: -(candidate.quote.mevRisk * weights.mevWeight) },
        { label: "Latency", value: -(candidate.quote.latencyScore * weights.latencyWeight) },
      ]
    : undefined;

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border px-3 py-2.5 ${
        isWinner ? "border-accent-soft-border bg-accent-soft" : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{moduleInfo?.name ?? "Unknown module"}</span>
          <Badge tone="neutral">Registered · active</Badge>
          {candidate.skipReason ? (
            <Badge tone="warning">Skipped · {candidate.skipReason}</Badge>
          ) : candidate.supportsIntent ? (
            <Badge tone="success">Eligible</Badge>
          ) : (
            <Badge tone="neutral">Not eligible</Badge>
          )}
          {isWinner && <Badge tone="accent">Selected · highest score</Badge>}
        </div>
        <span className="font-mono text-xs text-faint">{candidate.module}</span>
      </div>

      {candidate.quote && candidate.score !== undefined && (
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs text-muted sm:grid-cols-4">
            <span title="execution quality">quality {candidate.quote.executionQuality.toString()}</span>
            <span title="execution cost">cost {candidate.quote.executionCost.toString()}</span>
            <span title="MEV risk">MEV {candidate.quote.mevRisk.toString()}</span>
            <span title="latency score">latency {candidate.quote.latencyScore.toString()}</span>
          </div>
          <div className={`font-mono text-lg font-semibold tabular-nums ${isWinner ? "text-accent" : "text-ink"}`}>
            score {candidate.score.toString()}
          </div>
        </div>
      )}
      {candidate.quote && contributions && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3 font-mono text-xs text-muted sm:grid-cols-4">
          {contributions.map((contribution) => (
            <span key={contribution.label} title={`${contribution.label} score contribution`}>
              {contribution.label} {signed(contribution.value)}
            </span>
          ))}
        </div>
      )}
      {candidate.quote && <p className="font-mono text-xs text-faint">quote tag: {candidate.quote.tag}</p>}
    </div>
  );
}
