"use client";

import quickLinkStyles from "./performance-quick-links.module.css";
import periodActionStyles from "./performance-period-actions.module.css";
import { KpiCategoriesFlyout } from "./kpi-categories-flyout";
import { KpiCategorySelect } from "./kpi-category-select";
import { KpiImportPanel } from "./kpi-import-panel";
import {
  fluentConfirm,
  fluentPrompt,
} from "@/components/ui/fluent-dialog-service";
import {
  cleanKpiCategory,
  collectKpiCategories,
  resolveKpiCategory,
} from "@/lib/kpi-categories";
import tableStyles from "./performance-records-table.module.css";
import reportTableStyles from "./performance-reports-table.module.css";
import planTableStyles from "./performance-plans-table.module.css";
import { PerformanceWorkflowHelp } from "@/components/dashboard/performance-workflow-help";
import { PerformanceSetupWizard } from "@/components/dashboard/performance-setup-wizard";
import {
  PERFORMANCE_SETUP_STEPS,
  PerformanceSetupStepSchema,
  getPerformanceSetupStep,
  type PerformanceSetupStepKey,
  type PerformanceSetupCounts,
} from "@/lib/performance-setup-wizard";
import { WorkflowGuide } from "@/components/dashboard/workflow-guide";
import { ValidatedWorkflowForm } from "@/components/dashboard/validated-workflow-form";
import { performanceFormSchema } from "@/lib/workflow-schemas";
import { workflowFailure } from "@/lib/workflow-error";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Card,
  Text,
  Tooltip,
  InfoButton,
  tokens,
  Button as FluentButton,
  Input,
  ProgressBar,
  Checkbox,
  Textarea,
  Field as FluentField,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
} from "@fluentui/react-components";
import {
  Add20Regular as PlusIcon,
  Dismiss20Regular,
  ArrowClockwise20Regular as RefreshCwIcon,
} from "@fluentui/react-icons";
import {
  Settings20Regular,
  PeopleTeam20Regular,
  ChartMultiple20Regular,
  ArrowRight20Regular,
  LockClosed20Regular,
  PersonAdd20Regular,
  ArrowSync20Regular,
  Play20Regular,
  Edit20Regular,
  Copy20Regular,
  Archive20Regular,
  Folder20Regular,
  LockOpen20Regular,
  Info16Regular,
  CalendarLtr20Regular as CalendarIcon,
  CheckmarkCircle20Regular as CompletedIcon,
  Clock20Regular as PendingIcon,
  Gauge20Regular as ScoreIcon,
  SearchSparkle20Regular as SearchIcon,
  ArrowDownload20Regular,
  DocumentPdf20Regular,
  TableSimple20Regular,
  Eye20Regular,
} from "@fluentui/react-icons";
import { toast } from "@/components/ui/fluent-toast-store";

import { SearchToggleField } from "@/components/common/search-toggle-field";
import { KpiRecordDetails } from "@/components/dashboard/kpi-record-details";
import { FluentRecordDetailsDialog as RecordDetailsDialog } from "@/components/dashboard/fluent-record-details-dialog";
import { PerformanceGuidedSetupDialog } from "@/components/dashboard/performance-guided-setup-dialog";
import {
  asRecord,
  asRecordArray,
  employeeLabel,
  formatDate,
  inputClass,
  optionLabel,
  prettify,
  readNumber,
  readString,
  rowId,
} from "@/components/dashboard/talent-visuals";

import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  activatePerformancePeriod,
  approvePerformanceReview,
  calculatePerformanceAggregates,
  publishPerformanceAggregates,
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
  listPerformanceKpiCategories,
  createPerformanceKpiCategory,
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

export type PerformanceHrTab =
  | "overview"
  | "setup"
  | "plans"
  | "development"
  | "reviews"
  | "improvement"
  | "reports"
  | "calibration";

type SetupTab = PerformanceSetupStepKey;

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

const AGGREGATION_METHODS = ["SIMPLE_MONTHLY_AVERAGE"] as const;

const AGGREGATION_HELP: Record<string, string> = {
  "": "Uses Simple Monthly Average. Only published monthly reviews with a score count; missing scores are excluded.",
  SIMPLE_MONTHLY_AVERAGE:
    "Each published monthly review with a score counts equally. Months without a scored published review are excluded.",
  WEIGHTED_MONTHLY_AVERAGE:
    'Uses monthly_weights keyed by period sequence, for example {"monthly_weights":{"1":1,"2":1.5}}. Unspecified months use weight 1; zero excludes a month.',
  QUARTERLY_ROLLUP:
    "Averages available published quarter aggregates equally. If none exist, it falls back to the scored monthly reviews.",
  ANNUAL_TARGET_ACHIEVEMENT:
    'Converts the mean monthly score to target attainment: mean score ÷ annual_target_score × 100, capped at annual_target_cap (default 120). Example: {"annual_target_score":100,"annual_target_cap":120}.',
  MONTHLY_AVERAGE_WITH_ADJUSTMENTS:
    "Averages published monthly final scores. Scorecard adjustments are already included in each final score and are counted once.",
};

const KPI_FIELD_HELP: Record<string, string> = {
  KPI: "Choose the KPI you want to create a new version of. Existing versions remain available for records that already use them.",
  Code: "A short identifier, such as SALES_TOTAL or ON_TIME_TASKS. Use a distinct code when creating a new KPI.",
  Name: "A clear name for what you measure, such as Monthly sales or Tasks completed on time.",
  Category:
    "Choose Delivery, Quality, or another category. Use Add category to create one separately, or type a new name to save it with the KPI. Category is optional.",
  Description:
    "Explain what counts toward this KPI and how employees or managers should record the result.",
  Unit: "The unit used for the target and result, such as percent, hours, items, or currency. Use the same unit for both.",
  Direction:
    "Choose what a good result looks like. Higher is better for sales; lower is better for errors. Target match aims for a specific value, range aims for acceptable limits, binary is yes/no, and manual rating uses a human assessment.",
  Formula:
    "Choose how results become scores. Percent to target compares the result with the target: 80 out of 100 gives 80%. Use inverse percent when lower results are better, or choose the matching range, yes/no, or manual-rating formula.",
  "Data source":
    "Choose where results come from. Manual employee or manager means a person enters them. Attendance, leave, activities, and field visits use recorded system data when you update KPI values. Other sources require their corresponding integration or import.",
  "Default target":
    "The usual goal in the chosen unit, such as 100 items or 95 percent. Employee plans can provide their own target.",
  Frequency:
    "How often this KPI is measured: monthly, every three months, every six months, or annually.",
};

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
  "FILE_IMPORT",
] as const;

