"use client";

import { workflowFailure } from "@/lib/workflow-error";
import { z } from "zod";
import { WorkflowGuide } from "@/components/dashboard/workflow-guide";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

import * as React from "react";
import { FluentSelect } from "@/components/ui/fluent-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/fluent-toast-store";
import {
  actionButtonClass,
  asRecord,
  primaryButtonClass,
  readString,
  rowId,
} from "@/components/dashboard/talent-visuals";
import {
  finalizeKpiCycleReview,
  listKpiCycleReviews,
  listMyKpiCycleScores,
  respondToKpiMidReview,
  submitKpiCycleRating,
  type AdminRecord,
} from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";

export function KpiCycleReviewPanel({
  mode,
  periodId,
  refreshKey,
  period,
}: {
  mode: "self" | "manager";
  periodId: string;
  refreshKey: number;
  period?: AdminRecord | null;
}) {
  const [reviews, setReviews] = React.useState<AdminRecord[]>([]);
  const [scores, setScores] = React.useState<AdminRecord[]>([]);
  const [rating, setRating] = React.useState<Record<string, string>>({});
  const [comment, setComment] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [actionErrors, setActionErrors] = React.useState<
    Record<string, string>
  >({});
  const acting = React.useRef(false);
  const { begin, invalidate, credential } = useWorkflowRequest(
    `${mode}:${periodId}:${refreshKey}`,
  );

  const load = React.useCallback(async () => {
    const { commit, current } = begin();
    void current;
    const accessToken =
      credential?.trim() || readStoredSessionTokens().accessToken.trim();
    if (!accessToken) {
      commit(() => setError("Sign in again to load cycle reviews."));
      commit(() => setLoading(false));
      return;
    }
    commit(() => setLoading(true));
    try {
      const [items, ownScores] = await Promise.all([
        listKpiCycleReviews(accessToken, mode, periodId || undefined),
        mode === "self"
          ? listMyKpiCycleScores(accessToken)
          : Promise.resolve([]),
      ]);
      commit(() => setReviews(items));
      commit(() => setScores(ownScores));
      commit(() => setError(""));
    } catch (cause) {
      commit(() =>
        setError(workflowFailure(cause, "Could not load cycle reviews.")),
      );
    } finally {
      commit(() => setLoading(false));
    }
  }, [begin, credential, mode, periodId]);
  React.useEffect(() => {
    void load();
    return invalidate;
  }, [load, refreshKey, invalidate]);

  const { begin: beginAction } = useWorkflowRequest(
    `${mode}:${periodId}:action:${JSON.stringify({ rating, comment })}`,
  );
  React.useEffect(() => {
    setBusy(null);
    acting.current = false;
    setActionErrors({});
  }, [mode, periodId, credential, beginAction]);
  const phase = readString(period ?? {}, ["kpiPhase", "kpi_phase"]);
  function reviewWindowOpen(kind: string) {
    return (
      !period ||
      phase === "REOPENED" ||
      (kind === "MID"
        ? ["MID_REVIEW", "IN_PROGRESS"].includes(phase)
        : phase === "FINAL_REVIEW")
    );
  }

  async function act(
    review: AdminRecord,
    action: "RATE" | "FINALIZE" | "ACKNOWLEDGE" | "DISPUTE",
  ) {
    const key = rowId(review);
    const kpiId = String(review.employeeKpiId ?? review.employee_kpi_id ?? "");
    const kindResult = z
      .enum(["MID", "FINAL"])
      .safeParse(readString(review, ["kind"]));
    if (!kindResult.success) {
      setActionErrors((current) => ({
        ...current,
        [key]:
          "This review has an invalid cycle stage. Refresh before continuing.",
      }));
      return;
    }
    const kind = kindResult.data;
    const text = comment[key] ?? "";
    if (text.length > 5000) {
      setActionErrors((current) => ({
        ...current,
        [key]: "Keep the review comment to 5,000 characters or fewer.",
      }));
      return;
    }
    const accessToken = readStoredSessionTokens().accessToken.trim();
    if (!accessToken || !kpiId) return;
    if (acting.current) return;
    if (["RATE", "FINALIZE"].includes(action) && !reviewWindowOpen(kind)) {
      setActionErrors((current) => ({
        ...current,
        [key]:
          "This review window is closed or unconfigured. Ask HR to open or reopen the cycle.",
      }));
      return;
    }
    if (action === "DISPUTE" && !text.trim()) {
      setActionErrors((current) => ({
        ...current,
        [key]: "Explain your disagreement before disputing this rating.",
      }));
      return;
    }
    const parsedRating = z
      .string()
      .min(1)
      .refine(
        (value) =>
          Number.isFinite(Number(value)) &&
          Number(value) >= 0 &&
          Number(value) <= 5,
        "Choose a rating from 0 to 5.",
      )
      .safeParse(rating[key] ?? "");
    if (action === "RATE" && !parsedRating.success) {
      setActionErrors((current) => ({
        ...current,
        [key]: "Choose a rating from 0 to 5.",
      }));
      return;
    }
    if (
      mode === "manager" &&
      action === "RATE" &&
      kind === "FINAL" &&
      !review.selfSubmittedAt &&
      !text.trim()
    ) {
      setActionErrors((current) => ({
        ...current,
        [key]:
          "Explain the manager rating when the employee has not submitted a self-rating.",
      }));
      return;
    }
    acting.current = true;
    const { current } = beginAction();
    setBusy(key);
    setActionErrors((previous) => ({ ...previous, [key]: "" }));
    try {
      if (action === "RATE") {
        if (!rating[key]) throw new Error("Choose a rating first.");
        await submitKpiCycleRating(
          accessToken,
          mode,
          kpiId,
          kind,
          Number(rating[key]),
          text,
        );
      } else if (action === "FINALIZE") {
        await finalizeKpiCycleReview(accessToken, kpiId, text);
      } else {
        await respondToKpiMidReview(accessToken, kpiId, action, text);
      }
      if (!current()) return;
      toast.success("KPI review updated.");
      await load();
    } catch (cause) {
      if (!current()) return;
      setActionErrors((previous) => ({
        ...previous,
        [key]: workflowFailure(cause, "Could not update review."),
      }));
    } finally {
      if (current()) {
        setBusy(null);
        acting.current = false;
      }
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Cycle reviews</h2>
        <p className="text-sm text-muted-foreground">
          Self ratings, manager feedback, and final scores for the selected
          cycle.
        </p>
      </div>
      <WorkflowGuide
        title="Mid-cycle and final review"
        unavailable={
          error ||
          (period && !phase
            ? "This period has no KPI review cycle configured. Ask HR to configure its review dates."
            : null)
        }
        steps={[
          "The employee submits a self-rating during the review window.",
          "The manager reviews the evidence and records a rating.",
          "For mid-cycle reviews, acknowledge or dispute with a comment.",
          "For final reviews, the manager finalizes the KPI score.",
        ]}
      />
      {mode === "self"
        ? scores
            .filter(
              (score) =>
                !periodId ||
                String(
                  score.performancePeriodId ?? score.performance_period_id,
                ) === periodId,
            )
            .map((score) => (
              <div
                className="border border-border bg-card p-3 text-sm"
                key={rowId(score)}
              >
                Cycle{" "}
                {String(
                  score.performancePeriodId ?? score.performance_period_id,
                )}{" "}
                · Final score{" "}
                {readString(score, [
                  "totalWeightedScore",
                  "total_weighted_score",
                ])}{" "}
                · {readString(score, ["finalRatingBand", "final_rating_band"])}{" "}
                · {readString(score, ["status"])}
              </div>
            ))
        : null}
      {loading ? (
        <p role="status">Loading cycle reviews…</p>
      ) : error ? null : !reviews.length ? (
        <p className="border border-border bg-card p-4 text-sm text-muted-foreground">
          No mid-cycle or final reviews are open yet.
        </p>
      ) : (
        reviews.map((review) => {
          const key = rowId(review);
          const kpi = asRecord(review.employeeKpi ?? review.employee_kpi);
          const kind = readString(review, ["kind"]);
          const status = readString(review, ["status"]);
          const canRate =
            status !== "FINALIZED" &&
            !review.managerSubmittedAt &&
            reviewWindowOpen(kind) &&
            (mode !== "manager" ||
              kind === "FINAL" ||
              Boolean(review.selfSubmittedAt));
          return (
            <div
              className="space-y-3 border border-border bg-card p-4"
              key={key}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {readString(
                      kpi ?? {},
                      ["title"],
                      `KPI #${String(review.employeeKpiId ?? "")}`,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {kind === "MID" ? "Mid-cycle" : "Final"} · {status} ·
                    Employee #
                    {String(review.employeeId ?? review.employee_id ?? "")}
                  </p>
                </div>
                <span className="text-sm">
                  Weighted score:{" "}
                  {readString(
                    review,
                    ["weightedScore", "weighted_score"],
                    "Pending",
                  )}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Self rating:{" "}
                {readString(review, ["selfRating", "self_rating"], "Pending")} ·
                Manager rating:{" "}
                {readString(
                  review,
                  ["managerRating", "manager_rating"],
                  "Pending",
                )}
              </p>
              {readString(review, ["managerComment", "manager_comment"]) ? (
                <p className="text-sm">
                  Manager:{" "}
                  {readString(review, ["managerComment", "manager_comment"])}
                </p>
              ) : null}
              {actionErrors[key] ? (
                <p role="alert" className="text-sm text-destructive">
                  {actionErrors[key]}
                </p>
              ) : null}
              {mode === "manager" &&
              kind === "MID" &&
              !review.selfSubmittedAt ? (
                <p className="text-sm text-muted-foreground">
                  Waiting for the employee self-rating. The manager review
                  follows that step.
                </p>
              ) : null}
              {!reviewWindowOpen(kind) && status !== "FINALIZED" ? (
                <p className="text-sm text-muted-foreground">
                  The review window is closed. Ask HR to check or reopen this
                  cycle.
                </p>
              ) : null}
              {canRate ? (
                <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
                  <FluentSelect
                    ariaLabel="Review rating"
                    disabled={busy !== null}
                    value={rating[key] ?? ""}
                    onChange={(value) =>
                      setRating((current) => ({ ...current, [key]: value }))
                    }
                    options={[
                      { value: "", label: "Choose rating" },
                      ...[0, 1, 2, 3, 4, 5].map((value) => ({
                        value: String(value),
                        label: String(value),
                      })),
                    ]}
                  />
                  <Textarea
                    aria-label="Review comment"
                    disabled={busy !== null}
                    placeholder="Comment"
                    value={comment[key] ?? ""}
                    onChange={(event) =>
                      setComment((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className={primaryButtonClass}
                    disabled={busy !== null}
                    onClick={() => void act(review, "RATE")}
                  >
                    Submit rating
                  </button>
                </div>
              ) : null}
              {mode === "self" &&
              kind === "MID" &&
              status === "MANAGER_SUBMITTED" ? (
                <div className="flex flex-wrap gap-2">
                  <Textarea
                    aria-label="Acknowledgement or dispute comment"
                    disabled={busy !== null}
                    placeholder="Explain your disagreement before disputing"
                    value={comment[key] ?? ""}
                    onChange={(event) =>
                      setComment((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className={actionButtonClass}
                    disabled={busy !== null}
                    onClick={() => void act(review, "ACKNOWLEDGE")}
                  >
                    Acknowledge
                  </button>
                  <button
                    className={actionButtonClass}
                    disabled={busy !== null}
                    onClick={() => void act(review, "DISPUTE")}
                  >
                    Dispute with comment
                  </button>
                </div>
              ) : null}
              {mode === "manager" &&
              kind === "FINAL" &&
              status === "MANAGER_SUBMITTED" &&
              reviewWindowOpen(kind) ? (
                <button
                  className={primaryButtonClass}
                  disabled={busy !== null}
                  onClick={() => void act(review, "FINALIZE")}
                >
                  Finalize KPI
                </button>
              ) : null}
            </div>
          );
        })
      )}
    </section>
  );
}
