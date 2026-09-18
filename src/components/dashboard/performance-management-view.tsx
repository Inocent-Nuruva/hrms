"use client"

import * as React from "react"
import {
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
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
  formatDate,
  inputClass,
  isPermissionError,
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
  generatePerformancePeriods,
  generatePerformancePlanFromRules,
  getPerformanceDashboard,
  listEmployees,
  listPerformanceAppeals,
  listPerformanceCompetencyTemplates,
  listPerformanceFinancialYears,
  listPerformanceImprovementPlans,
  listPerformanceKpiRules,
  listPerformanceKpiTemplates,
  listPerformanceKpis,
  listPerformancePeriods,
  listPerformancePlans,
  listPerformanceRatingScales,
  moderatePerformanceReview,
  reopenPerformanceReview,
  reviewPerformanceImprovementMilestone,
  syncPerformanceSystemKpis,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute, canPerformPermission } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type PerformanceHrTab = "overview" | "setup" | "plans" | "reviews" | "improvement"

type SetupTab =
  | "years"
  | "periods"
  | "kpis"
  | "templates"
  | "rules"
  | "competencies"
  | "scales"

type CreateMode =
  | "year"
  | "period"
  | "kpi"
  | "kpi-version"
  | "template"
  | "rule"
  | "competency"
  | "scale"
  | "plan"
  | "generate-plan"
  | "pip"
  | "moderate"
  | "approve"
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
]

