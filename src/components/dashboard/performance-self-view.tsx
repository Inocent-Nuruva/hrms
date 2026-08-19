"use client"

import * as React from "react"
import { Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  CycleRail,
  HeroBand,
  MetricTile,
  ScoreRing,
  StatusChip,
  StatusStack,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  asRecordArray,
  employeeLabel,
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
} from "@/components/dashboard/talent-visuals"
import { forgetForbiddenRoute } from "@/lib/forbidden-routes"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import {
  acknowledgeMyPerformanceImprovementPlan,
  getManagerPerformanceSummary,
  getMyPerformanceSummary,
  listManagerTeamAchievements,
  listMyPerformanceAchievements,
  listMyPerformanceAssignments,
  listMyPerformanceImprovementPlans,
  listMyPerformanceReviews,
  submitManagerPerformanceReview,
  submitMyPerformanceAppeal,
  submitMyPerformanceSelfReview,
  updateMyPerformanceAchievement,
  validateManagerAchievement,
  type AdminRecord,
} from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type PerformanceSelfTab =
  | "overview"
  | "assignments"
  | "reviews"
  | "achievements"
  | "improvement"
  | "team"

type ActionMode = "self-review" | "appeal" | "achievement" | "manager-review" | "validate"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

export function PerformanceSelfView({
  activeTab,
}: {
  activeTab: PerformanceSelfTab
}) {
  const [summary, setSummary] = React.useState<AdminRecord | null>(null)
  const [managerSummary, setManagerSummary] = React.useState<AdminRecord | null>(null)
  const [assignments, setAssignments] = React.useState<AdminRecord[]>([])
  const [reviews, setReviews] = React.useState<AdminRecord[]>([])
  const [achievements, setAchievements] = React.useState<AdminRecord[]>([])
  const [pips, setPips] = React.useState<AdminRecord[]>([])
  const [teamAchievements, setTeamAchievements] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [managerError, setManagerError] = React.useState<string | null>(null)
  const [detailRecord, setDetailRecord] = React.useState<AdminRecord | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [actionOpen, setActionOpen] = React.useState(false)
  const [actionMode, setActionMode] = React.useState<ActionMode>("self-review")
  const [actionRow, setActionRow] = React.useState<AdminRecord | null>(null)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState("")

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const tasks: Array<Promise<unknown>> = [
        getMyPerformanceSummary(token).then(setSummary),
        listMyPerformanceAssignments(token).then(setAssignments),
        listMyPerformanceReviews(token).then(setReviews),
        listMyPerformanceAchievements(token).then(setAchievements),
        listMyPerformanceImprovementPlans(token).then(setPips),
      ]
      if (activeTab === "team") {
        tasks.push(
          getManagerPerformanceSummary(token)
            .then((value) => {
              setManagerSummary(value)
              setManagerError(null)
            })
            .catch((errorObject) => {
              setManagerSummary(null)
              setManagerError(
                errorObject instanceof Error
                  ? errorObject.message
                  : "Team performance is only available to managers.",
              )
            }),
          listManagerTeamAchievements(token)
            .then(setTeamAchievements)
            .catch(() => setTeamAchievements([])),
        )
      }
      const results = await Promise.allSettled(tasks)
      const firstError = results.find((result) => result.status === "rejected")
      if (firstError && firstError.status === "rejected" && activeTab !== "team") {
        setError(firstError.reason instanceof Error ? firstError.reason.message : "Could not load your performance.")
      }
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Could not load your performance.")
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  React.useEffect(() => {
    forgetForbiddenRoute("/dashboard/me/performance")
    forgetForbiddenRoute("/dashboard/me/performance/overview")
    forgetForbiddenRoute("/dashboard/me/performance/assignments")
    forgetForbiddenRoute("/dashboard/me/performance/reviews")
    forgetForbiddenRoute("/dashboard/me/performance/achievements")
    forgetForbiddenRoute("/dashboard/me/performance/improvement")
    forgetForbiddenRoute("/dashboard/me/performance/team")
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const score =
    readNumber(summary, ["current_score", "currentScore", "final_score", "finalScore", "average_score", "averageScore"]) ??
    readNumber(asRecord(summary?.latest_review ?? summary?.latestReview), ["finalScore", "final_score"])

  const rows =
    activeTab === "assignments"
      ? assignments
      : activeTab === "reviews"
        ? reviews
        : activeTab === "achievements"
          ? achievements
          : activeTab === "improvement"
            ? pips
            : teamAchievements

  function openAction(mode: ActionMode, row: AdminRecord) {
    setActionMode(mode)
    setActionRow(row)
    setForm({})
    setFormError(null)
    setActionOpen(true)
  }

  async function onSaveAction() {
    const token = readStoredToken()
    if (!token || !actionRow) return
    setSaving(true)
    setFormError(null)
    try {
      if (actionMode === "self-review") {
        const assignmentId = readNumber(actionRow, ["periodAssignmentId", "period_assignment_id", "id"])
        if (assignmentId === null) throw new Error("This review has no period assignment.")
        await submitMyPerformanceSelfReview(token, assignmentId, {
          comment: form.comment ?? "",
          highlights: form.highlights ?? "",
        })
      } else if (actionMode === "appeal") {
        const reviewId = readNumber(actionRow, ["id", "reviewId", "review_id"])
        if (reviewId === null || !form.reason?.trim()) throw new Error("Review and reason are required.")
        await submitMyPerformanceAppeal(token, reviewId, { reason: form.reason.trim() })
      } else if (actionMode === "achievement") {
        const id = rowId(actionRow)
        if (!id) throw new Error("Achievement is missing.")
        await updateMyPerformanceAchievement(token, id, {
          achievement_value: form.achievement_value ? Number(form.achievement_value) : undefined,
          comment: form.comment || undefined,
          evidence: form.evidence || undefined,
        })
      } else if (actionMode === "manager-review") {
        const assignmentId = readNumber(actionRow, ["periodAssignmentId", "period_assignment_id", "id"])
        if (assignmentId === null) throw new Error("Period assignment is required.")
        await submitManagerPerformanceReview(token, assignmentId, {
          review: { comment: form.comment ?? "" },
          areas_of_strength: (form.areas_of_strength ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
          areas_for_improvement: (form.areas_for_improvement ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
          training_needs: (form.training_needs ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
          recommendations: (form.recommendations ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
        })
      } else if (actionMode === "validate") {
        const id = rowId(actionRow)
        if (!id) throw new Error("Achievement is missing.")
        await validateManagerAchievement(token, id, {
          achievement_value: form.achievement_value ? Number(form.achievement_value) : undefined,
          manager_comment: form.manager_comment || undefined,
          override_reason: form.override_reason || undefined,
          submit_for_hr: form.submit_for_hr === "true",
        })
      }
      toast.success("Saved.")
      setActionOpen(false)
      await load()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "assignments") {
      return [
        {
          key: "period",
          label: "Period",
          render: (row) => optionLabel(asRecord(row.performancePeriod ?? row.performance_period) ?? row),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} />,
        },
        {
          key: "weight",
          label: "Weight",
          render: (row) => readString(row, ["totalWeight", "total_weight"], "—"),
        },
      ]
    }
    if (activeTab === "reviews") {
      return [
        {
          key: "review",
          label: "Review",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">
                {optionLabel(asRecord(row.performancePeriod ?? row.performance_period) ?? row)}
              </p>
              <p className="text-xs text-muted-foreground">
                Score {readString(row, ["finalScore", "final_score", "kpiScore", "kpi_score"], "—")}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} />,
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
                  event.stopPropagation()
                  openAction("self-review", row)
                }}
              >
                Self-review
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation()
                  openAction("appeal", row)
                }}
              >
                Appeal
              </button>
            </div>
          ),
        },
      ]
    }
    if (activeTab === "achievements") {
      return [
        {
          key: "kpi",
          label: "KPI",
          render: (row) =>
            readString(row, ["kpi_name", "kpiName", "name"], `Achievement #${rowId(row)}`),
        },
        {
          key: "value",
          label: "Value",
          render: (row) => readString(row, ["achievement_value", "achievementValue", "value"], "—"),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} />,
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <button
              type="button"
              className={actionButtonClass}
              onClick={(event) => {
                event.stopPropagation()
                openAction("achievement", row)
              }}
            >
              Update
            </button>
          ),
        },
      ]
    }
    if (activeTab === "improvement") {
      return [
        {
          key: "plan",
          label: "Plan",
          render: (row) => readString(row, ["summary", "title"], `PIP #${rowId(row)}`),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} />,
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row)
            return (
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === id}
                onClick={(event) => {
                  event.stopPropagation()
                  const token = readStoredToken()
                  if (!token || !id) return
                  setBusyId(id)
                  void acknowledgeMyPerformanceImprovementPlan(token, id)
                    .then(() => {
                      toast.success("Improvement plan acknowledged.")
                      return load()
                    })
                    .catch((errorObject) => {
                      toast.error(errorObject instanceof Error ? errorObject.message : "Could not acknowledge.")
                    })
                    .finally(() => setBusyId(""))
                }}
              >
                {busyId === id ? <Loader2Icon className="size-3.5 animate-spin" /> : "Acknowledge"}
              </button>
            )
          },
        },
      ]
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
        render: (row) => readString(row, ["achievement_value", "achievementValue", "value"], "—"),
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
                event.stopPropagation()
                openAction("validate", row)
              }}
            >
              Validate
            </button>
            <button
              type="button"
              className={actionButtonClass}
              onClick={(event) => {
                event.stopPropagation()
                openAction("manager-review", row)
              }}
            >
              Review
            </button>
          </div>
        ),
      },
    ]
  }, [activeTab, busyId, load])

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="My performance"
            title="Your scorecard"
            description="Current score, open assignments, and anything still waiting on you."
            actions={
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                Refresh
              </button>
            }
          />
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-card p-4">
              <ScoreRing value={score} label="Current score" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Assignments" value={assignments.length} hint="Open period assignments" />
              <MetricTile label="Reviews" value={reviews.length} hint="Self and manager cycle" />
              <MetricTile label="Achievements" value={achievements.length} hint="Values you can still update" />
              <MetricTile label="Improvement" value={pips.length} hint="Plans to acknowledge" />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Review mix</h2>
              <div className="mt-4">
                <StatusStack items={statusChartItems(reviews)} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Cycle</h2>
              <div className="mt-4">
                <CycleRail
                  steps={["OPEN", "SELF_REVIEW_PENDING", "MANAGER_REVIEW_PENDING", "APPROVED", "PUBLISHED"]}
                  current={readString(reviews[0], ["status"], "OPEN")}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "team" ? "Team performance" : prettify(activeTab)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "team"
                ? "Validate team achievements and submit manager reviews."
                : "Work that belongs to your current review cycle."}
            </p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        </div>
      )}

      {activeTab === "team" && managerSummary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile
            label="Team size"
            value={readNumber(managerSummary, ["team_size", "teamSize", "direct_reports"]) ?? "—"}
          />
          <MetricTile
            label="Pending reviews"
            value={readNumber(managerSummary, ["pending_reviews", "pendingReviews"]) ?? teamAchievements.length}
          />
          <MetricTile
            label="Team score"
            value={readNumber(managerSummary, ["average_score", "averageScore"]) ?? "—"}
          />
        </div>
      ) : null}

      {activeTab !== "overview" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {managerError && activeTab === "team" ? (
            <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">{managerError}</div>
          ) : null}
          {error && activeTab !== "team" ? (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
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
              if (!row) return
              setDetailRecord(row)
              setDetailOpen(true)
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

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
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
                      : "Submit manager review"}
            </DialogTitle>
            <DialogDescription>Sends the documented self-service or manager payload.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {actionMode === "self-review" || actionMode === "manager-review" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Comment</span>
                <textarea className={textareaClass} value={form.comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} />
              </label>
            ) : null}
            {actionMode === "self-review" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Highlights</span>
                <textarea className={textareaClass} value={form.highlights ?? ""} onChange={(event) => setForm((current) => ({ ...current, highlights: event.target.value }))} />
              </label>
            ) : null}
            {actionMode === "appeal" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Reason</span>
                <textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
              </label>
            ) : null}
            {actionMode === "achievement" || actionMode === "validate" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Achievement value</span>
                <input className={inputClass} value={form.achievement_value ?? ""} onChange={(event) => setForm((current) => ({ ...current, achievement_value: event.target.value }))} />
              </label>
            ) : null}
            {actionMode === "achievement" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Comment</span>
                <textarea className={textareaClass} value={form.comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} />
              </label>
            ) : null}
            {actionMode === "validate" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Manager comment</span>
                <textarea className={textareaClass} value={form.manager_comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, manager_comment: event.target.value }))} />
              </label>
            ) : null}
            {actionMode === "manager-review" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Strengths (one per line)</span>
                  <textarea className={textareaClass} value={form.areas_of_strength ?? ""} onChange={(event) => setForm((current) => ({ ...current, areas_of_strength: event.target.value }))} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Improvements (one per line)</span>
                  <textarea className={textareaClass} value={form.areas_for_improvement ?? ""} onChange={(event) => setForm((current) => ({ ...current, areas_for_improvement: event.target.value }))} />
                </label>
              </>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setActionOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSaveAction()} disabled={saving}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Submit"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
