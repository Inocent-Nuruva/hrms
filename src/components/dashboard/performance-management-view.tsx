"use client"

import * as React from "react"
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  Clock3Icon,
  GaugeIcon,
  ListChecksIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
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
} from "@/components/dashboard/talent-visuals"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
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
  createPerformanceKpiVersion,
  createPerformancePeriod,
  createPerformancePeriodAssignments,
  createPerformancePlan,
  createPerformanceRatingScale,
  createPerformanceScorecard,
  createPerformanceWorkflow,
  createPerformanceDevelopmentPlan,
  downloadPerformanceReport,
  generatePerformancePeriods,
  generatePerformancePlanFromRules,
  getPerformanceDashboard,
  getPerformanceCalibrationDepartments,
  getPerformanceFeedback360Summary,
  invitePerformanceFeedback360,
  listPerformanceFeedback360,
  listEmployees,
  listPerformanceAppeals,
  listPerformanceCompetencyTemplates,
  listPerformanceDevelopmentPlans,
  listPerformanceFinancialYears,
  listPerformanceImprovementPlans,
  listPerformanceKpiRules,
  listPerformanceKpiTemplates,
  listPerformanceKpis,
  listPerformancePeriods,
  listPerformancePlans,
  listPerformanceRatingScales,
  listPerformanceReportCatalog,
  listPerformanceScorecards,
  listPerformanceWorkflows,
  moderatePerformanceReview,
  reopenPerformanceReview,
  reviewPerformanceImprovementMilestone,
  syncPerformanceSystemKpis,
  deletePerformanceKpi,
  updatePerformanceKpi,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute, canPerformPermission } from "@/lib/dashboard-permissions"
import { forgetForbiddenRoute } from "@/lib/forbidden-routes"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { cn } from "@/lib/utils"

export type PerformanceHrTab = "overview" | "setup" | "plans" | "development" | "reviews" | "improvement" | "reports" | "calibration"

type SetupTab =
  | "years"
  | "periods"
  | "kpis"
  | "templates"
  | "rules"
  | "competencies"
  | "scales"
  | "scorecards"
  | "workflows"

type CreateMode =
  | "year"
  | "period"
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
  | "feedback"
  | "reopen"
  | "milestone"

const SETUP_TABS: Array<{ id: SetupTab; label: string }> = [
  { id: "years", label: "Years" },
  { id: "periods", label: "Periods" },
  { id: "kpis", label: "KPIs" },
  { id: "templates", label: "Templates" },
  { id: "rules", label: "Rules" },
  { id: "competencies", label: "Competencies" },
  { id: "scales", label: "Rating scales" },
  { id: "scorecards", label: "Scorecards" },
  { id: "workflows", label: "Workflows" },
]

const PERFORMANCE_TIMELINE_STAGES = [
  { label: "Draft", statuses: ["DRAFT"] },
  { label: "Open", statuses: ["OPEN", "ACTIVE"] },
  { label: "Employee review", statuses: ["ACHIEVEMENT_ENTRY", "SELF_REVIEW"] },
  { label: "Manager review", statuses: ["MANAGER_REVIEW"] },
  { label: "HR review", statuses: ["HR_REVIEW", "MODERATION"] },
  { label: "Approved", statuses: ["APPROVED", "CLOSED", "COMPLETED"] },
] as const

const AGGREGATION_METHODS = [
  "SIMPLE_MONTHLY_AVERAGE",
  "WEIGHTED_MONTHLY_AVERAGE",
  "QUARTERLY_ROLLUP",
  "ANNUAL_TARGET_ACHIEVEMENT",
  "MONTHLY_AVERAGE_WITH_ADJUSTMENTS",
] as const

const MEASUREMENT_DIRECTIONS = [
  "HIGHER_IS_BETTER",
  "LOWER_IS_BETTER",
  "TARGET_MATCH",
  "RANGE",
  "BINARY",
  "MANUAL_RATING",
] as const

const SCORING_FORMULAS = [
  "PERCENT_TO_TARGET",
  "INVERSE_PERCENT_TO_TARGET",
  "TARGET_VARIANCE",
  "THRESHOLD_BANDS",
  "RANGE_COMPLIANCE",
  "BINARY_RESULT",
  "MANUAL_RATING",
] as const

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
] as const

const FREQUENCIES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"] as const
const PERIOD_TYPES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"] as const
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
] as const

const WORKFLOW_STEP_TYPES = [
  "DIRECT_SUPERVISOR",
  "DEPARTMENT_MANAGER",
  "HR_REVIEW",
  "FINAL_APPROVAL",
  "CUSTOM",
] as const

type ScorecardComponentDraft = {
  id: string
  code: string
  label: string
  type: (typeof SCORECARD_COMPONENT_TYPES)[number]
  weight: string
  enabled: boolean
  required: boolean
}

type WorkflowStepDraft = {
  id: string
  code: string
  label: string
  type: (typeof WORKFLOW_STEP_TYPES)[number]
  sequenceNumber: string
  required: boolean
  canFinalize: boolean
}

const DEFAULT_SCORECARD_COMPONENTS: ScorecardComponentDraft[] = [
  { id: "kpi", code: "KPI", label: "KPI performance", type: "KPI", weight: "50", enabled: true, required: true },
  { id: "competency", code: "COMPETENCY", label: "Competency assessment", type: "COMPETENCY", weight: "20", enabled: true, required: true },
  { id: "activities", code: "ACTIVITIES", label: "Activities performance", type: "ACTIVITIES", weight: "15", enabled: true, required: false },
  { id: "attendance", code: "ATTENDANCE", label: "Attendance and punctuality", type: "ATTENDANCE", weight: "5", enabled: true, required: false },
  { id: "manager", code: "MANAGER", label: "Manager assessment", type: "MANAGER_ASSESSMENT", weight: "10", enabled: true, required: false },
]

const DEFAULT_WORKFLOW_STEPS: WorkflowStepDraft[] = [
  { id: "supervisor", code: "SUPERVISOR", label: "Supervisor review", type: "DIRECT_SUPERVISOR", sequenceNumber: "1", required: true, canFinalize: false },
  { id: "dept-manager", code: "DEPT_MANAGER", label: "Department manager review", type: "DEPARTMENT_MANAGER", sequenceNumber: "2", required: true, canFinalize: false },
  { id: "hr", code: "HR_REVIEW", label: "HR review", type: "HR_REVIEW", sequenceNumber: "3", required: true, canFinalize: false },
  { id: "final", code: "FINAL_APPROVAL", label: "Final approval", type: "FINAL_APPROVAL", sequenceNumber: "4", required: true, canFinalize: true },
]

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function matchesSearch(row: AdminRecord, search: string) {
  if (!search.trim()) return true
  const haystack = JSON.stringify(row).toLowerCase()
  return haystack.includes(search.trim().toLowerCase())
}

function kpiVersions(row: AdminRecord | null | undefined) {
  return asRecordArray(row?.versions ?? row?.Versions)
}

function currentKpiVersion(row: AdminRecord | null | undefined) {
  const versions = kpiVersions(row)
  const currentId = readNumber(row, ["currentVersionId", "current_version_id"])
  return versions.find((version) => readNumber(version, ["id"]) === currentId) ?? versions.at(-1) ?? null
}

function kpiVersionOptions(kpis: AdminRecord[]) {
  return kpis.flatMap((kpi) => {
    const versions = kpiVersions(kpi)
    const fallbackId = readNumber(kpi, ["currentVersionId", "current_version_id"])
    if (versions.length === 0 && fallbackId !== null) {
      return [
        {
          id: String(fallbackId),
          label: `${readString(kpi, ["code", "name"], optionLabel(kpi))} · version #${fallbackId}`,
        },
      ]
    }
    return versions.map((version) => {
      const id = rowId(version)
      const number = readString(version, ["versionNumber", "version_number"], id)
      return {
        id,
        label: `${readString(kpi, ["code", "name"], optionLabel(kpi))} · v${number}`,
      }
    })
  })
}

function seedKpiVersionForm(row: AdminRecord) {
  const current = currentKpiVersion(row)
  return {
    kpi_id: rowId(row),
    code: readString(row, ["code"]),
    name: readString(row, ["name"]),
    category: readString(row, ["category"]),
    description:
      readString(current, ["description"]) || readString(row, ["description"]),
    measurement_unit: readString(current, ["measurementUnit", "measurement_unit"], "%"),
    measurement_direction: readString(
      current,
      ["measurementDirection", "measurement_direction"],
      "HIGHER_IS_BETTER",
    ),
    scoring_formula: readString(current, ["scoringFormula", "scoring_formula"], "PERCENT_TO_TARGET"),
    data_source_type: readString(current, ["dataSourceType", "data_source_type"], "MANUAL_EMPLOYEE"),
    default_target_value: readString(current, ["defaultTargetValue", "default_target_value"]),
    frequency: readString(current, ["frequency"], "MONTHLY"),
    approval_authority: readString(current, ["approvalAuthority", "approval_authority"]),
    manual_entry_allowed: readString(current, ["manualEntryAllowed", "manual_entry_allowed"], "true"),
    evidence_required: readString(current, ["evidenceRequired", "evidence_required"], "false"),
  }
}

