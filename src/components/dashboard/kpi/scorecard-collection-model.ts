import type { Scorecard } from "@/lib/scorecard-api";

export type ScorecardCollectionView = "grid" | "list";

export function formatScorecardNumber(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(number)
    : "—";
}

function clampProgress(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

export function scorecardDisplay(scorecard: Scorecard) {
  const isStrategic = scorecard.currentVersion?.mode === "strategic";
  const rawScore = scorecard.overallScore;
  const scoreValue = rawScore == null || rawScore === "" ? NaN : Number(rawScore);
  const hasScore = scorecard.performanceStatus === "scored" && Number.isFinite(scoreValue);
  const rawCompleteness = scorecard.completenessPercent;
  const completenessValue = rawCompleteness == null || rawCompleteness === "" ? NaN : Number(rawCompleteness);
  const hasCompleteness = Number.isFinite(completenessValue);
  const kpiCount = scorecard.entries?.length ?? 0;
  const approvedCount = scorecard.entries?.filter((entry) => entry.status === "scored").length ?? 0;
  const periodLabel = scorecard.period?.label?.trim() || "Reporting period unavailable";
  const periodParts = periodLabel.split(/\s+[—–]\s+/);

  return {
    name: scorecard.currentVersion?.name?.trim() || `Scorecard #${scorecard.id}`,
    periodName: periodParts.length > 1 ? periodParts.slice(1).join(" — ") : periodLabel,
    secondaryLabel: periodParts.length > 1 ? periodParts[0] : "",
    scoreText: isStrategic ? "Status only" : hasScore ? `${formatScorecardNumber(scoreValue)}%` : "Awaiting data",
    scoreLabel: isStrategic ? "Overall score" : "Live approved score",
    hasScore,
    scoreProgress: hasScore ? clampProgress(scoreValue) : 0,
    completenessLabel: isStrategic ? "Approved results" : "Data completeness",
    completenessText: isStrategic ? `${approvedCount} of ${kpiCount}` : hasCompleteness ? `${formatScorecardNumber(completenessValue)}%` : "—",
    completenessProgress: isStrategic ? kpiCount ? approvedCount / kpiCount * 100 : 0 : hasCompleteness ? clampProgress(completenessValue) : 0,
    isComplete: isStrategic ? kpiCount > 0 && approvedCount === kpiCount : hasCompleteness && completenessValue >= 100,
    kpiCount,
    status: ["draft", "archived"].includes(scorecard.status) ? scorecard.status : scorecard.performanceStatus,
  };
}
