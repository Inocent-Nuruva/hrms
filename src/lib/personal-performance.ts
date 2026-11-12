import type { KpiAssignment, KpiPeriod } from "@/lib/kpi-api";
import type { Scorecard } from "@/lib/scorecard-api";
import type { Evaluation } from "@/lib/evaluation-api";
import type { KpiWorkflowAction, KpiWorkflowGuidance, KpiWorkflowWaitingStep } from "@/lib/kpi-workflow-api";

function periodOrder(period: Pick<KpiPeriod, "startDate" | "endDate">, today: string) {
  if (period.startDate <= today && today <= period.endDate) return 2;
  if (period.endDate < today) return 1;
  return 0;
}

export function selectPersonalPeriod(assignments: KpiAssignment[], scorecards: Scorecard[], today: string) {
  const periods = new Map<number, KpiPeriod>();
  assignments.filter((row) => row.status === "active").forEach((row) => {
    if (row.period) periods.set(row.period.id, row.period);
  });
  scorecards.forEach((row) => {
    if (row.period?.startDate && row.period?.endDate) {
      periods.set(row.periodId, { id: row.periodId, label: row.period.label, startDate: row.period.startDate, endDate: row.period.endDate, frequency: "", timezone: null });
    }
  });
  return [...periods.values()].sort((a, b) =>
    periodOrder(b, today) - periodOrder(a, today) ||
    (periodOrder(a, today) === 0 ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate)) ||
    b.id - a.id,
  )[0] ?? null;
}

export function selectCurrentPersonalScorecard(scorecards: Scorecard[], periodId: number | null) {
  const published = scorecards.filter((row) => row.currentVersion?.publishedAt && row.status !== "archived");
  const candidates = periodId ? published.filter((row) => row.periodId === periodId) : published;
  return candidates.sort((a, b) =>
    (b.currentVersion.publishedAt ?? "").localeCompare(a.currentVersion.publishedAt ?? "") || b.id - a.id,
  )[0] ?? null;
}

export function selectCurrentPersonalEvaluation(evaluations: Evaluation[]) {
  return [...evaluations].sort((a, b) =>
    Number(b.status !== "finalized") - Number(a.status !== "finalized") || b.id - a.id,
  )[0] ?? null;
}

export type PersonalNextStep = {
  kind: "action" | "waiting" | "complete";
  title: string;
  description: string;
  owner: string;
  href?: string;
  actionLabel?: string;
  reminder?: KpiWorkflowWaitingStep;
};

export function selectPersonalNextStep(
  guidance: KpiWorkflowGuidance | null,
  assignments: KpiAssignment[],
  scorecards: Scorecard[],
): PersonalNextStep | null {
  if (!guidance) return null;
  const action = guidance.actions.find((item: KpiWorkflowAction) =>
    !item.blocked && item.href.startsWith("/dashboard/me/"),
  );
  if (action) return {
    kind: "action",
    title: action.title,
    description: action.description,
    owner: action.owner,
    href: action.href,
    actionLabel: action.title,
  };
  const waiting = guidance.waiting?.find((step) => step.status === "pending");
  if (waiting) return {
    kind: "waiting",
    title: waiting.id === "manager_review" ? "Waiting for manager review" : waiting.id === "hr_finalization" ? "Waiting for HR finalization" : "Your KPI journey is awaiting setup",
    description: waiting.explanation,
    owner: waiting.owner,
    reminder: waiting.reminderKey ? waiting : undefined,
  };
  if (!assignments.some((row) => row.status === "active") && !scorecards.length) return {
    kind: "waiting",
    title: "Your KPI journey is awaiting setup",
    description: "HR or your manager will prepare your KPI assignment.",
    owner: "HR or authorized manager",
  };
  return {
    kind: "complete",
    title: "All caught up",
    description: "No action needs your attention right now. You can review your KPI progress and past results below.",
    owner: "You",
  };
}