function seedKpiDefinitionForm(row: AdminRecord) {
  const current = currentKpiVersion(row)
  return {
    kpi_id: rowId(row),
    code: readString(row, ["code"]),
    name: readString(row, ["name"]),
    category: readString(row, ["category"]),
    description: readString(row, ["description"]) || readString(current, ["description"]),
    measurement_unit: readString(current, ["measurementUnit", "measurement_unit"], "%"),
    measurement_direction: readString(current, ["measurementDirection", "measurement_direction"], "HIGHER_IS_BETTER"),
    scoring_formula: readString(current, ["scoringFormula", "scoring_formula"], "PERCENT_TO_TARGET"),
    data_source_type: readString(current, ["dataSourceType", "data_source_type"], "MANUAL_EMPLOYEE"),
    default_target_value: readString(current, ["defaultTargetValue", "default_target_value"]),
    frequency: readString(current, ["frequency"], "MONTHLY"),
    approval_authority: readString(current, ["approvalAuthority", "approval_authority"]),
    manual_entry_allowed: readString(current, ["manualEntryAllowed", "manual_entry_allowed"], "true"),
    evidence_required: readString(current, ["evidenceRequired", "evidence_required"], "false"),
  }
}

function createScorecardComponentDraft(): ScorecardComponentDraft {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return {
    id: suffix,
    code: "MANUAL",
    label: "Manual component",
    type: "MANUAL",
    weight: "0",
    enabled: true,
    required: false,
  }
}

function createWorkflowStepDraft(nextSequence: number): WorkflowStepDraft {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return {
    id: suffix,
    code: "CUSTOM",
    label: "Custom approval",
    type: "CUSTOM",
    sequenceNumber: String(nextSequence),
    required: true,
    canFinalize: false,
  }
}

function scorecardWeightTotal(components: ScorecardComponentDraft[]) {
  return components
    .filter((component) => component.enabled)
    .reduce((sum, component) => sum + (Number(component.weight) || 0), 0)
}

function buildScorecardComponents(components: ScorecardComponentDraft[]) {
  if (components.length === 0) {
    throw new Error("At least one scorecard component is required.")
  }
  const payload = components.map((component) => {
    const weight = Number(component.weight)
    if (!component.code.trim() || !component.label.trim()) {
      throw new Error("Each scorecard component needs a code and label.")
    }
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      throw new Error(`Invalid weight for ${component.label}.`)
    }
    return {
      code: component.code.trim().toUpperCase(),
      label: component.label.trim(),
      type: component.type,
      weight,
      enabled: component.enabled,
      required: component.required,
    }
  })
  const total = payload.filter((component) => component.enabled).reduce((sum, component) => sum + component.weight, 0)
  if (Math.round(total * 100) / 100 !== 100) {
    throw new Error(`Enabled scorecard component weights must total 100. Current total: ${total}.`)
  }
  return payload
}

function buildWorkflowSteps(steps: WorkflowStepDraft[]) {
  if (steps.length === 0) {
    throw new Error("At least one workflow step is required.")
  }
  const payload = steps.map((step) => {
    const sequence = Number(step.sequenceNumber)
    if (!step.code.trim() || !step.label.trim()) {
      throw new Error("Each workflow step needs a code and label.")
    }
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new Error(`Invalid sequence for ${step.label}.`)
    }
    return {
      code: step.code.trim().toUpperCase(),
      label: step.label.trim(),
      type: step.type,
      sequence_number: sequence,
      required: step.required,
      can_finalize: step.canFinalize,
    }
  })
  const sequences = new Set(payload.map((step) => step.sequence_number))
  const codes = new Set(payload.map((step) => step.code))
  if (sequences.size !== payload.length) {
    throw new Error("Workflow step sequence numbers must be unique.")
  }
  if (codes.size !== payload.length) {
    throw new Error("Workflow step codes must be unique.")
  }
  if (!payload.some((step) => step.can_finalize)) {
    payload[payload.length - 1].can_finalize = true
  }
  return payload.sort((left, right) => left.sequence_number - right.sequence_number)
}

