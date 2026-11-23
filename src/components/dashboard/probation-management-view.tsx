"use client";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service";
import * as React from "react";
import {
  Button as FluentButton,
  Combobox,
  Field as FluentField,
  Input as FluentInput,
  Option,
  Card as FluentCard,
  ProgressBar as FluentProgressBar,
  Dialog as FluentDialog,
  DialogActions as FluentDialogActions,
  DialogBody as FluentDialogBody,
  DialogContent as FluentDialogContent,
  DialogSurface as FluentDialogSurface,
  DialogTitle as FluentDialogTitle,
  Text as FluentText,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowClockwise20Regular,
  Delete20Regular,
  Dismiss20Regular,
  Edit20Regular,
} from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/fluent-toast-store";

import { SearchToggleField } from "@/components/common/search-toggle-field";
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared";
import {
  DetailField,
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  TimelineRail,
  actionButtonClass,
  asRecord,
  asRecordArray,
  employeeLabel,
  formatDate,
  inputClass,
  isPermissionError,
  optionLabel,
  prettify,
  primaryButtonClass,
  readBoolean,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals";
import { cn } from "@/lib/utils";
import { managerRatingPayload, managerReviewCriteria } from "./probation-case";
import { policyFormValues, policyRulePayload, policyTargets, policyNumbers, policyFlags } from "./probation-policy-form";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  createProbationCase,
  createProbationObjective,
  createProbationPolicy,
  deleteProbationCase,
  deleteProbationPolicy,
  generateProbationLetter,
  getProbationCase,
  getProbationDashboard,
  getProbationPolicyOptions,
  listMyTeamProbationCases,
  listEmployees,
  listProbationCases,
  listProbationPolicies,
  submitProbationHrDecision,
  submitProbationManagerReview,
  updateProbationCase,
  updateProbationPolicy,
  type AdminRecord,
} from "@/lib/admin-api";
import {
  canAccessDashboardRoute,
  canPerformPermission,
} from "@/lib/dashboard-permissions";
import { readStoredSessionTokens } from "@/lib/session-client";
import { FluentSelect } from "@/components/ui/fluent-select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type ProbationHrTab = "overview" | "policies" | "cases" | "team";

type FormMode =
  | "policy"
  | "manager-review"
  | "hr-decision"
  | "case"
  | "case-edit"
  | "objective";

const CASE_EDITABLE_STATUSES = ["ACTIVE", "OBJECTIVES_PENDING"];

const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "intern",
  "consultant",
  "temporary",
] as const;

const MANAGER_RECOMMENDATIONS = [
  "CONFIRM",
  "EXTEND",
  "DO_NOT_CONFIRM",
  "TERMINATE",
  "FURTHER_REVIEW",
] as const;

const HR_DECISIONS = [
  "CONFIRMED",
  "EXTENDED",
  "NOT_CONFIRMED",
  "TERMINATION_RECOMMENDED",
] as const;

const CASE_CYCLE = [
  "DRAFT",
  "ACTIVE",
  "OBJECTIVES_PENDING",
  "SELF_ASSESSMENT_PENDING",
  "MANAGER_REVIEW_PENDING",
  "HR_REVIEW_PENDING",
  "EXTENDED",
  "CONFIRMED",
  "NOT_CONFIRMED",
  "TERMINATION_RECOMMENDED",
  "CANCELLED",
];

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

function caseNo(row: AdminRecord | null | undefined) {
  return readString(
    row,
    ["caseNo", "case_no", "caseNumber"],
    rowId(row) ? `Case #${rowId(row)}` : "Case",
  );
}

function probationLetterType(row: AdminRecord | null | undefined) {
  const status = readString(row, ["status"]).toUpperCase();
  const decision = readString(row, [
    "finalDecision",
    "final_decision",
  ]).toUpperCase();
  if (status === "EXTENDED" || decision === "EXTENDED") return "EXTENSION";
  if (status === "NOT_CONFIRMED" || decision === "NOT_CONFIRMED")
    return "NOT_CONFIRMED";
  return "CONFIRMATION";
}

