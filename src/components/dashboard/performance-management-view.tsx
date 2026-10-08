"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
import { useRouter } from "next/navigation"
import { Badge, Button as FluentButton, Input, ProgressBar, Tab, TabList } from "@fluentui/react-components"
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import {
  CalendarLtr20Regular as CalendarIcon,
  CheckmarkCircle20Regular as CompletedIcon,
  Clock20Regular as PendingIcon,
  Gauge20Regular as ScoreIcon,
  SearchSparkle20Regular as SearchIcon,
} from "@fluentui/react-icons"
import { toast } from "@/components/ui/fluent-toast-store"

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
  applyPerformanceKpiTemplate,
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
} from "@/lib/admin-api"
import { canAccessDashboardRoute, canPerformPermission } from "@/lib/dashboard-permissions"
import { forgetForbiddenRoute } from "@/lib/forbidden-routes"
import { readStoredSessionTokens } from "@/lib/session-client"
import { FluentSelect } from "@/components/ui/fluent-select"
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

const SETUP_TAB_GROUPS: Array<{ label: string; tabs: Array<{ id: SetupTab; label: string }> }> = [
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
]

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
const PERIOD_TYPES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL", "CUSTOM"] as const
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

function optionForId(rows: AdminRecord[], id: unknown) {
  if (id === null || id === undefined || id === "") return null
  return rows.find((row) => rowId(row) === String(id)) ?? null
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
  const router = useRouter()
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
  const canReopenPeriod = canPerformPermission(actor.permissionLabels, {
    permissions: ["performance_periods:reopen"],
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
  const [managerSummary, setManagerSummary] = React.useState<AdminRecord | null>(null)
  const [years, setYears] = React.useState<AdminRecord[]>([])
  const [periods, setPeriods] = React.useState<AdminRecord[]>([])
  const [kpis, setKpis] = React.useState<AdminRecord[]>([])
  const [templates, setTemplates] = React.useState<AdminRecord[]>([])
  const [templateRoles, setTemplateRoles] = React.useState<AdminRecord[]>([])
  const [additionalTemplateItems, setAdditionalTemplateItems] = React.useState<Array<{ versionId: string; weight: string; target: string }>>([])
  const [applyTemplateId, setApplyTemplateId] = React.useState("")
  const [applyPeriodId, setApplyPeriodId] = React.useState("")
  const [applyPolicy, setApplyPolicy] = React.useState<"MERGE" | "SKIP" | "REPLACE">("MERGE")
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
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
  const [grades, setGrades] = React.useState<AdminRecord[]>([])
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
  const [periodActionResults, setPeriodActionResults] = React.useState<Record<string, { assignments?: number; synced?: number }>>({})
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
        const [summary, yearRows, periodRows, planRows, developmentRows, pipRows, appealRows, teamSummary] = await Promise.all([
          optional(getPerformanceDashboard(token), null),
          optional(listPerformanceFinancialYears(token), [] as AdminRecord[]),
          optional(listPerformancePeriods(token), [] as AdminRecord[]),
          optional(listPerformancePlans(token), [] as AdminRecord[]),
          optional(listPerformanceDevelopmentPlans(token), [] as AdminRecord[]),
          optional(listPerformanceImprovementPlans(token), [] as AdminRecord[]),
          optional(listPerformanceAppeals(token), [] as AdminRecord[]),
          optional(getManagerPerformanceSummary(token), null),
        ])
        setDashboard(summary)
        setYears(yearRows)
        setPeriods(periodRows)
        setPlans(planRows)
        setDevelopmentPlans(developmentRows)
        setPips(pipRows)
        setAppeals(appealRows)
        setManagerSummary(teamSummary)
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
          const [templateRows, kpiRows, periodRows, rolePage] = await Promise.all([
            listPerformanceKpiTemplates(token),
            listPerformanceKpis(token),
            listPerformancePeriods(token),
            listRolesCatalog(token),
          ])
          setTemplates(templateRows)
          setKpis(kpiRows)
          setPeriods(periodRows)
          setTemplateRoles(rolePage.rows)
        } else if (setupTab === "rules") {
          const [ruleRows, kpiRows, yearRows, branchPage, departmentPage, positionPage, gradeRows, employeePage] = await Promise.all([
            listPerformanceKpiRules(token),
            listPerformanceKpis(token),
            listPerformanceFinancialYears(token),
            listBranches(token, { limit: 100 }).catch(() => ({ rows: [] as AdminRecord[] })),
            listDepartments(token, { limit: 100 }).catch(() => ({ rows: [] as AdminRecord[] })),
            listPositions(token, { limit: 100 }).catch(() => ({ rows: [] as AdminRecord[] })),
            listEmployeeGrades(token).catch(() => [] as AdminRecord[]),
            listEmployees(token, { limit: 100 }).catch(() => ({ rows: [] as AdminRecord[] })),
          ])
          setRules(ruleRows)
          setKpis(kpiRows)
          setYears(yearRows)
          setBranches(branchPage.rows)
          setDepartments(departmentPage.rows)
          setPositions(positionPage.rows)
          setGrades(gradeRows)
          setEmployees(employeePage.rows)
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

  const managerTeamSize = readNumber(managerSummary, [
    "team_size",
    "teamSize",
    "direct_reports",
    "directReports",
    "direct_report_count",
    "directReportCount",
  ])
  const managerPendingReviews = readNumber(managerSummary, [
    "pending_reviews",
    "pendingReviews",
    "open_reviews",
    "openReviews",
  ])
  const managerAverageScore = readNumber(managerSummary, [
    "average_score",
    "averageScore",
    "avg_score",
    "avgScore",
  ])

  const activePeriods = periods.filter((period) => ["OPEN", "ACTIVE", "GOAL_SETTING", "IN_PROGRESS", "MID_REVIEW", "FINAL_REVIEW", "REOPENED"].includes(readString(period, ["status"], "DRAFT").toUpperCase()))
  const pendingPlans = plans.filter((plan) => ["DRAFT", "PENDING", "PENDING_APPROVAL", "RETURNED"].includes(readString(plan, ["status"], "DRAFT").toUpperCase())).length
  const openAppeals = appeals.filter((appeal) => !["CLOSED", "RESOLVED", "REJECTED"].includes(readString(appeal, ["status"], "OPEN").toUpperCase())).length
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
    }).sort((left, right) => {
      const timestamp = (row: AdminRecord) => {
        const value = row.updatedAt ?? row.updated_at ?? row.createdAt ?? row.created_at
        const parsed = value ? new Date(String(value)).getTime() : 0
        return Number.isFinite(parsed) ? parsed : 0
      }
      return timestamp(right) - timestamp(left)
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
    if (mode === "template") setAdditionalTemplateItems([])
    setCreateMode(mode)
    setForm(
      mode === "period"
        ? { period_type: "MONTHLY", sequence_number: "1", max_weightage: "100", score_cap: "120", cooling_period_days: "0", allow_parallel: "true", ...seed }
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

  async function generatePeriodsForYear(yearId: string) {
    const token = readStoredToken()
    if (!token) return
    setBusyId(`gen-${yearId}`)
    try {
      const before = await listPerformancePeriods(token)
      await generatePerformancePeriods(token, yearId)
      const after = await listPerformancePeriods(token)
      const previousIds = new Set(before.map((period) => rowId(period)))
      const created = after.filter((period) => !previousIds.has(rowId(period))).length
      setPeriods(after)
      setSearch("")
      setSetupTab("periods")
      toast[created > 0 ? "success" : "info"](created > 0
        ? `${created} periods generated. They are listed under Periods.`
        : "No new periods were needed. Existing periods are listed under Periods.")
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not generate periods.")
    } finally {
      setBusyId("")
    }
  }

  async function runPeriodAction(periodId: string, action: "assign" | "sync") {
    const token = readStoredToken()
    if (!token) return
    setBusyId(`${action}-${periodId}`)
    try {
      const result = action === "assign"
        ? await createPerformancePeriodAssignments(token, periodId)
        : await syncPerformanceSystemKpis(token, periodId)
      const count = asRecordArray(result).length
      setPeriodActionResults((current) => ({
        ...current,
        [periodId]: { ...current[periodId], [action === "assign" ? "assignments" : "synced"]: count },
      }))
      if (count === 0) {
        toast.info(action === "assign"
          ? "No review assignments found. Create active performance plans for this year, then assign them to this period."
          : "No system KPI values were synced. Assign active plans with attendance, leave, activity, or field visit KPIs first.")
      } else {
        toast.success(action === "assign"
          ? `${count} review assignments are available for this period.`
          : `${count} system KPI values synced for this period.`)
      }
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
        if (!form.goal_setting_deadline || !form.mid_cycle_review_date || !form.final_review_deadline) {
          throw new Error("Goal-setting, mid-cycle, and final-review dates are required.")
        }
        await createPerformancePeriod(token, {
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
        const items = [
          { kpi_definition_version_id: Number(form.kpi_definition_version_id), weight: Number(form.weight), target_value: form.target_value ? Number(form.target_value) : undefined, manual_entry_allowed: form.manual_entry_allowed === "true", evidence_required: form.evidence_required === "true", notes: form.notes || undefined },
          ...additionalTemplateItems.map((item) => ({ kpi_definition_version_id: Number(item.versionId), weight: Number(item.weight), target_value: item.target ? Number(item.target) : undefined })),
        ]
        if (items.some((item) => !item.kpi_definition_version_id || !item.weight) || Math.abs(items.reduce((sum, item) => sum + item.weight, 0) - 100) > 0.001) throw new Error("Every template KPI needs a version and weight; weights must total 100.")
        if (!(form.applicable_role_ids || "").trim()) throw new Error("Choose at least one applicable role.")
        await createPerformanceKpiTemplate(token, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          review_cycle: form.review_cycle || undefined,
          applicable_role_ids: (form.applicable_role_ids || "").split(",").filter(Boolean).map(Number),
          items,
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
          branch_id: form.branch_id ? Number(form.branch_id) : undefined,
          department_id: form.department_id ? Number(form.department_id) : undefined,
          position_id: form.position_id ? Number(form.position_id) : undefined,
          grade_id: form.grade_id ? Number(form.grade_id) : undefined,
          employment_type: form.employment_type || undefined,
          employee_id: form.employee_id ? Number(form.employee_id) : undefined,
          review_cycle: form.review_cycle || undefined,
          template_code: form.template_code || undefined,
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
                    {busyId === `${code}-${format}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : format.toUpperCase()}
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
          render: (row) => <StatusChip value={readString(row, ["kpiPhase", "kpi_phase", "status"], "DRAFT")} />,
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
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `close-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void runAction(`close-${id}`, (token) => closePerformanceImprovementPlan(token, id), "Improvement plan closed.")
                  }}
                >
                  {busyId === `close-${id}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : "Close"}
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
            const versionId = readNumber(row, ["kpiDefinitionVersionId", "kpi_definition_version_id"])
            const version = kpiVersionOptions(kpis).find((item) => Number(item.id) === versionId)
            return version?.label ?? (versionId === null ? "—" : `Version #${versionId}`)
          },
        },
        {
          key: "scope",
          label: "Applies to",
          render: (row) => {
            const dimensions = [
              ["Year", years, readNumber(row, ["financialYearId", "financial_year_id"])],
              ["Branch", branches, readNumber(row, ["branchId", "branch_id"])],
              ["Department", departments, readNumber(row, ["departmentId", "department_id"])],
              ["Position", positions, readNumber(row, ["positionId", "position_id"])],
              ["Grade", grades, readNumber(row, ["gradeId", "grade_id"])],
              ["Employee", employees, readNumber(row, ["employeeId", "employee_id"])],
            ] as const
            const scope = dimensions.flatMap(([label, source, id]) => {
              if (id === null) return []
              const match = optionForId(source, id)
              return [`${label}: ${match ? optionLabel(match) : `#${id}`}`]
            })
            const employmentType = readString(row, ["employmentType", "employment_type"])
            const cycle = readString(row, ["reviewCycle", "review_cycle"])
            if (employmentType) scope.push(`Type: ${prettify(employmentType)}`)
            if (cycle) scope.push(`Cycle: ${prettify(cycle)}`)
            return scope.length ? scope.join(" · ") : "All employees"
          },
        },
        {
          key: "overrides",
          label: "Overrides",
          render: (row) => {
            const weight = readString(row, ["weightOverride", "weight_override"])
            const target = readString(row, ["targetOverride", "target_override"])
            return [weight ? `Weight ${weight}` : "", target ? `Target ${target}` : ""].filter(Boolean).join(" · ") || "—"
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
          render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} />,
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
                <FluentButton
                  type="button"
                  appearance="subtle"
                  size="small"
                  disabled={busyId === `gen-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void generatePeriodsForYear(id)
                  }}
                >
                  {busyId === `gen-${id}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : "Generate periods"}
                </FluentButton>
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
                  {busyId === `agg-${id}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : "Aggregates"}
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
          render: (row) => <StatusChip value={readString(row, ["kpiPhase", "kpi_phase", "status"], "DRAFT")} />,
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
            const status = readString(row, ["status"], "DRAFT")
            const phase = readString(row, ["kpiPhase", "kpi_phase"])
            return (
              <div className="flex flex-wrap gap-1">
                {canActivatePeriod && status === "DRAFT" ? (
                  <button type="button" className={actionButtonClass} disabled={busyId === `activate-${id}`} onClick={(event) => {
                    event.stopPropagation()
                    void runAction(`activate-${id}`, (token) => activatePerformancePeriod(token, id), "Performance period activated.")
                  }}>Activate</button>
                ) : null}
                {canClosePeriod && !["DRAFT", "LOCKED", "CANCELLED"].includes(status) ? (
                  <button type="button" className={actionButtonClass} disabled={busyId === `close-period-${id}`} onClick={(event) => {
                    event.stopPropagation()
                    void runAction(`close-period-${id}`, (token) => closePerformancePeriod(token, id), "Performance period locked.")
                  }}>Lock</button>
                ) : null}
                {canReopenPeriod && status === "LOCKED" && ["LOCKED", "CLOSED"].includes(phase) ? (
                  <button type="button" className={actionButtonClass} disabled={busyId === `reopen-period-${id}`} onClick={(event) => {
                    event.stopPropagation()
                    const reason = window.prompt("Reason for reopening this KPI cycle")?.trim()
                    if (!reason) return
                    void runAction(`reopen-period-${id}`, (token) => reopenPerformancePeriod(token, id, reason), "KPI cycle reopened.")
                  }}>Reopen</button>
                ) : null}
                <FluentButton
                  type="button"
                  appearance="subtle"
                  size="small"
                  disabled={busyId === `assign-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void runPeriodAction(id, "assign")
                  }}
                >
                  {busyId === `assign-${id}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : periodActionResults[id]?.assignments ? `Assignments (${periodActionResults[id].assignments})` : "Assign plans"}
                </FluentButton>
                <FluentButton
                  type="button"
                  appearance="subtle"
                  size="small"
                  disabled={busyId === `sync-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void runPeriodAction(id, "sync")
                  }}
                >
                  {busyId === `sync-${id}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : periodActionResults[id]?.synced ? `Synced (${periodActionResults[id].synced})` : "Sync system KPIs"}
                </FluentButton>
                {periodActionResults[id]?.assignments === 0 ? <span className="w-full text-xs text-amber-700 dark:text-amber-300">No active plans assigned for this period.</span> : null}
                {periodActionResults[id]?.synced === 0 ? <span className="w-full text-xs text-amber-700 dark:text-amber-300">No eligible system KPI values to sync.</span> : null}
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
  }, [activeTab, branches, busyId, canActivatePeriod, canClosePeriod, departments, employees, grades, kpis, positions, setupTab, years])

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
          <div className="flex flex-col gap-4 space-y-5 px-1 pb-2 pt-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <Badge appearance="tint" color="brand" size="small">Performance workspace</Badge>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Overview</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">A snapshot of cycles, plans, reviews, and follow-up work.</p>
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
                <FluentButton appearance="secondary" size="small" disabled={loading} onClick={() => void load()} icon={loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}>
                  Refresh
                </FluentButton>
              </div>
            </div>
            {error ? <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p> : null}
            <div className="grid gap-0 border-y border-border sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Active cycles", value: activePeriods.length, detail: `${periods.length} total periods`, icon: CalendarIcon },
                { label: "Open reviews", value: openReviews, detail: "Waiting for a review step", icon: PendingIcon },
                { label: "Completion", value: completionRate === null ? "Pending" : `${Math.round(completionRate)}%`, detail: "Reviews completed", icon: CompletedIcon },
                { label: "Average score", value: averageScore === null ? "Pending" : `${Math.round(averageScore)}%`, detail: "Across scored reviews", icon: ScoreIcon },
              ].map((metric) => {
                const Icon = metric.icon
                return <div key={metric.label} className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:px-5 xl:border-b-0 xl:border-r xl:last:border-r-0">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2"><Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="truncate text-sm font-semibold text-foreground">{metric.label}</span></p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{metric.detail}</p>
                  </div>
                  <p className={cn("performance-overview-metric-value shrink-0 text-right font-extrabold tracking-[-0.06em] tabular-nums text-primary", metric.value === "Pending" ? "performance-overview-metric-value-pending" : String(metric.value).length > 2 ? "performance-overview-metric-value-long" : "")}>{metric.value}</p>
                </div>
              })}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
            <section className="min-w-0 border-t border-border pt-2">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Cycle snapshot</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Review windows and their current phase.</p>
                </div>
                <FluentButton appearance="subtle" size="small" onClick={() => router.push("/dashboard/performance/setup")}>View periods</FluentButton>
              </div>
              <div className="divide-y divide-border px-4">
                {periods.slice(0, 4).map((period) => {
                  const status = readString(period, ["kpiPhase", "kpi_phase", "status"], "DRAFT").toUpperCase()
                  return <button key={rowId(period)} type="button" className="w-full py-3 text-left transition-colors hover:bg-muted/30" onClick={() => { setDetailRecord(period); setDetailOpen(true) }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-foreground">{optionLabel(period)}</p>
                      <StatusChip value={status} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(period.startDate ?? period.start_date)} – {formatDate(period.endDate ?? period.end_date)}</p>
                  </button>
                })}
                {!loading && periods.length === 0 ? <p className="col-span-full px-2 py-8 text-center text-sm text-muted-foreground">No periods yet. Create a year and generate periods in Setup.</p> : null}
              </div>
            </section>

            <section className="min-w-0 border-t border-border pt-2">
              <div className="border-b border-border px-4 py-4">
                <h2 className="text-base font-semibold text-foreground">Needs attention</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Open items across this performance workspace.</p>
              </div>
              <div className="divide-y divide-border px-4">
                {[
                  { label: "Plans to prepare", count: pendingPlans, url: "/dashboard/performance/plans" },
                  { label: "Reviews awaiting action", count: openReviews, url: "/dashboard/performance/reviews" },
                  { label: "Open appeals", count: openAppeals, url: "/dashboard/performance/reviews" },
                  { label: "Improvement plans", count: pipCount, url: "/dashboard/performance/improvement" },
                  { label: "Development plans", count: developmentPlanCount, url: "/dashboard/performance/development" },
                ].map((item) => <button key={item.label} type="button" onClick={() => router.push(item.url)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:text-primary">
                  <span className="text-sm text-foreground">{item.label}</span>
                  <Badge appearance="tint" color={Number(item.count) > 0 ? "warning" : "subtle"}>{item.count}</Badge>
                </button>)}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
            <section className="min-w-0 border-t border-border pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Recent performance work</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Periods, plans, development, improvement, and appeals.</p>
                </div>
                <FluentSelect ariaLabel="Filter work by status" size="small" value={overviewStatus} onChange={setOverviewStatus} options={[{ value: "ALL", label: "All statuses" }, ...overviewStatuses.map((status) => ({ value: status, label: prettify(status) }))]} />
              </div>
              <div className="divide-y divide-border px-4">
                {overviewRecords.slice(0, 6).map((row, index) => {
                  const status = readString(row, ["status", "review_status", "reviewStatus"], "DRAFT").toUpperCase()
                  const progress = readNumber(row, ["progress", "progress_percentage", "completion_rate", "completionRate"])
                  return <button key={`${readString(row, ["dashboard_kind"])}-${rowId(row) || index}`} type="button" onClick={() => { setDetailRecord(row); setDetailOpen(true) }} className="flex w-full min-w-0 items-center gap-3 py-3 text-left hover:bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{optionLabel(row)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{readString(row, ["dashboard_kind"])} · {formatDate(row["dueDate"] ?? row["due_date"] ?? row["endDate"] ?? row["end_date"])}</p>
                      {progress !== null ? <ProgressBar value={Math.min(1, Math.max(0, progress / 100))} thickness="medium" className="mt-2 max-w-48" /> : null}
                    </div>
                    <StatusChip value={status} />
                  </button>
                })}
                {!loading && overviewRecords.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No work matches this search or status.</p> : null}
              </div>
              {overviewRecords.length > 6 ? <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Showing 6 of {overviewRecords.length} items. Open the relevant section for the full list.</p> : null}
            </section>

            <div className="space-y-6">
              <section className="border-t border-border px-4 pt-4">
                <h2 className="text-base font-semibold text-foreground">Team snapshot</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Manager view of reporting and review progress.</p>
                {managerSummary && (managerTeamSize !== null || managerPendingReviews !== null || managerAverageScore !== null) ? <div className="mt-4 grid grid-cols-3 gap-2 border-y border-border py-3">
                  {[
                    { label: "People", value: managerTeamSize ?? 0 },
                    { label: "Pending", value: managerPendingReviews ?? 0 },
                    { label: "Avg. score", value: managerAverageScore === null ? "Pending" : `${Math.round(managerAverageScore)}%` },
                  ].map((metric) => <div key={metric.label} className="p-2 text-center"><p className="text-lg font-semibold tabular-nums text-foreground">{metric.value}</p><p className="text-[11px] text-muted-foreground">{metric.label}</p></div>)}
                </div> : <p className="mt-4 text-sm text-muted-foreground">Team summary is unavailable for this account.</p>}
                <FluentButton appearance="subtle" size="small" className="mt-3 self-start" onClick={() => router.push("/dashboard/me/performance/team")}>View team</FluentButton>
              </section>
              <section className="border-t border-border px-4 pt-4">
                <h2 className="text-base font-semibold text-foreground">Next steps</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Continue the performance workflow.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canCreatePerformance ? <FluentButton appearance="primary" size="small" onClick={() => router.push("/dashboard/performance/setup")}>Set up cycle</FluentButton> : null}
                  <FluentButton appearance="secondary" size="small" onClick={() => router.push("/dashboard/performance/plans")}>Open plans</FluentButton>
                  <FluentButton appearance="secondary" size="small" onClick={() => router.push("/dashboard/performance/reports")}>Reports</FluentButton>
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
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
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
        <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
            {SETUP_TAB_GROUPS.map((group) => (
              <div key={group.label} className="min-w-0 rounded-lg border border-border/60 bg-background p-2">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.label}
                </p>
                <TabList size="small" selectedValue={group.tabs.some((tab) => tab.id === setupTab) ? setupTab : undefined} onTabSelect={(_event, data) => setSetupTab(data.value as SetupTab)} className="flex max-w-full flex-wrap gap-1">
                  {group.tabs.map((tab) => <Tab key={tab.id} value={tab.id}>{tab.label}</Tab>)}
                </TabList>
              </div>
            ))}
        </div>
      ) : null}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          {activeTab === "setup" && setupTab === "templates" ? <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
            <FluentSelect ariaLabel="KPI template" value={applyTemplateId} onChange={setApplyTemplateId} options={[{ value: "", label: "Choose template" }, ...templates.map((row) => ({ value: rowId(row), label: optionLabel(row) }))]} />
            <FluentSelect ariaLabel="KPI cycle" value={applyPeriodId} onChange={setApplyPeriodId} options={[{ value: "", label: "Choose open cycle" }, ...periods.filter((row) => ["GOAL_SETTING", "REOPENED"].includes(readString(row, ["kpiPhase", "kpi_phase"]))).map((row) => ({ value: rowId(row), label: optionLabel(row) }))]} />
            <FluentSelect ariaLabel="Existing KPI policy" value={applyPolicy} onChange={(value) => setApplyPolicy(value as "MERGE" | "SKIP" | "REPLACE")} options={[{ value: "MERGE", label: "Merge" }, { value: "SKIP", label: "Skip existing" }, { value: "REPLACE", label: "Replace existing" }]} />
            <button type="button" className={primaryButtonClass} disabled={!applyTemplateId || !applyPeriodId || busyId === "apply-template"} onClick={() => void runAction("apply-template", (token) => applyPerformanceKpiTemplate(token, applyPeriodId, applyTemplateId, applyPolicy), "Template assigned to matching roles.")}>Apply template</button>
          </div> : null}
          <SearchToggleField value={search} onChange={setSearch} placeholder="Search records" />
          {activeTab === "setup" && setupTab === "periods" ? (
            <p className="text-xs text-muted-foreground">Assign plans creates review assignments from active performance plans. Sync system KPIs updates values from attendance, leave, activities, and field visits for those assignments.</p>
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
                <Field label="Start date"><DateInput className={inputClass} value={form.start_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></Field>
                <Field label="End date"><DateInput className={inputClass} value={form.end_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} /></Field>
                <Field label="Aggregation">
                  <FluentSelect
                    ariaLabel="Aggregation"
                    className="w-full"
                    value={form.annual_aggregation_method ?? ""}
                    placeholder="Default"
                    onChange={(value) => setForm((current) => ({ ...current, annual_aggregation_method: value }))}
                    options={[
                      { value: "", label: "Default" },
                      ...AGGREGATION_METHODS.map((item) => ({ value: item, label: prettify(item) })),
                    ]}
                  />
                </Field>
              </>
            ) : null}
            {createMode === "period" ? (
              <>
                <Field label="Financial year">
                  <FluentSelect
                    ariaLabel="Financial year"
                    className="w-full"
                    value={form.financial_year_id ?? ""}
                    placeholder="Select financial year"
                    onChange={(value) => setForm((current) => ({ ...current, financial_year_id: value }))}
                    options={[
                      { value: "", label: "Select financial year" },
                      ...years.map((year) => ({ value: String(rowId(year)), label: optionLabel(year) })),
                    ]}
                  />
                </Field>
                <Field label="Name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Description"><Textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <Field label="Period type">
                  <FluentSelect
                    ariaLabel="Period type"
                    className="w-full"
                    value={form.period_type ?? "MONTHLY"}
                    onChange={(value) => setForm((current) => ({ ...current, period_type: value }))}
                    options={PERIOD_TYPES.map((item) => ({ value: item, label: prettify(item) }))}
                  />
                </Field>
                <Field label="Sequence"><input type="number" min="1" className={inputClass} value={form.sequence_number ?? ""} onChange={(event) => setForm((current) => ({ ...current, sequence_number: event.target.value }))} /></Field>
                <Field label="Start date"><DateInput className={inputClass} value={form.start_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></Field>
                <Field label="End date"><DateInput className={inputClass} value={form.end_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} /></Field>
                <Field label="Goal-setting deadline"><DateInput className={inputClass} value={form.goal_setting_deadline ?? ""} onChange={(event) => setForm((current) => ({ ...current, goal_setting_deadline: event.target.value }))} /></Field>
                <Field label="Mid-cycle review date"><DateInput className={inputClass} value={form.mid_cycle_review_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, mid_cycle_review_date: event.target.value }))} /></Field>
                <Field label="Final review deadline"><DateInput className={inputClass} value={form.final_review_deadline ?? ""} onChange={(event) => setForm((current) => ({ ...current, final_review_deadline: event.target.value }))} /></Field>
                <Field label="Maximum weight (%)"><input type="number" min="1" max="100" className={inputClass} value={form.max_weightage ?? "100"} onChange={(event) => setForm((current) => ({ ...current, max_weightage: event.target.value }))} /></Field>
                <Field label="Score cap (%)"><input type="number" min="1" className={inputClass} value={form.score_cap ?? "120"} onChange={(event) => setForm((current) => ({ ...current, score_cap: event.target.value }))} /></Field>
                <Field label="Cooling period (days)"><input type="number" min="0" className={inputClass} value={form.cooling_period_days ?? "0"} onChange={(event) => setForm((current) => ({ ...current, cooling_period_days: event.target.value }))} /></Field>
                <Field label="Parallel cycles"><FluentSelect ariaLabel="Parallel cycles" className="w-full" value={form.allow_parallel ?? "true"} onChange={(value) => setForm((current) => ({ ...current, allow_parallel: value }))} options={[{ value: "true", label: "Allowed" }, { value: "false", label: "Disabled" }]} /></Field>
              </>
            ) : null}
            {createMode === "kpi" || createMode === "kpi-edit" || createMode === "kpi-version" ? (
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
                          const next = kpis.find((row) => rowId(row) === value)
                          setForm(next ? seedKpiVersionForm(next) : { ...form, kpi_id: value })
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
                      Creates a new version of the selected KPI. Templates, rules, and plans can pick it after save.
                    </p>
                  </>
                ) : null}
                <Field label="Code"><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
                <Field label="Name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Category"><input className={inputClass} value={form.category ?? ""} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} /></Field>
                <Field label="Description"><Textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <Field label="Unit"><input className={inputClass} value={form.measurement_unit ?? ""} onChange={(event) => setForm((current) => ({ ...current, measurement_unit: event.target.value }))} /></Field>
                <Field label="Direction">
                  <FluentSelect
                    ariaLabel="Direction"
                    className="w-full"
                    value={form.measurement_direction ?? "HIGHER_IS_BETTER"}
                    onChange={(value) => setForm((current) => ({ ...current, measurement_direction: value }))}
                    options={MEASUREMENT_DIRECTIONS.map((item) => ({ value: item, label: prettify(item) }))}
                  />
                </Field>
                <Field label="Formula">
                  <FluentSelect
                    ariaLabel="Formula"
                    className="w-full"
                    value={form.scoring_formula ?? "PERCENT_TO_TARGET"}
                    onChange={(value) => setForm((current) => ({ ...current, scoring_formula: value }))}
                    options={SCORING_FORMULAS.map((item) => ({ value: item, label: prettify(item) }))}
                  />
                </Field>
                <Field label="Data source">
                  <FluentSelect
                    ariaLabel="Data source"
                    className="w-full"
                    value={form.data_source_type ?? "MANUAL_EMPLOYEE"}
                    onChange={(value) => setForm((current) => ({ ...current, data_source_type: value }))}
                    options={DATA_SOURCES.map((item) => ({ value: item, label: prettify(item) }))}
                  />
                </Field>
                <Field label="Default target"><input className={inputClass} value={form.default_target_value ?? ""} onChange={(event) => setForm((current) => ({ ...current, default_target_value: event.target.value }))} /></Field>
                <Field label="Frequency">
                  <FluentSelect
                    ariaLabel="Frequency"
                    className="w-full"
                    value={form.frequency ?? "MONTHLY"}
                    onChange={(value) => setForm((current) => ({ ...current, frequency: value }))}
                    options={FREQUENCIES.map((item) => ({ value: item, label: prettify(item) }))}
                  />
                </Field>
              </>
            ) : null}
            {createMode === "template" || createMode === "rule" || createMode === "plan" ? (
              <Field label="KPI version">
                <FluentSelect
                  ariaLabel="KPI version"
                  className="w-full"
                  value={form.kpi_definition_version_id ?? ""}
                  placeholder="Select a published KPI version"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, kpi_definition_version_id: value }))
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
                <Field label="Code"><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
                <Field label="Name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Applicable roles"><div className="grid max-h-36 gap-1 overflow-auto border border-border p-2">{templateRoles.map((role) => { const id = rowId(role); const selected = (form.applicable_role_ids || "").split(",").includes(id); return <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected} onChange={() => setForm((current) => { const ids = (current.applicable_role_ids || "").split(",").filter(Boolean); return { ...current, applicable_role_ids: (selected ? ids.filter((value) => value !== id) : [...ids, id]).join(",") }; })} />{optionLabel(role)}</label> })}</div></Field>
                <Field label="Weight"><input className={inputClass} value={form.weight ?? ""} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></Field>
                <Field label="Target"><input className={inputClass} value={form.target_value ?? ""} onChange={(event) => setForm((current) => ({ ...current, target_value: event.target.value }))} /></Field>
                {additionalTemplateItems.map((item, index) => <div key={index} className="grid gap-2 border border-border p-3 sm:col-span-2 sm:grid-cols-3"><FluentSelect ariaLabel={`Additional KPI ${index + 1}`} value={item.versionId} onChange={(value) => setAdditionalTemplateItems((current) => current.map((entry, position) => position === index ? { ...entry, versionId: value } : entry))} options={[{ value: "", label: "Choose KPI version" }, ...kpiVersionOptions(kpis).map((option) => ({ value: String(option.id), label: option.label }))]} /><input className={inputClass} type="number" placeholder="Weight" value={item.weight} onChange={(event) => setAdditionalTemplateItems((current) => current.map((entry, position) => position === index ? { ...entry, weight: event.target.value } : entry))} /><input className={inputClass} type="number" placeholder="Target" value={item.target} onChange={(event) => setAdditionalTemplateItems((current) => current.map((entry, position) => position === index ? { ...entry, target: event.target.value } : entry))} /><button type="button" className={secondaryButtonClass} onClick={() => setAdditionalTemplateItems((current) => current.filter((_, position) => position !== index))}>Remove</button></div>)}
                <button type="button" className={secondaryButtonClass} onClick={() => setAdditionalTemplateItems((current) => [...current, { versionId: "", weight: "", target: "" }])}>Add another KPI</button>
              </>
            ) : null}
            {createMode === "rule" ? (
              <>
                <Field label="Name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Financial year">
                  <FluentSelect
                    ariaLabel="Financial year"
                    className="w-full"
                    value={form.financial_year_id ?? ""}
                    placeholder="Any year"
                    onChange={(value) => setForm((current) => ({ ...current, financial_year_id: value }))}
                    options={[
                      { value: "", label: "Any year" },
                      ...years.map((year) => ({ value: String(rowId(year)), label: optionLabel(year) })),
                    ]}
                  />
                </Field>
                <Field label="Priority"><input className={inputClass} value={form.priority ?? ""} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} /></Field>
                <Field label="Branch">
                  <FluentSelect ariaLabel="Branch" className="w-full" value={form.branch_id ?? ""} placeholder="Any branch" onChange={(value) => setForm((current) => ({ ...current, branch_id: value }))} options={[{ value: "", label: "Any branch" }, ...branches.map((row) => ({ value: String(rowId(row)), label: optionLabel(row) }))]} />
                </Field>
                <Field label="Department">
                  <FluentSelect ariaLabel="Department" className="w-full" value={form.department_id ?? ""} placeholder="Any department" onChange={(value) => setForm((current) => ({ ...current, department_id: value }))} options={[{ value: "", label: "Any department" }, ...departments.map((row) => ({ value: String(rowId(row)), label: optionLabel(row) }))]} />
                </Field>
                <Field label="Position">
                  <FluentSelect ariaLabel="Position" className="w-full" value={form.position_id ?? ""} placeholder="Any position" onChange={(value) => setForm((current) => ({ ...current, position_id: value }))} options={[{ value: "", label: "Any position" }, ...positions.map((row) => ({ value: String(rowId(row)), label: optionLabel(row) }))]} />
                </Field>
                <Field label="Grade">
                  <FluentSelect ariaLabel="Grade" className="w-full" value={form.grade_id ?? ""} placeholder="Any grade" onChange={(value) => setForm((current) => ({ ...current, grade_id: value }))} options={[{ value: "", label: "Any grade" }, ...grades.map((row) => ({ value: String(rowId(row)), label: optionLabel(row) }))]} />
                </Field>
                <Field label="Employee">
                  <FluentSelect ariaLabel="Employee" className="w-full" value={form.employee_id ?? ""} placeholder="All employees" onChange={(value) => setForm((current) => ({ ...current, employee_id: value }))} options={[{ value: "", label: "All employees" }, ...employees.map((row) => ({ value: String(rowId(row)), label: employeeLabel(row) }))]} />
                </Field>
                <Field label="Employment type"><input className={inputClass} value={form.employment_type ?? ""} onChange={(event) => setForm((current) => ({ ...current, employment_type: event.target.value }))} placeholder="Any employment type" /></Field>
                <Field label="Review cycle"><input className={inputClass} value={form.review_cycle ?? ""} onChange={(event) => setForm((current) => ({ ...current, review_cycle: event.target.value }))} placeholder="e.g. QUARTERLY" /></Field>
                <Field label="Template code"><input className={inputClass} value={form.template_code ?? ""} onChange={(event) => setForm((current) => ({ ...current, template_code: event.target.value }))} /></Field>
                <Field label="Weight override"><input type="number" step="0.01" className={inputClass} value={form.weight_override ?? ""} onChange={(event) => setForm((current) => ({ ...current, weight_override: event.target.value }))} /></Field>
                <Field label="Target override"><input type="number" step="any" className={inputClass} value={form.target_override ?? ""} onChange={(event) => setForm((current) => ({ ...current, target_override: event.target.value }))} /></Field>
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
                <Field label="Description"><Textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Default">
                    <FluentSelect
                      ariaLabel="Default"
                      className="w-full"
                      value={form.is_default ?? "true"}
                      onChange={(value) => setForm((current) => ({ ...current, is_default: value }))}
                      options={[
                        { value: "true", label: "Yes" },
                        { value: "false", label: "No" },
                      ]}
                    />
                  </Field>
                  <Field label="Effective from"><DateInput className={inputClass} value={form.effective_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></Field>
                  <Field label="Effective to"><DateInput className={inputClass} value={form.effective_to ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_to: event.target.value }))} /></Field>
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
                <Field label="Description"><Textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Default">
                    <FluentSelect
                      ariaLabel="Default"
                      className="w-full"
                      value={form.is_default ?? "true"}
                      onChange={(value) => setForm((current) => ({ ...current, is_default: value }))}
                      options={[
                        { value: "true", label: "Yes" },
                        { value: "false", label: "No" },
                      ]}
                    />
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
                  <FluentSelect
                    ariaLabel="Employee"
                    className="w-full"
                    value={form.employee_id ?? ""}
                    placeholder="Select employee"
                    onChange={(value) => setForm((current) => ({ ...current, employee_id: value }))}
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
                    onChange={(value) => setForm((current) => ({ ...current, financial_year_id: value }))}
                    options={[
                      { value: "", label: "Select year" },
                      ...years.map((year) => ({ value: String(rowId(year)), label: optionLabel(year) })),
                    ]}
                  />
                </Field>
                <Field label="Effective from"><DateInput className={inputClass} value={form.effective_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></Field>
                <Field label="Effective to"><DateInput className={inputClass} value={form.effective_to ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_to: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "plan" ? (
              <Field label="Weight"><input className={inputClass} value={form.weight ?? ""} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></Field>
            ) : null}
            {createMode === "development" ? (
              <>
                <Field label="Employee">
                  <FluentSelect
                    ariaLabel="Employee"
                    className="w-full"
                    value={form.employee_id ?? ""}
                    placeholder="Select employee"
                    onChange={(value) => setForm((current) => ({ ...current, employee_id: value }))}
                    options={[
                      { value: "", label: "Select employee" },
                      ...employees.map((employee) => ({
                        value: String(rowId(employee)),
                        label: employeeLabel(employee),
                      })),
                    ]}
                  />
                </Field>
                <Field label="Plan title"><input className={inputClass} value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Description"><Textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Start date"><DateInput className={inputClass} value={form.start_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></Field>
                  <Field label="Target date"><DateInput className={inputClass} value={form.target_completion_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, target_completion_date: event.target.value }))} /></Field>
                  <Field label="Source review ID"><input className={inputClass} inputMode="numeric" value={form.source_review_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, source_review_id: event.target.value }))} /></Field>
                </div>
                <Field label="First goal"><input className={inputClass} value={form.goal_title ?? ""} onChange={(event) => setForm((current) => ({ ...current, goal_title: event.target.value }))} /></Field>
                <Field label="Goal notes"><Textarea className={textareaClass} value={form.goal_description ?? ""} onChange={(event) => setForm((current) => ({ ...current, goal_description: event.target.value }))} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Goal category"><input className={inputClass} value={form.goal_category ?? ""} onChange={(event) => setForm((current) => ({ ...current, goal_category: event.target.value }))} /></Field>
                  <Field label="Goal target date"><DateInput className={inputClass} value={form.goal_target_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, goal_target_date: event.target.value }))} /></Field>
                </div>
                <Field label="Success measure"><Textarea className={textareaClass} value={form.success_measure ?? ""} onChange={(event) => setForm((current) => ({ ...current, success_measure: event.target.value }))} /></Field>
                <Field label="Support required"><Textarea className={textareaClass} value={form.support_required ?? ""} onChange={(event) => setForm((current) => ({ ...current, support_required: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "pip" ? (
              <>
                <Field label="Review ID"><input className={inputClass} value={form.review_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, review_id: event.target.value }))} /></Field>
                <Field label="Summary"><Textarea className={textareaClass} value={form.summary ?? ""} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} /></Field>
                <Field label="Objectives (one per line)"><Textarea className={textareaClass} value={form.objectives ?? ""} onChange={(event) => setForm((current) => ({ ...current, objectives: event.target.value }))} /></Field>
                <Field label="First milestone"><input className={inputClass} value={form.milestone_title ?? ""} onChange={(event) => setForm((current) => ({ ...current, milestone_title: event.target.value }))} /></Field>
                <Field label="Milestone due"><DateInput className={inputClass} value={form.milestone_due ?? ""} onChange={(event) => setForm((current) => ({ ...current, milestone_due: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "moderate" || createMode === "reopen" ? (
              <>
                <Field label="Review ID"><input className={inputClass} value={form.review_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, review_id: event.target.value }))} /></Field>
                <Field label="Reason"><Textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "moderate" ? (
              <Field label="Final score"><input className={inputClass} value={form.final_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, final_score: event.target.value }))} /></Field>
            ) : null}
            {createMode === "approve" ? (
              <>
                <Field label="Period assignment ID"><input className={inputClass} value={form.period_assignment_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, period_assignment_id: event.target.value }))} /></Field>
                <Field label="HR comment"><Textarea className={textareaClass} value={form.hr_review ?? ""} onChange={(event) => setForm((current) => ({ ...current, hr_review: event.target.value }))} /></Field>
                <Field label="Adjustment score"><input className={inputClass} value={form.adjustment_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, adjustment_score: event.target.value }))} /></Field>
              </>
            ) : null}
            {createMode === "feedback" ? (
              <>
                <Field label="Review ID"><input className={inputClass} value={form.review_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, review_id: event.target.value }))} /></Field>
                <Field label="Rater employee IDs">
                  <Textarea
                    className={textareaClass}
                    placeholder="One ID per line, or comma-separated"
                    value={form.rater_employee_ids ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, rater_employee_ids: event.target.value }))}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Relationship">
                    <FluentSelect
                      ariaLabel="Relationship"
                      className="w-full"
                      value={form.relationship_type ?? "PEER"}
                      onChange={(value) => setForm((current) => ({ ...current, relationship_type: value }))}
                      options={[
                        { value: "PEER", label: "Peer" },
                        { value: "SUBORDINATE", label: "Subordinate" },
                        { value: "STAKEHOLDER", label: "Stakeholder" },
                        { value: "MANAGER", label: "Manager" },
                        { value: "OTHER", label: "Other" },
                      ]}
                    />
                  </Field>
                  <Field label="Due date"><DateInput className={inputClass} value={form.due_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} /></Field>
                  <Field label="Anonymous">
                    <FluentSelect
                      ariaLabel="Anonymous"
                      className="w-full"
                      value={form.is_anonymous ?? "true"}
                      onChange={(value) => setForm((current) => ({ ...current, is_anonymous: value }))}
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
                <Field label="Milestone ID"><input className={inputClass} value={form.milestone_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, milestone_id: event.target.value }))} /></Field>
                <Field label="Comment"><Textarea className={textareaClass} value={form.comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} /></Field>
              </>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="button" className={primaryButtonClass} onClick={() => void onCreate()} disabled={saving}>
              {saving ? <FluentLoadingIndicator className="size-4 animate-spin" /> : "Save"}
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
