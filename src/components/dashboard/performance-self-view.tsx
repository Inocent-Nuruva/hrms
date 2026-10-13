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