export function ProbationManagementView({
  activeTab,
}: {
  activeTab: ProbationHrTab;
}) {
  const router = useRouter();
  const actor = useDashboardActor();
  const activeRoute =
    activeTab === "overview"
      ? "/dashboard/probation/overview"
      : activeTab === "policies"
        ? "/dashboard/probation/policies"
        : activeTab === "cases"
          ? "/dashboard/probation/cases"
          : "/dashboard/probation/team";
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute(
      activeRoute,
      actor.permissionLabels,
      actor.accessMode,
    );
  const canCreatePolicy = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_policies:create"],
    mode: "any",
  });
  const canUpdatePolicy = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_policies:update"],
    mode: "any",
  });
  const canDeletePolicy = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_policies:delete"],
    mode: "any",
  });
  const canDeleteCase = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_cases:delete"],
    mode: "any",
  });
  const canCreateCase = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_cases:create"],
    mode: "any",
  });
  const canUpdateCase = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_cases:update"],
    mode: "any",
  });
  const canCreateObjective = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_objectives:create", "probation_cases:update"],
    mode: "any",
  });
  const canManagerReview = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "probation_reviews:manager-review",
      "probation_reviews:manager-review-any",
    ],
    mode: "any",
  });
  const canHrDecision = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_reviews:hr-decision"],
    mode: "any",
  });
  const canGenerateLetter = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_letters:generate"],
    mode: "any",
  });

  const fallbackHref =
    actor.accessMode === "employee" ? "/dashboard/me/probation" : "/dashboard";

  React.useEffect(() => {
    if (!actor.ready || canAccess) return;
    router.replace(fallbackHref);
  }, [actor.ready, canAccess, fallbackHref, router]);

  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null);
  const [policies, setPolicies] = React.useState<AdminRecord[]>([]);
  const [policyOptions, setPolicyOptions] = React.useState<Awaited<ReturnType<typeof getProbationPolicyOptions>> | null>(null);
  const [cases, setCases] = React.useState<AdminRecord[]>([]);
  const [teamCases, setTeamCases] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailRecord, setDetailRecord] = React.useState<AdminRecord | null>(
    null,
  );
  const [caseOpen, setCaseOpen] = React.useState(false);
  const [caseDetail, setCaseDetail] = React.useState<AdminRecord | null>(null);
  const [caseLoading, setCaseLoading] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [criterionDialogOpen, setCriterionDialogOpen] = React.useState(false);
  const [criterionDraft, setCriterionDraft] = React.useState({
    code: "",
    name: "",
    weight: "",
    description: "",
  });
  const [criterionError, setCriterionError] = React.useState<string | null>(
    null,
  );
  const [formMode, setFormMode] = React.useState<FormMode>("policy");
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [employeeQuery, setEmployeeQuery] = React.useState("");
  const [employeeOptions, setEmployeeOptions] = React.useState<AdminRecord[]>(
    [],
  );
  const [employeeLookupLoading, setEmployeeLookupLoading] =
    React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState("");
  const [criteriaRows, setCriteriaRows] = React.useState<
    Array<{ code: string; name: string; weight: string; description: string; maximum_rating?: number; is_required?: boolean; self_rating_enabled?: boolean }>
  >([]);

  const openCriterionDialog = React.useCallback(() => {
    setCriterionDraft({ code: "", name: "", weight: "", description: "" });
    setCriterionError(null);
    setCriterionDialogOpen(true);
  }, []);

  const addCriterion = React.useCallback(() => {
    const code = criterionDraft.code.trim();
    const name = criterionDraft.name.trim();
    const weight = Number(criterionDraft.weight);
    if (!code || !name || criterionDraft.weight.trim() === "") {
      setCriterionError(
        "Enter a code, name, and weight to add this criterion.",
      );
      return;
    }
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      setCriterionError("Weight must be between 0 and 100.");
      return;
    }
    if (
      criteriaRows.some(
        (row) => row.code.trim().toLowerCase() === code.toLowerCase(),
      )
    ) {
      setCriterionError("A criterion with this code already exists.");
      return;
    }
    setCriteriaRows((current) => [
      { ...criterionDraft, code, name },
      ...current,
    ]);
    setCriterionDialogOpen(false);
  }, [criterionDraft, criteriaRows]);

  const load = React.useCallback(async () => {
    const token = readStoredToken();
    if (!token) {
      setError("Authentication required. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tasks: Array<Promise<unknown>> = [];
      if (activeTab === "overview") tasks.push(getProbationDashboard(token).then(setDashboard));
      if (activeTab === "policies") tasks.push(getProbationPolicyOptions(token).then(setPolicyOptions));
      if (canPerformPermission(actor.permissionLabels, "probation_policies:read") && activeTab !== "team") {
        tasks.push(listProbationPolicies(token).then(setPolicies));
      }
      if (activeTab === "cases" || (activeTab === "overview" && canPerformPermission(actor.permissionLabels, "probation_cases:read"))) {
        tasks.push(
          listProbationCases(token, statusFilter || undefined).then(setCases),
        );
      }
      if (activeTab === "team" || (activeTab === "overview" && canPerformPermission(actor.permissionLabels, "probation_cases:read-team"))) {
        tasks.push(
          listMyTeamProbationCases(token, statusFilter || undefined).then(
            setTeamCases,
          ),
        );
      }
      const results = await Promise.allSettled(tasks);
      const permissionFailure = results.find(
        (result) =>
          result.status === "rejected" && isPermissionError(result.reason),
      );
      const failed =
        permissionFailure ??
        results.find((result) => result.status === "rejected");
      if (failed && failed.status === "rejected") {
        setError(
          failed.reason instanceof Error
            ? failed.reason.message
            : "Could not load probation data.",
        );
      }
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load probation data.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, actor.permissionLabels]);

  React.useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  React.useEffect(() => {
    const query = employeeQuery.trim();
    if (!formOpen || formMode !== "case" || form.employee_id || !query) {
      setEmployeeOptions([]);
      setEmployeeLookupLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const token = readStoredToken();
      if (!token) return;
      setEmployeeLookupLoading(true);
      void listEmployees(
        token,
        { page: 1, limit: 20, search: query },
        { signal: controller.signal },
      )
        .then((result) => setEmployeeOptions(result.rows))
        .catch(() => {
          if (!controller.signal.aborted) setEmployeeOptions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setEmployeeLookupLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [employeeQuery, form.employee_id, formMode, formOpen]);

  const rows =
    activeTab === "policies"
      ? policies
      : activeTab === "team"
        ? teamCases
        : cases;
  const visibleRows = rows.filter((row) => {
    if (!search.trim()) return true;
    return JSON.stringify(row)
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  });

  const openCount =
    readNumber(dashboard, ["open_cases", "openCases", "in_progress"]) ??
    cases.filter(
      (row) =>
        !["CONFIRMED", "NOT_CONFIRMED", "CLOSED"].includes(
          readString(row, ["status"]).toUpperCase(),
        ),
    ).length;
  const dueSoon =
    readNumber(dashboard, [
      "due_this_week",
      "dueThisWeek",
      "due_soon",
      "dueSoon",
    ]) ?? 0;
  const confirmationRate = readNumber(dashboard, [
    "confirmation_rate",
    "confirmationRate",
    "average_score",
    "averageScore",
  ]);
  const cycleCounts = React.useMemo(
    () =>
      CASE_CYCLE.map((status) => ({
        status,
        count: cases.filter(
          (row) => readString(row, ["status"]).toUpperCase() === status,
        ).length,
      })),
    [cases],
  );

  async function openCase(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    setCaseDetail(row);
    setCaseOpen(true);
    if (!token || !id) return;
    setCaseLoading(true);
    try {
      const detail = await getProbationCase(token, id);
      if (detail) setCaseDetail(detail);
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load the case.",
      );
    } finally {
      setCaseLoading(false);
    }
  }

  function openForm(
    mode: FormMode,
    seed: Record<string, string> = {},
    criteria: Array<{
      code: string;
      name: string;
      weight: string;
      description: string;
      maximum_rating?: number;
      self_rating_enabled?: boolean;
      is_required?: boolean;
    }> = [],
  ) {
    setFormMode(mode);
    setForm(mode === "policy" && !seed.id ? { ...Object.fromEntries(Object.entries(policyOptions?.defaults ?? {}).map(([key, value]) => [key, String(value)])), ...seed } : seed);
    if (mode === "case") setEmployeeQuery("");
    setCriteriaRows(
      mode === "policy" ? criteria : [],
    );
    setFormError(null);
    setFormOpen(true);
  }

  async function onSave() {
    const token = readStoredToken();
    if (!token) {
      setFormError("Authentication required. Please log in again.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (formMode === "policy") {
        if (
          !form.code ||
          !form.name ||
          !form.probation_period_days ||
          !form.effective_from
        ) {
          throw new Error(
            "Code, name, duration, and effective from are required.",
          );
        }
        const incompleteCriterion = criteriaRows.find(
          (row) => !row.code.trim() || !row.name.trim() || !row.weight.trim(),
        );
        if (incompleteCriterion) {
          throw new Error(
            "Complete each criterion or remove the empty row before saving.",
          );
        }
        const criterionWeightTotal = criteriaRows.reduce(
          (sum, row) => sum + Number(row.weight),
          0,
        );
        if (
          criteriaRows.length > 0 &&
          Math.abs(criterionWeightTotal - 100) > 0.001
        ) {
          throw new Error(
            `Criterion weights must total 100. Current total: ${criterionWeightTotal}.`,
          );
        }
        if (
          criteriaRows.some(
            (row) =>
              !Number.isFinite(Number(row.weight)) ||
              Number(row.weight) < 0 ||
              Number(row.weight) > 100,
          )
        ) {
          throw new Error("Each criterion weight must be between 0 and 100.");
        }
        const payload = {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          employment_type: form.employment_type || null,
          probation_period_days: Number(form.probation_period_days),
          minimum_confirmation_score: form.minimum_confirmation_score
            ? Number(form.minimum_confirmation_score)
            : undefined,
          ...policyRulePayload(form),
          effective_from: form.effective_from,
          criteria: criteriaRows
            .filter((row) => row.code && row.name && row.weight)
            .map((row) => ({
              code: row.code,
              name: row.name,
              weight: Number(row.weight),
              description: row.description || undefined,
              maximum_rating: row.maximum_rating ?? 5,
              self_rating_enabled: row.self_rating_enabled ?? true,
              is_required: row.is_required ?? true,
            })),
        };
        if (form.id) {
          await updateProbationPolicy(token, form.id, payload);
        } else {
          await createProbationPolicy(token, payload);
        }
      } else if (formMode === "manager-review") {
        if (!form.case_id || !form.recommendation || !form.comments) {
          throw new Error("Recommendation and comments are required.");
        }
        await submitProbationManagerReview(token, form.case_id, {
          ratings: managerRatingPayload(caseDetail, form),
          recommendation: form.recommendation,
          comments: form.comments,
          recommended_extension_days: form.recommended_extension_days
            ? Number(form.recommended_extension_days)
            : undefined,
        });
      } else if (formMode === "hr-decision") {
        if (!form.case_id || !form.decision || !form.comments) {
          throw new Error("Decision and comments are required.");
        }
        await submitProbationHrDecision(token, form.case_id, {
          decision: form.decision,
          comments: form.comments,
          confirmation_date: form.confirmation_date || undefined,
          extension_days: form.extension_days
            ? Number(form.extension_days)
            : undefined,
          extension_end_date: form.extension_end_date || undefined,
        });
      } else if (formMode === "case") {
        if (!form.employee_id || !form.start_date) {
          throw new Error(
            "Choose an employee by number and enter a start date.",
          );
        }
        await createProbationCase(token, {
          employee_id: Number(form.employee_id),
          start_date: form.start_date,
          policy_id: form.policy_id ? Number(form.policy_id) : undefined,
        });
      } else if (formMode === "case-edit") {
        if (!form.case_id) {
          throw new Error("Missing case reference.");
        }
        await updateProbationCase(token, form.case_id, {
          start_date: form.start_date || undefined,
          current_due_date: form.current_due_date || undefined,
          policy_id: form.policy_id ? Number(form.policy_id) : undefined,
        });
      } else if (formMode === "objective") {
        if (!form.case_id || !form.title) {
          throw new Error("Objective title is required.");
        }
        await createProbationObjective(token, form.case_id, {
          title: form.title,
          description: form.description || undefined,
          expected_result: form.expected_result || undefined,
          weight: form.weight ? Number(form.weight) : undefined,
          due_date: form.due_date || undefined,
        });
      }
      toast.success("Saved.");
      setFormOpen(false);
      await load();
      if (form.case_id) {
        const detail = await getProbationCase(token, form.case_id);
        if (detail) setCaseDetail(detail);
      }
    } catch (errorObject) {
      setFormError(
        errorObject instanceof Error ? errorObject.message : "Could not save.",
      );
    } finally {
      setSaving(false);
    }
  }

  const onDeletePolicy = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken();
      const id = rowId(row);
      if (!token || !id) return;
      if (
        !(await fluentConfirm(
          `Delete policy "${optionLabel(row)}"? This cannot be undone.`,
        ))
      )
        return;
      setBusyId(`policy-${id}`);
      try {
        await deleteProbationPolicy(token, id);
        toast.success("Policy deleted.");
        await load();
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not delete the policy.",
        );
      } finally {
        setBusyId("");
      }
    },
    [load],
  );

  const onDeleteCase = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken();
      const id = rowId(row);
      if (!token || !id) return;
      if (
        !(await fluentConfirm(
          `Delete case "${caseNo(row)}"? This cannot be undone.`,
        ))
      )
        return;
      setBusyId(`case-${id}`);
      try {
        await deleteProbationCase(token, id);
        toast.success("Case deleted.");
        setCaseOpen(false);
        await load();
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not delete the case.",
        );
      } finally {
        setBusyId("");
      }
    },
    [load],
  );

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "policies") {
      return [
        {
          key: "policy",
          label: "Policy",
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
          key: "days",
          label: "Days",
          render: (row) =>
            readString(
              row,
              ["probationPeriodDays", "probation_period_days"],
              "—",
            ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => {
            const status = readString(row, ["status"], "ACTIVE");
            return (
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {prettify(status)}
              </span>
            );
          },
        },
        {
          key: "default",
          label: "Default",
          render: (row) =>
            readBoolean(row, ["isDefault", "is_default"]) ? "Yes" : "No",
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <div className="flex items-center gap-2">
              {canUpdatePolicy ? (
                <FluentButton
                  type="button"
                  appearance="subtle"
                  size="small"
                  icon={<Edit20Regular />}
                  aria-label={`Edit policy ${optionLabel(row)}`}
                  title={`Edit policy ${optionLabel(row)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    const criteria = asRecordArray(row.criteria).map(
                      (criterion) => ({
                        code: readString(criterion, ["code"]),
                        name: readString(criterion, ["name"]),
                        weight: readString(criterion, ["weight"]),
                        description: readString(criterion, ["description"]),
                        maximum_rating: readNumber(criterion, ["maximumRating", "maximum_rating"]) ?? 5,
                        is_required: readBoolean(criterion, ["isRequired", "is_required"]),
                        self_rating_enabled: readBoolean(criterion, ["selfRatingEnabled", "self_rating_enabled"]),
                      }),
                    );
                    openForm(
                      "policy",
                      {
                        id: rowId(row),
                        ...policyFormValues(row),
                        code: readString(row, ["code"]),
                        name: readString(row, ["name"]),
                        description: readString(row, ["description"]),
                        employment_type: readString(row, [
                          "employmentType",
                          "employment_type",
                        ]),
                        probation_period_days: readString(row, [
                          "probationPeriodDays",
                          "probation_period_days",
                        ]),
                        effective_from: String(
                          row.effectiveFrom ?? row.effective_from ?? "",
                        ).slice(0, 10),
                        minimum_confirmation_score: readString(row, [
                          "minimumConfirmationScore",
                          "minimum_confirmation_score",
                        ]),
                      },
                      criteria,
                    );
                  }}
                />
              ) : null}
              {canDeletePolicy ? (
                <FluentButton
                  type="button"
                  appearance="subtle"
                  size="small"
                  icon={
                    busyId === `policy-${rowId(row)}` ? (
                      <FluentLoadingIndicator className="size-4 animate-spin" />
                    ) : (
                      <Delete20Regular />
                    )
                  }
                  aria-label={`Delete policy ${optionLabel(row)}`}
                  disabled={busyId === `policy-${rowId(row)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onDeletePolicy(row);
                  }}
                ></FluentButton>
              ) : null}
            </div>
          ),
        },
      ];
    }
    return [
      {
        key: "case",
        label: "Case",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">{caseNo(row)}</p>
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
        key: "due",
        label: "Due",
        render: (row) =>
          formatDate(
            row.currentDueDate ?? row.current_due_date ?? row.originalDueDate,
          ),
      },
      {
        key: "decision",
        label: "Decision",
        render: (row) =>
          prettify(
            readString(row, ["finalDecision", "final_decision"], "Pending"),
          ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={actionButtonClass}
              onClick={(event) => {
                event.stopPropagation();
                void openCase(row);
              }}
            >
              Open
            </button>
            {canDeleteCase ? (
              <button
                type="button"
                className={cn(actionButtonClass, "text-rose-600")}
                disabled={busyId === `case-${rowId(row)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void onDeleteCase(row);
                }}
              >
                {busyId === `case-${rowId(row)}` ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : (
                  <Delete20Regular />
                )}
              </button>
            ) : null}
          </div>
        ),
      },
    ];
  }, [
    activeTab,
    canUpdatePolicy,
    canDeletePolicy,
    canDeleteCase,
    busyId,
    onDeleteCase,
    onDeletePolicy,
  ]);

  if (!canAccess) return null;

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            variant="dashboard"
            eyebrow="Probation"
            title="Probation overview"
            description="Track active cases, upcoming deadlines, policies, and your team’s cases."
            actions={
              <FluentButton
                appearance="secondary"
                icon={
                  loading ? (
                    <FluentLoadingIndicator className="size-4 animate-spin" />
                  ) : (
                    <ArrowClockwise20Regular />
                  )
                }
                onClick={() => void load()}
                disabled={loading}
              >
                Refresh
              </FluentButton>
            }
          />
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FluentCard appearance="outline" className="min-w-0 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Confirmation rate
                </p>
                <p className="text-xl font-semibold tabular-nums text-foreground">
                  {confirmationRate === null
                    ? "—"
                    : `${Math.round(confirmationRate)}%`}
                </p>
              </div>
              <FluentProgressBar
                className="mt-2"
                value={
                  confirmationRate === null
                    ? 0
                    : Math.max(0, Math.min(100, confirmationRate))
                }
                max={100}
                thickness="medium"
                aria-label="Confirmation rate"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Confirmed probation cases
              </p>
            </FluentCard>
            {[
              {
                label: "Open cases",
                value: openCount,
                hint: "Still in the cycle",
              },
              {
                label: "Due this week",
                value: dueSoon,
                hint: "Need a review now",
              },
              {
                label: "Policies",
                value: policies.length,
                hint: "Active confirmation rules",
              },
              {
                label: "My team",
                value: teamCases.length,
                hint: "Probation cases in your team",
              },
            ].map((item) => (
              <FluentCard
                key={item.label}
                appearance="outline"
                className="min-w-0 p-3"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-foreground">
                  {item.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.hint}
                </p>
              </FluentCard>
            ))}
          </div>
          <FluentCard appearance="outline" className="p-3 sm:p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-sm font-semibold">Confirmation cycle</h2>
              <p className="text-xs text-muted-foreground">
                {cases.length} total
              </p>
            </div>
            <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-1">
              {cycleCounts.map((step, index) => {
                const last = index === cycleCounts.length - 1;
                return (
                  <li
                    key={step.status}
                    className="relative flex items-start sm:min-w-0 sm:flex-1 sm:flex-col"
                  >
                    {last ? null : (
                      <span
                        className="absolute left-[17px] top-9 h-[calc(100%+0.75rem)] w-px bg-border sm:hidden"
                        aria-hidden
                      />
                    )}
                    <div className="flex items-center sm:w-full">
                      <span
                        className={cn(
                          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                          step.count > 0
                            ? last
                              ? "bg-emerald-600 text-white"
                              : "bg-primary text-white"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {step.count}
                      </span>
                      {last ? null : (
                        <span
                          className="mx-3 hidden h-px flex-1 bg-border sm:block"
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="ml-3 min-w-0 pt-1.5 sm:ml-0 sm:pt-2">
                      <p className="text-sm font-medium text-foreground">
                        {prettify(step.status)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </FluentCard>
        </>
      ) : (
        <div className="grid min-w-0 gap-3 border-b border-border/60 pb-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "policies"
                ? "Probation policies"
                : activeTab === "team"
                  ? "My team’s probation cases"
                  : "Probation cases"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {activeTab === "policies"
                ? "Duration, confirmation score, and review rules for each employment type."
                : activeTab === "team"
                  ? "Cases for employees in your team. Open a case to review its progress and submit your recommendation."
                  : "Open a case to review evidence, submit a manager recommendation, or record the HR decision."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            <FluentButton
              appearance="secondary"
              icon={
                loading ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : (
                  <ArrowClockwise20Regular />
                )
              }
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </FluentButton>
            {activeTab === "policies" && canCreatePolicy ? (
              <FluentButton
                appearance="primary"
                icon={<Add20Regular />}
                onClick={() => openForm("policy")}
              >
                New policy
              </FluentButton>
            ) : null}
            {activeTab === "cases" && canCreateCase ? (
              <FluentButton
                appearance="primary"
                icon={<Add20Regular />}
                onClick={() =>
                  openForm("case", {
                    start_date: new Date().toISOString().slice(0, 10),
                  })
                }
              >
                New case
              </FluentButton>
            ) : null}
          </div>
        </div>
      )}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SearchToggleField
              value={search}
              onChange={setSearch}
              placeholder="Search cases or policies"
            />
            <FluentSelect
              ariaLabel="Status"
              className="w-full sm:!w-56 sm:!shrink-0"
              value={statusFilter}
              placeholder="All statuses"
              onChange={setStatusFilter}
              options={[
                { value: "", label: "All statuses" },
                ...CASE_CYCLE.map((status) => ({
                  value: status,
                  label: prettify(status),
                })),
              ]}
            />
          </div>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          ) : null}
          <ResizableTable
            title="Probation records"
            data={visibleRows}
            columns={columns}
            loading={loading}
            itemsPerPage={20}
            showExport={false}
            fluent
            frameClassName="!border-0 !bg-transparent !shadow-none"
            storageKey={`probation-${activeTab}`}
            onRowSelect={(_, row) => {
              if (!row) return;
              if (activeTab === "policies") {
                setDetailRecord(row);
                setDetailOpen(true);
                return;
              }
              void openCase(row);
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

      <Sheet open={caseOpen} onOpenChange={setCaseOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{caseNo(caseDetail)}</SheetTitle>
            <SheetDescription>{employeeLabel(caseDetail)}</SheetDescription>
          </SheetHeader>
          {caseLoading ? (
            <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" />
              Loading case...
            </div>
          ) : caseDetail ? (
            <div className="space-y-4 px-1 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip
                  value={readString(caseDetail, ["status"], "OPEN")}
                />
                <StatusChip
                  value={readString(
                    caseDetail,
                    ["finalDecision", "final_decision"],
                    "Pending",
                  )}
                />
              </div>
              <TimelineRail
                items={[
                  {
                    label: "Started",
                    value: formatDate(
                      caseDetail.currentStartDate ??
                        caseDetail.current_start_date ??
                        caseDetail.originalStartDate,
                    ),
                  },
                  {
                    label: "Due",
                    value: formatDate(
                      caseDetail.currentDueDate ?? caseDetail.current_due_date,
                    ),
                    hint: `Cycle ${readString(caseDetail, ["currentCycleNumber", "current_cycle_number"], "1")}`,
                  },
                  {
                    label: "Decision",
                    value: prettify(
                      readString(
                        caseDetail,
                        ["finalDecision", "final_decision"],
                        "Pending",
                      ),
                    ),
                    hint: formatDate(
                      caseDetail.confirmationDate ??
                        caseDetail.confirmation_date,
                    ),
                  },
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField
                  label="Policy"
                  value={optionLabel(asRecord(caseDetail.policy))}
                />
                <DetailField
                  label="Extensions"
                  value={readString(
                    caseDetail,
                    ["extensionCount", "extension_count"],
                    "0",
                  )}
                />
              </div>
              {asRecordArray(caseDetail.objectives).length > 0 ? (
                <div className="rounded-xl border border-border bg-card p-3">
                  <h3 className="text-sm font-semibold">Objectives</h3>
                  <div className="mt-2 space-y-2">
                    {asRecordArray(caseDetail.objectives).map((objective) => (
                      <div
                        key={rowId(objective)}
                        className="rounded-lg bg-muted/40 px-3 py-2"
                      >
                        <p className="text-sm font-medium">
                          {readString(objective, ["title", "name"])}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {prettify(
                            readString(objective, ["status"], "NOT_STARTED"),
                          )}{" "}
                          ·{" "}
                          {readString(
                            objective,
                            [
                              "employeeCompletionPercent",
                              "employee_completion_percent",
                            ],
                            "0",
                          )}
                          %
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <SheetFooter className="gap-2">
            {canUpdateCase &&
            caseDetail &&
            CASE_EDITABLE_STATUSES.includes(
              readString(caseDetail, ["status"]).toUpperCase(),
            ) ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  openForm("case-edit", {
                    case_id: rowId(caseDetail),
                    start_date: String(
                      caseDetail.currentStartDate ??
                        caseDetail.current_start_date ??
                        "",
                    ).slice(0, 10),
                    current_due_date: String(
                      caseDetail.currentDueDate ??
                        caseDetail.current_due_date ??
                        "",
                    ).slice(0, 10),
                    policy_id: readString(caseDetail, [
                      "policyId",
                      "policy_id",
                    ]),
                  })
                }
              >
                Edit case
              </button>
            ) : null}
            {canCreateObjective &&
            caseDetail &&
            CASE_EDITABLE_STATUSES.includes(
              readString(caseDetail, ["status"]).toUpperCase(),
            ) ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  openForm("objective", {
                    case_id: rowId(caseDetail),
                    due_date: String(
                      caseDetail.currentDueDate ??
                        caseDetail.current_due_date ??
                        "",
                    ).slice(0, 10),
                  })
                }
              >
                Add objective
              </button>
            ) : null}
            {canManagerReview &&
            caseDetail &&
            readString(caseDetail, ["status"]).toUpperCase() ===
              "MANAGER_REVIEW_PENDING" ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  openForm("manager-review", {
                    case_id: rowId(caseDetail),
                    recommendation: "CONFIRM",
                  })
                }
              >
                Manager review
              </button>
            ) : null}
            {canHrDecision &&
            caseDetail &&
            readString(caseDetail, ["status"]).toUpperCase() ===
              "HR_REVIEW_PENDING" ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  openForm("hr-decision", {
                    case_id: rowId(caseDetail),
                    decision: "CONFIRMED",
                  })
                }
              >
                HR decision
              </button>
            ) : null}
            {canDeleteCase ? (
              <button
                type="button"
                className={cn(secondaryButtonClass, "text-rose-600")}
                disabled={busyId === `case-${rowId(caseDetail)}`}
                onClick={() => {
                  if (!caseDetail) return;
                  void onDeleteCase(caseDetail);
                }}
              >
                {busyId === `case-${rowId(caseDetail)}` ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : (
                  "Delete case"
                )}
              </button>
            ) : null}
            {canGenerateLetter ? (
              <button
                type="button"
                className={primaryButtonClass}
                disabled={busyId === "letter"}
                onClick={() => {
                  const token = readStoredToken();
                  const id = rowId(caseDetail);
                  if (!token || !id) return;
                  setBusyId("letter");
                  void generateProbationLetter(
                    token,
                    id,
                    probationLetterType(caseDetail),
                  )
                    .then(() => toast.success("Letter generated."))
                    .catch((errorObject) =>
                      toast.error(
                        errorObject instanceof Error
                          ? errorObject.message
                          : "Could not generate the letter.",
                      ),
                    )
                    .finally(() => setBusyId(""));
                }}
              >
                {busyId === "letter" ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : (
                  "Generate letter"
                )}
              </button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <FluentDialog
        open={formOpen}
        onOpenChange={(_event, data) => setFormOpen(data.open)}
      >
        <FluentDialogSurface className="w-[min(640px,96vw)]">
          <FluentDialogBody className="min-h-0">
            <FluentDialogTitle
              action={
                <FluentButton
                  appearance="subtle"
                  icon={<Dismiss20Regular />}
                  aria-label="Close probation form"
                  onClick={() => setFormOpen(false)}
                />
              }
            >
              {formMode === "policy"
                ? form.id
                  ? "Update policy"
                  : "New policy"
                : formMode === "manager-review"
                  ? "Manager review"
                  : formMode === "hr-decision"
                    ? "HR decision"
                    : formMode === "objective"
                      ? "New objective"
                      : formMode === "case"
                        ? "New probation case"
                        : "Edit probation case"}
            </FluentDialogTitle>
            <FluentText as="p" size={300} className="text-muted-foreground">
              Save the details for this probation record.
            </FluentText>
            <FluentDialogContent className="grid max-h-[65vh] min-h-0 gap-3 overflow-y-auto pr-1">
              {formMode === "policy" ? (
                <>
                  <FluentField label="Code" required>
                    <FluentInput
                      value={form.code ?? ""}
                      onChange={(_event, data) =>
                        setForm((current) => ({ ...current, code: data.value }))
                      }
                      className="!w-full"
                    />
                  </FluentField>
                  <FluentField label="Name" required>
                    <FluentInput
                      value={form.name ?? ""}
                      onChange={(_event, data) =>
                        setForm((current) => ({ ...current, name: data.value }))
                      }
                      className="!w-full"
                    />
                  </FluentField>
                  <FluentField label="Description">
                    <Textarea
                      value={form.description ?? ""}
                      onChange={(_event, data) =>
                        setForm((current) => ({
                          ...current,
                          description: data.value,
                        }))
                      }
                    />
                  </FluentField>
                  <Field label="Employment type">
                    <FluentSelect
                      ariaLabel="Employment type"
                      className="w-full"
                      value={form.employment_type ?? ""}
                      placeholder="Any"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          employment_type: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Any" },
                        ...EMPLOYMENT_TYPES.map((item) => ({
                          value: item,
                          label: prettify(item),
                        })),
                      ]}
                    />
                  </Field>
                  <FluentField label="Probation days" required>
                    <FluentInput
                      type="number"
                      min={1}
                      step={1}
                      value={form.probation_period_days ?? ""}
                      onChange={(_event, data) =>
                        setForm((current) => ({
                          ...current,
                          probation_period_days: data.value,
                        }))
                      }
                      className="!w-full"
                    />
                  </FluentField>
                  {policyTargets.map(([key, label]) => (
                    <FluentField key={key} label={label}>
                      <FluentSelect ariaLabel={label} value={form[key] ?? ""} onChange={value => setForm(current => ({ ...current, [key]: value }))}
                        options={[{ value: "", label: "Any" }, ...(form[key] && !policyOptions?.targets[key]?.some(item => String(item.id) === form[key]) ? [{ value: form[key], label: `Current selection (#${form[key]})` }] : []), ...(policyOptions?.targets[key] ?? []).map(item => ({ value: String(item.id), label: item.name }))]} />
                    </FluentField>
                  ))}
                  {policyNumbers.map(([key, label, min]) => (
                    <FluentField key={key} label={label}>
                      <FluentInput type="number" step={1} min={min} value={form[key] ?? ""} onChange={(_, data) => setForm(current => ({ ...current, [key]: data.value }))} />
                    </FluentField>
                  ))}
                  {policyFlags.map(([key, label, fallback]) => (
                    <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={(form[key] ?? String(fallback)) === "true"}
                      onChange={event => setForm({ ...form, [key]: String(event.target.checked) })} />{label}</label>
                  ))}
                  <FluentField label="Effective to">
                    <FluentInput type="date" min={form.effective_from} value={form.effective_to ?? ""} onChange={(_, data) => setForm(current => ({ ...current, effective_to: data.value }))} />
                  </FluentField>
                  {policyOptions?.defaults && <p className="text-sm text-muted-foreground">Company policies use the installation limit of {policyOptions.defaults.maximum_total_days} total days. Reminder days before the due date: {policyOptions.defaults.reminder_days.join(", ")}.</p>}
                  <FluentField label="Minimum score">
                    <FluentInput
                      type="number"
                      min={0}
                      value={form.minimum_confirmation_score ?? ""}
                      onChange={(_event, data) =>
                        setForm((current) => ({
                          ...current,
                          minimum_confirmation_score: data.value,
                        }))
                      }
                      className="!w-full"
                    />
                  </FluentField>
                  <FluentField label="Effective from" required>
                    <FluentInput
                      type="date"
                      value={form.effective_from ?? ""}
                      onChange={(_event, data) =>
                        setForm((current) => ({
                          ...current,
                          effective_from: data.value,
                        }))
                      }
                      className="!w-full"
                    />
                  </FluentField>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        Criteria (weights must total 100)
                      </span>
                      <FluentButton
                        type="button"
                        appearance="secondary"
                        size="small"
                        icon={<Add20Regular />}
                        onClick={openCriterionDialog}
                      >
                        Add criterion
                      </FluentButton>
                    </div>
                    {criteriaRows.map((row, index) => (
                      <div
                        key={index}
                        className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_90px_auto]"
                      >
                        <FluentInput
                          aria-label={`Criterion ${index + 1} code`}
                          placeholder="Code"
                          value={row.code}
                          onChange={(_event, data) =>
                            setCriteriaRows((current) =>
                              current.map((item, i) =>
                                i === index
                                  ? { ...item, code: data.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <FluentInput
                          aria-label={`Criterion ${index + 1} name`}
                          placeholder="Name"
                          value={row.name}
                          onChange={(_event, data) =>
                            setCriteriaRows((current) =>
                              current.map((item, i) =>
                                i === index
                                  ? { ...item, name: data.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <FluentInput
                          aria-label={`Criterion ${index + 1} weight`}
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Weight"
                          value={row.weight}
                          onChange={(_event, data) =>
                            setCriteriaRows((current) =>
                              current.map((item, i) =>
                                i === index
                                  ? { ...item, weight: data.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <FluentButton
                          type="button"
                          appearance="subtle"
                          size="small"
                          icon={<Delete20Regular />}
                          aria-label={`Remove criterion ${index + 1}`}
                          onClick={() =>
                            setCriteriaRows((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                        />
                        <FluentInput
                          aria-label={`Criterion ${index + 1} description`}
                          className="sm:col-span-4"
                          placeholder="Description (optional)"
                          value={row.description}
                          onChange={(_event, data) =>
                            setCriteriaRows((current) =>
                              current.map((item, i) =>
                                i === index
                                  ? { ...item, description: data.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Current total:{" "}
                      {criteriaRows.reduce(
                        (sum, row) => sum + (Number(row.weight) || 0),
                        0,
                      )}
                    </p>
                  </div>
                </>
              ) : null}
              {formMode === "manager-review" ? (
                <>
                  {managerReviewCriteria(caseDetail).map(({ code, name, maximum }) => (
                    <div key={code} className="grid gap-2">
                      <FluentField label={`${name} rating (0–${maximum})`} required>
                        <FluentInput type="number" min={0} max={maximum} step="any" value={form[`rating_${code}`] ?? ""} onChange={(_, data) => setForm(current => ({ ...current, [`rating_${code}`]: data.value }))} />
                      </FluentField>
                      <FluentField label={`${name} comment`}><FluentInput maxLength={2000} value={form[`comment_${code}`] ?? ""} onChange={(_, data) => setForm(current => ({ ...current, [`comment_${code}`]: data.value }))} /></FluentField>
                    </div>
                  ))}
                  {form.recommendation === "FURTHER_REVIEW" && <p className="text-sm">HR will receive this case for a decision. Explain the points that need review in Comments.</p>}
                  <Field label="Recommendation">
                    <FluentSelect
                      ariaLabel="Recommendation"
                      className="w-full"
                      value={form.recommendation ?? "CONFIRM"}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          recommendation: value,
                        }))
                      }
                      options={MANAGER_RECOMMENDATIONS.map((item) => ({
                        value: item,
                        label: prettify(item),
                      }))}
                    />
                  </Field>
                  <Field label="Comments">
                    <Textarea
                      aria-label="Manager review comments"
                      className={textareaClass}
                      value={form.comments ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          comments: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Extension days">
                    <input
                      className={inputClass}
                      value={form.recommended_extension_days ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          recommended_extension_days: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {formMode === "hr-decision" ? (
                <>
                  <Field label="Decision">
                    <FluentSelect
                      ariaLabel="Decision"
                      className="w-full"
                      value={form.decision ?? "CONFIRMED"}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, decision: value }))
                      }
                      options={HR_DECISIONS.map((item) => ({
                        value: item,
                        label: prettify(item),
                      }))}
                    />
                  </Field>
                  <Field label="Comments">
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
                  </Field>
                  <Field label="Confirmation date">
                    <DateInput
                      className={inputClass}
                      value={form.confirmation_date ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          confirmation_date: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Extension days">
                    <input
                      className={inputClass}
                      value={form.extension_days ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          extension_days: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
              {formMode === "case" ? (
                <>
                  <FluentField label="Employee number" required>
                    <Combobox
                      aria-label="Employee number"
                      placeholder="Search by employee number or name"
                      value={employeeQuery}
                      selectedOptions={
                        form.employee_id ? [form.employee_id] : []
                      }
                      onChange={(event) => {
                        setEmployeeQuery(event.target.value);
                        setForm((current) => ({ ...current, employee_id: "" }));
                      }}
                      onOptionSelect={(_event, data) => {
                        const selectedId = data.optionValue;
                        if (!selectedId) return;
                        const selected = employeeOptions.find(
                          (employee) =>
                            String(
                              readNumber(employee, [
                                "id",
                                "employee_id",
                                "employeeId",
                              ]) ?? rowId(employee),
                            ) === selectedId,
                        );
                        if (!selected) return;
                        const employeeNumber = readString(selected, [
                          "employee_no",
                          "employee_number",
                          "employeeNumber",
                          "employeeNo",
                        ]);
                        setForm((current) => ({
                          ...current,
                          employee_id: selectedId,
                        }));
                        setEmployeeQuery(
                          `${employeeNumber || `Employee #${selectedId}`} · ${employeeLabel(selected)}`,
                        );
                      }}
                      className="!w-full"
                    >
                      {employeeLookupLoading ? (
                        <Option
                          value="searching"
                          text="Searching employees…"
                          disabled
                        >
                          Searching employees…
                        </Option>
                      ) : employeeOptions.length > 0 ? (
                        employeeOptions.map((employee) => {
                          const employeeId = String(
                            readNumber(employee, [
                              "id",
                              "employee_id",
                              "employeeId",
                            ]) ?? rowId(employee),
                          );
                          const employeeNumber = readString(employee, [
                            "employee_no",
                            "employee_number",
                            "employeeNumber",
                            "employeeNo",
                          ]);
                          const name = employeeLabel(employee);
                          return (
                            <Option
                              key={employeeId}
                              value={employeeId}
                              text={`${employeeNumber || `Employee #${employeeId}`} · ${name}`}
                            >
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate font-medium">
                                  {employeeNumber || `Employee #${employeeId}`}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {name}
                                </span>
                              </span>
                            </Option>
                          );
                        })
                      ) : employeeQuery.trim() ? (
                        <Option
                          value="no-matches"
                          text="No employees found"
                          disabled
                        >
                          No employees found
                        </Option>
                      ) : null}
                    </Combobox>
                  </FluentField>
                  <FluentField label="Start date" required>
                    <FluentInput
                      type="date"
                      value={form.start_date ?? ""}
                      onChange={(_event, data) =>
                        setForm((current) => ({
                          ...current,
                          start_date: data.value,
                        }))
                      }
                      className="!w-full"
                    />
                  </FluentField>
                  <Field label="Policy (optional)">
                    <FluentSelect
                      ariaLabel="Policy"
                      className="w-full"
                      value={form.policy_id ?? ""}
                      placeholder="Auto-resolve"
                      onChange={(value) =>
                        setForm((current) => ({ ...current, policy_id: value }))
                      }
                      options={[
                        { value: "", label: "Auto-resolve" },
                        ...policies.map((policy) => ({
                          value: rowId(policy),
                          label: optionLabel(policy),
                        })),
                      ]}
                    />
                  </Field>
                </>
              ) : null}
              {formMode === "case-edit" ? (
                <>
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
                  <Field label="Due date">
                    <DateInput
                      className={inputClass}
                      value={form.current_due_date ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          current_due_date: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Policy">
                    <FluentSelect
                      ariaLabel="Policy"
                      className="w-full"
                      value={form.policy_id ?? ""}
                      placeholder="Keep current"
                      onChange={(value) =>
                        setForm((current) => ({ ...current, policy_id: value }))
                      }
                      options={[
                        { value: "", label: "Keep current" },
                        ...policies.map((policy) => ({
                          value: rowId(policy),
                          label: optionLabel(policy),
                        })),
                      ]}
                    />
                  </Field>
                </>
              ) : null}
              {formMode === "objective" ? (
                <>
                  <Field label="Title">
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
                  <Field label="Expected result">
                    <Textarea
                      className={textareaClass}
                      value={form.expected_result ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          expected_result: event.target.value,
                        }))
                      }
                    />
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
                </>
              ) : null}
              {formError ? (
                <p className="text-sm text-rose-600">{formError}</p>
              ) : null}
            </FluentDialogContent>
            <FluentDialogActions position="end">
              <FluentButton
                appearance="secondary"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancel
              </FluentButton>
              <FluentButton
                appearance="primary"
                onClick={() => void onSave()}
                disabled={saving}
              >
                {saving ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </FluentButton>
            </FluentDialogActions>
          </FluentDialogBody>
        </FluentDialogSurface>
      </FluentDialog>
      <FluentDialog
        open={criterionDialogOpen}
        onOpenChange={(_event, data) => setCriterionDialogOpen(data.open)}
      >
        <FluentDialogSurface className="w-[min(480px,96vw)]">
          <FluentDialogBody>
            <FluentDialogTitle
              action={
                <FluentButton
                  appearance="subtle"
                  icon={<Dismiss20Regular />}
                  aria-label="Close add criterion dialog"
                  onClick={() => setCriterionDialogOpen(false)}
                />
              }
            >
              Add criterion
            </FluentDialogTitle>
            <FluentText as="p" size={300} className="text-muted-foreground">
              Add a weighted measure to this probation policy.
            </FluentText>
            <FluentDialogContent className="grid gap-3">
              <FluentField label="Code" required>
                <FluentInput
                  autoFocus
                  value={criterionDraft.code}
                  onChange={(_event, data) =>
                    setCriterionDraft((current) => ({
                      ...current,
                      code: data.value,
                    }))
                  }
                  className="!w-full"
                />
              </FluentField>
              <FluentField label="Name" required>
                <FluentInput
                  value={criterionDraft.name}
                  onChange={(_event, data) =>
                    setCriterionDraft((current) => ({
                      ...current,
                      name: data.value,
                    }))
                  }
                  className="!w-full"
                />
              </FluentField>
              <FluentField label="Weight" required>
                <FluentInput
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={criterionDraft.weight}
                  onChange={(_event, data) =>
                    setCriterionDraft((current) => ({
                      ...current,
                      weight: data.value,
                    }))
                  }
                  className="!w-full"
                />
              </FluentField>
              <FluentField label="Description">
                <FluentInput
                  value={criterionDraft.description}
                  onChange={(_event, data) =>
                    setCriterionDraft((current) => ({
                      ...current,
                      description: data.value,
                    }))
                  }
                  className="!w-full"
                />
              </FluentField>
              {criterionError ? (
                <p role="alert" className="text-sm text-destructive">
                  {criterionError}
                </p>
              ) : null}
            </FluentDialogContent>
            <FluentDialogActions position="end">
              <FluentButton
                appearance="secondary"
                onClick={() => setCriterionDialogOpen(false)}
              >
                Cancel
              </FluentButton>
              <FluentButton
                appearance="primary"
                icon={<Add20Regular />}
                onClick={addCriterion}
              >
                Add criterion
              </FluentButton>
            </FluentDialogActions>
          </FluentDialogBody>
        </FluentDialogSurface>
      </FluentDialog>
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
