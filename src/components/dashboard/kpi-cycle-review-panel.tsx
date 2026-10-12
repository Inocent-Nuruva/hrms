"use client";

import * as React from "react";
import { FluentSelect } from "@/components/ui/fluent-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/fluent-toast-store";
import { actionButtonClass, asRecord, primaryButtonClass, readString, rowId } from "@/components/dashboard/talent-visuals";
import { finalizeKpiCycleReview, listKpiCycleReviews, listMyKpiCycleScores, respondToKpiMidReview, submitKpiCycleRating, type AdminRecord } from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";

export function KpiCycleReviewPanel({ mode, periodId, refreshKey }: { mode: "self" | "manager"; periodId: string; refreshKey: number }) {
  const [reviews, setReviews] = React.useState<AdminRecord[]>([]);
  const [scores, setScores] = React.useState<AdminRecord[]>([]);
  const [rating, setRating] = React.useState<Record<string, string>>({});
  const [comment, setComment] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    const accessToken = readStoredSessionTokens().accessToken.trim();
    if (!accessToken) return;
    try {
      const [items, ownScores] = await Promise.all([
        listKpiCycleReviews(accessToken, mode, periodId || undefined),
        mode === "self" ? listMyKpiCycleScores(accessToken) : Promise.resolve([]),
      ]);
      setReviews(items);
      setScores(ownScores);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load cycle reviews.");
    }
  }, [mode, periodId]);
  React.useEffect(() => { void load(); }, [load, refreshKey]);

  async function act(review: AdminRecord, action: "RATE" | "FINALIZE" | "ACKNOWLEDGE" | "DISPUTE") {
    const key = rowId(review);
    const kpiId = String(review.employeeKpiId ?? review.employee_kpi_id ?? "");
    const kind = readString(review, ["kind"]) as "MID" | "FINAL";
    const text = comment[key] ?? "";
    const accessToken = readStoredSessionTokens().accessToken.trim();
    if (!accessToken || !kpiId) return;
    setBusy(key);
    try {
      if (action === "RATE") {
        if (!rating[key]) throw new Error("Choose a rating first.");
        await submitKpiCycleRating(accessToken, mode, kpiId, kind, Number(rating[key]), text);
      } else if (action === "FINALIZE") {
        await finalizeKpiCycleReview(accessToken, kpiId, text);
      } else {
        await respondToKpiMidReview(accessToken, kpiId, action, text);
      }
      toast.success("KPI review updated.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update review.");
    } finally { setBusy(null); }
  }

  return <section className="space-y-3">
    <div><h2 className="text-lg font-semibold">Cycle reviews</h2><p className="text-sm text-muted-foreground">Self ratings, manager feedback, and final scores for the selected cycle.</p></div>
    {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    {mode === "self" ? scores.filter((score) => !periodId || String(score.performancePeriodId ?? score.performance_period_id) === periodId).map((score) => <div className="border border-border bg-card p-3 text-sm" key={rowId(score)}>Cycle {String(score.performancePeriodId ?? score.performance_period_id)} · Final score {readString(score, ["totalWeightedScore", "total_weighted_score"])} · {readString(score, ["finalRatingBand", "final_rating_band"])} · {readString(score, ["status"])}</div>) : null}
    {!reviews.length ? <p className="border border-border bg-card p-4 text-sm text-muted-foreground">No mid-cycle or final reviews are open yet.</p> : reviews.map((review) => {
      const key = rowId(review);
      const kpi = asRecord(review.employeeKpi ?? review.employee_kpi);
      const kind = readString(review, ["kind"]);
      const status = readString(review, ["status"]);
      const canRate = status !== "FINALIZED" && (mode === "manager" ? !review.managerSubmittedAt : !review.managerSubmittedAt);
      return <div className="space-y-3 border border-border bg-card p-4" key={key}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{readString(kpi ?? {}, ["title"], `KPI #${String(review.employeeKpiId ?? "")}`)}</p><p className="text-xs text-muted-foreground">{kind === "MID" ? "Mid-cycle" : "Final"} · {status} · Employee #{String(review.employeeId ?? review.employee_id ?? "")}</p></div><span className="text-sm">Weighted score: {readString(review, ["weightedScore", "weighted_score"], "Pending")}</span></div>
        <p className="text-sm text-muted-foreground">Self rating: {readString(review, ["selfRating", "self_rating"], "Pending")} · Manager rating: {readString(review, ["managerRating", "manager_rating"], "Pending")}</p>
        {readString(review, ["managerComment", "manager_comment"]) ? <p className="text-sm">Manager: {readString(review, ["managerComment", "manager_comment"])}</p> : null}
        {canRate ? <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]"><FluentSelect ariaLabel="Review rating" value={rating[key] ?? ""} onChange={(value) => setRating((current) => ({ ...current, [key]: value }))} options={[{ value: "", label: "Choose rating" }, ...[0,1,2,3,4,5].map((value) => ({ value: String(value), label: String(value) }))]} /><Textarea aria-label="Review comment" placeholder="Comment" value={comment[key] ?? ""} onChange={(event) => setComment((current) => ({ ...current, [key]: event.target.value }))} /><button className={primaryButtonClass} disabled={busy === key} onClick={() => void act(review, "RATE")}>Submit rating</button></div> : null}
        {mode === "self" && kind === "MID" && status === "MANAGER_SUBMITTED" ? <div className="flex gap-2"><button className={actionButtonClass} disabled={busy === key} onClick={() => void act(review, "ACKNOWLEDGE")}>Acknowledge</button><button className={actionButtonClass} disabled={busy === key} onClick={() => void act(review, "DISPUTE")}>Dispute with comment</button></div> : null}
        {mode === "manager" && kind === "FINAL" && status === "MANAGER_SUBMITTED" ? <button className={primaryButtonClass} disabled={busy === key} onClick={() => void act(review, "FINALIZE")}>Finalize KPI</button> : null}
      </div>;
    })}
  </section>;
}
