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
  listDepartments,
  listPositions,
  listEmployeeGrades,
  listHrActivities,
  listHrActivityDepartmentSummary,
  listHrActivityCategories,
  listHrActivityExceptions,
  listHrPendingActivityReports,
  downloadHrActivityReportExport,
  getHrPlannedCompletedActivities,
  downloadHrPlannedCompletedActivities,
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

const standardActivityCategoryCodes = new Set([
  "SALES_VISIT",
  "CLIENT_MEETING",
  "RENEWAL_FOLLOW_UP",
  "NEW_BUSINESS_LEAD",
  "BROKER_INTERMEDIARY_VISIT",
  "CLAIM_FOLLOW_UP",
  "UNDERWRITING_REVIEW",
  "POLICY_ISSUANCE",
  "CUSTOMER_SERVICE",
  "COLLECTION_FOLLOW_UP",
  "TRAINING",
  "INTERNAL_MEETING",
  "BRANCH_OPERATIONS",
  "REPORT_PREPARATION",
  "COMPLIANCE_ACTIVITY",
  "ADMINISTRATIVE_TASK",
  "SPECIAL_ASSIGNMENT",
]);

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
  const [departments, setDepartments] = React.useState<AdminRecord[]>([]);
  const [positions, setPositions] = React.useState<AdminRecord[]>([]);
  const [grades, setGrades] = React.useState<AdminRecord[]>([]);
  const [policies, setPolicies] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [categoryFilterId, setCategoryFilterId] = React.useState("");
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
  const [reportDateFrom, setReportDateFrom] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [reportDateTo, setReportDateTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [reportDepartmentId, setReportDepartmentId] = React.useState("");
  const [plannedStatusFilter, setPlannedStatusFilter] = React.useState("");
  const [reportMode, setReportMode] = React.useState<"summary" | "pending" | "planned-completed">("summary");
  const [departmentSummary, setDepartmentSummary] = React.useState<AdminRecord[]>([]);
  const [pendingReportRows, setPendingReportRows] = React.useState<AdminRecord[]>([]);
  const [reportTotals, setReportTotals] = React.useState<AdminRecord>({});
  const [plannedCompletedRows, setPlannedCompletedRows] = React.useState<AdminRecord[]>([]);
  const [exporting, setExporting] = React.useState(false);

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
        listHrActivities(token, { limit: 50, activity_category_id: categoryFilterId || undefined }).then((value) =>
          commit(() => setReports(value)),
        ),
        listManagerPendingActivityReviews(token, { limit: 20 }).then((value) =>
          commit(() => setPending(value)),
        ),
      );
    }
    if (activeTab === "reports") {
      tasks.push(
        listHrActivities(token, { limit: 50, activity_category_id: categoryFilterId || undefined }).then((value) =>
          commit(() => setReports(value)),
        ),
        listManagerTeamActivities(token, { limit: 50, activity_category_id: categoryFilterId || undefined }).then((value) =>
          commit(() => setTeamReports(value)),
        ),
        listDepartments(token, { page: 1, limit: 100 }).then((value) =>
          commit(() => setDepartments(value.rows)),
        ),
      );
      const reportParams = {
        date_from: reportDateFrom || undefined,
        date_to: reportDateTo || undefined,
        department_id: reportDepartmentId || undefined,
        work_status:
          reportMode === "planned-completed"
            ? plannedStatusFilter || undefined
            : undefined,
        activity_category_id:
          reportMode === "planned-completed"
            ? categoryFilterId || undefined
            : undefined,
        limit: 100,
      };
      if (reportMode === "summary") {
        tasks.push(
          listHrActivityDepartmentSummary(token, reportParams).then((value) => {
            const result = value as AdminRecord;
            commit(() => setDepartmentSummary(Array.isArray(result.data) ? result.data as AdminRecord[] : []));
            commit(() => setReportTotals((result.totals as AdminRecord) ?? {}));
          }),
        );
      } else if (reportMode === "pending") {
        tasks.push(
          listHrPendingActivityReports(token, reportParams).then((value) => {
            const result = value as AdminRecord;
            commit(() => setPendingReportRows(Array.isArray(result.data) ? result.data as AdminRecord[] : []));
            commit(() => setReportTotals((result.totals as AdminRecord) ?? {}));
          }),
        );
      } else {
        tasks.push(
          getHrPlannedCompletedActivities(token, reportParams).then((value) => {
            const result = value as AdminRecord;
            commit(() => setPlannedCompletedRows(Array.isArray(result.data) ? result.data as AdminRecord[] : []));
            commit(() => setReportTotals((result.totals as AdminRecord) ?? {}));
          }),
        );
      }
    }
    if (activeTab === "reports") {
      tasks.push(
        listHrActivityCategories(token).then((value) =>
          commit(() => setCategories(value)),
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
        listDepartments(token, { page: 1, limit: 100 }).then((value) =>
          commit(() => setDepartments(value.rows)),
        ),
        listPositions(token, { page: 1, limit: 100 }).then((value) =>
          commit(() => setPositions(value.rows)),
        ),
        listEmployeeGrades(token).then((value) =>
          commit(() => setGrades(value)),
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
  }, [begin, credential, activeTab, categoryFilterId, reportDateFrom, reportDateTo, reportDepartmentId, reportMode, plannedStatusFilter]);

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
  const activityReportData = activeTab === "reports"
    ? reportMode === "summary" ? departmentSummary : reportMode === "pending" ? pendingReportRows : plannedCompletedRows
    : rows;
  const visible = activityReportData.filter(
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
          department_id:
            form.department_id === undefined
              ? undefined
              : form.department_id === ""
                ? null
                : Number(form.department_id),
          position_id:
            form.position_id === undefined
              ? undefined
              : form.position_id === ""
                ? null
                : Number(form.position_id),
          grade_id:
            form.grade_id === undefined
              ? undefined
              : form.grade_id === ""
                ? null
                : Number(form.grade_id),
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
          submission_cutoff_time: form.submission_cutoff_time || undefined,
          submission_timezone: form.submission_timezone || undefined,
          manager_review_due_hours: form.manager_review_due_hours ? Number(form.manager_review_due_hours) : undefined,
          department_head_escalation_enabled: form.department_head_escalation_enabled === "true",
          department_head_escalation_hours: form.department_head_escalation_hours ? Number(form.department_head_escalation_hours) : undefined,
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

  async function exportActivityReport() {
    const token = credential?.trim() || readStoredToken();
    if (!token || exporting) return;
    setExporting(true);
    try {
      const exportParams = { date_from: reportDateFrom, date_to: reportDateTo, department_id: reportDepartmentId || undefined, work_status: reportMode === "planned-completed" ? plannedStatusFilter || undefined : undefined, activity_category_id: reportMode === "planned-completed" ? categoryFilterId || undefined : undefined };
      const blob = reportMode === "planned-completed"
        ? await downloadHrPlannedCompletedActivities(token, exportParams)
        : await downloadHrActivityReportExport(token, reportMode === "summary" ? "department-summary" : "pending-reports", exportParams);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = reportMode === "summary" ? "activity-department-summary.csv" : reportMode === "pending" ? "pending-activity-reports.csv" : "planned-completed-activities.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (errorObject) {
      toast.error(workflowFailure(errorObject, "Could not export activity report."));
    } finally {
      setExporting(false);
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
                    department_id: readString(row, ["departmentId", "department_id"]),
                    position_id: readString(row, ["positionId", "position_id"]),
                    grade_id: readString(row, ["gradeId", "grade_id"]),
                    effective_from: readString(row, [
                      "effectiveFrom",
                      "effective_from",
                    ]),
                    submission_cutoff_time: readString(row, ["submissionCutoffTime", "submission_cutoff_time"], "20:00"),
                    submission_timezone: readString(row, ["submissionTimezone", "submission_timezone"], "UTC"),
                    manager_review_due_hours: readString(row, ["managerReviewDueHours", "manager_review_due_hours"], "24"),
                    department_head_escalation_enabled: String(row.departmentHeadEscalationEnabled ?? row.department_head_escalation_enabled ?? false),
                    department_head_escalation_hours: readString(row, ["departmentHeadEscalationHours", "department_head_escalation_hours"], "48"),
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
    if (activeTab === "reports" && reportMode === "planned-completed") {
      return [
        {
          key: "activity",
          label: "Activity",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{readString(row, ["title"], "Untitled activity")}</p>
              <p className="text-xs text-muted-foreground">{employeeLabel(row)}</p>
            </div>
          ),
        },
        { key: "activity_date", label: "Reporting date", render: (row) => formatDate(row.activity_date) },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "PLANNED")} /> },
        { key: "deadline", label: "Scheduled end", render: (row) => formatDate(row.planned_end_time ?? row.due_date) },
        { key: "completion", label: "Completion", render: (row) => row.completed ? `Completed${row.completed_late ? " late" : ""}` : row.overdue ? "Overdue" : "Open" },
        { key: "follow_up_date", label: "Carry-forward date", render: (row) => formatDate(row.follow_up_date) },
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
  }, [activeTab, load, setupKind, reportMode]);

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
            {activeTab === "reports" ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">From</span>
                  <input className={inputClass} type="date" value={reportDateFrom} max={reportDateTo} onChange={(event) => setReportDateFrom(event.target.value)} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">To</span>
                  <input className={inputClass} type="date" value={reportDateTo} min={reportDateFrom} onChange={(event) => setReportDateTo(event.target.value)} />
                </label>
                <label className="grid min-w-48 gap-1.5 text-sm">
                  <span className="font-medium">Department</span>
                  <FluentSelect ariaLabel="Filter by department" value={reportDepartmentId} onChange={setReportDepartmentId} options={[{ value: "", label: "All departments" }, ...departments.map((department) => ({ value: rowId(department), label: optionLabel(department) }))]} />
                </label>
                <label className="grid min-w-48 gap-1.5 text-sm">
                  <span className="font-medium">View</span>
                  <FluentSelect ariaLabel="Activity report view" value={reportMode} onChange={(value) => setReportMode(value as "summary" | "pending" | "planned-completed")} options={[{ value: "summary", label: "Department summary" }, { value: "pending", label: "Pending reports" }, { value: "planned-completed", label: "Planned vs completed" }]} />
                </label>
                <button type="button" className={secondaryButtonClass} onClick={() => void exportActivityReport()} disabled={exporting}>
                  {exporting ? "Exporting…" : "Export CSV"}
                </button>
              </div>
            ) : null}
            {activeTab === "reports" ? (
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-8">
                {reportMode === "planned-completed" ? <>
                  <MetricTile label="Planned" value={readNumber(reportTotals, ["planned_count"]) ?? 0} />
                  <MetricTile label="Completed" value={readNumber(reportTotals, ["completed_count"]) ?? 0} />
                  <MetricTile label="Incomplete" value={readNumber(reportTotals, ["incomplete_count"]) ?? 0} />
                  <MetricTile label="Deferred" value={readNumber(reportTotals, ["deferred_count"]) ?? 0} />
                  <MetricTile label="Cancelled" value={readNumber(reportTotals, ["cancelled_count"]) ?? 0} />
                  <MetricTile label="Overdue" value={readNumber(reportTotals, ["overdue_count"]) ?? 0} />
                  <MetricTile label="Completed late" value={readNumber(reportTotals, ["completed_late_count"]) ?? 0} />
                  <MetricTile label="Completion %" value={readNumber(reportTotals, ["completion_percent"]) ?? 0} />
                </> : <>
                  <MetricTile label="Eligible employee days" value={readNumber(reportTotals, ["eligible_employee_days"]) ?? 0} />
                  <MetricTile label="Submitted reports" value={readNumber(reportTotals, ["submitted_reports"]) ?? 0} />
                  <MetricTile label="Pending reports" value={readNumber(reportTotals, ["pending_reports"]) ?? 0} />
                </>}
              </div>
            ) : null}
            {activeTab === "reports" ? (
            <label className="grid max-w-sm gap-1.5 text-sm">
              <span className="font-medium">Filter by activity category</span>
              <FluentSelect
                ariaLabel="Filter by activity category"
                value={categoryFilterId}
                onChange={setCategoryFilterId}
                options={[
                  { value: "", label: "All categories" },
                  ...categories.map((category) => ({
                    value: rowId(category),
                    label: optionLabel(category),
                  })),
                ]}
              />
            </label>
          ) : null}
            {activeTab === "reports" && reportMode === "planned-completed" ? (
              <label className="grid max-w-sm gap-1.5 text-sm">
                <span className="font-medium">Filter by activity status</span>
                <FluentSelect ariaLabel="Filter by activity status" value={plannedStatusFilter} onChange={setPlannedStatusFilter} options={[{ value: "", label: "All statuses" }, { value: "PLANNED", label: "Planned" }, { value: "IN_PROGRESS", label: "In progress" }, { value: "COMPLETED", label: "Completed" }, { value: "DEFERRED", label: "Deferred" }, { value: "CANCELLED", label: "Cancelled" }]} />
              </label>
            ) : null}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title={activeTab === "reports" ? reportMode === "summary" ? "Department activity summary" : reportMode === "pending" ? "Pending activity reports" : "Planned versus completed activities" : "Activity records"}
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
                  ((activeTab === "reports" && reportMode !== "planned-completed") || activeTab === "reviews")
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
                        disabled={standardActivityCategoryCodes.has(
                          (form.code ?? "").toUpperCase(),
                        )}
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
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Department applicability</span>
                      <FluentSelect
                        ariaLabel="Department applicability"
                        value={form.department_id ?? ""}
                        onChange={(value) => setForm((current) => ({ ...current, department_id: value }))}
                        options={[
                          { value: "", label: "All departments" },
                          ...departments.map((item) => ({ value: rowId(item), label: optionLabel(item) })),
                        ]}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Position applicability</span>
                      <FluentSelect
                        ariaLabel="Position applicability"
                        value={form.position_id ?? ""}
                        onChange={(value) => setForm((current) => ({ ...current, position_id: value }))}
                        options={[
                          { value: "", label: "All positions" },
                          ...positions.map((item) => ({ value: rowId(item), label: optionLabel(item) })),
                        ]}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Grade applicability</span>
                      <FluentSelect
                        ariaLabel="Grade applicability"
                        value={form.grade_id ?? ""}
                        onChange={(value) => setForm((current) => ({ ...current, grade_id: value }))}
                        options={[
                          { value: "", label: "All grades" },
                          ...grades.map((item) => ({ value: rowId(item), label: optionLabel(item) })),
                        ]}
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
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Submission cut-off (local time)</span>
                      <input type="time" className={inputClass} value={form.submission_cutoff_time ?? "20:00"} onChange={(event) => setForm((current) => ({ ...current, submission_cutoff_time: event.target.value }))} />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Cut-off timezone (IANA)</span>
                      <input type="text" placeholder="Africa/Dar_es_Salaam" className={inputClass} value={form.submission_timezone ?? "UTC"} onChange={(event) => setForm((current) => ({ ...current, submission_timezone: event.target.value }))} />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Manager review target (hours)</span>
                      <input type="number" min={1} className={inputClass} value={form.manager_review_due_hours ?? "24"} onChange={(event) => setForm((current) => ({ ...current, manager_review_due_hours: event.target.value }))} />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Department head escalation</span>
                      <select className={inputClass} value={form.department_head_escalation_enabled ?? "false"} onChange={(event) => setForm((current) => ({ ...current, department_head_escalation_enabled: event.target.value }))}>
                        <option value="false">Disabled</option>
                        <option value="true">Enabled</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Escalate after (hours)</span>
                      <input type="number" min={1} className={inputClass} value={form.department_head_escalation_hours ?? "48"} onChange={(event) => setForm((current) => ({ ...current, department_head_escalation_hours: event.target.value }))} />
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