const UNAVAILABLE_DATA_SOURCES = [
  "EXTERNAL_API",
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

function parseAnnualAggregationConfiguration(
  raw: string | undefined,
): Record<string, unknown> | undefined {
  if (!raw?.trim()) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Aggregation configuration must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Aggregation configuration must be a JSON object.");
  }
  return value as Record<string, unknown>;
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
  const canManageKpiImports = canPerformPermission(actor.permissionLabels, {
    permissions: ["performance_kpi_imports:manage"],
  });
  const canPublishAggregates = canPerformPermission(actor.permissionLabels, {
    permissions: ["performance_aggregates:publish"],
  });
  const canApproveKpiImports = canPerformPermission(actor.permissionLabels, {
    permissions: ["performance_kpi_imports:approve"],
  });
  const canReadKpiImports = canPerformPermission(actor.permissionLabels, {
    permissions: ["performance_kpi_imports:read"],
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

  const [setupKpiCategory, setSetupKpiCategory] = React.useState("");
  const [setupFinancialYearId, setSetupFinancialYearId] = React.useState("");
  const [setupTab, setSetupTab] = React.useState<SetupTab>("years");
  const [guidedSetupOpen, setGuidedSetupOpen] = React.useState(false);
  const [setupCounts, setSetupCounts] = React.useState<PerformanceSetupCounts>(
    {},
  );
  const [skippedSetupSteps, setSkippedSetupSteps] = React.useState<SetupTab[]>(
    [],
  );
  const [savedSetupStep, setSavedSetupStep] = React.useState<SetupTab | null>(
    null,
  );
  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null);
  const [managerSummary, setManagerSummary] =
    React.useState<AdminRecord | null>(null);
  const [years, setYears] = React.useState<AdminRecord[]>([]);
  const [periods, setPeriods] = React.useState<AdminRecord[]>([]);
  const [categoryFlyoutOpen, setCategoryFlyoutOpen] = React.useState(false);
  const [categoryCatalog, setCategoryCatalog] = React.useState<string[]>([]);
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
    Record<
      string,
      { assignments?: number; synced?: number; lastAction?: "assign" | "sync" }
    >
  >({});
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [scorecardComponents, setScorecardComponents] = React.useState<
    ScorecardComponentDraft[]
  >(DEFAULT_SCORECARD_COMPONENTS);
  const [workflowSteps, setWorkflowSteps] = React.useState<WorkflowStepDraft[]>(
    DEFAULT_WORKFLOW_STEPS,
  );

  const { begin, invalidate, credential, identityVersion } = useWorkflowRequest(
    `${activeTab}:${setupTab}:${calibrationComparison}`,
  );

  React.useEffect(() => {
    setSetupCounts({});
    setCategoryCatalog([]);
    setCategoryFlyoutOpen(false);
    setSetupFinancialYearId("");
    setSetupKpiCategory("");
    setSkippedSetupSteps([]);
    setSavedSetupStep(null);
  }, [identityVersion]);

  React.useEffect(() => {
    if (activeTab !== "setup") return;
    const restoreStep = () => {
      const requested = PerformanceSetupStepSchema.safeParse(
        new URL(window.location.href).searchParams.get("step"),
      );
      if (requested.success) setSetupTab(requested.data);
      setCategoryFlyoutOpen(
        new URL(window.location.href).searchParams.get("categories") === "1",
      );
    };
    restoreStep();
    window.addEventListener("popstate", restoreStep);
    return () => window.removeEventListener("popstate", restoreStep);
  }, [activeTab]);

  const changeSetupStep = React.useCallback((next: SetupTab) => {
    setSetupTab(next);
    setSearch("");
    setSavedSetupStep(null);
    const url = new URL(window.location.href);
    url.searchParams.set("step", next);
    window.history.replaceState(null, "", url);
  }, []);

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
          commit(() =>
            setSetupCounts((current) => ({
              ...current,
              years: loadedValue1.length,
            })),
          );
        } else if (setupTab === "periods") {
          const [periodRows, yearRows] = await Promise.all([
            listPerformancePeriods(token),
            listPerformanceFinancialYears(token),
          ]);
          commit(() => setPeriods(periodRows));
          commit(() =>
            setSetupCounts((current) => ({
              ...current,
              periods: periodRows.length,
            })),
          );
          commit(() => setYears(yearRows));
        } else if (setupTab === "kpis") {
          const [loadedValue2, loadedCategories] = await Promise.all([
            listPerformanceKpis(token),
            listPerformanceKpiCategories(token),
          ]);
          commit(() =>
            setCategoryCatalog(
              loadedCategories.map((category) => category.name),
            ),
          );
          commit(() => setKpis(loadedValue2));
          commit(() =>
            setSetupCounts((current) => ({
              ...current,
              kpis: loadedValue2.length,
            })),
          );
        } else if (setupTab === "templates") {
          const [templateRows, kpiRows, periodRows, rolePage] =
            await Promise.all([
              listPerformanceKpiTemplates(token),
              listPerformanceKpis(token),
              listPerformancePeriods(token),
              listRolesCatalog(token),
            ]);
          commit(() => setTemplates(templateRows));
          commit(() =>
            setSetupCounts((current) => ({
              ...current,
              templates: templateRows.length,
            })),
          );
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
          commit(() =>
            setSetupCounts((current) => ({
              ...current,
              rules: ruleRows.length,
            })),
          );
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
          commit(() =>
            setSetupCounts((current) => ({
              ...current,
              competencies: loadedValue3.length,
            })),
          );
        } else if (setupTab === "scales") {
          const loadedValue4 = await listPerformanceRatingScales(token);
          commit(() => setScales(loadedValue4));
          commit(() =>
            setSetupCounts((current) => ({
              ...current,
              scales: loadedValue4.length,
            })),
          );
        } else if (setupTab === "scorecards") {
          const loadedValue5 = await listPerformanceScorecards(token);
          commit(() => setScorecards(loadedValue5));
          commit(() =>
            setSetupCounts((current) => ({
              ...current,
              scorecards: loadedValue5.length,
            })),
          );
        } else if (setupTab === "workflows") {
          const loadedValue6 = await listPerformanceWorkflows(token);
          commit(() => setWorkflows(loadedValue6));
          commit(() =>
            setSetupCounts((current) => ({
              ...current,
              workflows: loadedValue6.length,
            })),
          );
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
  const kpiCategories = React.useMemo(
    () =>
      collectKpiCategories([
        ...categoryCatalog,
        ...kpis.map((kpi) => readString(kpi, ["category"])),
      ]),
    [categoryCatalog, kpis],
  );

  const selectedYearPeriods = periods.filter(
    (row) =>
      !setupFinancialYearId ||
      readString(row, ["financialYearId", "financial_year_id"]) ===
        setupFinancialYearId,
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
    return source.filter(
      (row) =>
        matchesSearch(row, search) &&
        (activeTab !== "setup" ||
          setupTab !== "kpis" ||
          !setupKpiCategory ||
          (setupKpiCategory === "__uncategorized__"
            ? !cleanKpiCategory(readString(row, ["category"]))
            : cleanKpiCategory(readString(row, ["category"])).toLocaleLowerCase(
                "en",
              ) === setupKpiCategory.toLocaleLowerCase("en"))) &&
        (activeTab !== "setup" ||
          setupTab !== "periods" ||
          !setupFinancialYearId ||
          readString(row, ["financialYearId", "financial_year_id"]) ===
            setupFinancialYearId),
    );
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
    setupFinancialYearId,
    setupKpiCategory,
    templates,
    workflows,
    years,
  ]);

  function openCreate(mode: CreateMode, seed: Record<string, string> = {}) {
    setDetailOpen(false);
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

  function setupCreateBlocked(target: SetupTab) {
    if (target === "periods" && years.length === 0) {
      return "Create a financial year in step 1 before creating review periods.";
    }
    if (["templates", "rules"].includes(target) && kpis.length === 0) {
      return "Create a KPI definition in step 3 before choosing its version here.";
    }
    if (target === "templates" && templateRoles.length === 0) {
      return "Create an applicable role in Access Governance before creating a role-based KPI template.";
    }
    return null;
  }

  function startSetupCreation(target: SetupTab) {
    changeSetupStep(target);
    openCreate(
      getPerformanceSetupStep(target).createMode,
      target === "periods" && (setupFinancialYearId || years.length === 1)
        ? { financial_year_id: setupFinancialYearId || rowId(years[0]) }
        : {},
    );
  }

  function skipSetupStep(target: SetupTab) {
    if (!getPerformanceSetupStep(target).optional) return;
    setSkippedSetupSteps((current) => [...new Set([...current, target])]);
    const next =
      PERFORMANCE_SETUP_STEPS[
        PERFORMANCE_SETUP_STEPS.findIndex((item) => item.key === target) + 1
      ];
    if (next) changeSetupStep(next.key);
  }

  function configuredSetupItems(target: SetupTab) {
    const rowsByStep: Record<SetupTab, AdminRecord[]> = {
      years,
      periods: setupFinancialYearId ? selectedYearPeriods : periods,
      kpis,
      templates,
      rules,
      competencies,
      scales,
      scorecards,
      workflows,
    };
    const rows = rowsByStep[target] ?? [];
    return rows.slice(0, 3).map((row) => optionLabel(row));
  }

  const calculateAggregatesForYear = React.useCallback(
    async (yearId: string, periodType: "QUARTERLY" | "ANNUAL") => {
      const token = readStoredToken();
      if (!token) return;
      const actionId = `agg-${periodType}-${yearId}`;
      setBusyId(actionId);
      try {
        const result = asRecord(
          await calculatePerformanceAggregates(token, yearId, periodType),
        );
        const count = readNumber(result, ["aggregate_count"]) ?? 0;
        const skippedPeriods =
          readNumber(result, ["skipped_period_count"]) ?? 0;
        const skippedReviews =
          readNumber(result, ["skipped_review_count"]) ?? 0;
        const summary =
          periodType === "QUARTERLY"
            ? `${count} draft aggregate(s), ${skippedPeriods} quarter(s) without published source scores, ${skippedReviews} unpublished or unscored review(s) omitted.`
            : `${count} draft annual aggregate(s) calculated.`;
        toast[count > 0 ? "success" : "info"](
          `${prettify(periodType)} calculation finished: ${summary}`,
        );
        await load();
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not calculate performance aggregates.",
        );
      } finally {
        setBusyId("");
      }
    },
    [load],
  );

  const publishAggregatesForYear = React.useCallback(
    async (yearId: string, periodType: "QUARTERLY" | "ANNUAL") => {
      const token = readStoredToken();
      if (!token) return;
      const actionId = `publish-agg-${periodType}-${yearId}`;
      setBusyId(actionId);
      try {
        const result = asRecord(
          await publishPerformanceAggregates(token, yearId, periodType),
        );
        toast.success(
          `${readNumber(result, ["published_count"]) ?? 0} ${prettify(periodType).toLowerCase()} aggregate(s) published to employee self-service.`,
        );
        await load();
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not publish performance aggregates.",
        );
      } finally {
        setBusyId("");
      }
    },
    [load],
  );

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
            ? "No active plans found"
            : "No KPI values to update",
          {
            description:
              action === "assign"
                ? "Create an active employee plan, then choose Prepare reviews."
                : "Prepare reviews with system-linked KPIs, then try again.",
          },
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
    `${activeTab}:${setupTab}:${JSON.stringify({ form, additionalTemplateItems, scorecardComponents, workflowSteps })}`,
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
          aggregation_configuration: parseAnnualAggregationConfiguration(
            form.aggregation_configuration_json,
          ),
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
          category:
            resolveKpiCategory(form.category ?? "", kpiCategories) || undefined,
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
        if (!["APPROVE", "RETURN", "REJECT", "SKIP"].includes(form.decision))
          throw new Error("Choose a decision.");
        if (form.decision !== "APPROVE" && !form.comment?.trim())
          throw new Error(
            "A comment is required when returning, rejecting, or skipping a step.",
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
      if (
        activeTab === "setup" &&
        getPerformanceSetupStep(setupTab).createMode === createMode
      ) {
        setSavedSetupStep(setupTab);
        setSkippedSetupSteps((current) =>
          current.filter((step) => step !== setupTab),
        );
      }
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
                      <FluentButton
                        type="button"
                        appearance="secondary"
                        disabled={busyId === `goal-${id}`}
                        onClick={async (event) => {
                          event.stopPropagation();
                          const raw = await fluentPrompt(
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
                      </FluentButton>
                    ) : null}
                    {canUpdateDevelopmentGoals &&
                    readString(goal, ["status"]).toUpperCase() !==
                      "COMPLETED" ? (
                      <FluentButton
                        type="button"
                        appearance="secondary"
                        disabled={busyId === `complete-${id}`}
                        onClick={async (event) => {
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
                      </FluentButton>
                    ) : null}
                    {canCarryDevelopmentGoals ? (
                      <FluentButton
                        type="button"
                        appearance="secondary"
                        disabled={busyId === `carry-${id}`}
                        onClick={async (event) => {
                          event.stopPropagation();
                          const title = await fluentPrompt(
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
                      </FluentButton>
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
          defaultWidth: 190,
          render: (row) => (
            <div className={reportTableStyles.reportCell}>
              <span className={reportTableStyles.reportIcon} aria-hidden="true">
                <ChartMultiple20Regular />
              </span>
              <span className={reportTableStyles.reportCopy}>
                <span className={reportTableStyles.reportName}>
                  {readString(row, ["name"], optionLabel(row))}
                </span>
                <span className={reportTableStyles.reportCode}>
                  {readString(row, ["code"])}
                </span>
              </span>
            </div>
          ),
        },
        {
          key: "description",
          label: "Description",
          defaultWidth: 290,
          render: (row) => (
            <span className={reportTableStyles.description}>
              {readString(row, ["description"], "No description provided.")}
            </span>
          ),
        },
        {
          key: "actions",
          label: "Exports",
          defaultWidth: 160,
          sortable: false,
          render: (row) => {
            const code = readString(row, ["code"]);
            const formats = ["csv", "xlsx", "pdf"] as const;
            return (
              <div className={reportTableStyles.actions}>
                {formats.map((format) => {
                  const busy = busyId === `${code}-${format}`;
                  const icon =
                    format === "pdf" ? (
                      <DocumentPdf20Regular />
                    ) : format === "xlsx" ? (
                      <TableSimple20Regular />
                    ) : (
                      <ArrowDownload20Regular />
                    );
                  return (
                    <Tooltip
                      key={format}
                      content={`Download ${format.toUpperCase()}`}
                      relationship="label"
                    >
                      <FluentButton
                        type="button"
                        appearance="subtle"
                        size="small"
                        className={reportTableStyles.exportButton}
                        data-format={format}
                        aria-label={`Download ${readString(row, ["name"], "report")} as ${format.toUpperCase()}`}
                        icon={
                          busy ? (
                            <FluentLoadingIndicator className="size-4 animate-spin" />
                          ) : (
                            icon
                          )
                        }
                        disabled={!code || busy}
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
                        {format.toUpperCase()}
                      </FluentButton>
                    </Tooltip>
                  );
                })}
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
          defaultWidth: 230,
          render: (row) => (
            <div className={planTableStyles.employeeCell}>
              <span className={planTableStyles.employeeIcon} aria-hidden="true">
                <PeopleTeam20Regular />
              </span>
              <span className={planTableStyles.employeeCopy}>
                <span className={planTableStyles.employeeName}>
                  {employeeLabel(row)}
                </span>
                <span className={planTableStyles.employeeYear}>
                  {readString(
                    asRecord(row.financialYear ?? row.financial_year),
                    ["name", "code"],
                    `Year #${readNumber(row, ["financialYearId", "financial_year_id"]) ?? "—"}`,
                  )}
                </span>
              </span>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          defaultWidth: 105,
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
          defaultWidth: 160,
          render: (row) => (
            <div className={planTableStyles.effectiveDates}>
              <span>{formatDate(row.effectiveFrom ?? row.effective_from)}</span>
              <span className={planTableStyles.effectiveEnd}>
                To {formatDate(row.effectiveTo ?? row.effective_to)}
              </span>
            </div>
          ),
        },
        {
          key: "items",
          label: "Items",
          defaultWidth: 72,
          render: (row) => String(asRecordArray(row.items).length),
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 100,
          sortable: false,
          render: (row) => (
            <FluentButton
              type="button"
              appearance="subtle"
              size="small"
              className={planTableStyles.viewButton}
              icon={<Eye20Regular />}
              onClick={(event) => {
                event.stopPropagation();
                setDetailRecord(row);
                setDetailOpen(true);
              }}
            >
              View
            </FluentButton>
          ),
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
                <FluentButton
                  type="button"
                  appearance="secondary"
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
                </FluentButton>
                <FluentButton
                  type="button"
                  appearance="secondary"
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
                </FluentButton>
              </div>
            );
          },
        },
      ];
    }
    if (activeTab !== "overview" && setupTab === "kpis") {
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
            return (
              <span className="inline-flex items-center gap-1">
                {number
                  ? `Version ${number}`
                  : versionId !== null
                    ? "Saved version"
                    : "Not set"}
                <InfoButton
                  info="A version saves this KPI’s measurement and scoring settings. Create a new version when those settings change so older plans and reviews keep their original settings."
                  size="small"
                />
              </span>
            );
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
            <div className={periodActionStyles.actions}>
              <FluentButton
                type="button"
                appearance="primary"
                size="small"
                icon={<Edit20Regular />}
                onClick={async (event) => {
                  event.stopPropagation();
                  openCreate("kpi-edit", seedKpiDefinitionForm(row));
                }}
              >
                Edit
              </FluentButton>
              <FluentButton
                size="small"
                icon={<Copy20Regular />}
                data-action="sync"
                type="button"
                appearance="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  openCreate("kpi-version", seedKpiVersionForm(row));
                }}
              >
                New version
              </FluentButton>
              <FluentButton
                size="small"
                icon={<Archive20Regular />}
                data-action="lock"
                type="button"
                appearance="secondary"
                onClick={async (event) => {
                  event.stopPropagation();
                  const id = rowId(row);
                  if (
                    !id ||
                    !(await fluentConfirm(`Archive KPI ${optionLabel(row)}?`))
                  )
                    return;
                  void runAction(
                    `delete-kpi-${id}`,
                    (token) => deletePerformanceKpi(token, id),
                    "KPI archived.",
                  );
                }}
              >
                Archive
              </FluentButton>
            </div>
          ),
        },
      ];
    }
    if (activeTab !== "overview" && setupTab === "rules") {
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
    if (activeTab !== "overview" && setupTab === "years") {
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
          label: "Year status",
          render: (row) => (
            <div className="flex items-center gap-1">
              <StatusChip value={readString(row, ["status"], "DRAFT")} />
              <Tooltip
                relationship="description"
                content="This is the financial year's stored status. Activating review periods does not change it; each period has its own status."
              >
                <span
                  className="inline-flex"
                  tabIndex={0}
                  aria-label="About financial year status"
                >
                  <Info16Regular />
                </span>
              </Tooltip>
            </div>
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
                  appearance="primary"
                  size="small"
                  icon={<CalendarIcon />}
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
                {(["QUARTERLY", "ANNUAL"] as const).map((periodType) => {
                  const actionId = `agg-${periodType}-${id}`;
                  return (
                    <FluentButton
                      key={periodType}
                      type="button"
                      appearance="secondary"
                      size="small"
                      icon={<ScoreIcon />}
                      disabled={busyId === actionId}
                      onClick={(event) => {
                        event.stopPropagation();
                        void calculateAggregatesForYear(id, periodType);
                      }}
                    >
                      {busyId === actionId ? (
                        <FluentLoadingIndicator className="size-3.5 animate-spin" />
                      ) : (
                        `${prettify(periodType)} aggregates`
                      )}
                    </FluentButton>
                  );
                })}
                {canPublishAggregates
                  ? (["QUARTERLY", "ANNUAL"] as const).map((periodType) => {
                      const actionId = `publish-agg-${periodType}-${id}`;
                      return (
                        <FluentButton
                          key={`publish-${periodType}`}
                          type="button"
                          appearance="primary"
                          size="small"
                          icon={<CompletedIcon />}
                          disabled={busyId === actionId}
                          onClick={(event) => {
                            event.stopPropagation();
                            void publishAggregatesForYear(id, periodType);
                          }}
                        >
                          {busyId === actionId ? (
                            <FluentLoadingIndicator className="size-3.5 animate-spin" />
                          ) : (
                            "Publish " + prettify(periodType) + " aggregates"
                          )}
                        </FluentButton>
                      );
                    })
                  : null}
              </div>
            );
          },
        },
      ];
    }
    if (activeTab === "overview" || setupTab === "periods") {
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
              <div className={periodActionStyles.actions}>
                {canCreatePerformance && status === "DRAFT" ? (
                  <FluentButton
                    icon={<Edit20Regular />}
                    size="small"
                    type="button"
                    appearance="secondary"
                    onClick={async (event) => {
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
                  </FluentButton>
                ) : null}
                {canActivatePeriod && status === "DRAFT" ? (
                  <FluentButton
                    data-action="activate"
                    icon={<Play20Regular />}
                    type="button"
                    size="small"
                    appearance="primary"
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
                  </FluentButton>
                ) : null}
                {canClosePeriod &&
                !["DRAFT", "LOCKED", "CANCELLED"].includes(status) ? (
                  <FluentButton
                    data-action="lock"
                    icon={<LockClosed20Regular />}
                    type="button"
                    size="small"
                    appearance="secondary"
                    disabled={busyId === `close-period-${id}`}
                    title="Close this period after review work is complete. Locking does not approve or publish reviews."
                    onClick={(event) => {
                      event.stopPropagation();
                      void runAction(
                        `close-period-${id}`,
                        (token) => closePerformancePeriod(token, id),
                        "Review period closed.",
                      );
                    }}
                  >
                    Close period
                  </FluentButton>
                ) : null}
                {canReopenPeriod &&
                status === "LOCKED" &&
                ["LOCKED", "CLOSED"].includes(phase) ? (
                  <FluentButton
                    data-action="reopen"
                    icon={<LockOpen20Regular />}
                    type="button"
                    size="small"
                    appearance="secondary"
                    disabled={busyId === `reopen-period-${id}`}
                    onClick={async (event) => {
                      event.stopPropagation();
                      const reason = (
                        await fluentPrompt(
                          "Reason for reopening this KPI cycle",
                        )
                      )?.trim();
                      if (!reason) return;
                      void runAction(
                        `reopen-period-${id}`,
                        (token) => reopenPerformancePeriod(token, id, reason),
                        "KPI cycle reopened.",
                      );
                    }}
                  >
                    Reopen
                  </FluentButton>
                ) : null}
                <FluentButton
                  data-action="assign"
                  icon={<PersonAdd20Regular />}
                  type="button"
                  appearance="primary"
                  size="small"
                  disabled={busyId === `assign-${id}`}
                  title="Prepare employee reviews for this period using their active performance plans."
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
                    "Prepare reviews"
                  )}
                </FluentButton>
                <FluentButton
                  data-action="sync"
                  icon={<ArrowSync20Regular />}
                  type="button"
                  appearance="secondary"
                  size="small"
                  disabled={busyId === `sync-${id}`}
                  title="Update KPI values using recorded attendance, leave, activities, and field visits."
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
                    "Update KPI values"
                  )}
                </FluentButton>
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
    calculateAggregatesForYear,
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
    canPublishAggregates,
    canUpdateDevelopmentGoals,
    departments,
    employees,
    grades,
    kpis,
    positions,
    publishAggregatesForYear,
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

  const kpiCategoryFilter = (
    <FluentField label="Category" style={{ width: "100%", maxWidth: "20rem" }}>
      <FluentSelect
        ariaLabel="Filter KPIs by category"
        value={setupKpiCategory}
        onChange={setSetupKpiCategory}
        options={[
          { value: "", label: "All categories" },
          ...kpiCategories.map((category) => ({
            value: category,
            label: category,
          })),
          { value: "__uncategorized__", label: "Uncategorized" },
        ]}
      />
    </FluentField>
  );

  const financialYearFilter = (
    <FluentField
      label="Financial year"
      style={{ width: "100%", maxWidth: "24rem" }}
    >
      <FluentSelect
        ariaLabel="Review periods for financial year"
        value={setupFinancialYearId}
        onChange={(value) => {
          setSetupFinancialYearId(value);
          setSearch("");
          setSavedSetupStep(null);
        }}
        options={[
          { value: "", label: "All financial years" },
          ...years.map((year) => ({
            value: rowId(year),
            label: `${optionLabel(year)} · ${formatDate(readString(year, ["startDate", "start_date"]))} – ${formatDate(readString(year, ["endDate", "end_date"]))}`,
          })),
        ]}
      />
    </FluentField>
  );

  React.useEffect(() => {
    if (
      !detailOpen ||
      !detailRecord ||
      !readString(detailRecord, ["periodType", "period_type"])
    )
      return;
    const latest = periods.find(
      (period) => rowId(period) === rowId(detailRecord),
    );
    if (latest && latest !== detailRecord) setDetailRecord(latest);
  }, [detailOpen, detailRecord, periods]);

  const recordsPanel = (
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
          <FluentButton
            type="button"
            appearance="primary"
            disabled={
              !applyTemplateId || !applyPeriodId || busyId === "apply-template"
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
          </FluentButton>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <div
        className={
          activeTab === "setup"
            ? tableStyles.records
            : activeTab === "reports"
              ? reportTableStyles.surface
              : activeTab === "plans"
                ? planTableStyles.surface
                : "overflow-hidden rounded-xl border border-border bg-card"
        }
      >
        <ResizableTable
          title="Performance records"
          sortIconOnly
          toolbarClassName="!flex-wrap !items-end !gap-2 [&>div:first-child]:!overflow-visible"
          toolbarStart={
            activeTab === "setup" && setupTab === "periods"
              ? financialYearFilter
              : activeTab === "setup" && setupTab === "kpis"
                ? kpiCategoryFilter
                : undefined
          }
          toolbarActions={
            <SearchToggleField
              size="medium"
              value={search}
              onChange={setSearch}
              placeholder="Search records"
            />
          }
          compact={activeTab !== "setup"}
          fluent
          className={
            activeTab === "reports"
              ? reportTableStyles.table
              : activeTab === "plans"
                ? planTableStyles.table
                : undefined
          }
          frameClassName={
            activeTab === "setup"
              ? "!border-0 !shadow-none"
              : activeTab === "reports"
                ? reportTableStyles.frame
                : activeTab === "plans"
                  ? planTableStyles.frame
                  : undefined
          }
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
  );

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

  if (loading && !createOpen && activeTab !== "setup")
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <FluentLoadingIndicator />
        <p role="status">
          Loading this workflow and checking its available actions…
        </p>
      </section>
    );

  if (error && !loading && !createOpen && activeTab !== "setup")
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
        <FluentButton
          type="button"
          appearance="secondary"
          onClick={() => void load()}
        >
          Reload workflow
        </FluentButton>
      </section>
    );

  return (
    <section className="space-y-4">
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
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-foreground">
                  Overview
                </h1>
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
                <PerformanceWorkflowHelp />
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
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
                  <Card key={metric.label} size="small" className="min-w-0">
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
                    <p className="mt-2 text-xl font-semibold tabular-nums text-primary">
                      {metric.value}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(250px,1fr)]">
            <Card size="small" className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-2 py-2">
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
              <div className="divide-y divide-border">
                {periods.slice(0, 4).map((period) => {
                  const status = readString(
                    period,
                    ["kpiPhase", "kpi_phase", "status"],
                    "DRAFT",
                  ).toUpperCase();
                  return (
                    <FluentButton
                      key={rowId(period)}
                      type="button"
                      appearance="subtle"
                      className="!w-full !justify-start !px-2 !py-3"
                      onClick={() => {
                        setDetailRecord(period);
                        setDetailOpen(true);
                      }}
                    >
                      <div className="flex w-full min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0 text-left">
                          <p className="truncate text-sm font-semibold">
                            {optionLabel(period)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(period.startDate ?? period.start_date)}{" "}
                            – {formatDate(period.endDate ?? period.end_date)}
                          </p>
                        </div>
                        <StatusChip value={status} />
                      </div>
                    </FluentButton>
                  );
                })}
                {!loading && periods.length === 0 ? (
                  <p className="col-span-full px-2 py-8 text-center text-sm text-muted-foreground">
                    No periods yet. Create a year and generate periods in Setup.
                  </p>
                ) : null}
              </div>
            </Card>

            <Card size="small" className="min-w-0">
              <div className="border-b border-border px-2 py-2">
                <h2 className="text-base font-semibold text-foreground">
                  Needs attention
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Open items across this performance workspace.
                </p>
              </div>
              <div className="divide-y divide-border">
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
                  <FluentButton
                    key={item.label}
                    type="button"
                    onClick={() => router.push(item.url)}
                    appearance="subtle"
                    className="!flex !w-full !justify-between !gap-3 !px-2 !py-3 !text-left"
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
                  </FluentButton>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
            <Card size="small" className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-2 py-2">
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
                  className="!w-44"
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
              <div className="divide-y divide-border">
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
                    <FluentButton
                      key={`${readString(row, ["dashboard_kind"])}-${rowId(row) || index}`}
                      type="button"
                      onClick={() => {
                        setDetailRecord(row);
                        setDetailOpen(true);
                      }}
                      appearance="subtle"
                      className="!flex !w-full !min-w-0 !justify-start !gap-3 !px-2 !py-3 !text-left"
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
                    </FluentButton>
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
            </Card>

            <div className="space-y-4">
              <Card size="small" className="min-w-0">
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
              </Card>
              <Card size="small" className={quickLinkStyles.panel}>
                <div className={quickLinkStyles.heading}>
                  <h2>Quick links</h2>
                  <p>Everything you need to manage performance.</p>
                </div>
                <div className={quickLinkStyles.links}>
                  {[
                    ...(canCreatePerformance
                      ? [
                          {
                            title: "Configure performance",
                            description:
                              "Set review dates, KPIs and review rules.",
                            path: "setup",
                            icon: <Settings20Regular />,
                            tone: quickLinkStyles.blue,
                          },
                        ]
                      : []),
                    {
                      title: "Manage employee plans",
                      description: "Organise employee goals, KPIs and targets.",
                      path: "plans",
                      icon: <PeopleTeam20Regular />,
                      tone: quickLinkStyles.green,
                    },
                    {
                      title: "View reports",
                      description: "Explore results and review progress.",
                      path: "reports",
                      icon: <ChartMultiple20Regular />,
                      tone: quickLinkStyles.purple,
                    },
                  ].map((link) => (
                    <FluentButton
                      key={link.path}
                      appearance="subtle"
                      className={quickLinkStyles.link}
                      onClick={() =>
                        router.push(`/dashboard/performance/${link.path}`)
                      }
                    >
                      <span
                        className={`${quickLinkStyles.icon} ${link.tone}`}
                        aria-hidden="true"
                      >
                        {link.icon}
                      </span>
                      <span className={quickLinkStyles.copy}>
                        <span className={quickLinkStyles.title}>
                          {link.title}
                        </span>
                        <span className={quickLinkStyles.description}>
                          {link.description}
                        </span>
                      </span>
                      <ArrowRight20Regular
                        className={quickLinkStyles.arrow}
                        aria-hidden="true"
                      />
                    </FluentButton>
                  ))}
                </div>
              </Card>
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
            {activeTab !== "setup" ? (
              <p className="text-sm text-muted-foreground">
                {activeTab === "plans"
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
            ) : null}
          </div>
          <div
            className={
              activeTab === "plans"
                ? planTableStyles.headerActions
                : "flex flex-wrap gap-2"
            }
          >
            <PerformanceWorkflowHelp
              periodActions={activeTab === "setup" && setupTab === "periods"}
            />
            <FluentButton
              type="button"
              appearance="secondary"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              Refresh
            </FluentButton>
            {activeTab === "calibration" ? (
              <FluentButton
                type="button"
                appearance="secondary"
                onClick={() => setCalibrationComparison((current) => !current)}
              >
                {calibrationComparison
                  ? "Department summary"
                  : "Compare reviews"}
              </FluentButton>
            ) : null}
            {activeTab === "setup" && canCreatePerformance ? (
              <>
                {setupTab === "kpis" ? (
                  <FluentButton
                    type="button"
                    appearance="secondary"
                    onClick={() =>
                      openCreate(
                        "kpi-version",
                        kpis[0] ? seedKpiVersionForm(kpis[0]) : {},
                      )
                    }
                    disabled={kpis.length === 0}
                  >
                    New version
                  </FluentButton>
                ) : null}
              </>
            ) : null}
            {activeTab === "plans" && canCreatePerformance ? (
              <>
                <FluentButton
                  type="button"
                  appearance="secondary"
                  icon={<Play20Regular />}
                  onClick={() => openCreate("generate-plan")}
                >
                  Generate from rules
                </FluentButton>
                <FluentButton
                  type="button"
                  appearance="primary"
                  icon={<PlusIcon />}
                  onClick={() => openCreate("plan")}
                >
                  New plan
                </FluentButton>
              </>
            ) : null}
            {activeTab === "reviews" && canModerateReviews ? (
              <>
                <FluentButton
                  type="button"
                  appearance="secondary"
                  onClick={() => openCreate("moderate")}
                >
                  Moderate
                </FluentButton>
                <FluentButton
                  type="button"
                  appearance="secondary"
                  onClick={() => openCreate("reopen")}
                >
                  Reopen
                </FluentButton>
                <FluentButton
                  type="button"
                  appearance="secondary"
                  onClick={() =>
                    openCreate("feedback", {
                      relationship_type: "PEER",
                      is_anonymous: "true",
                    })
                  }
                >
                  360 feedback
                </FluentButton>
                <FluentButton
                  type="button"
                  appearance="primary"
                  onClick={() => openCreate("approve")}
                >
                  Approve
                </FluentButton>
              </>
            ) : null}
            {activeTab === "reviews" && canReadReviewWorkflow ? (
              <FluentButton
                type="button"
                appearance="secondary"
                onClick={async () => {
                  const reviewId = (
                    await fluentPrompt("Review ID to inspect")
                  )?.trim();
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
              </FluentButton>
            ) : null}
            {activeTab === "reviews" && canActOnReviewWorkflow ? (
              <FluentButton
                type="button"
                appearance="secondary"
                onClick={() =>
                  openCreate("workflow-action", { decision: "APPROVE" })
                }
              >
                Workflow decision
              </FluentButton>
            ) : null}
            {activeTab === "improvement" && canCreatePerformance ? (
              <FluentButton
                type="button"
                appearance="primary"
                onClick={() => openCreate("pip")}
              >
                <PlusIcon className="size-4" />
                New PIP
              </FluentButton>
            ) : null}
          </div>
        </div>
      )}

      {activeTab !== "overview" ? (
        activeTab === "setup" ? (
          <PerformanceSetupWizard
            step={setupTab}
            counts={
              setupFinancialYearId && setupCounts.periods !== undefined
                ? { ...setupCounts, periods: selectedYearPeriods.length }
                : setupCounts
            }
            skipped={skippedSetupSteps}
            loading={loading}
            busy={saving || Boolean(busyId) || createOpen}
            canCreate={canCreatePerformance}
            savedStep={savedSetupStep}
            error={error}
            onRetry={() => void load()}
            createBlocked={setupCreateBlocked(setupTab)}
            headerActions={
              <>
                <FluentButton
                  appearance="secondary"
                  disabled={saving || createOpen}
                  onClick={() => setGuidedSetupOpen(true)}
                >
                  Start guided setup
                </FluentButton>
                {setupTab === "kpis" ? (
                  <FluentButton
                    appearance="secondary"
                    icon={<Folder20Regular />}
                    disabled={saving || createOpen}
                    onClick={() => setCategoryFlyoutOpen(true)}
                  >
                    Manage categories
                  </FluentButton>
                ) : null}
              </>
            }
            onStepChange={changeSetupStep}
            onCreate={() => startSetupCreation(setupTab)}
            onSkip={skipSetupStep}
          >
            {setupTab === "kpis" &&
            (canManageKpiImports ||
              canApproveKpiImports ||
              canReadKpiImports) ? (
              <div className="mb-4">
                <KpiImportPanel
                  canManage={canManageKpiImports}
                  canApprove={canApproveKpiImports}
                  canRead={canReadKpiImports}
                />
              </div>
            ) : null}
            {recordsPanel}
          </PerformanceSetupWizard>
        ) : (
          recordsPanel
        )
      ) : null}

      <KpiCategoriesFlyout
        open={categoryFlyoutOpen}
        onOpenChange={(open) => {
          setCategoryFlyoutOpen(open);
          if (!open) {
            const url = new URL(window.location.href);
            url.searchParams.delete("categories");
            window.history.replaceState(window.history.state, "", url);
          }
        }}
        onChanged={() => void load()}
      />

      <PerformanceGuidedSetupDialog
        open={guidedSetupOpen}
        onOpenChange={setGuidedSetupOpen}
        initialStep={setupTab}
        counts={
          setupFinancialYearId && setupCounts.periods !== undefined
            ? { ...setupCounts, periods: selectedYearPeriods.length }
            : setupCounts
        }
        skipped={skippedSetupSteps}
        loading={loading}
        busy={saving || Boolean(busyId) || createOpen}
        canCreate={canCreatePerformance}
        createBlocked={setupCreateBlocked}
        configuredItems={configuredSetupItems}
        onStepChange={changeSetupStep}
        onCreate={startSetupCreation}
        onSkip={skipSetupStep}
      />

      <RecordDetailsDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={optionLabel(detailRecord)}
        description={
          readString(detailRecord, ["periodType", "period_type"])
            ? "Review period details"
            : "Record details"
        }
        actions={
          detailRecord &&
          readString(detailRecord, ["periodType", "period_type"]) &&
          (activeTab === "overview" ||
            (activeTab === "setup" && setupTab === "periods"))
            ? columns
                .find((column) => column.key === "actions")
                ?.render?.(detailRecord)
            : undefined
        }
        row={detailRecord}
      >
        {detailRecord && activeTab === "setup" && setupTab === "kpis" ? (
          <KpiRecordDetails row={detailRecord} />
        ) : undefined}
      </RecordDetailsDialog>

      <Dialog
        open={createOpen}
        onOpenChange={(_event, data) => {
          if (!saving) setCreateOpen(data.open);
        }}
      >
        <DialogSurface
          style={{
            width: ["scorecard", "workflow", "template"].includes(createMode)
              ? "min(860px, calc(100vw - 32px))"
              : "min(520px, calc(100vw - 32px))",
            maxWidth: ["scorecard", "workflow", "template"].includes(createMode)
              ? "860px"
              : "520px",
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          <DialogBody>
            <DialogTitle
              action={
                <FluentButton
                  appearance="subtle"
                  icon={<Dismiss20Regular />}
                  aria-label="Close"
                  disabled={saving}
                  onClick={() => setCreateOpen(false)}
                />
              }
            >
              {createLabel}
            </DialogTitle>

            <DialogContent>
              <ValidatedWorkflowForm
                onCancel={() => setCreateOpen(false)}
                requireReview={false}
                submitLabel={
                  PERFORMANCE_SETUP_STEPS.some(
                    (step) => step.createMode === createMode,
                  )
                    ? "Create"
                    : "Save changes"
                }
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
                description="Enter the details below and save."
              >
                <div className="grid max-h-[60vh] gap-3 overflow-auto pr-1">
                  {createMode === "year" ? (
                    <>
                      <Field label="Code">
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                      <FluentField
                        label="Aggregation"
                        hint={
                          AGGREGATION_HELP[form.annual_aggregation_method ?? ""]
                        }
                      >
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
                            {
                              value: "",
                              label: "Default",
                              description: AGGREGATION_HELP[""],
                            },
                            ...AGGREGATION_METHODS.map((item) => ({
                              value: item,
                              label: prettify(item),
                              description: AGGREGATION_HELP[item],
                            })),
                          ]}
                        />
                      </FluentField>
                      <FluentField
                        label="Aggregation configuration (JSON)"
                        hint="Optional. Required fields depend on the selected method. Leave blank for equal monthly weights."
                      >
                        <Textarea
                          resize="vertical"
                          value={form.aggregation_configuration_json ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              aggregation_configuration_json:
                                event.target.value,
                            }))
                          }
                          placeholder='{"monthly_weights":{"1":1,"2":1.2}}'
                        />
                      </FluentField>
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
                        <Input
                          className="w-full"
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
                          className="w-full"
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
                        <Input
                          type="number"
                          min="1"
                          className="w-full"
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
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          className="w-full"
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
                        <Input
                          type="number"
                          min="1"
                          className="w-full"
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
                        <Input
                          type="number"
                          min="0"
                          className="w-full"
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
                          <Field label="KPI" help={KPI_FIELD_HELP["KPI"]}>
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
                            Creates a new version of the selected KPI.
                            Templates, rules, and plans can pick it after save.
                          </p>
                        </>
                      ) : null}
                      <Field label="Code" help={KPI_FIELD_HELP["Code"]}>
                        <Input
                          className="w-full"
                          value={form.code ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              code: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Name" help={KPI_FIELD_HELP["Name"]}>
                        <Input
                          className="w-full"
                          value={form.name ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Category" help={KPI_FIELD_HELP["Category"]}>
                        <KpiCategorySelect
                          value={form.category ?? ""}
                          categories={kpiCategories}
                          onCreateCategory={async (name, description) => {
                            const token =
                              credential?.trim() || readStoredToken();
                            if (!token)
                              throw new Error("Please sign in again.");
                            return createPerformanceKpiCategory(token, {
                              name,
                              description: description || undefined,
                            });
                          }}
                          onCategoryCreated={(name) =>
                            setCategoryCatalog((current) =>
                              collectKpiCategories([...current, name]),
                            )
                          }
                          onChange={(category) =>
                            setForm((current) => ({ ...current, category }))
                          }
                        />
                      </Field>
                      <Field
                        label="Description"
                        help={KPI_FIELD_HELP["Description"]}
                      >
                        <Textarea
                          className="w-full"
                          value={form.description ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Unit" help={KPI_FIELD_HELP["Unit"]}>
                        <Input
                          className="w-full"
                          value={form.measurement_unit ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              measurement_unit: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field
                        label="Direction"
                        help={KPI_FIELD_HELP["Direction"]}
                      >
                        <FluentSelect
                          ariaLabel="Direction"
                          className="w-full"
                          value={
                            form.measurement_direction ?? "HIGHER_IS_BETTER"
                          }
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
                      <Field label="Formula" help={KPI_FIELD_HELP["Formula"]}>
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
                      <Field
                        label="Data source"
                        help={KPI_FIELD_HELP["Data source"]}
                      >
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
                          options={[
                            ...DATA_SOURCES.map((item) => ({
                              value: item,
                              label: prettify(item),
                            })),
                            ...UNAVAILABLE_DATA_SOURCES.map((item) => ({
                              value: item,
                              label: `${prettify(item)} (provider unavailable)`,
                              disabled: true,
                            })),
                          ]}
                        />
                      </Field>
                      <Field
                        label="Default target"
                        help={KPI_FIELD_HELP["Default target"]}
                      >
                        <Input
                          className="w-full"
                          value={form.default_target_value ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              default_target_value: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field
                        label="Frequency"
                        help={KPI_FIELD_HELP["Frequency"]}
                      >
                        <FluentSelect
                          ariaLabel="Frequency"
                          className="w-full"
                          value={form.frequency ?? "MONTHLY"}
                          onChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              frequency: value,
                            }))
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
                          {
                            value: "",
                            label: "Select a published KPI version",
                          },
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                              <div
                                key={id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <Checkbox
                                  label={optionLabel(role)}
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
                              </div>
                            );
                          })}
                        </div>
                      </Field>
                      <Field label="Weight">
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                          <Input
                            className="w-full"
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
                          <Input
                            className="w-full"
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
                          <FluentButton
                            type="button"
                            appearance="secondary"
                            onClick={() =>
                              setAdditionalTemplateItems((current) =>
                                current.filter(
                                  (_, position) => position !== index,
                                ),
                              )
                            }
                          >
                            Remove
                          </FluentButton>
                        </div>
                      ))}
                      <FluentButton
                        type="button"
                        appearance="secondary"
                        onClick={() =>
                          setAdditionalTemplateItems((current) => [
                            ...current,
                            { versionId: "", weight: "", target: "" },
                          ])
                        }
                      >
                        Add another KPI
                      </FluentButton>
                    </>
                  ) : null}
                  {createMode === "rule" ? (
                    <>
                      <Field label="Name">
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                            setForm((current) => ({
                              ...current,
                              branch_id: value,
                            }))
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
                            setForm((current) => ({
                              ...current,
                              grade_id: value,
                            }))
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          type="number"
                          step="0.01"
                          className="w-full"
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
                        <Input
                          type="number"
                          step="any"
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                    <FluentButton
                      type="button"
                      appearance="primary"
                      onClick={() => openCreate("development")}
                    >
                      <PlusIcon className="size-4" />
                      New plan
                    </FluentButton>
                  ) : null}
                  {createMode === "scorecard" ? (
                    <>
                      <Field label="Scorecard code">
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                          className="w-full"
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
                          <Input
                            className="w-full"
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
                          <Input
                            className="w-full"
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
                        <Input
                          className="w-full"
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
                      <Input
                        className="w-full"
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
                        <Input
                          className="w-full"
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
                          className="w-full"
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
                          <Input
                            className="w-full"
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
                        <Input
                          className="w-full"
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
                          className="w-full"
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
                          <Input
                            className="w-full"
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
                          className="w-full"
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
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                          className="w-full"
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
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                          className="w-full"
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
                      <Input
                        className="w-full"
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
                        <Input
                          className="w-full"
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
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                        <Input
                          type="number"
                          min="1"
                          className="w-full"
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
                            setForm((current) => ({
                              ...current,
                              decision: value,
                            }))
                          }
                          options={[
                            { value: "APPROVE", label: "Approve" },
                            { value: "RETURN", label: "Return" },
                            { value: "REJECT", label: "Reject" },
                            { value: "SKIP", label: "Skip optional step" },
                          ]}
                        />
                      </Field>
                      <Field label="Comment">
                        <Textarea
                          className="w-full"
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
                          className="w-full"
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
                        <Input
                          type="number"
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                          className="w-full"
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
                        <Input
                          className="w-full"
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
                          className="w-full"
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
                </div>
              </ValidatedWorkflowForm>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </section>
  );
}

