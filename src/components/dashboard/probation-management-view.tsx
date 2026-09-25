"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon, RefreshCwIcon, TrashIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  DetailField,
  HeroBand,
  ScoreRing,
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
} from "@/components/dashboard/talent-visuals"
import { cn } from "@/lib/utils"
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
  createProbationCase,
  createProbationObjective,
  createProbationPolicy,
  deleteProbationCase,
  deleteProbationPolicy,
  generateProbationLetter,
  getProbationCase,
  getProbationDashboard,
  listMyTeamProbationCases,
  listProbationCases,
  listProbationPolicies,
  submitProbationHrDecision,
  submitProbationManagerReview,
  updateProbationCase,
  updateProbationPolicy,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute, canPerformPermission } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export type ProbationHrTab = "overview" | "policies" | "cases" | "team"

type FormMode = "policy" | "manager-review" | "hr-decision" | "case" | "case-edit" | "objective"

const CASE_EDITABLE_STATUSES = ["ACTIVE", "OBJECTIVES_PENDING"]

const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "intern",
  "consultant",
  "temporary",
] as const

const MANAGER_RECOMMENDATIONS = [
  "CONFIRM",
  "EXTEND",
  "DO_NOT_CONFIRM",
  "TERMINATE",
  "FURTHER_REVIEW",
] as const

const HR_DECISIONS = [
  "CONFIRMED",
  "EXTENDED",
  "NOT_CONFIRMED",
  "TERMINATION_RECOMMENDED",
] as const

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
]

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function caseNo(row: AdminRecord | null | undefined) {
  return readString(row, ["caseNo", "case_no", "caseNumber"], rowId(row) ? `Case #${rowId(row)}` : "Case")
}

function probationLetterType(row: AdminRecord | null | undefined) {
  const status = readString(row, ["status"]).toUpperCase()
  const decision = readString(row, ["finalDecision", "final_decision"]).toUpperCase()
  if (status === "EXTENDED" || decision === "EXTENDED") return "EXTENSION"
  if (status === "NOT_CONFIRMED" || decision === "NOT_CONFIRMED") return "NOT_CONFIRMED"
  return "CONFIRMATION"
}

