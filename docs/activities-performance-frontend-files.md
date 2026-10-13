# Activities and Performance: complete frontend replacement files

These are the complete current files, ready to copy to their exact absolute paths. Existing functions and UI outside the changes are included without omissions.

## File index

- [/home/innocent/systems/hrms/src/components/dashboard/kpi-cycle-review-panel.tsx](/home/innocent/systems/hrms/src/components/dashboard/kpi-cycle-review-panel.tsx)
- [/home/innocent/systems/hrms/src/components/dashboard/activity-operations-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/activity-operations-view.tsx)
- [/home/innocent/systems/hrms/src/components/dashboard/employee-kpi-workspace.tsx](/home/innocent/systems/hrms/src/components/dashboard/employee-kpi-workspace.tsx)
- [/home/innocent/systems/hrms/src/components/dashboard/activity-task-workspace.tsx](/home/innocent/systems/hrms/src/components/dashboard/activity-task-workspace.tsx)
- [/home/innocent/systems/hrms/src/components/dashboard/performance-management-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/performance-management-view.tsx)
- [/home/innocent/systems/hrms/src/components/dashboard/activity-self-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/activity-self-view.tsx)
- [/home/innocent/systems/hrms/src/components/dashboard/performance-self-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/performance-self-view.tsx)
- [/home/innocent/systems/hrms/src/components/dashboard/validated-workflow-form.tsx](/home/innocent/systems/hrms/src/components/dashboard/validated-workflow-form.tsx)
- [/home/innocent/systems/hrms/src/components/dashboard/validated-workflow-form.test.tsx](/home/innocent/systems/hrms/src/components/dashboard/validated-workflow-form.test.tsx)
- [/home/innocent/systems/hrms/src/components/dashboard/workflow-guide.tsx](/home/innocent/systems/hrms/src/components/dashboard/workflow-guide.tsx)
- [/home/innocent/systems/hrms/src/hooks/use-workflow-request.ts](/home/innocent/systems/hrms/src/hooks/use-workflow-request.ts)
- [/home/innocent/systems/hrms/src/lib/workflow-schemas.ts](/home/innocent/systems/hrms/src/lib/workflow-schemas.ts)
- [/home/innocent/systems/hrms/src/lib/workflow-schemas.test.ts](/home/innocent/systems/hrms/src/lib/workflow-schemas.test.ts)
- [/home/innocent/systems/hrms/src/lib/workflow-error.ts](/home/innocent/systems/hrms/src/lib/workflow-error.ts)
- [/home/innocent/systems/hrms/src/components/dashboard/activity-evidence-picker.tsx](/home/innocent/systems/hrms/src/components/dashboard/activity-evidence-picker.tsx)
- [/home/innocent/systems/hrms/src/components/dashboard/activity-evidence-picker.test.tsx](/home/innocent/systems/hrms/src/components/dashboard/activity-evidence-picker.test.tsx)

## /home/innocent/systems/hrms/src/components/dashboard/kpi-cycle-review-panel.tsx

```tsx
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
```

## /home/innocent/systems/hrms/src/components/dashboard/activity-operations-view.tsx

```tsx
"use client";

import { WorkflowGuide } from "@/components/dashboard/workflow-guide";
import { ValidatedWorkflowForm } from "@/components/dashboard/validated-workflow-form";
import { activityFormSchema } from "@/lib/workflow-schemas";
import { workflowFailure } from "@/lib/workflow-error";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import * as React from "react";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store";

import { SearchToggleField } from "@/components/common/search-toggle-field";
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared";
import {
  HeroBand,
  MetricTile,
  StatusChip,
  StatusStack,
  TalentDoodleSprites,
  actionButtonClass,
  employeeLabel,
  formatDate,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  statusChartItems,
  textareaClass,
} from "@/components/dashboard/talent-visuals";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  createActivityCategory,
  createActivityPolicy,
  deactivateActivityCategory,
  updateActivityCategory,
  updateActivityPolicy,
  getManagerActivitiesDashboard,
  getManagerActivityReport,
  listActivityCategories,
  listActivityPolicies,
  listHrActivities,
  listHrActivityExceptions,
  listManagerPendingActivityReviews,
  listManagerTeamActivities,
  reviewManagerActivityReport,
  type AdminRecord,
} from "@/lib/admin-api";
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions";
import { useForbiddenRouteGuard } from "@/hooks/use-forbidden-route-guard";
import { readStoredSessionTokens } from "@/lib/session-client";
import { FluentSelect } from "@/components/ui/fluent-select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";

export type ActivityOpsTab =
  | "overview"
  | "reports"
  | "reviews"
  | "exceptions"
  | "setup";

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

export function ActivityOperationsView({
  activeTab,
}: {
  activeTab: ActivityOpsTab;
}) {
  const actor = useDashboardActor();
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute(
      `/dashboard/activities/${activeTab}`,
      actor.permissionLabels,
      actor.accessMode,
    );
  useForbiddenRouteGuard(canAccess);

  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null);
  const [reports, setReports] = React.useState<AdminRecord[]>([]);
  const [teamReports, setTeamReports] = React.useState<AdminRecord[]>([]);
  const [pending, setPending] = React.useState<AdminRecord[]>([]);
  const [exceptions, setExceptions] = React.useState<AdminRecord[]>([]);
  const [categories, setCategories] = React.useState<AdminRecord[]>([]);
  const [policies, setPolicies] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [detail, setDetail] = React.useState<AdminRecord | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<
    "review" | "category" | "policy"
  >("review");
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [setupKind, setSetupKind] = React.useState<"categories" | "policies">(
    "categories",
  );

  const { begin, invalidate, credential } = useWorkflowRequest(activeTab);

  const load = React.useCallback(async () => {
    const { commit, current } = begin();
    void current;
    const token = credential?.trim() || readStoredToken();
    if (!token) {
      commit(() => setError("Authentication required. Please log in again."));
      commit(() => setLoading(false));
      return;
    }
    commit(() => setLoading(true));
    commit(() => setError(null));
    const tasks: Array<Promise<unknown>> = [];
    if (activeTab === "overview") {
      tasks.push(
        getManagerActivitiesDashboard(token).then((value) =>
          commit(() => setDashboard(value)),
        ),
        listHrActivities(token, { limit: 50 }).then((value) =>
          commit(() => setReports(value)),
        ),
        listManagerPendingActivityReviews(token, { limit: 20 }).then((value) =>
          commit(() => setPending(value)),
        ),
      );
    }
    if (activeTab === "reports") {
      tasks.push(
        listHrActivities(token, { limit: 50 }).then((value) =>
          commit(() => setReports(value)),
        ),
        listManagerTeamActivities(token, { limit: 50 }).then((value) =>
          commit(() => setTeamReports(value)),
        ),
      );
    }
    if (activeTab === "reviews") {
      tasks.push(
        listManagerPendingActivityReviews(token, { limit: 50 })
          .then((value) => commit(() => setPending(value)))
          .catch((errorObject) => {
            commit(() => setPending([]));
            throw errorObject;
          }),
      );
    }
    if (activeTab === "exceptions") {
      tasks.push(
        listHrActivityExceptions(token, { limit: 50 })
          .then((value) => commit(() => setExceptions(value)))
          .catch((errorObject) => {
            commit(() => setExceptions([]));
            throw errorObject;
          }),
      );
    }
    if (activeTab === "setup") {
      tasks.push(
        listActivityCategories(token).then((value) =>
          commit(() => setCategories(value)),
        ),
        listActivityPolicies(token).then((value) =>
          commit(() => setPolicies(value)),
        ),
      );
    }
    const results = await Promise.allSettled(tasks);
    const first = results.find((result) => result.status === "rejected");
    if (first && first.status === "rejected") {
      commit(() =>
        setError(
          workflowFailure(first.reason, "Could not load activity data."),
        ),
      );
    }
    commit(() => setLoading(false));
  }, [begin, credential, activeTab]);

  React.useEffect(() => {
    if (!canAccess) return;
    void load();
    return invalidate;
  }, [canAccess, load, invalidate]);

  const reportRows = [
    ...new Map(
      [...reports, ...teamReports].map((report) => [rowId(report), report]),
    ).values(),
  ];
  const rows =
    activeTab === "reviews"
      ? pending
      : activeTab === "exceptions"
        ? exceptions
        : activeTab === "setup"
          ? setupKind === "policies"
            ? policies
            : categories
          : reportRows;
  const visible = rows.filter(
    (row) =>
      !search ||
      JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );

  const { begin: beginMutation } = useWorkflowRequest(
    `${activeTab}:${JSON.stringify(form)}`,
  );
  React.useEffect(() => {
    setSaving(false);
  }, [credential, activeTab, beginMutation]);

  async function onSave() {
    const validationResult = activityFormSchema(createMode).safeParse(form);
    if (!validationResult.success) {
      setFormError(
        validationResult.error.issues
          .map(
            (issue) => issue.path.map(String).join(".") + ": " + issue.message,
          )
          .join("; "),
      );
      return;
    }
    if (saving) return;
    const token = readStoredToken();
    if (!token) return;
    const { current: isMutationCurrent } = beginMutation();
    setSaving(true);
    setFormError(null);
    try {
      if (createMode === "review") {
        if (!form.id || !form.decision || !form.comments)
          throw new Error("Decision and comments are required.");
        await reviewManagerActivityReport(token, form.id, {
          decision: form.decision,
          comments: form.comments,
          rating: form.rating || undefined,
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "category") {
        if (!form.code || !form.name)
          throw new Error("Code and name are required.");
        const payload = {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          requires_time: form.requires_time === "true",
          requires_outcome: form.requires_outcome === "true",
          is_field_activity: form.is_field_activity === "true",
        };
        if (form.id) await updateActivityCategory(token, form.id, payload);
        if (!isMutationCurrent()) return;
        else await createActivityCategory(token, payload);
        if (!isMutationCurrent()) return;
      } else {
        if (!form.effective_from && !form.id)
          throw new Error("Effective from is required.");
        const payload = {
          effective_from: form.effective_from || undefined,
          daily_submission_required: form.daily_submission_required !== "false",
          manager_review_required: form.manager_review_required !== "false",
          minimum_activity_count: form.minimum_activity_count
            ? Number(form.minimum_activity_count)
            : undefined,
        };
        if (form.id) await updateActivityPolicy(token, form.id, payload);
        if (!isMutationCurrent()) return;
        else await createActivityPolicy(token, payload);
        if (!isMutationCurrent()) return;
      }
      toast.success("Saved.");
      setCreateOpen(false);
      await load();
      if (!isMutationCurrent()) return;
    } catch (errorObject) {
      if (!isMutationCurrent()) return;
      setFormError(
        errorObject instanceof Error ? errorObject.message : "Could not save.",
      );
    } finally {
      if (isMutationCurrent()) setSaving(false);
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "setup") {
      return [
        { key: "name", label: "Name", render: (row) => optionLabel(row) },
        {
          key: "code",
          label: "Code",
          render: (row) => readString(row, ["code"], "—"),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "ACTIVE")} />
          ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  setCreateMode(
                    setupKind === "policies" ? "policy" : "category",
                  );
                  setForm({
                    id: rowId(row),
                    code: readString(row, ["code"]),
                    name: readString(row, ["name"]),
                    description: readString(row, ["description"]),
                    effective_from: readString(row, [
                      "effectiveFrom",
                      "effective_from",
                    ]),
                  });
                  setCreateOpen(true);
                }}
              >
                Edit
              </button>
              {setupKind === "categories" ? (
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    const token = readStoredToken();
                    const id = rowId(row);
                    if (!token || !id) return;
                    void deactivateActivityCategory(token, id)
                      .then(() => {
                        toast.success("Deactivated.");
                        return load();
                      })
                      .catch((errorObject) =>
                        toast.error(
                          errorObject instanceof Error
                            ? errorObject.message
                            : "Could not deactivate.",
                        ),
                      );
                  }}
                >
                  Deactivate
                </button>
              ) : null}
            </div>
          ),
        },
      ];
    }
    if (activeTab === "exceptions") {
      return [
        {
          key: "employee",
          label: "Employee",
          render: (row) => employeeLabel(row),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "date",
          label: "Date",
          render: (row) =>
            formatDate(row.activityDate ?? row.activity_date ?? row.date),
        },
        {
          key: "reason",
          label: "Reason",
          render: (row) =>
            readString(
              row,
              ["reason", "exceptionType", "exception_type", "message"],
              "—",
            ),
        },
      ];
    }
    return [
      {
        key: "report",
        label: "Report",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">{employeeLabel(row)}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(row.activityDate ?? row.activity_date)}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <StatusChip value={readString(row, ["status"], "DRAFT")} />
        ),
      },
      {
        key: "entries",
        label: "Entries",
        render: (row) =>
          String(
            readNumber(row, ["entryCount", "entry_count", "entries_count"]) ??
              "—",
          ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <button
            type="button"
            className={actionButtonClass}
            onClick={(event) => {
              event.stopPropagation();
              setCreateMode("review");
              setForm({ id: rowId(row), decision: "APPROVE", comments: "" });
              setCreateOpen(true);
            }}
          >
            Review
          </button>
        ),
      },
    ];
  }, [activeTab, load, setupKind]);

  if (!canAccess)
    return (
      <WorkflowGuide
        title="Activities management"
        steps={[]}
        unavailable={
          actor.ready
            ? "Your account does not have access to this workflow. Ask your administrator for the required module permissions."
            : "Preparing your access permissions…"
        }
      />
    );

  if (loading && !createOpen)
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <FluentLoadingIndicator />
        <p role="status">
          Loading this workflow and checking its available actions…
        </p>
      </section>
    );

  if (error && !loading && !createOpen)
    return (
      <section className="flex flex-col gap-4">
        <WorkflowGuide
          title="This workflow needs attention"
          unavailable={error}
          steps={[
            "Resolve the permission, setup, or network issue described above.",
            "Reload this view before continuing.",
          ]}
        />
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => void load()}
        >
          Reload workflow
        </button>
      </section>
    );

  return (
    <section className="space-y-4">
      <WorkflowGuide
        title="Activities management"
        steps={[
          "Configure activity categories and policies in Setup.",
          "Employees create work and submit their daily reports.",
          "Managers approve, return for correction, or reject submitted reports.",
          "Use Exceptions to resolve processing issues.",
        ]}
        unavailable={error}
      />
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="Activities"
            title="Daily activity operations"
            description="Team reports, pending manager reviews, and exceptions — shown only if you have the grant."
            actions={
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : (
                  <RefreshCwIcon className="size-4" />
                )}
                Refresh
              </button>
            }
          />
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Reports"
              value={
                readNumber(dashboard, ["reports", "total", "count"]) ??
                reports.length
              }
            />
            <MetricTile
              label="Pending reviews"
              value={
                readNumber(dashboard, ["pending_reviews", "pendingReviews"]) ??
                pending.length
              }
            />
            <MetricTile
              label="Submitted"
              value={
                readNumber(dashboard, ["submitted", "submittedCount"]) ?? "—"
              }
            />
            <MetricTile
              label="Exceptions"
              value={
                readNumber(dashboard, ["exceptions", "exceptionCount"]) ?? "—"
              }
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Report mix</h2>
            <div className="mt-4">
              <StatusStack
                items={statusChartItems(reports.length > 0 ? reports : pending)}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "reports"
                ? "Activity reports"
                : activeTab === "reviews"
                  ? "Pending reviews"
                  : activeTab === "exceptions"
                    ? "Activity exceptions"
                    : "Activity setup"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "setup"
                ? "Categories and policies used by daily reports."
                : "Review and operate on activity records you are allowed to see."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              Refresh
            </button>
            {activeTab === "setup" ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  setCreateMode(
                    setupKind === "policies" ? "policy" : "category",
                  );
                  setForm({});
                  setCreateOpen(true);
                }}
              >
                <PlusIcon className="size-4" /> New
              </button>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === "setup" ? (
        <div className="flex flex-wrap gap-1.5">
          {(["categories", "policies"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setSetupKind(kind)}
              className={
                setupKind === kind
                  ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold !text-white"
                  : "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
              }
            >
              {prettify(kind)}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          <SearchToggleField
            value={search}
            onChange={setSearch}
            placeholder="Search"
          />
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Activity records"
              data={visible}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey={`activities-${activeTab}-${setupKind}`}
              onRowSelect={(_, row) => {
                if (!row) return;
                setDetail(row);
                const token = readStoredToken();
                const id = rowId(row);
                if (
                  token &&
                  id &&
                  (activeTab === "reports" || activeTab === "reviews")
                ) {
                  void getManagerActivityReport(token, id)
                    .then((record) => record && setDetail(record))
                    .catch(() => undefined);
                }
              }}
            />
          </div>
        </div>
      ) : null}

      <RecordDetailsDialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
        title={optionLabel(detail) || employeeLabel(detail)}
        row={detail}
      />

      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          if (!saving) setCreateOpen(next);
        }}
      >
        <DialogPopup
          from="bottom"
          className="flex max-h-[calc(100dvh-0.75rem)] w-[calc(100%-0.75rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(90dvh,42rem)] sm:w-[calc(100%-2rem)]"
        >
          <DialogHeader className="m-0 shrink-0 border-b border-border px-4 py-4 pr-12 sm:px-5">
            <DialogTitle>
              {createMode === "review"
                ? "Review report"
                : createMode === "policy"
                  ? "Activity policy"
                  : "Activity category"}
            </DialogTitle>
            <DialogDescription>
              Save this activity setup item.
            </DialogDescription>
          </DialogHeader>
          <ValidatedWorkflowForm
            key={createMode}
            saving={saving}
            submitError={formError}
            onSubmit={onSave}
            validation={{ schema: activityFormSchema(createMode), input: form }}
            description="Saving categories or policies configures future work. Reviewing a report moves it to the chosen decision."
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <div className="grid gap-3">
                {createMode === "review" ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Decision</span>
                      <FluentSelect
                        ariaLabel="Decision"
                        value={form.decision ?? "APPROVE"}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            decision: value,
                          }))
                        }
                        options={[
                          { value: "APPROVE", label: "Approve" },
                          { value: "RETURN", label: "Return" },
                          { value: "REJECT", label: "Reject" },
                        ]}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Rating</span>
                      <input
                        className={inputClass}
                        value={form.rating ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            rating: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Comments</span>
                      <Textarea
                        className={textareaClass}
                        value={form.comments ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            comments: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                ) : null}
                {createMode === "category" ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Code</span>
                      <input
                        className={inputClass}
                        value={form.code ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            code: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Name</span>
                      <input
                        className={inputClass}
                        value={form.name ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Description</span>
                      <Textarea
                        className={textareaClass}
                        value={form.description ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                ) : null}
                {createMode === "policy" ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Effective from</span>
                      <DateInput
                        className={inputClass}
                        value={form.effective_from ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            effective_from: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Minimum activities</span>
                      <input
                        type="number"
                        className={inputClass}
                        value={form.minimum_activity_count ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            minimum_activity_count: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                ) : null}
                {formError ? (
                  <p className="text-sm text-rose-600">{formError}</p>
                ) : null}
              </div>
            </div>
          </ValidatedWorkflowForm>
          <DialogFooter className="m-0 shrink-0 border-t border-border bg-background px-4 py-3 sm:px-5">
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
```

## /home/innocent/systems/hrms/src/components/dashboard/employee-kpi-workspace.tsx

```tsx
"use client";

import { WorkflowGuide } from "@/components/dashboard/workflow-guide";
import { ValidatedWorkflowForm } from "@/components/dashboard/validated-workflow-form";
import { employeeKpiFormSchema } from "@/lib/workflow-schemas";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import * as React from "react";
import Link from "next/link";
import {
  Badge,
  Button as FluentButton,
  Input as FluentInput,
  ProgressBar,
} from "@fluentui/react-components";
import {
  CheckIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import {
  Filter24Regular,
  Search20Regular,
  Target20Regular as KpiIcon,
} from "@fluentui/react-icons";
import { toast } from "@/components/ui/fluent-toast-store";

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { FluentSelect } from "@/components/ui/fluent-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";
import {
  StatusChip,
  actionButtonClass,
  asRecord,
  employeeLabel,
  formatDate,
  inputClass,
  isPermissionError,
  optionLabel,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals";
import {
  createMyEmployeeKpi,
  createManagerEmployeeKpi,
  deleteMyEmployeeKpi,
  listManagerEmployeeKpis,
  listManagerKpiAssignees,
  listPerformancePeriods,
  listMyEmployeeKpis,
  listMyPerformanceAssignments,
  beginManagerEmployeeKpiReview,
  reviewManagerEmployeeKpi,
  submitMyEmployeeKpis,
  updateMyEmployeeKpi,
  updateMyEmployeeKpiActual,
  type AdminRecord,
} from "@/lib/admin-api";
import {
  canProposeEmployeeKpis,
  collectEmployeeKpiPeriods,
  employeeKpiPeriodId,
  firstWritableEmployeeKpiPeriod,
} from "@/lib/employee-kpi-periods";
import { forgetForbiddenRoute } from "@/lib/forbidden-routes";
import { readStoredSessionTokens } from "@/lib/session-client";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { KpiCycleReviewPanel } from "@/components/dashboard/kpi-cycle-review-panel";
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions";

type WorkspaceMode = "self" | "manager";
type DialogMode = "create" | "edit" | "actual" | "review";

function token() {
  return readStoredSessionTokens().accessToken.trim();
}

function periodOf(row: AdminRecord) {
  return asRecord(row.performancePeriod ?? row.performance_period);
}

function progressOf(row: AdminRecord) {
  return asRecord(row.progress);
}

export function EmployeeKpiWorkspace({ mode }: { mode: WorkspaceMode }) {
  const actor = useDashboardActor();
  const canManagePerformance = canAccessDashboardRoute(
    "/dashboard/performance/setup",
    actor.permissionLabels,
    actor.accessMode,
  );
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [periods, setPeriods] = React.useState<AdminRecord[]>([]);
  const [employees, setEmployees] = React.useState<AdminRecord[]>([]);
  const [periodId, setPeriodId] = React.useState("");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [reviewRefresh, setReviewRefresh] = React.useState(0);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("create");
  const [selected, setSelected] = React.useState<AdminRecord | null>(null);
  const [form, setForm] = React.useState<Record<string, string>>({
    measurement_type: "PERCENTAGE",
    progress_source: "MANUAL",
  });

  const { begin, invalidate, credential } = useWorkflowRequest(mode);

  const load = React.useCallback(async () => {
    const { commit, current } = begin();
    void current;
    const accessToken = credential?.trim() || token();
    if (!accessToken) {
      commit(() => setError("Authentication required. Please log in again."));
      commit(() => setLoading(false));
      return;
    }
    commit(() => setLoading(true));
    commit(() => setError(null));
    try {
      if (mode === "manager") {
        const [kpis, team, availablePeriods] = await Promise.all([
          listManagerEmployeeKpis(accessToken, { limit: 100 }),
          listManagerKpiAssignees(accessToken),
          listPerformancePeriods(accessToken),
        ]);
        commit(() => setRows(kpis));
        commit(() => setEmployees(team));
        commit(() =>
          setPeriods(availablePeriods.filter(canProposeEmployeeKpis)),
        );
      } else {
        const [kpis, assignments] = await Promise.all([
          listMyEmployeeKpis(accessToken),
          listMyPerformanceAssignments(accessToken),
        ]);
        const allPeriods = collectEmployeeKpiPeriods([...assignments, ...kpis]);
        commit(() => setRows(kpis));
        commit(() => setPeriods(allPeriods));
        const writablePeriod = firstWritableEmployeeKpiPeriod(allPeriods);
        commit(() =>
          setPeriodId(
            (current) =>
              current ||
              employeeKpiPeriodId(writablePeriod) ||
              employeeKpiPeriodId(allPeriods[0]) ||
              "",
          ),
        );
      }
    } catch (cause) {
      commit(() =>
        setError(
          isPermissionError(cause)
            ? "Your account does not have permission to view this KPI workflow. Ask an administrator to grant the required performance KPI permissions."
            : cause instanceof Error
              ? cause.message
              : "Could not load KPIs.",
        ),
      );
    } finally {
      commit(() => setLoading(false));
      commit(() => setReviewRefresh((current) => current + 1));
    }
  }, [begin, credential, mode]);

  React.useEffect(() => {
    forgetForbiddenRoute("/dashboard/me/performance/kpis");
  }, []);

  React.useEffect(() => {
    void load();
    return invalidate;
  }, [load, invalidate]);

  const visibleRows = React.useMemo(
    () =>
      periodId
        ? rows.filter(
            (row) =>
              String(
                readNumber(row, [
                  "performancePeriodId",
                  "performance_period_id",
                ]) ?? "",
              ) === periodId,
          )
        : rows,
    [periodId, rows],
  );
  const displayedRows = React.useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    if (!query) return visibleRows;
    return visibleRows.filter((row) =>
      [
        readString(row, ["title"]),
        readString(row, ["description"]),
        readString(row, ["status"]),
        readString(row, ["unit"]),
      ].some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }, [searchTerm, visibleRows]);
  const totalWeight = visibleRows
    .filter((row) => readString(row, ["status"]) !== "REJECTED")
    .reduce((sum, row) => sum + (readNumber(row, ["weight"]) ?? 0), 0);
  const overallScore = visibleRows.reduce(
    (sum, row) =>
      sum +
      (readNumber(progressOf(row), [
        "weightedContribution",
        "weighted_contribution",
      ]) ?? 0),
    0,
  );

  const selectedPeriod =
    periods.find((period) => employeeKpiPeriodId(period) === periodId) ?? null;
  const writablePeriod =
    (canProposeEmployeeKpis(selectedPeriod) ? selectedPeriod : null) ??
    firstWritableEmployeeKpiPeriod(periods);
  const canCreateKpi = Boolean(writablePeriod);
  const unavailableReason =
    periods.length === 0
      ? "No performance period is linked to your KPI workspace yet. Performance management must open a cycle and assign your performance plan before you can propose KPIs."
      : "None of your assigned performance periods is accepting KPI proposals right now.";

  function showCreate() {
    const nextPeriodId =
      mode === "manager"
        ? employeeKpiPeriodId(periods[0])
        : employeeKpiPeriodId(writablePeriod) || periodId;
    if (nextPeriodId && nextPeriodId !== periodId) {
      setPeriodId(nextPeriodId);
    }
    setSelected(null);
    setDialogMode("create");
    setForm({
      performance_period_id: nextPeriodId,
      employee_id: "",
      measurement_type: "PERCENTAGE",
      progress_source: "MANUAL",
      scoring_type: "NUMERIC_TARGET",
      measurement_direction: "HIGHER_IS_BETTER",
      weight: "",
      target_value: "",
      start_date: "",
      due_date: "",
      unit: "%",
    });
    setOpen(true);
  }

  function showEdit(row: AdminRecord) {
    setSelected(row);
    setDialogMode("edit");
    setForm({
      title: readString(row, ["title"]),
      description: readString(row, ["description"]),
      measurement_type: readString(
        row,
        ["measurementType", "measurement_type"],
        "PERCENTAGE",
      ),
      target_value: readString(row, ["targetValue", "target_value"]),
      unit: readString(row, ["unit"]),
      weight: readString(row, ["weight"]),
      start_date: readString(row, ["startDate", "start_date"]),
      due_date: readString(row, ["dueDate", "due_date"]),
      progress_source: readString(
        row,
        ["progressSource", "progress_source"],
        "MANUAL",
      ),
      scoring_type: readString(
        row,
        ["scoringType", "scoring_type"],
        "NUMERIC_TARGET",
      ),
      measurement_direction: readString(
        row,
        ["measurementDirection", "measurement_direction"],
        "HIGHER_IS_BETTER",
      ),
    });
    setOpen(true);
  }

  function showActual(row: AdminRecord) {
    setSelected(row);
    setDialogMode("actual");
    setForm({ actual_value: readString(row, ["actualValue", "actual_value"]) });
    setOpen(true);
  }

  function showReview(
    row: AdminRecord,
    decision: "APPROVE" | "RETURN" | "REJECT",
  ) {
    setSelected(row);
    setDialogMode("review");
    setForm({ decision, comment: "" });
    setOpen(true);
  }

  const beginReview = React.useCallback(
    async (row: AdminRecord) => {
      const accessToken = token();
      const id = rowId(row);
      if (!accessToken || !id) return;
      setSaving(true);
      try {
        await beginManagerEmployeeKpiReview(accessToken, id);
        toast.success("KPI review started.");
        await load();
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Could not start KPI review.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const formPeriod = periods.find(
    (period) =>
      employeeKpiPeriodId(period) === (form.performance_period_id || periodId),
  );
  const kpiFormInput = {
    ...form,
    performance_period_id: form.performance_period_id || periodId,
    period_start_date: readString(formPeriod ?? {}, [
      "startDate",
      "start_date",
    ]),
    period_end_date: readString(formPeriod ?? {}, ["endDate", "end_date"]),
  };

  const { begin: beginMutation } = useWorkflowRequest(
    `${mode}:${JSON.stringify(kpiFormInput)}`,
  );
  React.useEffect(() => {
    setSaving(false);
  }, [credential, mode, beginMutation]);

  async function save() {
    const validationResult = employeeKpiFormSchema(
      dialogMode,
      mode === "manager",
    ).safeParse(kpiFormInput);
    if (!validationResult.success) {
      setFormError(
        validationResult.error.issues
          .map(
            (issue) => issue.path.map(String).join(".") + ": " + issue.message,
          )
          .join("; "),
      );
      return;
    }
    if (saving) return;
    const accessToken = token();
    if (!accessToken) return;
    const { current: isMutationCurrent } = beginMutation();
    setSaving(true);
    setFormError(null);
    try {
      if (dialogMode === "review") {
        const id = rowId(selected ?? {});
        if (!id) throw new Error("KPI is missing.");
        if (form.decision !== "APPROVE" && !form.comment?.trim()) {
          throw new Error(
            "A comment is required when returning or rejecting a KPI.",
          );
        }
        await reviewManagerEmployeeKpi(
          accessToken,
          id,
          form.decision as "APPROVE" | "RETURN" | "REJECT",
          form.comment || undefined,
        );
        if (!isMutationCurrent()) return;
        toast.success(`KPI ${form.decision.toLowerCase()}.`);
      } else if (dialogMode === "actual") {
        const id = rowId(selected ?? {});
        if (!id || form.actual_value === "")
          throw new Error("Enter an actual value.");
        await updateMyEmployeeKpiActual(
          accessToken,
          id,
          Number(form.actual_value),
        );
        if (!isMutationCurrent()) return;
        toast.success("KPI progress updated.");
      } else {
        if (
          !form.title?.trim() ||
          !form.description?.trim() ||
          !form.due_date ||
          !form.weight
        ) {
          throw new Error(
            "Title, description, due date, and weight are required.",
          );
        }
        const payload: AdminRecord = {
          performance_period_id: Number(form.performance_period_id || periodId),
          title: form.title.trim(),
          description: form.description.trim(),
          measurement_type: form.measurement_type,
          target_value: !form.target_value
            ? undefined
            : Number(form.target_value),
          unit: form.unit || undefined,
          weight: Number(form.weight),
          start_date: form.start_date || undefined,
          due_date: form.due_date,
          progress_source: form.progress_source,
          scoring_type: form.scoring_type || "NUMERIC_TARGET",
          measurement_direction:
            form.measurement_direction || "HIGHER_IS_BETTER",
          formula_config:
            form.scoring_type === "MIXED"
              ? { numeric_share: Number(form.numeric_share || 0.5) }
              : form.scoring_type === "MILESTONE"
                ? {
                    total_milestones: Number(
                      form.total_milestones || form.target_value || 1,
                    ),
                  }
                : undefined,
        };
        const id = rowId(selected ?? {});
        if (dialogMode === "create" && mode === "manager") {
          if (!form.employee_id) throw new Error("Choose an employee.");
          await createManagerEmployeeKpi(accessToken, {
            ...payload,
            employee_id: Number(form.employee_id),
          });
          if (!isMutationCurrent()) return;
          toast.success("KPI assigned and submitted for approval.");
        } else if (dialogMode === "edit" && id) {
          delete payload.performance_period_id;
          await updateMyEmployeeKpi(accessToken, id, payload);
          if (!isMutationCurrent()) return;
          toast.success("KPI updated.");
        } else {
          await createMyEmployeeKpi(accessToken, payload);
          if (!isMutationCurrent()) return;
          toast.success("KPI draft created.");
        }
      }
      setOpen(false);
      await load();
      if (!isMutationCurrent()) return;
    } catch (cause) {
      if (!isMutationCurrent()) return;
      const message =
        cause instanceof Error ? cause.message : "Could not save KPI.";
      setFormError(message);
      toast.error(message);
    } finally {
      if (isMutationCurrent()) setSaving(false);
    }
  }

  async function submitPeriod() {
    const accessToken = token();
    if (!accessToken || !periodId) return;
    setSaving(true);
    try {
      await submitMyEmployeeKpis(accessToken, periodId);
      toast.success("KPI set submitted to your manager.");
      await load();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not submit KPIs.",
      );
    } finally {
      setSaving(false);
    }
  }

  const removeKpi = React.useCallback(
    async (row: AdminRecord) => {
      const id = rowId(row);
      if (
        !id ||
        !window.confirm(`Delete KPI ${readString(row, ["title"], `#${id}`)}?`)
      )
        return;
      const accessToken = token();
      if (!accessToken) return;
      setSaving(true);
      try {
        await deleteMyEmployeeKpi(accessToken, id);
        toast.success("KPI deleted.");
        await load();
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Could not delete KPI.";
        setError(message);
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    const base: Column<AdminRecord>[] = [
      ...(mode === "manager"
        ? [
            {
              key: "employee",
              label: "Employee",
              render: (row: AdminRecord) =>
                employeeLabel(row.employee as AdminRecord),
            },
          ]
        : []),
      {
        key: "kpi",
        label: "KPI",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">
              {readString(row, ["title"], `KPI #${rowId(row)}`)}
            </p>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {readString(row, ["description"])}
            </p>
          </div>
        ),
      },
      {
        key: "period",
        label: "Period",
        render: (row) => optionLabel(periodOf(row) ?? row),
      },
      {
        key: "target",
        label: "Target / weight",
        render: (row) =>
          `${readString(row, ["targetValue", "target_value"], "Manual")} ${readString(row, ["unit"])} · ${readString(row, ["weight"])}%`,
      },
      {
        key: "progress",
        label: "Progress",
        render: (row) => {
          const progress = progressOf(row);
          return progress
            ? `${readString(progress, ["achievementPercent"], "—")}%`
            : "—";
        },
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <StatusChip value={readString(row, ["status"], "DRAFT")} />
        ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => {
          const status = readString(row, ["status"]);
          if (mode === "manager") {
            const reviewable = [
              "SUBMITTED",
              "RESUBMITTED",
              "PENDING_REVIEW",
            ].includes(status);
            return reviewable ? (
              <div className="flex flex-wrap gap-1">
                {["SUBMITTED", "RESUBMITTED"].includes(status) ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={saving}
                    onClick={(event) => {
                      event.stopPropagation();
                      void beginReview(row);
                    }}
                  >
                    Begin review
                  </button>
                ) : null}
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    showReview(row, "APPROVE");
                  }}
                >
                  <CheckIcon className="size-3.5" /> Approve
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    showReview(row, "RETURN");
                  }}
                >
                  <RotateCcwIcon className="size-3.5" /> Return
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    showReview(row, "REJECT");
                  }}
                >
                  <XIcon className="size-3.5" /> Reject
                </button>
              </div>
            ) : null;
          }
          if (["DRAFT", "RETURNED"].includes(status)) {
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    showEdit(row);
                  }}
                >
                  Edit
                </button>
                {mode === "self" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeKpi(row);
                    }}
                    disabled={saving}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            );
          }
          if (status === "APPROVED") {
            return (
              <div className="flex flex-wrap gap-1">
                {readString(row, ["progressSource", "progress_source"]) ===
                "MANUAL" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={(event) => {
                      event.stopPropagation();
                      showActual(row);
                    }}
                  >
                    Update actual
                  </button>
                ) : null}
                <Link
                  className={actionButtonClass}
                  href={`/dashboard/me/activities/today?create=1&kpi=${encodeURIComponent(rowId(row))}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  Add linked activity
                </Link>
              </div>
            );
          }
          return null;
        },
      },
    ];
    return base;
  }, [mode, beginReview, removeKpi, saving]);

  if (loading && !open)
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <FluentLoadingIndicator />
        <p role="status">
          Loading this workflow and checking its available actions…
        </p>
      </section>
    );

  if (error && !loading && !open)
    return (
      <section className="flex flex-col gap-4">
        <WorkflowGuide
          title="This workflow needs attention"
          unavailable={error}
          steps={[
            "Resolve the permission, setup, or network issue described above.",
            "Reload this view before continuing.",
          ]}
        />
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => void load()}
        >
          Reload workflow
        </button>
      </section>
    );

  return (
    <section className="space-y-5 pt-4">
      <WorkflowGuide
        title="Build and review the KPI set"
        steps={[
          "Choose an available performance period.",
          "Create measurable KPIs with due dates inside the cycle.",
          "Make the complete set total exactly 100% before submission.",
          "The manager approves or returns KPIs with comments.",
          "Update actual values and complete mid-cycle and final reviews.",
        ]}
        unavailable={error}
      />
      {mode === "self" ? (
        <>
          <header className="border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {periods.length > 0 ? (
                <FluentButton
                  className="justify-center"
                  appearance="primary"
                  icon={<PlusIcon className="size-4" />}
                  onClick={showCreate}
                  disabled={!canCreateKpi || loading}
                  title={!canCreateKpi ? unavailableReason : undefined}
                  aria-describedby={
                    !canCreateKpi && !loading
                      ? "kpi-create-unavailable"
                      : undefined
                  }
                >
                  New KPI
                </FluentButton>
              ) : null}
              {periods.length > 0 ? (
                <FluentButton
                  className="justify-center"
                  appearance="secondary"
                  onClick={() => void submitPeriod()}
                  disabled={
                    !periodId ||
                    saving ||
                    totalWeight !== 100 ||
                    visibleRows.length === 0
                  }
                >
                  Submit set · {totalWeight}%
                </FluentButton>
              ) : null}
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger
                    className="inline-flex items-center justify-center p-1 text-muted-foreground transition-colors hover:text-primary"
                    aria-label="Filter KPIs"
                    title="Filter KPIs"
                  >
                    <Filter24Regular className="size-5" />
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[min(22rem,calc(100vw-2rem))] space-y-4 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Filter KPIs
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Search goals or choose a performance period.
                      </p>
                    </div>
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      Search
                      <FluentInput
                        className="w-full"
                        contentBefore={
                          <Search20Regular
                            className="block size-5"
                            aria-hidden="true"
                          />
                        }
                        placeholder="Search KPIs"
                        aria-label="Search KPIs"
                        value={searchTerm}
                        onChange={(event) =>
                          setSearchTerm(event.currentTarget.value)
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      Performance period
                      <FluentSelect
                        ariaLabel="Performance period"
                        className="w-full"
                        value={periodId}
                        onChange={setPeriodId}
                        disabled={!periods.length}
                        placeholder={
                          periods.length ? "All periods" : "No periods assigned"
                        }
                        options={[
                          ...(periods.length
                            ? [{ value: "", label: "All periods" }]
                            : []),
                          ...periods.map((period) => ({
                            value: rowId(period),
                            label: `${optionLabel(period)} · ${readString(period, ["status"])}`,
                          })),
                        ]}
                      />
                    </label>
                  </PopoverContent>
                </Popover>
                <FluentButton
                  className="!min-w-0 !p-1"
                  appearance="subtle"
                  icon={
                    loading ? (
                      <FluentLoadingIndicator className="size-4 animate-spin" />
                    ) : (
                      <RefreshCwIcon className="size-4" />
                    )
                  }
                  onClick={() => void load()}
                  disabled={loading}
                  aria-label="Refresh KPIs"
                  title="Refresh KPIs"
                />
              </div>
            </div>
          </header>

          {periods.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">Workflow</span>
                <span className="mx-2 text-primary">
                  Set goals → get approval → link activities → track results
                </span>
              </p>
              <Link
                href="/dashboard/me/activities/today"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Open my activities
              </Link>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="border-l-2 border-rose-500 py-2 pl-3 text-sm text-rose-700"
            >
              {error}
            </p>
          ) : null}
          {selectedPeriod &&
          readString(selectedPeriod, ["kpiPhase", "kpi_phase"]) ===
            "REOPENED" ? (
            <p className="border-l-2 border-amber-500 py-2 pl-3 text-sm text-amber-900">
              This KPI cycle was reopened.{" "}
              {readString(selectedPeriod, [
                "kpiReopenReason",
                "kpi_reopen_reason",
              ])}
            </p>
          ) : null}

          {!loading && !error && periods.length > 0 && !canCreateKpi ? (
            <div
              id="kpi-create-unavailable"
              className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4 text-sm"
            >
              <p className="text-muted-foreground">{unavailableReason}</p>
              {canManagePerformance ? (
                <Link
                  href="/dashboard/performance/setup"
                  className="font-semibold text-primary hover:underline"
                >
                  Open performance setup
                </Link>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && periods.length === 0 ? (
            <section className="border-y border-border py-8">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <KpiIcon className="size-6 text-primary" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Start by setting up your KPI cycle
                  </h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  A performance cycle and KPI plan need to be assigned to you
                  before you can create goals or see cycle reviews. Ask your
                  manager or HR to open a cycle and assign your plan; it will
                  then appear here.
                </p>
                <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                  <li className="border-l-2 border-primary pl-3">
                    <span className="block font-semibold text-foreground">
                      1. Open a cycle
                    </span>
                    <span className="text-muted-foreground">
                      Manager or HR sets the review period.
                    </span>
                  </li>
                  <li className="border-l-2 border-border pl-3">
                    <span className="block font-semibold text-foreground">
                      2. Assign your plan
                    </span>
                    <span className="text-muted-foreground">
                      Your KPI period becomes available here.
                    </span>
                  </li>
                  <li className="border-l-2 border-border pl-3">
                    <span className="block font-semibold text-foreground">
                      3. Set goals and track work
                    </span>
                    <span className="text-muted-foreground">
                      Create KPIs, link activities, and review progress.
                    </span>
                  </li>
                </ol>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {canManagePerformance ? (
                    <Link
                      href="/dashboard/performance/setup"
                      className={primaryButtonClass}
                    >
                      Open performance setup
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      Your manager or HR can open performance setup and assign
                      your plan.
                    </span>
                  )}
                  <Link
                    href="/dashboard/me/activities/today"
                    className={secondaryButtonClass}
                  >
                    Open my activities
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          {periodId ? (
            <div className="grid gap-0 border-y border-border sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Weight allocated",
                  value: `${totalWeight}%`,
                  detail: "Target is 100%",
                },
                {
                  label: "KPIs in this cycle",
                  value: visibleRows.length,
                  detail: "Goals assigned or proposed",
                },
                {
                  label: "Submission",
                  value:
                    totalWeight === 100 && visibleRows.length > 0
                      ? "Ready"
                      : "In progress",
                  detail: "Requires exactly 100% weight",
                },
                {
                  label: "Weighted progress",
                  value: `${overallScore.toFixed(1)}%`,
                  detail: "Based on recorded actuals",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="border-b border-border px-3 py-3 last:border-b-0 sm:px-5 xl:border-b-0 xl:border-r xl:last:border-r-0"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {periods.length > 0 ? (
            <section className="border-t border-border pt-2">
              <div className="flex flex-wrap items-end justify-between gap-3 px-1 py-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Goals for this cycle
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Targets, current progress, and linked work.
                  </p>
                </div>
                {selectedPeriod ? (
                  <Badge appearance="tint" color="brand">
                    {optionLabel(selectedPeriod)}
                  </Badge>
                ) : null}
              </div>
              {displayedRows.length ? (
                <div className="divide-y divide-border">
                  {displayedRows.map((row) => {
                    const status = readString(
                      row,
                      ["status"],
                      "DRAFT",
                    ).toUpperCase();
                    const progress = progressOf(row);
                    const achievement = readNumber(progress, [
                      "achievementPercent",
                      "achievement_percent",
                    ]);
                    const actual = readString(
                      progress,
                      ["actualValue", "actual_value"],
                      readString(row, ["actualValue", "actual_value"], "—"),
                    );
                    const target = readString(
                      row,
                      ["targetValue", "target_value"],
                      "Manual",
                    );
                    const unit = readString(row, ["unit"]);
                    return (
                      <article
                        key={rowId(row)}
                        className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.6fr)_auto] lg:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <KpiIcon className="size-4 shrink-0 text-muted-foreground" />
                            <h3 className="min-w-0 text-sm font-semibold text-foreground">
                              {readString(row, ["title"], `KPI #${rowId(row)}`)}
                            </h3>
                            <Badge
                              appearance="tint"
                              color={
                                status === "APPROVED"
                                  ? "success"
                                  : status === "REJECTED"
                                    ? "danger"
                                    : status === "RETURNED"
                                      ? "warning"
                                      : "informative"
                              }
                            >
                              {status.replaceAll("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {readString(
                              row,
                              ["description"],
                              "No description provided.",
                            )}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Target{" "}
                            <span className="font-semibold text-foreground">
                              {target} {unit}
                            </span>
                            <span className="mx-2">·</span>Weight{" "}
                            <span className="font-semibold text-foreground">
                              {readString(row, ["weight"], "0")}%
                            </span>
                            <span className="mx-2">·</span>Due{" "}
                            {formatDate(row.dueDate ?? row.due_date)}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground">
                              Progress
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">
                              {achievement === null
                                ? "Not started"
                                : `${Math.round(achievement)}%`}
                            </span>
                          </div>
                          <ProgressBar
                            value={
                              achievement === null
                                ? 0
                                : Math.min(1, Math.max(0, achievement / 100))
                            }
                            thickness="medium"
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Actual {actual}
                            {unit ? ` ${unit}` : ""} of {target}
                            {unit ? ` ${unit}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 lg:justify-end">
                          {["DRAFT", "RETURNED"].includes(status) ? (
                            <>
                              <FluentButton
                                appearance="subtle"
                                size="small"
                                onClick={() => showEdit(row)}
                              >
                                Edit
                              </FluentButton>
                              <FluentButton
                                appearance="subtle"
                                size="small"
                                disabled={saving}
                                onClick={() => void removeKpi(row)}
                              >
                                Delete
                              </FluentButton>
                            </>
                          ) : null}
                          {status === "APPROVED" ? (
                            <>
                              {readString(row, [
                                "progressSource",
                                "progress_source",
                              ]) === "MANUAL" ? (
                                <FluentButton
                                  appearance="subtle"
                                  size="small"
                                  onClick={() => showActual(row)}
                                >
                                  Update actual
                                </FluentButton>
                              ) : null}
                              <Link
                                className={actionButtonClass}
                                href={`/dashboard/me/activities/today?create=1&kpi=${encodeURIComponent(rowId(row))}`}
                              >
                                Add linked activity
                              </Link>
                            </>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : !loading ? (
                <div className="flex flex-col items-center border-y border-border px-4 py-10 text-center">
                  <KpiIcon
                    className="size-8 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 text-base font-semibold text-foreground">
                    No KPIs in this cycle yet
                  </h3>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                    Create a measurable goal for this period. Once approved, you
                    can link activities and track progress here.
                  </p>
                  <FluentButton
                    appearance="primary"
                    icon={<PlusIcon className="size-4" />}
                    className="mt-4"
                    onClick={showCreate}
                    disabled={!canCreateKpi}
                  >
                    Create a KPI
                  </FluentButton>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                KPI reviews
              </h1>
              <p className="text-sm text-muted-foreground">
                Review KPI proposals from employees in your reporting scope.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={showCreate}
                disabled={!periods.length || !employees.length || loading}
              >
                <PlusIcon className="size-4" /> Assign KPI
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : (
                  <RefreshCwIcon className="size-4" />
                )}{" "}
                Refresh
              </button>
            </div>
          </div>
          {error ? (
            <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="overflow-hidden border border-border bg-card">
            <ResizableTable
              title="Team KPI proposals"
              data={rows}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey={`employee-kpis-${mode}`}
            />
          </div>
        </>
      )}
      {mode === "manager" || periods.length > 0 ? (
        <KpiCycleReviewPanel
          mode={mode}
          periodId={periodId}
          period={selectedPeriod}
          refreshKey={reviewRefresh}
        />
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!saving) setOpen(next);
        }}
      >
        <DialogPopup className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "review"
                ? `${form.decision} KPI`
                : dialogMode === "actual"
                  ? "Update KPI actual"
                  : dialogMode === "edit"
                    ? "Edit KPI"
                    : mode === "manager"
                      ? "Assign KPI"
                      : "Create KPI"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "review"
                ? readString(selected ?? {}, ["title"])
                : "Drafts can be saved below 100%; the complete period set is validated when submitted."}
            </DialogDescription>
          </DialogHeader>
          <ValidatedWorkflowForm
            key={dialogMode}
            saving={saving}
            submitError={formError}
            onSubmit={save}
            validation={{
              schema: employeeKpiFormSchema(dialogMode, mode === "manager"),
              input: kpiFormInput,
            }}
            description="Create and revise drafts, make the set total 100%, then submit it for manager approval."
          >
            {dialogMode === "review" ? (
              <div className="grid gap-4 text-sm">
                <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Employee
                    </span>
                    <p className="font-medium">
                      {employeeLabel(selected?.employee as AdminRecord)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Period
                    </span>
                    <p className="font-medium">
                      {optionLabel(periodOf(selected ?? {}) ?? {})}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Measurement
                    </span>
                    <p className="font-medium">
                      {readString(selected ?? {}, [
                        "measurementType",
                        "measurement_type",
                      ])}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Target
                    </span>
                    <p className="font-medium">
                      {readString(
                        selected ?? {},
                        ["targetValue", "target_value"],
                        "Manual",
                      )}{" "}
                      {readString(selected ?? {}, ["unit"])}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Weight
                    </span>
                    <p className="font-medium">
                      {readString(selected ?? {}, ["weight"])}%
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Due date
                    </span>
                    <p className="font-medium">
                      {formatDate(selected?.dueDate ?? selected?.due_date)}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs text-muted-foreground">
                      Description
                    </span>
                    <p className="whitespace-pre-wrap">
                      {readString(selected ?? {}, ["description"])}
                    </p>
                  </div>
                  {readString(selected ?? {}, [
                    "reviewComment",
                    "review_comment",
                  ]) ? (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-muted-foreground">
                        Previous review comment
                      </span>
                      <p className="whitespace-pre-wrap">
                        {readString(selected ?? {}, [
                          "reviewComment",
                          "review_comment",
                        ])}
                      </p>
                    </div>
                  ) : null}
                </div>
                <label className="grid gap-1.5">
                  <span className="font-medium">
                    Comment{" "}
                    {form.decision === "APPROVE" ? "(optional)" : "(required)"}
                  </span>
                  <Textarea
                    className={textareaClass}
                    value={form.comment ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        comment: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            ) : dialogMode === "actual" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Actual value</span>
                <input
                  className={inputClass}
                  type="number"
                  value={form.actual_value ?? ""}
                  onChange={(event) =>
                    setForm({ actual_value: event.target.value })
                  }
                />
              </label>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {dialogMode === "create" && mode === "manager" ? (
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Employee</span>
                    <FluentSelect
                      ariaLabel="Employee"
                      className="w-full"
                      value={form.employee_id ?? ""}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          employee_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select employee" },
                        ...employees.map((employee) => ({
                          value: rowId(employee),
                          label: employeeLabel(employee),
                        })),
                      ]}
                    />
                  </label>
                ) : null}
                {dialogMode === "create" ? (
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Period</span>
                    <FluentSelect
                      ariaLabel="Period"
                      className="w-full"
                      value={form.performance_period_id ?? ""}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          performance_period_id: value,
                        }))
                      }
                      options={(mode === "manager"
                        ? periods
                        : periods.filter(canProposeEmployeeKpis)
                      ).map((period) => ({
                        value: employeeKpiPeriodId(period),
                        label: `${optionLabel(period)}${
                          readString(period, ["status"])
                            ? ` · ${readString(period, ["status"])}`
                            : ""
                        }`,
                      }))}
                    />
                  </label>
                ) : null}
                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="font-medium">Title</span>
                  <input
                    className={inputClass}
                    value={form.title ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="font-medium">Description</span>
                  <Textarea
                    className={textareaClass}
                    value={form.description ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Measurement</span>
                  <FluentSelect
                    ariaLabel="Measurement"
                    className="w-full"
                    value={form.measurement_type}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        measurement_type: value,
                      }))
                    }
                    options={[
                      "NUMBER",
                      "PERCENTAGE",
                      "CURRENCY",
                      "BOOLEAN",
                      "RATING",
                      "MANUAL",
                    ].map((value) => ({ value, label: value }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Progress source</span>
                  <FluentSelect
                    ariaLabel="Progress source"
                    className="w-full"
                    value={form.progress_source}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        progress_source: value,
                      }))
                    }
                    options={[
                      { value: "MANUAL", label: "Manual actual" },
                      {
                        value: "APPROVED_ACTIVITIES",
                        label: "Approved activities",
                      },
                      { value: "SYSTEM", label: "System" },
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Scoring method</span>
                  <FluentSelect
                    ariaLabel="Scoring method"
                    value={form.scoring_type || "NUMERIC_TARGET"}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        scoring_type: value,
                      }))
                    }
                    options={[
                      { value: "NUMERIC_TARGET", label: "Numeric target" },
                      { value: "RATING_SCALE", label: "Manager rating" },
                      { value: "MILESTONE", label: "Milestones" },
                      { value: "MIXED", label: "Numeric and rating" },
                    ]}
                  />
                </label>
                {form.scoring_type === "NUMERIC_TARGET" ||
                form.scoring_type === "MIXED" ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Target direction</span>
                    <FluentSelect
                      ariaLabel="Target direction"
                      value={form.measurement_direction || "HIGHER_IS_BETTER"}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          measurement_direction: value,
                        }))
                      }
                      options={[
                        {
                          value: "HIGHER_IS_BETTER",
                          label: "Higher is better",
                        },
                        { value: "LOWER_IS_BETTER", label: "Lower is better" },
                        { value: "TARGET_MATCH", label: "Exact target" },
                      ]}
                    />
                  </label>
                ) : null}
                {form.scoring_type === "MIXED" ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Numeric share (0–1)</span>
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={form.numeric_share ?? "0.5"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          numeric_share: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
                {form.scoring_type === "MILESTONE" ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Total milestones</span>
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      value={form.total_milestones ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          total_milestones: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Target</span>
                  <input
                    className={inputClass}
                    type="number"
                    value={form.target_value ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        target_value: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Unit</span>
                  <input
                    className={inputClass}
                    value={form.unit ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        unit: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Weight (%)</span>
                  <input
                    className={inputClass}
                    type="number"
                    min="0.01"
                    max="100"
                    value={form.weight ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        weight: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Start date</span>
                  <DateInput
                    className={inputClass}
                    value={form.start_date ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        start_date: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Due date</span>
                  <DateInput
                    className={inputClass}
                    value={form.due_date ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        due_date: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            )}
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </ValidatedWorkflowForm>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
```

## /home/innocent/systems/hrms/src/components/dashboard/activity-task-workspace.tsx

```tsx
"use client";

import { ActivityEvidencePicker } from "@/components/dashboard/activity-evidence-picker";
import { WorkflowGuide } from "@/components/dashboard/workflow-guide";
import { ValidatedWorkflowForm } from "@/components/dashboard/validated-workflow-form";
import { activityTaskSchema } from "@/lib/workflow-schemas";
import { workflowFailure } from "@/lib/workflow-error";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { Input as FluentInput } from "@fluentui/react-components";
import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  Clock3Icon,
  ClipboardListIcon,
  Columns3Icon,
  FileTextIcon,
  GripVerticalIcon,
  HistoryIcon,
  InboxIcon,
  ListIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SendIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import {
  Info20Regular,
  Search20Regular as SearchIcon,
} from "@fluentui/react-icons";
import { toast } from "@/components/ui/fluent-toast-store";

import {
  asRecord,
  asRecordArray,
  formatDate,
  inputClass,
  optionLabel,
  primaryButtonClass,
  readString,
  rowId,
  secondaryButtonClass,
} from "@/components/dashboard/talent-visuals";
import { DatePickerPresets } from "@/components/ui/date-picker-presets";
import { FluentSelect } from "@/components/ui/fluent-select";
import { TimeClockPicker } from "@/components/ui/time-clock-picker";
import {
  addIsoDays,
  canCloseReport,
  closeReportIssues,
  defaultCloseEntryIds,
  isCloseableActivityStatus,
  isClosedReportStatus,
  isManagerAssignedActivity,
  isTeamAssignedActivity,
  localIsoDate,
  partitionActivityTasks,
  pastActivityReports,
  plannedDueDateOf,
  plannedStartDateOf,
  policyLimits,
  reportDateOf,
  reportForDate,
  reportStatusOf,
} from "@/lib/activity-day";
import { cn } from "@/lib/utils";
import {
  addManagerActivityComment,
  addMyActivityComment,
  createManagerActivityTask,
  createMyActivityTask,
  getManagerActivityReport,
  getMyActivityReport,
  getMyAttendanceSchedule,
  listManagerActivityAssignees,
  listManagerActivityTasks,
  listManagerEmployeeKpis,
  listMyActivities,
  listMyActivityTasks,
  listMyEmployeeKpis,
  submitMyActivityReport,
  updateManagerActivitySchedule,
  updateMyActivityEntry,
  extractProfilePhotoUrl,
  type AdminRecord,
} from "@/lib/admin-api";
import { useMyProfilePhoto } from "@/lib/my-profile-photo";
import { resolveBackendMediaUrl } from "@/lib/backend-media-url";
import { hasPermission } from "@/lib/dashboard-permissions";
import { readStoredSessionTokens } from "@/lib/session-client";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type WorkspaceMode = "self" | "manager";
type ListTab = "today" | "upcoming" | "history" | "assigned" | "tasks";
type WorkspaceView = "timeline" | "board" | "list";
type TimelineDragMode = "move" | "resize-start" | "resize-end";
type TimelineDrag = {
  key: string;
  task: AdminRecord;
  mode: TimelineDragMode;
  originX: number;
  trackWidth: number;
  originalStart: number;
  originalEnd: number;
  previewStart: number;
  previewEnd: number;
};

const statusLabel: Record<string, string> = {
  PLANNED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DEFERRED: "Deferred",
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  PENDING: "Pending review",
  NOT_REQUIRED: "No review",
  RETURNED_FOR_CORRECTION: "Returned",
  REJECTED: "Rejected",
};

function token() {
  return readStoredSessionTokens().accessToken.trim();
}

function newRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `req-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return localIsoDate();
}

function personName(value: unknown, fallback = "Unassigned") {
  const record = asRecord(value);
  if (!record) return fallback;
  return readString(record, ["full_name", "fullName", "name"], fallback);
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? parts[0]?.[1] ?? ""}`.toUpperCase() ||
    "?"
  );
}

function viewerEmployeeId(reports: AdminRecord[], tasks: AdminRecord[]) {
  for (const row of [...reports, ...tasks]) {
    const id = readString(row, ["employeeId", "employee_id"]);
    if (id) return id;
  }
  return "";
}

function taskStatus(task: AdminRecord) {
  return readString(task, ["status"], "PLANNED").toUpperCase();
}

function taskPriority(task: AdminRecord) {
  return readString(task, ["priority"], "MEDIUM").toUpperCase();
}

function taskReviewStatus(task: AdminRecord) {
  return readString(
    task,
    ["reviewStatus", "review_status"],
    "NOT_REQUIRED",
  ).toUpperCase();
}

function reportIdOf(row: AdminRecord | null | undefined) {
  return readString(row, [
    "report_id",
    "reportId",
    "dailyActivityReportId",
    "daily_activity_report_id",
  ]);
}

function entryIdOf(row: AdminRecord | null | undefined) {
  if (!row || row.is_report_row) return "";
  return readString(row, ["id"]);
}

function taskDate(task: AdminRecord) {
  return plannedDueDateOf(task) || reportDateOf(task);
}

function hasDueDate(task: AdminRecord) {
  return Boolean(plannedDueDateOf(task));
}

function isDraftReportStatus(status: string) {
  return canCloseReport({ status });
}

function checklistProgress(task: AdminRecord) {
  const items = asRecordArray(task.checklist);
  if (!items.length) return null;
  const done = items.filter((item) => item.completed === true).length;
  return { done, total: items.length, label: `${done}/${items.length}` };
}

function dueMeta(value: unknown) {
  if (typeof value !== "string" || !value.trim())
    return { label: "No date", tone: "muted" as const };
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return { label: value, tone: "muted" as const };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - start.getTime()) / 86_400_000);
  if (days === 0) return { label: "Due today", tone: "danger" as const };
  if (days === 1) return { label: "Tomorrow", tone: "warn" as const };
  if (days > 1 && days < 14)
    return { label: `In ${days} days`, tone: "muted" as const };
  if (days === -1) return { label: "Yesterday", tone: "danger" as const };
  if (days < 0)
    return { label: `${Math.abs(days)} days overdue`, tone: "danger" as const };
  return { label: formatDate(value), tone: "muted" as const };
}

function plannedDateTimeOf(task: AdminRecord, kind: "start" | "end") {
  const value =
    kind === "start"
      ? readString(task, ["plannedStartTime", "planned_start_time"])
      : readString(task, ["plannedEndTime", "planned_end_time"]);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minutesOfDay(value: Date) {
  return value.getHours() * 60 + value.getMinutes();
}

function minutesFromScheduleTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const timeMatch = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(trimmed);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : minutesOfDay(parsed);
}

function formatTimelineTime(value: Date) {
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function localTaskDateTime(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function timeFromMinutes(value: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function entriesFromReports(reports: AdminRecord[]): AdminRecord[] {
  return reports.flatMap((report) =>
    asRecordArray(report.entries ?? report.items ?? report.activities).map(
      (entry) => ({
        ...entry,
        report_id: reportIdOf(report) || rowId(report),
        activity_date: report.activityDate ?? report.activity_date,
        report_status: report.status,
        employee_id: report.employeeId ?? report.employee_id,
        employee: report.employeeSnapshot ?? report.employee_snapshot,
      }),
    ),
  );
}

function asReportRow(report: AdminRecord): AdminRecord {
  const entries = asRecordArray(
    report.entries ?? report.items ?? report.activities,
  );
  const dated = formatDate(report.activityDate ?? report.activity_date);
  return {
    ...report,
    report_id: reportIdOf(report) || rowId(report),
    title: dated && dated !== "—" ? `Daily report · ${dated}` : "Daily report",
    description: entries.length
      ? `${entries.length} work item${entries.length === 1 ? "" : "s"}`
      : "No work items yet",
    report_status: readString(report, ["status"], "DRAFT"),
    status: readString(report, ["status"], "DRAFT"),
    is_report_row: true,
    entries,
  };
}

function Avatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [photoUrl]);
  const showPhoto = Boolean(photoUrl) && !failed;
  return (
    <span
      className={cn(
        "relative inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-[11px] font-semibold text-sky-800 ring-1 ring-slate-200",
        className,
      )}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl ?? ""}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

function photoFromRecord(value: unknown) {
  return resolveBackendMediaUrl(extractProfilePhotoUrl(value));
}

function PriorityDot({ priority }: { priority: string }) {
  const color =
    {
      URGENT: "bg-rose-500",
      HIGH: "bg-rose-500",
      MEDIUM: "bg-amber-400",
      LOW: "bg-emerald-500",
    }[priority] ?? "bg-slate-400";
  return <span className={cn("size-2 rounded-full", color)} />;
}

function StatusPill({ value }: { value: string }) {
  const label = statusLabel[value] ?? value;
  const tone =
    value === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700"
      : value === "IN_PROGRESS"
        ? "bg-sky-50 text-sky-700"
        : value === "DRAFT" || value === "RETURNED_FOR_CORRECTION"
          ? "bg-amber-50 text-amber-800"
          : "bg-slate-100 text-slate-600";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-1.5 py-px text-[10px] font-medium leading-4",
        tone,
      )}
    >
      {label}
    </span>
  );
}

export function ActivityTaskWorkspace({ mode }: { mode: WorkspaceMode }) {
  const actor = useDashboardActor();
  const { url: myPhotoUrl } = useMyProfilePhoto();
  const [tab, setTab] = React.useState<ListTab>(
    mode === "manager" ? "tasks" : "today",
  );
  const [workspaceView, setWorkspaceView] =
    React.useState<WorkspaceView>("timeline");
  const [tasks, setTasks] = React.useState<AdminRecord[]>([]);
  const [reports, setReports] = React.useState<AdminRecord[]>([]);
  const [dailySchedule, setDailySchedule] = React.useState<AdminRecord | null>(
    null,
  );
  const [team, setTeam] = React.useState<AdminRecord[]>([]);
  const [employeeKpis, setEmployeeKpis] = React.useState<AdminRecord[]>([]);
  const [selected, setSelected] = React.useState<AdminRecord | null>(null);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [priorityFilter, setPriorityFilter] = React.useState("ALL");
  const [reviewFilter, setReviewFilter] = React.useState("ALL");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Record<string, string>>({
    activity_date: today(),
    start_time: "09:00",
    end_time: "10:00",
    priority: "MEDIUM",
  });
  const [checklistDraft, setChecklistDraft] = React.useState("");
  const [checklistItems, setChecklistItems] = React.useState<string[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const [commenting, setCommenting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [addWorkReason, setAddWorkReason] = React.useState<"close" | null>(
    null,
  );
  const [employeeIds, setEmployeeIds] = React.useState<string[]>([]);
  const [teamQuery, setTeamQuery] = React.useState("");
  const [previewReport, setPreviewReport] = React.useState<AdminRecord | null>(
    null,
  );
  const [previewSummary, setPreviewSummary] = React.useState("");
  const [previewEntryIds, setPreviewEntryIds] = React.useState<string[]>([]);
  const [taskEditStatus, setTaskEditStatus] = React.useState("PLANNED");
  const [taskOutcome, setTaskOutcome] = React.useState("");
  const [audience, setAudience] = React.useState<"employee" | "self">(
    mode === "manager" ? "employee" : "self",
  );
  const [updatingChecklistId, setUpdatingChecklistId] = React.useState<
    string | null
  >(null);
  const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(
    null,
  );
  const [scheduleTarget, setScheduleTarget] =
    React.useState<AdminRecord | null>(null);
  const [scheduleForm, setScheduleForm] = React.useState({
    date: today(),
    start: "09:00",
    end: "10:00",
  });
  const [scheduleSaving, setScheduleSaving] = React.useState(false);
  const [timelineDrag, setTimelineDrag] = React.useState<TimelineDrag | null>(
    null,
  );
  const [timelineSavingId, setTimelineSavingId] = React.useState<string | null>(
    null,
  );
  const [unscheduledOpen, setUnscheduledOpen] = React.useState(false);
  const timelineDragRef = React.useRef<TimelineDrag | null>(null);
  const timelineMovedRef = React.useRef(false);
  const openedFocusRef = React.useRef<string | null>(null);
  const resumeCloseDayRef = React.useRef<string | null>(null);

  const { begin, invalidate, credential } = useWorkflowRequest(mode);

  const load = React.useCallback(async () => {
    const { commit, current } = begin();
    void current;
    const accessToken = credential?.trim() || token();
    if (!accessToken) {
      commit(() => setError("Authentication required. Please log in again."));
      commit(() => setLoading(false));
      return;
    }
    commit(() => setLoading(true));
    commit(() => setError(null));
    try {
      if (mode === "self") {
        const scheduleDate = today();
        const [taskRows, reportRows, kpiRows, scheduleRows] = await Promise.all(
          [
            listMyActivityTasks(accessToken, { limit: 100 }),
            listMyActivities(accessToken, { limit: 100 }),
            listMyEmployeeKpis(accessToken, { status: "APPROVED", limit: 100 }),
            getMyAttendanceSchedule(accessToken, {
              from_date: scheduleDate,
              to_date: scheduleDate,
            }),
          ],
        );
        const fromReports = entriesFromReports(reportRows);
        const reportEntryById = new Map(
          fromReports.map((entry) => [entryIdOf(entry) || rowId(entry), entry]),
        );
        const mergedTasks = (taskRows.length ? taskRows : fromReports).map(
          (task) => {
            const nested = reportEntryById.get(entryIdOf(task) || rowId(task));
            const dated = reportDateOf(task) || reportDateOf(nested);
            return {
              ...nested,
              ...task,
              report_id: reportIdOf(task) || reportIdOf(nested),
              activity_date: dated,
              activityDate: dated,
              planned_start_time:
                task.planned_start_time ??
                task.plannedStartTime ??
                nested?.planned_start_time ??
                nested?.plannedStartTime,
              planned_end_time:
                task.planned_end_time ??
                task.plannedEndTime ??
                nested?.planned_end_time ??
                nested?.plannedEndTime,
              employee_id:
                task.employee_id ??
                task.employeeId ??
                nested?.employee_id ??
                nested?.employeeId,
              report_status:
                readString(task, ["report_status", "reportStatus"]) ||
                readString(nested, ["report_status", "reportStatus"]),
              checklist: asRecordArray(task.checklist).length
                ? task.checklist
                : nested?.checklist,
            };
          },
        );
        commit(() => setTasks(mergedTasks));
        commit(() => setReports(reportRows));
        commit(() =>
          setDailySchedule(
            scheduleRows.find(
              (schedule) => readString(schedule, ["date"]) === scheduleDate,
            ) ?? null,
          ),
        );
        commit(() => setTeam([]));
        commit(() => setEmployeeKpis(kpiRows));
      } else {
        const [taskRows, teamRows, kpiRows] = await Promise.all([
          listManagerActivityTasks(accessToken, { limit: 100 }),
          listManagerActivityAssignees(accessToken),
          listManagerEmployeeKpis(accessToken, {
            status: "APPROVED",
            limit: 100,
          }),
        ]);
        commit(() =>
          setTasks(
            taskRows
              .filter((task) => isTeamAssignedActivity(task))
              .map((task) => ({ ...task, report_id: reportIdOf(task) })),
          ),
        );
        commit(() => setTeam(teamRows));
        commit(() => setEmployeeKpis(kpiRows));
        commit(() => setDailySchedule(null));
      }
    } catch (errorObject) {
      commit(() =>
        setError(workflowFailure(errorObject, "Could not load activities.")),
      );
    } finally {
      commit(() => setLoading(false));
    }
  }, [begin, credential, mode]);

  React.useEffect(() => {
    if (actor.ready) void load();
    return invalidate;
  }, [actor.ready, load, invalidate]);

  const openPreviewFromEffect = React.useEffectEvent((report: AdminRecord) =>
    openReportPreview(report),
  );
  const openTaskFromEffect = React.useEffectEvent((task: AdminRecord) => {
    void openTask(task);
  });

  React.useEffect(() => {
    if (loading || !resumeCloseDayRef.current) return;
    const day = resumeCloseDayRef.current;
    const report = reportForDate(reports, day);
    resumeCloseDayRef.current = null;
    if (report) openPreviewFromEffect(report);
  }, [loading, reports]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") setCreateOpen(true);
    if (mode === "self" && params.get("tab") === "tasks") setTab("tasks");
    if (
      ["PLANNED", "IN_PROGRESS", "COMPLETED"].includes(
        params.get("status") ?? "",
      )
    ) {
      setStatusFilter(params.get("status") ?? "ALL");
    }
    const linkedKpiId = params.get("kpi");
    if (linkedKpiId)
      setForm((current) => ({ ...current, employee_kpi_id: linkedKpiId }));
  }, [mode]);

  const day = today();
  const groupedTasks = React.useMemo(
    () => partitionActivityTasks(tasks, day),
    [day, tasks],
  );
  const historyReports = React.useMemo(
    () => pastActivityReports(reports, day),
    [day, reports],
  );
  const todayReport = React.useMemo(
    () => reportForDate(reports, day),
    [day, reports],
  );
  const myEmployeeId = React.useMemo(
    () => viewerEmployeeId(reports, tasks),
    [reports, tasks],
  );

  function isManagerAssigned(task: AdminRecord) {
    return isManagerAssignedActivity(task, myEmployeeId);
  }

  const visibleRows = React.useMemo(() => {
    const lower = query.trim().toLowerCase();
    const matchesQuery = (row: AdminRecord) =>
      !lower || JSON.stringify(row).toLowerCase().includes(lower);
    if (tab === "history") {
      return historyReports.map(asReportRow).filter(matchesQuery);
    }
    const source =
      tab === "upcoming"
        ? groupedTasks.upcoming
        : tab === "assigned"
          ? tasks.filter((task) =>
              isManagerAssignedActivity(task, myEmployeeId),
            )
          : tab === "today"
            ? groupedTasks.today
            : tasks;
    return source.filter((task) => {
      if (statusFilter !== "ALL" && taskStatus(task) !== statusFilter)
        return false;
      if (priorityFilter !== "ALL" && taskPriority(task) !== priorityFilter)
        return false;
      if (reviewFilter !== "ALL" && taskReviewStatus(task) !== reviewFilter)
        return false;
      return matchesQuery(task);
    });
  }, [
    groupedTasks.today,
    groupedTasks.upcoming,
    historyReports,
    myEmployeeId,
    priorityFilter,
    query,
    reviewFilter,
    statusFilter,
    tab,
    tasks,
  ]);

  const boardColumns = React.useMemo(() => {
    const columns = [
      {
        id: "todo",
        label: "To-do",
        tone: "text-slate-600",
        rows: [] as AdminRecord[],
      },
      {
        id: "progress",
        label: "In progress",
        tone: "text-sky-700",
        rows: [] as AdminRecord[],
      },
      {
        id: "review",
        label: "On review",
        tone: "text-amber-700",
        rows: [] as AdminRecord[],
      },
      {
        id: "complete",
        label: "Complete",
        tone: "text-emerald-700",
        rows: [] as AdminRecord[],
      },
    ];
    visibleRows.forEach((task) => {
      const status = taskStatus(task);
      const reviewStatus = taskReviewStatus(task);
      if (
        ["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(status) ||
        reviewStatus === "PENDING"
      ) {
        columns[2].rows.push(task);
      } else if (
        ["COMPLETED", "APPROVED", "CLOSED"].includes(status) ||
        reviewStatus === "APPROVED"
      ) {
        columns[3].rows.push(task);
      } else if (status === "IN_PROGRESS") {
        columns[1].rows.push(task);
      } else {
        columns[0].rows.push(task);
      }
    });
    return columns;
  }, [visibleRows]);

  const timeline = React.useMemo(() => {
    const rows = visibleRows
      .filter((task) => !task.is_report_row)
      .map((task) => {
        const start = plannedDateTimeOf(task, "start");
        const end = plannedDateTimeOf(task, "end");
        return { task, start, end };
      })
      .sort(
        (left, right) =>
          (left.start?.getTime() ?? 0) - (right.start?.getTime() ?? 0),
      );

    const scheduled = rows.filter(
      (row): row is { task: AdminRecord; start: Date; end: Date } =>
        Boolean(row.start && row.end),
    );
    const unscheduled = rows.filter((row) => !row.start || !row.end);
    const shift = asRecord(dailySchedule?.shift);
    const shiftStart = minutesFromScheduleTime(
      shift?.start_time ?? shift?.startTime ?? dailySchedule?.start_time,
    );
    const shiftEnd = minutesFromScheduleTime(
      shift?.end_time ?? shift?.endTime ?? dailySchedule?.end_time,
    );
    const firstMinute = scheduled.length
      ? Math.min(
          ...scheduled.map((row) => minutesOfDay(row.start)),
          shiftStart ?? Number.POSITIVE_INFINITY,
        )
      : (shiftStart ?? 8 * 60);
    const lastMinute = scheduled.length
      ? Math.max(
          ...scheduled.map((row) => minutesOfDay(row.end)),
          shiftEnd ?? Number.NEGATIVE_INFINITY,
        )
      : (shiftEnd ?? 17 * 60);
    const startHour = Math.max(0, Math.floor(firstMinute / 60));
    const endHour = Math.min(24, Math.ceil(lastMinute / 60));
    const totalMinutes = Math.max(60, (endHour - startHour) * 60);

    return {
      rows: scheduled,
      unscheduled,
      startHour,
      endHour,
      totalMinutes,
      hours: Array.from(
        { length: endHour - startHour + 1 },
        (_, index) => startHour + index,
      ),
    };
  }, [dailySchedule, visibleRows]);

  const canAssign = team.length > 0;
  const filteredTeam = React.useMemo(() => {
    const needle = teamQuery.trim().toLowerCase();
    if (!needle) return team;
    return team.filter((member) =>
      personName(member, optionLabel(member)).toLowerCase().includes(needle),
    );
  }, [team, teamQuery]);

  const { begin: beginDetail, invalidate: invalidateDetail } =
    useWorkflowRequest(`${mode}:detail`);

  function clearSelected() {
    invalidateDetail();
    setSelected(null);
  }

  async function openTask(task: AdminRecord) {
    const { current } = beginDetail();
    const accessToken = token();
    const reportId = reportIdOf(task);
    if (accessToken && reportId) {
      try {
        const report =
          mode === "self"
            ? await getMyActivityReport(accessToken, reportId)
            : await getManagerActivityReport(accessToken, reportId);
        if (!current()) return;
        if (task.is_report_row) {
          setSelected(asReportRow((report ?? task) as AdminRecord));
          setTaskOutcome("");
          return;
        }
        const wanted = entryIdOf(task);
        const entry = asRecordArray(report?.entries).find(
          (candidate) => entryIdOf(candidate) === wanted,
        );
        const detail = entry
          ? {
              ...task,
              ...entry,
              report_id: reportId,
              activity_date: reportDateOf(report),
              activityDate: reportDateOf(report),
              report_status: reportStatusOf(report),
              taskReference:
                entry.taskReference ??
                entry.task_reference ??
                task.taskReference ??
                task.task_reference,
              task_reference:
                entry.task_reference ??
                entry.taskReference ??
                task.task_reference ??
                task.taskReference,
              externalReferenceType:
                entry.externalReferenceType ??
                entry.external_reference_type ??
                task.externalReferenceType ??
                task.external_reference_type,
              assignedByEmployeeId:
                entry.assignedByEmployeeId ??
                entry.assigned_by_employee_id ??
                task.assignedByEmployeeId ??
                task.assigned_by_employee_id,
              assignedBySnapshot:
                entry.assignedBySnapshot ??
                entry.assigned_by_snapshot ??
                task.assignedBySnapshot ??
                task.assigned_by_snapshot,
              employee_id:
                report?.employeeId ??
                report?.employee_id ??
                task.employee_id ??
                task.employeeId,
              employeeId:
                report?.employeeId ??
                report?.employee_id ??
                task.employeeId ??
                task.employee_id,
              comments: entry.comments ?? report?.comments,
              employee:
                report?.employeeSnapshot ??
                report?.employee_snapshot ??
                task.employee,
            }
          : {
              ...task,
              report_id: reportId,
              report_status: reportStatusOf(report) || reportStatusOf(task),
              employee_id:
                report?.employeeId ??
                report?.employee_id ??
                task.employee_id ??
                task.employeeId,
            };
        setSelected(detail);
        setTaskEditStatus(taskStatus(detail));
        setTaskOutcome(readString(detail, ["outcome"]));
        return;
      } catch (cause) {
        if (!current()) return;
        toast.error(
          cause instanceof Error
            ? cause.message
            : "The task details could not be loaded. The list snapshot is shown.",
        );
      }
    }
    setSelected({ ...task, report_id: reportId });
    setTaskEditStatus(taskStatus(task));
    setTaskOutcome(readString(task, ["outcome"]));
  }

  React.useEffect(() => {
    if (loading || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get("task") || params.get("highlight");
    if (!focusId || openedFocusRef.current === focusId) return;
    const match = tasks.find((task) => entryIdOf(task) === focusId);
    if (!match) return;
    openedFocusRef.current = focusId;
    const dated = reportDateOf(match);
    if (mode === "self" && dated && dated > today()) setTab("upcoming");
    else if (mode === "self") setTab("today");
    openTaskFromEffect(match);
  }, [loading, tasks, mode]);

  function addChecklistItem() {
    const item = checklistDraft.trim();
    if (!item) return;
    setChecklistItems((current) => [...current, item]);
    setChecklistDraft("");
  }

  function checklistPayload() {
    return checklistItems.map((title, index) => ({
      id: `item-${index + 1}`,
      title,
      completed: false,
    }));
  }

  function defaultCreateDate() {
    const closed = Boolean(todayReport) && !canCloseReport(todayReport);
    if (tab === "upcoming" || closed) return addIsoDays(today(), 1);
    return today();
  }

  function resetComposer() {
    setForm({
      activity_date: defaultCreateDate(),
      start_time: "09:00",
      end_time: "10:00",
      priority: "MEDIUM",
    });
    setChecklistDraft("");
    setChecklistItems([]);
    setEmployeeIds([]);
    setTeamQuery("");
    setCreateOpen(false);
    setAddWorkReason(null);
    setAudience(mode === "manager" ? "employee" : "self");
  }

  function openAddWorkForDay(day: string, reason: "close" | null = null) {
    setPreviewReport(null);
    clearSelected();
    setAudience("self");
    setAddWorkReason(reason);
    setForm({
      activity_date: day,
      start_time: "09:00",
      end_time: "10:00",
      priority: "MEDIUM",
    });
    setChecklistDraft("");
    setChecklistItems([]);
    if (mode === "self") setTab("today");
    setCreateOpen(true);
  }

  const { begin: beginMutation } = useWorkflowRequest(
    `${mode}:${JSON.stringify({ form, audience, employeeIds, checklistItems })}`,
  );
  React.useEffect(() => {
    setSaving(false);
  }, [credential, mode, beginMutation]);

  async function saveTask() {
    const validationResult = activityTaskSchema.safeParse({
      ...form,
      audience,
      employeeIds,
      checklistItems,
    });
    if (!validationResult.success) {
      setFormError(
        validationResult.error.issues
          .map(
            (issue) => issue.path.map(String).join(".") + ": " + issue.message,
          )
          .join("; "),
      );
      return;
    }
    if (saving) return;
    const accessToken = token();
    if (!accessToken) return;
    setFormError(null);
    const { current: isMutationCurrent } = beginMutation();
    setSaving(true);
    try {
      if (!form.title?.trim() || !form.description?.trim()) {
        throw new Error("Task name and notes are required.");
      }
      const targetDate = form.activity_date || today();
      const startTime = form.start_time || "09:00";
      const endTime = form.end_time || "10:00";
      const plannedStart = localTaskDateTime(targetDate, startTime);
      const plannedEnd = localTaskDateTime(targetDate, endTime);
      if (!plannedStart || !plannedEnd) {
        throw new Error("Choose a valid start and end time.");
      }
      if (new Date(plannedEnd).getTime() <= new Date(plannedStart).getTime()) {
        throw new Error("End time must be later than start time.");
      }
      const existing = reportForDate(reports, targetDate);
      if (existing && isClosedReportStatus(reportStatusOf(existing))) {
        throw new Error("That day is already closed. Pick another date.");
      }
      const relatedKpi = employeeKpis.find(
        (kpi) => rowId(kpi) === form.employee_kpi_id,
      );
      const canLinkRelatedKpi =
        Boolean(relatedKpi) &&
        (audience !== "employee" ||
          (employeeIds.length === 1 &&
            readString(relatedKpi, ["employeeId", "employee_id"]) ===
              employeeIds[0]));
      const taskPayload = {
        activity_date: targetDate,
        title: form.title.trim(),
        description: form.description.trim(),
        planned_start_time: plannedStart,
        planned_end_time: plannedEnd,
        due_date: form.due_date || undefined,
        expected_result: form.expected_result?.trim() || undefined,
        employee_kpi_id: canLinkRelatedKpi
          ? Number(form.employee_kpi_id)
          : undefined,
        priority: form.priority || "MEDIUM",
        checklist: checklistPayload(),
      };
      if (audience === "employee") {
        const assigneeIds = [
          ...new Set(
            employeeIds
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0),
          ),
        ];
        if (!assigneeIds.length)
          throw new Error("Choose at least one employee.");
        await createManagerActivityTask(accessToken, {
          ...taskPayload,
          employee_id: assigneeIds[0],
          employee_ids: assigneeIds,
        });
        if (!isMutationCurrent()) return;
        toast.success(
          assigneeIds.length === 1
            ? "Task assigned."
            : `Task assigned to ${assigneeIds.length} people.`,
        );
      } else {
        await createMyActivityTask(accessToken, taskPayload);
        if (!isMutationCurrent()) return;
        toast.success(
          taskPayload.activity_date > today()
            ? "Work added to an upcoming day."
            : "Work added to today.",
        );
        if (addWorkReason === "close") resumeCloseDayRef.current = targetDate;
        if (mode === "self" && taskPayload.activity_date > today())
          setTab("upcoming");
        else if (mode === "self") setTab("today");
      }
      resetComposer();
      await load();
      if (!isMutationCurrent()) return;
    } catch (errorObject) {
      if (!isMutationCurrent()) return;
      setFormError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not save task.",
      );
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not save task.",
      );
    } finally {
      if (isMutationCurrent()) setSaving(false);
    }
  }

  async function patchEntry(task: AdminRecord, data: AdminRecord) {
    const accessToken = token();
    const reportId = reportIdOf(task);
    const entryId = entryIdOf(task);
    if (!accessToken || !reportId || !entryId) {
      throw new Error(
        "This task is missing its report link. Refresh and try again.",
      );
    }
    await updateMyActivityEntry(accessToken, reportId, entryId, data);
  }

  function canEditTask(task: AdminRecord) {
    if (mode !== "self" || task.is_report_row) return false;
    const status = reportStatusOf(task);
    if (!status) return true;
    return isDraftReportStatus(status);
  }

  function canScheduleTask(task: AdminRecord) {
    if (task.is_report_row) return false;
    if (mode === "self") return canEditTask(task);
    if (
      !hasPermission(actor.permissionLabels, "work_activities:manager:review")
    )
      return false;
    const status = reportStatusOf(task);
    return !status || isDraftReportStatus(status);
  }

  function openScheduleTask(task: AdminRecord) {
    const start = plannedDateTimeOf(task, "start");
    const end = plannedDateTimeOf(task, "end");
    setScheduleTarget(task);
    setScheduleForm({
      date: reportDateOf(task) || taskDate(task) || today(),
      start: start ? timeFromMinutes(minutesOfDay(start)) : "09:00",
      end: end ? timeFromMinutes(minutesOfDay(end)) : "10:00",
    });
  }

  async function persistTimelinePosition(
    task: AdminRecord,
    date: string,
    startMinute: number,
    endMinute: number,
  ) {
    const accessToken = token();
    const entryId = entryIdOf(task);
    if (!accessToken || !entryId) {
      throw new Error(
        "This task is missing its activity link. Refresh and try again.",
      );
    }
    const plannedStart = localTaskDateTime(date, timeFromMinutes(startMinute));
    const plannedEnd = localTaskDateTime(date, timeFromMinutes(endMinute));
    if (
      !plannedStart ||
      !plannedEnd ||
      new Date(plannedEnd).getTime() <= new Date(plannedStart).getTime()
    ) {
      throw new Error("End time must be later than start time.");
    }
    const payload = {
      planned_start_time: plannedStart,
      planned_end_time: plannedEnd,
    };
    if (mode === "manager") {
      await updateManagerActivitySchedule(accessToken, entryId, payload);
    } else {
      await patchEntry(task, payload);
    }
  }

  async function saveSchedule() {
    if (!scheduleTarget || !canScheduleTask(scheduleTarget)) return;
    const start = localTaskDateTime(scheduleForm.date, scheduleForm.start);
    const end = localTaskDateTime(scheduleForm.date, scheduleForm.end);
    if (
      !start ||
      !end ||
      new Date(end).getTime() <= new Date(start).getTime()
    ) {
      toast.error("End time must be later than start time.");
      return;
    }
    setScheduleSaving(true);
    try {
      await persistTimelinePosition(
        scheduleTarget,
        scheduleForm.date,
        minutesOfDay(new Date(start)),
        minutesOfDay(new Date(end)),
      );
      toast.success("Task added to the timeline.");
      setScheduleTarget(null);
      await load();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not schedule the task.",
      );
    } finally {
      setScheduleSaving(false);
    }
  }

  function beginTimelineDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    task: AdminRecord,
    startMinute: number,
    endMinute: number,
  ) {
    if (!canScheduleTask(task)) return;
    const track = event.currentTarget.parentElement;
    if (!track) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const handle = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-timeline-resize]",
    );
    const mode =
      (handle?.dataset.timelineResize as TimelineDragMode | undefined) ??
      "move";
    const next: TimelineDrag = {
      key: entryIdOf(task) || rowId(task),
      task,
      mode,
      originX: event.clientX,
      trackWidth: track.getBoundingClientRect().width,
      originalStart: startMinute,
      originalEnd: endMinute,
      previewStart: startMinute,
      previewEnd: endMinute,
    };
    timelineMovedRef.current = false;
    timelineDragRef.current = next;
    setTimelineDrag(next);
  }

  function moveTimelineDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = timelineDragRef.current;
    if (!current || current.trackWidth <= 0) return;
    const delta =
      ((event.clientX - current.originX) / current.trackWidth) *
      timeline.totalMinutes;
    const snappedDelta = Math.round(delta / 15) * 15;
    const minimum = timeline.startHour * 60;
    const maximum = timeline.endHour * 60;
    const minDuration = 15;
    let previewStart = current.originalStart;
    let previewEnd = current.originalEnd;
    if (current.mode === "move") {
      const duration = current.originalEnd - current.originalStart;
      previewStart = Math.max(
        minimum,
        Math.min(maximum - duration, current.originalStart + snappedDelta),
      );
      previewEnd = previewStart + duration;
    } else if (current.mode === "resize-start") {
      previewStart = Math.max(
        minimum,
        Math.min(
          current.originalEnd - minDuration,
          current.originalStart + snappedDelta,
        ),
      );
    } else {
      previewEnd = Math.min(
        maximum,
        Math.max(
          current.originalStart + minDuration,
          current.originalEnd + snappedDelta,
        ),
      );
    }
    const next = { ...current, previewStart, previewEnd };
    if (
      previewStart !== current.originalStart ||
      previewEnd !== current.originalEnd
    )
      timelineMovedRef.current = true;
    timelineDragRef.current = next;
    setTimelineDrag(next);
  }

  async function endTimelineDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = timelineDragRef.current;
    if (!current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    timelineDragRef.current = null;
    setTimelineDrag(null);
    if (!timelineMovedRef.current) return;

    const entryId = entryIdOf(current.task);
    setTimelineSavingId(entryId);
    setTasks((items) =>
      items.map((item) =>
        entryIdOf(item) === entryId
          ? {
              ...item,
              planned_start_time: localTaskDateTime(
                reportDateOf(item) || taskDate(item) || today(),
                timeFromMinutes(current.previewStart),
              ),
              planned_end_time: localTaskDateTime(
                reportDateOf(item) || taskDate(item) || today(),
                timeFromMinutes(current.previewEnd),
              ),
              plannedStartTime: localTaskDateTime(
                reportDateOf(item) || taskDate(item) || today(),
                timeFromMinutes(current.previewStart),
              ),
              plannedEndTime: localTaskDateTime(
                reportDateOf(item) || taskDate(item) || today(),
                timeFromMinutes(current.previewEnd),
              ),
            }
          : item,
      ),
    );
    try {
      await persistTimelinePosition(
        current.task,
        reportDateOf(current.task) || taskDate(current.task) || today(),
        current.previewStart,
        current.previewEnd,
      );
      toast.success(
        `${current.mode === "move" ? "Moved" : "Resized"} to ${timeFromMinutes(current.previewStart)}–${timeFromMinutes(current.previewEnd)}.`,
      );
      await load();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not move the task.",
      );
      await load();
    } finally {
      setTimelineSavingId(null);
    }
  }

  async function toggleRowComplete(
    task: AdminRecord,
    event?: { stopPropagation: () => void },
  ) {
    event?.stopPropagation();
    if (!canEditTask(task)) return;
    const entryId = entryIdOf(task);
    const next = taskStatus(task) === "COMPLETED" ? "PLANNED" : "COMPLETED";
    setUpdatingTaskId(entryId);
    try {
      await patchEntry(task, {
        status: next,
        completion_percentage: next === "COMPLETED" ? 100 : 0,
      });
      toast.success(
        next === "COMPLETED" ? "Task marked complete." : "Task reopened.",
      );
      await load();
      if (selected && entryIdOf(selected) === entryId) {
        setSelected((current) =>
          current ? { ...current, status: next } : current,
        );
        setTaskEditStatus(next);
      }
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not update the task.",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function toggleChecklistItem(itemId: string) {
    if (!selected || !canEditTask(selected)) return;
    const previousChecklist = asRecordArray(selected.checklist);
    const nextChecklist = previousChecklist.map((item) =>
      String(item.id ?? item.title) === itemId
        ? { ...item, completed: item.completed !== true }
        : item,
    );
    const changedItem = nextChecklist.find(
      (item) => String(item.id ?? item.title) === itemId,
    );
    setSelected((current) =>
      current ? { ...current, checklist: nextChecklist } : current,
    );
    setUpdatingChecklistId(itemId);
    try {
      await patchEntry(selected, { checklist: nextChecklist });
      toast.success(
        changedItem?.completed === true
          ? "Checklist item completed."
          : "Checklist item reopened.",
      );
      await load();
      await openTask({
        ...selected,
        checklist: nextChecklist,
        report_id: reportIdOf(selected),
      });
    } catch (errorObject) {
      setSelected((current) =>
        current ? { ...current, checklist: previousChecklist } : current,
      );
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not update checklist.",
      );
    } finally {
      setUpdatingChecklistId(null);
    }
  }

  async function updateTaskStatus() {
    if (!selected || !canEditTask(selected)) return;
    try {
      await patchEntry(selected, {
        status: taskEditStatus,
        completion_percentage:
          taskEditStatus === "COMPLETED"
            ? 100
            : taskEditStatus === "IN_PROGRESS"
              ? 50
              : 0,
        outcome: taskOutcome.trim() || undefined,
      });
      toast.success("Progress saved.");
      setSelected((current) =>
        current
          ? {
              ...current,
              status: taskEditStatus,
              outcome: taskOutcome.trim() || current.outcome,
            }
          : current,
      );
      await load();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not update task.",
      );
    }
  }

  async function addComment() {
    const accessToken = token();
    const entryId = entryIdOf(selected);
    if (!accessToken || !entryId || !comment.trim()) return;
    setCommenting(true);
    try {
      if (mode === "manager")
        await addManagerActivityComment(accessToken, entryId, comment.trim());
      else await addMyActivityComment(accessToken, entryId, comment.trim());
      setComment("");
      toast.success("Comment added.");
      if (selected) await openTask(selected);
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not add comment.",
      );
    } finally {
      setCommenting(false);
    }
  }

  function workItemsForReport(report: AdminRecord) {
    const reportId = reportIdOf(report) || rowId(report);
    const entries = asRecordArray(
      report.entries ?? report.items ?? report.activities,
    );
    const fromTasks = tasks.filter((task) => reportIdOf(task) === reportId);
    return entries.length ? entries : fromTasks;
  }

  function openReportPreview(report: AdminRecord) {
    const work = workItemsForReport(report);
    const dayToClose = reportDateOf(report) || today();
    if (work.length === 0) {
      openAddWorkForDay(dayToClose, "close");
      return;
    }
    setPreviewSummary("");
    setPreviewEntryIds(defaultCloseEntryIds(work));
    setPreviewReport({ ...report, entries: work });
  }

  async function submitReport(report: AdminRecord) {
    const accessToken = token();
    const reportId = reportIdOf(report) || rowId(report);
    const work = asRecordArray(report.entries);
    const selected = work.filter((entry) =>
      previewEntryIds.includes(entryIdOf(entry) || rowId(entry)),
    );
    const dayToClose = reportDateOf(report);
    const issues = closeReportIssues({
      report,
      day: dayToClose,
      entryCount: selected.length,
      completedCount: selected.filter(
        (entry) => taskStatus(entry) === "COMPLETED",
      ).length,
      summary: previewSummary,
    });
    if (issues.length) {
      toast.error(issues[0]);
      return;
    }
    if (!accessToken || !reportId) return;
    setSubmitting(true);
    try {
      await submitMyActivityReport(accessToken, reportId, {
        employee_summary: previewSummary.trim(),
        client_request_id: newRequestId(),
        entry_ids: selected
          .map((entry) => Number(entryIdOf(entry) || rowId(entry)))
          .filter((id) => Number.isFinite(id)),
      });
      const keptOpen = work.length - selected.length;
      toast.success(
        keptOpen > 0
          ? `Closed ${formatDate(dayToClose)}. ${keptOpen} item${keptOpen === 1 ? "" : "s"} kept open.`
          : `Closed ${formatDate(dayToClose)}.`,
      );
      clearSelected();
      setPreviewReport(null);
      setTab(dayToClose === today() ? "today" : "history");
      await load();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not close this day.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function closeOnScreenDay() {
    if (!todayReport || workItemsForReport(todayReport).length === 0) {
      openAddWorkForDay(today(), "close");
      return;
    }
    if (!canCloseReport(todayReport)) {
      toast.error("Today is already closed.");
      return;
    }
    openReportPreview(todayReport);
  }

  const assignedBy = (task: AdminRecord) => {
    if (isManagerAssigned(task)) {
      return personName(
        task.assignedBySnapshot ?? task.assigned_by_snapshot,
        "Manager",
      );
    }
    return "You";
  };

  const photoForAssignee = (task: AdminRecord, who: string) => {
    if (who === "You") return resolveBackendMediaUrl(myPhotoUrl) || myPhotoUrl;
    if (mode === "manager") {
      return (
        photoFromRecord(task.employee) ||
        photoFromRecord(task.employeeSnapshot ?? task.employee_snapshot)
      );
    }
    return photoFromRecord(
      task.assignedBySnapshot ?? task.assigned_by_snapshot,
    );
  };

  const assignedCount = tasks.filter((task) =>
    isManagerAssignedActivity(task, myEmployeeId),
  ).length;
  const tabs: Array<{
    value: ListTab;
    label: string;
    count: number;
    icon: React.ReactNode;
  }> =
    mode === "self"
      ? [
          {
            value: "today",
            label: "Today",
            count: groupedTasks.today.length,
            icon: <CalendarDaysIcon className="size-3.5" />,
          },
          {
            value: "tasks",
            label: "All work",
            count: tasks.length,
            icon: <ClipboardListIcon className="size-3.5" />,
          },
          {
            value: "assigned",
            label: "Assigned to me",
            count: assignedCount,
            icon: <InboxIcon className="size-3.5" />,
          },
          {
            value: "upcoming",
            label: "Upcoming",
            count: groupedTasks.upcoming.length,
            icon: <Clock3Icon className="size-3.5" />,
          },
          {
            value: "history",
            label: "History",
            count: historyReports.length,
            icon: <HistoryIcon className="size-3.5" />,
          },
        ]
      : [
          {
            value: "tasks",
            label: "Team work",
            count: tasks.length,
            icon: <ClipboardListIcon className="size-3.5" />,
          },
        ];

  const todayCompleted = groupedTasks.today.filter(
    (task) => taskStatus(task) === "COMPLETED",
  ).length;
  const todayStatus =
    reportStatusOf(todayReport) || (groupedTasks.today.length ? "DRAFT" : "");
  const showTaskFilters = tab !== "history";
  const todayClosed = Boolean(todayReport) && !canCloseReport(todayReport);
  const currentMinute = minutesOfDay(new Date());
  const currentTimeLeft =
    ((currentMinute - timeline.startHour * 60) / timeline.totalMinutes) * 100;
  const showCurrentTime =
    tab === "today" && currentTimeLeft >= 0 && currentTimeLeft <= 100;

  const heroDescription =
    mode === "manager"
      ? "Work you assigned to your team. Their personal daily items stay in My activities."
      : tab === "upcoming"
        ? "Work filed on a later day. It will not be included when you close today."
        : tab === "assigned"
          ? "Work a manager assigned to you. Close it with the day it belongs to."
          : tab === "history"
            ? "Past days. Open a returned day to close it — this never submits a different date."
            : todayReport
              ? `${formatDate(day)} · ${statusLabel[todayStatus] ?? todayStatus} · ${todayCompleted} of ${groupedTasks.today.length} completed`
              : `${formatDate(day)} · nothing on today's report yet`;

  if (loading && !createOpen)
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <FluentLoadingIndicator />
        <p role="status">
          Loading this workflow and checking its available actions…
        </p>
      </section>
    );

  if (error && !loading && !createOpen)
    return (
      <section className="flex flex-col gap-4">
        <WorkflowGuide
          title="This workflow needs attention"
          unavailable={error}
          steps={[
            "Resolve the permission, setup, or network issue described above.",
            "Reload this view before continuing.",
          ]}
        />
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => void load()}
        >
          Reload workflow
        </button>
      </section>
    );

  return (
    <section className="min-w-0 space-y-5">
      <WorkflowGuide
        title="Plan and complete your work"
        steps={[
          "Create a task with its day, times, assignees, and optional checklist.",
          "Update progress and checklist items as you work.",
          "Record the outcome when completing a task.",
          "Review your daily summary before closing the day.",
        ]}
        unavailable={error}
      />
      <header className="flex flex-col gap-3 border-b border-border px-1 pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {mode === "manager" ? "Team activities" : "My activities"}
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {heroDescription}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {mode === "self" ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-primary"
                    aria-label="Activity guidance"
                  />
                }
              >
                <Info20Regular className="size-5" />
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="end"
                className="max-w-[min(22rem,calc(100vw-2rem))] whitespace-normal text-left leading-5"
              >
                Record daily work here. You can link related work to an approved
                KPI when useful, then close the day when your report is ready
                for review.
              </TooltipContent>
            </Tooltip>
          ) : null}
          {mode === "self" && tab === "today" ? (
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => void closeOnScreenDay()}
              disabled={submitting || todayClosed}
            >
              {submitting ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                <FileTextIcon className="size-4" />
              )}
              {todayClosed ? "Today closed" : "Close today"}
            </button>
          ) : null}
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void load()}
          >
            <FluentLoadingIndicator
              className={loading ? "size-4 animate-spin" : "hidden"}
            />
            <CircleDotIcon className={loading ? "hidden" : "size-4"} /> Refresh
          </button>
        </div>
      </header>

      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1 border-b border-border">
            {tabs.map(({ value, label, count, icon }) => {
              const active = tab === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    "group relative inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center justify-center">
                    {icon}
                  </span>
                  <span>{label}</span>
                  <span
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {tab !== "history" ? (
            <div className="flex shrink-0 items-center rounded-lg border border-border bg-muted/50 p-1">
              {(["timeline", "board", "list"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setWorkspaceView(view)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold capitalize transition",
                    workspaceView === view
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {view === "timeline" ? (
                    <Clock3Icon className="size-3.5" />
                  ) : view === "board" ? (
                    <Columns3Icon className="size-3.5" />
                  ) : (
                    <ListIcon className="size-3.5" />
                  )}
                  {view}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
          <FluentInput
            className="min-w-44 flex-1 xl:w-56 xl:flex-none"
            contentBefore={<SearchIcon className="size-4" aria-hidden="true" />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={
              tab === "history" ? "Search days..." : "Search work..."
            }
            aria-label={
              tab === "history" ? "Search activity history" : "Search work"
            }
          />
          {showTaskFilters ? (
            <Popover>
              <PopoverTrigger className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-xs transition hover:border-primary/30 hover:text-primary">
                <SlidersHorizontalIcon className="size-3.5" />
                Filters
                {[priorityFilter, statusFilter, reviewFilter].filter(
                  (value) => value !== "ALL",
                ).length ? (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {
                      [priorityFilter, statusFilter, reviewFilter].filter(
                        (value) => value !== "ALL",
                      ).length
                    }
                  </span>
                ) : null}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3 p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Filter work
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Narrow the board without hiding these controls.
                  </p>
                </div>
                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                  Priority
                  <FluentSelect
                    ariaLabel="Priority"
                    className="w-full"
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    options={[
                      { value: "ALL", label: "All priorities" },
                      { value: "URGENT", label: "Urgent" },
                      { value: "HIGH", label: "High" },
                      { value: "MEDIUM", label: "Medium" },
                      { value: "LOW", label: "Low" },
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                  Status
                  <FluentSelect
                    ariaLabel="Status"
                    className="w-full"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "ALL", label: "All statuses" },
                      { value: "PLANNED", label: "Not started" },
                      { value: "IN_PROGRESS", label: "In progress" },
                      { value: "COMPLETED", label: "Completed" },
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                  Review status
                  <FluentSelect
                    ariaLabel="Review status"
                    className="w-full"
                    value={reviewFilter}
                    onChange={setReviewFilter}
                    options={[
                      { value: "ALL", label: "All review statuses" },
                      { value: "NOT_REQUIRED", label: "No review" },
                      { value: "PENDING", label: "Pending" },
                      { value: "APPROVED", label: "Approved" },
                      { value: "RETURNED", label: "Returned" },
                      { value: "REJECTED", label: "Rejected" },
                    ]}
                  />
                </label>
                <button
                  type="button"
                  className="inline-flex h-8 w-full items-center justify-center rounded-md border border-border text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    setPriorityFilter("ALL");
                    setStatusFilter("ALL");
                    setReviewFilter("ALL");
                  }}
                >
                  Clear filters
                </button>
              </PopoverContent>
            </Popover>
          ) : null}
          {tab !== "history" ? (
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                setAudience(mode === "manager" ? "employee" : "self");
                setForm({
                  activity_date: defaultCreateDate(),
                  start_time: "09:00",
                  end_time: "10:00",
                  priority: "MEDIUM",
                });
                setChecklistDraft("");
                setChecklistItems([]);
                setCreateOpen(true);
              }}
            >
              <PlusIcon className="size-4" />{" "}
              {mode === "self" ? "Add work" : "Create task"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {tab !== "history" && workspaceView === "timeline" ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border bg-gradient-to-r from-muted/50 via-card to-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clock3Icon className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Work timeline
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  Drag a block to move it. Resize either edge in 15-minute
                  steps; the assigned time updates automatically.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {timeline.unscheduled.length ? (
                <Popover
                  open={unscheduledOpen}
                  onOpenChange={setUnscheduledOpen}
                >
                  <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[11px] font-semibold text-foreground shadow-xs transition hover:border-primary/35 hover:text-primary">
                    <PlusIcon className="size-3.5" /> Add unscheduled
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {timeline.unscheduled.length}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-0">
                    <div className="border-b border-border px-3 py-2.5">
                      <p className="text-sm font-semibold text-foreground">
                        Unscheduled work
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Choose a task, then set its time.
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-1.5">
                      {timeline.unscheduled.map(({ task }, index) => {
                        const editable = canScheduleTask(task);
                        return (
                          <div
                            key={entryIdOf(task) || rowId(task) || index}
                            className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/60"
                          >
                            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <ClipboardListIcon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-foreground">
                                {readString(task, ["title"], "Untitled task")}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                {formatDate(
                                  reportDateOf(task) || taskDate(task),
                                )}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={!editable}
                              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary px-2 text-[10px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
                              onClick={() => {
                                setUnscheduledOpen(false);
                                openScheduleTask(task);
                              }}
                              title={
                                editable
                                  ? "Add to timeline"
                                  : "This task can no longer be rescheduled"
                              }
                            >
                              <PlusIcon className="size-3" /> Add
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null}
              <span className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-xs">
                <span className="size-1.5 rounded-full bg-primary" />{" "}
                {timeline.rows.length} scheduled
              </span>
            </div>
          </div>
          <div className="overflow-x-auto p-3 sm:p-4">
            <div className="min-w-[860px] overflow-hidden rounded-xl border border-border/80 bg-background">
              <div className="grid grid-cols-[200px_minmax(640px,1fr)] border-b border-border bg-muted/35">
                <div className="flex items-center px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Work item
                </div>
                <div
                  className="relative h-12 border-l border-border/80 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)]"
                  style={{
                    backgroundSize: `${100 / Math.max(1, timeline.endHour - timeline.startHour)}% 100%`,
                  }}
                >
                  {timeline.hours.map((hour) => {
                    const left =
                      (((hour - timeline.startHour) * 60) /
                        timeline.totalMinutes) *
                      100;
                    return (
                      <span
                        key={hour}
                        className="absolute inset-y-0 flex items-center text-[10px] font-semibold tabular-nums text-muted-foreground"
                        style={{
                          left: `${left}%`,
                          transform:
                            hour === timeline.startHour
                              ? "translateX(8px)"
                              : hour === timeline.endHour
                                ? "translateX(-100%)"
                                : "translateX(-50%)",
                        }}
                      >
                        {new Date(2000, 0, 1, hour).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        <span className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-border" />
                      </span>
                    );
                  })}
                  {showCurrentTime ? (
                    <span
                      className="absolute inset-y-0 z-10 w-0.5 bg-primary/70 shadow-[0_0_8px_rgba(37,99,235,0.28)]"
                      style={{ left: `${currentTimeLeft}%` }}
                    >
                      <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                        Now
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
              {timeline.rows.map(({ task, start, end }, index) => {
                const key = entryIdOf(task) || rowId(task) || String(index);
                const activeDrag =
                  timelineDrag?.key === key ? timelineDrag : null;
                const startMinute =
                  activeDrag?.previewStart ?? minutesOfDay(start);
                const endMinute =
                  activeDrag?.previewEnd ??
                  Math.max(startMinute + 15, minutesOfDay(end));
                const left = Math.max(
                  0,
                  Math.min(
                    100,
                    ((startMinute - timeline.startHour * 60) /
                      timeline.totalMinutes) *
                      100,
                  ),
                );
                const width = Math.max(
                  3,
                  Math.min(
                    100 - left,
                    ((endMinute - startMinute) / timeline.totalMinutes) * 100,
                  ),
                );
                const who =
                  mode === "manager"
                    ? personName(task.employee)
                    : assignedBy(task);
                const priority = taskPriority(task);
                const isComplete = ["COMPLETED", "APPROVED", "CLOSED"].includes(
                  taskStatus(task),
                );
                const blockTone = isComplete
                  ? "border-emerald-400/70 bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-950 dark:from-emerald-950/70 dark:to-emerald-900/30 dark:text-emerald-100"
                  : priority === "URGENT" || priority === "HIGH"
                    ? "border-rose-400/70 bg-gradient-to-r from-rose-100 to-rose-50 text-rose-950 dark:from-rose-950/70 dark:to-rose-900/30 dark:text-rose-100"
                    : priority === "MEDIUM"
                      ? "border-sky-400/70 bg-gradient-to-r from-sky-100 to-sky-50 text-sky-950 dark:from-sky-950/70 dark:to-sky-900/30 dark:text-sky-100"
                      : "border-violet-400/70 bg-gradient-to-r from-violet-100 to-violet-50 text-violet-950 dark:from-violet-950/70 dark:to-violet-900/30 dark:text-violet-100";
                const editable = canScheduleTask(task);
                const savingPosition = timelineSavingId === entryIdOf(task);
                return (
                  <div
                    key={key}
                    className="group/row grid min-h-[84px] grid-cols-[200px_minmax(640px,1fr)] border-b border-border/70 last:border-b-0"
                  >
                    <button
                      type="button"
                      className="group min-w-0 border-r border-border/60 px-4 py-3 text-left transition hover:bg-primary/[0.035]"
                      onClick={() => void openTask(task)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            priority === "URGENT" || priority === "HIGH"
                              ? "bg-rose-500"
                              : priority === "MEDIUM"
                                ? "bg-amber-400"
                                : "bg-emerald-500",
                          )}
                        />
                        <span className="truncate text-xs font-semibold text-foreground group-hover:text-primary">
                          {readString(task, ["title"], "Untitled task")}
                        </span>
                      </span>
                      <span className="mt-1.5 block truncate pl-4 text-[10px] text-muted-foreground">
                        {who} ·{" "}
                        {statusLabel[taskStatus(task)] ?? taskStatus(task)}
                      </span>
                    </button>
                    <div
                      className="relative border-l border-border/80 bg-muted/15 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)] group-hover/row:bg-muted/30"
                      style={{
                        backgroundSize: `${100 / Math.max(1, timeline.endHour - timeline.startHour)}% 100%`,
                      }}
                    >
                      {showCurrentTime ? (
                        <span
                          className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-primary/35"
                          style={{ left: `${currentTimeLeft}%` }}
                        />
                      ) : null}
                      <button
                        type="button"
                        className={cn(
                          "group absolute top-4 flex h-12 min-w-20 touch-none items-center gap-2 overflow-hidden rounded-xl border px-3 text-left shadow-sm transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md",
                          blockTone,
                          editable
                            ? activeDrag?.mode === "resize-start" ||
                              activeDrag?.mode === "resize-end"
                              ? "cursor-ew-resize"
                              : "cursor-grab active:cursor-grabbing"
                            : "cursor-pointer",
                          activeDrag &&
                            "z-10 border-primary bg-primary/20 shadow-lg ring-2 ring-primary/20",
                        )}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        onPointerDown={(event) =>
                          beginTimelineDrag(event, task, startMinute, endMinute)
                        }
                        onPointerMove={moveTimelineDrag}
                        onPointerUp={(event) => void endTimelineDrag(event)}
                        onPointerCancel={() => {
                          timelineDragRef.current = null;
                          setTimelineDrag(null);
                        }}
                        onClick={(event) => {
                          if (timelineMovedRef.current) {
                            event.preventDefault();
                            timelineMovedRef.current = false;
                            return;
                          }
                          void openTask(task);
                        }}
                        title={
                          editable
                            ? "Drag to change the scheduled time"
                            : "Open task"
                        }
                      >
                        {editable ? (
                          <>
                            <span
                              data-timeline-resize="resize-start"
                              aria-label="Resize task start"
                              title="Drag to change start time"
                              className="absolute inset-y-0 left-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center bg-primary/15 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
                            >
                              <span className="h-4 w-0.5 rounded-full bg-primary/70" />
                            </span>
                            <span
                              data-timeline-resize="resize-end"
                              aria-label="Resize task end"
                              title="Drag to change end time"
                              className="absolute inset-y-0 right-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center bg-primary/15 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
                            >
                              <span className="h-4 w-0.5 rounded-full bg-primary/70" />
                            </span>
                          </>
                        ) : null}
                        <span
                          className={cn(
                            "h-6 w-1 shrink-0 rounded-full",
                            priority === "URGENT" || priority === "HIGH"
                              ? "bg-rose-500"
                              : priority === "MEDIUM"
                                ? "bg-amber-500"
                                : "bg-primary",
                          )}
                        />
                        {editable ? (
                          <GripVerticalIcon className="size-3.5 shrink-0 opacity-55" />
                        ) : null}
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">
                            {readString(task, ["title"], "Untitled task")}
                          </span>
                          <span className="block truncate text-[10px] font-medium text-foreground/65">
                            {savingPosition
                              ? "Saving…"
                              : `${timeFromMinutes(startMinute)} – ${timeFromMinutes(endMinute)}`}
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
              {!loading && timeline.rows.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 text-center">
                  <Clock3Icon className="size-7 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">
                    No scheduled work in this view
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Add a task with a start and end time to place it on the
                    timeline.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : tab !== "history" && workspaceView === "board" ? (
        <section className="space-y-4">
          <div className="w-full">
            <div className="grid w-full grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {boardColumns.map((column) => {
                const theme = {
                  todo: {
                    rail: "bg-border",
                    icon: "bg-muted text-muted-foreground",
                    shell: "from-muted/20",
                    subtitle: "Ready to begin",
                    iconNode: <ListIcon className="size-4" />,
                  },
                  progress: {
                    rail: "bg-border",
                    icon: "bg-muted text-muted-foreground",
                    shell: "from-muted/20",
                    subtitle: "Moving forward",
                    iconNode: <Clock3Icon className="size-4" />,
                  },
                  review: {
                    rail: "bg-border",
                    icon: "bg-muted text-muted-foreground",
                    shell: "from-muted/20",
                    subtitle: "Needs attention",
                    iconNode: <MessageSquareIcon className="size-4" />,
                  },
                  complete: {
                    rail: "bg-border",
                    icon: "bg-muted text-muted-foreground",
                    shell: "from-muted/20",
                    subtitle: "Finished work",
                    iconNode: <CheckCircle2Icon className="size-4" />,
                  },
                }[column.id] ?? {
                  rail: "bg-border",
                  icon: "bg-muted text-muted-foreground",
                  shell: "from-muted/20",
                  subtitle: "Work items",
                  iconNode: <CircleDotIcon className="size-4" />,
                };
                const share = visibleRows.length
                  ? Math.round((column.rows.length / visibleRows.length) * 100)
                  : 0;
                return (
                  <section
                    key={column.id}
                    className={cn(
                      "min-w-0 overflow-hidden rounded-2xl border border-border bg-gradient-to-b to-card",
                      theme.shell,
                    )}
                  >
                    <header className="border-b border-border/70 px-3.5 pb-3 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "inline-flex size-8 shrink-0 items-center justify-center rounded-xl",
                              theme.icon,
                            )}
                          >
                            {theme.iconNode}
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-foreground">
                              {column.label}
                            </h3>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {theme.subtitle}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-bold tabular-nums text-foreground">
                          {column.rows.length}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-background hover:text-foreground"
                            aria-label={`${column.label} column actions`}
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-40">
                            <DropdownMenuItem
                              onClick={() => {
                                setStatusFilter(
                                  column.id === "progress"
                                    ? "IN_PROGRESS"
                                    : column.id === "complete"
                                      ? "COMPLETED"
                                      : column.id === "todo"
                                        ? "PLANNED"
                                        : "ALL",
                                );
                                setReviewFilter(
                                  column.id === "review" ? "PENDING" : "ALL",
                                );
                              }}
                            >
                              <SparklesIcon className="size-3.5" /> Show only
                              this column
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setStatusFilter("ALL");
                                setReviewFilter("ALL");
                              }}
                            >
                              <Columns3Icon className="size-3.5" /> Show all
                              columns
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-background/80">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            theme.rail,
                          )}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </header>
                    <div className="min-h-64 space-y-3 p-3">
                      {column.rows.map((task) => {
                        const status = taskStatus(task);
                        const priority = taskPriority(task);
                        const due = dueMeta(
                          plannedDueDateOf(task) || taskDate(task),
                        );
                        const assigned = isManagerAssigned(task);
                        const who =
                          mode === "manager"
                            ? personName(task.employee)
                            : assignedBy(task);
                        const progress = checklistProgress(task);
                        const editable = canEditTask(task);
                        const scheduled = Boolean(
                          plannedDateTimeOf(task, "start") &&
                          plannedDateTimeOf(task, "end"),
                        );
                        const taskKey =
                          entryIdOf(task) ||
                          reportIdOf(task) ||
                          `${readString(task, ["title"])}-${String(taskDate(task))}`;
                        const priorityStyle =
                          "border-border bg-muted/60 text-muted-foreground";
                        return (
                          <article
                            key={taskKey}
                            className="group relative overflow-hidden rounded-xl border border-border bg-card transition-colors duration-200 hover:border-border/80"
                          >
                            <div className="flex items-center justify-between gap-2 pl-3.5 pr-2.5 pt-2.5">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold capitalize",
                                  priorityStyle,
                                )}
                              >
                                {priority.toLowerCase()}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="inline-flex rounded-full bg-muted px-2 py-1 text-[10px] font-medium leading-4 text-muted-foreground">
                                  {statusLabel[status] ??
                                    status.replaceAll("_", " ")}
                                </span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-70 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                                    aria-label="Task actions"
                                  >
                                    <MoreHorizontalIcon className="size-4" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="min-w-40"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => void openTask(task)}
                                    >
                                      <FileTextIcon className="size-3.5" /> View
                                      details
                                    </DropdownMenuItem>
                                    {!scheduled ? (
                                      <DropdownMenuItem
                                        disabled={!canScheduleTask(task)}
                                        onClick={() => openScheduleTask(task)}
                                      >
                                        <Clock3Icon className="size-3.5" /> Add
                                        to timeline
                                      </DropdownMenuItem>
                                    ) : null}
                                    <DropdownMenuItem
                                      disabled={
                                        !editable ||
                                        updatingTaskId === entryIdOf(task)
                                      }
                                      onClick={(event) =>
                                        void toggleRowComplete(task, event)
                                      }
                                    >
                                      <CheckCircle2Icon className="size-3.5" />
                                      {status === "COMPLETED"
                                        ? "Reopen task"
                                        : "Mark complete"}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="block w-full px-3.5 pb-3 pt-2 text-left"
                              onClick={() => void openTask(task)}
                            >
                              <h4 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-primary">
                                {readString(task, ["title"], "Untitled task")}
                              </h4>
                              <p className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
                                {readString(
                                  task,
                                  [
                                    "description",
                                    "expectedResult",
                                    "expected_result",
                                  ],
                                  "No additional instructions.",
                                )}
                              </p>
                              {progress ? (
                                <div className="mt-3">
                                  <div className="mb-1.5 flex items-center justify-between text-[10px]">
                                    <span className="font-medium text-muted-foreground">
                                      Checklist
                                    </span>
                                    <span className="font-semibold tabular-nums text-foreground">
                                      {progress.label}
                                    </span>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-foreground/50 transition-all"
                                      style={{
                                        width: `${(progress.done / progress.total) * 100}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </button>
                            <footer className="flex items-center justify-between gap-2 border-t border-border/70 bg-muted/20 px-3 py-2.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <Avatar
                                  name={who}
                                  photoUrl={photoForAssignee(task, who)}
                                  className="size-7 text-[9px] ring-2 ring-background"
                                />
                                <span className="truncate text-[10px] font-medium text-muted-foreground">
                                  {assigned
                                    ? mode === "manager"
                                      ? "Assigned to"
                                      : "Assigned by"
                                    : "My work"}{" "}
                                  · {who}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                                  <CalendarDaysIcon className="size-3" />
                                  {due.label}
                                </span>
                                <button
                                  type="button"
                                  className="inline-flex size-7 items-center justify-center rounded-lg border border-border bg-background text-primary transition hover:border-primary/40 hover:bg-primary/10 disabled:opacity-50"
                                  aria-label={
                                    status === "COMPLETED"
                                      ? "Mark not started"
                                      : "Mark complete"
                                  }
                                  disabled={
                                    !editable ||
                                    updatingTaskId === entryIdOf(task)
                                  }
                                  onClick={(event) =>
                                    void toggleRowComplete(task, event)
                                  }
                                >
                                  {updatingTaskId === entryIdOf(task) ? (
                                    <FluentLoadingIndicator className="size-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2Icon className="size-3.5" />
                                  )}
                                </button>
                              </div>
                            </footer>
                          </article>
                        );
                      })}
                      {!loading && column.rows.length === 0 ? (
                        <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/65 px-4 text-center">
                          <span
                            className={cn(
                              "inline-flex size-9 items-center justify-center rounded-xl",
                              theme.icon,
                            )}
                          >
                            {theme.iconNode}
                          </span>
                          <p className="mt-3 text-xs font-semibold text-foreground">
                            Nothing here yet
                          </p>
                          <p className="mt-1 max-w-40 text-[10px] leading-4 text-muted-foreground">
                            {column.id === "todo"
                              ? "New work will appear here when it is ready to start."
                              : column.id === "progress"
                                ? "Work moves here once someone starts it."
                                : column.id === "review"
                                  ? "Completed work waiting for review appears here."
                                  : "Finished work will collect here."}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-border dark:bg-card">
          {tab === "history" ? (
            <div className="hidden grid-cols-[minmax(120px,0.7fr)_minmax(180px,1.4fr)_88px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid">
              <span>Date</span>
              <span>Work on that day</span>
              <span>Work / review</span>
            </div>
          ) : (
            <div className="hidden grid-cols-[28px_minmax(160px,1.5fr)_minmax(120px,0.8fr)_88px_88px_72px_88px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid">
              <span />
              <span>Task name</span>
              <span>{mode === "manager" ? "Assigned to" : "Assigned by"}</span>
              <span>Start date</span>
              <span>Due date</span>
              <span>Priority</span>
              <span>Status</span>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-14 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" /> Loading
              activities...
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <ClipboardListIcon className="size-8 text-muted-foreground/60" />
              <p className="font-medium">
                {tab === "history"
                  ? "No past days yet"
                  : tab === "upcoming"
                    ? "No upcoming work"
                    : tab === "assigned"
                      ? "Nothing assigned to you"
                      : "Nothing on today's report"}
              </p>
              <p className="text-sm text-muted-foreground">
                {tab === "history"
                  ? "Closed and unclosed previous days will show up here."
                  : tab === "upcoming"
                    ? "Add work for a later date if it should not go into today's close-out."
                    : tab === "assigned"
                      ? "When a manager assigns you work, it will show up here."
                      : mode === "manager"
                        ? "Assign work to your team to see it here. Personal daily work stays in My activities."
                        : tab === "today"
                          ? "Select Add work to record today’s activity. When your report is ready, select Close today to send it for review."
                          : "Add work for today, or wait for a manager to assign something."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleRows.map((task) => {
                if (tab === "history") {
                  const entries = asRecordArray(task.entries);
                  const dated = reportDateOf(task);
                  return (
                    <button
                      type="button"
                      key={reportIdOf(task) || dated}
                      className="grid w-full grid-cols-[minmax(0,1fr)] items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 lg:grid-cols-[minmax(120px,0.7fr)_minmax(180px,1.4fr)_88px]"
                      onClick={() => void openTask(task)}
                    >
                      <span className="font-medium text-slate-900">
                        {formatDate(dated)}
                      </span>
                      <span className="text-sm text-slate-600">
                        {entries.length
                          ? `${entries.length} work item${entries.length === 1 ? "" : "s"}`
                          : "No work items"}
                        {canCloseReport(task) ? " · still open" : ""}
                      </span>
                      <span className="hidden lg:block">
                        <StatusPill value={reportStatusOf(task) || "DRAFT"} />
                      </span>
                    </button>
                  );
                }
                const status = taskStatus(task);
                const priority = taskPriority(task);
                const due = dueMeta(plannedDueDateOf(task) || taskDate(task));
                const start = plannedStartDateOf(task);
                const assigned = isManagerAssigned(task);
                const who =
                  mode === "manager"
                    ? personName(task.employee)
                    : assignedBy(task);
                const progress = checklistProgress(task);
                const editable = canEditTask(task);
                return (
                  <div
                    key={
                      entryIdOf(task) ||
                      reportIdOf(task) ||
                      `${readString(task, ["title"])}-${String(taskDate(task))}`
                    }
                    className="grid w-full grid-cols-[28px_minmax(0,1fr)] items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 lg:grid-cols-[28px_minmax(160px,1.5fr)_minmax(120px,0.8fr)_88px_88px_72px_88px]"
                  >
                    <button
                      type="button"
                      className="flex size-4 items-center justify-center rounded border border-slate-300 text-primary"
                      aria-label={
                        status === "COMPLETED"
                          ? "Mark not started"
                          : "Mark complete"
                      }
                      disabled={!editable || updatingTaskId === entryIdOf(task)}
                      onClick={(event) => void toggleRowComplete(task, event)}
                    >
                      {updatingTaskId === entryIdOf(task) ? (
                        <FluentLoadingIndicator className="size-3 animate-spin" />
                      ) : (
                        <CheckCircle2Icon
                          className={
                            status === "COMPLETED" ? "size-3" : "hidden"
                          }
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => void openTask(task)}
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-slate-900">
                          {readString(task, ["title"], "Untitled task")}
                        </span>
                        {assigned ? (
                          <span className="rounded-full bg-sky-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-700">
                            Assigned
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                            My work
                          </span>
                        )}
                        {progress ? (
                          <span className="text-[10px] text-slate-500">
                            {progress.label}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500 lg:hidden">
                        {who} · {due.label}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="hidden min-w-0 items-center gap-1.5 truncate text-xs text-slate-600 lg:flex"
                      onClick={() => void openTask(task)}
                    >
                      <Avatar
                        name={who}
                        photoUrl={photoForAssignee(task, who)}
                        className="size-6 text-[10px]"
                      />
                      <span className="min-w-0 truncate">{who}</span>
                    </button>
                    <button
                      type="button"
                      className="hidden text-left text-xs text-slate-700 lg:block"
                      onClick={() => void openTask(task)}
                    >
                      {start ? formatDate(start) : ""}
                    </button>
                    <button
                      type="button"
                      className="hidden text-left text-xs lg:block"
                      onClick={() => void openTask(task)}
                    >
                      <span className="block text-slate-700">
                        {plannedDueDateOf(task)
                          ? formatDate(plannedDueDateOf(task))
                          : ""}
                      </span>
                      {plannedDueDateOf(task) ? (
                        <span
                          className={cn(
                            "text-[10px]",
                            due.tone === "danger"
                              ? "text-rose-600"
                              : due.tone === "warn"
                                ? "text-amber-600"
                                : "text-slate-500",
                          )}
                        >
                          {due.label}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="hidden items-center gap-1 text-xs text-slate-700 lg:flex"
                      onClick={() => void openTask(task)}
                    >
                      <PriorityDot priority={priority} />{" "}
                      {priority.charAt(0) + priority.slice(1).toLowerCase()}
                    </button>
                    <button
                      type="button"
                      className="hidden lg:block"
                      onClick={() => void openTask(task)}
                    >
                      <span className="flex flex-col items-start gap-1">
                        <StatusPill value={status} />
                        {taskReviewStatus(task) !== "NOT_REQUIRED" ? (
                          <StatusPill value={taskReviewStatus(task)} />
                        ) : null}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {scheduleTarget ? (
        <Dialog
          open={Boolean(scheduleTarget)}
          onOpenChange={(open) => !open && setScheduleTarget(null)}
        >
          <DialogPopup
            from="bottom"
            className="max-w-md overflow-hidden p-0"
            showCloseButton
          >
            <DialogHeader className="mb-0 border-b border-border px-4 pb-3 pt-4 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                Timeline
              </p>
              <DialogTitle className="pr-8 text-lg">
                Schedule this task
              </DialogTitle>
              <DialogDescription className="line-clamp-2">
                {readString(scheduleTarget, ["title"], "Untitled task")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/35 px-3 py-2.5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDaysIcon className="size-4" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Work day
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDate(scheduleForm.date)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid min-w-0 gap-1.5 text-xs font-medium text-foreground">
                  Starts at
                  <TimeClockPicker
                    value={scheduleForm.start}
                    onChange={(value) =>
                      setScheduleForm((current) => ({
                        ...current,
                        start: value,
                      }))
                    }
                    placeholder="Start time"
                    aria-label="Timeline start time"
                    className="h-10 rounded-lg px-3 text-sm"
                  />
                </label>
                <label className="grid min-w-0 gap-1.5 text-xs font-medium text-foreground">
                  Ends at
                  <TimeClockPicker
                    value={scheduleForm.end}
                    onChange={(value) =>
                      setScheduleForm((current) => ({ ...current, end: value }))
                    }
                    placeholder="End time"
                    aria-label="Timeline end time"
                    className="h-10 rounded-lg px-3 text-sm"
                  />
                </label>
              </div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                After adding it, drag the task bar left or right to adjust the
                time in 15-minute steps.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              <button
                type="button"
                className={`${secondaryButtonClass} w-full justify-center sm:w-auto`}
                onClick={() => setScheduleTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${primaryButtonClass} w-full justify-center sm:w-auto`}
                onClick={() => void saveSchedule()}
                disabled={scheduleSaving}
              >
                {scheduleSaving ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : (
                  <Clock3Icon className="size-4" />
                )}
                Add to timeline
              </button>
            </div>
          </DialogPopup>
        </Dialog>
      ) : null}

      {createOpen ? (
        <Dialog
          open={createOpen}
          onOpenChange={(next) => {
            if (!saving) setCreateOpen(next);
          }}
        >
          <DialogPopup
            from="bottom"
            className="flex max-h-[min(94dvh,52rem)] max-w-2xl flex-col overflow-hidden p-0"
            showCloseButton
          >
            <DialogHeader className="mb-0 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                {mode === "self" ? "Add work" : "Create task"}
              </p>
              <DialogTitle className="pr-8 text-lg sm:text-xl">
                {audience === "employee"
                  ? "Assign planned work"
                  : mode === "self"
                    ? "Add work to a day"
                    : "Create a task"}
              </DialogTitle>
              <DialogDescription>
                {addWorkReason === "close"
                  ? `Add at least one work item for ${formatDate(form.activity_date || today())}, then you can close that day.`
                  : mode === "self"
                    ? "Set the work day and time range so it appears correctly on your timeline."
                    : "Assign the task, its time window, and checklist to one or several people."}
              </DialogDescription>
            </DialogHeader>
            <ValidatedWorkflowForm
              key={audience}
              saving={saving}
              submitError={formError}
              onSubmit={saveTask}
              validation={{
                schema: activityTaskSchema,
                input: { ...form, audience, employeeIds, checklistItems },
              }}
              description="Describe the work, choose its schedule and assignees, then review before creating the task."
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {audience === "employee" ? (
                    <div className="grid gap-1.5 text-sm sm:col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Assign to</span>
                        <span className="text-xs text-slate-500">
                          {employeeIds.length
                            ? `${employeeIds.length} of ${team.length} selected`
                            : `Select one, several, or all ${team.length} people`}
                        </span>
                      </div>
                      {!canAssign ? (
                        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          No employees in your reporting scope
                        </p>
                      ) : (
                        <div className="overflow-hidden rounded-md border border-slate-300">
                          <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1.5">
                            <SearchIcon className="size-4 shrink-0 text-slate-400" />
                            <input
                              className="min-w-28 flex-1 bg-transparent text-sm outline-none"
                              value={teamQuery}
                              onChange={(event) =>
                                setTeamQuery(event.target.value)
                              }
                              placeholder="Search team members"
                            />
                            <button
                              type="button"
                              className="shrink-0 text-xs font-medium text-sky-700 hover:underline"
                              onClick={() => {
                                const visibleIds = filteredTeam
                                  .map((member) => rowId(member))
                                  .filter(Boolean);
                                const allSelected =
                                  visibleIds.length > 0 &&
                                  visibleIds.every((id) =>
                                    employeeIds.includes(id),
                                  );
                                setEmployeeIds((current) =>
                                  allSelected
                                    ? current.filter(
                                        (id) => !visibleIds.includes(id),
                                      )
                                    : [...new Set([...current, ...visibleIds])],
                                );
                              }}
                            >
                              {filteredTeam.length > 0 &&
                              filteredTeam.every((member) =>
                                employeeIds.includes(rowId(member)),
                              )
                                ? "Clear visible"
                                : "Select visible"}
                            </button>
                            <button
                              type="button"
                              className="shrink-0 text-xs font-medium text-sky-700 hover:underline"
                              onClick={() => {
                                const ids = team
                                  .map((member) => rowId(member))
                                  .filter(Boolean);
                                const allSelected =
                                  ids.length > 0 &&
                                  ids.every((id) => employeeIds.includes(id));
                                setEmployeeIds(allSelected ? [] : ids);
                              }}
                            >
                              {team.length > 0 &&
                              team.every((member) =>
                                employeeIds.includes(rowId(member)),
                              )
                                ? "Clear all"
                                : "Select all"}
                            </button>
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            {filteredTeam.map((member) => {
                              const id = rowId(member);
                              const checked = employeeIds.includes(id);
                              return (
                                <label
                                  key={id}
                                  className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    className="size-4 accent-sky-700"
                                    checked={checked}
                                    onChange={() =>
                                      setEmployeeIds((current) =>
                                        checked
                                          ? current.filter(
                                              (item) => item !== id,
                                            )
                                          : [...current, id],
                                      )
                                    }
                                  />
                                  <Avatar
                                    name={personName(
                                      member,
                                      optionLabel(member),
                                    )}
                                    photoUrl={photoFromRecord(member)}
                                    className="size-6 text-[10px]"
                                  />
                                  <span className="min-w-0 flex-1 truncate">
                                    {personName(member, optionLabel(member))}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <Avatar name="You" photoUrl={myPhotoUrl} /> Assigned to
                      you
                    </div>
                  )}
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Task name</span>
                    <input
                      className={inputClass}
                      value={form.title ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="e.g. Prepare monthly attendance summary"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      {mode === "self"
                        ? "Which day is this for?"
                        : "Start date"}
                    </span>
                    <DatePickerPresets
                      value={form.activity_date ?? today()}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          activity_date: value,
                        }))
                      }
                      placeholder="Select the day"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    <label className="grid min-w-0 gap-1.5 text-sm">
                      <span className="font-medium">Starts at</span>
                      <TimeClockPicker
                        value={form.start_time ?? "09:00"}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            start_time: value,
                          }))
                        }
                        placeholder="Start time"
                        aria-label="Task start time"
                        className="h-10 rounded-md px-3 text-sm"
                      />
                    </label>
                    <label className="grid min-w-0 gap-1.5 text-sm">
                      <span className="font-medium">Ends at</span>
                      <TimeClockPicker
                        value={form.end_time ?? "10:00"}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            end_time: value,
                          }))
                        }
                        placeholder="End time"
                        aria-label="Task end time"
                        className="h-10 rounded-md px-3 text-sm"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      Due date{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                    </span>
                    <DatePickerPresets
                      value={form.due_date ?? ""}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, due_date: value }))
                      }
                      placeholder="Select due date"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      Related KPI{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                    </span>
                    <FluentSelect
                      ariaLabel="Related KPI"
                      className="w-full"
                      value={form.employee_kpi_id ?? ""}
                      placeholder="No related KPI"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          employee_kpi_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "No related KPI" },
                        ...employeeKpis
                          .filter((kpi) => {
                            if (audience !== "employee") return true;
                            if (employeeIds.length !== 1) return false;
                            return (
                              readString(kpi, ["employeeId", "employee_id"]) ===
                              employeeIds[0]
                            );
                          })
                          .map((kpi) => ({
                            value: rowId(kpi),
                            label: optionLabel(kpi),
                          })),
                      ]}
                    />
                    {audience === "employee" && employeeIds.length !== 1 ? (
                      <span className="text-xs text-slate-500">
                        Select one employee to link this task to a KPI.
                      </span>
                    ) : null}
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Priority</span>
                    <FluentSelect
                      ariaLabel="Priority"
                      className="w-full"
                      value={form.priority ?? "MEDIUM"}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, priority: value }))
                      }
                      options={[
                        { value: "LOW", label: "Low" },
                        { value: "MEDIUM", label: "Medium" },
                        { value: "HIGH", label: "High" },
                        { value: "URGENT", label: "Urgent" },
                      ]}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Notes</span>
                    <Textarea
                      className={`${inputClass} min-h-24 py-2`}
                      value={form.description ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="What should be delivered?"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">
                      Expected result{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                    </span>
                    <Textarea
                      className={`${inputClass} min-h-20 py-2`}
                      value={form.expected_result ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          expected_result: event.target.value,
                        }))
                      }
                      placeholder="Describe the result that will count as complete."
                    />
                  </label>
                  <div className="grid content-start gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">
                      Checklist{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                    </span>
                    <div className="flex min-w-0 gap-2">
                      <input
                        className={`${inputClass} min-w-0 flex-1`}
                        value={checklistDraft}
                        onChange={(event) =>
                          setChecklistDraft(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addChecklistItem();
                        }}
                        placeholder="Add a checklist item"
                        aria-label="Checklist item"
                      />
                      <button
                        type="button"
                        className={`${secondaryButtonClass} shrink-0`}
                        onClick={addChecklistItem}
                        disabled={!checklistDraft.trim()}
                      >
                        <PlusIcon className="size-4" /> Add
                      </button>
                    </div>
                    {checklistItems.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2"
                      >
                        <CheckCircle2Icon className="size-4 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1 truncate">{item}</span>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          onClick={() =>
                            setChecklistItems((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          aria-label={`Remove ${item}`}
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {formError ? (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
            </ValidatedWorkflowForm>
            <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              <button
                type="button"
                className={`${secondaryButtonClass} w-full justify-center sm:w-auto`}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
            </div>
          </DialogPopup>
        </Dialog>
      ) : null}

      {previewReport ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={() => setPreviewReport(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const closeDate = reportDateOf(previewReport);
              const entries = asRecordArray(previewReport.entries);
              const selectedEntries = entries.filter((entry) =>
                previewEntryIds.includes(entryIdOf(entry) || rowId(entry)),
              );
              const deferred = entries.filter(
                (entry) =>
                  !previewEntryIds.includes(entryIdOf(entry) || rowId(entry)),
              );
              const limits = policyLimits(previewReport);
              const issues = closeReportIssues({
                report: previewReport,
                day: closeDate,
                entryCount: selectedEntries.length,
                completedCount: selectedEntries.filter(
                  (entry) => taskStatus(entry) === "COMPLETED",
                ).length,
                summary: previewSummary,
              });
              function toggleCloseEntry(entry: AdminRecord) {
                const id = entryIdOf(entry) || rowId(entry);
                if (!id || !isCloseableActivityStatus(taskStatus(entry)))
                  return;
                setPreviewEntryIds((current) =>
                  current.includes(id)
                    ? current.filter((item) => item !== id)
                    : [...current, id],
                );
              }
              return (
                <>
                  <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
                        Close this day
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900">
                        {formatDate(closeDate)}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Pick the work to submit. In-progress items stay open and
                        move to the next day.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                      onClick={() => setPreviewReport(null)}
                    >
                      <XIcon className="size-5" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <StatusPill
                        value={readString(previewReport, ["status"], "DRAFT")}
                      />
                      <span className="text-slate-500">
                        {selectedEntries.length} selected · {deferred.length}{" "}
                        kept open
                      </span>
                      <span className="text-slate-500">
                        Need {limits.minCompleted} complete · cutoff{" "}
                        {limits.cutoff}
                      </span>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Submit these
                      </p>
                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                        {entries.map((entry) => {
                          const id = entryIdOf(entry) || rowId(entry);
                          const closeable = isCloseableActivityStatus(
                            taskStatus(entry),
                          );
                          const checked = previewEntryIds.includes(id);
                          return (
                            <label
                              key={id}
                              className={cn(
                                "flex items-start gap-3 px-3 py-2.5",
                                closeable
                                  ? "cursor-pointer"
                                  : "cursor-not-allowed bg-slate-50",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 size-4 accent-sky-700"
                                checked={checked}
                                disabled={!closeable}
                                onChange={() => toggleCloseEntry(entry)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-slate-900">
                                  {readString(
                                    entry,
                                    ["title"],
                                    "Untitled task",
                                  )}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                                  {closeable
                                    ? readString(
                                        entry,
                                        ["description"],
                                        "No notes",
                                      )
                                    : "In progress — this stays open and will not be locked."}
                                </p>
                              </div>
                              <StatusPill value={taskStatus(entry)} />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">
                        Summary for your manager
                      </span>
                      <Textarea
                        className={`${inputClass} min-h-20 py-2`}
                        value={previewSummary}
                        onChange={(event) =>
                          setPreviewSummary(event.target.value)
                        }
                        placeholder="What should your manager know about this day?"
                      />
                    </label>
                    {issues.length ? (
                      <ul className="space-y-1 text-sm text-rose-700">
                        {issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => setPreviewReport(null)}
                    >
                      Back
                    </button>
                    {entries.filter((entry) =>
                      isCloseableActivityStatus(taskStatus(entry)),
                    ).length === 0 ? (
                      <button
                        type="button"
                        className={primaryButtonClass}
                        onClick={() => openAddWorkForDay(closeDate, "close")}
                      >
                        <PlusIcon className="size-4" /> Add a work item
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={primaryButtonClass}
                        onClick={() => void submitReport(previewReport)}
                        disabled={submitting || issues.length > 0}
                      >
                        {submitting ? (
                          <FluentLoadingIndicator className="size-4 animate-spin" />
                        ) : (
                          <SendIcon className="size-4" />
                        )}
                        Close {formatDate(closeDate)}
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {selected ? (
        <Dialog
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) clearSelected();
          }}
        >
          <DialogPopup
            from="bottom"
            className="flex max-h-[min(90dvh,50rem)] max-w-2xl flex-col overflow-hidden p-0"
            showCloseButton
          >
            <DialogHeader className="mb-0 gap-2 px-5 pb-4 pt-5">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  selected.is_report_row
                    ? "bg-amber-50 text-amber-800"
                    : isManagerAssigned(selected)
                      ? "bg-sky-50 text-sky-700"
                      : "bg-emerald-50 text-emerald-700",
                )}
              >
                {selected.is_report_row
                  ? "Daily report"
                  : isManagerAssigned(selected)
                    ? "Assigned task"
                    : "My work"}
              </span>
              <DialogTitle className="pr-8 text-xl">
                {readString(selected, ["title"], "Untitled task")}
              </DialogTitle>
              <DialogDescription>
                Review the assignment, update its progress, and keep the
                activity trail together.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 overflow-y-auto px-5 py-5">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Avatar
                    name={
                      mode === "manager"
                        ? personName(selected.employee)
                        : assignedBy(selected)
                    }
                    photoUrl={photoForAssignee(
                      selected,
                      mode === "manager"
                        ? personName(selected.employee)
                        : assignedBy(selected),
                    )}
                  />
                  <div>
                    <p className="font-medium">
                      {mode === "manager"
                        ? personName(selected.employee)
                        : assignedBy(selected)}
                    </p>
                    {hasDueDate(selected) || reportDateOf(selected) ? (
                      <p className="text-xs text-slate-500">
                        {hasDueDate(selected)
                          ? `Due ${formatDate(plannedDueDateOf(selected))}`
                          : formatDate(reportDateOf(selected))}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {selected.is_report_row ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Work items</h3>
                  {asRecordArray(selected.entries).length ? (
                    <div className="space-y-2">
                      {asRecordArray(selected.entries).map((entry) => {
                        const progress = checklistProgress(entry);
                        return (
                          <button
                            type="button"
                            key={entryIdOf(entry) || rowId(entry)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() =>
                              void openTask({
                                ...entry,
                                report_id: reportIdOf(selected),
                              })
                            }
                          >
                            <span className="min-w-0 truncate font-medium">
                              {readString(entry, ["title"], "Untitled task")}
                            </span>
                            <span className="shrink-0 text-xs text-slate-500">
                              {progress
                                ? `${progress.label} done`
                                : (statusLabel[taskStatus(entry)] ??
                                  taskStatus(entry))}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No work items yet. Create a task to fill this report.
                    </p>
                  )}
                  {mode === "self" && canCloseReport(selected) ? (
                    <button
                      type="button"
                      className={`${primaryButtonClass} mt-4`}
                      onClick={() => openReportPreview(selected)}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <FluentLoadingIndicator className="size-4 animate-spin" />
                      ) : (
                        <FileTextIcon className="size-4" />
                      )}
                      Close {formatDate(reportDateOf(selected))}
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Status
                      {mode === "self" && canEditTask(selected) ? (
                        <FluentSelect
                          ariaLabel="Status"
                          className="w-full"
                          value={taskEditStatus}
                          onChange={setTaskEditStatus}
                          options={[
                            { value: "PLANNED", label: "Not started" },
                            { value: "IN_PROGRESS", label: "In progress" },
                            { value: "COMPLETED", label: "Completed" },
                            { value: "DEFERRED", label: "Deferred" },
                          ]}
                        />
                      ) : (
                        <span className="flex h-10 items-center">
                          <StatusPill value={taskStatus(selected)} />
                        </span>
                      )}
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Priority
                      <span className="flex h-10 items-center gap-1.5 text-sm font-medium text-slate-800">
                        <PriorityDot priority={taskPriority(selected)} />{" "}
                        {taskPriority(selected).charAt(0) +
                          taskPriority(selected).slice(1).toLowerCase()}
                      </span>
                    </label>
                    <div className="grid gap-1 text-xs font-medium text-slate-500">
                      Review status
                      <span className="flex h-10 items-center">
                        <StatusPill value={taskReviewStatus(selected)} />
                      </span>
                    </div>
                    {plannedStartDateOf(selected) ? (
                      <div className="grid gap-1 text-xs font-medium text-slate-500">
                        Start date
                        <span className="flex h-10 items-center gap-1.5 text-sm text-slate-800">
                          <CalendarDaysIcon className="size-4 text-slate-400" />
                          {formatDate(plannedStartDateOf(selected))}
                        </span>
                      </div>
                    ) : null}
                    {hasDueDate(selected) ? (
                      <div className="grid gap-1 text-xs font-medium text-slate-500">
                        Due date
                        <span className="flex h-10 items-center gap-1.5 text-sm text-slate-800">
                          <CalendarDaysIcon className="size-4 text-slate-400" />
                          {formatDate(plannedDueDateOf(selected))}
                        </span>
                      </div>
                    ) : (
                      <div />
                    )}
                    {plannedDateTimeOf(selected, "start") &&
                    plannedDateTimeOf(selected, "end") ? (
                      <div className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
                        Scheduled time
                        <span className="flex h-10 items-center gap-1.5 text-sm text-foreground">
                          <Clock3Icon className="size-4 text-muted-foreground" />
                          {formatTimelineTime(
                            plannedDateTimeOf(selected, "start")!,
                          )}{" "}
                          –{" "}
                          {formatTimelineTime(
                            plannedDateTimeOf(selected, "end")!,
                          )}
                        </span>
                      </div>
                    ) : canScheduleTask(selected) ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2.5 sm:col-span-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">
                            Not on the timeline
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Set a start and end time to schedule it.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground"
                          onClick={() => {
                            const task = selected;
                            clearSelected();
                            openScheduleTask(task);
                          }}
                        >
                          <PlusIcon className="size-3.5" /> Add to timeline
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {mode === "self" &&
                  canEditTask(selected) &&
                  entryIdOf(selected) ? (
                    <ActivityEvidencePicker
                      entryId={entryIdOf(selected)}
                      onAttached={load}
                    />
                  ) : null}
                  {mode === "self" && canEditTask(selected) ? (
                    <div className="space-y-3">
                      <label className="grid gap-1.5 text-sm">
                        <span className="font-medium">
                          Outcome / actual result
                        </span>
                        <Textarea
                          className={`${inputClass} min-h-20 py-2`}
                          value={taskOutcome}
                          onChange={(event) =>
                            setTaskOutcome(event.target.value)
                          }
                          placeholder="Describe what was delivered, especially before marking the activity complete."
                        />
                      </label>
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => void updateTaskStatus()}
                      >
                        Save progress
                      </button>
                    </div>
                  ) : null}

                  {mode !== "self" && readString(selected, ["outcome"]) ? (
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">
                        Outcome / actual result
                      </h3>
                      <p className="text-sm leading-6 text-slate-600">
                        {readString(selected, ["outcome"])}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        Checklist ({asRecordArray(selected.checklist).length})
                      </h3>
                      <span className="text-xs text-slate-500">
                        {
                          asRecordArray(selected.checklist).filter(
                            (item) => item.completed,
                          ).length
                        }{" "}
                        of {asRecordArray(selected.checklist).length} completed
                      </span>
                    </div>
                    {asRecordArray(selected.checklist).length ? (
                      <div className="space-y-2">
                        {asRecordArray(selected.checklist).map((item) => {
                          const itemKey = String(item.id ?? item.title);
                          return (
                            <label
                              key={itemKey}
                              className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm"
                            >
                              {mode === "self" && canEditTask(selected) ? (
                                <input
                                  type="checkbox"
                                  checked={item.completed === true}
                                  disabled={Boolean(updatingChecklistId)}
                                  onChange={() =>
                                    void toggleChecklistItem(itemKey)
                                  }
                                  className="size-4 accent-sky-700"
                                />
                              ) : (
                                <CheckCircle2Icon
                                  className={
                                    item.completed
                                      ? "size-4 text-emerald-600"
                                      : "size-4 text-slate-300"
                                  }
                                />
                              )}
                              <span
                                className={
                                  item.completed
                                    ? "text-slate-400 line-through"
                                    : "text-slate-800"
                                }
                              >
                                {readString(item, ["title"], "Checklist item")}
                              </span>
                              {updatingChecklistId === itemKey ? (
                                <FluentLoadingIndicator className="ml-auto size-4 animate-spin text-sky-700" />
                              ) : null}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        No checklist items.
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Notes</h3>
                    <p className="text-sm leading-6 text-slate-600">
                      {readString(selected, ["description"], "No notes")}
                    </p>
                  </div>

                  {readString(selected, [
                    "expectedResult",
                    "expected_result",
                  ]) ? (
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">
                        Expected result
                      </h3>
                      <p className="text-sm leading-6 text-slate-600">
                        {readString(selected, [
                          "expectedResult",
                          "expected_result",
                        ])}
                      </p>
                    </div>
                  ) : null}

                  {readString(selected, [
                    "employeeKpiId",
                    "employee_kpi_id",
                  ]) ? (
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">
                        Related KPI
                      </h3>
                      <p className="text-sm leading-6 text-slate-600">
                        {optionLabel(
                          employeeKpis.find(
                            (kpi) =>
                              rowId(kpi) ===
                              readString(selected, [
                                "employeeKpiId",
                                "employee_kpi_id",
                              ]),
                          ) ?? {},
                        )}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <MessageSquareIcon className="size-4 text-sky-700" />{" "}
                      Activity
                    </h3>
                    <div className="space-y-3">
                      {asRecordArray(selected.comments).length ? (
                        asRecordArray(selected.comments).map((item) => {
                          const author = personName(
                            item.authorSnapshot ?? item.author_snapshot,
                            "Team member",
                          );
                          const authorPhoto =
                            author === "You"
                              ? myPhotoUrl
                              : photoFromRecord(
                                  item.authorSnapshot ?? item.author_snapshot,
                                );
                          return (
                            <div
                              key={rowId(item)}
                              className="flex gap-2 text-sm"
                            >
                              <Avatar name={author} photoUrl={authorPhoto} />
                              <div>
                                <p>
                                  <span className="font-medium">{author}</span>{" "}
                                  <span className="text-xs text-slate-500">
                                    {formatDate(
                                      item.createdAt ?? item.created_at,
                                    )}
                                  </span>
                                </p>
                                <p className="text-slate-600">
                                  {readString(item, ["body"], "")}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500">
                          No comments yet.
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        className={inputClass}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Add a comment..."
                      />
                      <button
                        type="button"
                        className={primaryButtonClass}
                        onClick={() => void addComment()}
                        disabled={commenting || !comment.trim()}
                      >
                        {commenting ? (
                          <FluentLoadingIndicator className="size-4 animate-spin" />
                        ) : (
                          <SendIcon className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogPopup>
        </Dialog>
      ) : null}
    </section>
  );
}
```

## /home/innocent/systems/hrms/src/components/dashboard/performance-management-view.tsx

```tsx
"use client";
import Link from "next/link";

import { WorkflowGuide } from "@/components/dashboard/workflow-guide";
import { ValidatedWorkflowForm } from "@/components/dashboard/validated-workflow-form";
import { performanceFormSchema } from "@/lib/workflow-schemas";
import { workflowFailure } from "@/lib/workflow-error";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button as FluentButton,
  Input,
  ProgressBar,
  Tab,
  TabList,
} from "@fluentui/react-components";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import {
  CalendarLtr20Regular as CalendarIcon,
  CheckmarkCircle20Regular as CompletedIcon,
  Clock20Regular as PendingIcon,
  Gauge20Regular as ScoreIcon,
  SearchSparkle20Regular as SearchIcon,
} from "@fluentui/react-icons";
import { toast } from "@/components/ui/fluent-toast-store";

import { SearchToggleField } from "@/components/common/search-toggle-field";
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared";
import {
  StatusChip,
  actionButtonClass,
  asRecord,
  asRecordArray,
  employeeLabel,
  formatDate,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  activatePerformancePeriod,
  approvePerformanceReview,
  calculatePerformanceAggregates,
  closePerformancePeriod,
  closePerformanceImprovementPlan,
  createPerformanceCompetencyTemplate,
  createPerformanceFinancialYear,
  createPerformanceImprovementPlan,
  createPerformanceKpi,
  createPerformanceKpiRule,
  createPerformanceKpiTemplate,
  applyPerformanceKpiTemplate,
  createPerformanceKpiVersion,
  createPerformancePeriod,
  updatePerformancePeriod,
  createPerformancePeriodAssignments,
  createPerformancePlan,
  createPerformanceRatingScale,
  createPerformanceScorecard,
  createPerformanceWorkflow,
  createPerformanceDevelopmentPlan,
  updatePerformanceDevelopmentGoal,
  carryForwardPerformanceDevelopmentGoals,
  downloadPerformanceReport,
  generatePerformancePeriods,
  generatePerformancePlanFromRules,
  getPerformanceDashboard,
  getPerformanceCalibrationDepartments,
  getPerformanceCalibrationComparison,
  getPerformanceReviewWorkflow,
  actionPerformanceReviewWorkflow,
  getPerformanceFeedback360Summary,
  getManagerPerformanceSummary,
  invitePerformanceFeedback360,
  listPerformanceFeedback360,
  listBranches,
  listDepartments,
  listEmployeeGrades,
  listEmployees,
  listPositions,
  listPerformanceAppeals,
  listPerformanceCompetencyTemplates,
  listPerformanceDevelopmentPlans,
  listPerformanceFinancialYears,
  listPerformanceImprovementPlans,
  listPerformanceKpiRules,
  listPerformanceKpiTemplates,
  listRolesCatalog,
  listPerformanceKpis,
  listPerformancePeriods,
  listPerformancePlans,
  listPerformanceRatingScales,
  listPerformanceReportCatalog,
  listPerformanceScorecards,
  listPerformanceWorkflows,
  moderatePerformanceReview,
  reopenPerformanceReview,
  reopenPerformancePeriod,
  reviewPerformanceImprovementMilestone,
  syncPerformanceSystemKpis,
  deletePerformanceKpi,
  updatePerformanceKpi,
  type AdminRecord,
} from "@/lib/admin-api";
import {
  canAccessDashboardRoute,
  canPerformPermission,
} from "@/lib/dashboard-permissions";
import { forgetForbiddenRoute } from "@/lib/forbidden-routes";
import { readStoredSessionTokens } from "@/lib/session-client";
import { FluentSelect } from "@/components/ui/fluent-select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";
import { cn } from "@/lib/utils";

export type PerformanceHrTab =
  | "overview"
  | "setup"
  | "plans"
  | "development"
  | "reviews"
  | "improvement"
  | "reports"
  | "calibration";

type SetupTab =
  | "years"
  | "periods"
  | "kpis"
  | "templates"
  | "rules"
  | "competencies"
  | "scales"
  | "scorecards"
  | "workflows";

type CreateMode =
  | "year"
  | "period"
  | "period-edit"
  | "kpi"
  | "kpi-edit"
  | "kpi-version"
  | "template"
  | "rule"
  | "competency"
  | "scale"
  | "scorecard"
  | "workflow"
  | "development"
  | "plan"
  | "generate-plan"
  | "pip"
  | "moderate"
  | "approve"
  | "workflow-action"
  | "feedback"
  | "reopen"
  | "milestone";

const SETUP_TAB_GROUPS: Array<{
  label: string;
  tabs: Array<{ id: SetupTab; label: string }>;
}> = [
  {
    label: "Cycle",
    tabs: [
      { id: "years", label: "Years" },
      { id: "periods", label: "Periods" },
    ],
  },
  {
    label: "KPI design",
    tabs: [
      { id: "kpis", label: "KPIs" },
      { id: "templates", label: "Templates" },
      { id: "rules", label: "Rules" },
    ],
  },
  {
    label: "Evaluation",
    tabs: [
      { id: "competencies", label: "Competencies" },
      { id: "scales", label: "Rating scales" },
      { id: "scorecards", label: "Scorecards" },
      { id: "workflows", label: "Workflows" },
    ],
  },
];

const AGGREGATION_METHODS = [
  "SIMPLE_MONTHLY_AVERAGE",
  "WEIGHTED_MONTHLY_AVERAGE",
  "QUARTERLY_ROLLUP",
  "ANNUAL_TARGET_ACHIEVEMENT",
  "MONTHLY_AVERAGE_WITH_ADJUSTMENTS",
] as const;

const MEASUREMENT_DIRECTIONS = [
  "HIGHER_IS_BETTER",
  "LOWER_IS_BETTER",
  "TARGET_MATCH",
  "RANGE",
  "BINARY",
  "MANUAL_RATING",
] as const;

const SCORING_FORMULAS = [
  "PERCENT_TO_TARGET",
  "INVERSE_PERCENT_TO_TARGET",
  "TARGET_VARIANCE",
  "THRESHOLD_BANDS",
  "RANGE_COMPLIANCE",
  "BINARY_RESULT",
  "MANUAL_RATING",
] as const;

const DATA_SOURCES = [
  "MANUAL_EMPLOYEE",
  "MANUAL_MANAGER",
  "ATTENDANCE",
  "LEAVE",
  "DAILY_ACTIVITY",
  "FIELD_VISIT",
  "EXTERNAL_API",
  "FILE_IMPORT",
  "SYSTEM_CALCULATION",
] as const;

const FREQUENCIES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"] as const;
const PERIOD_TYPES = [
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
  "CUSTOM",
] as const;
const SCORECARD_COMPONENT_TYPES = [
  "KPI",
  "ACTIVITIES",
  "COMPETENCY",
  "ATTENDANCE",
  "MANAGER_ASSESSMENT",
  "SELF_ASSESSMENT",
  "PEER_FEEDBACK",
  "ADJUSTMENT",
  "MANUAL",
] as const;

const WORKFLOW_STEP_TYPES = [
  "DIRECT_SUPERVISOR",
  "DEPARTMENT_MANAGER",
  "HR_REVIEW",
  "FINAL_APPROVAL",
  "CUSTOM",
] as const;

type ScorecardComponentDraft = {
  id: string;
  code: string;
  label: string;
  type: (typeof SCORECARD_COMPONENT_TYPES)[number];
  weight: string;
  enabled: boolean;
  required: boolean;
};

type WorkflowStepDraft = {
  id: string;
  code: string;
  label: string;
  type: (typeof WORKFLOW_STEP_TYPES)[number];
  sequenceNumber: string;
  required: boolean;
  canFinalize: boolean;
};

const DEFAULT_SCORECARD_COMPONENTS: ScorecardComponentDraft[] = [
  {
    id: "kpi",
    code: "KPI",
    label: "KPI performance",
    type: "KPI",
    weight: "50",
    enabled: true,
    required: true,
  },
  {
    id: "competency",
    code: "COMPETENCY",
    label: "Competency assessment",
    type: "COMPETENCY",
    weight: "20",
    enabled: true,
    required: true,
  },
  {
    id: "activities",
    code: "ACTIVITIES",
    label: "Activities performance",
    type: "ACTIVITIES",
    weight: "15",
    enabled: true,
    required: false,
  },
  {
    id: "attendance",
    code: "ATTENDANCE",
    label: "Attendance and punctuality",
    type: "ATTENDANCE",
    weight: "5",
    enabled: true,
    required: false,
  },
  {
    id: "manager",
    code: "MANAGER",
    label: "Manager assessment",
    type: "MANAGER_ASSESSMENT",
    weight: "10",
    enabled: true,
    required: false,
  },
];

const DEFAULT_WORKFLOW_STEPS: WorkflowStepDraft[] = [
  {
    id: "supervisor",
    code: "SUPERVISOR",
    label: "Supervisor review",
    type: "DIRECT_SUPERVISOR",
    sequenceNumber: "1",
    required: true,
    canFinalize: false,
  },
  {
    id: "dept-manager",
    code: "DEPT_MANAGER",
    label: "Department manager review",
    type: "DEPARTMENT_MANAGER",
    sequenceNumber: "2",
    required: true,
    canFinalize: false,
  },
  {
    id: "hr",
    code: "HR_REVIEW",
    label: "HR review",
    type: "HR_REVIEW",
    sequenceNumber: "3",
    required: true,
    canFinalize: false,
  },
  {
    id: "final",
    code: "FINAL_APPROVAL",
    label: "Final approval",
    type: "FINAL_APPROVAL",
    sequenceNumber: "4",
    required: true,
    canFinalize: true,
  },
];

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

function matchesSearch(row: AdminRecord, search: string) {
  if (!search.trim()) return true;
  const haystack = JSON.stringify(row).toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
}

function kpiVersions(row: AdminRecord | null | undefined) {
  return asRecordArray(row?.versions ?? row?.Versions);
}

function currentKpiVersion(row: AdminRecord | null | undefined) {
  const versions = kpiVersions(row);
  const currentId = readNumber(row, ["currentVersionId", "current_version_id"]);
  return (
    versions.find((version) => readNumber(version, ["id"]) === currentId) ??
    versions.at(-1) ??
    null
  );
}

function optionForId(rows: AdminRecord[], id: unknown) {
  if (id === null || id === undefined || id === "") return null;
  return rows.find((row) => rowId(row) === String(id)) ?? null;
}

function kpiVersionOptions(kpis: AdminRecord[]) {
  return kpis.flatMap((kpi) => {
    const versions = kpiVersions(kpi);
    const fallbackId = readNumber(kpi, [
      "currentVersionId",
      "current_version_id",
    ]);
    if (versions.length === 0 && fallbackId !== null) {
      return [
        {
          id: String(fallbackId),
          label: `${readString(kpi, ["code", "name"], optionLabel(kpi))} · version #${fallbackId}`,
        },
      ];
    }
    return versions.map((version) => {
      const id = rowId(version);
      const number = readString(
        version,
        ["versionNumber", "version_number"],
        id,
      );
      return {
        id,
        label: `${readString(kpi, ["code", "name"], optionLabel(kpi))} · v${number}`,
      };
    });
  });
}

function seedKpiVersionForm(row: AdminRecord) {
  const current = currentKpiVersion(row);
  return {
    kpi_id: rowId(row),
    code: readString(row, ["code"]),
    name: readString(row, ["name"]),
    category: readString(row, ["category"]),
    description:
      readString(current, ["description"]) || readString(row, ["description"]),
    measurement_unit: readString(
      current,
      ["measurementUnit", "measurement_unit"],
      "%",
    ),
    measurement_direction: readString(
      current,
      ["measurementDirection", "measurement_direction"],
      "HIGHER_IS_BETTER",
    ),
    scoring_formula: readString(
      current,
      ["scoringFormula", "scoring_formula"],
      "PERCENT_TO_TARGET",
    ),
    data_source_type: readString(
      current,
      ["dataSourceType", "data_source_type"],
      "MANUAL_EMPLOYEE",
    ),
    default_target_value: readString(current, [
      "defaultTargetValue",
      "default_target_value",
    ]),
    frequency: readString(current, ["frequency"], "MONTHLY"),
    approval_authority: readString(current, [
      "approvalAuthority",
      "approval_authority",
    ]),
    manual_entry_allowed: readString(
      current,
      ["manualEntryAllowed", "manual_entry_allowed"],
      "true",
    ),
    evidence_required: readString(
      current,
      ["evidenceRequired", "evidence_required"],
      "false",
    ),
  };
}

function seedKpiDefinitionForm(row: AdminRecord) {
  const current = currentKpiVersion(row);
  return {
    kpi_id: rowId(row),
    code: readString(row, ["code"]),
    name: readString(row, ["name"]),
    category: readString(row, ["category"]),
    description:
      readString(row, ["description"]) || readString(current, ["description"]),
    measurement_unit: readString(
      current,
      ["measurementUnit", "measurement_unit"],
      "%",
    ),
    measurement_direction: readString(
      current,
      ["measurementDirection", "measurement_direction"],
      "HIGHER_IS_BETTER",
    ),
    scoring_formula: readString(
      current,
      ["scoringFormula", "scoring_formula"],
      "PERCENT_TO_TARGET",
    ),
    data_source_type: readString(
      current,
      ["dataSourceType", "data_source_type"],
      "MANUAL_EMPLOYEE",
    ),
    default_target_value: readString(current, [
      "defaultTargetValue",
      "default_target_value",
    ]),
    frequency: readString(current, ["frequency"], "MONTHLY"),
    approval_authority: readString(current, [
      "approvalAuthority",
      "approval_authority",
    ]),
    manual_entry_allowed: readString(
      current,
      ["manualEntryAllowed", "manual_entry_allowed"],
      "true",
    ),
    evidence_required: readString(
      current,
      ["evidenceRequired", "evidence_required"],
      "false",
    ),
  };
}

function createScorecardComponentDraft(): ScorecardComponentDraft {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id: suffix,
    code: "MANUAL",
    label: "Manual component",
    type: "MANUAL",
    weight: "0",
    enabled: true,
    required: false,
  };
}

function createWorkflowStepDraft(nextSequence: number): WorkflowStepDraft {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id: suffix,
    code: "CUSTOM",
    label: "Custom approval",
    type: "CUSTOM",
    sequenceNumber: String(nextSequence),
    required: true,
    canFinalize: false,
  };
}

function scorecardWeightTotal(components: ScorecardComponentDraft[]) {
  return components
    .filter((component) => component.enabled)
    .reduce((sum, component) => sum + (Number(component.weight) || 0), 0);
}

function buildScorecardComponents(components: ScorecardComponentDraft[]) {
  if (components.length === 0) {
    throw new Error("At least one scorecard component is required.");
  }
  const payload = components.map((component) => {
    const weight = Number(component.weight);
    if (!component.code.trim() || !component.label.trim()) {
      throw new Error("Each scorecard component needs a code and label.");
    }
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      throw new Error(`Invalid weight for ${component.label}.`);
    }
    return {
      code: component.code.trim().toUpperCase(),
      label: component.label.trim(),
      type: component.type,
      weight,
      enabled: component.enabled,
      required: component.required,
    };
  });
  const total = payload
    .filter((component) => component.enabled)
    .reduce((sum, component) => sum + component.weight, 0);
  if (Math.round(total * 100) / 100 !== 100) {
    throw new Error(
      `Enabled scorecard component weights must total 100. Current total: ${total}.`,
    );
  }
  return payload;
}

function buildWorkflowSteps(steps: WorkflowStepDraft[]) {
  if (steps.length === 0) {
    throw new Error("At least one workflow step is required.");
  }
  const payload = steps.map((step) => {
    const sequence = Number(step.sequenceNumber);
    if (!step.code.trim() || !step.label.trim()) {
      throw new Error("Each workflow step needs a code and label.");
    }
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new Error(`Invalid sequence for ${step.label}.`);
    }
    return {
      code: step.code.trim().toUpperCase(),
      label: step.label.trim(),
      type: step.type,
      sequence_number: sequence,
      required: step.required,
      can_finalize: step.canFinalize,
    };
  });
  const sequences = new Set(payload.map((step) => step.sequence_number));
  const codes = new Set(payload.map((step) => step.code));
  if (sequences.size !== payload.length) {
    throw new Error("Workflow step sequence numbers must be unique.");
  }
  if (codes.size !== payload.length) {
    throw new Error("Workflow step codes must be unique.");
  }
  if (!payload.some((step) => step.can_finalize)) {
    payload[payload.length - 1].can_finalize = true;
  }
  return payload.sort(
    (left, right) => left.sequence_number - right.sequence_number,
  );
}

export function PerformanceManagementView({
  activeTab,
}: {
  activeTab: PerformanceHrTab;
}) {
  const router = useRouter();
  const actor = useDashboardActor();
  const performancePath =
    activeTab === "overview"
      ? "/dashboard/performance/overview"
      : `/dashboard/performance/${activeTab}`;
  const canAccess =
    actor.ready &&
    (canAccessDashboardRoute(
      performancePath,
      actor.permissionLabels,
      actor.accessMode,
    ) ||
      canAccessDashboardRoute(
        "/dashboard/performance/overview",
        actor.permissionLabels,
        actor.accessMode,
      ));
  const canCreatePerformance = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "view_company_dashboard",
      "performance:create",
      "performance:update",
      "performance_periods:create",
      "performance_financial_years:create",
      "manage_performance",
    ],
    mode: "any",
  });
  const canActivatePeriod = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "performance_periods:activate",
      "performance:update",
      "manage_performance",
    ],
    mode: "any",
  });
  const canClosePeriod = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "performance_periods:close",
      "performance:update",
      "manage_performance",
    ],
    mode: "any",
  });
  const canReopenPeriod = canPerformPermission(actor.permissionLabels, {
    permissions: ["performance_periods:reopen"],
    mode: "any",
  });
  const canModerateReviews = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "performance:update",
      "performance_reviews:update",
      "performance_reviews:approve",
      "manage_performance",
    ],
    mode: "any",
  });
  const canActOnReviewWorkflow = canPerformPermission(actor.permissionLabels, {
    permissions: ["performance_reviews:workflow-action"],
  });
  const canReadReviewWorkflow = canPerformPermission(actor.permissionLabels, {
    permissions: ["performance_reviews:workflow-read"],
  });
  const canUpdateDevelopmentGoals = canPerformPermission(
    actor.permissionLabels,
    {
      permissions: ["performance_development_plans:update"],
    },
  );
  const canCarryDevelopmentGoals = canPerformPermission(
    actor.permissionLabels,
    {
      permissions: ["performance_development_plans:create"],
    },
  );

  React.useEffect(() => {
    forgetForbiddenRoute("/dashboard/performance");
    forgetForbiddenRoute("/dashboard/performance/overview");
    forgetForbiddenRoute("/dashboard/performance/setup");
    forgetForbiddenRoute("/dashboard/performance/plans");
    forgetForbiddenRoute("/dashboard/performance/reviews");
    forgetForbiddenRoute("/dashboard/performance/improvement");
  }, []);

  const [setupTab, setSetupTab] = React.useState<SetupTab>("years");
  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null);
  const [managerSummary, setManagerSummary] =
    React.useState<AdminRecord | null>(null);
  const [years, setYears] = React.useState<AdminRecord[]>([]);
  const [periods, setPeriods] = React.useState<AdminRecord[]>([]);
  const [kpis, setKpis] = React.useState<AdminRecord[]>([]);
  const [templates, setTemplates] = React.useState<AdminRecord[]>([]);
  const [templateRoles, setTemplateRoles] = React.useState<AdminRecord[]>([]);
  const [additionalTemplateItems, setAdditionalTemplateItems] = React.useState<
    Array<{ versionId: string; weight: string; target: string }>
  >([]);
  const [applyTemplateId, setApplyTemplateId] = React.useState("");
  const [applyPeriodId, setApplyPeriodId] = React.useState("");
  const [applyPolicy, setApplyPolicy] = React.useState<
    "MERGE" | "SKIP" | "REPLACE"
  >("MERGE");
  const [rules, setRules] = React.useState<AdminRecord[]>([]);
  const [competencies, setCompetencies] = React.useState<AdminRecord[]>([]);
  const [scales, setScales] = React.useState<AdminRecord[]>([]);
  const [scorecards, setScorecards] = React.useState<AdminRecord[]>([]);
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([]);
  const [plans, setPlans] = React.useState<AdminRecord[]>([]);
  const [developmentPlans, setDevelopmentPlans] = React.useState<AdminRecord[]>(
    [],
  );
  const [reports, setReports] = React.useState<AdminRecord[]>([]);
  const [calibrationRows, setCalibrationRows] = React.useState<AdminRecord[]>(
    [],
  );
  const [calibrationComparison, setCalibrationComparison] =
    React.useState(false);
  const [appeals, setAppeals] = React.useState<AdminRecord[]>([]);
  const [pips, setPips] = React.useState<AdminRecord[]>([]);
  const [employees, setEmployees] = React.useState<AdminRecord[]>([]);
  const [branches, setBranches] = React.useState<AdminRecord[]>([]);
  const [departments, setDepartments] = React.useState<AdminRecord[]>([]);
  const [positions, setPositions] = React.useState<AdminRecord[]>([]);
  const [grades, setGrades] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [overviewSearch, setOverviewSearch] = React.useState("");
  const [overviewStatus, setOverviewStatus] = React.useState("ALL");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailRecord, setDetailRecord] = React.useState<AdminRecord | null>(
    null,
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<CreateMode>("year");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState("");
  const [periodActionResults, setPeriodActionResults] = React.useState<
    Record<string, { assignments?: number; synced?: number }>
  >({});
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [scorecardComponents, setScorecardComponents] = React.useState<
    ScorecardComponentDraft[]
  >(DEFAULT_SCORECARD_COMPONENTS);
  const [workflowSteps, setWorkflowSteps] = React.useState<WorkflowStepDraft[]>(
    DEFAULT_WORKFLOW_STEPS,
  );

  const { begin, invalidate, credential } = useWorkflowRequest(
    `${activeTab}:${setupTab}:${calibrationComparison}`,
  );

  const load = React.useCallback(async () => {
    const { commit, current } = begin();
    void current;
    const token = credential?.trim() || readStoredToken();
    if (!token) {
      commit(() => setError("Authentication required. Please log in again."));
      commit(() => setLoading(false));
      return;
    }
    commit(() => setLoading(true));
    commit(() => setError(null));
    try {
      if (activeTab === "overview") {
        const [
          summary,
          yearRows,
          periodRows,
          planRows,
          developmentRows,
          pipRows,
          appealRows,
          teamSummary,
        ] = await Promise.all([
          getPerformanceDashboard(token),
          listPerformanceFinancialYears(token),
          listPerformancePeriods(token),
          listPerformancePlans(token),
          listPerformanceDevelopmentPlans(token),
          listPerformanceImprovementPlans(token),
          listPerformanceAppeals(token),
          getManagerPerformanceSummary(token),
        ]);
        commit(() => setDashboard(summary));
        commit(() => setYears(yearRows));
        commit(() => setPeriods(periodRows));
        commit(() => setPlans(planRows));
        commit(() => setDevelopmentPlans(developmentRows));
        commit(() => setPips(pipRows));
        commit(() => setAppeals(appealRows));
        commit(() => setManagerSummary(teamSummary));
      } else if (activeTab === "setup") {
        if (setupTab === "years") {
          const loadedValue1 = await listPerformanceFinancialYears(token);
          commit(() => setYears(loadedValue1));
        } else if (setupTab === "periods") {
          const [periodRows, yearRows] = await Promise.all([
            listPerformancePeriods(token),
            listPerformanceFinancialYears(token),
          ]);
          commit(() => setPeriods(periodRows));
          commit(() => setYears(yearRows));
        } else if (setupTab === "kpis") {
          const loadedValue2 = await listPerformanceKpis(token);
          commit(() => setKpis(loadedValue2));
        } else if (setupTab === "templates") {
          const [templateRows, kpiRows, periodRows, rolePage] =
            await Promise.all([
              listPerformanceKpiTemplates(token),
              listPerformanceKpis(token),
              listPerformancePeriods(token),
              listRolesCatalog(token),
            ]);
          commit(() => setTemplates(templateRows));
          commit(() => setKpis(kpiRows));
          commit(() => setPeriods(periodRows));
          commit(() => setTemplateRoles(rolePage.rows));
        } else if (setupTab === "rules") {
          const [
            ruleRows,
            kpiRows,
            yearRows,
            branchPage,
            departmentPage,
            positionPage,
            gradeRows,
            employeePage,
          ] = await Promise.all([
            listPerformanceKpiRules(token),
            listPerformanceKpis(token),
            listPerformanceFinancialYears(token),
            listBranches(token, { limit: 100 }),
            listDepartments(token, { limit: 100 }),
            listPositions(token, { limit: 100 }),
            listEmployeeGrades(token),
            listEmployees(token, { limit: 100 }),
          ]);
          commit(() => setRules(ruleRows));
          commit(() => setKpis(kpiRows));
          commit(() => setYears(yearRows));
          commit(() => setBranches(branchPage.rows));
          commit(() => setDepartments(departmentPage.rows));
          commit(() => setPositions(positionPage.rows));
          commit(() => setGrades(gradeRows));
          commit(() => setEmployees(employeePage.rows));
        } else if (setupTab === "competencies") {
          const loadedValue3 = await listPerformanceCompetencyTemplates(token);
          commit(() => setCompetencies(loadedValue3));
        } else if (setupTab === "scales") {
          const loadedValue4 = await listPerformanceRatingScales(token);
          commit(() => setScales(loadedValue4));
        } else if (setupTab === "scorecards") {
          const loadedValue5 = await listPerformanceScorecards(token);
          commit(() => setScorecards(loadedValue5));
        } else if (setupTab === "workflows") {
          const loadedValue6 = await listPerformanceWorkflows(token);
          commit(() => setWorkflows(loadedValue6));
        }
      } else if (activeTab === "plans") {
        const [planRows, kpiRows, employeeRows] = await Promise.all([
          listPerformancePlans(token),
          listPerformanceKpis(token),
          listEmployees(token, { limit: 100 }).then((result) => result.rows),
        ]);
        commit(() => setPlans(planRows));
        commit(() => setKpis(kpiRows));
        commit(() => setEmployees(employeeRows));
      } else if (activeTab === "development") {
        const [developmentRows, employeeRows] = await Promise.all([
          listPerformanceDevelopmentPlans(token),
          listEmployees(token, { limit: 100 }).then((result) => result.rows),
        ]);
        commit(() => setDevelopmentPlans(developmentRows));
        commit(() => setEmployees(employeeRows));
      } else if (activeTab === "reviews") {
        const [appealRows, pipRows] = await Promise.all([
          listPerformanceAppeals(token),
          listPerformanceImprovementPlans(token),
        ]);
        commit(() => setAppeals(appealRows));
        commit(() => setPips(pipRows));
      } else if (activeTab === "improvement") {
        const loadedValue7 = await listPerformanceImprovementPlans(token);
        commit(() => setPips(loadedValue7));
      } else if (activeTab === "reports") {
        const loadedValue8 = await listPerformanceReportCatalog(token);
        commit(() => setReports(loadedValue8));
      } else if (activeTab === "calibration") {
        const calibration = await (calibrationComparison
          ? getPerformanceCalibrationComparison(token)
          : getPerformanceCalibrationDepartments(token));
        commit(() => setCalibrationRows(calibration));
      }
    } catch (errorObject) {
      commit(() =>
        setError(
          workflowFailure(errorObject, "Could not load performance data."),
        ),
      );
    } finally {
      commit(() => setLoading(false));
    }
  }, [begin, credential, activeTab, setupTab, calibrationComparison]);

  React.useEffect(() => {
    if (!canAccess) return;
    void load();
    return invalidate;
  }, [canAccess, load, invalidate]);

  const averageScore =
    readNumber(dashboard, [
      "average_score",
      "averageScore",
      "avg_score",
      "avgScore",
      "mean_score",
    ]) ?? readNumber(asRecord(dashboard?.scores), ["average", "avg", "mean"]);

  const completionRate = readNumber(dashboard, [
    "completion_rate",
    "completionRate",
    "review_completion_rate",
  ]);

  const openReviews =
    readNumber(dashboard, [
      "open_reviews",
      "openReviews",
      "pending_reviews",
      "pendingReviews",
    ]) ?? appeals.length;

  const pipCount =
    readNumber(dashboard, [
      "open_improvement_plans",
      "openImprovementPlans",
      "pip_count",
    ]) ?? pips.length;
  const developmentPlanCount =
    readNumber(dashboard, [
      "active_development_plans",
      "activeDevelopmentPlans",
    ]) ?? developmentPlans.length;

  const managerTeamSize = readNumber(managerSummary, [
    "team_size",
    "teamSize",
    "direct_reports",
    "directReports",
    "direct_report_count",
    "directReportCount",
  ]);
  const managerPendingReviews = readNumber(managerSummary, [
    "pending_reviews",
    "pendingReviews",
    "open_reviews",
    "openReviews",
  ]);
  const managerAverageScore = readNumber(managerSummary, [
    "average_score",
    "averageScore",
    "avg_score",
    "avgScore",
  ]);

  const activePeriods = periods.filter((period) =>
    [
      "OPEN",
      "ACTIVE",
      "GOAL_SETTING",
      "IN_PROGRESS",
      "MID_REVIEW",
      "FINAL_REVIEW",
      "REOPENED",
    ].includes(readString(period, ["status"], "DRAFT").toUpperCase()),
  );
  const pendingPlans = plans.filter((plan) =>
    ["DRAFT", "PENDING", "PENDING_APPROVAL", "RETURNED"].includes(
      readString(plan, ["status"], "DRAFT").toUpperCase(),
    ),
  ).length;
  const openAppeals = appeals.filter(
    (appeal) =>
      !["CLOSED", "RESOLVED", "REJECTED"].includes(
        readString(appeal, ["status"], "OPEN").toUpperCase(),
      ),
  ).length;
  const overviewRecords = React.useMemo(() => {
    const tagged: AdminRecord[] = [
      ...periods.map((row) => ({ ...row, dashboard_kind: "Review period" })),
      ...plans.map((row) => ({ ...row, dashboard_kind: "Performance plan" })),
      ...developmentPlans.map((row) => ({
        ...row,
        dashboard_kind: "Development plan",
      })),
      ...pips.map((row) => ({ ...row, dashboard_kind: "Improvement plan" })),
      ...appeals.map((row) => ({ ...row, dashboard_kind: "Appeal" })),
    ];
    const needle = overviewSearch.trim().toLowerCase();
    return tagged
      .filter((row) => {
        const status = readString(
          row,
          ["status", "review_status", "reviewStatus"],
          "DRAFT",
        ).toUpperCase();
        if (overviewStatus !== "ALL" && status !== overviewStatus) return false;
        return !needle || JSON.stringify(row).toLowerCase().includes(needle);
      })
      .sort((left, right) => {
        const timestamp = (row: AdminRecord) => {
          const value =
            row.updatedAt ?? row.updated_at ?? row.createdAt ?? row.created_at;
          const parsed = value ? new Date(String(value)).getTime() : 0;
          return Number.isFinite(parsed) ? parsed : 0;
        };
        return timestamp(right) - timestamp(left);
      });
  }, [
    appeals,
    developmentPlans,
    overviewSearch,
    overviewStatus,
    periods,
    pips,
    plans,
  ]);
  const overviewStatuses = React.useMemo(
    () =>
      Array.from(
        new Set(
          [periods, plans, developmentPlans, pips, appeals]
            .flat()
            .map((row) =>
              readString(
                row,
                ["status", "review_status", "reviewStatus"],
                "DRAFT",
              ).toUpperCase(),
            ),
        ),
      ).sort(),
    [appeals, developmentPlans, periods, pips, plans],
  );
  const visibleRows = React.useMemo(() => {
    const source =
      activeTab === "plans"
        ? plans
        : activeTab === "development"
          ? developmentPlans
          : activeTab === "reviews"
            ? appeals
            : activeTab === "improvement"
              ? pips
              : activeTab === "reports"
                ? reports
                : activeTab === "calibration"
                  ? calibrationRows
                  : setupTab === "years"
                    ? years
                    : setupTab === "periods"
                      ? periods
                      : setupTab === "kpis"
                        ? kpis
                        : setupTab === "templates"
                          ? templates
                          : setupTab === "rules"
                            ? rules
                            : setupTab === "competencies"
                              ? competencies
                              : setupTab === "scales"
                                ? scales
                                : setupTab === "scorecards"
                                  ? scorecards
                                  : workflows;
    return source.filter((row) => matchesSearch(row, search));
  }, [
    activeTab,
    appeals,
    calibrationRows,
    competencies,
    developmentPlans,
    kpis,
    periods,
    pips,
    plans,
    reports,
    rules,
    scales,
    scorecards,
    search,
    setupTab,
    templates,
    workflows,
    years,
  ]);

  function openCreate(mode: CreateMode, seed: Record<string, string> = {}) {
    if (mode === "template") setAdditionalTemplateItems([]);
    setCreateMode(mode);
    setForm(
      mode === "period" || mode === "period-edit"
        ? {
            period_type: "MONTHLY",
            sequence_number: "1",
            max_weightage: "100",
            score_cap: "120",
            cooling_period_days: "0",
            allow_parallel: "true",
            ...seed,
          }
        : mode === "scorecard"
          ? { is_default: "true", ...seed }
          : mode === "workflow"
            ? { is_default: "true", ...seed }
            : seed,
    );
    if (mode === "scorecard") {
      setScorecardComponents(DEFAULT_SCORECARD_COMPONENTS);
    }
    if (mode === "workflow") {
      setWorkflowSteps(DEFAULT_WORKFLOW_STEPS);
    }
    setFormError(null);
    setCreateOpen(true);
  }

  const runAction = React.useCallback(
    async (
      id: string,
      work: (token: string) => Promise<unknown>,
      success: string,
    ) => {
      const token = readStoredToken();
      if (!token) return;
      setBusyId(id);
      try {
        await work(token);
        toast.success(success);
        await load();
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error ? errorObject.message : "Action failed.",
        );
      } finally {
        setBusyId("");
      }
    },
    [load],
  );

  async function generatePeriodsForYear(yearId: string) {
    const token = readStoredToken();
    if (!token) return;
    setBusyId(`gen-${yearId}`);
    try {
      const before = await listPerformancePeriods(token);
      await generatePerformancePeriods(token, yearId);
      const after = await listPerformancePeriods(token);
      const previousIds = new Set(before.map((period) => rowId(period)));
      const created = after.filter(
        (period) => !previousIds.has(rowId(period)),
      ).length;
      setPeriods(after);
      setSearch("");
      setSetupTab("periods");
      toast[created > 0 ? "success" : "info"](
        created > 0
          ? `${created} periods generated. They are listed under Periods.`
          : "No new periods were needed. Existing periods are listed under Periods.",
      );
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not generate periods.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function runPeriodAction(periodId: string, action: "assign" | "sync") {
    const token = readStoredToken();
    if (!token) return;
    setBusyId(`${action}-${periodId}`);
    try {
      const result =
        action === "assign"
          ? await createPerformancePeriodAssignments(token, periodId)
          : await syncPerformanceSystemKpis(token, periodId);
      const count = asRecordArray(result).length;
      setPeriodActionResults((current) => ({
        ...current,
        [periodId]: {
          ...current[periodId],
          [action === "assign" ? "assignments" : "synced"]: count,
        },
      }));
      if (count === 0) {
        toast.info(
          action === "assign"
            ? "No review assignments found. Create active performance plans for this year, then assign them to this period."
            : "No system KPI values were synced. Assign active plans with attendance, leave, activity, or field visit KPIs first.",
        );
      } else {
        toast.success(
          action === "assign"
            ? `${count} review assignments are available for this period.`
            : `${count} system KPI values synced for this period.`,
        );
      }
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error ? errorObject.message : "Action failed.",
      );
    } finally {
      setBusyId("");
    }
  }

  const { begin: beginMutation } = useWorkflowRequest(
    `${activeTab}:${JSON.stringify({ form, additionalTemplateItems, scorecardComponents, workflowSteps })}`,
  );
  React.useEffect(() => {
    setSaving(false);
  }, [credential, activeTab, beginMutation]);

  async function onCreate() {
    const validationResult = performanceFormSchema(createMode).safeParse({
      ...form,
      additionalTemplateItems,
      scorecardComponents,
      workflowSteps,
    });
    if (!validationResult.success) {
      setFormError(
        validationResult.error.issues
          .map(
            (issue) => issue.path.map(String).join(".") + ": " + issue.message,
          )
          .join("; "),
      );
      return;
    }
    if (saving) return;
    const token = readStoredToken();
    if (!token) {
      setFormError("Authentication required. Please log in again.");
      return;
    }
    const { current: isMutationCurrent } = beginMutation();
    setSaving(true);
    setFormError(null);
    try {
      if (createMode === "year") {
        if (!form.code || !form.name || !form.start_date || !form.end_date) {
          throw new Error("Code, name, start date, and end date are required.");
        }
        await createPerformanceFinancialYear(token, {
          code: form.code,
          name: form.name,
          start_date: form.start_date,
          end_date: form.end_date,
          annual_aggregation_method:
            form.annual_aggregation_method || undefined,
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "period" || createMode === "period-edit") {
        if (
          !form.financial_year_id ||
          !form.name ||
          !form.period_type ||
          !form.sequence_number ||
          !form.start_date ||
          !form.end_date
        ) {
          throw new Error(
            "Year, name, type, sequence, start date, and end date are required.",
          );
        }
        if (
          !form.goal_setting_deadline ||
          !form.mid_cycle_review_date ||
          !form.final_review_deadline
        ) {
          throw new Error(
            "Goal-setting, mid-cycle, and final-review dates are required.",
          );
        }
        const periodPayload = {
          financial_year_id: Number(form.financial_year_id),
          name: form.name,
          description: form.description || undefined,
          period_type: form.period_type,
          sequence_number: Number(form.sequence_number),
          start_date: form.start_date,
          end_date: form.end_date,
          goal_setting_deadline: form.goal_setting_deadline,
          mid_cycle_review_date: form.mid_cycle_review_date,
          final_review_deadline: form.final_review_deadline,
          allow_parallel: form.allow_parallel !== "false",
          max_weightage: Number(form.max_weightage || 100),
          score_cap: Number(form.score_cap || 120),
          cooling_period_days: Number(form.cooling_period_days || 0),
        };
        if (createMode === "period-edit") {
          if (!form.period_id)
            throw new Error("Performance period is missing.");
          await updatePerformancePeriod(token, form.period_id, periodPayload);
          if (!isMutationCurrent()) return;
        } else {
          await createPerformancePeriod(token, periodPayload);
          if (!isMutationCurrent()) return;
        }
      } else if (
        createMode === "kpi" ||
        createMode === "kpi-edit" ||
        createMode === "kpi-version"
      ) {
        if (
          !form.code ||
          !form.name ||
          !form.description ||
          !form.measurement_unit
        ) {
          throw new Error(
            "Code, name, description, and measurement unit are required.",
          );
        }
        const kpiPayload = {
          code: form.code,
          name: form.name,
          category: form.category || undefined,
          description: form.description,
          measurement_unit: form.measurement_unit,
          measurement_direction:
            form.measurement_direction || "HIGHER_IS_BETTER",
          scoring_formula: form.scoring_formula || "PERCENT_TO_TARGET",
          data_source_type: form.data_source_type || "MANUAL_EMPLOYEE",
          default_target_value: form.default_target_value
            ? Number(form.default_target_value)
            : undefined,
          frequency: form.frequency || undefined,
          approval_authority: form.approval_authority || undefined,
          manual_entry_allowed: form.manual_entry_allowed === "true",
          evidence_required: form.evidence_required === "true",
        };
        if (createMode === "kpi-edit") {
          if (!form.kpi_id) throw new Error("KPI is missing.");
          await updatePerformanceKpi(token, form.kpi_id, kpiPayload);
          if (!isMutationCurrent()) return;
        } else if (createMode === "kpi-version") {
          if (!form.kpi_id) throw new Error("Select a KPI to version.");
          const created = await createPerformanceKpiVersion(
            token,
            form.kpi_id,
            kpiPayload,
          );
          if (!isMutationCurrent()) return;
          const createdRecord =
            asRecord(created) ?? asRecord(asRecord(created)?.data);
          const versionId =
            readNumber(createdRecord, [
              "currentVersionId",
              "current_version_id",
            ]) ?? readNumber(kpiVersions(createdRecord).at(-1) ?? null, ["id"]);
          toast.success(
            versionId !== null
              ? `KPI version #${versionId} created.`
              : "KPI version created.",
          );
          setCreateOpen(false);
          await load();
          if (!isMutationCurrent()) return;
          return;
        }
        if (createMode === "kpi") {
          await createPerformanceKpi(token, kpiPayload);
          if (!isMutationCurrent()) return;
        }
      } else if (createMode === "template") {
        if (
          !form.code ||
          !form.name ||
          !form.kpi_definition_version_id ||
          !form.weight
        ) {
          throw new Error("Code, name, KPI version, and weight are required.");
        }
        const items = [
          {
            kpi_definition_version_id: Number(form.kpi_definition_version_id),
            weight: Number(form.weight),
            target_value: form.target_value
              ? Number(form.target_value)
              : undefined,
            manual_entry_allowed: form.manual_entry_allowed === "true",
            evidence_required: form.evidence_required === "true",
            notes: form.notes || undefined,
          },
          ...additionalTemplateItems.map((item) => ({
            kpi_definition_version_id: Number(item.versionId),
            weight: Number(item.weight),
            target_value: item.target ? Number(item.target) : undefined,
          })),
        ];
        if (
          items.some(
            (item) => !item.kpi_definition_version_id || !item.weight,
          ) ||
          Math.abs(items.reduce((sum, item) => sum + item.weight, 0) - 100) >
            0.001
        )
          throw new Error(
            "Every template KPI needs a version and weight; weights must total 100.",
          );
        if (!(form.applicable_role_ids || "").trim())
          throw new Error("Choose at least one applicable role.");
        await createPerformanceKpiTemplate(token, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          review_cycle: form.review_cycle || undefined,
          applicable_role_ids: (form.applicable_role_ids || "")
            .split(",")
            .filter(Boolean)
            .map(Number),
          items,
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "rule") {
        if (!form.kpi_definition_version_id) {
          throw new Error("KPI definition version is required.");
        }
        await createPerformanceKpiRule(token, {
          kpi_definition_version_id: Number(form.kpi_definition_version_id),
          name: form.name || undefined,
          priority: form.priority ? Number(form.priority) : undefined,
          financial_year_id: form.financial_year_id
            ? Number(form.financial_year_id)
            : undefined,
          branch_id: form.branch_id ? Number(form.branch_id) : undefined,
          department_id: form.department_id
            ? Number(form.department_id)
            : undefined,
          position_id: form.position_id ? Number(form.position_id) : undefined,
          grade_id: form.grade_id ? Number(form.grade_id) : undefined,
          employment_type: form.employment_type || undefined,
          employee_id: form.employee_id ? Number(form.employee_id) : undefined,
          review_cycle: form.review_cycle || undefined,
          template_code: form.template_code || undefined,
          weight_override: form.weight_override
            ? Number(form.weight_override)
            : undefined,
          target_override: form.target_override
            ? Number(form.target_override)
            : undefined,
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "competency") {
        if (
          !form.code ||
          !form.name ||
          !form.item_code ||
          !form.item_name ||
          !form.item_weight
        ) {
          throw new Error(
            "Template and first competency item details are required.",
          );
        }
        await createPerformanceCompetencyTemplate(token, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          items: [
            {
              code: form.item_code,
              name: form.item_name,
              description: form.item_description || undefined,
              category: form.item_category || undefined,
              weight: Number(form.item_weight),
              maximum_rating: form.maximum_rating
                ? Number(form.maximum_rating)
                : undefined,
            },
          ],
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "scale") {
        if (!form.code || !form.name || !form.band_code || !form.band_label) {
          throw new Error("Scale and first band details are required.");
        }
        await createPerformanceRatingScale(token, {
          code: form.code,
          name: form.name,
          minimum_score: form.minimum_score
            ? Number(form.minimum_score)
            : undefined,
          maximum_score: form.maximum_score
            ? Number(form.maximum_score)
            : undefined,
          is_default: form.is_default === "true",
          bands: [
            {
              code: form.band_code,
              label: form.band_label,
              minimum_score: Number(form.band_min || 0),
              maximum_score: Number(form.band_max || 100),
              requires_improvement_plan:
                form.requires_improvement_plan === "true",
            },
          ],
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "scorecard") {
        if (!form.code || !form.name) {
          throw new Error("Code and name are required.");
        }
        await createPerformanceScorecard(token, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          is_default: form.is_default !== "false",
          effective_from: form.effective_from || undefined,
          effective_to: form.effective_to || undefined,
          components: buildScorecardComponents(scorecardComponents),
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "workflow") {
        if (!form.code || !form.name) {
          throw new Error("Code and name are required.");
        }
        await createPerformanceWorkflow(token, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          is_default: form.is_default !== "false",
          applies_to_department_id: form.applies_to_department_id
            ? Number(form.applies_to_department_id)
            : undefined,
          applies_to_position_id: form.applies_to_position_id
            ? Number(form.applies_to_position_id)
            : undefined,
          review_type: form.review_type || undefined,
          steps: buildWorkflowSteps(workflowSteps),
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "development") {
        if (!form.employee_id || !form.title || !form.goal_title) {
          throw new Error("Employee, plan title, and first goal are required.");
        }
        await createPerformanceDevelopmentPlan(token, {
          employee_id: Number(form.employee_id),
          manager_employee_id: form.manager_employee_id
            ? Number(form.manager_employee_id)
            : undefined,
          source_review_id: form.source_review_id
            ? Number(form.source_review_id)
            : undefined,
          title: form.title,
          description: form.description || undefined,
          start_date: form.start_date || undefined,
          target_completion_date: form.target_completion_date || undefined,
          goals: [
            {
              title: form.goal_title,
              description: form.goal_description || undefined,
              category: form.goal_category || undefined,
              target_date: form.goal_target_date || undefined,
              success_measure: form.success_measure || undefined,
              support_required: form.support_required || undefined,
            },
          ],
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "plan") {
        if (
          !form.employee_id ||
          !form.financial_year_id ||
          !form.effective_from ||
          !form.kpi_definition_version_id ||
          !form.weight
        ) {
          throw new Error(
            "Employee, year, start date, KPI version, and weight are required.",
          );
        }
        await createPerformancePlan(token, {
          employee_id: Number(form.employee_id),
          financial_year_id: Number(form.financial_year_id),
          effective_from: form.effective_from,
          effective_to: form.effective_to || undefined,
          manager_employee_id: form.manager_employee_id
            ? Number(form.manager_employee_id)
            : undefined,
          items: [
            {
              kpi_definition_version_id: Number(form.kpi_definition_version_id),
              weight: Number(form.weight),
              target_value: form.target_value
                ? Number(form.target_value)
                : undefined,
              notes: form.notes || undefined,
            },
          ],
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "generate-plan") {
        if (
          !form.employee_id ||
          !form.financial_year_id ||
          !form.effective_from
        ) {
          throw new Error("Employee, year, and start date are required.");
        }
        await generatePerformancePlanFromRules(token, {
          employee_id: Number(form.employee_id),
          financial_year_id: Number(form.financial_year_id),
          effective_from: form.effective_from,
          effective_to: form.effective_to || undefined,
          review_cycle: form.review_cycle || undefined,
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "pip") {
        if (
          !form.review_id ||
          !form.summary ||
          !form.objectives ||
          !form.milestone_title ||
          !form.milestone_due
        ) {
          throw new Error(
            "Review, summary, objectives, and a milestone are required.",
          );
        }
        await createPerformanceImprovementPlan(token, form.review_id, {
          summary: form.summary,
          objectives: form.objectives
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          milestones: [
            {
              title: form.milestone_title,
              description: form.milestone_description || undefined,
              due_date: form.milestone_due,
            },
          ],
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "moderate") {
        if (!form.review_id || !form.reason)
          throw new Error("Review and reason are required.");
        await moderatePerformanceReview(token, form.review_id, {
          reason: form.reason,
          final_score: form.final_score ? Number(form.final_score) : undefined,
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "approve") {
        if (!form.period_assignment_id)
          throw new Error("Period assignment is required.");
        await approvePerformanceReview(token, form.period_assignment_id, {
          adjustment_score: form.adjustment_score
            ? Number(form.adjustment_score)
            : undefined,
          publish: form.publish !== "false",
          hr_review: form.hr_review ? { comment: form.hr_review } : undefined,
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "workflow-action") {
        if (
          !Number.isInteger(Number(form.review_id)) ||
          Number(form.review_id) < 1
        )
          throw new Error("Enter a valid review ID.");
        if (!["APPROVE", "RETURN", "REJECT"].includes(form.decision))
          throw new Error("Choose a decision.");
        if (form.decision !== "APPROVE" && !form.comment?.trim())
          throw new Error(
            "A comment is required when returning or rejecting a review.",
          );
        await actionPerformanceReviewWorkflow(token, form.review_id, {
          decision: form.decision,
          comment: form.comment?.trim() || undefined,
          hr_review: form.hr_review ? { comment: form.hr_review } : undefined,
          adjustment_score: form.adjustment_score
            ? Number(form.adjustment_score)
            : undefined,
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "feedback") {
        if (!form.review_id || !form.rater_employee_ids) {
          throw new Error(
            "Review ID and at least one rater employee ID are required.",
          );
        }
        const raterIds = form.rater_employee_ids
          .split(/[\n,]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map(Number);
        if (
          !raterIds.length ||
          raterIds.some((id) => !Number.isInteger(id) || id < 1)
        ) {
          throw new Error("Rater employee IDs must be valid numbers.");
        }
        await invitePerformanceFeedback360(token, form.review_id, {
          invitations: raterIds.map((id) => ({
            rater_employee_id: id,
            relationship_type: form.relationship_type || "PEER",
            due_date: form.due_date || undefined,
            is_anonymous: form.is_anonymous !== "false",
          })),
        });
        if (!isMutationCurrent()) return;
        try {
          const [items, summary] = await Promise.all([
            listPerformanceFeedback360(token, form.review_id),
            getPerformanceFeedback360Summary(token, form.review_id),
          ]);
          if (!isMutationCurrent()) return;
          setDetailRecord({
            review_id: form.review_id,
            summary,
            invitations: items,
          });
          setDetailOpen(true);
        } catch {
          if (!isMutationCurrent()) return;
          toast.warning(
            "Feedback invitations were saved, but their summary could not be refreshed. Reload the review to see them.",
          );
        }
      } else if (createMode === "reopen") {
        if (!form.review_id || !form.reason)
          throw new Error("Review and reason are required.");
        await reopenPerformanceReview(token, form.review_id, form.reason);
        if (!isMutationCurrent()) return;
      } else if (createMode === "milestone") {
        if (!form.milestone_id || !form.comment)
          throw new Error("Milestone and comment are required.");
        await reviewPerformanceImprovementMilestone(token, form.milestone_id, {
          comment: form.comment,
          status: form.status || undefined,
        });
        if (!isMutationCurrent()) return;
      }
      toast.success("Saved.");
      setCreateOpen(false);
      await load();
      if (!isMutationCurrent()) return;
    } catch (errorObject) {
      if (!isMutationCurrent()) return;
      setFormError(
        errorObject instanceof Error ? errorObject.message : "Could not save.",
      );
    } finally {
      if (isMutationCurrent()) setSaving(false);
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "development") {
      return [
        {
          key: "plan",
          label: "Plan",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">
                {readString(row, ["title"], `Development plan #${rowId(row)}`)}
              </p>
              <p className="text-xs text-muted-foreground">
                Employee #
                {readNumber(row, ["employeeId", "employee_id"]) ?? "N/A"}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "ACTIVE")} />
          ),
        },
        {
          key: "goals",
          label: "Goals",
          render: (row) => String(asRecordArray(row.goals).length),
        },
        {
          key: "target",
          label: "Target",
          render: (row) =>
            formatDate(row.targetCompletionDate ?? row.target_completion_date),
        },
        {
          key: "actions",
          label: "Goals",
          render: (row) => (
            <div className="flex flex-wrap gap-1">
              {asRecordArray(row.goals).map((goal) => {
                const id = rowId(goal);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-1 rounded border px-2 py-1 text-xs"
                  >
                    <span>
                      {readString(goal, ["title"], `Goal #${id}`)} (
                      {readNumber(goal, [
                        "progressPercent",
                        "progress_percent",
                      ]) ?? 0}
                      %)
                    </span>
                    {canUpdateDevelopmentGoals ? (
                      <button
                        type="button"
                        className={actionButtonClass}
                        disabled={busyId === `goal-${id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          const raw = window.prompt(
                            "Progress percentage (0–100)",
                            String(
                              readNumber(goal, [
                                "progressPercent",
                                "progress_percent",
                              ]) ?? 0,
                            ),
                          );
                          if (raw === null) return;
                          const progress = Number(raw);
                          if (
                            !Number.isInteger(progress) ||
                            progress < 0 ||
                            progress > 100
                          ) {
                            toast.error("Enter a whole number from 0 to 100.");
                            return;
                          }
                          void runAction(
                            `goal-${id}`,
                            (token) =>
                              updatePerformanceDevelopmentGoal(token, id, {
                                progress_percent: progress,
                              }),
                            "Goal progress updated.",
                          );
                        }}
                      >
                        Update
                      </button>
                    ) : null}
                    {canUpdateDevelopmentGoals &&
                    readString(goal, ["status"]).toUpperCase() !==
                      "COMPLETED" ? (
                      <button
                        type="button"
                        className={actionButtonClass}
                        disabled={busyId === `complete-${id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void runAction(
                            `complete-${id}`,
                            (token) =>
                              updatePerformanceDevelopmentGoal(token, id, {
                                status: "COMPLETED",
                                progress_percent: 100,
                              }),
                            "Goal completed.",
                          );
                        }}
                      >
                        Complete
                      </button>
                    ) : null}
                    {canCarryDevelopmentGoals ? (
                      <button
                        type="button"
                        className={actionButtonClass}
                        disabled={busyId === `carry-${id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          const title = window.prompt(
                            "Title for the new development plan",
                            `${readString(row, ["title"], "Development plan")} — follow-up`,
                          );
                          if (!title?.trim()) return;
                          void runAction(
                            `carry-${id}`,
                            (token) =>
                              carryForwardPerformanceDevelopmentGoals(token, {
                                goal_ids: [Number(id)],
                                title: title.trim(),
                              }),
                            "Goal carried forward into a new plan.",
                          );
                        }}
                      >
                        Carry forward
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ),
        },
      ];
    }
    if (activeTab === "reports") {
      return [
        {
          key: "report",
          label: "Report",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">
                {readString(row, ["name"], optionLabel(row))}
              </p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["code"])}
              </p>
            </div>
          ),
        },
        {
          key: "description",
          label: "Description",
          render: (row) => readString(row, ["description"], "N/A"),
        },
        {
          key: "actions",
          label: "Exports",
          render: (row) => {
            const code = readString(row, ["code"]);
            const formats = ["csv", "xlsx", "pdf"] as const;
            return (
              <div className="flex flex-wrap gap-1">
                {formats.map((format) => (
                  <button
                    key={format}
                    type="button"
                    className={actionButtonClass}
                    disabled={!code || busyId === `${code}-${format}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void runAction(
                        `${code}-${format}`,
                        async (token) => {
                          const blob = await downloadPerformanceReport(
                            token,
                            code,
                            format,
                          );
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = `${code.toLowerCase()}.${format}`;
                          link.click();
                          URL.revokeObjectURL(url);
                        },
                        `${format.toUpperCase()} export downloaded.`,
                      );
                    }}
                  >
                    {busyId === `${code}-${format}` ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      format.toUpperCase()
                    )}
                  </button>
                ))}
              </div>
            );
          },
        },
      ];
    }
    if (activeTab === "calibration") {
      if (calibrationComparison)
        return [
          {
            key: "employee",
            label: "Employee",
            render: (row) => readString(row, ["employee_name"], "Unknown"),
          },
          {
            key: "department",
            label: "Department",
            render: (row) => readString(row, ["department_name"], "Unassigned"),
          },
          {
            key: "score",
            label: "Final score",
            render: (row) => readString(row, ["final_score"], "N/A"),
          },
          {
            key: "rating",
            label: "Rating",
            render: (row) => readString(row, ["rating_code"], "N/A"),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <StatusChip value={readString(row, ["status"], "UNKNOWN")} />
            ),
          },
        ];
      return [
        {
          key: "department",
          label: "Department",
          render: (row) => readString(row, ["department_name"], "Unassigned"),
        },
        {
          key: "average",
          label: "Average",
          render: (row) => readString(row, ["average_score"], "N/A"),
        },
        {
          key: "range",
          label: "Range",
          render: (row) =>
            `${readString(row, ["minimum_score"], "N/A")} - ${readString(row, ["maximum_score"], "N/A")}`,
        },
        {
          key: "pending",
          label: "Pending",
          render: (row) => readString(row, ["pending_reviews"], "0"),
        },
      ];
    }
    if (activeTab === "plans") {
      return [
        {
          key: "employee",
          label: "Employee",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{employeeLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(
                  asRecord(row.financialYear ?? row.financial_year),
                  ["name", "code"],
                  `Year #${readNumber(row, ["financialYearId", "financial_year_id"]) ?? "—"}`,
                )}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip
              value={readString(
                row,
                ["kpiPhase", "kpi_phase", "status"],
                "DRAFT",
              )}
            />
          ),
        },
        {
          key: "effective",
          label: "Effective",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{formatDate(row.effectiveFrom ?? row.effective_from)}</p>
              <p className="text-muted-foreground">
                To {formatDate(row.effectiveTo ?? row.effective_to)}
              </p>
            </div>
          ),
        },
        {
          key: "items",
          label: "Items",
          render: (row) => String(asRecordArray(row.items).length),
        },
      ];
    }
    if (activeTab === "reviews") {
      return [
        {
          key: "appeal",
          label: "Appeal",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{employeeLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                Review #
                {readNumber(row, [
                  "reviewId",
                  "review_id",
                  "performanceReviewId",
                ]) ?? "—"}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "reason",
          label: "Reason",
          render: (row) =>
            readString(row, ["reason", "appeal_reason", "appealReason"], "—"),
        },
        {
          key: "created",
          label: "Opened",
          render: (row) => formatDate(row.createdAt ?? row.created_at),
        },
      ];
    }
    if (activeTab === "improvement") {
      return [
        {
          key: "plan",
          label: "Plan",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">
                {readString(row, ["summary", "title"], `PIP #${rowId(row)}`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {employeeLabel(row)}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "milestones",
          label: "Milestones",
          render: (row) => String(asRecordArray(row.milestones).length),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row);

            return (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `close-${id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void runAction(
                      `close-${id}`,
                      (token) => closePerformanceImprovementPlan(token, id),
                      "Improvement plan closed.",
                    );
                  }}
                >
                  {busyId === `close-${id}` ? (
                    <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  ) : (
                    "Close"
                  )}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    const firstMilestone = asRecordArray(row.milestones)[0];
                    openCreate("milestone", {
                      milestone_id: rowId(firstMilestone),
                      comment: "",
                    });
                  }}
                >
                  Review milestone
                </button>
              </div>
            );
          },
        },
      ];
    }
    if (setupTab === "kpis") {
      return [
        {
          key: "name",
          label: "KPI",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["code", "category"])}
              </p>
            </div>
          ),
        },
        {
          key: "version",
          label: "Current version",
          render: (row) => {
            const current = currentKpiVersion(row);
            const versionId = readNumber(row, [
              "currentVersionId",
              "current_version_id",
            ]);
            const number = readString(current, [
              "versionNumber",
              "version_number",
            ]);
            return number
              ? `v${number}${versionId !== null ? ` · #${versionId}` : ""}`
              : versionId !== null
                ? `#${versionId}`
                : "—";
          },
        },
        {
          key: "versions",
          label: "Versions",
          render: (row) => String(kpiVersions(row).length),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "ACTIVE")} />
          ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  openCreate("kpi-edit", seedKpiDefinitionForm(row));
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  openCreate("kpi-version", seedKpiVersionForm(row));
                }}
              >
                New version
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  const id = rowId(row);
                  if (
                    !id ||
                    !window.confirm(`Archive KPI ${optionLabel(row)}?`)
                  )
                    return;
                  void runAction(
                    `delete-kpi-${id}`,
                    (token) => deletePerformanceKpi(token, id),
                    "KPI archived.",
                  );
                }}
              >
                Delete
              </button>
            </div>
          ),
        },
      ];
    }
    if (setupTab === "rules") {
      return [
        {
          key: "rule",
          label: "Applicability rule",
          render: (row) => readString(row, ["name"], `Rule #${rowId(row)}`),
        },
        {
          key: "kpiVersion",
          label: "KPI version",
          render: (row) => {
            const versionId = readNumber(row, [
              "kpiDefinitionVersionId",
              "kpi_definition_version_id",
            ]);
            const version = kpiVersionOptions(kpis).find(
              (item) => Number(item.id) === versionId,
            );
            return (
              version?.label ??
              (versionId === null ? "—" : `Version #${versionId}`)
            );
          },
        },
        {
          key: "scope",
          label: "Applies to",
          render: (row) => {
            const dimensions = [
              [
                "Year",
                years,
                readNumber(row, ["financialYearId", "financial_year_id"]),
              ],
              ["Branch", branches, readNumber(row, ["branchId", "branch_id"])],
              [
                "Department",
                departments,
                readNumber(row, ["departmentId", "department_id"]),
              ],
              [
                "Position",
                positions,
                readNumber(row, ["positionId", "position_id"]),
              ],
              ["Grade", grades, readNumber(row, ["gradeId", "grade_id"])],
              [
                "Employee",
                employees,
                readNumber(row, ["employeeId", "employee_id"]),
              ],
            ] as const;
            const scope = dimensions.flatMap(([label, source, id]) => {
              if (id === null) return [];
              const match = optionForId(source, id);
              return [`${label}: ${match ? optionLabel(match) : `#${id}`}`];
            });
            const employmentType = readString(row, [
              "employmentType",
              "employment_type",
            ]);
            const cycle = readString(row, ["reviewCycle", "review_cycle"]);
            if (employmentType) scope.push(`Type: ${prettify(employmentType)}`);
            if (cycle) scope.push(`Cycle: ${prettify(cycle)}`);
            return scope.length ? scope.join(" · ") : "All employees";
          },
        },
        {
          key: "overrides",
          label: "Overrides",
          render: (row) => {
            const weight = readString(row, [
              "weightOverride",
              "weight_override",
            ]);
            const target = readString(row, [
              "targetOverride",
              "target_override",
            ]);
            return (
              [
                weight ? `Weight ${weight}` : "",
                target ? `Target ${target}` : "",
              ]
                .filter(Boolean)
                .join(" · ") || "—"
            );
          },
        },
        {
          key: "priority",
          label: "Priority",
          render: (row) => readString(row, ["priority"], "0"),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "ACTIVE")} />
          ),
        },
      ];
    }
    if (setupTab === "years") {
      return [
        {
          key: "year",
          label: "Year",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["code"])}
              </p>
            </div>
          ),
        },
        {
          key: "dates",
          label: "Dates",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{formatDate(row.startDate ?? row.start_date)}</p>
              <p className="text-muted-foreground">
                {formatDate(row.endDate ?? row.end_date)}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row);
            return (
              <div className="flex flex-wrap gap-1">
                <FluentButton
                  type="button"
                  appearance="subtle"
                  size="small"
                  disabled={busyId === `gen-${id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void generatePeriodsForYear(id);
                  }}
                >
                  {busyId === `gen-${id}` ? (
                    <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  ) : (
                    "Generate periods"
                  )}
                </FluentButton>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `agg-${id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void runAction(
                      `agg-${id}`,
                      (token) =>
                        calculatePerformanceAggregates(token, id, "MONTHLY"),
                      "Aggregates calculated.",
                    );
                  }}
                >
                  {busyId === `agg-${id}` ? (
                    <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  ) : (
                    "Aggregates"
                  )}
                </button>
              </div>
            );
          },
        },
      ];
    }
    if (setupTab === "periods") {
      return [
        {
          key: "period",
          label: "Period",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {prettify(
                  readString(row, ["periodType", "period_type"], "MONTHLY"),
                )}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip
              value={readString(
                row,
                ["kpiPhase", "kpi_phase", "status"],
                "DRAFT",
              )}
            />
          ),
        },
        {
          key: "dates",
          label: "Window",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{formatDate(row.startDate ?? row.start_date)}</p>
              <p className="text-muted-foreground">
                {formatDate(row.endDate ?? row.end_date)}
              </p>
            </div>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row);
            const status = readString(row, ["status"], "DRAFT");
            const phase = readString(row, ["kpiPhase", "kpi_phase"]);
            return (
              <div className="flex flex-wrap gap-1">
                {canCreatePerformance && status === "DRAFT" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={(event) => {
                      event.stopPropagation();
                      const value = (
                        camel: string,
                        snake: string,
                        fallback = "",
                      ) => readString(row, [camel, snake], fallback);
                      openCreate("period-edit", {
                        period_id: id,
                        financial_year_id: value(
                          "financialYearId",
                          "financial_year_id",
                        ),
                        name: value("name", "name"),
                        description: value("description", "description"),
                        period_type: value(
                          "periodType",
                          "period_type",
                          "MONTHLY",
                        ),
                        sequence_number: value(
                          "sequenceNumber",
                          "sequence_number",
                          "1",
                        ),
                        start_date: value("startDate", "start_date").slice(
                          0,
                          10,
                        ),
                        end_date: value("endDate", "end_date").slice(0, 10),
                        goal_setting_deadline: value(
                          "goalSettingDeadline",
                          "goal_setting_deadline",
                        ).slice(0, 10),
                        mid_cycle_review_date: value(
                          "midCycleReviewDate",
                          "mid_cycle_review_date",
                        ).slice(0, 10),
                        final_review_deadline: value(
                          "finalReviewDeadline",
                          "final_review_deadline",
                        ).slice(0, 10),
                        max_weightage: value(
                          "maxWeightage",
                          "max_weightage",
                          "100",
                        ),
                        score_cap: value("scoreCap", "score_cap", "120"),
                        cooling_period_days: value(
                          "coolingPeriodDays",
                          "cooling_period_days",
                          "0",
                        ),
                        allow_parallel: String(
                          row.allowParallel ?? row.allow_parallel ?? true,
                        ),
                      });
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                {canActivatePeriod && status === "DRAFT" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `activate-${id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void runAction(
                        `activate-${id}`,
                        (token) => activatePerformancePeriod(token, id),
                        "Performance period activated.",
                      );
                    }}
                  >
                    Activate
                  </button>
                ) : null}
                {canClosePeriod &&
                !["DRAFT", "LOCKED", "CANCELLED"].includes(status) ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `close-period-${id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void runAction(
                        `close-period-${id}`,
                        (token) => closePerformancePeriod(token, id),
                        "Performance period locked.",
                      );
                    }}
                  >
                    Lock
                  </button>
                ) : null}
                {canReopenPeriod &&
                status === "LOCKED" &&
                ["LOCKED", "CLOSED"].includes(phase) ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `reopen-period-${id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      const reason = window
                        .prompt("Reason for reopening this KPI cycle")
                        ?.trim();
                      if (!reason) return;
                      void runAction(
                        `reopen-period-${id}`,
                        (token) => reopenPerformancePeriod(token, id, reason),
                        "KPI cycle reopened.",
                      );
                    }}
                  >
                    Reopen
                  </button>
                ) : null}
                <FluentButton
                  type="button"
                  appearance="subtle"
                  size="small"
                  disabled={busyId === `assign-${id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void runPeriodAction(id, "assign");
                  }}
                >
                  {busyId === `assign-${id}` ? (
                    <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  ) : periodActionResults[id]?.assignments ? (
                    `Assignments (${periodActionResults[id].assignments})`
                  ) : (
                    "Assign plans"
                  )}
                </FluentButton>
                <FluentButton
                  type="button"
                  appearance="subtle"
                  size="small"
                  disabled={busyId === `sync-${id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void runPeriodAction(id, "sync");
                  }}
                >
                  {busyId === `sync-${id}` ? (
                    <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  ) : periodActionResults[id]?.synced ? (
                    `Synced (${periodActionResults[id].synced})`
                  ) : (
                    "Sync system KPIs"
                  )}
                </FluentButton>
                {periodActionResults[id]?.assignments === 0 ? (
                  <span className="w-full text-xs text-amber-700 dark:text-amber-300">
                    No active plans assigned for this period.
                  </span>
                ) : null}
                {periodActionResults[id]?.synced === 0 ? (
                  <span className="w-full text-xs text-amber-700 dark:text-amber-300">
                    No eligible system KPI values to sync.
                  </span>
                ) : null}
              </div>
            );
          },
        },
      ];
    }
    if (setupTab === "scorecards") {
      return [
        {
          key: "name",
          label: "Scorecard",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["code"])}
              </p>
            </div>
          ),
        },
        {
          key: "components",
          label: "Components",
          render: (row) =>
            String(
              asRecordArray(row.components).filter(
                (item) => item.enabled !== false,
              ).length,
            ),
        },
        {
          key: "default",
          label: "Default",
          render: (row) => (row.isDefault || row.is_default ? "Yes" : "No"),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "ACTIVE")} />
          ),
        },
      ];
    }
    if (setupTab === "workflows") {
      return [
        {
          key: "name",
          label: "Workflow",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["code"])}
              </p>
            </div>
          ),
        },
        {
          key: "steps",
          label: "Steps",
          render: (row) => String(asRecordArray(row.steps).length),
        },
        {
          key: "scope",
          label: "Scope",
          render: (row) => {
            const departmentId = readNumber(row, [
              "appliesToDepartmentId",
              "applies_to_department_id",
            ]);
            const positionId = readNumber(row, [
              "appliesToPositionId",
              "applies_to_position_id",
            ]);
            if (departmentId !== null) return `Dept #${departmentId}`;
            if (positionId !== null) return `Position #${positionId}`;
            return "Company default";
          },
        },
        {
          key: "default",
          label: "Default",
          render: (row) => (row.isDefault || row.is_default ? "Yes" : "No"),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "ACTIVE")} />
          ),
        },
      ];
    }
    return [
      {
        key: "name",
        label: "Name",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">{optionLabel(row)}</p>
            <p className="text-xs text-muted-foreground">
              {readString(row, ["code", "category"])}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <StatusChip value={readString(row, ["status"], "ACTIVE")} />
        ),
      },
      {
        key: "updated",
        label: "Updated",
        render: (row) => formatDate(row.updatedAt ?? row.updated_at),
      },
    ];
  }, [
    runAction,
    canReopenPeriod,
    periodActionResults,
    activeTab,
    branches,
    busyId,
    calibrationComparison,
    canActivatePeriod,
    canCarryDevelopmentGoals,
    canClosePeriod,
    canCreatePerformance,
    canUpdateDevelopmentGoals,
    departments,
    employees,
    grades,
    kpis,
    positions,
    setupTab,
    years,
  ]);

  const createLabel =
    createMode === "year"
      ? "New financial year"
      : createMode === "period"
        ? "New performance period"
        : createMode === "period-edit"
          ? "Edit performance period"
          : createMode === "kpi"
            ? "New KPI"
            : createMode === "kpi-edit"
              ? "Edit KPI"
              : createMode === "kpi-version"
                ? "New KPI version"
                : createMode === "template"
                  ? "New template"
                  : createMode === "rule"
                    ? "New applicability rule"
                    : createMode === "competency"
                      ? "New competency template"
                      : createMode === "scale"
                        ? "New rating scale"
                        : createMode === "scorecard"
                          ? "New scorecard"
                          : createMode === "workflow"
                            ? "New workflow"
                            : createMode === "development"
                              ? "New development plan"
                              : createMode === "plan"
                                ? "New plan"
                                : createMode === "generate-plan"
                                  ? "Generate plan from rules"
                                  : createMode === "pip"
                                    ? "New improvement plan"
                                    : createMode === "moderate"
                                      ? "Moderate review"
                                      : createMode === "approve"
                                        ? "Approve review"
                                        : createMode === "workflow-action"
                                          ? "Act on review workflow"
                                          : createMode === "feedback"
                                            ? "Invite 360 feedback"
                                            : createMode === "reopen"
                                              ? "Reopen review"
                                              : "Review milestone";

  if (actor.ready && !canAccess) {
    return (
      <WorkflowGuide
        title="Performance access is limited"
        unavailable="Your account cannot access this performance workspace. Ask your administrator to grant the relevant performance permissions."
        steps={[
          "Confirm your assigned role and company.",
          "Sign in again after access has been updated.",
        ]}
      />
    );
  }

  if (loading && !createOpen)
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <FluentLoadingIndicator />
        <p role="status">
          Loading this workflow and checking its available actions…
        </p>
      </section>
    );

  if (error && !loading && !createOpen)
    return (
      <section className="flex flex-col gap-4">
        <WorkflowGuide
          title="This workflow needs attention"
          unavailable={error}
          steps={[
            "Resolve the permission, setup, or network issue described above.",
            "Reload this view before continuing.",
          ]}
        />
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => void load()}
        >
          Reload workflow
        </button>
      </section>
    );

  return (
    <section className="space-y-4">
      <WorkflowGuide
        title="Performance workflow"
        steps={[
          "Set up a financial year and its review periods.",
          "Define KPIs, templates, rating scales, scorecards, and approval workflow.",
          "Assign employee plans with KPI weights totaling exactly 100%.",
          "Employees submit self reviews, then managers submit their review.",
          "HR reviews and calibrates eligible scores before approval and publication.",
        ]}
        unavailable={error}
      />
      {!loading &&
      !error &&
      activeTab === "calibration" &&
      calibrationRows.length === 0 ? (
        <WorkflowGuide
          title="Calibration is not ready"
          unavailable="No review results are available to compare yet."
          steps={[
            "Configure and activate a performance cycle.",
            "Assign plans and complete employee and manager reviews.",
            "Return here when reviews have calculated scores.",
          ]}
          action={{
            href: "/dashboard/performance/setup",
            label: "Open performance setup",
          }}
        />
      ) : null}
      {!loading &&
      !error &&
      (activeTab === "overview" ||
        (activeTab === "setup" && setupTab === "periods")) &&
      periods.length === 0 ? (
        <WorkflowGuide
          title="Create your first performance cycle"
          unavailable="No performance period is configured."
          steps={[
            "Create a financial year.",
            "Create or generate its review periods.",
            "Activate the period before assigning and reviewing KPIs.",
          ]}
          action={{
            href: "/dashboard/performance/setup",
            label: "Configure performance",
          }}
        />
      ) : null}
      {activeTab === "overview" ? (
        <>
          <div className="flex flex-col gap-4 space-y-5 px-1 pb-2 pt-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <Badge appearance="tint" color="brand" size="small">
                  Performance workspace
                </Badge>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Overview
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  A snapshot of cycles, plans, reviews, and follow-up work.
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Input
                  aria-label="Search performance work"
                  contentBefore={<SearchIcon className="size-4" />}
                  value={overviewSearch}
                  onChange={(_event, data) => setOverviewSearch(data.value)}
                  placeholder="Search work"
                  size="small"
                  className="min-w-0 flex-1 sm:w-56 sm:flex-none"
                />
                <FluentButton
                  appearance="secondary"
                  size="small"
                  disabled={loading}
                  onClick={() => void load()}
                  icon={
                    loading ? (
                      <FluentLoadingIndicator className="size-4 animate-spin" />
                    ) : (
                      <RefreshCwIcon className="size-4" />
                    )
                  }
                >
                  Refresh
                </FluentButton>
              </div>
            </div>
            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
              >
                {error}
              </p>
            ) : null}
            <div className="grid gap-0 border-y border-border sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Active cycles",
                  value: activePeriods.length,
                  detail: `${periods.length} total periods`,
                  icon: CalendarIcon,
                },
                {
                  label: "Open reviews",
                  value: openReviews,
                  detail: "Waiting for a review step",
                  icon: PendingIcon,
                },
                {
                  label: "Completion",
                  value:
                    completionRate === null
                      ? "Pending"
                      : `${Math.round(completionRate)}%`,
                  detail: "Reviews completed",
                  icon: CompletedIcon,
                },
                {
                  label: "Average score",
                  value:
                    averageScore === null
                      ? "Pending"
                      : `${Math.round(averageScore)}%`,
                  detail: "Across scored reviews",
                  icon: ScoreIcon,
                },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:px-5 xl:border-b-0 xl:border-r xl:last:border-r-0"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2">
                        <Icon
                          className="size-5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="truncate text-sm font-semibold text-foreground">
                          {metric.label}
                        </span>
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {metric.detail}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "performance-overview-metric-value shrink-0 text-right font-extrabold tracking-[-0.06em] tabular-nums text-primary",
                        metric.value === "Pending"
                          ? "performance-overview-metric-value-pending"
                          : String(metric.value).length > 2
                            ? "performance-overview-metric-value-long"
                            : "",
                      )}
                    >
                      {metric.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
            <section className="min-w-0 border-t border-border pt-2">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Cycle snapshot
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Review windows and their current phase.
                  </p>
                </div>
                <FluentButton
                  appearance="subtle"
                  size="small"
                  onClick={() => router.push("/dashboard/performance/setup")}
                >
                  View periods
                </FluentButton>
              </div>
              <div className="divide-y divide-border px-4">
                {periods.slice(0, 4).map((period) => {
                  const status = readString(
                    period,
                    ["kpiPhase", "kpi_phase", "status"],
                    "DRAFT",
                  ).toUpperCase();
                  return (
                    <button
                      key={rowId(period)}
                      type="button"
                      className="w-full py-3 text-left transition-colors hover:bg-muted/30"
                      onClick={() => {
                        setDetailRecord(period);
                        setDetailOpen(true);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                          {optionLabel(period)}
                        </p>
                        <StatusChip value={status} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(period.startDate ?? period.start_date)} –{" "}
                        {formatDate(period.endDate ?? period.end_date)}
                      </p>
                    </button>
                  );
                })}
                {!loading && periods.length === 0 ? (
                  <p className="col-span-full px-2 py-8 text-center text-sm text-muted-foreground">
                    No periods yet. Create a year and generate periods in Setup.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="min-w-0 border-t border-border pt-2">
              <div className="border-b border-border px-4 py-4">
                <h2 className="text-base font-semibold text-foreground">
                  Needs attention
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Open items across this performance workspace.
                </p>
              </div>
              <div className="divide-y divide-border px-4">
                {[
                  {
                    label: "Plans to prepare",
                    count: pendingPlans,
                    url: "/dashboard/performance/plans",
                  },
                  {
                    label: "Reviews awaiting action",
                    count: openReviews,
                    url: "/dashboard/performance/reviews",
                  },
                  {
                    label: "Open appeals",
                    count: openAppeals,
                    url: "/dashboard/performance/reviews",
                  },
                  {
                    label: "Improvement plans",
                    count: pipCount,
                    url: "/dashboard/performance/improvement",
                  },
                  {
                    label: "Development plans",
                    count: developmentPlanCount,
                    url: "/dashboard/performance/development",
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => router.push(item.url)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left hover:text-primary"
                  >
                    <span className="text-sm text-foreground">
                      {item.label}
                    </span>
                    <Badge
                      appearance="tint"
                      color={Number(item.count) > 0 ? "warning" : "subtle"}
                    >
                      {item.count}
                    </Badge>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
            <section className="min-w-0 border-t border-border pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Recent performance work
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Periods, plans, development, improvement, and appeals.
                  </p>
                </div>
                <FluentSelect
                  ariaLabel="Filter work by status"
                  size="small"
                  value={overviewStatus}
                  onChange={setOverviewStatus}
                  options={[
                    { value: "ALL", label: "All statuses" },
                    ...overviewStatuses.map((status) => ({
                      value: status,
                      label: prettify(status),
                    })),
                  ]}
                />
              </div>
              <div className="divide-y divide-border px-4">
                {overviewRecords.slice(0, 6).map((row, index) => {
                  const status = readString(
                    row,
                    ["status", "review_status", "reviewStatus"],
                    "DRAFT",
                  ).toUpperCase();
                  const progress = readNumber(row, [
                    "progress",
                    "progress_percentage",
                    "completion_rate",
                    "completionRate",
                  ]);
                  return (
                    <button
                      key={`${readString(row, ["dashboard_kind"])}-${rowId(row) || index}`}
                      type="button"
                      onClick={() => {
                        setDetailRecord(row);
                        setDetailOpen(true);
                      }}
                      className="flex w-full min-w-0 items-center gap-3 py-3 text-left hover:bg-muted/20"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {optionLabel(row)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {readString(row, ["dashboard_kind"])} ·{" "}
                          {formatDate(
                            row["dueDate"] ??
                              row["due_date"] ??
                              row["endDate"] ??
                              row["end_date"],
                          )}
                        </p>
                        {progress !== null ? (
                          <ProgressBar
                            value={Math.min(1, Math.max(0, progress / 100))}
                            thickness="medium"
                            className="mt-2 max-w-48"
                          />
                        ) : null}
                      </div>
                      <StatusChip value={status} />
                    </button>
                  );
                })}
                {!loading && overviewRecords.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No work matches this search or status.
                  </p>
                ) : null}
              </div>
              {overviewRecords.length > 6 ? (
                <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  Showing 6 of {overviewRecords.length} items. Open the relevant
                  section for the full list.
                </p>
              ) : null}
            </section>

            <div className="space-y-6">
              <section className="border-t border-border px-4 pt-4">
                <h2 className="text-base font-semibold text-foreground">
                  Team snapshot
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Manager view of reporting and review progress.
                </p>
                {managerSummary &&
                (managerTeamSize !== null ||
                  managerPendingReviews !== null ||
                  managerAverageScore !== null) ? (
                  <div className="mt-4 grid grid-cols-3 gap-2 border-y border-border py-3">
                    {[
                      { label: "People", value: managerTeamSize ?? 0 },
                      { label: "Pending", value: managerPendingReviews ?? 0 },
                      {
                        label: "Avg. score",
                        value:
                          managerAverageScore === null
                            ? "Pending"
                            : `${Math.round(managerAverageScore)}%`,
                      },
                    ].map((metric) => (
                      <div key={metric.label} className="p-2 text-center">
                        <p className="text-lg font-semibold tabular-nums text-foreground">
                          {metric.value}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {metric.label}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Team summary is unavailable for this account.
                  </p>
                )}
                <FluentButton
                  appearance="subtle"
                  size="small"
                  className="mt-3 self-start"
                  onClick={() => router.push("/dashboard/me/performance/team")}
                >
                  View team
                </FluentButton>
              </section>
              <section className="border-t border-border px-4 pt-4">
                <h2 className="text-base font-semibold text-foreground">
                  Next steps
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Continue the performance workflow.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canCreatePerformance ? (
                    <FluentButton
                      appearance="primary"
                      size="small"
                      onClick={() =>
                        router.push("/dashboard/performance/setup")
                      }
                    >
                      Set up cycle
                    </FluentButton>
                  ) : null}
                  <FluentButton
                    appearance="secondary"
                    size="small"
                    onClick={() => router.push("/dashboard/performance/plans")}
                  >
                    Open plans
                  </FluentButton>
                  <FluentButton
                    appearance="secondary"
                    size="small"
                    onClick={() =>
                      router.push("/dashboard/performance/reports")
                    }
                  >
                    Reports
                  </FluentButton>
                </div>
              </section>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "setup"
                ? "Performance setup"
                : activeTab === "plans"
                  ? "Employee plans"
                  : activeTab === "development"
                    ? "Development plans"
                    : activeTab === "reviews"
                      ? "Reviews and appeals"
                      : activeTab === "reports"
                        ? "Performance reports"
                        : activeTab === "calibration"
                          ? "Calibration"
                          : "Improvement plans"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "setup"
                ? "Years, periods, KPIs, templates, rules, competencies, rating scales, scorecards, and workflows."
                : activeTab === "plans"
                  ? "Assign or generate the KPI set each employee is measured on."
                  : activeTab === "development"
                    ? "Create growth plans, track goals, and carry development forward."
                    : activeTab === "reviews"
                      ? "Moderate, approve, or reopen reviews and inspect open appeals."
                      : activeTab === "reports"
                        ? "Download KPI, appraisal, PIP, development, and feedback reports."
                        : activeTab === "calibration"
                          ? "Compare appraisal outcomes across departments."
                          : "Track PIPs, close them, and review milestones."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              Refresh
            </button>
            {activeTab === "calibration" ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setCalibrationComparison((current) => !current)}
              >
                {calibrationComparison
                  ? "Department summary"
                  : "Compare reviews"}
              </button>
            ) : null}
            {activeTab === "setup" && canCreatePerformance ? (
              <>
                {setupTab === "kpis" ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() =>
                      openCreate(
                        "kpi-version",
                        kpis[0] ? seedKpiVersionForm(kpis[0]) : {},
                      )
                    }
                    disabled={kpis.length === 0}
                  >
                    New version
                  </button>
                ) : null}
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() =>
                    openCreate(
                      setupTab === "years"
                        ? "year"
                        : setupTab === "periods"
                          ? "period"
                          : setupTab === "kpis"
                            ? "kpi"
                            : setupTab === "templates"
                              ? "template"
                              : setupTab === "rules"
                                ? "rule"
                                : setupTab === "competencies"
                                  ? "competency"
                                  : setupTab === "scales"
                                    ? "scale"
                                    : setupTab === "scorecards"
                                      ? "scorecard"
                                      : setupTab === "workflows"
                                        ? "workflow"
                                        : "year",
                    )
                  }
                >
                  <PlusIcon className="size-4" />
                  New
                </button>
              </>
            ) : null}
            {activeTab === "plans" && canCreatePerformance ? (
              <>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => openCreate("generate-plan")}
                >
                  Generate from rules
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => openCreate("plan")}
                >
                  <PlusIcon className="size-4" />
                  New plan
                </button>
              </>
            ) : null}
            {activeTab === "reviews" && canModerateReviews ? (
              <>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => openCreate("moderate")}
                >
                  Moderate
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => openCreate("reopen")}
                >
                  Reopen
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() =>
                    openCreate("feedback", {
                      relationship_type: "PEER",
                      is_anonymous: "true",
                    })
                  }
                >
                  360 feedback
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => openCreate("approve")}
                >
                  Approve
                </button>
              </>
            ) : null}
            {activeTab === "reviews" && canReadReviewWorkflow ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  const reviewId = window
                    .prompt("Review ID to inspect")
                    ?.trim();
                  if (!reviewId) return;
                  void runAction(
                    `workflow-${reviewId}`,
                    async (token) => {
                      const workflow = await getPerformanceReviewWorkflow(
                        token,
                        reviewId,
                      );
                      setDetailRecord({ review_id: reviewId, workflow });
                      setDetailOpen(true);
                    },
                    "Review workflow loaded.",
                  );
                }}
              >
                Inspect workflow
              </button>
            ) : null}
            {activeTab === "reviews" && canActOnReviewWorkflow ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  openCreate("workflow-action", { decision: "APPROVE" })
                }
              >
                Workflow decision
              </button>
            ) : null}
            {activeTab === "improvement" && canCreatePerformance ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => openCreate("pip")}
              >
                <PlusIcon className="size-4" />
                New PIP
              </button>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === "setup" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Setup step{" "}
            {(
              [
                "years",
                "periods",
                "kpis",
                "templates",
                "rules",
                "competencies",
                "scales",
                "scorecards",
                "workflows",
              ] as SetupTab[]
            ).indexOf(setupTab) + 1}{" "}
            of 9. Configure the catalog below, then continue. Templates, rules,
            and competencies can be skipped when your evaluation design does not
            use them.
          </p>
          {setupTab !== "workflows" ? (
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={loading || saving}
              onClick={() => {
                const sequence: SetupTab[] = [
                  "years",
                  "periods",
                  "kpis",
                  "templates",
                  "rules",
                  "competencies",
                  "scales",
                  "scorecards",
                  "workflows",
                ];
                const next = sequence[sequence.indexOf(setupTab) + 1];
                if (next) setSetupTab(next);
              }}
            >
              Continue to next setup step
            </button>
          ) : (
            <Link
              href="/dashboard/performance/plans"
              className={secondaryButtonClass}
            >
              Continue to employee plans
            </Link>
          )}
        </div>
      ) : null}

      {activeTab === "setup" ? (
        <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          {SETUP_TAB_GROUPS.map((group) => (
            <div
              key={group.label}
              className="min-w-0 rounded-lg border border-border/60 bg-background p-2"
            >
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {group.label}
              </p>
              <TabList
                size="small"
                selectedValue={
                  group.tabs.some((tab) => tab.id === setupTab)
                    ? setupTab
                    : undefined
                }
                onTabSelect={(_event, data) =>
                  setSetupTab(data.value as SetupTab)
                }
                className="flex max-w-full flex-wrap gap-1"
              >
                {group.tabs.map((tab) => (
                  <Tab key={tab.id} value={tab.id}>
                    {tab.label}
                  </Tab>
                ))}
              </TabList>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          {activeTab === "setup" && setupTab === "templates" ? (
            <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
              <FluentSelect
                ariaLabel="KPI template"
                value={applyTemplateId}
                onChange={setApplyTemplateId}
                options={[
                  { value: "", label: "Choose template" },
                  ...templates.map((row) => ({
                    value: rowId(row),
                    label: optionLabel(row),
                  })),
                ]}
              />
              <FluentSelect
                ariaLabel="KPI cycle"
                value={applyPeriodId}
                onChange={setApplyPeriodId}
                options={[
                  { value: "", label: "Choose open cycle" },
                  ...periods
                    .filter((row) =>
                      ["GOAL_SETTING", "REOPENED"].includes(
                        readString(row, ["kpiPhase", "kpi_phase"]),
                      ),
                    )
                    .map((row) => ({
                      value: rowId(row),
                      label: optionLabel(row),
                    })),
                ]}
              />
              <FluentSelect
                ariaLabel="Existing KPI policy"
                value={applyPolicy}
                onChange={(value) =>
                  setApplyPolicy(value as "MERGE" | "SKIP" | "REPLACE")
                }
                options={[
                  { value: "MERGE", label: "Merge" },
                  { value: "SKIP", label: "Skip existing" },
                  { value: "REPLACE", label: "Replace existing" },
                ]}
              />
              <button
                type="button"
                className={primaryButtonClass}
                disabled={
                  !applyTemplateId ||
                  !applyPeriodId ||
                  busyId === "apply-template"
                }
                onClick={() =>
                  void runAction(
                    "apply-template",
                    (token) =>
                      applyPerformanceKpiTemplate(
                        token,
                        applyPeriodId,
                        applyTemplateId,
                        applyPolicy,
                      ),
                    "Template assigned to matching roles.",
                  )
                }
              >
                Apply template
              </button>
            </div>
          ) : null}
          <SearchToggleField
            value={search}
            onChange={setSearch}
            placeholder="Search records"
          />
          {activeTab === "setup" && setupTab === "periods" ? (
            <p className="text-xs text-muted-foreground">
              Assign plans creates review assignments from active performance
              plans. Sync system KPIs updates values from attendance, leave,
              activities, and field visits for those assignments.
            </p>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Performance records"
              data={visibleRows}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey={`performance-${activeTab}-${setupTab}`}
              onRowSelect={(_, row) => {
                if (!row) return;
                setDetailRecord(row);
                setDetailOpen(true);
              }}
            />
          </div>
        </div>
      ) : null}

      <RecordDetailsDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={optionLabel(detailRecord)}
        description="Full record from the performance API."
        row={detailRecord}
      />

      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          if (!saving) setCreateOpen(next);
        }}
      >
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{createLabel}</DialogTitle>
            <DialogDescription>Save this performance record.</DialogDescription>
          </DialogHeader>
          <ValidatedWorkflowForm
            key={createMode}
            saving={saving}
            submitError={formError}
            onSubmit={onCreate}
            validation={{
              schema: performanceFormSchema(createMode),
              input: {
                ...form,
                additionalTemplateItems,
                scorecardComponents,
                workflowSteps,
              },
            }}
            description="Configure the cycle before assigning plans. Review these changes before moving the workflow forward."
          >
            <div className="grid max-h-[60vh] gap-3 overflow-auto pr-1">
              {createMode === "year" ? (
                <>
                  <Field label="Code">
                    <input
                      className={inputClass}
                      value={form.code ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Name">
                    <input
                      className={inputClass}
                      value={form.name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Start date">
                    <DateInput
                      className={inputClass}
                      value={form.start_date ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          start_date: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="End date">
                    <DateInput
                      className={inputClass}
                      value={form.end_date ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          end_date: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Aggregation">
                    <FluentSelect
                      ariaLabel="Aggregation"
                      className="w-full"
                      value={form.annual_aggregation_method ?? ""}
                      placeholder="Default"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          annual_aggregation_method: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Default" },
                        ...AGGREGATION_METHODS.map((item) => ({
                          value: item,
                          label: prettify(item),
                        })),
                      ]}
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "period" || createMode === "period-edit" ? (
                <>
                  <Field label="Financial year">
                    <FluentSelect
                      ariaLabel="Financial year"
                      className="w-full"
                      value={form.financial_year_id ?? ""}
                      placeholder="Select financial year"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          financial_year_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select financial year" },
                        ...years.map((year) => ({
                          value: String(rowId(year)),
                          label: optionLabel(year),
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Name">
                    <input
                      className={inputClass}
                      value={form.name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      className={textareaClass}
                      value={form.description ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Period type">
                    <FluentSelect
                      ariaLabel="Period type"
                      className="w-full"
                      value={form.period_type ?? "MONTHLY"}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          period_type: value,
                        }))
                      }
                      options={PERIOD_TYPES.map((item) => ({
                        value: item,
                        label: prettify(item),
                      }))}
                    />
                  </Field>
                  <Field label="Sequence">
                    <input
                      type="number"
                      min="1"
                      className={inputClass}
                      value={form.sequence_number ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          sequence_number: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Start date">
                    <DateInput
                      className={inputClass}
                      value={form.start_date ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          start_date: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="End date">
                    <DateInput
                      className={inputClass}
                      value={form.end_date ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          end_date: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Goal-setting deadline">
                    <DateInput
                      className={inputClass}
                      value={form.goal_setting_deadline ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          goal_setting_deadline: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Mid-cycle review date">
                    <DateInput
                      className={inputClass}
                      value={form.mid_cycle_review_date ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          mid_cycle_review_date: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Final review deadline">
                    <DateInput
                      className={inputClass}
                      value={form.final_review_deadline ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          final_review_deadline: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Maximum weight (%)">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className={inputClass}
                      value={form.max_weightage ?? "100"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          max_weightage: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Score cap (%)">
                    <input
                      type="number"
                      min="1"
                      className={inputClass}
                      value={form.score_cap ?? "120"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          score_cap: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Cooling period (days)">
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={form.cooling_period_days ?? "0"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          cooling_period_days: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Parallel cycles">
                    <FluentSelect
                      ariaLabel="Parallel cycles"
                      className="w-full"
                      value={form.allow_parallel ?? "true"}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          allow_parallel: value,
                        }))
                      }
                      options={[
                        { value: "true", label: "Allowed" },
                        { value: "false", label: "Disabled" },
                      ]}
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "kpi" ||
              createMode === "kpi-edit" ||
              createMode === "kpi-version" ? (
                <>
                  {createMode === "kpi-version" ? (
                    <>
                      <Field label="KPI">
                        <FluentSelect
                          ariaLabel="KPI"
                          className="w-full"
                          value={form.kpi_id ?? ""}
                          placeholder="Select KPI"
                          onChange={(value) => {
                            const next = kpis.find(
                              (row) => rowId(row) === value,
                            );
                            setForm(
                              next
                                ? seedKpiVersionForm(next)
                                : { ...form, kpi_id: value },
                            );
                          }}
                          options={[
                            { value: "", label: "Select KPI" },
                            ...kpis.map((kpi) => ({
                              value: String(rowId(kpi)),
                              label: `${readString(kpi, ["code"])} · ${optionLabel(kpi)}`,
                            })),
                          ]}
                        />
                      </Field>
                      <p className="text-sm text-muted-foreground">
                        Creates a new version of the selected KPI. Templates,
                        rules, and plans can pick it after save.
                      </p>
                    </>
                  ) : null}
                  <Field label="Code">
                    <input
                      className={inputClass}
                      value={form.code ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Name">
                    <input
                      className={inputClass}
                      value={form.name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Category">
                    <input
                      className={inputClass}
                      value={form.category ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      className={textareaClass}
                      value={form.description ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Unit">
                    <input
                      className={inputClass}
                      value={form.measurement_unit ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          measurement_unit: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Direction">
                    <FluentSelect
                      ariaLabel="Direction"
                      className="w-full"
                      value={form.measurement_direction ?? "HIGHER_IS_BETTER"}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          measurement_direction: value,
                        }))
                      }
                      options={MEASUREMENT_DIRECTIONS.map((item) => ({
                        value: item,
                        label: prettify(item),
                      }))}
                    />
                  </Field>
                  <Field label="Formula">
                    <FluentSelect
                      ariaLabel="Formula"
                      className="w-full"
                      value={form.scoring_formula ?? "PERCENT_TO_TARGET"}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          scoring_formula: value,
                        }))
                      }
                      options={SCORING_FORMULAS.map((item) => ({
                        value: item,
                        label: prettify(item),
                      }))}
                    />
                  </Field>
                  <Field label="Data source">
                    <FluentSelect
                      ariaLabel="Data source"
                      className="w-full"
                      value={form.data_source_type ?? "MANUAL_EMPLOYEE"}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          data_source_type: value,
                        }))
                      }
                      options={DATA_SOURCES.map((item) => ({
                        value: item,
                        label: prettify(item),
                      }))}
                    />
                  </Field>
                  <Field label="Default target">
                    <input
                      className={inputClass}
                      value={form.default_target_value ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          default_target_value: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Frequency">
                    <FluentSelect
                      ariaLabel="Frequency"
                      className="w-full"
                      value={form.frequency ?? "MONTHLY"}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, frequency: value }))
                      }
                      options={FREQUENCIES.map((item) => ({
                        value: item,
                        label: prettify(item),
                      }))}
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "template" ||
              createMode === "rule" ||
              createMode === "plan" ? (
                <Field label="KPI version">
                  <FluentSelect
                    ariaLabel="KPI version"
                    className="w-full"
                    value={form.kpi_definition_version_id ?? ""}
                    placeholder="Select a published KPI version"
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        kpi_definition_version_id: value,
                      }))
                    }
                    options={[
                      { value: "", label: "Select a published KPI version" },
                      ...kpiVersionOptions(kpis).map((option) => ({
                        value: String(option.id),
                        label: option.label,
                      })),
                    ]}
                  />
                </Field>
              ) : null}
              {createMode === "template" ? (
                <>
                  <Field label="Code">
                    <input
                      className={inputClass}
                      value={form.code ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Name">
                    <input
                      className={inputClass}
                      value={form.name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Applicable roles">
                    <div className="grid max-h-36 gap-1 overflow-auto border border-border p-2">
                      {templateRoles.map((role) => {
                        const id = rowId(role);
                        const selected = (form.applicable_role_ids || "")
                          .split(",")
                          .includes(id);
                        return (
                          <label
                            key={id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                setForm((current) => {
                                  const ids = (
                                    current.applicable_role_ids || ""
                                  )
                                    .split(",")
                                    .filter(Boolean);
                                  return {
                                    ...current,
                                    applicable_role_ids: (selected
                                      ? ids.filter((value) => value !== id)
                                      : [...ids, id]
                                    ).join(","),
                                  };
                                })
                              }
                            />
                            {optionLabel(role)}
                          </label>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Weight">
                    <input
                      className={inputClass}
                      value={form.weight ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          weight: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Target">
                    <input
                      className={inputClass}
                      value={form.target_value ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          target_value: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  {additionalTemplateItems.map((item, index) => (
                    <div
                      key={index}
                      className="grid gap-2 border border-border p-3 sm:col-span-2 sm:grid-cols-3"
                    >
                      <FluentSelect
                        ariaLabel={`Additional KPI ${index + 1}`}
                        value={item.versionId}
                        onChange={(value) =>
                          setAdditionalTemplateItems((current) =>
                            current.map((entry, position) =>
                              position === index
                                ? { ...entry, versionId: value }
                                : entry,
                            ),
                          )
                        }
                        options={[
                          { value: "", label: "Choose KPI version" },
                          ...kpiVersionOptions(kpis).map((option) => ({
                            value: String(option.id),
                            label: option.label,
                          })),
                        ]}
                      />
                      <input
                        className={inputClass}
                        type="number"
                        placeholder="Weight"
                        value={item.weight}
                        onChange={(event) =>
                          setAdditionalTemplateItems((current) =>
                            current.map((entry, position) =>
                              position === index
                                ? { ...entry, weight: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        type="number"
                        placeholder="Target"
                        value={item.target}
                        onChange={(event) =>
                          setAdditionalTemplateItems((current) =>
                            current.map((entry, position) =>
                              position === index
                                ? { ...entry, target: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() =>
                          setAdditionalTemplateItems((current) =>
                            current.filter((_, position) => position !== index),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() =>
                      setAdditionalTemplateItems((current) => [
                        ...current,
                        { versionId: "", weight: "", target: "" },
                      ])
                    }
                  >
                    Add another KPI
                  </button>
                </>
              ) : null}
              {createMode === "rule" ? (
                <>
                  <Field label="Name">
                    <input
                      className={inputClass}
                      value={form.name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Financial year">
                    <FluentSelect
                      ariaLabel="Financial year"
                      className="w-full"
                      value={form.financial_year_id ?? ""}
                      placeholder="Any year"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          financial_year_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Any year" },
                        ...years.map((year) => ({
                          value: String(rowId(year)),
                          label: optionLabel(year),
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Priority">
                    <input
                      className={inputClass}
                      value={form.priority ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Branch">
                    <FluentSelect
                      ariaLabel="Branch"
                      className="w-full"
                      value={form.branch_id ?? ""}
                      placeholder="Any branch"
                      onChange={(value) =>
                        setForm((current) => ({ ...current, branch_id: value }))
                      }
                      options={[
                        { value: "", label: "Any branch" },
                        ...branches.map((row) => ({
                          value: String(rowId(row)),
                          label: optionLabel(row),
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Department">
                    <FluentSelect
                      ariaLabel="Department"
                      className="w-full"
                      value={form.department_id ?? ""}
                      placeholder="Any department"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          department_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Any department" },
                        ...departments.map((row) => ({
                          value: String(rowId(row)),
                          label: optionLabel(row),
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Position">
                    <FluentSelect
                      ariaLabel="Position"
                      className="w-full"
                      value={form.position_id ?? ""}
                      placeholder="Any position"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          position_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Any position" },
                        ...positions.map((row) => ({
                          value: String(rowId(row)),
                          label: optionLabel(row),
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Grade">
                    <FluentSelect
                      ariaLabel="Grade"
                      className="w-full"
                      value={form.grade_id ?? ""}
                      placeholder="Any grade"
                      onChange={(value) =>
                        setForm((current) => ({ ...current, grade_id: value }))
                      }
                      options={[
                        { value: "", label: "Any grade" },
                        ...grades.map((row) => ({
                          value: String(rowId(row)),
                          label: optionLabel(row),
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Employee">
                    <FluentSelect
                      ariaLabel="Employee"
                      className="w-full"
                      value={form.employee_id ?? ""}
                      placeholder="All employees"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          employee_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "All employees" },
                        ...employees.map((row) => ({
                          value: String(rowId(row)),
                          label: employeeLabel(row),
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Employment type">
                    <input
                      className={inputClass}
                      value={form.employment_type ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          employment_type: event.target.value,
                        }))
                      }
                      placeholder="Any employment type"
                    />
                  </Field>
                  <Field label="Review cycle">
                    <input
                      className={inputClass}
                      value={form.review_cycle ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          review_cycle: event.target.value,
                        }))
                      }
                      placeholder="e.g. QUARTERLY"
                    />
                  </Field>
                  <Field label="Template code">
                    <input
                      className={inputClass}
                      value={form.template_code ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          template_code: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Weight override">
                    <input
                      type="number"
                      step="0.01"
                      className={inputClass}
                      value={form.weight_override ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          weight_override: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Target override">
                    <input
                      type="number"
                      step="any"
                      className={inputClass}
                      value={form.target_override ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          target_override: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "competency" ? (
                <>
                  <Field label="Template code">
                    <input
                      className={inputClass}
                      value={form.code ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Template name">
                    <input
                      className={inputClass}
                      value={form.name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Item code">
                    <input
                      className={inputClass}
                      value={form.item_code ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          item_code: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Item name">
                    <input
                      className={inputClass}
                      value={form.item_name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          item_name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Weight">
                    <input
                      className={inputClass}
                      value={form.item_weight ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          item_weight: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "scale" ? (
                <>
                  <Field label="Scale code">
                    <input
                      className={inputClass}
                      value={form.code ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Scale name">
                    <input
                      className={inputClass}
                      value={form.name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Band code">
                    <input
                      className={inputClass}
                      value={form.band_code ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          band_code: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Band label">
                    <input
                      className={inputClass}
                      value={form.band_label ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          band_label: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Band min">
                    <input
                      className={inputClass}
                      value={form.band_min ?? "0"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          band_min: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Band max">
                    <input
                      className={inputClass}
                      value={form.band_max ?? "100"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          band_max: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {activeTab === "development" && canCreatePerformance ? (
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => openCreate("development")}
                >
                  <PlusIcon className="size-4" />
                  New plan
                </button>
              ) : null}
              {createMode === "scorecard" ? (
                <>
                  <Field label="Scorecard code">
                    <input
                      className={inputClass}
                      value={form.code ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Scorecard name">
                    <input
                      className={inputClass}
                      value={form.name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      className={textareaClass}
                      value={form.description ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Default">
                      <FluentSelect
                        ariaLabel="Default"
                        className="w-full"
                        value={form.is_default ?? "true"}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            is_default: value,
                          }))
                        }
                        options={[
                          { value: "true", label: "Yes" },
                          { value: "false", label: "No" },
                        ]}
                      />
                    </Field>
                    <Field label="Effective from">
                      <DateInput
                        className={inputClass}
                        value={form.effective_from ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            effective_from: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Effective to">
                      <DateInput
                        className={inputClass}
                        value={form.effective_to ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            effective_to: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <ScorecardComponentBuilder
                    components={scorecardComponents}
                    onChange={setScorecardComponents}
                  />
                </>
              ) : null}
              {createMode === "workflow" ? (
                <>
                  <Field label="Workflow code">
                    <input
                      className={inputClass}
                      value={form.code ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Workflow name">
                    <input
                      className={inputClass}
                      value={form.name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      className={textareaClass}
                      value={form.description ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Default">
                      <FluentSelect
                        ariaLabel="Default"
                        className="w-full"
                        value={form.is_default ?? "true"}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            is_default: value,
                          }))
                        }
                        options={[
                          { value: "true", label: "Yes" },
                          { value: "false", label: "No" },
                        ]}
                      />
                    </Field>
                    <Field label="Department ID">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={form.applies_to_department_id ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            applies_to_department_id: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Position ID">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={form.applies_to_position_id ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            applies_to_position_id: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Review type">
                    <input
                      className={inputClass}
                      value={form.review_type ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          review_type: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <WorkflowStepBuilder
                    steps={workflowSteps}
                    onChange={setWorkflowSteps}
                  />
                </>
              ) : null}
              {createMode === "plan" || createMode === "generate-plan" ? (
                <>
                  <Field label="Employee">
                    <FluentSelect
                      ariaLabel="Employee"
                      className="w-full"
                      value={form.employee_id ?? ""}
                      placeholder="Select employee"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          employee_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select employee" },
                        ...employees.map((employee) => ({
                          value: String(rowId(employee)),
                          label: employeeLabel(employee),
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Financial year">
                    <FluentSelect
                      ariaLabel="Financial year"
                      className="w-full"
                      value={form.financial_year_id ?? ""}
                      placeholder="Select year"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          financial_year_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select year" },
                        ...years.map((year) => ({
                          value: String(rowId(year)),
                          label: optionLabel(year),
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Effective from">
                    <DateInput
                      className={inputClass}
                      value={form.effective_from ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          effective_from: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Effective to">
                    <DateInput
                      className={inputClass}
                      value={form.effective_to ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          effective_to: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "plan" ? (
                <Field label="Weight">
                  <input
                    className={inputClass}
                    value={form.weight ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        weight: event.target.value,
                      }))
                    }
                  />
                </Field>
              ) : null}
              {createMode === "development" ? (
                <>
                  <Field label="Employee">
                    <FluentSelect
                      ariaLabel="Employee"
                      className="w-full"
                      value={form.employee_id ?? ""}
                      placeholder="Select employee"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          employee_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select employee" },
                        ...employees.map((employee) => ({
                          value: String(rowId(employee)),
                          label: employeeLabel(employee),
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Plan title">
                    <input
                      className={inputClass}
                      value={form.title ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      className={textareaClass}
                      value={form.description ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Start date">
                      <DateInput
                        className={inputClass}
                        value={form.start_date ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            start_date: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Target date">
                      <DateInput
                        className={inputClass}
                        value={form.target_completion_date ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            target_completion_date: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Source review ID">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={form.source_review_id ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            source_review_id: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="First goal">
                    <input
                      className={inputClass}
                      value={form.goal_title ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          goal_title: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Goal notes">
                    <Textarea
                      className={textareaClass}
                      value={form.goal_description ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          goal_description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Goal category">
                      <input
                        className={inputClass}
                        value={form.goal_category ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            goal_category: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Goal target date">
                      <DateInput
                        className={inputClass}
                        value={form.goal_target_date ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            goal_target_date: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Success measure">
                    <Textarea
                      className={textareaClass}
                      value={form.success_measure ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          success_measure: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Support required">
                    <Textarea
                      className={textareaClass}
                      value={form.support_required ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          support_required: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "pip" ? (
                <>
                  <Field label="Review ID">
                    <input
                      className={inputClass}
                      value={form.review_id ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          review_id: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Summary">
                    <Textarea
                      className={textareaClass}
                      value={form.summary ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          summary: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Objectives (one per line)">
                    <Textarea
                      className={textareaClass}
                      value={form.objectives ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          objectives: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="First milestone">
                    <input
                      className={inputClass}
                      value={form.milestone_title ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          milestone_title: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Milestone due">
                    <DateInput
                      className={inputClass}
                      value={form.milestone_due ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          milestone_due: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "moderate" || createMode === "reopen" ? (
                <>
                  <Field label="Review ID">
                    <input
                      className={inputClass}
                      value={form.review_id ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          review_id: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Reason">
                    <Textarea
                      className={textareaClass}
                      value={form.reason ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "moderate" ? (
                <Field label="Final score">
                  <input
                    className={inputClass}
                    value={form.final_score ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        final_score: event.target.value,
                      }))
                    }
                  />
                </Field>
              ) : null}
              {createMode === "approve" ? (
                <>
                  <Field label="Period assignment ID">
                    <input
                      className={inputClass}
                      value={form.period_assignment_id ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          period_assignment_id: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="HR comment">
                    <Textarea
                      className={textareaClass}
                      value={form.hr_review ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          hr_review: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Adjustment score">
                    <input
                      className={inputClass}
                      value={form.adjustment_score ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          adjustment_score: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "workflow-action" ? (
                <>
                  <Field label="Review ID">
                    <input
                      type="number"
                      min="1"
                      className={inputClass}
                      value={form.review_id ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          review_id: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Decision">
                    <FluentSelect
                      ariaLabel="Workflow decision"
                      className="w-full"
                      value={form.decision ?? "APPROVE"}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, decision: value }))
                      }
                      options={[
                        { value: "APPROVE", label: "Approve" },
                        { value: "RETURN", label: "Return" },
                        { value: "REJECT", label: "Reject" },
                      ]}
                    />
                  </Field>
                  <Field label="Comment">
                    <Textarea
                      className={textareaClass}
                      value={form.comment ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          comment: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="HR comment">
                    <Textarea
                      className={textareaClass}
                      value={form.hr_review ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          hr_review: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Adjustment score">
                    <input
                      type="number"
                      className={inputClass}
                      value={form.adjustment_score ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          adjustment_score: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {createMode === "feedback" ? (
                <>
                  <Field label="Review ID">
                    <input
                      className={inputClass}
                      value={form.review_id ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          review_id: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Rater employee IDs">
                    <Textarea
                      className={textareaClass}
                      placeholder="One ID per line, or comma-separated"
                      value={form.rater_employee_ids ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          rater_employee_ids: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Relationship">
                      <FluentSelect
                        ariaLabel="Relationship"
                        className="w-full"
                        value={form.relationship_type ?? "PEER"}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            relationship_type: value,
                          }))
                        }
                        options={[
                          { value: "PEER", label: "Peer" },
                          { value: "SUBORDINATE", label: "Subordinate" },
                          { value: "STAKEHOLDER", label: "Stakeholder" },
                          { value: "MANAGER", label: "Manager" },
                          { value: "OTHER", label: "Other" },
                        ]}
                      />
                    </Field>
                    <Field label="Due date">
                      <DateInput
                        className={inputClass}
                        value={form.due_date ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            due_date: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Anonymous">
                      <FluentSelect
                        ariaLabel="Anonymous"
                        className="w-full"
                        value={form.is_anonymous ?? "true"}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            is_anonymous: value,
                          }))
                        }
                        options={[
                          { value: "true", label: "Yes" },
                          { value: "false", label: "No" },
                        ]}
                      />
                    </Field>
                  </div>
                </>
              ) : null}
              {createMode === "milestone" ? (
                <>
                  <Field label="Milestone ID">
                    <input
                      className={inputClass}
                      value={form.milestone_id ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          milestone_id: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Comment">
                    <Textarea
                      className={textareaClass}
                      value={form.comment ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          comment: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {formError ? (
                <p className="text-sm text-rose-600">{formError}</p>
              ) : null}
            </div>
          </ValidatedWorkflowForm>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function ScorecardComponentBuilder({
  components,
  onChange,
}: {
  components: ScorecardComponentDraft[];
  onChange: React.Dispatch<React.SetStateAction<ScorecardComponentDraft[]>>;
}) {
  const total = scorecardWeightTotal(components);
  const totalState =
    Math.round(total * 100) / 100 === 100
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300";

  function updateComponent(
    id: string,
    patch: Partial<ScorecardComponentDraft>,
  ) {
    onChange((current) =>
      current.map((component) =>
        component.id === id ? { ...component, ...patch } : component,
      ),
    );
  }

  function removeComponent(id: string) {
    onChange((current) => current.filter((component) => component.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Components</h3>
          <p className="text-xs text-muted-foreground">
            Enabled weights must total 100.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${totalState}`}
          >
            {total.toFixed(total % 1 === 0 ? 0 : 2)}%
          </span>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() =>
              onChange((current) => [
                ...current,
                createScorecardComponentDraft(),
              ])
            }
          >
            <PlusIcon className="size-4" />
            Add
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[minmax(8rem,1fr)_minmax(9rem,1.1fr)_minmax(9rem,1fr)_5rem_5rem_5rem_5rem] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground lg:grid">
          <span>Code</span>
          <span>Label</span>
          <span>Type</span>
          <span>Weight</span>
          <span>Enabled</span>
          <span>Required</span>
          <span />
        </div>
        <div className="divide-y divide-border">
          {components.map((component) => (
            <div
              key={component.id}
              className="grid gap-2 px-3 py-3 lg:grid-cols-[minmax(8rem,1fr)_minmax(9rem,1.1fr)_minmax(9rem,1fr)_5rem_5rem_5rem_5rem] lg:items-center"
            >
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">
                  Code
                </span>
                <input
                  className={inputClass}
                  value={component.code}
                  onChange={(event) =>
                    updateComponent(component.id, { code: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">
                  Label
                </span>
                <input
                  className={inputClass}
                  value={component.label}
                  onChange={(event) =>
                    updateComponent(component.id, { label: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">
                  Type
                </span>
                <FluentSelect
                  ariaLabel="Type"
                  className="w-full"
                  value={component.type}
                  onChange={(value) =>
                    updateComponent(component.id, {
                      type: value as ScorecardComponentDraft["type"],
                    })
                  }
                  options={SCORECARD_COMPONENT_TYPES.map((type) => ({
                    value: type,
                    label: prettify(type),
                  }))}
                />
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">
                  Weight
                </span>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={component.weight}
                  onChange={(event) =>
                    updateComponent(component.id, {
                      weight: event.target.value,
                    })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium lg:justify-center lg:border-0 lg:px-0">
                <span className="text-muted-foreground lg:hidden">Enabled</span>
                <input
                  type="checkbox"
                  checked={component.enabled}
                  onChange={(event) =>
                    updateComponent(component.id, {
                      enabled: event.target.checked,
                    })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium lg:justify-center lg:border-0 lg:px-0">
                <span className="text-muted-foreground lg:hidden">
                  Required
                </span>
                <input
                  type="checkbox"
                  checked={component.required}
                  onChange={(event) =>
                    updateComponent(component.id, {
                      required: event.target.checked,
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                onClick={() => removeComponent(component.id)}
                disabled={components.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowStepBuilder({
  steps,
  onChange,
}: {
  steps: WorkflowStepDraft[];
  onChange: React.Dispatch<React.SetStateAction<WorkflowStepDraft[]>>;
}) {
  function updateStep(id: string, patch: Partial<WorkflowStepDraft>) {
    onChange((current) =>
      current.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    );
  }

  function removeStep(id: string) {
    onChange((current) => current.filter((step) => step.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Approval chain
          </h3>
          <p className="text-xs text-muted-foreground">
            Steps run by ascending sequence number.
          </p>
        </div>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() =>
            onChange((current) => [
              ...current,
              createWorkflowStepDraft(current.length + 1),
            ])
          }
        >
          <PlusIcon className="size-4" />
          Add
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[minmax(7rem,1fr)_minmax(9rem,1.2fr)_minmax(9rem,1fr)_4.5rem_5rem_5rem_5rem] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground lg:grid">
          <span>Code</span>
          <span>Label</span>
          <span>Approver</span>
          <span>Seq.</span>
          <span>Required</span>
          <span>Final</span>
          <span />
        </div>
        <div className="divide-y divide-border">
          {steps.map((step) => (
            <div
              key={step.id}
              className="grid gap-2 px-3 py-3 lg:grid-cols-[minmax(7rem,1fr)_minmax(9rem,1.2fr)_minmax(9rem,1fr)_4.5rem_5rem_5rem_5rem] lg:items-center"
            >
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">
                  Code
                </span>
                <input
                  className={inputClass}
                  value={step.code}
                  onChange={(event) =>
                    updateStep(step.id, { code: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">
                  Label
                </span>
                <input
                  className={inputClass}
                  value={step.label}
                  onChange={(event) =>
                    updateStep(step.id, { label: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">
                  Approver
                </span>
                <FluentSelect
                  ariaLabel="Approver"
                  className="w-full"
                  value={step.type}
                  onChange={(value) =>
                    updateStep(step.id, {
                      type: value as WorkflowStepDraft["type"],
                    })
                  }
                  options={WORKFLOW_STEP_TYPES.map((type) => ({
                    value: type,
                    label: prettify(type),
                  }))}
                />
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">
                  Sequence
                </span>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={step.sequenceNumber}
                  onChange={(event) =>
                    updateStep(step.id, { sequenceNumber: event.target.value })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium lg:justify-center lg:border-0 lg:px-0">
                <span className="text-muted-foreground lg:hidden">
                  Required
                </span>
                <input
                  type="checkbox"
                  checked={step.required}
                  onChange={(event) =>
                    updateStep(step.id, { required: event.target.checked })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium lg:justify-center lg:border-0 lg:px-0">
                <span className="text-muted-foreground lg:hidden">Final</span>
                <input
                  type="checkbox"
                  checked={step.canFinalize}
                  onChange={(event) =>
                    updateStep(step.id, { canFinalize: event.target.checked })
                  }
                />
              </label>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                onClick={() => removeStep(step.id)}
                disabled={steps.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## /home/innocent/systems/hrms/src/components/dashboard/activity-self-view.tsx

```tsx
"use client";

import { ActivityEvidencePicker } from "@/components/dashboard/activity-evidence-picker";
import { WorkflowGuide } from "@/components/dashboard/workflow-guide";
import { ValidatedWorkflowForm } from "@/components/dashboard/validated-workflow-form";
import { activityFormSchema } from "@/lib/workflow-schemas";
import { workflowFailure } from "@/lib/workflow-error";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import * as React from "react";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store";

import {
  CompactStatStrip,
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  asRecordArray,
  formatDate,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import {
  addMyActivityEntry,
  createMyActivityReport,
  deleteMyActivityEntry,
  getMyActivitiesToday,
  getMyActivityReport,
  listActivityCategories,
  listMyActivities,
  submitMyActivityReport,
  type AdminRecord,
} from "@/lib/admin-api";
import { FluentSelect } from "@/components/ui/fluent-select";
import { readStoredSessionTokens } from "@/lib/session-client";

export type ActivitySelfTab = "today" | "reports";

const ENTRY_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "DEFERRED",
  "CANCELLED",
] as const;

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

function newRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function reportEntries(report: AdminRecord | null) {
  if (!report) return [];
  return asRecordArray(report.entries ?? report.items ?? report.activities);
}

function resolveTodayReport(record: AdminRecord | null) {
  if (!record) return null;
  const nested = asRecord(record.report) ?? asRecord(record.data) ?? record;
  if (!nested) return null;
  const hasIdentity =
    Boolean(rowId(nested)) ||
    Boolean(nested.activityDate) ||
    Boolean(nested.activity_date) ||
    Boolean(readString(nested, ["status"])) ||
    reportEntries(nested).length > 0;
  return hasIdentity ? nested : null;
}

export function ActivitySelfView({
  activeTab,
}: {
  activeTab: ActivitySelfTab;
}) {
  const [today, setToday] = React.useState<AdminRecord | null>(null);
  const [reports, setReports] = React.useState<AdminRecord[]>([]);
  const [categories, setCategories] = React.useState<AdminRecord[]>([]);
  const [selected, setSelected] = React.useState<AdminRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<
    "report" | "entry" | "submit"
  >("report");
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState("");

  const { begin, invalidate, credential } = useWorkflowRequest(activeTab);

  const load = React.useCallback(async () => {
    const { commit, current } = begin();
    void current;
    const token = credential?.trim() || readStoredToken();
    if (!token) {
      commit(() => setError("Authentication required. Please log in again."));
      commit(() => setLoading(false));
      return;
    }
    commit(() => setLoading(true));
    commit(() => setError(null));
    const results = await Promise.allSettled([
      getMyActivitiesToday(token).then((record) => {
        const report = resolveTodayReport(record);
        commit(() => setToday(report));
        if (activeTab === "today") commit(() => setSelected(report));
      }),
      listMyActivities(token, { limit: 50 }).then((value) =>
        commit(() => setReports(value)),
      ),
      listActivityCategories(token).then((value) =>
        commit(() => setCategories(value)),
      ),
    ]);
    const first = results.find((result) => result.status === "rejected");
    if (first && first.status === "rejected") {
      commit(() =>
        setError(
          workflowFailure(first.reason, "Could not load your activities."),
        ),
      );
    }
    commit(() => setLoading(false));
  }, [begin, credential, activeTab]);

  React.useEffect(() => {
    setMounted(true);
    void load();
    return invalidate;
  }, [load, invalidate]);

  const { begin: beginReportDetail } = useWorkflowRequest(
    `${activeTab}:report-detail`,
  );

  async function openReport(row: AdminRecord) {
    const { current } = beginReportDetail();
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) {
      setSelected(row);
      return;
    }
    try {
      const detail = await getMyActivityReport(token, id);
      if (current()) setSelected(detail ?? row);
    } catch (cause) {
      if (current())
        setError(
          workflowFailure(
            cause,
            "Could not load this report. Reload before continuing.",
          ),
        );
    }
  }

  const selectedCategory = categories.find(
    (category) => rowId(category) === form.activity_category_id,
  );
  const activityFormInput = {
    ...form,
    requires_time:
      selectedCategory?.requiresTime === true ||
      selectedCategory?.requires_time === true,
    requires_outcome:
      selectedCategory?.requiresOutcome === true ||
      selectedCategory?.requires_outcome === true,
  };

  const { begin: beginMutation } = useWorkflowRequest(
    `${activeTab}:${JSON.stringify(activityFormInput)}`,
  );
  React.useEffect(() => {
    setSaving(false);
  }, [credential, activeTab, beginMutation]);

  async function onSave() {
    const validationResult =
      activityFormSchema(createMode).safeParse(activityFormInput);
    if (!validationResult.success) {
      setFormError(
        validationResult.error.issues
          .map(
            (issue) => issue.path.map(String).join(".") + ": " + issue.message,
          )
          .join("; "),
      );
      return;
    }
    if (saving) return;
    const token = readStoredToken();
    if (!token) return;
    const { current: isMutationCurrent } = beginMutation();
    setSaving(true);
    setFormError(null);
    try {
      if (createMode === "report") {
        if (!form.activity_date) throw new Error("Activity date is required.");
        await createMyActivityReport(token, {
          activity_date: form.activity_date,
          client_request_id: newRequestId(),
          source: "WEB",
        });
        if (!isMutationCurrent()) return;
      } else if (createMode === "entry") {
        if (
          !form.id ||
          !form.activity_category_id ||
          !form.title ||
          !form.description
        ) {
          throw new Error("Category, title, and description are required.");
        }
        await addMyActivityEntry(token, form.id, {
          activity_category_id: Number(form.activity_category_id),
          title: form.title,
          description: form.description,
          status: form.status || "PLANNED",
          outcome: form.outcome || undefined,
          defer_reason: form.defer_reason || undefined,
          planned_start_time: form.planned_start_time
            ? new Date(form.planned_start_time).toISOString()
            : undefined,
          planned_end_time: form.planned_end_time
            ? new Date(form.planned_end_time).toISOString()
            : undefined,
          client_request_id: newRequestId(),
        });
        if (!isMutationCurrent()) return;
      } else {
        if (!form.id || !form.employee_summary)
          throw new Error("A summary is required to submit.");
        await submitMyActivityReport(token, form.id, {
          employee_summary: form.employee_summary,
          overall_remarks: form.overall_remarks || undefined,
          client_request_id: newRequestId(),
        });
        if (!isMutationCurrent()) return;
      }
      toast.success("Saved.");
      setCreateOpen(false);
      await load();
      if (!isMutationCurrent()) return;
    } catch (errorObject) {
      if (!isMutationCurrent()) return;
      setFormError(
        errorObject instanceof Error ? errorObject.message : "Could not save.",
      );
    } finally {
      if (isMutationCurrent()) setSaving(false);
    }
  }

  const listedToday =
    reports.find((row) => {
      const date = String(row.activityDate ?? row.activity_date ?? "").slice(
        0,
        10,
      );
      return date === todayDate();
    }) ?? today;
  const todayReport = today ?? listedToday;
  const activeReport = activeTab === "today" ? todayReport : selected;
  const entries = reportEntries(activeReport);
  const todayDateLabel = (() => {
    if (!todayReport) return "Today";
    const dated = formatDate(
      todayReport.activityDate ?? todayReport.activity_date,
    );
    return dated === "—" ? "Today" : dated;
  })();
  const todayStatus = listedToday
    ? prettify(readString(listedToday, ["status"], "DRAFT"))
    : "None";

  if (loading && !createOpen)
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <FluentLoadingIndicator />
        <p role="status">
          Loading this workflow and checking its available actions…
        </p>
      </section>
    );

  if (error && !loading && !createOpen)
    return (
      <section className="flex flex-col gap-4">
        <WorkflowGuide
          title="This workflow needs attention"
          unavailable={error}
          steps={[
            "Resolve the permission, setup, or network issue described above.",
            "Reload this view before continuing.",
          ]}
        />
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => void load()}
        >
          Reload workflow
        </button>
      </section>
    );

  return (
    <section className="space-y-4">
      <WorkflowGuide
        title="Your daily activity report"
        steps={[
          "Create a draft for the correct day.",
          "Add activities and record their outcomes.",
          "Review the summary and submit for manager review.",
          "If returned, correct the draft and resubmit.",
        ]}
        unavailable={error}
      />
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My activities"
        title={activeTab === "today" ? "Today's work" : "Report history"}
        description="Track your own work and manager-assigned tasks, then submit the day for review."
        actions={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 hover:text-white disabled:opacity-60"
            onClick={() => void load()}
            disabled={mounted ? loading : undefined}
          >
            {mounted && loading ? (
              <FluentLoadingIndicator className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Refresh
          </button>
        }
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <CompactStatStrip
        items={[
          { label: "Reports", value: loading ? "…" : String(reports.length) },
          { label: "Today", value: loading ? "…" : todayStatus },
          {
            label: "Entries today",
            value: loading ? "…" : String(reportEntries(todayReport).length),
          },
        ]}
      />
      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            if (activeTab === "today" && todayReport) {
              setCreateMode("entry");
              setForm({ id: rowId(todayReport), status: "COMPLETED" });
            } else {
              setCreateMode("report");
              setForm({ activity_date: todayDate() });
            }
            setCreateOpen(true);
          }}
        >
          <PlusIcon className="size-4" />
          {activeTab === "today" && todayReport
            ? "Add work item"
            : "New report"}
        </button>
      </div>

      {activeTab === "today" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {loading && !todayReport ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" />
              Loading today&apos;s report...
            </div>
          ) : todayReport ? (
            <>
              <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {todayDateLabel}
                    </p>
                    <StatusChip
                      value={readString(todayReport, ["status"], "DRAFT")}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {entries.length === 0
                      ? "No entries yet. Add the work you completed today."
                      : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} logged today.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={() => {
                      setCreateMode("entry");
                      setForm({ id: rowId(todayReport), status: "COMPLETED" });
                      setCreateOpen(true);
                    }}
                  >
                    Add entry
                  </button>
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={() => {
                      setCreateMode("submit");
                      setForm({ id: rowId(todayReport), employee_summary: "" });
                      setCreateOpen(true);
                    }}
                  >
                    Submit
                  </button>
                </div>
              </div>
              {entries.length > 0 ? (
                <ul className="divide-y divide-border/70 border-t border-border/70">
                  {entries.map((entry) => {
                    const id = rowId(entry);
                    const managerAssigned = readString(entry, [
                      "taskReference",
                      "task_reference",
                      "externalReferenceType",
                      "external_reference_type",
                    ])
                      .toUpperCase()
                      .includes("MANAGER");
                    return (
                      <li
                        key={id || readString(entry, ["title"])}
                        className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {readString(entry, ["title"], "Work item")}
                            </p>
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                              {managerAssigned
                                ? "Assigned by manager"
                                : "My work"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {readString(entry, ["description"], "")}
                          </p>
                        </div>
                        {id &&
                        ["DRAFT", "RETURNED_FOR_CORRECTION"].includes(
                          readString(todayReport ?? {}, [
                            "status",
                          ]).toUpperCase(),
                        ) ? (
                          <ActivityEvidencePicker
                            entryId={id}
                            onAttached={load}
                          />
                        ) : null}
                        <div className="flex items-center gap-2">
                          <StatusChip
                            value={readString(entry, ["status"], "PLANNED")}
                          />
                          <button
                            type="button"
                            className={actionButtonClass}
                            disabled={busyId === `del-${id}`}
                            onClick={() => {
                              const token = readStoredToken();
                              const reportId = rowId(todayReport);
                              if (!token || !reportId || !id) return;
                              setBusyId(`del-${id}`);
                              void deleteMyActivityEntry(token, reportId, id)
                                .then(() => {
                                  toast.success("Entry removed.");
                                  return load();
                                })
                                .catch((errorObject) =>
                                  toast.error(
                                    errorObject instanceof Error
                                      ? errorObject.message
                                      : "Could not delete.",
                                  ),
                                )
                                .finally(() => setBusyId(""));
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Today&apos;s report could not be loaded. Refresh the page to try
              again.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {loading && reports.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" />
              Loading your reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No daily reports yet. Create one to start logging work.
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {reports.map((row) => {
                const id = rowId(row);
                const isSelected = Boolean(id && rowId(selected) === id);
                const summary = readString(
                  row,
                  ["employeeSummary", "employee_summary"],
                  "",
                );
                const rowEntries = isSelected ? entries : [];
                return (
                  <div
                    key={
                      id || readString(row, ["activity_date", "activityDate"])
                    }
                  >
                    <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                      <button
                        type="button"
                        className="min-w-0 space-y-1 text-left"
                        onClick={() => void openReport(row)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {formatDate(row.activityDate ?? row.activity_date)}
                          </p>
                          <StatusChip
                            value={readString(row, ["status"], "DRAFT")}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {summary || "No summary yet."}
                        </p>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={actionButtonClass}
                          onClick={() => {
                            setCreateMode("entry");
                            setForm({ id, status: "COMPLETED" });
                            setCreateOpen(true);
                          }}
                        >
                          Add entry
                        </button>
                        <button
                          type="button"
                          className={actionButtonClass}
                          onClick={() => {
                            setCreateMode("submit");
                            setForm({ id, employee_summary: summary });
                            setCreateOpen(true);
                          }}
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                    {rowEntries.length > 0 ? (
                      <ul className="divide-y divide-border/70 border-t border-border/70">
                        {rowEntries.map((entry) => (
                          <li
                            key={rowId(entry) || readString(entry, ["title"])}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                          >
                            <p className="text-sm font-medium text-foreground">
                              {readString(entry, ["title"], "Entry")}
                            </p>
                            <StatusChip
                              value={readString(entry, ["status"], "PLANNED")}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          if (!saving) setCreateOpen(next);
        }}
      >
        <DialogPopup
          from="bottom"
          className="flex max-h-[calc(100dvh-0.75rem)] w-[calc(100%-0.75rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(90dvh,42rem)] sm:w-[calc(100%-2rem)]"
        >
          <DialogHeader className="m-0 shrink-0 border-b border-border px-4 py-4 pr-12 sm:px-5">
            <DialogTitle>
              {createMode === "report"
                ? "Start a daily report"
                : createMode === "entry"
                  ? "Add a work item"
                  : "Submit report"}
            </DialogTitle>
            <DialogDescription>
              {createMode === "report"
                ? "Choose the work date. The report stays private to you and your authorized reviewers."
                : createMode === "entry"
                  ? "Add work you completed or plan to complete for this day."
                  : "Summarize the day and send it to your manager for review."}
            </DialogDescription>
          </DialogHeader>
          <ValidatedWorkflowForm
            key={createMode}
            saving={saving}
            submitError={formError}
            onSubmit={onSave}
            validation={{
              schema: activityFormSchema(createMode),
              input: activityFormInput,
            }}
            description="Create a draft, record your work, then submit the report for manager review."
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <div className="grid gap-3">
                {createMode === "report" ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Activity date</span>
                    <DateInput
                      className={inputClass}
                      value={form.activity_date ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          activity_date: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
                {createMode === "entry" ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Category</span>
                      <FluentSelect
                        ariaLabel="Category"
                        className="w-full"
                        value={form.activity_category_id ?? ""}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            activity_category_id: value,
                          }))
                        }
                        placeholder="Select category"
                        options={[
                          { value: "", label: "Select category" },
                          ...categories.map((category) => ({
                            value: rowId(category),
                            label: optionLabel(category),
                          })),
                        ]}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Title</span>
                      <input
                        className={inputClass}
                        value={form.title ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Description</span>
                      <Textarea
                        className={textareaClass}
                        value={form.description ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Status</span>
                      <FluentSelect
                        ariaLabel="Status"
                        className="w-full"
                        value={form.status ?? "COMPLETED"}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, status: value }))
                        }
                        options={ENTRY_STATUSES.map((status) => ({
                          value: status,
                          label: prettify(status),
                        }))}
                      />
                    </label>
                  </>
                ) : null}
                {createMode === "entry" ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">
                        Planned start{" "}
                        {activityFormInput.requires_time
                          ? "(required for this category)"
                          : "(optional)"}
                      </span>
                      <input
                        type="datetime-local"
                        className={inputClass}
                        value={form.planned_start_time ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            planned_start_time: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Planned end</span>
                      <input
                        type="datetime-local"
                        className={inputClass}
                        value={form.planned_end_time ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            planned_end_time: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">
                        Outcome{" "}
                        {activityFormInput.requires_outcome &&
                        form.status === "COMPLETED"
                          ? "(required)"
                          : "(optional)"}
                      </span>
                      <Textarea
                        value={form.outcome ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            outcome: event.target.value,
                          }))
                        }
                      />
                    </label>
                    {form.status === "DEFERRED" ? (
                      <label className="grid gap-1.5 text-sm">
                        <span className="font-medium">Reason for deferral</span>
                        <Textarea
                          value={form.defer_reason ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              defer_reason: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}
                {createMode === "submit" ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Summary</span>
                      <Textarea
                        className={textareaClass}
                        value={form.employee_summary ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            employee_summary: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Remarks</span>
                      <Textarea
                        className={textareaClass}
                        value={form.overall_remarks ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            overall_remarks: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                ) : null}
                {formError ? (
                  <p className="text-sm text-rose-600">{formError}</p>
                ) : null}
              </div>
            </div>
          </ValidatedWorkflowForm>
          <DialogFooter className="m-0 shrink-0 border-t border-border bg-background px-4 py-3 sm:px-5">
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
```

## /home/innocent/systems/hrms/src/components/dashboard/performance-self-view.tsx

```tsx
"use client";

import { WorkflowGuide } from "@/components/dashboard/workflow-guide";
import { ValidatedWorkflowForm } from "@/components/dashboard/validated-workflow-form";
import {
  activityTaskSchema,
  performanceActionSchema,
} from "@/lib/workflow-schemas";
import { workflowFailure } from "@/lib/workflow-error";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button as FluentButton,
  ProgressBar,
} from "@fluentui/react-components";
import {
  CheckCircle2Icon,
  PlusIcon,
  RefreshCwIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import {
  CheckmarkCircle20Regular as AchievementIcon,
  CheckmarkCircle20Regular as CycleDoneIcon,
  CalendarLtr24Regular as EmptyReviewIcon,
  ArrowTrendingLines20Regular as DevelopmentIcon,
  ChevronRight20Regular as NextIcon,
  ClipboardTask20Regular as AssignedWorkIcon,
  Clock20Regular as ReviewsIcon,
  Gauge20Regular as ScoreIcon,
  PersonFeedback20Regular as FeedbackIcon,
} from "@fluentui/react-icons";
import { toast } from "@/components/ui/fluent-toast-store";

import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared";
import {
  MetricTile,
  StatusChip,
  actionButtonClass,
  asRecord,
  asRecordArray,
  employeeLabel,
  inputClass,
  optionLabel,
  prettify,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals";
import { cn } from "@/lib/utils";
import { forgetForbiddenRoute } from "@/lib/forbidden-routes";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { useForbiddenRouteGuard } from "@/hooks/use-forbidden-route-guard";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import {
  acknowledgeMyPerformanceImprovementPlan,
  createManagerActivityTask,
  createMyActivityTask,
  declineMyPerformanceFeedback360,
  getManagerPerformanceSummary,
  getMyPerformanceSummary,
  listManagerActivityAssignees,
  listManagerTeamAchievements,
  listMyPerformanceAchievements,
  listMyPerformanceAssignments,
  listMyPerformanceDevelopmentPlans,
  listMyPerformanceFeedback360,
  listMyPerformanceImprovementPlans,
  listMyEmployeeKpis,
  listMyKpiCycleScores,
  listMyPerformanceReviews,
  listMyActivityTasks,
  submitManagerPerformanceReview,
  submitMyPerformanceAppeal,
  submitMyPerformanceFeedback360,
  submitMyPerformanceSelfReview,
  updateMyPerformanceAchievement,
  updateMyPerformanceDevelopmentGoal,
  validateManagerAchievement,
  type AdminRecord,
} from "@/lib/admin-api";
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions";
import { readStoredSessionTokens } from "@/lib/session-client";
import { FluentSelect } from "@/components/ui/fluent-select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";

export type PerformanceSelfTab =
  | "overview"
  | "kpis"
  | "assignments"
  | "assign-tasks"
  | "reviews"
  | "feedback"
  | "development"
  | "achievements"
  | "improvement"
  | "team"
  | "manager-kpis";

type ActionMode =
  | "self-review"
  | "appeal"
  | "achievement"
  | "manager-review"
  | "validate"
  | "feedback-360"
  | "development-goal";

const PERFORMANCE_CYCLE_STEPS = [
  {
    key: "OPEN",
    label: "Cycle started",
    hint: "The review period has begun",
  },
  {
    key: "SELF_REVIEW_PENDING",
    label: "Your self-review",
    hint: "Write how this period went",
  },
  {
    key: "MANAGER_REVIEW_PENDING",
    label: "Manager review",
    hint: "Your manager adds their view",
  },
  {
    key: "APPROVED",
    label: "Approved",
    hint: "The review has been signed off",
  },
  {
    key: "PUBLISHED",
    label: "Shared with you",
    hint: "Final scores are now visible",
  },
] as const;

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

export function PerformanceSelfView({
  activeTab,
}: {
  activeTab: PerformanceSelfTab;
}) {
  const router = useRouter();
  const actor = useDashboardActor();
  const canAccess = canAccessDashboardRoute(
    `/dashboard/me/performance/${activeTab}`,
    actor.permissionLabels,
    actor.accessMode,
  );
  useForbiddenRouteGuard(canAccess);
  const [summary, setSummary] = React.useState<AdminRecord | null>(null);
  const [managerSummary, setManagerSummary] =
    React.useState<AdminRecord | null>(null);
  const [assignments, setAssignments] = React.useState<AdminRecord[]>([]);
  const [taskEmployees, setTaskEmployees] = React.useState<AdminRecord[]>([]);
  const [activityTasks, setActivityTasks] = React.useState<AdminRecord[]>([]);
  const [myKpis, setMyKpis] = React.useState<AdminRecord[]>([]);
  const [kpiCycleScores, setKpiCycleScores] = React.useState<AdminRecord[]>([]);
  const [reviews, setReviews] = React.useState<AdminRecord[]>([]);
  const [feedback360, setFeedback360] = React.useState<AdminRecord[]>([]);
  const [developmentPlans, setDevelopmentPlans] = React.useState<AdminRecord[]>(
    [],
  );
  const [achievements, setAchievements] = React.useState<AdminRecord[]>([]);
  const [pips, setPips] = React.useState<AdminRecord[]>([]);
  const [teamAchievements, setTeamAchievements] = React.useState<AdminRecord[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [managerError, setManagerError] = React.useState<string | null>(null);
  const [detailRecord, setDetailRecord] = React.useState<AdminRecord | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [actionOpen, setActionOpen] = React.useState(false);
  const [actionMode, setActionMode] = React.useState<ActionMode>("self-review");
  const [actionRow, setActionRow] = React.useState<AdminRecord | null>(null);
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState("");
  const [taskForm, setTaskForm] = React.useState<Record<string, string>>({
    activity_date: new Date().toISOString().slice(0, 10),
  });
  const [taskError, setTaskError] = React.useState<string | null>(null);
  const [taskSaving, setTaskSaving] = React.useState(false);
  const [taskAudience, setTaskAudience] = React.useState<"employee" | "self">(
    "employee",
  );
  const [taskChecklistDraft, setTaskChecklistDraft] = React.useState("");
  const [taskChecklist, setTaskChecklist] = React.useState<string[]>([]);

  const { begin, invalidate, credential } = useWorkflowRequest(activeTab);

  const load = React.useCallback(async () => {
    const { commit, current } = begin();
    void current;
    const token = credential?.trim() || readStoredToken();
    if (!token) {
      commit(() => setError("Authentication required. Please log in again."));
      commit(() => setLoading(false));
      return;
    }
    commit(() => setLoading(true));
    commit(() => setError(null));
    try {
      const tasks: Array<Promise<unknown>> = [];
      if (activeTab !== "assign-tasks") {
        tasks.push(
          getMyPerformanceSummary(token).then((value) =>
            commit(() => setSummary(value)),
          ),
          listMyPerformanceAssignments(token).then((value) =>
            commit(() => setAssignments(value)),
          ),
          listMyPerformanceReviews(token).then((value) =>
            commit(() => setReviews(value)),
          ),
          listMyPerformanceFeedback360(token).then((value) =>
            commit(() => setFeedback360(value)),
          ),
          listMyPerformanceDevelopmentPlans(token).then((value) =>
            commit(() => setDevelopmentPlans(value)),
          ),
          listMyPerformanceAchievements(token).then((value) =>
            commit(() => setAchievements(value)),
          ),
          listMyPerformanceImprovementPlans(token).then((value) =>
            commit(() => setPips(value)),
          ),
        );
      }
      if (activeTab === "overview") {
        tasks.push(
          listMyEmployeeKpis(token).then((value) =>
            commit(() => setMyKpis(value)),
          ),
          listMyKpiCycleScores(token).then((value) =>
            commit(() => setKpiCycleScores(value)),
          ),
          listMyActivityTasks(token, { limit: 100 }).then((value) =>
            commit(() => setActivityTasks(value)),
          ),
        );
      }
      if (activeTab === "team") {
        tasks.push(
          getManagerPerformanceSummary(token)
            .then((value) => {
              commit(() => setManagerSummary(value));
              commit(() => setManagerError(null));
            })
            .catch((errorObject) => {
              commit(() => setManagerSummary(null));
              commit(() =>
                setManagerError(
                  errorObject instanceof Error
                    ? errorObject.message
                    : "Team performance is only available to managers.",
                ),
              );
            }),
          listManagerTeamAchievements(token).then((value) =>
            commit(() => setTeamAchievements(value)),
          ),
        );
      }
      if (activeTab === "assign-tasks") {
        tasks.push(
          listManagerActivityAssignees(token).then((value) =>
            commit(() => setTaskEmployees(value)),
          ),
        );
      }
      const results = await Promise.allSettled(tasks);
      const firstError = results.find((result) => result.status === "rejected");
      if (firstError && firstError.status === "rejected") {
        commit(() =>
          setError(
            workflowFailure(
              firstError.reason,
              "Could not load your performance.",
            ),
          ),
        );
      }
    } catch (errorObject) {
      commit(() =>
        setError(
          workflowFailure(errorObject, "Could not load your performance."),
        ),
      );
    } finally {
      commit(() => setLoading(false));
    }
  }, [begin, credential, activeTab]);

  React.useEffect(() => {
    forgetForbiddenRoute("/dashboard/me/performance");
    forgetForbiddenRoute("/dashboard/me/performance/overview");
    forgetForbiddenRoute("/dashboard/me/performance/assignments");
    forgetForbiddenRoute("/dashboard/me/performance/assign-tasks");
    forgetForbiddenRoute("/dashboard/me/performance/reviews");
    forgetForbiddenRoute("/dashboard/me/performance/feedback");
    forgetForbiddenRoute("/dashboard/me/performance/development");
    forgetForbiddenRoute("/dashboard/me/performance/achievements");
    forgetForbiddenRoute("/dashboard/me/performance/improvement");
    forgetForbiddenRoute("/dashboard/me/performance/team");
  }, []);

  React.useEffect(() => {
    void load();
    return invalidate;
  }, [load, invalidate]);

  const latestLockedKpiScore = kpiCycleScores.find(
    (row) => readString(row, ["status"], "LOCKED").toUpperCase() === "LOCKED",
  );
  const score =
    readNumber(latestLockedKpiScore, [
      "totalWeightedScore",
      "total_weighted_score",
    ]) ??
    readNumber(summary, [
      "current_score",
      "currentScore",
      "final_score",
      "finalScore",
      "average_score",
      "averageScore",
    ]) ??
    readNumber(asRecord(summary?.latest_review ?? summary?.latestReview), [
      "finalScore",
      "final_score",
    ]) ??
    reviews
      .map((review) =>
        readNumber(review, [
          "finalScore",
          "final_score",
          "kpiScore",
          "kpi_score",
        ]),
      )
      .find((value) => value !== null) ??
    null;
  const cycleStatus = readString(reviews[0], ["status"], "OPEN").toUpperCase();
  const cycleStepIndex = Math.max(
    0,
    PERFORMANCE_CYCLE_STEPS.findIndex((step) => step.key === cycleStatus),
  );
  const currentCycleStep = PERFORMANCE_CYCLE_STEPS[cycleStepIndex];
  const rows =
    activeTab === "assignments"
      ? assignments
      : activeTab === "reviews"
        ? reviews
        : activeTab === "feedback"
          ? feedback360
          : activeTab === "development"
            ? developmentPlans.flatMap((plan) =>
                asRecordArray(plan.goals).map((goal) => ({
                  ...goal,
                  plan_title: readString(
                    plan,
                    ["title"],
                    `Plan #${rowId(plan)}`,
                  ),
                })),
              )
            : activeTab === "achievements"
              ? achievements
              : activeTab === "improvement"
                ? pips
                : teamAchievements;

  function addTaskChecklistItem() {
    const item = taskChecklistDraft.trim();
    if (!item) return;
    setTaskChecklist((current) => [...current, item]);
    setTaskChecklistDraft("");
  }

  const performanceTaskInput = {
    ...taskForm,
    priority: taskForm.priority || "MEDIUM",
    start_time: taskForm.start_time || "09:00",
    end_time: taskForm.end_time || "17:00",
    audience: taskAudience,
    employeeIds: taskForm.employee_id ? [taskForm.employee_id] : [],
    checklistItems: taskChecklist,
  };

  const { begin: beginTaskMutation } = useWorkflowRequest(
    `${activeTab}:task-mutation:${JSON.stringify(performanceTaskInput)}`,
  );
  React.useEffect(() => {
    setTaskSaving(false);
  }, [activeTab, credential, beginTaskMutation]);

  async function saveManagerTask() {
    const result = activityTaskSchema.safeParse(performanceTaskInput);
    if (!result.success) {
      setTaskError(result.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    if (taskSaving) return;
    const token = readStoredToken();
    if (!token) return;
    if (
      (taskAudience === "employee" && !taskForm.employee_id) ||
      !taskForm.activity_date ||
      !taskForm.title?.trim() ||
      !taskForm.description?.trim()
    ) {
      setTaskError(
        `${taskAudience === "employee" ? "Employee, " : ""}date, title, and notes are required.`,
      );
      return;
    }
    const { current } = beginTaskMutation();
    setTaskSaving(true);
    setTaskError(null);
    try {
      const taskPayload = {
        activity_date: taskForm.activity_date,
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        planned_start_time: new Date(
          `${taskForm.activity_date}T${performanceTaskInput.start_time}:00`,
        ).toISOString(),
        planned_end_time: new Date(
          `${taskForm.activity_date}T${performanceTaskInput.end_time}:00`,
        ).toISOString(),
        due_date: taskForm.due_date || undefined,
        priority: taskForm.priority || "MEDIUM",
        checklist: taskChecklist.map((title, index) => ({
          id: `item-${index + 1}`,
          title,
          completed: false,
        })),
      };
      if (taskAudience === "employee") {
        await createManagerActivityTask(token, {
          ...taskPayload,
          employee_id: Number(taskForm.employee_id),
        });
        if (!current()) return;
        toast.success("Task assigned.");
      } else {
        await createMyActivityTask(token, taskPayload);
        if (!current()) return;
        toast.success("Task added to your work.");
      }
      setTaskForm({ activity_date: new Date().toISOString().slice(0, 10) });
      setTaskChecklist([]);
      setTaskChecklistDraft("");
      await load();
    } catch (errorObject) {
      if (!current()) return;
      setTaskError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not assign task.",
      );
    } finally {
      if (current()) setTaskSaving(false);
    }
  }

  function openAction(mode: ActionMode, row: AdminRecord) {
    setActionMode(mode);
    setActionRow(row);
    setForm({});
    setFormError(null);
    setActionOpen(true);
  }

  const { begin: beginMutation } = useWorkflowRequest(
    `${activeTab}:${JSON.stringify(form)}`,
  );
  React.useEffect(() => {
    setSaving(false);
  }, [credential, activeTab, beginMutation]);

  async function onSaveAction() {
    const validationResult =
      performanceActionSchema(actionMode).safeParse(form);
    if (!validationResult.success) {
      setFormError(
        validationResult.error.issues
          .map(
            (issue) => issue.path.map(String).join(".") + ": " + issue.message,
          )
          .join("; "),
      );
      return;
    }
    if (saving) return;
    const token = readStoredToken();
    if (!token || !actionRow) return;
    const { current: isMutationCurrent } = beginMutation();
    setSaving(true);
    setFormError(null);
    try {
      if (actionMode === "self-review") {
        const assignmentId = readNumber(actionRow, [
          "periodAssignmentId",
          "period_assignment_id",
          "id",
        ]);
        if (assignmentId === null)
          throw new Error("This review has no period assignment.");
        await submitMyPerformanceSelfReview(token, assignmentId, {
          comment: form.comment ?? "",
          highlights: form.highlights ?? "",
        });
        if (!isMutationCurrent()) return;
      } else if (actionMode === "appeal") {
        const reviewId = readNumber(actionRow, ["id", "reviewId", "review_id"]);
        if (reviewId === null || !form.reason?.trim())
          throw new Error("Review and reason are required.");
        await submitMyPerformanceAppeal(token, reviewId, {
          reason: form.reason.trim(),
        });
        if (!isMutationCurrent()) return;
      } else if (actionMode === "achievement") {
        const id = rowId(actionRow);
        if (!id) throw new Error("Achievement is missing.");
        await updateMyPerformanceAchievement(token, id, {
          achievement_value: form.achievement_value
            ? Number(form.achievement_value)
            : undefined,
          comment: form.comment || undefined,
          evidence: form.evidence || undefined,
        });
        if (!isMutationCurrent()) return;
      } else if (actionMode === "manager-review") {
        const assignmentId = readNumber(actionRow, [
          "periodAssignmentId",
          "period_assignment_id",
          "id",
        ]);
        if (assignmentId === null)
          throw new Error("Period assignment is required.");
        await submitManagerPerformanceReview(token, assignmentId, {
          review: { comment: form.comment ?? "" },
          areas_of_strength: (form.areas_of_strength ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          areas_for_improvement: (form.areas_for_improvement ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          training_needs: (form.training_needs ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          recommendations: (form.recommendations ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        });
        if (!isMutationCurrent()) return;
      } else if (actionMode === "validate") {
        const id = rowId(actionRow);
        if (!id) throw new Error("Achievement is missing.");
        await validateManagerAchievement(token, id, {
          achievement_value: form.achievement_value
            ? Number(form.achievement_value)
            : undefined,
          manager_comment: form.manager_comment || undefined,
          override_reason: form.override_reason || undefined,
          submit_for_hr: form.submit_for_hr === "true",
        });
        if (!isMutationCurrent()) return;
      } else if (actionMode === "feedback-360") {
        const id = rowId(actionRow);
        const overallScore = Number(form.overall_score);
        if (!id) throw new Error("Feedback request is missing.");
        if (
          !Number.isFinite(overallScore) ||
          overallScore < 0 ||
          overallScore > 100
        ) {
          throw new Error("Overall score must be between 0 and 100.");
        }
        await submitMyPerformanceFeedback360(token, id, {
          overall_score: overallScore,
          ratings: {
            collaboration: Number(form.collaboration_score || overallScore),
            communication: Number(form.communication_score || overallScore),
            ownership: Number(form.ownership_score || overallScore),
          },
          strengths: form.strengths || undefined,
          improvement_areas: form.improvement_areas || undefined,
          comments: form.comments || undefined,
        });
        if (!isMutationCurrent()) return;
      } else if (actionMode === "development-goal") {
        const id = rowId(actionRow);
        if (!id) throw new Error("Development goal is missing.");
        await updateMyPerformanceDevelopmentGoal(token, id, {
          status: form.status || undefined,
          progress_percent: form.progress_percent
            ? Number(form.progress_percent)
            : undefined,
          employee_comment: form.employee_comment || undefined,
        });
        if (!isMutationCurrent()) return;
      }
      toast.success("Saved.");
      setActionOpen(false);
      await load();
      if (!isMutationCurrent()) return;
    } catch (errorObject) {
      if (!isMutationCurrent()) return;
      setFormError(
        errorObject instanceof Error ? errorObject.message : "Could not save.",
      );
    } finally {
      if (isMutationCurrent()) setSaving(false);
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "assignments") {
      return [
        {
          key: "period",
          label: "Period",
          render: (row) =>
            optionLabel(
              asRecord(row.performancePeriod ?? row.performance_period) ?? row,
            ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "weight",
          label: "Weight",
          render: (row) =>
            readString(row, ["totalWeight", "total_weight"], "—"),
        },
      ];
    }
    if (activeTab === "reviews") {
      return [
        {
          key: "review",
          label: "Review",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">
                {optionLabel(
                  asRecord(row.performancePeriod ?? row.performance_period) ??
                    row,
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Score{" "}
                {readString(
                  row,
                  ["finalScore", "final_score", "kpiScore", "kpi_score"],
                  "—",
                )}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  openAction("self-review", row);
                }}
              >
                Self-review
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  openAction("appeal", row);
                }}
              >
                Appeal
              </button>
            </div>
          ),
        },
      ];
    }
    if (activeTab === "feedback") {
      return [
        {
          key: "review",
          label: "Review",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">
                Review #
                {readNumber(row, [
                  "performanceReviewId",
                  "performance_review_id",
                ]) ?? "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                {prettify(
                  readString(
                    row,
                    ["relationshipType", "relationship_type"],
                    "PEER",
                  ),
                )}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "PENDING")} />
          ),
        },
        {
          key: "due",
          label: "Due",
          render: (row) => readString(row, ["dueDate", "due_date"], "N/A"),
        },
        {
          key: "score",
          label: "Score",
          render: (row) =>
            readString(row, ["overallScore", "overall_score"], "N/A"),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row);
            const status = readString(row, ["status"], "PENDING");
            const isPending = status === "PENDING";
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={!isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    openAction("feedback-360", row);
                  }}
                >
                  Submit
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={!isPending || busyId === `decline-${id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    const token = readStoredToken();
                    if (!token || !id) return;
                    setBusyId(`decline-${id}`);
                    void declineMyPerformanceFeedback360(token, id)
                      .then(() => {
                        toast.success("Feedback request declined.");
                        return load();
                      })
                      .catch((errorObject) => {
                        toast.error(
                          errorObject instanceof Error
                            ? errorObject.message
                            : "Could not decline.",
                        );
                      })
                      .finally(() => setBusyId(""));
                  }}
                >
                  {busyId === `decline-${id}` ? (
                    <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  ) : (
                    "Decline"
                  )}
                </button>
              </div>
            );
          },
        },
      ];
    }
    if (activeTab === "development") {
      return [
        {
          key: "goal",
          label: "Goal",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">
                {readString(row, ["title"], `Goal #${rowId(row)}`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["plan_title"], "Development plan")}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "progress",
          label: "Progress",
          render: (row) =>
            `${readString(row, ["progressPercent", "progress_percent"], "0")}%`,
        },
        {
          key: "target",
          label: "Target",
          render: (row) =>
            readString(row, ["targetDate", "target_date"], "N/A"),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <button
              type="button"
              className={actionButtonClass}
              onClick={(event) => {
                event.stopPropagation();
                openAction("development-goal", row);
              }}
            >
              Update
            </button>
          ),
        },
      ];
    }
    if (activeTab === "achievements") {
      return [
        {
          key: "kpi",
          label: "KPI",
          render: (row) =>
            readString(
              row,
              ["kpi_name", "kpiName", "name"],
              `Achievement #${rowId(row)}`,
            ),
        },
        {
          key: "value",
          label: "Value",
          render: (row) =>
            readString(
              row,
              ["achievement_value", "achievementValue", "value"],
              "—",
            ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <button
              type="button"
              className={actionButtonClass}
              onClick={(event) => {
                event.stopPropagation();
                openAction("achievement", row);
              }}
            >
              Update
            </button>
          ),
        },
      ];
    }
    if (activeTab === "improvement") {
      return [
        {
          key: "plan",
          label: "Plan",
          render: (row) =>
            readString(row, ["summary", "title"], `PIP #${rowId(row)}`),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row);
            return (
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === id}
                onClick={(event) => {
                  event.stopPropagation();
                  const token = readStoredToken();
                  if (!token || !id) return;
                  setBusyId(id);
                  void acknowledgeMyPerformanceImprovementPlan(token, id)
                    .then(() => {
                      toast.success("Improvement plan acknowledged.");
                      return load();
                    })
                    .catch((errorObject) => {
                      toast.error(
                        errorObject instanceof Error
                          ? errorObject.message
                          : "Could not acknowledge.",
                      );
                    })
                    .finally(() => setBusyId(""));
                }}
              >
                {busyId === id ? (
                  <FluentLoadingIndicator className="size-3.5 animate-spin" />
                ) : (
                  "Acknowledge"
                )}
              </button>
            );
          },
        },
      ];
    }
    return [
      {
        key: "employee",
        label: "Employee",
        render: (row) => employeeLabel(row),
      },
      {
        key: "kpi",
        label: "KPI",
        render: (row) => readString(row, ["kpi_name", "kpiName", "name"], "—"),
      },
      {
        key: "value",
        label: "Value",
        render: (row) =>
          readString(
            row,
            ["achievement_value", "achievementValue", "value"],
            "—",
          ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={actionButtonClass}
              onClick={(event) => {
                event.stopPropagation();
                openAction("validate", row);
              }}
            >
              Validate
            </button>
            <button
              type="button"
              className={actionButtonClass}
              onClick={(event) => {
                event.stopPropagation();
                openAction("manager-review", row);
              }}
            >
              Review
            </button>
          </div>
        ),
      },
    ];
  }, [activeTab, busyId, load]);

  if (loading && !actionOpen)
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <FluentLoadingIndicator />
        <p role="status">
          Loading this workflow and checking its available actions…
        </p>
      </section>
    );

  if (error && !loading && !actionOpen)
    return (
      <section className="flex flex-col gap-4">
        <WorkflowGuide
          title="This workflow needs attention"
          unavailable={error}
          steps={[
            "Resolve the permission, setup, or network issue described above.",
            "Reload this view before continuing.",
          ]}
        />
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => void load()}
        >
          Reload workflow
        </button>
      </section>
    );

  return (
    <section className="space-y-4">
      <WorkflowGuide
        title="Your performance cycle"
        steps={[
          "Check your assigned cycle and approved KPIs.",
          "Record achievements and supporting evidence.",
          "Submit your self review for your manager.",
          "Follow manager and HR review progress.",
          "Read the published result; appeal within the allowed deadline if needed.",
        ]}
        unavailable={error}
      />
      {activeTab === "overview" ? (
        <>
          <div className="space-y-5 px-1 pb-2 pt-2">
            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
              >
                {error}
              </p>
            ) : null}
            <div className="grid gap-0 border-y border-border sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "My KPIs",
                  value: myKpis.length,
                  detail: "Goals in your cycles",
                  icon: ScoreIcon,
                  url: "/dashboard/me/performance/kpis",
                },
                {
                  label: "Activities",
                  value: activityTasks.length,
                  detail: "Work assigned to you",
                  icon: AssignedWorkIcon,
                  url: "/dashboard/me/activities/today",
                },
                {
                  label: "Reviews",
                  value: reviews.length,
                  detail: `${assignments.length} review assignments`,
                  icon: ReviewsIcon,
                  url: "/dashboard/me/performance/reviews",
                },
                {
                  label: "Current score",
                  value:
                    score === null
                      ? "Pending"
                      : Number.isInteger(score)
                        ? String(score)
                        : score
                            .toFixed(2)
                            .replace(/0+$/, "")
                            .replace(/\.$/, ""),
                  detail:
                    score === null
                      ? "No finalized score yet"
                      : readString(
                          latestLockedKpiScore,
                          ["finalRatingBand", "final_rating_band"],
                          "Latest available result",
                        ),
                  icon: AchievementIcon,
                  url: "/dashboard/me/performance/achievements",
                },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <button
                    key={metric.label}
                    type="button"
                    onClick={() => router.push(metric.url)}
                    className="group flex min-w-0 items-center justify-between gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/30 last:border-b-0 sm:px-5 xl:border-b-0 xl:border-r xl:last:border-r-0"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <Icon
                          className="size-5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                          {metric.label}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {metric.detail}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "performance-overview-metric-value shrink-0 text-right font-extrabold tracking-[-0.06em] tabular-nums text-primary",
                        metric.value === "Pending"
                          ? "performance-overview-metric-value-pending"
                          : String(metric.value).length > 2
                            ? "performance-overview-metric-value-long"
                            : "",
                      )}
                    >
                      {metric.value}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
            <section className="min-w-0 border-t border-border pt-2">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Review cycle
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Your latest review, from self-assessment to final result.
                  </p>
                </div>
                {reviews.length ? (
                  <Badge appearance="tint" color="brand">
                    Step {cycleStepIndex + 1} of{" "}
                    {PERFORMANCE_CYCLE_STEPS.length}
                  </Badge>
                ) : null}
              </div>
              {reviews.length ? (
                <div className="px-4 pb-3">
                  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Current stage
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {currentCycleStep.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {currentCycleStep.hint}
                      </p>
                    </div>
                    <FluentButton
                      appearance="secondary"
                      size="small"
                      onClick={() =>
                        router.push(
                          cycleStatus === "SELF_REVIEW_PENDING"
                            ? "/dashboard/me/performance/reviews"
                            : "/dashboard/me/performance/assignments",
                        )
                      }
                    >
                      {cycleStatus === "SELF_REVIEW_PENDING"
                        ? "Continue self-review"
                        : "View review cycle"}
                    </FluentButton>
                  </div>
                  <ProgressBar
                    value={Math.min(
                      1,
                      (cycleStepIndex + 1) / PERFORMANCE_CYCLE_STEPS.length,
                    )}
                    thickness="medium"
                    className="mt-3"
                  />
                  <ol
                    className="mt-3 grid gap-2 sm:grid-cols-5"
                    aria-label="Review cycle stages"
                  >
                    {PERFORMANCE_CYCLE_STEPS.map((step, index) => {
                      const complete = index < cycleStepIndex;
                      const current = index === cycleStepIndex;
                      return (
                        <li
                          key={step.key}
                          className={cn(
                            "flex gap-2 border-l-2 py-1 pl-3 sm:block sm:border-l-0 sm:border-t-2 sm:pl-0 sm:pt-2",
                            current
                              ? "border-primary"
                              : complete
                                ? "border-primary/60"
                                : "border-border",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold sm:mb-2",
                              current
                                ? "bg-primary text-primary-foreground"
                                : complete
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {complete ? (
                              <CycleDoneIcon className="size-4" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <div>
                            <p
                              className={cn(
                                "text-xs font-semibold",
                                current
                                  ? "text-primary"
                                  : complete
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                              )}
                            >
                              {step.label}
                            </p>
                            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                              {step.hint}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
                <div className="flex flex-col items-center px-4 pb-8 pt-3 text-center">
                  <div
                    className="relative flex size-20 items-center justify-center rounded-full bg-primary/[0.06]"
                    aria-hidden="true"
                  >
                    <span className="absolute inset-2 rounded-full border border-primary/10" />
                    <EmptyReviewIcon className="relative size-10 text-primary/75" />
                    <span className="absolute -right-1 top-2 size-2 rounded-full bg-primary/35" />
                    <span className="absolute bottom-2 left-0 size-1.5 rounded-full bg-primary/20" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    No review in progress
                  </h3>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                    When your review begins, you’ll see each stage and what
                    needs your attention here.
                  </p>
                  <FluentButton
                    appearance="primary"
                    size="small"
                    className="mt-4 !px-5 !py-2"
                    onClick={() =>
                      router.push("/dashboard/me/performance/assignments")
                    }
                  >
                    View my assignments
                  </FluentButton>
                </div>
              )}
            </section>

            <section className="min-w-0 border-t border-border pt-2">
              <div className="px-4 py-4">
                <h2 className="text-base font-semibold text-foreground">
                  Your next steps
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pick up where you left off.
                </p>
              </div>
              <nav
                aria-label="Your next steps"
                className="divide-y divide-border/70 px-4"
              >
                {[
                  {
                    label: "Activities in progress",
                    hint: "Continue work you started",
                    count: activityTasks.filter(
                      (row) =>
                        readString(row, ["status"], "PLANNED").toUpperCase() ===
                        "IN_PROGRESS",
                    ).length,
                    url: "/dashboard/me/activities/today?tab=tasks&status=IN_PROGRESS",
                    icon: AssignedWorkIcon,
                  },
                  {
                    label: "Feedback requests",
                    hint: "Respond to pending feedback",
                    count: feedback360.filter(
                      (row) =>
                        readString(row, ["status"], "PENDING").toUpperCase() ===
                        "PENDING",
                    ).length,
                    url: "/dashboard/me/performance/feedback",
                    icon: FeedbackIcon,
                  },
                  {
                    label: "Development plans",
                    hint: "Track your growth goals",
                    count: developmentPlans.length,
                    url: "/dashboard/me/performance/development",
                    icon: DevelopmentIcon,
                  },
                  {
                    label: "Improvement plans",
                    hint: "Review your action plan",
                    count: pips.length,
                    url: "/dashboard/me/performance/improvement",
                    icon: AchievementIcon,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => router.push(item.url)}
                      className="group flex w-full items-center gap-3 py-3.5 text-left transition-colors hover:text-primary focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <Icon
                        className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground group-hover:text-primary">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.hint}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "min-w-5 text-right text-sm font-semibold tabular-nums",
                          item.count
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.count}
                      </span>
                      <NextIcon
                        className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </nav>
            </section>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "team"
                ? "Team performance"
                : activeTab === "assign-tasks"
                  ? "Assign tasks"
                  : activeTab === "feedback"
                    ? "360 feedback"
                    : activeTab === "development"
                      ? "Development"
                      : prettify(activeTab)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "team"
                ? "Validate team achievements and submit manager reviews."
                : activeTab === "assign-tasks"
                  ? "Create a task for a direct report and track the handover in daily activities."
                  : activeTab === "feedback"
                    ? "Respond to peer, subordinate, and stakeholder feedback requests."
                    : activeTab === "development"
                      ? "Track development goals and update progress."
                      : "Work that belongs to your current review cycle."}
            </p>
          </div>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <FluentLoadingIndicator className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Refresh
          </button>
        </div>
      )}

      {activeTab === "team" && managerSummary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile
            label="Team size"
            value={
              readNumber(managerSummary, [
                "team_size",
                "teamSize",
                "direct_reports",
              ]) ?? "—"
            }
          />
          <MetricTile
            label="Pending reviews"
            value={
              readNumber(managerSummary, [
                "pending_reviews",
                "pendingReviews",
              ]) ?? teamAchievements.length
            }
          />
          <MetricTile
            label="Team score"
            value={
              readNumber(managerSummary, ["average_score", "averageScore"]) ??
              "—"
            }
          />
        </div>
      ) : null}

      {activeTab === "assign-tasks" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <ValidatedWorkflowForm
            key={taskAudience}
            saving={taskSaving}
            submitError={taskError}
            onSubmit={saveManagerTask}
            validation={{
              schema: activityTaskSchema,
              input: performanceTaskInput,
            }}
            description="Define the work, schedule it in local time, then confirm the assignment."
          >
            <div className="border-b border-border px-4 pt-4 sm:px-6 sm:pt-5">
              <div
                className="flex w-full max-w-md rounded-lg bg-muted p-1"
                role="tablist"
                aria-label="Task owner"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={taskAudience === "employee"}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
                    taskAudience === "employee"
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTaskAudience("employee")}
                >
                  Assign to employee
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={taskAudience === "self"}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
                    taskAudience === "self"
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTaskAudience("self")}
                >
                  Create for myself
                </button>
              </div>
            </div>
            <div className="space-y-6 p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-full border border-border p-2 text-primary">
                  <UserRoundIcon className="size-4" />
                </div>
                <div>
                  <h2 className="font-semibold">
                    {taskAudience === "employee"
                      ? "Assign planned work"
                      : "Create a personal task"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {taskAudience === "employee"
                      ? "The employee will see this in My Activities and can update its progress."
                      : "This task will appear in your own My Activities workspace."}
                  </p>
                </div>
              </div>

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Task title</span>
                <input
                  className={inputClass}
                  placeholder="e.g. Prepare the monthly report"
                  value={taskForm.title ?? ""}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>

              {taskAudience === "employee" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Assigned to</span>
                  <FluentSelect
                    ariaLabel="Assigned to"
                    className="w-full"
                    value={taskForm.employee_id ?? ""}
                    onChange={(value) =>
                      setTaskForm((current) => ({
                        ...current,
                        employee_id: value,
                      }))
                    }
                    placeholder="Select employee"
                    options={[
                      { value: "", label: "Select employee" },
                      ...taskEmployees.map((employee) => ({
                        value: rowId(employee),
                        label: readString(
                          employee,
                          ["full_name", "fullName", "name"],
                          employeeLabel(employee),
                        ),
                      })),
                    ]}
                  />
                </label>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-sm">
                  <UserRoundIcon className="size-4 text-primary" /> Assigned to
                  you
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Status</span>
                  <FluentSelect
                    ariaLabel="Status"
                    className="w-full"
                    value="PLANNED"
                    disabled
                    onChange={() => {}}
                    options={[{ value: "PLANNED", label: "Not started" }]}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Priority</span>
                  <FluentSelect
                    ariaLabel="Priority"
                    className="w-full"
                    value={taskForm.priority ?? "MEDIUM"}
                    onChange={(value) =>
                      setTaskForm((current) => ({
                        ...current,
                        priority: value,
                      }))
                    }
                    options={[
                      { value: "LOW", label: "Low" },
                      { value: "MEDIUM", label: "Medium" },
                      { value: "HIGH", label: "High" },
                      { value: "URGENT", label: "Urgent" },
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Start date</span>
                  <DateInput
                    className={inputClass}
                    value={taskForm.activity_date ?? ""}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        activity_date: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">
                    Due date{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </span>
                  <DateInput
                    className={inputClass}
                    value={taskForm.due_date ?? ""}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        due_date: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Start time (local)</span>
                  <input
                    type="time"
                    className={inputClass}
                    value={taskForm.start_time ?? "09:00"}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        start_time: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">End time (local)</span>
                  <input
                    type="time"
                    className={inputClass}
                    value={taskForm.end_time ?? "17:00"}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        end_time: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold">Checklist</h3>
                  <p className="text-xs text-muted-foreground">
                    Add the steps needed to complete this task.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    className={`${inputClass} min-w-0 flex-1`}
                    value={taskChecklistDraft}
                    onChange={(event) =>
                      setTaskChecklistDraft(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTaskChecklistItem();
                      }
                    }}
                    placeholder="Add a checklist item"
                    aria-label="Checklist item"
                  />
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={!taskChecklistDraft.trim()}
                    onClick={addTaskChecklistItem}
                  >
                    <PlusIcon className="size-4" /> Add
                  </button>
                </div>
                {taskChecklist.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <CheckCircle2Icon className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">{item}</span>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() =>
                        setTaskChecklist((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      aria-label={`Remove ${item}`}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Notes</span>
                <Textarea
                  className={`${textareaClass} min-h-28`}
                  placeholder="Describe the expected outcome and any handover details."
                  value={taskForm.description ?? ""}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <p className="text-xs text-muted-foreground">
                After creation, open the task from Activities to update
                progress, complete the checklist, and continue the conversation.
              </p>
            </div>
            {taskError ? (
              <p className="mx-4 mb-3 text-sm text-rose-600 sm:mx-6">
                {taskError}
              </p>
            ) : null}
            <div className="flex justify-end border-t border-border px-4 py-4 sm:px-6"></div>
          </ValidatedWorkflowForm>
        </div>
      ) : activeTab !== "overview" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {managerError && activeTab === "team" ? (
            <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
              {managerError}
            </div>
          ) : null}
          {error && activeTab !== "team" ? (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <ResizableTable
            title="Performance records"
            data={rows}
            columns={columns}
            loading={loading}
            itemsPerPage={20}
            showExport={false}
            storageKey={`me-performance-${activeTab}`}
            onRowSelect={(_, row) => {
              if (!row) return;
              setDetailRecord(row);
              setDetailOpen(true);
            }}
          />
        </div>
      ) : null}

      <RecordDetailsDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={optionLabel(detailRecord)}
        row={detailRecord}
      />

      <Dialog
        open={actionOpen}
        onOpenChange={(next) => {
          if (!saving) setActionOpen(next);
        }}
      >
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {actionMode === "self-review"
                ? "Submit self-review"
                : actionMode === "appeal"
                  ? "Appeal review"
                  : actionMode === "achievement"
                    ? "Update achievement"
                    : actionMode === "validate"
                      ? "Validate achievement"
                      : actionMode === "feedback-360"
                        ? "Submit 360 feedback"
                        : actionMode === "development-goal"
                          ? "Update development goal"
                          : "Submit manager review"}
            </DialogTitle>
            <DialogDescription>
              {actionMode === "feedback-360"
                ? "Share specific, fair feedback for this review cycle."
                : "Sends the documented self-service or manager payload."}
            </DialogDescription>
          </DialogHeader>
          <ValidatedWorkflowForm
            key={actionMode}
            saving={saving}
            submitError={formError}
            onSubmit={onSaveAction}
            validation={{
              schema: performanceActionSchema(actionMode),
              input: form,
            }}
            description="Review your evidence and comments before submitting this lifecycle action."
          >
            <div className="grid gap-3">
              {actionMode === "self-review" ||
              actionMode === "manager-review" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Comment</span>
                  <Textarea
                    className={textareaClass}
                    value={form.comment ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        comment: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
              {actionMode === "self-review" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Highlights</span>
                  <Textarea
                    className={textareaClass}
                    value={form.highlights ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        highlights: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
              {actionMode === "appeal" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Reason</span>
                  <Textarea
                    className={textareaClass}
                    value={form.reason ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
              {actionMode === "achievement" || actionMode === "validate" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Achievement value</span>
                  <input
                    className={inputClass}
                    value={form.achievement_value ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        achievement_value: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
              {actionMode === "achievement" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Comment</span>
                  <Textarea
                    className={textareaClass}
                    value={form.comment ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        comment: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
              {actionMode === "validate" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Manager comment</span>
                  <Textarea
                    className={textareaClass}
                    value={form.manager_comment ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        manager_comment: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
              {actionMode === "manager-review" ? (
                <>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      Strengths (one per line)
                    </span>
                    <Textarea
                      className={textareaClass}
                      value={form.areas_of_strength ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          areas_of_strength: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      Improvements (one per line)
                    </span>
                    <Textarea
                      className={textareaClass}
                      value={form.areas_for_improvement ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          areas_for_improvement: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              ) : null}
              {actionMode === "feedback-360" ? (
                <>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Overall score</span>
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      placeholder="0-100"
                      value={form.overall_score ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          overall_score: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Collaboration</span>
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        placeholder="0-100"
                        value={form.collaboration_score ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            collaboration_score: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Communication</span>
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        placeholder="0-100"
                        value={form.communication_score ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            communication_score: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Ownership</span>
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        placeholder="0-100"
                        value={form.ownership_score ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            ownership_score: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Strengths</span>
                    <Textarea
                      className={textareaClass}
                      value={form.strengths ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          strengths: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Improvement areas</span>
                    <Textarea
                      className={textareaClass}
                      value={form.improvement_areas ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          improvement_areas: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Comments</span>
                    <Textarea
                      className={textareaClass}
                      value={form.comments ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          comments: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              ) : null}
              {actionMode === "development-goal" ? (
                <>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Status</span>
                    <FluentSelect
                      ariaLabel="Status"
                      className="w-full"
                      value={
                        form.status ??
                        readString(actionRow, ["status"], "IN_PROGRESS")
                      }
                      onChange={(value) =>
                        setForm((current) => ({ ...current, status: value }))
                      }
                      options={[
                        { value: "OPEN", label: "Open" },
                        { value: "IN_PROGRESS", label: "In progress" },
                        { value: "COMPLETED", label: "Completed" },
                      ]}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Progress percent</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={
                        form.progress_percent ??
                        readString(
                          actionRow,
                          ["progressPercent", "progress_percent"],
                          "0",
                        )
                      }
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          progress_percent: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Comment</span>
                    <Textarea
                      className={textareaClass}
                      value={form.employee_comment ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          employee_comment: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              ) : null}
              {formError ? (
                <p className="text-sm text-rose-600">{formError}</p>
              ) : null}
            </div>
          </ValidatedWorkflowForm>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={saving}
              onClick={() => setActionOpen(false)}
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
```

## /home/innocent/systems/hrms/src/components/dashboard/validated-workflow-form.tsx

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type WorkflowValidation = { schema: z.ZodType; input: unknown };

/** Details are validated before review and again before the existing mutation. */
export function ValidatedWorkflowForm({
  children,
  validation,
  saving,
  onSubmit,
  description,
  submitError,
}: {
  children: ReactNode;
  validation: WorkflowValidation;
  saving: boolean;
  onSubmit: () => Promise<void>;
  description: string;
  submitError?: string | null;
}) {
  const [step, setStep] = useState<"details" | "review">("details");
  const [issues, setIssues] = useState<z.core.$ZodIssue[]>([]);
  const [reviewed, setReviewed] = useState<unknown>(null);
  const submitting = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const fingerprint = JSON.stringify(validation.input);
  const reviewedFingerprint = useRef("");

  useEffect(() => {
    if (step === "review" && reviewedFingerprint.current !== fingerprint) {
      setStep("details");
      setReviewed(null);
    }
  }, [fingerprint, step]);

  function validate() {
    const result = validation.schema.safeParse(validation.input);
    setIssues(result.success ? [] : result.error.issues);
    if (!result.success) return false;
    setReviewed(result.data);
    reviewedFingerprint.current = fingerprint;
    return true;
  }

  async function submit() {
    if (saving || submitting.current || !validate()) return;
    submitting.current = true;
    try {
      await onSubmit();
    } catch (cause) {
      if (active.current)
        setIssues([
          {
            code: "custom",
            path: ["save"],
            message:
              cause instanceof Error
                ? cause.message
                : "The changes could not be saved. Your details are retained; try again.",
          },
        ]);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Step{" "}
        {step === "details"
          ? "1 of 2: Enter details"
          : "2 of 2: Review and confirm"}
        . {description}
      </p>
      {step === "details" ? (
        <fieldset disabled={saving} className="min-w-0">
          {children}
        </fieldset>
      ) : (
        <Alert>
          <AlertTitle>Review your changes</AlertTitle>
          <AlertDescription>
            <dl className="flex max-h-80 flex-col gap-2 overflow-auto">
              {reviewed && typeof reviewed === "object"
                ? Object.entries(reviewed)
                    .filter(([, value]) => value !== undefined && value !== "")
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt className="font-medium">{humanize(key)}</dt>
                        <dd className="whitespace-pre-wrap break-words">
                          {reviewValue(value)}
                        </dd>
                      </div>
                    ))
                : null}
            </dl>
          </AlertDescription>
        </Alert>
      )}
      {submitError ? (
        <Alert variant="destructive">
          <AlertTitle>The change could not be completed</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}
      {issues.length ? (
        <Alert variant="destructive">
          <AlertTitle>Correct these fields before continuing</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {issues.map((issue, index) => (
                <li key={index}>
                  {issue.path.map(String).join(" → ").replaceAll("_", " ")}:{" "}
                  {issue.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        {step === "review" ? (
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => setStep("details")}
          >
            Back to details
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={saving}
          onClick={() => {
            if (step === "details") {
              if (validate()) setStep("review");
            } else void submit();
          }}
        >
          {saving
            ? "Saving…"
            : step === "details"
              ? "Review details"
              : "Confirm and save"}
        </Button>
      </div>
    </div>
  );
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

function reviewValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "")
    return "Not specified";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value.length ? (
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        {value.map((item, index) => (
          <li key={index}>{reviewValue(item)}</li>
        ))}
      </ol>
    ) : (
      "None"
    );
  if (typeof value === "object")
    return (
      <dl className="flex flex-col gap-1">
        {Object.entries(value)
          .filter(([key]) => key !== "id")
          .map(([key, item]) => (
            <div key={key}>
              <dt className="inline font-medium">{humanize(key)}: </dt>
              <dd className="inline">{reviewValue(item)}</dd>
            </div>
          ))}
      </dl>
    );
  return String(value);
}
```

## /home/innocent/systems/hrms/src/components/dashboard/validated-workflow-form.test.tsx

```tsx
// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { persistAuthSession, persistAuthUser } from "@/lib/auth-session-store";
import { ValidatedWorkflowForm } from "./validated-workflow-form";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const schema = z.object({ title: z.string().trim().min(1) });
function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  if (!button) throw new Error(`Missing button ${label}`);
  button.click();
}

describe("validated workflow recovery", () => {
  it("keeps invalid details inline and requires review before the mutation", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const render = (title: string) =>
      root.render(
        <ValidatedWorkflowForm
          saving={false}
          onSubmit={save}
          validation={{ schema, input: { title } }}
          description="Confirm the changes."
        >
          <input aria-label="Title" defaultValue={title} />
        </ValidatedWorkflowForm>,
      );
    await act(async () => render(""));
    await act(async () => click("Review details"));
    expect(container.textContent).toContain("Correct these fields");
    expect(save).not.toHaveBeenCalled();
    await act(async () => render("Review source records"));
    await act(async () => click("Review details"));
    expect(container.textContent).toContain("Review your changes");
    await act(async () => {
      click("Confirm and save");
      click("Confirm and save");
    });
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("returns changed inputs to validation and retains values after a failed save", async () => {
    const save = vi
      .fn()
      .mockRejectedValue(new Error("Version changed; refresh"));
    const render = (title: string) =>
      root.render(
        <ValidatedWorkflowForm
          saving={false}
          onSubmit={save}
          validation={{ schema, input: { title } }}
          description="Confirm."
        >
          <span>{title}</span>
        </ValidatedWorkflowForm>,
      );
    await act(async () => render("Original"));
    await act(async () => click("Review details"));
    await act(async () => render("Updated"));
    expect(container.textContent).toContain("1 of 2");
    await act(async () => click("Review details"));
    await act(async () => click("Confirm and save"));
    expect(container.textContent).toContain("Version changed; refresh");
    expect(container.textContent).toContain("Updated");
  });
  it("discards old reads after a newer request and after a scope change", async () => {
    const controls: Array<{ commit: (apply: () => void) => void }> = [];
    const changes = vi.fn();
    function Probe({ scope }: { scope: string }) {
      const { begin } = useWorkflowRequest(scope);
      return <button onClick={() => controls.push(begin())}>Start</button>;
    }
    await act(async () => root.render(<Probe scope="overview" />));
    await act(async () => {
      click("Start");
      click("Start");
    });
    controls[0].commit(() => changes("old"));
    controls[1].commit(() => changes("current"));
    expect(changes.mock.calls).toEqual([["current"]]);
    await act(async () => root.render(<Probe scope="setup" />));
    controls[1].commit(() => changes("wrong scope"));
    expect(changes).toHaveBeenCalledTimes(1);
    await act(async () => click("Start"));
    await act(async () => root.unmount());
    controls[2].commit(() => changes("unmounted"));
    expect(changes).toHaveBeenCalledTimes(1);
  });
  it("rejects pending work after a company change even if the access token is unchanged", async () => {
    persistAuthSession(
      { accessToken: "same-token", refreshToken: "refresh" },
      {
        id: 1,
        companyId: 10,
        fullName: "Employee",
        email: "employee@example.test",
      },
    );
    let pending:
      | ReturnType<ReturnType<typeof useWorkflowRequest>["begin"]>
      | undefined;
    const changes = vi.fn();
    function Probe() {
      const { begin } = useWorkflowRequest("overview");
      return (
        <button
          onClick={() => {
            pending = begin();
          }}
        >
          Start
        </button>
      );
    }
    await act(async () => root.render(<Probe />));
    await act(async () => click("Start"));
    await act(async () =>
      persistAuthUser({
        id: 1,
        companyId: 20,
        fullName: "Employee",
        email: "employee@example.test",
      }),
    );
    pending?.commit(() => changes("wrong company"));
    expect(changes).not.toHaveBeenCalled();
    await act(async () => persistAuthSession(null, null));
  });
});
```

## /home/innocent/systems/hrms/src/components/dashboard/workflow-guide.tsx

```tsx
"use client";

import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function WorkflowGuide({
  title,
  steps,
  unavailable,
  action,
}: {
  title: string;
  steps: readonly string[];
  unavailable?: string | null;
  action?: { href: string; label: string };
}) {
  return (
    <Alert>
      <AlertTitle>{unavailable ? `${title}: action needed` : title}</AlertTitle>
      <AlertDescription>
        {unavailable ? <p>{unavailable}</p> : null}
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {action ? <Link href={action.href}>{action.label}</Link> : null}
      </AlertDescription>
    </Alert>
  );
}
```

## /home/innocent/systems/hrms/src/hooks/use-workflow-request.ts

```typescript
"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
} from "@/lib/auth-session-store";
import { readStoredSessionTokens } from "@/lib/session-client";

/** Suppresses old responses after navigation, unmount, refresh, or login changes. */
export function useWorkflowRequest(scope: string) {
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const tokens = session.tokens;
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    let active = true;
    mounted.current = active;
    generation.current += 1;
    return () => {
      active = false;
      mounted.current = active;
      generation.current += 1;
    };
  }, [scope, session.credentialVersion]);

  const begin = useCallback(() => {
    const ticket = ++generation.current;
    const credential = readStoredSessionTokens().accessToken;
    const identityVersion = session.credentialVersion;
    const current = () =>
      mounted.current &&
      generation.current === ticket &&
      readStoredSessionTokens().accessToken === credential &&
      getSessionSnapshot().credentialVersion === identityVersion;
    return {
      scope,
      current,
      commit: (apply: () => void) => {
        if (current()) apply();
      },
    };
  }, [scope, session.credentialVersion]);

  const invalidate = useCallback(() => {
    generation.current += 1;
  }, []);
  return { begin, invalidate, credential: tokens?.accessToken };
}
```

## /home/innocent/systems/hrms/src/lib/workflow-schemas.ts

```typescript
import { z } from "zod";

const text = (max: number) =>
  z.string().trim().min(1, "This field is required.").max(max);
const numberText = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Number(value)), "Enter a finite number.");
const positiveId = numberText.refine(
  (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0,
  "Choose a valid record.",
);
const percent = numberText.refine(
  (value) => Number(value) >= 0 && Number(value) <= 100,
  "Enter a number from 0 to 100.",
);
const weight = numberText.refine(
  (value) =>
    /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value) &&
    Number(value) > 0 &&
    Number(value) <= 100,
  "Weight must be greater than 0 and at most 100, with up to two decimals.",
);
export const workflowDate = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    "Choose a valid calendar date.",
  );
const optionalDate = z.union([workflowDate, z.literal("")]).optional();
const optionalNumber = z.union([numberText, z.literal("")]).optional();
const optionalPercent = z.union([percent, z.literal("")]).optional();
const optionalId = z.union([positiveId, z.literal("")]).optional();
const formObject = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).passthrough();

function dateRange<T extends z.ZodRawShape>(
  shape: T,
  from: string,
  to: string,
) {
  return formObject(shape).superRefine((input, context) => {
    const start = input[from];
    const end = input[to];
    if (
      typeof start === "string" &&
      typeof end === "string" &&
      start &&
      end &&
      end < start
    ) {
      context.addIssue({
        code: "custom",
        path: [to],
        message: "The end date must be on or after the start date.",
      });
    }
  });
}

export function weightsTotalExactly100(
  values: readonly string[],
  allowZero = false,
): boolean {
  return (
    values.length > 0 &&
    values.every(
      (value) =>
        weight.safeParse(value).success || (allowZero && value === "0"),
    ) &&
    values.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0) ===
      10000
  );
}

export const activityTaskSchema = formObject({
  title: text(250),
  description: text(4000),
  activity_date: workflowDate,
  start_time: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a valid start time."),
  end_time: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a valid end time."),
  due_date: optionalDate,
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  expected_result: z.string().max(4000).optional(),
  employee_kpi_id: optionalId,
  audience: z.enum(["employee", "self"]),
  employeeIds: z.array(positiveId).max(100),
  checklistItems: z.array(text(250)).max(100),
}).superRefine((input, context) => {
  if (input.end_time <= input.start_time)
    context.addIssue({
      code: "custom",
      path: ["end_time"],
      message: "End time must be later than start time.",
    });
  if (input.due_date && input.due_date < input.activity_date)
    context.addIssue({
      code: "custom",
      path: ["due_date"],
      message: "Due date cannot be before the activity day.",
    });
  if (input.audience === "employee" && !input.employeeIds.length)
    context.addIssue({
      code: "custom",
      path: ["employeeIds"],
      message: "Choose at least one employee.",
    });
});

export function activityFormSchema(mode: string) {
  if (mode === "report") return formObject({ activity_date: workflowDate });
  if (mode === "entry")
    return formObject({
      id: positiveId,
      activity_category_id: positiveId,
      title: text(250),
      description: text(4000),
      status: z
        .enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "DEFERRED", "CANCELLED"])
        .optional(),
      outcome: z.string().max(4000).optional(),
      defer_reason: z.string().max(4000).optional(),
      planned_start_time: z.string().optional(),
      planned_end_time: z.string().optional(),
      requires_time: z.boolean().optional(),
      requires_outcome: z.boolean().optional(),
    }).superRefine((input, context) => {
      if (
        input.requires_time &&
        (!input.planned_start_time || !input.planned_end_time)
      )
        context.addIssue({
          code: "custom",
          path: ["planned_start_time"],
          message: "This category requires start and end times.",
        });
      if (input.planned_start_time || input.planned_end_time) {
        if (
          !input.planned_start_time ||
          !input.planned_end_time ||
          !Number.isFinite(Date.parse(input.planned_start_time)) ||
          !Number.isFinite(Date.parse(input.planned_end_time)) ||
          Date.parse(input.planned_end_time) <=
            Date.parse(input.planned_start_time)
        )
          context.addIssue({
            code: "custom",
            path: ["planned_end_time"],
            message: "Choose valid increasing start and end times.",
          });
      }
      if (
        input.status === "COMPLETED" &&
        input.requires_outcome &&
        !input.outcome?.trim()
      )
        context.addIssue({
          code: "custom",
          path: ["outcome"],
          message: "Describe the completed result for this category.",
        });
      if (input.status === "DEFERRED" && !input.defer_reason?.trim())
        context.addIssue({
          code: "custom",
          path: ["defer_reason"],
          message: "Explain why this activity is deferred.",
        });
    });
  if (mode === "submit")
    return formObject({
      id: positiveId,
      employee_summary: text(5000),
      overall_remarks: z.string().max(3000).optional(),
    });
  if (mode === "review")
    return formObject({
      id: positiveId,
      decision: z.enum(["APPROVE", "RETURN", "REJECT"]),
      comments: text(5000),
      rating: optionalPercent,
    });
  if (mode === "category")
    return formObject({
      code: text(80),
      name: text(180),
      description: z.string().optional(),
    });
  return dateRange(
    {
      effective_from: workflowDate,
      effective_to: optionalDate,
      minimum_activity_count: z
        .union([
          numberText.refine(
            (value) =>
              Number.isSafeInteger(Number(value)) && Number(value) >= 0,
            "Enter a nonnegative whole number.",
          ),
          z.literal(""),
        ])
        .optional(),
    },
    "effective_from",
    "effective_to",
  );
}

export function performanceFormSchema(mode: string): z.ZodType {
  const catalog = { code: text(80), name: text(180) };
  const version = {
    kpi_definition_version_id: positiveId,
    weight,
    target_value: optionalNumber,
  };
  if (mode === "year")
    return dateRange(
      {
        code: text(30),
        name: text(100),
        start_date: workflowDate,
        end_date: workflowDate,
      },
      "start_date",
      "end_date",
    );
  if (mode === "period" || mode === "period-edit")
    return dateRange(
      {
        financial_year_id: positiveId,
        name: text(100),
        period_type: z.enum([
          "MONTHLY",
          "QUARTERLY",
          "HALF_YEARLY",
          "ANNUAL",
          "CUSTOM",
        ]),
        sequence_number: positiveId,
        start_date: workflowDate,
        end_date: workflowDate,
        goal_setting_deadline: workflowDate,
        mid_cycle_review_date: workflowDate,
        final_review_deadline: workflowDate,
      },
      "start_date",
      "end_date",
    ).superRefine((input, context) => {
      if (
        !(
          input.start_date <= input.goal_setting_deadline &&
          input.goal_setting_deadline < input.mid_cycle_review_date &&
          input.mid_cycle_review_date <= input.end_date &&
          input.end_date <= input.final_review_deadline
        )
      )
        context.addIssue({
          code: "custom",
          path: ["final_review_deadline"],
          message:
            "Dates must follow start → goal deadline → mid-cycle review → end → final deadline; goal deadline must precede mid-cycle review.",
        });
    });
  if (["kpi", "kpi-edit", "kpi-version"].includes(mode))
    return formObject({
      ...catalog,
      description: text(10000),
      measurement_unit: text(80),
      default_target_value: optionalNumber,
    });
  if (mode === "template")
    return formObject({
      ...catalog,
      ...version,
      applicable_role_ids: text(4000),
      additionalTemplateItems: z.array(
        z.object({ versionId: positiveId, weight, target: optionalNumber }),
      ),
    }).superRefine((input, context) => {
      const items = [
        { versionId: input.kpi_definition_version_id, weight: input.weight },
        ...input.additionalTemplateItems,
      ];
      if (!weightsTotalExactly100(items.map((item) => item.weight)))
        context.addIssue({
          code: "custom",
          path: ["weight"],
          message: "All KPI weights must total exactly 100%.",
        });
      if (new Set(items.map((item) => item.versionId)).size !== items.length)
        context.addIssue({
          code: "custom",
          path: ["additionalTemplateItems"],
          message: "Choose each KPI version only once.",
        });
      if (
        input.applicable_role_ids
          .split(",")
          .some((value) => !positiveId.safeParse(value.trim()).success)
      )
        context.addIssue({
          code: "custom",
          path: ["applicable_role_ids"],
          message: "Choose valid applicable roles.",
        });
    });
  if (mode === "rule")
    return formObject({
      kpi_definition_version_id: positiveId,
      priority: optionalNumber,
      weight_override: optionalPercent,
      target_override: optionalNumber,
      employee_id: optionalId,
      financial_year_id: optionalId,
    });
  if (mode === "competency")
    return formObject({
      code: text(80),
      name: text(180),
      item_code: text(60),
      item_name: text(180),
      item_weight: weight.refine(
        (value) => Number(value) === 100,
        "The single competency item must carry exactly 100% weight.",
      ),
      maximum_rating: z
        .union([
          numberText.refine(
            (value) => Number(value) > 0,
            "Maximum rating must be positive.",
          ),
          z.literal(""),
        ])
        .optional(),
    });
  if (mode === "scale")
    return formObject({
      code: text(60),
      name: text(150),
      band_code: text(40),
      band_label: text(100),
      minimum_score: optionalNumber,
      maximum_score: optionalNumber,
      band_min: optionalNumber,
      band_max: optionalNumber,
    }).superRefine((input, context) => {
      const low = Number(input.minimum_score || 0),
        high = Number(input.maximum_score || 100);
      const bandLow = Number(input.band_min || 0),
        bandHigh = Number(input.band_max || 100);
      if (low >= high || bandLow > bandHigh || bandLow < low || bandHigh > high)
        context.addIssue({
          code: "custom",
          path: ["band_max"],
          message:
            "The band must fit within the scale's increasing minimum and maximum.",
        });
    });
  if (mode === "plan" || mode === "generate-plan")
    return dateRange(
      {
        employee_id: positiveId,
        financial_year_id: positiveId,
        effective_from: workflowDate,
        effective_to: optionalDate,
        ...(mode === "plan"
          ? {
              ...version,
              weight: weight.refine(
                (value) => Number(value) === 100,
                "This single-item plan must total exactly 100%.",
              ),
            }
          : {}),
      },
      "effective_from",
      "effective_to",
    );
  if (mode === "development")
    return dateRange(
      {
        employee_id: positiveId,
        title: text(160),
        goal_title: text(180),
        start_date: optionalDate,
        target_completion_date: optionalDate,
        goal_target_date: optionalDate,
      },
      "start_date",
      "target_completion_date",
    );
  if (mode === "pip")
    return formObject({
      review_id: positiveId,
      summary: text(10000),
      objectives: text(10000),
      milestone_title: text(180),
      milestone_due: workflowDate,
    });
  if (mode === "approve")
    return formObject({
      period_assignment_id: positiveId,
      adjustment_score: optionalNumber,
    });
  if (mode === "workflow-action")
    return formObject({
      review_id: positiveId,
      decision: z.enum(["APPROVE", "RETURN", "REJECT"]),
      comment: z.string().max(4000).optional(),
      adjustment_score: optionalNumber,
    }).superRefine((input, context) => {
      if (input.decision !== "APPROVE" && !input.comment?.trim())
        context.addIssue({
          code: "custom",
          path: ["comment"],
          message: "Explain why the review is being returned or rejected.",
        });
    });
  if (mode === "moderate" || mode === "reopen")
    return formObject({
      review_id: positiveId,
      reason: text(4000),
      final_score: optionalNumber,
    });
  if (mode === "feedback")
    return formObject({
      review_id: positiveId,
      rater_employee_ids: text(4000).refine(
        (value) =>
          value
            .split(/[\n,]+/)
            .every((id) => positiveId.safeParse(id.trim()).success),
        "Enter valid employee IDs.",
      ),
      due_date: optionalDate,
    });
  if (mode === "milestone")
    return formObject({ milestone_id: positiveId, comment: text(4000) });
  if (mode === "scorecard")
    return formObject({
      code: text(80),
      name: text(160),
      effective_from: optionalDate,
      effective_to: optionalDate,
      scorecardComponents: z
        .array(
          z
            .object({
              code: text(80),
              label: text(160),
              type: text(80),
              weight: percent,
              enabled: z.boolean(),
              required: z.boolean(),
            })
            .passthrough(),
        )
        .min(1),
    }).superRefine((input, context) => {
      if (
        !weightsTotalExactly100(
          input.scorecardComponents
            .filter((item) => item.enabled)
            .map((item) => item.weight),
          true,
        )
      )
        context.addIssue({
          code: "custom",
          path: ["scorecardComponents"],
          message: "Enabled component weights must total exactly 100%.",
        });
      if (
        input.effective_from &&
        input.effective_to &&
        input.effective_to < input.effective_from
      )
        context.addIssue({
          code: "custom",
          path: ["effective_to"],
          message: "End date cannot precede start date.",
        });
    });
  if (mode === "workflow")
    return formObject({
      code: text(80),
      name: text(160),
      workflowSteps: z
        .array(
          z
            .object({
              code: text(80),
              label: text(160),
              sequenceNumber: positiveId,
              type: text(80),
            })
            .passthrough(),
        )
        .min(1),
    }).superRefine((input, context) => {
      if (
        new Set(input.workflowSteps.map((step) => Number(step.sequenceNumber)))
          .size !== input.workflowSteps.length
      )
        context.addIssue({
          code: "custom",
          path: ["workflowSteps"],
          message: "Each workflow step needs a unique sequence.",
        });
    });
  return z.never();
}

export function employeeKpiFormSchema(
  mode: string,
  manager: boolean,
): z.ZodType {
  if (mode === "review")
    return formObject({
      decision: z.enum(["APPROVE", "RETURN", "REJECT"]),
      comment: z.string().max(4000).optional(),
    }).superRefine((input, context) => {
      if (input.decision !== "APPROVE" && !input.comment?.trim())
        context.addIssue({
          code: "custom",
          path: ["comment"],
          message: "Explain your decision.",
        });
    });
  if (mode === "actual")
    return formObject({
      actual_value: numberText.refine(
        (value) => Number(value) >= 0,
        "Actual value must be nonnegative.",
      ),
    });
  return dateRange(
    {
      performance_period_id: positiveId,
      title: text(250),
      description: text(10000),
      measurement_type: z.enum([
        "PERCENTAGE",
        "NUMBER",
        "BOOLEAN",
        "RATING",
        "CURRENCY",
        "MANUAL",
      ]),
      due_date: workflowDate,
      start_date: optionalDate,
      weight,
      target_value: optionalNumber,
      ...(manager && mode === "create" ? { employee_id: positiveId } : {}),
    },
    "start_date",
    "due_date",
  ).superRefine((input, context) => {
    if (
      input.measurement_type !== "MANUAL" &&
      input.scoring_type !== "RATING_SCALE" &&
      !input.target_value
    )
      context.addIssue({
        code: "custom",
        path: ["target_value"],
        message: "This measurement type requires a target value.",
      });
    const start = input.period_start_date,
      end = input.period_end_date;
    if (
      typeof start === "string" &&
      typeof end === "string" &&
      (input.due_date < start ||
        input.due_date > end ||
        (input.start_date && input.start_date < start))
    )
      context.addIssue({
        code: "custom",
        path: ["due_date"],
        message: "KPI dates must fall inside the selected performance period.",
      });
  });
}

export function performanceActionSchema(mode: string): z.ZodType {
  if (mode === "appeal") return formObject({ reason: text(4000) });
  if (mode === "feedback-360")
    return formObject({
      overall_score: percent,
      collaboration_score: optionalPercent,
      communication_score: optionalPercent,
      ownership_score: optionalPercent,
    });
  if (mode === "development-goal")
    return formObject({ progress_percent: optionalPercent });
  if (mode === "achievement" || mode === "validate")
    return formObject({ achievement_value: optionalNumber });
  return formObject({ comment: text(4000) });
}
```

## /home/innocent/systems/hrms/src/lib/workflow-schemas.test.ts

```typescript
import { describe, expect, it } from "vitest";
import {
  activityTaskSchema,
  employeeKpiFormSchema,
  performanceFormSchema,
  weightsTotalExactly100,
  workflowDate,
} from "./workflow-schemas";

const task = {
  title: "Prepare report",
  description: "Review source records",
  activity_date: "2026-10-12",
  start_time: "09:00",
  end_time: "10:00",
  priority: "MEDIUM",
  audience: "self",
  employeeIds: [],
  checklistItems: [],
};

describe("wizard step validation", () => {
  it("rejects rollover calendar dates and reversed task schedules before submission", () => {
    expect(workflowDate.safeParse("2026-02-30").success).toBe(false);
    expect(activityTaskSchema.safeParse(task).success).toBe(true);
    expect(
      activityTaskSchema.safeParse({ ...task, end_time: "08:59" }).success,
    ).toBe(false);
    expect(
      activityTaskSchema.safeParse({ ...task, due_date: "2026-10-11" }).success,
    ).toBe(false);
    expect(
      activityTaskSchema.safeParse({ ...task, audience: "employee" }).success,
    ).toBe(false);
  });
  it("uses exact persisted weight precision and preserves decimal totals", () => {
    expect(weightsTotalExactly100(["33.33", "33.33", "33.34"])).toBe(true);
    expect(weightsTotalExactly100(["50", "49.999"])).toBe(false);
    expect(weightsTotalExactly100(["100", "-1", "1"])).toBe(false);
    expect(weightsTotalExactly100(["abc"])).toBe(false);
    expect(weightsTotalExactly100(["100", "0"], true)).toBe(true);
  });
  it("rejects duplicate KPI versions even if template weights total 100", () => {
    const schema = performanceFormSchema("template");
    const input = {
      code: "SALES",
      name: "Sales",
      kpi_definition_version_id: "1",
      weight: "50",
      applicable_role_ids: "2",
      additionalTemplateItems: [{ versionId: "1", weight: "50", target: "" }],
    };
    expect(schema.safeParse(input).success).toBe(false);
    expect(
      schema.safeParse({
        ...input,
        additionalTemplateItems: [{ versionId: "3", weight: "50", target: "" }],
      }).success,
    ).toBe(true);
  });
  it("matches the existing workflow draft properties and blocks duplicate sequences", () => {
    const schema = performanceFormSchema("workflow");
    const step = {
      code: "MANAGER",
      label: "Manager",
      type: "MANAGER_REVIEW",
      sequenceNumber: "1",
      required: true,
      canFinalize: false,
    };
    expect(
      schema.safeParse({
        code: "DEFAULT",
        name: "Default",
        workflowSteps: [step],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        code: "DEFAULT",
        name: "Default",
        workflowSteps: [step, { ...step, code: "HR" }],
      }).success,
    ).toBe(false);
  });
  it("rejects nonfinite KPI targets while retaining all supported measurement types", () => {
    const schema = employeeKpiFormSchema("create", false);
    const input = {
      performance_period_id: "1",
      title: "Revenue",
      description: "Monthly revenue",
      measurement_type: "CURRENCY",
      due_date: "2026-10-30",
      weight: "100",
      target_value: "10000",
    };
    expect(schema.safeParse(input).success).toBe(true);
    expect(schema.safeParse({ ...input, target_value: "NaN" }).success).toBe(
      false,
    );
  });
});
```

## /home/innocent/systems/hrms/src/lib/workflow-error.ts

```typescript
import { ApiError } from "@/lib/request-json";

export function workflowFailure(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401)
      return "Your session has expired. Sign in again to continue this workflow.";
    if (cause.status === 403)
      return "Your account cannot access this part of the workflow. Ask your administrator to grant the required module permissions.";
    if (cause.status === 404)
      return "This workflow or referenced record is unavailable. Refresh, then ask HR to check the module and cycle setup if it remains unavailable.";
    if (cause.status === 409) return cause.message;
  }
  return cause instanceof Error ? cause.message : fallback;
}
```

## /home/innocent/systems/hrms/src/components/dashboard/activity-evidence-picker.tsx

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FluentSelect } from "@/components/ui/fluent-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  addMyActivityEvidence,
  listMyDocuments,
  type AdminRecord,
} from "@/lib/admin-api";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";
import { readStoredSessionTokens } from "@/lib/session-client";
import { workflowFailure } from "@/lib/workflow-error";
import { optionLabel, rowId } from "./talent-visuals";

const selectionSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Choose an existing document.")
  .refine(
    (value) => Number.isSafeInteger(Number(value)),
    "Choose a valid document.",
  );

export function ActivityEvidencePicker({
  entryId,
  onAttached,
}: {
  entryId: string;
  onAttached: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<AdminRecord[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [documentId, setDocumentId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { begin, invalidate } = useWorkflowRequest(`${entryId}:evidence-list`);
  const { begin: beginSave } = useWorkflowRequest(`${entryId}:evidence-save`);

  useEffect(() => {
    savingRef.current = false;
    setSaving(false);
    setDocumentId("");
    setMessage("");
  }, [beginSave, entryId]);

  useEffect(() => {
    let active = true;
    if (!open) return;
    const { current } = begin();
    const token = readStoredSessionTokens().accessToken;
    setStatus("loading");
    setMessage("");
    void listMyDocuments(token)
      .then((items) => {
        if (active && current()) {
          setDocuments(items);
          setStatus("ready");
        }
      })
      .catch((cause) => {
        if (active && current()) {
          setStatus("error");
          setMessage(
            workflowFailure(cause, "Your documents could not be loaded."),
          );
        }
      });
    return () => {
      active = false;
      invalidate();
    };
  }, [begin, entryId, invalidate, open]);

  async function attach() {
    const parsed = selectionSchema.safeParse(documentId);
    if (
      !parsed.success ||
      !documents.some((document) => rowId(document) === documentId)
    ) {
      setMessage("Choose a document from your own document list.");
      return;
    }
    if (savingRef.current) return;
    const { current } = beginSave();
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      await addMyActivityEvidence(
        readStoredSessionTokens().accessToken,
        entryId,
        { document_id: Number(parsed.data) },
      );
      if (!current()) return;
      setDocumentId("");
      setMessage("Evidence attached. You can continue your activity report.");
      try {
        await onAttached();
      } catch {
        if (current())
          setMessage(
            "Evidence was attached. Reload the report to refresh its details.",
          );
      }
    } catch (cause) {
      if (current())
        setMessage(
          workflowFailure(
            cause,
            "Evidence could not be attached. Your selection is retained.",
          ),
        );
    } finally {
      if (current()) {
        setSaving(false);
        savingRef.current = false;
      }
    }
  }

  if (!open)
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Attach evidence
      </Button>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Select supporting evidence from your employee documents before
        submitting the daily report.
      </p>
      {status === "loading" ? (
        <p role="status">Loading your documents…</p>
      ) : null}
      {status === "ready" && documents.length > 0 ? (
        <FluentSelect
          ariaLabel="Supporting document"
          value={documentId}
          disabled={saving}
          onChange={setDocumentId}
          options={[
            { value: "", label: "Choose a document" },
            ...documents.map((document) => ({
              value: rowId(document),
              label: optionLabel(document),
            })),
          ]}
        />
      ) : null}
      {status === "ready" && documents.length === 0 ? (
        <p className="text-sm">You have no documents to attach yet.</p>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Activity evidence</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={saving || status !== "ready" || !documentId}
          onClick={() => void attach()}
        >
          {saving ? "Attaching…" : "Attach selected document"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => setOpen(false)}
        >
          Close evidence picker
        </Button>
        <Link href="/dashboard/me/requests/documents">
          Upload or manage your documents
        </Link>
      </div>
    </div>
  );
}
```

## /home/innocent/systems/hrms/src/components/dashboard/activity-evidence-picker.test.tsx

```tsx
// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityEvidencePicker } from "./activity-evidence-picker";
import { ApiError } from "@/lib/request-json";
import { persistAuthSession } from "@/lib/auth-session-store";

const api = vi.hoisted(() => ({
  listMyDocuments: vi.fn(),
  addMyActivityEvidence: vi.fn(),
}));
vi.mock("@/lib/admin-api", () => api);
vi.mock("@/components/ui/fluent-select", () => ({
  FluentSelect: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <select
      aria-label="Supporting document"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listMyDocuments.mockReset();
  api.addMyActivityEvidence.mockReset();
  persistAuthSession(null, null);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  if (!button) throw new Error(`Missing button ${label}`);
  button.click();
}

describe("activity evidence workflow", () => {
  it("distinguishes permission failure from having no documents", async () => {
    api.listMyDocuments.mockRejectedValue(new ApiError("Forbidden", 403));
    await act(async () =>
      root.render(<ActivityEvidencePicker entryId="10" onAttached={vi.fn()} />),
    );
    await act(async () => click("Attach evidence"));
    expect(container.textContent).toContain("required module permissions");
    expect(container.textContent).not.toContain("You have no documents");
  });
  it("attaches only a listed document, refreshes, and clears the completed selection", async () => {
    api.listMyDocuments.mockResolvedValue([{ id: 4, title: "Visit receipt" }]);
    api.addMyActivityEvidence.mockResolvedValue({ id: 5 });
    const refresh = vi.fn().mockResolvedValue(undefined);
    await act(async () =>
      root.render(<ActivityEvidencePicker entryId="10" onAttached={refresh} />),
    );
    await act(async () => click("Attach evidence"));
    await act(async () => {
      const select = container.querySelector("select")!;
      select.value = "4";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => click("Attach selected document"));
    expect(api.addMyActivityEvidence).toHaveBeenCalledWith("", "10", {
      document_id: 4,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Evidence attached");
    expect(container.querySelector("select")!.value).toBe("");
  });
});
```
