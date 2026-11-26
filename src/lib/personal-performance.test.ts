import { describe, expect, it } from "vitest";
import { selectCurrentPersonalEvaluation, selectCurrentPersonalScorecard, selectPersonalNextStep, selectPersonalPeriod, selectVisiblePersonalScorecards } from "./personal-performance";
import type { KpiAssignment } from "./kpi-api";
import type { Scorecard } from "./scorecard-api";
import type { Evaluation } from "./evaluation-api";
import type { KpiWorkflowGuidance, KpiWorkflowWaitingStep } from "./kpi-workflow-api";

const periods = [
  { id: 1, label: "October", startDate: "2026-10-01", endDate: "2026-10-31", frequency: "monthly", timezone: null },
  { id: 2, label: "November", startDate: "2026-11-01", endDate: "2026-11-30", frequency: "monthly", timezone: null },
  { id: 3, label: "December", startDate: "2026-12-01", endDate: "2026-12-31", frequency: "monthly", timezone: null },
];
const assignment = (period: typeof periods[number], status = "active") => ({ id: period.id, periodId: period.id, period, status }) as KpiAssignment;
const scorecard = (id: number, period: typeof periods[number], publishedAt: string, status = "published") => ({ id, periodId: period.id, period, status, currentVersion: { publishedAt, version: 1 } }) as unknown as Scorecard;

describe("personal performance selection", () => {
  it("prefers the current reporting period over newer future and older historical periods", () => {
    expect(selectPersonalPeriod(periods.map((period) => assignment(period)), [], "2026-11-10")?.id).toBe(2);
  });
  it("uses the most recent available period when none is current", () => {
    expect(selectPersonalPeriod([assignment(periods[0])], [], "2026-11-10")?.id).toBe(1);
  });
  it("selects the latest published configuration for the chosen period, preserving other records for history", () => {
    const rows = [scorecard(10, periods[0], "2026-10-02"), scorecard(11, periods[1], "2026-11-02"), scorecard(12, periods[1], "2026-11-03"), scorecard(13, periods[1], "", "draft")];
    expect(selectCurrentPersonalScorecard(rows, 2)?.id).toBe(12);
  });
  it("shows every published scorecard in active periods while leaving drafts and past periods in history", () => {
    const rows = [scorecard(10, periods[0], "2026-10-02"), scorecard(11, periods[1], "2026-11-02"), scorecard(12, periods[1], "2026-11-03"), scorecard(13, periods[1], "", "draft")];
    expect(selectVisiblePersonalScorecards(rows, "2026-11-10").map((row) => row.id)).toEqual([12, 11]);
  });
  it("shows an in-progress evaluation before finalized history", () => {
    const rows = [{ id: 9, status: "finalized" }, { id: 7, status: "self_draft" }] as Evaluation[];
    expect(selectCurrentPersonalEvaluation(rows)?.id).toBe(7);
  });
  const guidance = (waiting: KpiWorkflowWaitingStep[] = [], actions: KpiWorkflowGuidance["actions"] = []): KpiWorkflowGuidance => ({ stages: [], records: [], waiting, actions, updatedAt: "2026-11-10" });
  const pending = (id: string, owner: string, extras: Partial<KpiWorkflowWaitingStep> = {}): KpiWorkflowWaitingStep => ({ id, title: id, status: "pending", owner, explanation: `Waiting for ${owner}`, ...extras });
  it("uses backend employee actions ahead of waiting steps and keeps their record destination", () => {
    const result = selectPersonalNextStep(guidance([pending("manager_review", "Authorized manager")], [{ id: "correct:12", stage: "submit", title: "Correct returned achievement", description: "Update the returned entry", owner: "Employee", href: "/dashboard/me/kpi/12" }]), [], []);
    expect(result).toMatchObject({ kind: "action", title: "Correct returned achievement", href: "/dashboard/me/kpi/12" });
  });
  it("shows actual HR setup and shared reminder state without inventing an action", () => {
    const step = pending("assignment", "HR or authorized manager", { reminderKey: "assignment:4", reminderStatus: "active", reminderBlockedReason: "HR has already been notified" });
    expect(selectPersonalNextStep(guidance([step]), [], [])).toMatchObject({ kind: "waiting", owner: step.owner, reminder: step });
  });
  it("distinguishes manager review and HR finalization from employee actions", () => {
    expect(selectPersonalNextStep(guidance([pending("manager_review", "Authorized manager")]), [], [])?.title).toBe("Waiting for manager review");
    expect(selectPersonalNextStep(guidance([pending("hr_finalization", "Authorized HR reviewer")]), [], [])?.title).toBe("Waiting for HR finalization");
  });
  it("shows all caught up only when the backend has no pending action or blocker", () => {
    expect(selectPersonalNextStep(guidance(), [assignment(periods[1])], [])?.kind).toBe("complete");
    expect(selectPersonalNextStep(guidance(), [], [])?.title).toBe("Your KPI journey is awaiting setup");
  });
});