export function ProbationManagementView({
  activeTab,
}: {
  activeTab: ProbationHrTab
}) {
  const router = useRouter()
  const actor = useDashboardActor()
  const activeRoute =
    activeTab === "overview"
      ? "/dashboard/probation/overview"
      : activeTab === "policies"
        ? "/dashboard/probation/policies"
        : activeTab === "cases"
          ? "/dashboard/probation/cases"
          : "/dashboard/probation/team"
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute(activeRoute, actor.permissionLabels, actor.accessMode)
  const canCreatePolicy = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_policies:create"],
    mode: "any",
  })
  const canUpdatePolicy = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_policies:update"],
    mode: "any",
  })
  const canDeletePolicy = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_policies:delete"],
    mode: "any",
  })
  const canDeleteCase = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_cases:delete"],
    mode: "any",
  })
  const canCreateCase = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_cases:create"],
    mode: "any",
  })
  const canUpdateCase = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_cases:update"],
    mode: "any",
  })
  const canCreateObjective = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_objectives:create", "probation_cases:update"],
    mode: "any",
  })
  const canManagerReview = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_reviews:manager-review", "probation_reviews:manager-review-any"],
    mode: "any",
  })
  const canHrDecision = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_reviews:hr-decision"],
    mode: "any",
  })
  const canGenerateLetter = canPerformPermission(actor.permissionLabels, {
    permissions: ["probation_letters:generate"],
    mode: "any",
  })

  const fallbackHref =
    actor.accessMode === "employee" ? "/dashboard/me/probation" : "/dashboard"

  React.useEffect(() => {
    if (!actor.ready || canAccess) return
    router.replace(fallbackHref)
  }, [actor.ready, canAccess, fallbackHref, router])

  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [policies, setPolicies] = React.useState<AdminRecord[]>([])
  const [cases, setCases] = React.useState<AdminRecord[]>([])
  const [teamCases, setTeamCases] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("")
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailRecord, setDetailRecord] = React.useState<AdminRecord | null>(null)
  const [caseOpen, setCaseOpen] = React.useState(false)
  const [caseDetail, setCaseDetail] = React.useState<AdminRecord | null>(null)
  const [caseLoading, setCaseLoading] = React.useState(false)
  const [formOpen, setFormOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<FormMode>("policy")
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState("")
  const [criteriaRows, setCriteriaRows] = React.useState<
    Array<{ code: string; name: string; weight: string; description: string }>
  >([])

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
      const tasks: Array<Promise<unknown>> = [getProbationDashboard(token).then(setDashboard)]
      if (activeTab === "policies" || activeTab === "overview" || activeTab === "cases") {
        tasks.push(listProbationPolicies(token).then(setPolicies))
      }
      if (activeTab === "cases" || activeTab === "overview") {
        tasks.push(listProbationCases(token, statusFilter || undefined).then(setCases))
      }
      if (activeTab === "team" || activeTab === "overview") {
        tasks.push(listMyTeamProbationCases(token, statusFilter || undefined).then(setTeamCases))
      }
      const results = await Promise.allSettled(tasks)
      const permissionFailure = results.find(
        (result) => result.status === "rejected" && isPermissionError(result.reason),
      )
      const failed = permissionFailure ?? results.find((result) => result.status === "rejected")
      if (failed && failed.status === "rejected") {
        setError(
          failed.reason instanceof Error ? failed.reason.message : "Could not load probation data.",
        )
      }
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Could not load probation data.")
    } finally {
      setLoading(false)
    }
  }, [activeTab, statusFilter])

  React.useEffect(() => {
    if (!canAccess) return
    void load()
  }, [canAccess, load])

  const rows =
    activeTab === "policies" ? policies : activeTab === "team" ? teamCases : cases
  const visibleRows = rows.filter((row) => {
    if (!search.trim()) return true
    return JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase())
  })

  const openCount =
    readNumber(dashboard, ["open_cases", "openCases", "in_progress"]) ??
    cases.filter((row) => !["CONFIRMED", "NOT_CONFIRMED", "CLOSED"].includes(readString(row, ["status"]).toUpperCase())).length
  const dueSoon =
    readNumber(dashboard, ["due_this_week", "dueThisWeek", "due_soon", "dueSoon"]) ?? 0
  const confirmationRate = readNumber(dashboard, [
    "confirmation_rate",
    "confirmationRate",
    "average_score",
    "averageScore",
  ])
  const cycleCounts = React.useMemo(
    () =>
      CASE_CYCLE.map((status) => ({
        status,
        count: cases.filter((row) => readString(row, ["status"]).toUpperCase() === status).length,
      })),
    [cases],
  )

  async function openCase(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    setCaseDetail(row)
    setCaseOpen(true)
    if (!token || !id) return
    setCaseLoading(true)
    try {
      const detail = await getProbationCase(token, id)
      if (detail) setCaseDetail(detail)
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not load the case.")
    } finally {
      setCaseLoading(false)
    }
  }

  function openForm(
    mode: FormMode,
    seed: Record<string, string> = {},
    criteria: Array<{ code: string; name: string; weight: string; description: string }> = [],
  ) {
    setFormMode(mode)
    setForm(seed)
    setCriteriaRows(mode === "policy" ? (criteria.length > 0 ? criteria : [{ code: "", name: "", weight: "100", description: "" }]) : [])
    setFormError(null)
    setFormOpen(true)
  }

  async function onSave() {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (formMode === "policy") {
        if (!form.code || !form.name || !form.probation_period_days || !form.effective_from) {
          throw new Error("Code, name, duration, and effective from are required.")
        }
        const payload = {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          employment_type: form.employment_type || undefined,
          probation_period_days: Number(form.probation_period_days),
          self_assessment_required: form.self_assessment_required !== "false",
          objectives_required: form.objectives_required === "true",
          minimum_confirmation_score: form.minimum_confirmation_score
            ? Number(form.minimum_confirmation_score)
            : undefined,
          maximum_extensions: form.maximum_extensions ? Number(form.maximum_extensions) : undefined,
          default_extension_days: form.default_extension_days ? Number(form.default_extension_days) : undefined,
          manager_review_required: form.manager_review_required !== "false",
          hr_approval_required: form.hr_approval_required !== "false",
          confirmation_letter_required: form.confirmation_letter_required !== "false",
          is_default: form.is_default === "true",
          effective_from: form.effective_from,
          effective_to: form.effective_to || undefined,
          criteria: criteriaRows.filter((row) => row.code && row.name && row.weight).map((row) => ({
            code: row.code,
            name: row.name,
            weight: Number(row.weight),
            description: row.description || undefined,
            self_rating_enabled: true,
            is_required: true,
          })),
        }
        if (form.id) {
          await updateProbationPolicy(token, form.id, payload)
        } else {
          await createProbationPolicy(token, payload)
        }
      } else if (formMode === "manager-review") {
        if (!form.case_id || !form.recommendation || !form.comments) {
          throw new Error("Recommendation and comments are required.")
        }
        await submitProbationManagerReview(token, form.case_id, {
          recommendation: form.recommendation,
          comments: form.comments,
          recommended_extension_days: form.recommended_extension_days
            ? Number(form.recommended_extension_days)
            : undefined,
        })
      } else if (formMode === "hr-decision") {
        if (!form.case_id || !form.decision || !form.comments) {
          throw new Error("Decision and comments are required.")
        }
        await submitProbationHrDecision(token, form.case_id, {
          decision: form.decision,
          comments: form.comments,
          confirmation_date: form.confirmation_date || undefined,
          extension_days: form.extension_days ? Number(form.extension_days) : undefined,
          extension_end_date: form.extension_end_date || undefined,
        })
      } else if (formMode === "case") {
        if (!form.employee_id || !form.start_date) {
          throw new Error("Employee and start date are required.")
        }
        await createProbationCase(token, {
          employee_id: Number(form.employee_id),
          start_date: form.start_date,
          policy_id: form.policy_id ? Number(form.policy_id) : undefined,
        })
      } else if (formMode === "case-edit") {
        if (!form.case_id) {
          throw new Error("Missing case reference.")
        }
        await updateProbationCase(token, form.case_id, {
          start_date: form.start_date || undefined,
          current_due_date: form.current_due_date || undefined,
          policy_id: form.policy_id ? Number(form.policy_id) : undefined,
        })
      } else if (formMode === "objective") {
        if (!form.case_id || !form.title) {
          throw new Error("Objective title is required.")
        }
        await createProbationObjective(token, form.case_id, {
          title: form.title,
          description: form.description || undefined,
          expected_result: form.expected_result || undefined,
          weight: form.weight ? Number(form.weight) : undefined,
          due_date: form.due_date || undefined,
        })
      }
      toast.success("Saved.")
      setFormOpen(false)
      await load()
      if (form.case_id) {
        const detail = await getProbationCase(token, form.case_id)
        if (detail) setCaseDetail(detail)
      }
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  async function onDeletePolicy(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    if (!window.confirm(`Delete policy "${optionLabel(row)}"? This cannot be undone.`)) return
    setBusyId(`policy-${id}`)
    try {
      await deleteProbationPolicy(token, id)
      toast.success("Policy deleted.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not delete the policy.")
    } finally {
      setBusyId("")
    }
  }

  async function onDeleteCase(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    if (!window.confirm(`Delete case "${caseNo(row)}"? This cannot be undone.`)) return
    setBusyId(`case-${id}`)
    try {
      await deleteProbationCase(token, id)
      toast.success("Case deleted.")
      setCaseOpen(false)
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not delete the case.")
    } finally {
      setBusyId("")
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "policies") {
      return [
        {
          key: "policy",
          label: "Policy",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">{readString(row, ["code"])}</p>
            </div>
          ),
        },
        {
          key: "days",
          label: "Days",
          render: (row) => readString(row, ["probationPeriodDays", "probation_period_days"], "—"),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} />,
        },
        {
          key: "default",
          label: "Default",
          render: (row) => (readBoolean(row, ["isDefault", "is_default"]) ? "Yes" : "No"),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <div className="flex items-center gap-2">
              {canUpdatePolicy ? (
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation()
                    const criteria = asRecordArray(row.criteria).map((criterion) => ({
                      code: readString(criterion, ["code"]),
                      name: readString(criterion, ["name"]),
                      weight: readString(criterion, ["weight"]),
                      description: readString(criterion, ["description"]),
                    }))
                    openForm(
                      "policy",
                      {
                        id: rowId(row),
                        code: readString(row, ["code"]),
                        name: readString(row, ["name"]),
                        description: readString(row, ["description"]),
                        employment_type: readString(row, ["employmentType", "employment_type"]),
                        probation_period_days: readString(row, ["probationPeriodDays", "probation_period_days"]),
                        effective_from: String(row.effectiveFrom ?? row.effective_from ?? "").slice(0, 10),
                        minimum_confirmation_score: readString(row, ["minimumConfirmationScore", "minimum_confirmation_score"]),
                      },
                      criteria,
                    )
                  }}
                >
                  Edit
                </button>
              ) : null}
              {canDeletePolicy ? (
                <button
                  type="button"
                  className={cn(actionButtonClass, "text-rose-600")}
                  disabled={busyId === `policy-${rowId(row)}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void onDeletePolicy(row)
                  }}
                >
                  {busyId === `policy-${rowId(row)}` ? <Loader2Icon className="size-4 animate-spin" /> : <TrashIcon className="size-4" />}
                </button>
              ) : null}
            </div>
          ),
        },
      ]
    }
    return [
      {
        key: "case",
        label: "Case",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">{caseNo(row)}</p>
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
        key: "due",
        label: "Due",
        render: (row) => formatDate(row.currentDueDate ?? row.current_due_date ?? row.originalDueDate),
      },
      {
        key: "decision",
        label: "Decision",
        render: (row) => prettify(readString(row, ["finalDecision", "final_decision"], "Pending")),
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
                event.stopPropagation()
                void openCase(row)
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
                  event.stopPropagation()
                  void onDeleteCase(row)
                }}
              >
                {busyId === `case-${rowId(row)}` ? <Loader2Icon className="size-4 animate-spin" /> : <TrashIcon className="size-4" />}
              </button>
            ) : null}
          </div>
        ),
      },
    ]
  }, [activeTab, canUpdatePolicy, canDeletePolicy, canDeleteCase, busyId])

  if (!canAccess) return null

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="Probation"
            title="Confirmation pipeline"
            description="Open cases, upcoming due dates, and how the confirmation cycle is moving."
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
              <ScoreRing value={confirmationRate} label="Confirmation rate" />
            </div>
            <div className="rounded-xl border border-border bg-card">
              <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Open cases", value: openCount, hint: "Still in the cycle" },
                  { label: "Due this week", value: dueSoon, hint: "Need a review now" },
                  { label: "Policies", value: policies.length, hint: "Active confirmation rules" },
                  { label: "Team queue", value: teamCases.length, hint: "Waiting on managers" },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={cn(
                      "border-border px-5 py-4",
                      index > 0 && "border-t",
                      "sm:border-t-0",
                      index >= 2 && "sm:border-t",
                      index % 2 === 1 && "sm:border-l",
                      "xl:border-t-0",
                      index > 0 && "xl:border-l",
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{item.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-sm font-semibold">Confirmation cycle</h2>
              <p className="text-xs text-muted-foreground">{cases.length} total</p>
            </div>
            <ol className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start">
              {cycleCounts.map((step, index) => {
                const last = index === cycleCounts.length - 1
                return (
                  <li key={step.status} className="relative flex items-start sm:min-w-0 sm:flex-1 sm:flex-col">
                    {last ? null : (
                      <span
                        className="absolute left-[17px] top-9 h-[calc(100%+0.75rem)] w-px bg-border sm:hidden"
                        aria-hidden
                      />
                    )}
                    <div className="flex items-center sm:w-full">
                      <span
                        className={cn(
                          "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
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
                        <span className="mx-3 hidden h-px flex-1 bg-border sm:block" aria-hidden />
                      )}
                    </div>
                    <div className="ml-3 min-w-0 pt-1.5 sm:ml-0 sm:pt-2">
                      <p className="text-sm font-medium text-foreground">{prettify(step.status)}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "policies" ? "Probation policies" : activeTab === "team" ? "Team cases" : "Probation cases"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "policies"
                ? "Duration, confirmation score, and review rules for each employment type."
                : "Open a case to review evidence, submit a manager recommendation, or record the HR decision."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
            {activeTab === "policies" && canCreatePolicy ? (
              <button type="button" className={primaryButtonClass} onClick={() => openForm("policy")}>
                <PlusIcon className="size-4" />
                New policy
              </button>
            ) : null}
            {activeTab === "cases" && canCreateCase ? (
              <button type="button" className={primaryButtonClass} onClick={() => openForm("case", { start_date: new Date().toISOString().slice(0, 10) })}>
                <PlusIcon className="size-4" />
                New case
              </button>
            ) : null}
          </div>
        </div>
      )}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchToggleField value={search} onChange={setSearch} placeholder="Search cases or policies" />
            <select
              className={inputClass}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {CASE_CYCLE.map((status) => (
                <option key={status} value={status}>{prettify(status)}</option>
              ))}
            </select>
          </div>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Probation records"
              data={visibleRows}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey={`probation-${activeTab}`}
              onRowSelect={(_, row) => {
                if (!row) return
                if (activeTab === "policies") {
                  setDetailRecord(row)
                  setDetailOpen(true)
                  return
                }
                void openCase(row)
              }}
            />
          </div>
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
              <Loader2Icon className="size-4 animate-spin" />
              Loading case...
            </div>
          ) : caseDetail ? (
            <div className="space-y-4 px-1 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip value={readString(caseDetail, ["status"], "OPEN")} />
                <StatusChip value={readString(caseDetail, ["finalDecision", "final_decision"], "Pending")} />
              </div>
              <TimelineRail
                items={[
                  {
                    label: "Started",
                    value: formatDate(caseDetail.currentStartDate ?? caseDetail.current_start_date ?? caseDetail.originalStartDate),
                  },
                  {
                    label: "Due",
                    value: formatDate(caseDetail.currentDueDate ?? caseDetail.current_due_date),
                    hint: `Cycle ${readString(caseDetail, ["currentCycleNumber", "current_cycle_number"], "1")}`,
                  },
                  {
                    label: "Decision",
                    value: prettify(readString(caseDetail, ["finalDecision", "final_decision"], "Pending")),
                    hint: formatDate(caseDetail.confirmationDate ?? caseDetail.confirmation_date),
                  },
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Policy" value={optionLabel(asRecord(caseDetail.policy))} />
                <DetailField label="Extensions" value={readString(caseDetail, ["extensionCount", "extension_count"], "0")} />
              </div>
              {asRecordArray(caseDetail.objectives).length > 0 ? (
                <div className="rounded-xl border border-border bg-card p-3">
                  <h3 className="text-sm font-semibold">Objectives</h3>
                  <div className="mt-2 space-y-2">
                    {asRecordArray(caseDetail.objectives).map((objective) => (
                      <div key={rowId(objective)} className="rounded-lg bg-muted/40 px-3 py-2">
                        <p className="text-sm font-medium">{readString(objective, ["title", "name"])}</p>
                        <p className="text-xs text-muted-foreground">
                          {prettify(readString(objective, ["status"], "NOT_STARTED"))} · {readString(objective, ["employeeCompletionPercent", "employee_completion_percent"], "0")}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <SheetFooter className="gap-2">
            {canUpdateCase && caseDetail && CASE_EDITABLE_STATUSES.includes(readString(caseDetail, ["status"]).toUpperCase()) ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  openForm("case-edit", {
                    case_id: rowId(caseDetail),
                    start_date: String(caseDetail.currentStartDate ?? caseDetail.current_start_date ?? "").slice(0, 10),
                    current_due_date: String(caseDetail.currentDueDate ?? caseDetail.current_due_date ?? "").slice(0, 10),
                    policy_id: readString(caseDetail, ["policyId", "policy_id"]),
                  })
                }
              >
                Edit case
              </button>
            ) : null}
            {canCreateObjective && caseDetail && CASE_EDITABLE_STATUSES.includes(readString(caseDetail, ["status"]).toUpperCase()) ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  openForm("objective", {
                    case_id: rowId(caseDetail),
                    due_date: String(caseDetail.currentDueDate ?? caseDetail.current_due_date ?? "").slice(0, 10),
                  })
                }
              >
                Add objective
              </button>
            ) : null}
            {canManagerReview ? (
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
            {canHrDecision ? (
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
                  if (!caseDetail) return
                  void onDeleteCase(caseDetail)
                }}
              >
                {busyId === `case-${rowId(caseDetail)}` ? <Loader2Icon className="size-4 animate-spin" /> : "Delete case"}
              </button>
            ) : null}
            {canGenerateLetter ? (
              <button
                type="button"
                className={primaryButtonClass}
                disabled={busyId === "letter"}
                onClick={() => {
                  const token = readStoredToken()
                  const id = rowId(caseDetail)
                  if (!token || !id) return
                  setBusyId("letter")
                  void generateProbationLetter(token, id, probationLetterType(caseDetail))
                    .then(() => toast.success("Letter generated."))
                    .catch((errorObject) =>
                      toast.error(errorObject instanceof Error ? errorObject.message : "Could not generate the letter."),
                    )
                    .finally(() => setBusyId(""))
                }}
              >
                {busyId === "letter" ? <Loader2Icon className="size-4 animate-spin" /> : "Generate letter"}
              </button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
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
            </DialogTitle>
            <DialogDescription>Save the details for this probation record.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-auto pr-1">
            {formMode === "policy" ? (
              <>
                <Field label="Code"><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
                <Field label="Name"><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Description"><textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <Field label="Employment type">
                  <select className={inputClass} value={form.employment_type ?? ""} onChange={(event) => setForm((current) => ({ ...current, employment_type: event.target.value }))}>
                    <option value="">Any</option>
                    {EMPLOYMENT_TYPES.map((item) => <option key={item} value={item}>{prettify(item)}</option>)}
                  </select>
                </Field>
                <Field label="Probation days"><input className={inputClass} value={form.probation_period_days ?? "90"} onChange={(event) => setForm((current) => ({ ...current, probation_period_days: event.target.value }))} /></Field>
                <Field label="Minimum score"><input className={inputClass} value={form.minimum_confirmation_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, minimum_confirmation_score: event.target.value }))} /></Field>
                <Field label="Effective from"><input type="date" className={inputClass} value={form.effective_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></Field>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Criteria (weights must total 100)</span>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() =>
                        setCriteriaRows((current) => [...current, { code: "", name: "", weight: "", description: "" }])
                      }
                    >
                      <PlusIcon className="size-4" />
                      Add criterion
                    </button>
                  </div>
                  {criteriaRows.map((row, index) => (
                    <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_90px_auto]">
                      <input
                        className={inputClass}
                        placeholder="Code"
                        value={row.code}
                        onChange={(event) =>
                          setCriteriaRows((current) =>
                            current.map((item, i) => (i === index ? { ...item, code: event.target.value } : item)),
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Name"
                        value={row.name}
                        onChange={(event) =>
                          setCriteriaRows((current) =>
                            current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Weight"
                        value={row.weight}
                        onChange={(event) =>
                          setCriteriaRows((current) =>
                            current.map((item, i) => (i === index ? { ...item, weight: event.target.value } : item)),
                          )
                        }
                      />
                      <button
                        type="button"
                        className={cn(actionButtonClass, "text-rose-600")}
                        onClick={() => setCriteriaRows((current) => current.filter((_, i) => i !== index))}
                      >
                        <TrashIcon className="size-4" />
                      </button>
                      <input
                        className={cn(inputClass, "sm:col-span-4")}
                        placeholder="Description (optional)"
                        value={row.description}
                        onChange={(event) =>
                          setCriteriaRows((current) =>
                            current.map((item, i) => (i === index ? { ...item, description: event.target.value } : item)),
                          )
                        }
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Current total: {criteriaRows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0)}
                  </p>
                </div>
              </>
            ) : null}
            {formMode === "manager-review" ? (
              <>
                <Field label="Recommendation">
                  <select className={inputClass} value={form.recommendation ?? "CONFIRM"} onChange={(event) => setForm((current) => ({ ...current, recommendation: event.target.value }))}>
                    {MANAGER_RECOMMENDATIONS.map((item) => <option key={item} value={item}>{prettify(item)}</option>)}
                  </select>
                </Field>
                <Field label="Comments"><textarea className={textareaClass} value={form.comments ?? ""} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} /></Field>
                <Field label="Extension days"><input className={inputClass} value={form.recommended_extension_days ?? ""} onChange={(event) => setForm((current) => ({ ...current, recommended_extension_days: event.target.value }))} /></Field>
              </>
            ) : null}
            {formMode === "hr-decision" ? (
              <>
                <Field label="Decision">
                  <select className={inputClass} value={form.decision ?? "CONFIRMED"} onChange={(event) => setForm((current) => ({ ...current, decision: event.target.value }))}>
                    {HR_DECISIONS.map((item) => <option key={item} value={item}>{prettify(item)}</option>)}
                  </select>
                </Field>
                <Field label="Comments"><textarea className={textareaClass} value={form.comments ?? ""} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} /></Field>
                <Field label="Confirmation date"><input type="date" className={inputClass} value={form.confirmation_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, confirmation_date: event.target.value }))} /></Field>
                <Field label="Extension days"><input className={inputClass} value={form.extension_days ?? ""} onChange={(event) => setForm((current) => ({ ...current, extension_days: event.target.value }))} /></Field>
              </>
            ) : null}
            {formMode === "case" ? (
              <>
                <Field label="Employee ID"><input className={inputClass} value={form.employee_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))} /></Field>
                <Field label="Start date"><input type="date" className={inputClass} value={form.start_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></Field>
                <Field label="Policy (optional)">
                  <select className={inputClass} value={form.policy_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, policy_id: event.target.value }))}>
                    <option value="">Auto-resolve</option>
                    {policies.map((policy) => (
                      <option key={rowId(policy)} value={rowId(policy)}>{optionLabel(policy)}</option>
                    ))}
                  </select>
                </Field>
              </>
            ) : null}
            {formMode === "case-edit" ? (
              <>
                <Field label="Start date"><input type="date" className={inputClass} value={form.start_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></Field>
                <Field label="Due date"><input type="date" className={inputClass} value={form.current_due_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, current_due_date: event.target.value }))} /></Field>
                <Field label="Policy">
                  <select className={inputClass} value={form.policy_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, policy_id: event.target.value }))}>
                    <option value="">Keep current</option>
                    {policies.map((policy) => (
                      <option key={rowId(policy)} value={rowId(policy)}>{optionLabel(policy)}</option>
                    ))}
                  </select>
                </Field>
              </>
            ) : null}
            {formMode === "objective" ? (
              <>
                <Field label="Title"><input className={inputClass} value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Expected result"><textarea className={textareaClass} value={form.expected_result ?? ""} onChange={(event) => setForm((current) => ({ ...current, expected_result: event.target.value }))} /></Field>
                <Field label="Weight"><input className={inputClass} value={form.weight ?? ""} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></Field>
                <Field label="Due date"><input type="date" className={inputClass} value={form.due_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} /></Field>
                <Field label="Description"><textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
              </>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSave()} disabled={saving}>
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