export function PerformanceManagementView({
  activeTab,
}: {
  activeTab: PerformanceHrTab
}) {
  const actor = useDashboardActor()
  const performancePath =
    activeTab === "overview"
      ? "/dashboard/performance/overview"
      : `/dashboard/performance/${activeTab}`
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
      ))
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
  })
  const canActivatePeriod = canPerformPermission(actor.permissionLabels, {
    permissions: ["performance_periods:activate", "performance:update", "manage_performance"],
    mode: "any",
  })
  const canClosePeriod = canPerformPermission(actor.permissionLabels, {
    permissions: ["performance_periods:close", "performance:update", "manage_performance"],
    mode: "any",
  })
  const canModerateReviews = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "performance:update",
      "performance_reviews:update",
      "performance_reviews:approve",
      "manage_performance",
    ],
    mode: "any",
  })

  React.useEffect(() => {
    forgetForbiddenRoute("/dashboard/performance")
    forgetForbiddenRoute("/dashboard/performance/overview")
    forgetForbiddenRoute("/dashboard/performance/setup")
    forgetForbiddenRoute("/dashboard/performance/plans")
    forgetForbiddenRoute("/dashboard/performance/reviews")
    forgetForbiddenRoute("/dashboard/performance/improvement")
  }, [])

  const [setupTab, setSetupTab] = React.useState<SetupTab>("years")
  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [years, setYears] = React.useState<AdminRecord[]>([])
  const [periods, setPeriods] = React.useState<AdminRecord[]>([])
  const [kpis, setKpis] = React.useState<AdminRecord[]>([])
  const [templates, setTemplates] = React.useState<AdminRecord[]>([])
  const [rules, setRules] = React.useState<AdminRecord[]>([])
  const [competencies, setCompetencies] = React.useState<AdminRecord[]>([])
  const [scales, setScales] = React.useState<AdminRecord[]>([])
  const [scorecards, setScorecards] = React.useState<AdminRecord[]>([])
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([])
  const [plans, setPlans] = React.useState<AdminRecord[]>([])
  const [developmentPlans, setDevelopmentPlans] = React.useState<AdminRecord[]>([])
  const [reports, setReports] = React.useState<AdminRecord[]>([])
  const [calibrationRows, setCalibrationRows] = React.useState<AdminRecord[]>([])
  const [appeals, setAppeals] = React.useState<AdminRecord[]>([])
  const [pips, setPips] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [overviewSearch, setOverviewSearch] = React.useState("")
  const [overviewStatus, setOverviewStatus] = React.useState("ALL")
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailRecord, setDetailRecord] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<CreateMode>("year")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState("")
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [scorecardComponents, setScorecardComponents] = React.useState<ScorecardComponentDraft[]>(DEFAULT_SCORECARD_COMPONENTS)
  const [workflowSteps, setWorkflowSteps] = React.useState<WorkflowStepDraft[]>(DEFAULT_WORKFLOW_STEPS)

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
      const optional = <T,>(promise: Promise<T>, fallback: T) =>
        promise.catch(() => fallback)

      if (activeTab === "overview") {
        const [summary, yearRows, periodRows, planRows, developmentRows, pipRows, appealRows] = await Promise.all([
          optional(getPerformanceDashboard(token), null),
          optional(listPerformanceFinancialYears(token), [] as AdminRecord[]),
          optional(listPerformancePeriods(token), [] as AdminRecord[]),
          optional(listPerformancePlans(token), [] as AdminRecord[]),
          optional(listPerformanceDevelopmentPlans(token), [] as AdminRecord[]),
          optional(listPerformanceImprovementPlans(token), [] as AdminRecord[]),
          optional(listPerformanceAppeals(token), [] as AdminRecord[]),
        ])
        setDashboard(summary)
        setYears(yearRows)
        setPeriods(periodRows)
        setPlans(planRows)
        setDevelopmentPlans(developmentRows)
        setPips(pipRows)
        setAppeals(appealRows)
      } else if (activeTab === "setup") {
        if (setupTab === "years") {
          setYears(await listPerformanceFinancialYears(token))
        } else if (setupTab === "periods") {
          const [periodRows, yearRows] = await Promise.all([
            listPerformancePeriods(token),
            optional(listPerformanceFinancialYears(token), [] as AdminRecord[]),
          ])
          setPeriods(periodRows)
          setYears(yearRows)
        } else if (setupTab === "kpis") {
          setKpis(await listPerformanceKpis(token))
        } else if (setupTab === "templates") {
          setTemplates(await listPerformanceKpiTemplates(token))
        } else if (setupTab === "rules") {
          setRules(await listPerformanceKpiRules(token))
        } else if (setupTab === "competencies") {
          setCompetencies(await listPerformanceCompetencyTemplates(token))
        } else if (setupTab === "scales") {
          setScales(await listPerformanceRatingScales(token))
        } else if (setupTab === "scorecards") {
          setScorecards(await listPerformanceScorecards(token))
        } else if (setupTab === "workflows") {
          setWorkflows(await listPerformanceWorkflows(token))
        }
      } else if (activeTab === "plans") {
        const [planRows, kpiRows, employeeRows] = await Promise.all([
          listPerformancePlans(token),
          optional(listPerformanceKpis(token), [] as AdminRecord[]),
          listEmployees(token, { limit: 100 })
            .then((result) => result.rows)
            .catch(() => [] as AdminRecord[]),
        ])
        setPlans(planRows)
        setKpis(kpiRows)
        setEmployees(employeeRows)
      } else if (activeTab === "development") {
        const [developmentRows, employeeRows] = await Promise.all([
          listPerformanceDevelopmentPlans(token),
          listEmployees(token, { limit: 100 })
            .then((result) => result.rows)
            .catch(() => [] as AdminRecord[]),
        ])
        setDevelopmentPlans(developmentRows)
        setEmployees(employeeRows)
      } else if (activeTab === "reviews") {
        const [appealRows, pipRows] = await Promise.all([
          listPerformanceAppeals(token),
          optional(listPerformanceImprovementPlans(token), [] as AdminRecord[]),
        ])
        setAppeals(appealRows)
        setPips(pipRows)
      } else if (activeTab === "improvement") {
        setPips(await listPerformanceImprovementPlans(token))
      } else if (activeTab === "reports") {
        setReports(await listPerformanceReportCatalog(token))
      } else if (activeTab === "calibration") {
        setCalibrationRows(await getPerformanceCalibrationDepartments(token))
      }
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Could not load performance data.")
    } finally {
      setLoading(false)
    }
  }, [activeTab, setupTab])

  React.useEffect(() => {
    if (!canAccess) return
    void load()
  }, [canAccess, load])

  const averageScore =
    readNumber(dashboard, [
      "average_score",
      "averageScore",
      "avg_score",
      "avgScore",
      "mean_score",
    ]) ??
    readNumber(asRecord(dashboard?.scores), ["average", "avg", "mean"])

  const completionRate = readNumber(dashboard, [
    "completion_rate",
    "completionRate",
    "review_completion_rate",
  ])

  const openReviews =
    readNumber(dashboard, ["open_reviews", "openReviews", "pending_reviews", "pendingReviews"]) ??
    appeals.length

  const pipCount =
    readNumber(dashboard, ["open_improvement_plans", "openImprovementPlans", "pip_count"]) ??
    pips.length
  const developmentPlanCount =
    readNumber(dashboard, ["active_development_plans", "activeDevelopmentPlans"]) ??
    developmentPlans.length
  const pendingFeedbackCount =
    readNumber(dashboard, ["pending_feedback_360", "pendingFeedback360"]) ?? 0

  const currentPeriod = periods[0] ?? null
  const overviewRecords = React.useMemo(() => {
    const tagged: AdminRecord[] = [
      ...periods.map((row) => ({ ...row, dashboard_kind: "Review period" })),
      ...plans.map((row) => ({ ...row, dashboard_kind: "Performance plan" })),
      ...developmentPlans.map((row) => ({ ...row, dashboard_kind: "Development plan" })),
      ...pips.map((row) => ({ ...row, dashboard_kind: "Improvement plan" })),
      ...appeals.map((row) => ({ ...row, dashboard_kind: "Appeal" })),
    ]
    const needle = overviewSearch.trim().toLowerCase()
    return tagged.filter((row) => {
      const status = readString(row, ["status", "review_status", "reviewStatus"], "DRAFT").toUpperCase()
      if (overviewStatus !== "ALL" && status !== overviewStatus) return false
      return !needle || JSON.stringify(row).toLowerCase().includes(needle)
    })
  }, [appeals, developmentPlans, overviewSearch, overviewStatus, periods, pips, plans])
  const overviewStatuses = React.useMemo(
    () => Array.from(new Set(
      [periods, plans, developmentPlans, pips, appeals]
        .flat()
        .map((row) => readString(row, ["status", "review_status", "reviewStatus"], "DRAFT").toUpperCase()),
    )).sort(),
    [appeals, developmentPlans, periods, pips, plans],
  )
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
                            : workflows
    return source.filter((row) => matchesSearch(row, search))
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
  ])

  function openCreate(mode: CreateMode, seed: Record<string, string> = {}) {
    setCreateMode(mode)
    setForm(
      mode === "period"
        ? { period_type: "MONTHLY", sequence_number: "1", ...seed }
        : mode === "scorecard"
          ? { is_default: "true", ...seed }
        : mode === "workflow"
          ? { is_default: "true", ...seed }
        : seed,
    )
    if (mode === "scorecard") {
      setScorecardComponents(DEFAULT_SCORECARD_COMPONENTS)
    }
    if (mode === "workflow") {
      setWorkflowSteps(DEFAULT_WORKFLOW_STEPS)
    }
    setFormError(null)
    setCreateOpen(true)
  }

  async function runAction(id: string, work: (token: string) => Promise<unknown>, success: string) {
    const token = readStoredToken()
    if (!token) return
    setBusyId(id)
    try {
      await work(token)
      toast.success(success)
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Action failed.")
    } finally {
      setBusyId("")
    }
  }

  async function onCreate() {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (createMode === "year") {
        if (!form.code || !form.name || !form.start_date || !form.end_date) {
          throw new Error("Code, name, start date, and end date are required.")
        }
        await createPerformanceFinancialYear(token, {
          code: form.code,
          name: form.name,
          start_date: form.start_date,
          end_date: form.end_date,
          annual_aggregation_method: form.annual_aggregation_method || undefined,
        })
      } else if (createMode === "period") {
        if (!form.financial_year_id || !form.name || !form.period_type || !form.sequence_number || !form.start_date || !form.end_date) {
          throw new Error("Year, name, type, sequence, start date, and end date are required.")
        }
        await createPerformancePeriod(token, {
          financial_year_id: Number(form.financial_year_id),
          name: form.name,
          description: form.description || undefined,
          period_type: form.period_type,
          sequence_number: Number(form.sequence_number),
          start_date: form.start_date,
          end_date: form.end_date,
        })
      } else if (createMode === "kpi" || createMode === "kpi-edit" || createMode === "kpi-version") {
        if (!form.code || !form.name || !form.description || !form.measurement_unit) {
          throw new Error("Code, name, description, and measurement unit are required.")
        }
        const kpiPayload = {
          code: form.code,
          name: form.name,
          category: form.category || undefined,
          description: form.description,
          measurement_unit: form.measurement_unit,
          measurement_direction: form.measurement_direction || "HIGHER_IS_BETTER",
          scoring_formula: form.scoring_formula || "PERCENT_TO_TARGET",
          data_source_type: form.data_source_type || "MANUAL_EMPLOYEE",
          default_target_value: form.default_target_value ? Number(form.default_target_value) : undefined,
          frequency: form.frequency || undefined,
          approval_authority: form.approval_authority || undefined,
          manual_entry_allowed: form.manual_entry_allowed === "true",
          evidence_required: form.evidence_required === "true",
        }
        if (createMode === "kpi-edit") {
          if (!form.kpi_id) throw new Error("KPI is missing.")
          await updatePerformanceKpi(token, form.kpi_id, kpiPayload)
        } else if (createMode === "kpi-version") {
          if (!form.kpi_id) throw new Error("Select a KPI to version.")
          const created = await createPerformanceKpiVersion(token, form.kpi_id, kpiPayload)
          const createdRecord = asRecord(created) ?? asRecord(asRecord(created)?.data)
          const versionId =
            readNumber(createdRecord, ["currentVersionId", "current_version_id"]) ??
            readNumber(kpiVersions(createdRecord).at(-1) ?? null, ["id"])
          toast.success(
            versionId !== null
              ? `KPI version #${versionId} created.`
              : "KPI version created.",
          )
          setCreateOpen(false)
          await load()
          return
        }
        if (createMode === "kpi") {
          await createPerformanceKpi(token, kpiPayload)
        }
      } else if (createMode === "template") {
        if (!form.code || !form.name || !form.kpi_definition_version_id || !form.weight) {
          throw new Error("Code, name, KPI version, and weight are required.")
        }
        await createPerformanceKpiTemplate(token, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          review_cycle: form.review_cycle || undefined,
          items: [
            {
              kpi_definition_version_id: Number(form.kpi_definition_version_id),
              weight: Number(form.weight),
              target_value: form.target_value ? Number(form.target_value) : undefined,
              manual_entry_allowed: form.manual_entry_allowed === "true",
              evidence_required: form.evidence_required === "true",
              notes: form.notes || undefined,
            },
          ],
        })
      } else if (createMode === "rule") {
        if (!form.kpi_definition_version_id) {
          throw new Error("KPI definition version is required.")
        }
        await createPerformanceKpiRule(token, {
          kpi_definition_version_id: Number(form.kpi_definition_version_id),
          name: form.name || undefined,
          priority: form.priority ? Number(form.priority) : undefined,
          financial_year_id: form.financial_year_id ? Number(form.financial_year_id) : undefined,
          department_id: form.department_id ? Number(form.department_id) : undefined,
          position_id: form.position_id ? Number(form.position_id) : undefined,
          review_cycle: form.review_cycle || undefined,
          weight_override: form.weight_override ? Number(form.weight_override) : undefined,
          target_override: form.target_override ? Number(form.target_override) : undefined,
        })
      } else if (createMode === "competency") {
        if (!form.code || !form.name || !form.item_code || !form.item_name || !form.item_weight) {
          throw new Error("Template and first competency item details are required.")
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
              maximum_rating: form.maximum_rating ? Number(form.maximum_rating) : undefined,
            },
          ],
        })
      } else if (createMode === "scale") {
        if (!form.code || !form.name || !form.band_code || !form.band_label) {
          throw new Error("Scale and first band details are required.")
        }
        await createPerformanceRatingScale(token, {
          code: form.code,
          name: form.name,
          minimum_score: form.minimum_score ? Number(form.minimum_score) : undefined,
          maximum_score: form.maximum_score ? Number(form.maximum_score) : undefined,
          is_default: form.is_default === "true",
          bands: [
            {
              code: form.band_code,
              label: form.band_label,
              minimum_score: Number(form.band_min || 0),
              maximum_score: Number(form.band_max || 100),
              requires_improvement_plan: form.requires_improvement_plan === "true",
            },
          ],
        })
      } else if (createMode === "scorecard") {
        if (!form.code || !form.name) {
          throw new Error("Code and name are required.")
        }
        await createPerformanceScorecard(token, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          is_default: form.is_default !== "false",
          effective_from: form.effective_from || undefined,
          effective_to: form.effective_to || undefined,
          components: buildScorecardComponents(scorecardComponents),
        })
      } else if (createMode === "workflow") {
        if (!form.code || !form.name) {
          throw new Error("Code and name are required.")
        }
        await createPerformanceWorkflow(token, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          is_default: form.is_default !== "false",
          applies_to_department_id: form.applies_to_department_id ? Number(form.applies_to_department_id) : undefined,
          applies_to_position_id: form.applies_to_position_id ? Number(form.applies_to_position_id) : undefined,
          review_type: form.review_type || undefined,
          steps: buildWorkflowSteps(workflowSteps),
        })
      } else if (createMode === "development") {
        if (!form.employee_id || !form.title || !form.goal_title) {
          throw new Error("Employee, plan title, and first goal are required.")
        }
        await createPerformanceDevelopmentPlan(token, {
          employee_id: Number(form.employee_id),
          manager_employee_id: form.manager_employee_id ? Number(form.manager_employee_id) : undefined,
          source_review_id: form.source_review_id ? Number(form.source_review_id) : undefined,
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
        })
      } else if (createMode === "plan") {
        if (!form.employee_id || !form.financial_year_id || !form.effective_from || !form.kpi_definition_version_id || !form.weight) {
          throw new Error("Employee, year, start date, KPI version, and weight are required.")
        }
        await createPerformancePlan(token, {
          employee_id: Number(form.employee_id),
          financial_year_id: Number(form.financial_year_id),
          effective_from: form.effective_from,
          effective_to: form.effective_to || undefined,
          manager_employee_id: form.manager_employee_id ? Number(form.manager_employee_id) : undefined,
          items: [
            {
              kpi_definition_version_id: Number(form.kpi_definition_version_id),
              weight: Number(form.weight),
              target_value: form.target_value ? Number(form.target_value) : undefined,
              notes: form.notes || undefined,
            },
          ],
        })
      } else if (createMode === "generate-plan") {
        if (!form.employee_id || !form.financial_year_id || !form.effective_from) {
          throw new Error("Employee, year, and start date are required.")
        }
        await generatePerformancePlanFromRules(token, {
          employee_id: Number(form.employee_id),
          financial_year_id: Number(form.financial_year_id),
          effective_from: form.effective_from,
          effective_to: form.effective_to || undefined,
          review_cycle: form.review_cycle || undefined,
        })
      } else if (createMode === "pip") {
        if (!form.review_id || !form.summary || !form.objectives || !form.milestone_title || !form.milestone_due) {
          throw new Error("Review, summary, objectives, and a milestone are required.")
        }
        await createPerformanceImprovementPlan(token, form.review_id, {
          summary: form.summary,
          objectives: form.objectives.split("\n").map((line) => line.trim()).filter(Boolean),
          milestones: [
            {
              title: form.milestone_title,
              description: form.milestone_description || undefined,
              due_date: form.milestone_due,
            },
          ],
        })
      } else if (createMode === "moderate") {
        if (!form.review_id || !form.reason) throw new Error("Review and reason are required.")
        await moderatePerformanceReview(token, form.review_id, {
          reason: form.reason,
          final_score: form.final_score ? Number(form.final_score) : undefined,
        })
      } else if (createMode === "approve") {
        if (!form.period_assignment_id) throw new Error("Period assignment is required.")
        await approvePerformanceReview(token, form.period_assignment_id, {
          adjustment_score: form.adjustment_score ? Number(form.adjustment_score) : undefined,
          publish: form.publish !== "false",
          hr_review: form.hr_review ? { comment: form.hr_review } : undefined,
        })
      } else if (createMode === "feedback") {
        if (!form.review_id || !form.rater_employee_ids) {
          throw new Error("Review ID and at least one rater employee ID are required.")
        }
        const raterIds = form.rater_employee_ids
          .split(/[\n,]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map(Number)
        if (!raterIds.length || raterIds.some((id) => !Number.isInteger(id) || id < 1)) {
          throw new Error("Rater employee IDs must be valid numbers.")
        }
        await invitePerformanceFeedback360(token, form.review_id, {
          invitations: raterIds.map((id) => ({
            rater_employee_id: id,
            relationship_type: form.relationship_type || "PEER",
            due_date: form.due_date || undefined,
            is_anonymous: form.is_anonymous !== "false",
          })),
        })
        const [items, summary] = await Promise.all([
          listPerformanceFeedback360(token, form.review_id),
          getPerformanceFeedback360Summary(token, form.review_id),
        ])
        setDetailRecord({
          review_id: form.review_id,
          summary,
          invitations: items,
        })
        setDetailOpen(true)
      } else if (createMode === "reopen") {
        if (!form.review_id || !form.reason) throw new Error("Review and reason are required.")
        await reopenPerformanceReview(token, form.review_id, form.reason)
      } else if (createMode === "milestone") {
        if (!form.milestone_id || !form.comment) throw new Error("Milestone and comment are required.")
        await reviewPerformanceImprovementMilestone(token, form.milestone_id, {
          comment: form.comment,
          status: form.status || undefined,
        })
      }
      toast.success("Saved.")
      setCreateOpen(false)
      await load()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not save.")
    } finally {
      setSaving(false)
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
              <p className="font-medium">{readString(row, ["title"], `Development plan #${rowId(row)}`)}</p>
              <p className="text-xs text-muted-foreground">Employee #{readNumber(row, ["employeeId", "employee_id"]) ?? "N/A"}</p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} />,
        },
        {
          key: "goals",
          label: "Goals",
          render: (row) => String(asRecordArray(row.goals).length),
        },
        {
          key: "target",
          label: "Target",
          render: (row) => formatDate(row.targetCompletionDate ?? row.target_completion_date),
        },
      ]
    }
    if (activeTab === "reports") {
      return [
        {
          key: "report",
          label: "Report",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{readString(row, ["name"], optionLabel(row))}</p>
              <p className="text-xs text-muted-foreground">{readString(row, ["code"])}</p>
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
            const code = readString(row, ["code"])
            const formats = ["csv", "xlsx", "pdf"] as const
            return (
              <div className="flex flex-wrap gap-1">
                {formats.map((format) => (
                  <button
                    key={format}
                    type="button"
                    className={actionButtonClass}
                    disabled={!code || busyId === `${code}-${format}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      void runAction(`${code}-${format}`, async (token) => {
                        const blob = await downloadPerformanceReport(token, code, format)
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement("a")
                        link.href = url
                        link.download = `${code.toLowerCase()}.${format}`
                        link.click()
                        URL.revokeObjectURL(url)
                      }, `${format.toUpperCase()} export downloaded.`)
                    }}
                  >
                    {busyId === `${code}-${format}` ? <Loader2Icon className="size-3.5 animate-spin" /> : format.toUpperCase()}
                  </button>
                ))}
              </div>
            )
          },
        },
      ]
    }
    if (activeTab === "calibration") {
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
          render: (row) => `${readString(row, ["minimum_score"], "N/A")} - ${readString(row, ["maximum_score"], "N/A")}`,
        },
        {
          key: "pending",
          label: "Pending",
          render: (row) => readString(row, ["pending_reviews"], "0"),
        },
      ]
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
                {readString(asRecord(row.financialYear ?? row.financial_year), ["name", "code"], `Year #${readNumber(row, ["financialYearId", "financial_year_id"]) ?? "—"}`)}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} />,
        },
        {
          key: "effective",
          label: "Effective",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{formatDate(row.effectiveFrom ?? row.effective_from)}</p>
              <p className="text-muted-foreground">To {formatDate(row.effectiveTo ?? row.effective_to)}</p>
            </div>
          ),
        },
        {
          key: "items",
          label: "Items",
          render: (row) => String(asRecordArray(row.items).length),
        },
      ]
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
                Review #{readNumber(row, ["reviewId", "review_id", "performanceReviewId"]) ?? "—"}
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
          key: "reason",
          label: "Reason",
          render: (row) => readString(row, ["reason", "appeal_reason", "appealReason"], "—"),
        },
        {
          key: "created",
          label: "Opened",
          render: (row) => formatDate(row.createdAt ?? row.created_at),
        },
      ]
    }
    if (activeTab === "improvement") {
      return [
        {
          key: "plan",
          label: "Plan",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{readString(row, ["summary", "title"], `PIP #${rowId(row)}`)}</p>
              <p className="text-xs text-muted-foreground">{employeeLabel(row)}</p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} />,
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
            const id = rowId(row)
            const status = readString(row, ["status"], "DRAFT")
            return (
              <div className="flex flex-wrap gap-1">
                {canActivatePeriod && status === "DRAFT" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `activate-${id}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      void runAction(`activate-${id}`, (token) => activatePerformancePeriod(token, id), "Performance period activated.")
                    }}
                  >
                    {busyId === `activate-${id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : "Activate"}
                  </button>
                ) : null}
                {canClosePeriod && !["DRAFT", "LOCKED", "CANCELLED"].includes(status) ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `close-period-${id}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      void runAction(`close-period-${id}`, (token) => closePerformancePeriod(token, id), "Performance period closed.")
                    }}
                  >
                    {busyId === `close-period-${id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : "Close"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `close-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void runAction(`close-${id}`, (token) => closePerformanceImprovementPlan(token, id), "Improvement plan closed.")
                  }}
                >
                  {busyId === `close-${id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : "Close"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation()
                    const firstMilestone = asRecordArray(row.milestones)[0]
                    openCreate("milestone", {
                      milestone_id: rowId(firstMilestone),
                      comment: "",
                    })
                  }}
                >
                  Review milestone
                </button>
              </div>
            )
          },
        },
      ]
    }
    if (setupTab === "kpis") {
      return [
        {
          key: "name",
          label: "KPI",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">{readString(row, ["code", "category"])}</p>
            </div>
          ),
        },
        {
          key: "version",
          label: "Current version",
          render: (row) => {
            const current = currentKpiVersion(row)
            const versionId = readNumber(row, ["currentVersionId", "current_version_id"])
            const number = readString(current, ["versionNumber", "version_number"])
            return number
              ? `v${number}${versionId !== null ? ` · #${versionId}` : ""}`
              : versionId !== null
                ? `#${versionId}`
                : "—"
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
          render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} />,
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
                  openCreate("kpi-edit", seedKpiDefinitionForm(row))
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation()
                  openCreate("kpi-version", seedKpiVersionForm(row))
                }}
              >
                New version
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation()
                  const id = rowId(row)
                  if (!id || !window.confirm(`Archive KPI ${optionLabel(row)}?`)) return
                  void runAction(`delete-kpi-${id}`, (token) => deletePerformanceKpi(token, id), "KPI archived.")
                }}
              >
                Delete
              </button>
            </div>
          ),
        },
      ]
    }
    if (setupTab === "years") {
      return [
        {
          key: "year",
          label: "Year",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">{readString(row, ["code"])}</p>
            </div>
          ),
        },
        {
          key: "dates",
          label: "Dates",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{formatDate(row.startDate ?? row.start_date)}</p>
              <p className="text-muted-foreground">{formatDate(row.endDate ?? row.end_date)}</p>
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
          render: (row) => {
            const id = rowId(row)
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `gen-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void runAction(`gen-${id}`, (token) => generatePerformancePeriods(token, id), "Periods generated.")
                  }}
                >
                  {busyId === `gen-${id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : "Generate periods"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `agg-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void runAction(
                      `agg-${id}`,
                      (token) => calculatePerformanceAggregates(token, id, "MONTHLY"),
                      "Aggregates calculated.",
                    )
                  }}
                >
                  {busyId === `agg-${id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : "Aggregates"}
                </button>
              </div>
            )
          },
        },
      ]
    }
    if (setupTab === "periods") {
      return [
        {
          key: "period",
          label: "Period",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">{prettify(readString(row, ["periodType", "period_type"], "MONTHLY"))}</p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} />,
        },
        {
          key: "dates",
          label: "Window",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{formatDate(row.startDate ?? row.start_date)}</p>
              <p className="text-muted-foreground">{formatDate(row.endDate ?? row.end_date)}</p>
            </div>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row)
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `assign-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void runAction(`assign-${id}`, (token) => createPerformancePeriodAssignments(token, id), "Assignments created.")
                  }}
                >
                  {busyId === `assign-${id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : "Assign"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `sync-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void runAction(`sync-${id}`, (token) => syncPerformanceSystemKpis(token, id), "System KPIs synced.")
                  }}
                >
                  {busyId === `sync-${id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : "Sync KPIs"}
                </button>
              </div>
            )
          },
        },
      ]
    }
    if (setupTab === "scorecards") {
      return [
        {
          key: "name",
          label: "Scorecard",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">{readString(row, ["code"])}</p>
            </div>
          ),
        },
        {
          key: "components",
          label: "Components",
          render: (row) => String(asRecordArray(row.components).filter((item) => item.enabled !== false).length),
        },
        {
          key: "default",
          label: "Default",
          render: (row) => (row.isDefault || row.is_default ? "Yes" : "No"),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} />,
        },
      ]
    }
    if (setupTab === "workflows") {
      return [
        {
          key: "name",
          label: "Workflow",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">{readString(row, ["code"])}</p>
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
            const departmentId = readNumber(row, ["appliesToDepartmentId", "applies_to_department_id"])
            const positionId = readNumber(row, ["appliesToPositionId", "applies_to_position_id"])
            if (departmentId !== null) return `Dept #${departmentId}`
            if (positionId !== null) return `Position #${positionId}`
            return "Company default"
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
          render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} />,
        },
      ]
    }
    return [
      {
        key: "name",
        label: "Name",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">{optionLabel(row)}</p>
            <p className="text-xs text-muted-foreground">{readString(row, ["code", "category"])}</p>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} />,
      },
      {
        key: "updated",
        label: "Updated",
        render: (row) => formatDate(row.updatedAt ?? row.updated_at),
      },
    ]
  }, [activeTab, busyId, canActivatePeriod, canClosePeriod, setupTab])

  const createLabel =
    createMode === "year"
      ? "New financial year"
      : createMode === "period"
        ? "New performance period"
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
                            : createMode === "feedback"
                              ? "Invite 360 feedback"
                            : createMode === "reopen"
                              ? "Reopen review"
                              : "Review milestone"

  if (actor.ready && !canAccess) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">Performance setup</h1>
        <p className="text-sm text-muted-foreground">
          This HR workspace is available, but the signed-in account is still being
          treated as employee-only. Open Roles, confirm HR Manager has company
          dashboard access, then sign out and sign in again.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {activeTab === "overview" ? (
        <>
          <header className="flex flex-col gap-3 border-b border-border px-1 pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Performance</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Overview</h1>
              <p className="mt-1 text-sm text-muted-foreground">Monitor review cycles, employee plans, and performance work in one place.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative hidden sm:block">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={overviewSearch}
                  onChange={(event) => setOverviewSearch(event.target.value)}
                  placeholder="Find performance work"
                  className="h-9 w-56 rounded-lg border border-border bg-muted/30 pl-9 pr-3 text-xs text-foreground outline-none transition focus:border-primary"
                />
              </label>
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                Refresh
              </button>
            </div>
          </header>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Average score", value: averageScore === null ? "—" : `${Math.round(averageScore)}%`, hint: "Across published reviews", icon: GaugeIcon },
              { label: "Open reviews", value: openReviews, hint: "Waiting on a cycle step", icon: Clock3Icon },
              { label: "Completed", value: completionRate === null ? "—" : `${Math.round(completionRate)}%`, hint: "Published versus assigned", icon: CheckCircle2Icon },
              { label: "Improvement plans", value: pipCount, hint: `${developmentPlanCount} development · ${pendingFeedbackCount} feedback`, icon: ListChecksIcon },
            ].map((metric) => {
              const Icon = metric.icon
              return (
                <article key={metric.label} className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex size-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="size-1.5 rounded-full bg-primary" />
                  </div>
                  <p className="mt-5 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{metric.value}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{metric.label}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">{metric.hint}</p>
                </article>
              )
            })}
          </div>

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Performance timeline</h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {currentPeriod ? `Current cycle · ${optionLabel(currentPeriod)}` : "Review periods across the company cycle"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className={secondaryButtonClass} onClick={() => setOverviewStatus("ALL")}>
                  <SlidersHorizontalIcon className="size-4" /> Clear filter
                </button>
                {canCreatePerformance ? (
                  <button type="button" className={primaryButtonClass} onClick={() => window.location.assign("/dashboard/performance/plans")}>
                    <PlusIcon className="size-4" /> New plan
                  </button>
                ) : null}
              </div>
            </div>
            <div className="overflow-x-auto p-3">
              <div className="min-w-[900px] overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-[180px_repeat(6,minmax(110px,1fr))] bg-muted/35 text-[10px] font-medium text-muted-foreground">
                  <div className="px-3 py-2.5">Review period</div>
                  {PERFORMANCE_TIMELINE_STAGES.map((stage) => (
                    <div key={stage.label} className="border-l border-border px-2 py-2.5 text-center">{stage.label}</div>
                  ))}
                </div>
                {(periods.length > 0 ? periods.slice(0, 7) : [currentPeriod].filter(Boolean) as AdminRecord[]).map((period) => {
                  const status = readString(period, ["status"], "DRAFT").toUpperCase()
                  return (
                    <button
                      type="button"
                      key={rowId(period) || optionLabel(period)}
                      onClick={() => { setDetailRecord(period); setDetailOpen(true) }}
                      className="grid w-full grid-cols-[180px_repeat(6,minmax(110px,1fr))] border-t border-border text-left transition first:border-t-0 hover:bg-primary/[0.03]"
                    >
                      <div className="min-w-0 px-3 py-3">
                        <p className="truncate text-xs font-semibold text-foreground">{optionLabel(period)}</p>
                        <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{formatDate(period.startDate ?? period.start_date)} – {formatDate(period.endDate ?? period.end_date)}</p>
                      </div>
                      {PERFORMANCE_TIMELINE_STAGES.map((stage) => {
                        const active = stage.statuses.includes(status as never)
                        return (
                          <div key={stage.label} className="flex items-center justify-center border-l border-border px-2 py-2">
                            {active ? (
                              <span className="inline-flex w-full items-center justify-center rounded-md border border-primary/25 bg-primary/10 px-2 py-2 text-[10px] font-semibold text-primary">
                                {prettify(status)}
                              </span>
                            ) : (
                              <span className="h-px w-full bg-border" />
                            )}
                          </div>
                        )
                      })}
                    </button>
                  )
                })}
                {!loading && periods.length === 0 ? (
                  <div className="flex min-h-28 items-center justify-center border-t border-border px-4 text-xs text-muted-foreground">No performance periods are available yet.</div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Performance work list</h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Periods, plans, development work, improvement plans, and appeals.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative sm:hidden">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input value={overviewSearch} onChange={(event) => setOverviewSearch(event.target.value)} placeholder="Search" className="h-8 w-36 rounded-lg border border-border bg-background pl-8 pr-2 text-[10px] outline-none focus:border-primary" />
                </label>
                <select value={overviewStatus} onChange={(event) => setOverviewStatus(event.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-[10px] text-foreground outline-none focus:border-primary">
                  <option value="ALL">All statuses</option>
                  {overviewStatuses.map((status) => <option key={status} value={status}>{prettify(status)}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-muted/30 text-[10px] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 font-medium">Due date</th>
                    <th className="px-3 py-2.5 font-medium">Progress</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overviewRecords.slice(0, 12).map((row, index) => {
                    const status = readString(row, ["status", "review_status", "reviewStatus"], "DRAFT").toUpperCase()
                    const progressValue = readNumber(row, ["progress", "progress_percentage", "completion_rate", "completionRate"])
                      ?? (["APPROVED", "COMPLETED", "CLOSED"].includes(status) ? 100 : 0)
                    return (
                      <tr key={`${readString(row, ["dashboard_kind"])}-${rowId(row) || index}`} className="cursor-pointer text-xs transition hover:bg-primary/[0.03]" onClick={() => { setDetailRecord(row); setDetailOpen(true) }}>
                        <td className="px-4 py-3 font-medium text-foreground">{optionLabel(row)}</td>
                        <td className="px-3 py-3 text-muted-foreground">{readString(row, ["dashboard_kind"], "Performance item")}</td>
                        <td className="px-3 py-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarDaysIcon className="size-3" />{formatDate(row["dueDate"] ?? row["due_date"] ?? row["endDate"] ?? row["end_date"])}</span></td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progressValue))}%` }} /></div>
                            <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(progressValue)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusChip value={status} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!loading && overviewRecords.length === 0 ? (
                <div className="flex min-h-36 items-center justify-center px-4 text-center text-xs text-muted-foreground">No performance work matches the current search and filter.</div>
              ) : null}
            </div>
          </section>
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
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
            {activeTab === "setup" && canCreatePerformance ? (
              <>
                {setupTab === "kpis" ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() =>
                      openCreate("kpi-version", kpis[0] ? seedKpiVersionForm(kpis[0]) : {})
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
                <button type="button" className={secondaryButtonClass} onClick={() => openCreate("generate-plan")}>
                  Generate from rules
                </button>
                <button type="button" className={primaryButtonClass} onClick={() => openCreate("plan")}>
                  <PlusIcon className="size-4" />
                  New plan
                </button>
              </>
            ) : null}
            {activeTab === "reviews" && canModerateReviews ? (
              <>
                <button type="button" className={secondaryButtonClass} onClick={() => openCreate("moderate")}>
                  Moderate
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => openCreate("reopen")}>
                  Reopen
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => openCreate("feedback", { relationship_type: "PEER", is_anonymous: "true" })}>
                  360 feedback
                </button>
                <button type="button" className={primaryButtonClass} onClick={() => openCreate("approve")}>
                  Approve
                </button>
              </>
            ) : null}
            {activeTab === "improvement" && canCreatePerformance ? (
              <button type="button" className={primaryButtonClass} onClick={() => openCreate("pip")}>
                <PlusIcon className="size-4" />
                New PIP
              </button>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === "setup" ? (
        <div className="flex flex-wrap gap-1.5">
          {SETUP_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSetupTab(tab.id)}
              className={cnTab(setupTab === tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          <SearchToggleField value={search} onChange={setSearch} placeholder="Search records" />
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
                if (!row) return
                setDetailRecord(row)
                setDetailOpen(true)
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{createLabel}</DialogTitle>
            <DialogDescription>Save this performance record.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-auto pr-1">
            {createMode === "year" ? (
              <>
                <Field label="Code"><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
                <Field label="Name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Start date"><input type="date" className={inputClass} value={form.start_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></Field>
                <Field label="End date"><input type="date" className={inputClass} value={form.end_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} /></Field>
                <Field label="Aggregation">
                  <select className={inputClass} value={form.annual_aggregation_method ?? ""} onChange={(event) => setForm((current) => ({ ...current, annual_aggregation_method: event.target.value }))}>
                    <option value="">Default</option>
                    {AGGREGATION_METHODS.map((item) => (
                      <option key={item} value={item}>{prettify(item)}</option>
                    ))}
                  </select>
                </Field>
              </>
            ) : null}
            {createMode === "period" ? (
              <>
                <Field label="Financial year">
                  <select className={inputClass} value={form.financial_year_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, financial_year_id: event.target.value }))}>
                    <option value="">Select financial year</option>
                    {years.map((year) => <option key={rowId(year)} value={rowId(year)}>{optionLabel(year)}</option>)}
                  </select>
                </Field>
                <Field label="Name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Description"><textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <Field label="Period type">
                  <select className={inputClass} value={form.period_type ?? "MONTHLY"} onChange={(event) => setForm((current) => ({ ...current, period_type: event.target.value }))}>
                    {PERIOD_TYPES.map((item) => <option key={item} value={item}>{prettify(item)}</option>)}
                  </select>
                </Field>
                <Field label="Sequence"><input type="number" min="1" className={inputClass} value={form.sequence_number ?? ""} onChange={(event) => setForm((current) => ({ ...current, sequence_number: event.target.value }))} /></Field>
                <Field label="Start date"><input type="date" className={inputClass} value={form.start_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></Field>
                <Field label="End date"><input type="date" className={inputClass} value={form.end_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "kpi" || createMode === "kpi-edit" || createMode === "kpi-version" ? (
              <>
                {createMode === "kpi-version" ? (
                  <>
                    <Field label="KPI">
                      <select
                        className={inputClass}
                        value={form.kpi_id ?? ""}
                        onChange={(event) => {
                          const next = kpis.find((row) => rowId(row) === event.target.value)
                          setForm(next ? seedKpiVersionForm(next) : { ...form, kpi_id: event.target.value })
                        }}
                      >
                        <option value="">Select KPI</option>
                        {kpis.map((kpi) => (
                          <option key={rowId(kpi)} value={rowId(kpi)}>
                            {readString(kpi, ["code"])} · {optionLabel(kpi)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="text-sm text-muted-foreground">
                      Creates a new version of the selected KPI. Templates, rules, and plans can pick it after save.
                    </p>
                  </>
                ) : null}
                <Field label="Code"><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
                <Field label="Name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Category"><input className={inputClass} value={form.category ?? ""} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} /></Field>
                <Field label="Description"><textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <Field label="Unit"><input className={inputClass} value={form.measurement_unit ?? ""} onChange={(event) => setForm((current) => ({ ...current, measurement_unit: event.target.value }))} /></Field>
                <Field label="Direction">
                  <select className={inputClass} value={form.measurement_direction ?? "HIGHER_IS_BETTER"} onChange={(event) => setForm((current) => ({ ...current, measurement_direction: event.target.value }))}>
                    {MEASUREMENT_DIRECTIONS.map((item) => <option key={item} value={item}>{prettify(item)}</option>)}
                  </select>
                </Field>
                <Field label="Formula">
                  <select className={inputClass} value={form.scoring_formula ?? "PERCENT_TO_TARGET"} onChange={(event) => setForm((current) => ({ ...current, scoring_formula: event.target.value }))}>
                    {SCORING_FORMULAS.map((item) => <option key={item} value={item}>{prettify(item)}</option>)}
                  </select>
                </Field>
                <Field label="Data source">
                  <select className={inputClass} value={form.data_source_type ?? "MANUAL_EMPLOYEE"} onChange={(event) => setForm((current) => ({ ...current, data_source_type: event.target.value }))}>
                    {DATA_SOURCES.map((item) => <option key={item} value={item}>{prettify(item)}</option>)}
                  </select>
                </Field>
                <Field label="Default target"><input className={inputClass} value={form.default_target_value ?? ""} onChange={(event) => setForm((current) => ({ ...current, default_target_value: event.target.value }))} /></Field>
                <Field label="Frequency">
                  <select className={inputClass} value={form.frequency ?? "MONTHLY"} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}>
                    {FREQUENCIES.map((item) => <option key={item} value={item}>{prettify(item)}</option>)}
                  </select>
                </Field>
              </>
            ) : null}
            {createMode === "template" || createMode === "rule" || createMode === "plan" ? (
              <Field label="KPI version">
                <select
                  className={inputClass}
                  value={form.kpi_definition_version_id ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, kpi_definition_version_id: event.target.value }))
                  }
                >
                  <option value="">Select a published KPI version</option>
                  {kpiVersionOptions(kpis).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {createMode === "template" ? (
              <>
                <Field label="Code"><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
                <Field label="Name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Weight"><input className={inputClass} value={form.weight ?? ""} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></Field>
                <Field label="Target"><input className={inputClass} value={form.target_value ?? ""} onChange={(event) => setForm((current) => ({ ...current, target_value: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "rule" ? (
              <>
                <Field label="Name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Financial year">
                  <select className={inputClass} value={form.financial_year_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, financial_year_id: event.target.value }))}>
                    <option value="">Any year</option>
                    {years.map((year) => (
                      <option key={rowId(year)} value={rowId(year)}>{optionLabel(year)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority"><input className={inputClass} value={form.priority ?? ""} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "competency" ? (
              <>
                <Field label="Template code"><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
                <Field label="Template name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Item code"><input className={inputClass} value={form.item_code ?? ""} onChange={(event) => setForm((current) => ({ ...current, item_code: event.target.value }))} /></Field>
                <Field label="Item name"><input className={inputClass} value={form.item_name ?? ""} onChange={(event) => setForm((current) => ({ ...current, item_name: event.target.value }))} /></Field>
                <Field label="Weight"><input className={inputClass} value={form.item_weight ?? ""} onChange={(event) => setForm((current) => ({ ...current, item_weight: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "scale" ? (
              <>
                <Field label="Scale code"><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
                <Field label="Scale name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Band code"><input className={inputClass} value={form.band_code ?? ""} onChange={(event) => setForm((current) => ({ ...current, band_code: event.target.value }))} /></Field>
                <Field label="Band label"><input className={inputClass} value={form.band_label ?? ""} onChange={(event) => setForm((current) => ({ ...current, band_label: event.target.value }))} /></Field>
                <Field label="Band min"><input className={inputClass} value={form.band_min ?? "0"} onChange={(event) => setForm((current) => ({ ...current, band_min: event.target.value }))} /></Field>
                <Field label="Band max"><input className={inputClass} value={form.band_max ?? "100"} onChange={(event) => setForm((current) => ({ ...current, band_max: event.target.value }))} /></Field>
              </>
            ) : null}
            {activeTab === "development" && canCreatePerformance ? (
              <button type="button" className={primaryButtonClass} onClick={() => openCreate("development")}>
                <PlusIcon className="size-4" />
                New plan
              </button>
            ) : null}
            {createMode === "scorecard" ? (
              <>
                <Field label="Scorecard code"><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
                <Field label="Scorecard name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Description"><textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Default">
                    <select className={inputClass} value={form.is_default ?? "true"} onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.value }))}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                  <Field label="Effective from"><input type="date" className={inputClass} value={form.effective_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></Field>
                  <Field label="Effective to"><input type="date" className={inputClass} value={form.effective_to ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_to: event.target.value }))} /></Field>
                </div>
                <ScorecardComponentBuilder
                  components={scorecardComponents}
                  onChange={setScorecardComponents}
                />
              </>
            ) : null}
            {createMode === "workflow" ? (
              <>
                <Field label="Workflow code"><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
                <Field label="Workflow name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Description"><textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Default">
                    <select className={inputClass} value={form.is_default ?? "true"} onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.value }))}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                  <Field label="Department ID"><input className={inputClass} inputMode="numeric" value={form.applies_to_department_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, applies_to_department_id: event.target.value }))} /></Field>
                  <Field label="Position ID"><input className={inputClass} inputMode="numeric" value={form.applies_to_position_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, applies_to_position_id: event.target.value }))} /></Field>
                </div>
                <Field label="Review type"><input className={inputClass} value={form.review_type ?? ""} onChange={(event) => setForm((current) => ({ ...current, review_type: event.target.value }))} /></Field>
                <WorkflowStepBuilder steps={workflowSteps} onChange={setWorkflowSteps} />
              </>
            ) : null}
            {createMode === "plan" || createMode === "generate-plan" ? (
              <>
                <Field label="Employee">
                  <select className={inputClass} value={form.employee_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))}>
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={rowId(employee)} value={rowId(employee)}>{employeeLabel(employee)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Financial year">
                  <select className={inputClass} value={form.financial_year_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, financial_year_id: event.target.value }))}>
                    <option value="">Select year</option>
                    {years.map((year) => (
                      <option key={rowId(year)} value={rowId(year)}>{optionLabel(year)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Effective from"><input type="date" className={inputClass} value={form.effective_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></Field>
                <Field label="Effective to"><input type="date" className={inputClass} value={form.effective_to ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_to: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "plan" ? (
              <Field label="Weight"><input className={inputClass} value={form.weight ?? ""} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></Field>
            ) : null}
            {createMode === "development" ? (
              <>
                <Field label="Employee">
                  <select className={inputClass} value={form.employee_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))}>
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={rowId(employee)} value={rowId(employee)}>{employeeLabel(employee)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Plan title"><input className={inputClass} value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Description"><textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Start date"><input type="date" className={inputClass} value={form.start_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></Field>
                  <Field label="Target date"><input type="date" className={inputClass} value={form.target_completion_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, target_completion_date: event.target.value }))} /></Field>
                  <Field label="Source review ID"><input className={inputClass} inputMode="numeric" value={form.source_review_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, source_review_id: event.target.value }))} /></Field>
                </div>
                <Field label="First goal"><input className={inputClass} value={form.goal_title ?? ""} onChange={(event) => setForm((current) => ({ ...current, goal_title: event.target.value }))} /></Field>
                <Field label="Goal notes"><textarea className={textareaClass} value={form.goal_description ?? ""} onChange={(event) => setForm((current) => ({ ...current, goal_description: event.target.value }))} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Goal category"><input className={inputClass} value={form.goal_category ?? ""} onChange={(event) => setForm((current) => ({ ...current, goal_category: event.target.value }))} /></Field>
                  <Field label="Goal target date"><input type="date" className={inputClass} value={form.goal_target_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, goal_target_date: event.target.value }))} /></Field>
                </div>
                <Field label="Success measure"><textarea className={textareaClass} value={form.success_measure ?? ""} onChange={(event) => setForm((current) => ({ ...current, success_measure: event.target.value }))} /></Field>
                <Field label="Support required"><textarea className={textareaClass} value={form.support_required ?? ""} onChange={(event) => setForm((current) => ({ ...current, support_required: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "pip" ? (
              <>
                <Field label="Review ID"><input className={inputClass} value={form.review_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, review_id: event.target.value }))} /></Field>
                <Field label="Summary"><textarea className={textareaClass} value={form.summary ?? ""} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} /></Field>
                <Field label="Objectives (one per line)"><textarea className={textareaClass} value={form.objectives ?? ""} onChange={(event) => setForm((current) => ({ ...current, objectives: event.target.value }))} /></Field>
                <Field label="First milestone"><input className={inputClass} value={form.milestone_title ?? ""} onChange={(event) => setForm((current) => ({ ...current, milestone_title: event.target.value }))} /></Field>
                <Field label="Milestone due"><input type="date" className={inputClass} value={form.milestone_due ?? ""} onChange={(event) => setForm((current) => ({ ...current, milestone_due: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "moderate" || createMode === "reopen" ? (
              <>
                <Field label="Review ID"><input className={inputClass} value={form.review_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, review_id: event.target.value }))} /></Field>
                <Field label="Reason"><textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "moderate" ? (
              <Field label="Final score"><input className={inputClass} value={form.final_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, final_score: event.target.value }))} /></Field>
            ) : null}
            {createMode === "approve" ? (
              <>
                <Field label="Period assignment ID"><input className={inputClass} value={form.period_assignment_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, period_assignment_id: event.target.value }))} /></Field>
                <Field label="HR comment"><textarea className={textareaClass} value={form.hr_review ?? ""} onChange={(event) => setForm((current) => ({ ...current, hr_review: event.target.value }))} /></Field>
                <Field label="Adjustment score"><input className={inputClass} value={form.adjustment_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, adjustment_score: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "feedback" ? (
              <>
                <Field label="Review ID"><input className={inputClass} value={form.review_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, review_id: event.target.value }))} /></Field>
                <Field label="Rater employee IDs">
                  <textarea
                    className={textareaClass}
                    placeholder="One ID per line, or comma-separated"
                    value={form.rater_employee_ids ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, rater_employee_ids: event.target.value }))}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Relationship">
                    <select className={inputClass} value={form.relationship_type ?? "PEER"} onChange={(event) => setForm((current) => ({ ...current, relationship_type: event.target.value }))}>
                      <option value="PEER">Peer</option>
                      <option value="SUBORDINATE">Subordinate</option>
                      <option value="STAKEHOLDER">Stakeholder</option>
                      <option value="MANAGER">Manager</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                  <Field label="Due date"><input type="date" className={inputClass} value={form.due_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} /></Field>
                  <Field label="Anonymous">
                    <select className={inputClass} value={form.is_anonymous ?? "true"} onChange={(event) => setForm((current) => ({ ...current, is_anonymous: event.target.value }))}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                </div>
              </>
            ) : null}
            {createMode === "milestone" ? (
              <>
                <Field label="Milestone ID"><input className={inputClass} value={form.milestone_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, milestone_id: event.target.value }))} /></Field>
                <Field label="Comment"><textarea className={textareaClass} value={form.comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} /></Field>
              </>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="button" className={primaryButtonClass} onClick={() => void onCreate()} disabled={saving}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function ScorecardComponentBuilder({
  components,
  onChange,
}: {
  components: ScorecardComponentDraft[]
  onChange: React.Dispatch<React.SetStateAction<ScorecardComponentDraft[]>>
}) {
  const total = scorecardWeightTotal(components)
  const totalState =
    Math.round(total * 100) / 100 === 100
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"

  function updateComponent(id: string, patch: Partial<ScorecardComponentDraft>) {
    onChange((current) =>
      current.map((component) =>
        component.id === id ? { ...component, ...patch } : component,
      ),
    )
  }

  function removeComponent(id: string) {
    onChange((current) => current.filter((component) => component.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Components</h3>
          <p className="text-xs text-muted-foreground">Enabled weights must total 100.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${totalState}`}>
            {total.toFixed(total % 1 === 0 ? 0 : 2)}%
          </span>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => onChange((current) => [...current, createScorecardComponentDraft()])}
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
                <span className="font-semibold text-muted-foreground lg:hidden">Code</span>
                <input
                  className={inputClass}
                  value={component.code}
                  onChange={(event) => updateComponent(component.id, { code: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">Label</span>
                <input
                  className={inputClass}
                  value={component.label}
                  onChange={(event) => updateComponent(component.id, { label: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">Type</span>
                <select
                  className={inputClass}
                  value={component.type}
                  onChange={(event) =>
                    updateComponent(component.id, {
                      type: event.target.value as ScorecardComponentDraft["type"],
                    })
                  }
                >
                  {SCORECARD_COMPONENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {prettify(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">Weight</span>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={component.weight}
                  onChange={(event) => updateComponent(component.id, { weight: event.target.value })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium lg:justify-center lg:border-0 lg:px-0">
                <span className="text-muted-foreground lg:hidden">Enabled</span>
                <input
                  type="checkbox"
                  checked={component.enabled}
                  onChange={(event) => updateComponent(component.id, { enabled: event.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium lg:justify-center lg:border-0 lg:px-0">
                <span className="text-muted-foreground lg:hidden">Required</span>
                <input
                  type="checkbox"
                  checked={component.required}
                  onChange={(event) => updateComponent(component.id, { required: event.target.checked })}
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
  )
}

function WorkflowStepBuilder({
  steps,
  onChange,
}: {
  steps: WorkflowStepDraft[]
  onChange: React.Dispatch<React.SetStateAction<WorkflowStepDraft[]>>
}) {
  function updateStep(id: string, patch: Partial<WorkflowStepDraft>) {
    onChange((current) =>
      current.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    )
  }

  function removeStep(id: string) {
    onChange((current) => current.filter((step) => step.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Approval chain</h3>
          <p className="text-xs text-muted-foreground">Steps run by ascending sequence number.</p>
        </div>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => onChange((current) => [...current, createWorkflowStepDraft(current.length + 1)])}
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
                <span className="font-semibold text-muted-foreground lg:hidden">Code</span>
                <input
                  className={inputClass}
                  value={step.code}
                  onChange={(event) => updateStep(step.id, { code: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">Label</span>
                <input
                  className={inputClass}
                  value={step.label}
                  onChange={(event) => updateStep(step.id, { label: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">Approver</span>
                <select
                  className={inputClass}
                  value={step.type}
                  onChange={(event) =>
                    updateStep(step.id, {
                      type: event.target.value as WorkflowStepDraft["type"],
                    })
                  }
                >
                  {WORKFLOW_STEP_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {prettify(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs lg:block">
                <span className="font-semibold text-muted-foreground lg:hidden">Sequence</span>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={step.sequenceNumber}
                  onChange={(event) => updateStep(step.id, { sequenceNumber: event.target.value })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium lg:justify-center lg:border-0 lg:px-0">
                <span className="text-muted-foreground lg:hidden">Required</span>
                <input
                  type="checkbox"
                  checked={step.required}
                  onChange={(event) => updateStep(step.id, { required: event.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium lg:justify-center lg:border-0 lg:px-0">
                <span className="text-muted-foreground lg:hidden">Final</span>
                <input
                  type="checkbox"
                  checked={step.canFinalize}
                  onChange={(event) => updateStep(step.id, { canFinalize: event.target.checked })}
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
  )
}

function cnTab(active: boolean) {
  return active
    ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold !text-white"
    : "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground"
}