const PERIOD_CYCLE = [
  "DRAFT",
  "OPEN",
  "ACHIEVEMENT_ENTRY",
  "SELF_REVIEW",
  "MANAGER_REVIEW",
  "HR_REVIEW",
  "MODERATION",
  "APPROVED",
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
const PERIOD_TYPES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"] as const

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

export function PerformanceManagementView({
  activeTab,
}: {
  activeTab: PerformanceHrTab
}) {
  const router = useRouter()
  const actor = useDashboardActor()
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute("/dashboard/performance/overview", actor.permissionLabels, actor.accessMode)
  const canCreatePerformance = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "performance:create",
      "performance:update",
      "performance_periods:create",
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

  const fallbackHref =
    actor.accessMode === "employee" ? "/dashboard/me/performance/overview" : "/dashboard"

  React.useEffect(() => {
    if (!actor.ready || canAccess) return
    router.replace(fallbackHref)
  }, [actor.ready, canAccess, fallbackHref, router])

  const [setupTab, setSetupTab] = React.useState<SetupTab>("years")
  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [years, setYears] = React.useState<AdminRecord[]>([])
  const [periods, setPeriods] = React.useState<AdminRecord[]>([])
  const [kpis, setKpis] = React.useState<AdminRecord[]>([])
  const [templates, setTemplates] = React.useState<AdminRecord[]>([])
  const [rules, setRules] = React.useState<AdminRecord[]>([])
  const [competencies, setCompetencies] = React.useState<AdminRecord[]>([])
  const [scales, setScales] = React.useState<AdminRecord[]>([])
  const [plans, setPlans] = React.useState<AdminRecord[]>([])
  const [appeals, setAppeals] = React.useState<AdminRecord[]>([])
  const [pips, setPips] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailRecord, setDetailRecord] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<CreateMode>("year")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState("")
  const [form, setForm] = React.useState<Record<string, string>>({})

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
      const requests: Array<Promise<unknown>> = [
        getPerformanceDashboard(token).then(setDashboard),
        listPerformanceFinancialYears(token).then(setYears),
        listPerformancePeriods(token).then(setPeriods),
      ]
      if (activeTab === "setup" || activeTab === "overview") {
        requests.push(
          listPerformanceKpis(token).then(setKpis),
          listPerformanceKpiTemplates(token).then(setTemplates),
          listPerformanceKpiRules(token).then(setRules),
          listPerformanceCompetencyTemplates(token).then(setCompetencies),
          listPerformanceRatingScales(token).then(setScales),
        )
      }
      if (activeTab === "plans" || activeTab === "overview") {
        requests.push(
          listPerformancePlans(token).then(setPlans),
          listPerformanceKpis(token).then(setKpis),
          listEmployees(token, { limit: 100 }).then((result) => setEmployees(result.rows)),
        )
      }
      if (activeTab === "reviews" || activeTab === "overview") {
        requests.push(listPerformanceAppeals(token).then(setAppeals))
      }
      if (activeTab === "improvement" || activeTab === "reviews" || activeTab === "overview") {
        requests.push(listPerformanceImprovementPlans(token).then(setPips))
      }
      const results = await Promise.allSettled(requests)
      const permissionFailure = results.find(
        (result) => result.status === "rejected" && isPermissionError(result.reason),
      )
      if (permissionFailure && permissionFailure.status === "rejected") {
        router.replace(fallbackHref)
        return
      }
      const firstError = results.find((result) => result.status === "rejected")
      if (firstError && firstError.status === "rejected") {
        setError(firstError.reason instanceof Error ? firstError.reason.message : "Could not load performance data.")
      }
    } catch (errorObject) {
      if (isPermissionError(errorObject)) {
        router.replace(fallbackHref)
        return
      }
      setError(errorObject instanceof Error ? errorObject.message : "Could not load performance data.")
    } finally {
      setLoading(false)
    }
  }, [activeTab, fallbackHref, router])

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

  const currentPeriod = periods[0] ?? null
  const visibleRows = React.useMemo(() => {
    const source =
      activeTab === "plans"
        ? plans
        : activeTab === "reviews"
          ? appeals
          : activeTab === "improvement"
            ? pips
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
                        : scales
    return source.filter((row) => matchesSearch(row, search))
  }, [
    activeTab,
    appeals,
    competencies,
    kpis,
    periods,
    pips,
    plans,
    rules,
    scales,
    search,
    setupTab,
    templates,
    years,
  ])

  function openCreate(mode: CreateMode, seed: Record<string, string> = {}) {
    setCreateMode(mode)
    setForm(
      mode === "period"
        ? { period_type: "MONTHLY", sequence_number: "1", ...seed }
        : seed,
    )
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
      } else if (createMode === "kpi" || createMode === "kpi-version") {
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
        if (createMode === "kpi-version") {
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
        await createPerformanceKpi(token, kpiPayload)
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
                          : createMode === "reopen"
                            ? "Reopen review"
                            : "Review milestone"

  if (!canAccess) return null

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="Performance"
            title="Company review cycle"
            description="Scores, cycle progress, and the work still waiting on HR — same chrome as the rest of the dashboard."
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
              <ScoreRing value={averageScore} label="Average score" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Open reviews" value={openReviews} hint="Waiting on a cycle step" />
              <MetricTile
                label="Completion"
                value={completionRate === null ? "—" : `${Math.round(completionRate)}%`}
                hint="Published versus assigned"
              />
              <MetricTile label="Plans" value={plans.length || years.length} hint="Active employee plans" />
              <MetricTile label="Improvement plans" value={pipCount} hint="Open PIPs" />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Period mix</h2>
              <p className="mt-1 text-xs text-muted-foreground">Where the current review periods sit in the cycle.</p>
              <div className="mt-4">
                <StatusStack items={statusChartItems(periods)} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Current cycle</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {optionLabel(currentPeriod) === "—" ? "No period loaded yet." : optionLabel(currentPeriod)}
              </p>
              <div className="mt-4">
                <CycleRail steps={PERIOD_CYCLE} current={readString(currentPeriod, ["status"], "DRAFT")} />
              </div>
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
                  : activeTab === "reviews"
                    ? "Reviews and appeals"
                    : "Improvement plans"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "setup"
                ? "Years, periods, KPIs, templates, rules, competencies, and rating scales."
                : activeTab === "plans"
                  ? "Assign or generate the KPI set each employee is measured on."
                  : activeTab === "reviews"
                    ? "Moderate, approve, or reopen reviews and inspect open appeals."
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
            {createMode === "kpi" || createMode === "kpi-version" ? (
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

function cnTab(active: boolean) {
  return active
    ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold !text-white"
    : "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground"
}
