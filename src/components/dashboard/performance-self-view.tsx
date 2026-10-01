"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
import { CalendarDaysIcon, CheckCircle2Icon, PlusIcon, RefreshCwIcon, SlidersHorizontalIcon, UserRoundIcon, XIcon } from "lucide-react";
import {
  CheckmarkCircle20Regular as AchievementIcon,
  ClipboardTask20Regular as AssignedWorkIcon,
  Clock20Regular as ReviewsIcon,
  Gauge20Regular as ScoreIcon,
  SearchSparkle20Regular as SearchIcon,
} from "@fluentui/react-icons"
import { toast } from "@/components/ui/fluent-toast-store"

import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
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
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals"
import { cn } from "@/lib/utils"
import { forgetForbiddenRoute } from "@/lib/forbidden-routes"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useForbiddenRouteGuard } from "@/hooks/use-forbidden-route-guard"
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
} from "@/lib/admin-api"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

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
  | "manager-kpis"

type ActionMode = "self-review" | "appeal" | "achievement" | "manager-review" | "validate" | "feedback-360" | "development-goal"

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
] as const

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

export function PerformanceSelfView({
  activeTab,
}: {
  activeTab: PerformanceSelfTab
}) {
  const actor = useDashboardActor()
  const canAccess = canAccessDashboardRoute(
    `/dashboard/me/performance/${activeTab}`,
    actor.permissionLabels,
    actor.accessMode,
  )
  useForbiddenRouteGuard(canAccess)
  const [summary, setSummary] = React.useState<AdminRecord | null>(null)
  const [managerSummary, setManagerSummary] = React.useState<AdminRecord | null>(null)
  const [assignments, setAssignments] = React.useState<AdminRecord[]>([])
  const [taskEmployees, setTaskEmployees] = React.useState<AdminRecord[]>([])
  const [activityTasks, setActivityTasks] = React.useState<AdminRecord[]>([])
  const [reviews, setReviews] = React.useState<AdminRecord[]>([])
  const [feedback360, setFeedback360] = React.useState<AdminRecord[]>([])
  const [developmentPlans, setDevelopmentPlans] = React.useState<AdminRecord[]>([])
  const [achievements, setAchievements] = React.useState<AdminRecord[]>([])
  const [pips, setPips] = React.useState<AdminRecord[]>([])
  const [teamAchievements, setTeamAchievements] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [overviewSearch, setOverviewSearch] = React.useState("")
  const [overviewStatus, setOverviewStatus] = React.useState("ALL")
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
  const [taskForm, setTaskForm] = React.useState<Record<string, string>>({
    activity_date: new Date().toISOString().slice(0, 10),
  })
  const [taskError, setTaskError] = React.useState<string | null>(null)
  const [taskSaving, setTaskSaving] = React.useState(false)
  const [taskAudience, setTaskAudience] = React.useState<"employee" | "self">("employee")
  const [taskChecklistDraft, setTaskChecklistDraft] = React.useState("")
  const [taskChecklist, setTaskChecklist] = React.useState<string[]>([])

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
      const tasks: Array<Promise<unknown>> = []
      if (activeTab !== "assign-tasks") {
        tasks.push(
          getMyPerformanceSummary(token).then(setSummary),
          listMyPerformanceAssignments(token).then(setAssignments),
          listMyPerformanceReviews(token).then(setReviews),
          listMyPerformanceFeedback360(token).then(setFeedback360).catch(() => setFeedback360([])),
          listMyPerformanceDevelopmentPlans(token).then(setDevelopmentPlans).catch(() => setDevelopmentPlans([])),
          listMyPerformanceAchievements(token).then(setAchievements),
          listMyPerformanceImprovementPlans(token).then(setPips),
        )
      }
      if (activeTab === "overview") {
        tasks.push(
          listMyActivityTasks(token, { limit: 100 })
            .then(setActivityTasks)
            .catch(() => setActivityTasks([])),
        )
      }
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
      if (activeTab === "assign-tasks") {
        tasks.push(
          listManagerActivityAssignees(token)
            .then(setTaskEmployees)
            .catch(() => setTaskEmployees([])),
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
    forgetForbiddenRoute("/dashboard/me/performance/assign-tasks")
    forgetForbiddenRoute("/dashboard/me/performance/reviews")
    forgetForbiddenRoute("/dashboard/me/performance/feedback")
    forgetForbiddenRoute("/dashboard/me/performance/development")
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
  const cycleStatus = readString(reviews[0], ["status"], "OPEN").toUpperCase()
  const cycleStepIndex = Math.max(
    0,
    PERFORMANCE_CYCLE_STEPS.findIndex((step) => step.key === cycleStatus),
  )
  const overviewItems = React.useMemo(() => {
    const tagged: AdminRecord[] = [
      ...assignments.map((row) => ({ ...row, dashboard_kind: "Assignment" })),
      ...activityTasks.map((row) => ({ ...row, dashboard_kind: "Activity" })),
      ...reviews.map((row) => ({ ...row, dashboard_kind: "Review" })),
      ...developmentPlans.map((row) => ({ ...row, dashboard_kind: "Development" })),
      ...achievements.map((row) => ({ ...row, dashboard_kind: "Achievement" })),
      ...pips.map((row) => ({ ...row, dashboard_kind: "Improvement" })),
    ]
    const needle = overviewSearch.trim().toLowerCase()
    return tagged.filter((row) => {
      const status = readString(row, ["status", "review_status", "reviewStatus"], "OPEN").toUpperCase()
      if (overviewStatus !== "ALL" && status !== overviewStatus) return false
      return !needle || JSON.stringify(row).toLowerCase().includes(needle)
    })
  }, [achievements, activityTasks, assignments, developmentPlans, overviewSearch, overviewStatus, pips, reviews])
  const overviewStatuses = React.useMemo(
    () => Array.from(new Set(
      [assignments, activityTasks, reviews, developmentPlans, achievements, pips]
        .flat()
        .map((row) => readString(row, ["status", "review_status", "reviewStatus"], "OPEN").toUpperCase()),
    )).sort(),
    [achievements, activityTasks, assignments, developmentPlans, pips, reviews],
  )

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
                plan_title: readString(plan, ["title"], `Plan #${rowId(plan)}`),
              })),
            )
        : activeTab === "achievements"
          ? achievements
          : activeTab === "improvement"
            ? pips
            : teamAchievements

  function addTaskChecklistItem() {
    const item = taskChecklistDraft.trim()
    if (!item) return
    setTaskChecklist((current) => [...current, item])
    setTaskChecklistDraft("")
  }

  async function saveManagerTask() {
    const token = readStoredToken()
    if (!token) return
    if (
      (taskAudience === "employee" && !taskForm.employee_id) ||
      !taskForm.activity_date ||
      !taskForm.title?.trim() ||
      !taskForm.description?.trim()
    ) {
      setTaskError(`${taskAudience === "employee" ? "Employee, " : ""}date, title, and notes are required.`)
      return
    }
    setTaskSaving(true)
    setTaskError(null)
    try {
      const taskPayload = {
        activity_date: taskForm.activity_date,
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        planned_start_time: taskForm.planned_start_time
          ? `${taskForm.planned_start_time}T09:00:00.000Z`
          : undefined,
        planned_end_time: taskForm.planned_end_time
          ? `${taskForm.planned_end_time}T17:00:00.000Z`
          : undefined,
        priority: taskForm.priority || "MEDIUM",
        checklist: taskChecklist.map((title, index) => ({
          id: `item-${index + 1}`,
          title,
          completed: false,
        })),
      }
      if (taskAudience === "employee") {
        await createManagerActivityTask(token, {
          ...taskPayload,
          employee_id: Number(taskForm.employee_id),
        })
        toast.success("Task assigned.")
      } else {
        await createMyActivityTask(token, taskPayload)
        toast.success("Task added to your work.")
      }
      setTaskForm({ activity_date: new Date().toISOString().slice(0, 10) })
      setTaskChecklist([])
      setTaskChecklistDraft("")
      await load()
    } catch (errorObject) {
      setTaskError(errorObject instanceof Error ? errorObject.message : "Could not assign task.")
    } finally {
      setTaskSaving(false)
    }
  }

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
      } else if (actionMode === "feedback-360") {
        const id = rowId(actionRow)
        const overallScore = Number(form.overall_score)
        if (!id) throw new Error("Feedback request is missing.")
        if (!Number.isFinite(overallScore) || overallScore < 0 || overallScore > 100) {
          throw new Error("Overall score must be between 0 and 100.")
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
        })
      } else if (actionMode === "development-goal") {
        const id = rowId(actionRow)
        if (!id) throw new Error("Development goal is missing.")
        await updateMyPerformanceDevelopmentGoal(token, id, {
          status: form.status || undefined,
          progress_percent: form.progress_percent ? Number(form.progress_percent) : undefined,
          employee_comment: form.employee_comment || undefined,
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
    if (activeTab === "feedback") {
      return [
        {
          key: "review",
          label: "Review",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">Review #{readNumber(row, ["performanceReviewId", "performance_review_id"]) ?? "N/A"}</p>
              <p className="text-xs text-muted-foreground">
                {prettify(readString(row, ["relationshipType", "relationship_type"], "PEER"))}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "PENDING")} />,
        },
        {
          key: "due",
          label: "Due",
          render: (row) => readString(row, ["dueDate", "due_date"], "N/A"),
        },
        {
          key: "score",
          label: "Score",
          render: (row) => readString(row, ["overallScore", "overall_score"], "N/A"),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row)
            const status = readString(row, ["status"], "PENDING")
            const isPending = status === "PENDING"
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={!isPending}
                  onClick={(event) => {
                    event.stopPropagation()
                    openAction("feedback-360", row)
                  }}
                >
                  Submit
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={!isPending || busyId === `decline-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    const token = readStoredToken()
                    if (!token || !id) return
                    setBusyId(`decline-${id}`)
                    void declineMyPerformanceFeedback360(token, id)
                      .then(() => {
                        toast.success("Feedback request declined.")
                        return load()
                      })
                      .catch((errorObject) => {
                        toast.error(errorObject instanceof Error ? errorObject.message : "Could not decline.")
                      })
                      .finally(() => setBusyId(""))
                  }}
                >
                  {busyId === `decline-${id}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : "Decline"}
                </button>
              </div>
            )
          },
        },
      ]
    }
    if (activeTab === "development") {
      return [
        {
          key: "goal",
          label: "Goal",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{readString(row, ["title"], `Goal #${rowId(row)}`)}</p>
              <p className="text-xs text-muted-foreground">{readString(row, ["plan_title"], "Development plan")}</p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} />,
        },
        {
          key: "progress",
          label: "Progress",
          render: (row) => `${readString(row, ["progressPercent", "progress_percent"], "0")}%`,
        },
        {
          key: "target",
          label: "Target",
          render: (row) => readString(row, ["targetDate", "target_date"], "N/A"),
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
                openAction("development-goal", row)
              }}
            >
              Update
            </button>
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
                {busyId === id ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : "Acknowledge"}
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
      {activeTab === "overview" ? (
        <>
          <header className="flex flex-col gap-3 border-b border-border px-1 pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Performance</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">My performance overview</h1>
              <p className="mt-1 text-sm text-muted-foreground">Track your current review cycle, assigned work, achievements, and development.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative hidden sm:block">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={overviewSearch} onChange={(event) => setOverviewSearch(event.target.value)} placeholder="Find performance work" className="h-9 w-56 rounded-lg border border-border bg-muted/30 pl-9 pr-3 text-xs outline-none focus:border-primary" />
              </label>
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />} Refresh
              </button>
            </div>
          </header>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          ) : null}
          <div className="grid gap-x-6 gap-y-4 border-y border-border/70 py-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Current score", value: score === null || score === undefined ? "—" : String(score), hint: "Latest published result", icon: ScoreIcon },
              { label: "Assigned work", value: activityTasks.length, hint: `${assignments.length} review assignments`, icon: AssignedWorkIcon },
              { label: "Reviews", value: reviews.length, hint: `${feedback360.filter((item) => readString(item, ["status"], "PENDING") === "PENDING").length} feedback pending`, icon: ReviewsIcon },
              { label: "Achievements", value: achievements.length, hint: `${developmentPlans.length} development · ${pips.length} improvement`, icon: AchievementIcon },
            ].map((metric) => {
              const Icon = metric.icon
              return (
                <div key={metric.label} className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="size-4 shrink-0" aria-hidden="true" />{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{metric.value}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">{metric.hint}</p>
                </div>
              )
            })}
          </div>

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div><h2 className="text-sm font-semibold">Review timeline</h2><p className="mt-0.5 text-[10px] text-muted-foreground">Your current cycle from start to published result.</p></div>
              <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[10px] font-semibold text-primary">{prettify(cycleStatus)}</span>
            </div>
            <div className="overflow-x-auto p-4">
              <div className="grid min-w-[720px] grid-cols-5 gap-0">
                {PERFORMANCE_CYCLE_STEPS.map((step, index) => {
                  const state = index < cycleStepIndex ? "done" : index === cycleStepIndex ? "current" : "upcoming"
                  return (
                    <div key={step.key} className="relative px-2 text-center">
                      <div className={cn("absolute left-0 right-0 top-3 h-0.5", index === 0 ? "left-1/2" : "", index === PERFORMANCE_CYCLE_STEPS.length - 1 ? "right-1/2" : "", state === "upcoming" ? "bg-border" : "bg-primary")} />
                      <span className={cn("relative mx-auto flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold", state === "done" ? "border-primary bg-primary text-primary-foreground" : state === "current" ? "border-primary bg-background text-primary ring-4 ring-primary/10" : "border-border bg-background text-muted-foreground")}>
                        {state === "done" ? <CheckCircle2Icon className="size-3.5" /> : index + 1}
                      </span>
                      <p className="mt-3 text-xs font-semibold text-foreground">{step.label}</p>
                      <p className="mt-1 text-[9px] leading-4 text-muted-foreground">{step.hint}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div><h2 className="text-sm font-semibold">Performance work list</h2><p className="mt-0.5 text-[10px] text-muted-foreground">Everything contributing to your current performance cycle.</p></div>
              <div className="flex items-center gap-2">
                <label className="relative sm:hidden"><SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><input value={overviewSearch} onChange={(event) => setOverviewSearch(event.target.value)} placeholder="Search" className="h-8 w-36 rounded-lg border border-border bg-background pl-8 pr-2 text-[10px] outline-none" /></label>
                <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
                <FluentSelect ariaLabel="Status" size="small" value={overviewStatus} onChange={setOverviewStatus} options={[{ value: "ALL", label: "All statuses" }, ...overviewStatuses.map((status) => ({ value: status, label: prettify(status) }))]} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-muted/30 text-[10px] text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Name</th><th className="px-3 py-2.5 font-medium">Type</th><th className="px-3 py-2.5 font-medium">Due date</th><th className="px-3 py-2.5 font-medium">Progress</th><th className="px-4 py-2.5 font-medium">Status</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {overviewItems.slice(0, 12).map((row, index) => {
                    const status = readString(row, ["status", "review_status", "reviewStatus"], "OPEN").toUpperCase()
                    const progress = readNumber(row, ["progress", "progress_percentage", "completion_rate", "completionRate"]) ?? (["APPROVED", "COMPLETED", "PUBLISHED"].includes(status) ? 100 : 0)
                    return (
                      <tr key={`${readString(row, ["dashboard_kind"])}-${rowId(row) || index}`} className="cursor-pointer text-xs hover:bg-primary/[0.03]" onClick={() => { setDetailRecord(row); setDetailOpen(true) }}>
                        <td className="px-4 py-3 font-medium">{optionLabel(row)}</td><td className="px-3 py-3 text-muted-foreground">{readString(row, ["dashboard_kind"], "Performance item")}</td><td className="px-3 py-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarDaysIcon className="size-3" />{readString(row, ["due_date", "dueDate", "end_date", "endDate"], "—")}</span></td>
                        <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div><span className="text-[10px] text-muted-foreground">{Math.round(progress)}%</span></div></td><td className="px-4 py-3"><StatusChip value={status} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!loading && overviewItems.length === 0 ? <div className="flex min-h-32 items-center justify-center px-4 text-xs text-muted-foreground">No performance work matches the current search and filter.</div> : null}
            </div>
          </section>
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
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
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

      {activeTab === "assign-tasks" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 pt-4 sm:px-6 sm:pt-5">
            <div className="flex w-full max-w-md rounded-lg bg-muted p-1" role="tablist" aria-label="Task owner">
              <button
                type="button"
                role="tab"
                aria-selected={taskAudience === "employee"}
                className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium transition", taskAudience === "employee" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setTaskAudience("employee")}
              >
                Assign to employee
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={taskAudience === "self"}
                className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium transition", taskAudience === "self" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setTaskAudience("self")}
              >
                Create for myself
              </button>
            </div>
          </div>
          <div className="space-y-6 p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-full border border-border p-2 text-primary"><UserRoundIcon className="size-4" /></div>
              <div>
                <h2 className="font-semibold">{taskAudience === "employee" ? "Assign planned work" : "Create a personal task"}</h2>
                <p className="text-sm text-muted-foreground">{taskAudience === "employee" ? "The employee will see this in My Activities and can update its progress." : "This task will appear in your own My Activities workspace."}</p>
              </div>
            </div>

            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Task title</span>
              <input className={inputClass} placeholder="e.g. Prepare the monthly report" value={taskForm.title ?? ""} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
            </label>

            {taskAudience === "employee" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Assigned to</span>
                <FluentSelect
                  ariaLabel="Assigned to"
                  className="w-full"
                  value={taskForm.employee_id ?? ""}
                  onChange={(value) => setTaskForm((current) => ({ ...current, employee_id: value }))}
                  placeholder="Select employee"
                  options={[
                    { value: "", label: "Select employee" },
                    ...taskEmployees.map((employee) => ({
                      value: rowId(employee),
                      label: readString(employee, ["full_name", "fullName", "name"], employeeLabel(employee)),
                    })),
                  ]}
                />
              </label>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-sm">
                <UserRoundIcon className="size-4 text-primary" /> Assigned to you
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Status</span><FluentSelect ariaLabel="Status" className="w-full" value="PLANNED" disabled onChange={() => {}} options={[{ value: "PLANNED", label: "Not started" }]} /></label>
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Priority</span><FluentSelect ariaLabel="Priority" className="w-full" value={taskForm.priority ?? "MEDIUM"} onChange={(value) => setTaskForm((current) => ({ ...current, priority: value }))} options={[{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" }]} /></label>
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Start date</span><DateInput className={inputClass} value={taskForm.activity_date ?? ""} onChange={(event) => setTaskForm((current) => ({ ...current, activity_date: event.target.value, planned_start_time: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Due date <span className="font-normal text-muted-foreground">(optional)</span></span><DateInput className={inputClass} value={taskForm.planned_end_time ?? ""} onChange={(event) => setTaskForm((current) => ({ ...current, planned_end_time: event.target.value }))} /></label>
            </div>

            <div className="space-y-2">
              <div><h3 className="text-sm font-semibold">Checklist</h3><p className="text-xs text-muted-foreground">Add the steps needed to complete this task.</p></div>
              <div className="flex gap-2">
                <input className={`${inputClass} min-w-0 flex-1`} value={taskChecklistDraft} onChange={(event) => setTaskChecklistDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTaskChecklistItem() } }} placeholder="Add a checklist item" aria-label="Checklist item" />
                <button type="button" className={secondaryButtonClass} disabled={!taskChecklistDraft.trim()} onClick={addTaskChecklistItem}><PlusIcon className="size-4" /> Add</button>
              </div>
              {taskChecklist.map((item, index) => (
                <div key={`${item}-${index}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><CheckCircle2Icon className="size-4 text-muted-foreground" /><span className="min-w-0 flex-1">{item}</span><button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setTaskChecklist((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item}`}><XIcon className="size-3.5" /></button></div>
              ))}
            </div>

            <label className="grid gap-1.5 text-sm"><span className="font-medium">Notes</span><Textarea className={`${textareaClass} min-h-28`} placeholder="Describe the expected outcome and any handover details." value={taskForm.description ?? ""} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <p className="text-xs text-muted-foreground">After creation, open the task from Activities to update progress, complete the checklist, and continue the conversation.</p>
          </div>
          {taskError ? <p className="mx-4 mb-3 text-sm text-rose-600 sm:mx-6">{taskError}</p> : null}
          <div className="flex justify-end border-t border-border px-4 py-4 sm:px-6">
            <button type="button" className={primaryButtonClass} onClick={() => void saveManagerTask()} disabled={taskSaving}>
              {taskSaving ? <FluentLoadingIndicator className="size-4 animate-spin" /> : null}
              {taskAudience === "employee" ? "Assign task" : "Create my task"}
            </button>
          </div>
        </div>
      ) : activeTab !== "overview" ? (
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
          <div className="grid gap-3">
            {actionMode === "self-review" || actionMode === "manager-review" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Comment</span>
                <Textarea className={textareaClass} value={form.comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} />
              </label>
            ) : null}
            {actionMode === "self-review" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Highlights</span>
                <Textarea className={textareaClass} value={form.highlights ?? ""} onChange={(event) => setForm((current) => ({ ...current, highlights: event.target.value }))} />
              </label>
            ) : null}
            {actionMode === "appeal" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Reason</span>
                <Textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
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
                <Textarea className={textareaClass} value={form.comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} />
              </label>
            ) : null}
            {actionMode === "validate" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Manager comment</span>
                <Textarea className={textareaClass} value={form.manager_comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, manager_comment: event.target.value }))} />
              </label>
            ) : null}
            {actionMode === "manager-review" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Strengths (one per line)</span>
                  <Textarea className={textareaClass} value={form.areas_of_strength ?? ""} onChange={(event) => setForm((current) => ({ ...current, areas_of_strength: event.target.value }))} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Improvements (one per line)</span>
                  <Textarea className={textareaClass} value={form.areas_for_improvement ?? ""} onChange={(event) => setForm((current) => ({ ...current, areas_for_improvement: event.target.value }))} />
                </label>
              </>
            ) : null}
            {actionMode === "feedback-360" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Overall score</span>
                  <input className={inputClass} inputMode="decimal" placeholder="0-100" value={form.overall_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, overall_score: event.target.value }))} />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Collaboration</span>
                    <input className={inputClass} inputMode="decimal" placeholder="0-100" value={form.collaboration_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, collaboration_score: event.target.value }))} />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Communication</span>
                    <input className={inputClass} inputMode="decimal" placeholder="0-100" value={form.communication_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, communication_score: event.target.value }))} />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Ownership</span>
                    <input className={inputClass} inputMode="decimal" placeholder="0-100" value={form.ownership_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, ownership_score: event.target.value }))} />
                  </label>
                </div>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Strengths</span>
                  <Textarea className={textareaClass} value={form.strengths ?? ""} onChange={(event) => setForm((current) => ({ ...current, strengths: event.target.value }))} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Improvement areas</span>
                  <Textarea className={textareaClass} value={form.improvement_areas ?? ""} onChange={(event) => setForm((current) => ({ ...current, improvement_areas: event.target.value }))} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Comments</span>
                  <Textarea className={textareaClass} value={form.comments ?? ""} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} />
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
                    value={form.status ?? readString(actionRow, ["status"], "IN_PROGRESS")}
                    onChange={(value) => setForm((current) => ({ ...current, status: value }))}
                    options={[
                      { value: "OPEN", label: "Open" },
                      { value: "IN_PROGRESS", label: "In progress" },
                      { value: "COMPLETED", label: "Completed" },
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Progress percent</span>
                  <input className={inputClass} inputMode="numeric" value={form.progress_percent ?? readString(actionRow, ["progressPercent", "progress_percent"], "0")} onChange={(event) => setForm((current) => ({ ...current, progress_percent: event.target.value }))} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Comment</span>
                  <Textarea className={textareaClass} value={form.employee_comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, employee_comment: event.target.value }))} />
                </label>
              </>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setActionOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSaveAction()} disabled={saving}>
              {saving ? <FluentLoadingIndicator className="size-4 animate-spin" /> : "Submit"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