function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <FluentField
      label={
        help ? (
          <span className="inline-flex items-center gap-1">
            {label}
            <InfoButton info={help} aria-label={`Help for ${label}`} />
          </span>
        ) : (
          label
        )
      }
      className="min-w-0"
    >
      {children}
    </FluentField>
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
          <Badge
            appearance="tint"
            color={
              Math.round(total * 100) / 100 === 100 ? "success" : "warning"
            }
            className={totalState}
          >
            {total.toFixed(total % 1 === 0 ? 0 : 2)}%
          </Badge>
          <FluentButton
            type="button"
            appearance="secondary"
            onClick={() =>
              onChange((current) => [
                ...current,
                createScorecardComponentDraft(),
              ])
            }
          >
            <PlusIcon className="size-4" />
            Add
          </FluentButton>
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
              <FluentField label="Code" className="min-w-0">
                <Input
                  className="w-full"
                  value={component.code}
                  onChange={(event) =>
                    updateComponent(component.id, { code: event.target.value })
                  }
                />
              </FluentField>
              <FluentField label="Label" className="min-w-0">
                <Input
                  className="w-full"
                  value={component.label}
                  onChange={(event) =>
                    updateComponent(component.id, { label: event.target.value })
                  }
                />
              </FluentField>
              <FluentField label="Type" className="min-w-0">
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
              </FluentField>
              <FluentField label="Weight" className="min-w-0">
                <Input
                  className="w-full"
                  inputMode="decimal"
                  value={component.weight}
                  onChange={(event) =>
                    updateComponent(component.id, {
                      weight: event.target.value,
                    })
                  }
                />
              </FluentField>
              <FluentField label="Enabled" className="min-w-0">
                <Checkbox
                  checked={component.enabled}
                  onChange={(_event, data) =>
                    updateComponent(component.id, {
                      enabled: Boolean(data.checked),
                    })
                  }
                />
              </FluentField>
              <FluentField label="Required" className="min-w-0">
                <Checkbox
                  checked={component.required}
                  onChange={(_event, data) =>
                    updateComponent(component.id, {
                      required: Boolean(data.checked),
                    })
                  }
                />
              </FluentField>
              <FluentButton
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                onClick={() => removeComponent(component.id)}
                disabled={components.length <= 1}
              >
                Remove
              </FluentButton>
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
        <FluentButton
          type="button"
          appearance="secondary"
          onClick={() =>
            onChange((current) => [
              ...current,
              createWorkflowStepDraft(current.length + 1),
            ])
          }
        >
          <PlusIcon className="size-4" />
          Add
        </FluentButton>
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
              <FluentField label="Code" className="min-w-0">
                <Input
                  className="w-full"
                  value={step.code}
                  onChange={(event) =>
                    updateStep(step.id, { code: event.target.value })
                  }
                />
              </FluentField>
              <FluentField label="Label" className="min-w-0">
                <Input
                  className="w-full"
                  value={step.label}
                  onChange={(event) =>
                    updateStep(step.id, { label: event.target.value })
                  }
                />
              </FluentField>
              <FluentField label="Approver" className="min-w-0">
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
              </FluentField>
              <FluentField label="Sequence" className="min-w-0">
                <Input
                  className="w-full"
                  inputMode="numeric"
                  value={step.sequenceNumber}
                  onChange={(event) =>
                    updateStep(step.id, { sequenceNumber: event.target.value })
                  }
                />
              </FluentField>
              <FluentField label="Required" className="min-w-0">
                <Checkbox
                  checked={step.required}
                  onChange={(_event, data) =>
                    updateStep(step.id, { required: Boolean(data.checked) })
                  }
                />
              </FluentField>
              <FluentField label="Final" className="min-w-0">
                <Checkbox
                  checked={step.canFinalize}
                  onChange={(_event, data) =>
                    updateStep(step.id, { canFinalize: Boolean(data.checked) })
                  }
                />
              </FluentField>
              <FluentButton
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                onClick={() => removeStep(step.id)}
                disabled={steps.length <= 1}
              >
                Remove
              </FluentButton>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ value }: { value: string }) {
  const status = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  const color = [
    "ACTIVE",
    "OPEN",
    "APPROVED",
    "PUBLISHED",
    "COMPLETED",
    "FINALIZED",
    "ACKNOWLEDGED",
    "SUCCESS",
  ].includes(status)
    ? tokens.colorPaletteGreenForeground1
    : [
          "REJECTED",
          "CANCELLED",
          "CANCELED",
          "FAILED",
          "DISPUTED",
          "OVERDUE",
        ].includes(status)
      ? tokens.colorPaletteRedForeground1
      : [
            "DRAFT",
            "PENDING",
            "IN_PROGRESS",
            "IN_REVIEW",
            "ACHIEVEMENT_ENTRY",
            "SELF_REVIEW",
            "MANAGER_REVIEW",
            "HR_REVIEW",
            "MODERATION",
            "SELF_REVIEW_PENDING",
            "MANAGER_REVIEW_PENDING",
            "HR_REVIEW_PENDING",
          ].includes(status)
        ? tokens.colorPaletteMarigoldForeground1
        : [
              "GOAL_SETTING",
              "REOPENED",
              "SELF_SUBMITTED",
              "MANAGER_SUBMITTED",
            ].includes(status)
          ? tokens.colorBrandForeground1
          : tokens.colorNeutralForeground3;
  return (
    <Text weight="semibold" style={{ color }}>
      {prettify(status || "Unknown")}
    </Text>
  );
}
