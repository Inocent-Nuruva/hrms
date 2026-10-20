"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
import { PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  HeroBand,
  StatusChip,
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
  applyEmployeeMovement,
  approveEmployeeMovement,
  cancelEmployeeMovement,
  createEmployeeMovement,
  deleteEmployeeMovement,
  generateEmployeeMovementLetter,
  getEmployeeMovement,
  listBranches,
  listCostCenters,
  listDepartments,
  listEmployeeGrades,
  listEmployeeMovementOperations,
  listEmployeeMovements,
  listEmployees,
  listPayrollSalaryStructures,
  listPositions,
  rejectEmployeeMovement,
  retryEmployeeMovementOperation,
  returnEmployeeMovement,
  submitEmployeeMovement,
  updateEmployeeMovement,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import {
  useForbiddenRouteGuard,
  useLeaveIfForbidden,
} from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import {
  MovementSalaryOverridesEditor,
  type SalaryOverridesState,
  type StoredSalaryOverrides,
} from "@/components/dashboard/movement-salary-overrides-editor"

export type MovementOpsTab = "overview" | "cases" | "operations"
type MovementWorkspace = "hr" | "team"

const MOVEMENT_TYPES = [
  "DEPARTMENT_TRANSFER",
  "BRANCH_TRANSFER",
  "POSITION_CHANGE",
  "PROMOTION",
  "DEMOTION",
  "REPORTING_MANAGER_CHANGE",
  "GRADE_CHANGE",
  "COST_CENTER_CHANGE",
  "EMPLOYMENT_TYPE_CHANGE",
  "SALARY_REVISION",
  "COMPOSITE",
] as const

const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "intern",
  "consultant",
  "temporary",
] as const

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function statusOf(row: AdminRecord) {
  return readString(row, ["status"], "DRAFT").toUpperCase()
}

function letterTypeForMovement(row: AdminRecord): string {
  const movementType = readString(
    row,
    ["movementType", "movement_type"],
    "",
  ).toUpperCase()
  switch (movementType) {
    case "BRANCH_TRANSFER":
    case "DEPARTMENT_TRANSFER":
      return "TRANSFER"
    case "PROMOTION":
      return "PROMOTION"
    case "DEMOTION":
      return "DEMOTION"
    case "POSITION_CHANGE":
      return "POSITION_CHANGE"
    case "SALARY_REVISION":
      return "SALARY_REVISION"
    default:
      return "GENERIC"
  }
}

function hasAnyPermission(permissionLabels: string[], permissions: string[]) {
  const normalized = permissionLabels.map((permission) =>
    permission.toLowerCase(),
  )
  return permissions.some((permission) =>
    normalized.includes(permission.toLowerCase()),
  )
}

function recordValue(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return undefined
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key]
  }
  return undefined
}

function asPlainRecord(value: unknown): AdminRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : {}
}

function formValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string" && value.trim()) return value
  return ""
}

function changedSnapshotValue(row: AdminRecord, key: string) {
  const current = asPlainRecord(
    recordValue(row, ["currentSnapshot", "current_snapshot"]),
  )
  const proposed = asPlainRecord(
    recordValue(row, ["proposedSnapshot", "proposed_snapshot"]),
  )
  return proposed[key] !== current[key] ? proposed[key] : undefined
}

/**
 * Overrides saved on a movement salary change: undefined when the change does
 * not set them (they carry over), {} when it clears them.
 */
function movementSalaryOverrides(
  row: AdminRecord,
): StoredSalaryOverrides | undefined {
  const salaryChange = Array.isArray(row.changes)
    ? row.changes.find(
        (entry) =>
          readString(asPlainRecord(entry), ["field"], "").toUpperCase() ===
          "BASE_SALARY",
      )
    : undefined
  const newValue = asPlainRecord(
    recordValue(asPlainRecord(salaryChange), ["newValue", "new_value"]),
  )
  if (!Object.prototype.hasOwnProperty.call(newValue, "component_overrides"))
    return undefined
  return asPlainRecord(newValue.component_overrides) as StoredSalaryOverrides
}

function buildMovementForm(row: AdminRecord): Record<string, string> {
  const salaryChange = Array.isArray(row.changes)
    ? row.changes.find(
        (entry) =>
          readString(asPlainRecord(entry), ["field"], "").toUpperCase() ===
          "BASE_SALARY",
      )
    : undefined
  const salaryNewValue = asPlainRecord(
    recordValue(asPlainRecord(salaryChange), ["newValue", "new_value"]),
  )
  const salaryChanged =
    Boolean(salaryChange) ||
    changedSnapshotValue(row, "base_salary") !== undefined
  return {
    id: rowId(row),
    employee_id: formValue(
      readNumber(row, ["employeeId", "employee_id"]) ??
        readNumber(asPlainRecord(row.employee), ["id"]),
    ),
    movement_type: readString(
      row,
      ["movementType", "movement_type"],
      "DEPARTMENT_TRANSFER",
    ),
    title: readString(row, ["title"], ""),
    reason: readString(row, ["reason"], ""),
    effective_date: readString(row, ["effectiveDate", "effective_date"], ""),
    new_branch_id: formValue(changedSnapshotValue(row, "branch_id")),
    new_department_id: formValue(changedSnapshotValue(row, "department_id")),
    new_position_id: formValue(changedSnapshotValue(row, "position_id")),
    new_grade_id: formValue(changedSnapshotValue(row, "grade_id")),
    new_cost_center_id: formValue(changedSnapshotValue(row, "cost_center_id")),
    new_manager_employee_id: formValue(
      changedSnapshotValue(row, "reporting_manager_employee_id"),
    ),
    new_employment_type: formValue(
      changedSnapshotValue(row, "employment_type"),
    ),
    base_salary: salaryChanged
      ? formValue(
          salaryNewValue.amount ?? changedSnapshotValue(row, "base_salary"),
        )
      : "",
    currency: salaryChanged
      ? formValue(
          salaryNewValue.currency ??
            changedSnapshotValue(row, "salary_currency"),
        ) || "TZS"
      : "TZS",
    salary_structure_code: salaryChanged
      ? formValue(
          salaryNewValue.salary_structure_code ??
            changedSnapshotValue(row, "salary_structure_code"),
        )
      : "",
    justification: formValue(salaryNewValue.justification),
  }
}

export function MovementOperationsView({
  activeTab,
  workspace = "hr",
}: {
  activeTab: MovementOpsTab
  workspace?: MovementWorkspace
}) {
  const actor = useDashboardActor()
  const accessRoute =
    workspace === "team"
      ? "/dashboard/team/movements"
      : "/dashboard/movements/overview"
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute(
      accessRoute,
      actor.permissionLabels,
      actor.accessMode,
    )
  const canCreateMovement =
    workspace === "hr" &&
    hasAnyPermission(actor.permissionLabels, [
      "employee_movements:create",
      "manage_employee_movements",
    ])
  const canSubmitMovement =
    workspace === "hr" &&
    hasAnyPermission(actor.permissionLabels, [
      "employee_movements:submit",
      "manage_employee_movements",
    ])
  const canCancelMovement =
    workspace === "hr" &&
    hasAnyPermission(actor.permissionLabels, [
      "employee_movements:cancel",
      "manage_employee_movements",
    ])
  const canApplyMovement =
    workspace === "hr" &&
    hasAnyPermission(actor.permissionLabels, [
      "employee_movements:apply",
      "manage_employee_movements",
    ])
  const canDecideMovement = hasAnyPermission(actor.permissionLabels, [
    "employee_movements:approve",
    "manage_employee_movements",
  ])
  const canGenerateLetter =
    workspace === "hr" &&
    hasAnyPermission(actor.permissionLabels, [
      "employee_movements:generate-letter",
      "manage_employee_movements",
    ])
  const leaveIfForbidden = useLeaveIfForbidden()
  useForbiddenRouteGuard(canAccess)

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [operations, setOperations] = React.useState<AdminRecord[]>([])
  const [selected, setSelected] = React.useState<AdminRecord | null>(null)
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
  const [grades, setGrades] = React.useState<AdminRecord[]>([])
  const [costCenters, setCostCenters] = React.useState<AdminRecord[]>([])
  const [salaryStructures, setSalaryStructures] = React.useState<
    AdminRecord[]
  >([])
  const salaryStructureCodes = React.useMemo(() => {
    const byCode = new Map<string, string>()
    for (const row of salaryStructures) {
      if (String(row.status ?? "").toUpperCase() !== "ACTIVE") continue
      byCode.set(String(row.code), String(row.name ?? row.code))
    }
    return [...byCode].map(([code, name]) => ({ code, name }))
  }, [salaryStructures])
  // Overrides saved on the movement being edited, and whose they are.
  const [initialSalaryOverrides, setInitialSalaryOverrides] = React.useState<{
    employeeId: string
    overrides: StoredSalaryOverrides | undefined
  } | null>(null)
  const [salaryOverrides, setSalaryOverrides] =
    React.useState<SalaryOverridesState>({
      overrides: null,
      pending: false,
      error: null,
    })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<
    "create" | "edit" | "decide"
  >("create")
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
    const tasks: Array<Promise<unknown>> = [
      listEmployeeMovements(token)
        .then(setRows)
        .catch((errorObject) => {
          setRows([])
          throw errorObject
        }),
    ]
    if (activeTab === "cases" && canCreateMovement) {
      tasks.push(
        listEmployees(token, { page: 1, limit: 50 })
          .then((result) => setEmployees(result.rows))
          .catch(() => setEmployees([])),
        listBranches(token, { page: 1, limit: 50 })
          .then((result) => setBranches(result.rows))
          .catch(() => setBranches([])),
        listDepartments(token, { page: 1, limit: 50 })
          .then((result) => setDepartments(result.rows))
          .catch(() => setDepartments([])),
        listPositions(token, { page: 1, limit: 50 })
          .then((result) => setPositions(result.rows))
          .catch(() => setPositions([])),
        listEmployeeGrades(token)
          .then(setGrades)
          .catch(() => setGrades([])),
        listCostCenters(token)
          .then(setCostCenters)
          .catch(() => setCostCenters([])),
        // Needs payroll config read access; the form falls back to free text.
        listPayrollSalaryStructures(token)
          .then(setSalaryStructures)
          .catch(() => setSalaryStructures([])),
      )
    }
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(
        first.reason instanceof Error
          ? first.reason.message
          : "Could not load movements.",
      )
    }
    setLoading(false)
  }, [activeTab, canCreateMovement, leaveIfForbidden])

  React.useEffect(() => {
    if (!canAccess) return
    void load()
  }, [canAccess, load])

  async function loadOperations(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    setSelected(row)
    if (!token || !id) {
      setOperations([])
      return
    }
    try {
      setOperations(await listEmployeeMovementOperations(token, id))
    } catch {
      setOperations([])
    }
  }

  const runAction = React.useCallback(async (
    row: AdminRecord,
    action: "submit" | "cancel" | "apply",
  ) => {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setBusyId(`${action}-${id}`)
    try {
      if (action === "submit") await submitEmployeeMovement(token, id)
      if (action === "cancel") await cancelEmployeeMovement(token, id)
      if (action === "apply") await applyEmployeeMovement(token, id)
      toast.success(prettify(action))
      await load()
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : `Could not ${action}.`,
      )
    } finally {
      setBusyId("")
    }
  }, [load])

  async function generateLetter(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setBusyId(`letter-${id}`)
    try {
      await generateEmployeeMovementLetter(token, id, letterTypeForMovement(row))
      toast.success("Letter generated.")
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not generate the letter.",
      )
    } finally {
      setBusyId("")
    }
  }

  async function openEdit(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setBusyId(`edit-${id}`)
    try {
      const movement = await getEmployeeMovement(token, id)
      if (!movement) throw new Error("Movement was not found.")
      setCreateMode("edit")
      const movementForm = buildMovementForm(movement)
      setForm(movementForm)
      setInitialSalaryOverrides({
        employeeId: movementForm.employee_id,
        overrides: movementSalaryOverrides(movement),
      })
      setFormError(null)
      setCreateOpen(true)
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load movement.",
      )
    } finally {
      setBusyId("")
    }
  }

  const deleteMovement = React.useCallback(async (row: AdminRecord) => {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    if (!window.confirm("Delete this draft movement? This cannot be undone."))
      return
    setBusyId(`delete-${id}`)
    try {
      await deleteEmployeeMovement(token, id)
      toast.success("Movement deleted.")
      await load()
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not delete movement.",
      )
    } finally {
      setBusyId("")
    }
  }, [load])

  async function onSave() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (createMode === "create" || createMode === "edit") {
        if (
          !form.employee_id ||
          !form.movement_type ||
          !form.title ||
          !form.reason ||
          !form.effective_date
        ) {
          throw new Error(
            "Employee, type, title, reason, and effective date are required.",
          )
        }
        const payload: AdminRecord = {
          employee_id: Number(form.employee_id),
          movement_type: form.movement_type,
          title: form.title,
          reason: form.reason,
          effective_date: form.effective_date,
        }
        if (form.new_branch_id)
          payload.new_branch_id = Number(form.new_branch_id)
        if (form.new_department_id)
          payload.new_department_id = Number(form.new_department_id)
        if (form.new_position_id)
          payload.new_position_id = Number(form.new_position_id)
        if (form.new_grade_id) payload.new_grade_id = Number(form.new_grade_id)
        if (form.new_cost_center_id)
          payload.new_cost_center_id = Number(form.new_cost_center_id)
        if (form.new_manager_employee_id)
          payload.new_manager_employee_id = Number(form.new_manager_employee_id)
        if (form.new_employment_type)
          payload.new_employment_type = form.new_employment_type
        if (["SALARY_REVISION", "COMPOSITE"].includes(form.movement_type)) {
          if (!form.base_salary || !form.currency || !form.justification) {
            throw new Error("Salary, currency, and justification are required.")
          }
          if (salaryOverrides.pending) {
            throw new Error(
              "Structure lines are still loading. Try again in a moment.",
            )
          }
          if (salaryOverrides.error) throw new Error(salaryOverrides.error)
          payload.salary_revision = {
            base_salary: form.base_salary,
            currency: form.currency,
            salary_structure_code: form.salary_structure_code || undefined,
            // Omitted until overrides are edited: the backend then keeps the
            // ones saved on the movement, or carries current ones over.
            ...(salaryOverrides.overrides !== null
              ? { component_overrides: salaryOverrides.overrides }
              : {}),
            justification: form.justification,
          }
        }
        if (createMode === "edit") {
          if (!form.id) throw new Error("Movement id is required.")
          await updateEmployeeMovement(token, form.id, payload)
        } else {
          await createEmployeeMovement(token, payload)
        }
      } else {
        if (!form.id || !form.decision)
          throw new Error("A decision is required.")
        if (form.decision !== "APPROVE" && !form.comments)
          throw new Error("Comments are required.")
        if (form.decision === "APPROVE")
          await approveEmployeeMovement(token, form.id, {
            comments: form.comments || undefined,
          })
        if (form.decision === "REJECT")
          await rejectEmployeeMovement(token, form.id, {
            comments: form.comments,
          })
        if (form.decision === "RETURN")
          await returnEmployeeMovement(token, form.id, {
            comments: form.comments,
          })
      }
      toast.success("Saved.")
      setCreateOpen(false)
      await load()
    } catch (errorObject) {
      setFormError(
        errorObject instanceof Error ? errorObject.message : "Could not save.",
      )
    } finally {
      setSaving(false)
    }
  }

  const visible = rows.filter(
    (row) =>
      !search ||
      JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  )
  const awaiting = rows.filter((row) =>
    ["SUBMITTED", "PENDING_APPROVAL"].includes(statusOf(row)),
  ).length
  const approved = rows.filter((row) => statusOf(row) === "APPROVED").length
  const applied = rows.filter((row) => statusOf(row) === "APPLIED").length
  const cycleCounts = [
    {
      status: "DRAFT",
      count: rows.filter((row) =>
        ["DRAFT", "RETURNED_FOR_CORRECTION"].includes(statusOf(row)),
      ).length,
    },
    { status: "AWAITING_DECISION", count: awaiting },
    { status: "APPROVED", count: approved },
    { status: "APPLIED", count: applied },
  ]

  const columns = React.useMemo<Column<AdminRecord>[]>(
    () => [
      {
        key: "case",
        label: "Movement",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">
              {readString(
                row,
                ["title", "movementNo", "movement_no"],
                `Movement #${rowId(row)}`,
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {employeeLabel(row)} ·{" "}
              {prettify(readString(row, ["movementType", "movement_type"], ""))}
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
        key: "effective",
        label: "Effective",
        render: (row) => formatDate(row.effectiveDate ?? row.effective_date),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => {
          const id = rowId(row)
          const status = statusOf(row)
          return (
            <div className="flex flex-wrap gap-1">
              {["DRAFT", "RETURNED_FOR_CORRECTION"].includes(status) ? (
                <>
                  {canCreateMovement ? (
                    <button
                      type="button"
                      className={actionButtonClass}
                      disabled={busyId === `edit-${id}`}
                      onClick={() => void openEdit(row)}
                    >
                      {busyId === `edit-${id}` ? (
                        <FluentLoadingIndicator className="size-3.5 animate-spin" />
                      ) : (
                        <PencilIcon className="size-3.5" />
                      )}
                      Edit
                    </button>
                  ) : null}
                  {canCancelMovement ? (
                    <button
                      type="button"
                      className={actionButtonClass}
                      disabled={busyId === `delete-${id}`}
                      onClick={() => void deleteMovement(row)}
                    >
                      {busyId === `delete-${id}` ? (
                        <FluentLoadingIndicator className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2Icon className="size-3.5" />
                      )}
                      Delete
                    </button>
                  ) : null}
                  {canSubmitMovement ? (
                    <button
                      type="button"
                      className={actionButtonClass}
                      disabled={busyId === `submit-${id}`}
                      onClick={() => void runAction(row, "submit")}
                    >
                      Submit
                    </button>
                  ) : null}
                </>
              ) : null}
              {canCancelMovement &&
              [
                "DRAFT",
                "SUBMITTED",
                "PENDING_APPROVAL",
                "RETURNED_FOR_CORRECTION",
              ].includes(status) ? (
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `cancel-${id}`}
                  onClick={() => void runAction(row, "cancel")}
                >
                  Cancel
                </button>
              ) : null}
              {canDecideMovement &&
              ["SUBMITTED", "PENDING_APPROVAL"].includes(status) ? (
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => {
                    setCreateMode("decide")
                    setForm({ id, decision: "APPROVE", comments: "" })
                    setCreateOpen(true)
                  }}
                >
                  Decide
                </button>
              ) : null}
              {canApplyMovement && status === "APPROVED" ? (
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `apply-${id}`}
                  onClick={() => void runAction(row, "apply")}
                >
                  Apply
                </button>
              ) : null}
              {canGenerateLetter &&
              ["APPROVED", "SCHEDULED", "APPLIED"].includes(status) ? (
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `letter-${id}`}
                  onClick={() => void generateLetter(row)}
                >
                  {busyId === `letter-${id}` ? (
                    <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  ) : null}
                  Generate letter
                </button>
              ) : null}
            </div>
          )
        },
      },
    ],
    [
      busyId,
      canApplyMovement,
      canCancelMovement,
      canCreateMovement,
      canDecideMovement,
      canGenerateLetter,
      canSubmitMovement,
      deleteMovement,
      runAction,
    ],
  )

  const operationColumns = React.useMemo<Column<AdminRecord>[]>(
    () => [
      {
        key: "type",
        label: "Operation",
        render: (row) =>
          prettify(
            readString(row, ["operationType", "operation_type"], "Operation"),
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
        key: "error",
        label: "Last error",
        render: (row) => readString(row, ["lastError", "last_error"], "—"),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => {
          const operationId = rowId(row)
          const movementId = selected ? rowId(selected) : ""
          return (
            <button
              type="button"
              className={actionButtonClass}
              disabled={!movementId || busyId === `retry-${operationId}`}
              onClick={() => {
                const token = readStoredToken()
                if (!token || !movementId || !operationId) return
                setBusyId(`retry-${operationId}`)
                void retryEmployeeMovementOperation(
                  token,
                  movementId,
                  operationId,
                )
                  .then(() => {
                    toast.success("Retry queued.")
                    return loadOperations(selected!)
                  })
                  .catch((errorObject) =>
                    toast.error(
                      errorObject instanceof Error
                        ? errorObject.message
                        : "Could not retry.",
                    ),
                  )
                  .finally(() => setBusyId(""))
              }}
            >
              Retry
            </button>
          )
        },
      },
    ],
    [busyId, selected],
  )

  if (!canAccess) return null

  const showTarget =
    form.movement_type === "COMPOSITE" ||
    [
      "BRANCH_TRANSFER",
      "DEPARTMENT_TRANSFER",
      "POSITION_CHANGE",
      "PROMOTION",
      "DEMOTION",
      "GRADE_CHANGE",
      "COST_CENTER_CHANGE",
      "REPORTING_MANAGER_CHANGE",
      "EMPLOYMENT_TYPE_CHANGE",
    ].includes(form.movement_type ?? "")

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="Movements"
            title="Employee movement operations"
            description="Transfers, promotions, and other assignment changes."
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
          <div className="rounded-xl border border-border bg-card">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Cases",
                  value: rows.length,
                  hint: "All movement records",
                },
                {
                  label: "Awaiting decision",
                  value: awaiting,
                  hint: "Submitted or pending approval",
                },
                { label: "Approved", value: approved, hint: "Ready to apply" },
                {
                  label: "Applied",
                  value: applied,
                  hint: "Changes already in effect",
                },
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
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.hint}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-sm font-semibold">Movement cycle</h2>
              <p className="text-xs text-muted-foreground">
                {rows.length} total
              </p>
            </div>
            <ol className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start">
              {cycleCounts.map((step, index) => {
                const last = index === cycleCounts.length - 1
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
                )
              })}
            </ol>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {workspace === "team"
                ? "Team movements"
                : activeTab === "cases"
                  ? "Movement cases"
                  : "Follow-on operations"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {workspace === "team"
                ? "Movements for employees in your reporting scope."
                : activeTab === "cases"
                  ? "Create, submit, decide, and apply movements."
                  : "Retry operations that run after a movement is applied."}
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
            {activeTab === "cases" && canCreateMovement ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  setCreateMode("create")
                  setInitialSalaryOverrides(null)
                  setForm({
                    movement_type: "DEPARTMENT_TRANSFER",
                    effective_date: new Date().toISOString().slice(0, 10),
                  })
                  setCreateOpen(true)
                }}
              >
                <PlusIcon className="size-4" /> New movement
              </button>
            ) : null}
          </div>
        </div>
      )}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          <SearchToggleField
            value={search}
            onChange={setSearch}
            placeholder="Search"
          />
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Movements"
              data={visible}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey={`movements-${activeTab}`}
              onRowSelect={(_, row) => {
                if (!row) return
                setDetail(row)
                if (activeTab === "operations") void loadOperations(row)
              }}
            />
          </div>
        </div>
      ) : null}

      {activeTab === "operations" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ResizableTable
            title={
              selected
                ? `Operations for ${readString(selected, ["title"], `#${rowId(selected)}`)}`
                : "Select a movement"
            }
            data={operations}
            columns={operationColumns}
            loading={false}
            itemsPerPage={20}
            showExport={false}
            storageKey="movement-operations"
          />
        </div>
      ) : null}

      <RecordDetailsDialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
        title={optionLabel(detail)}
        row={detail}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {createMode === "create"
                ? "New movement"
                : createMode === "edit"
                  ? "Edit movement"
                  : "Decide movement"}
            </DialogTitle>
            <DialogDescription>
              {createMode === "decide"
                ? "Record your approval decision."
                : "Record the employee, effective date, and proposed changes."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "create" || createMode === "edit" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Employee</span>
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
                        value: rowId(employee),
                        label: employeeLabel(employee),
                      })),
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Type</span>
                  <FluentSelect
                    ariaLabel="Type"
                    className="w-full"
                    value={form.movement_type ?? "DEPARTMENT_TRANSFER"}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        movement_type: value,
                      }))
                    }
                    options={MOVEMENT_TYPES.map((type) => ({
                      value: type,
                      label: prettify(type),
                    }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Title</span>
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
                </label>
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
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Effective date</span>
                  <DateInput

                    className={inputClass}
                    value={form.effective_date ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        effective_date: event.target.value,
                      }))
                    }
                  />
                </label>
                {showTarget &&
                (form.movement_type === "BRANCH_TRANSFER" ||
                  form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New branch</span>
                    <FluentSelect
                      ariaLabel="New branch"
                      className="w-full"
                      value={form.new_branch_id ?? ""}
                      placeholder="Select"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          new_branch_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select" },
                        ...branches.map((row) => ({
                          value: rowId(row),
                          label: optionLabel(row),
                        })),
                      ]}
                    />
                  </label>
                ) : null}
                {showTarget &&
                (form.movement_type === "DEPARTMENT_TRANSFER" ||
                  form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New department</span>
                    <FluentSelect
                      ariaLabel="New department"
                      className="w-full"
                      value={form.new_department_id ?? ""}
                      placeholder="Select"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          new_department_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select" },
                        ...departments.map((row) => ({
                          value: rowId(row),
                          label: optionLabel(row),
                        })),
                      ]}
                    />
                  </label>
                ) : null}
                {showTarget &&
                [
                  "POSITION_CHANGE",
                  "PROMOTION",
                  "DEMOTION",
                  "COMPOSITE",
                ].includes(form.movement_type ?? "") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New position</span>
                    <FluentSelect
                      ariaLabel="New position"
                      className="w-full"
                      value={form.new_position_id ?? ""}
                      placeholder="Select"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          new_position_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select" },
                        ...positions.map((row) => ({
                          value: rowId(row),
                          label: optionLabel(row),
                        })),
                      ]}
                    />
                  </label>
                ) : null}
                {showTarget &&
                (form.movement_type === "GRADE_CHANGE" ||
                  form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New grade</span>
                    <FluentSelect
                      ariaLabel="New grade"
                      className="w-full"
                      value={form.new_grade_id ?? ""}
                      placeholder="Select"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          new_grade_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select" },
                        ...grades.map((row) => ({
                          value: rowId(row),
                          label: optionLabel(row),
                        })),
                      ]}
                    />
                  </label>
                ) : null}
                {showTarget &&
                (form.movement_type === "COST_CENTER_CHANGE" ||
                  form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New cost center</span>
                    <FluentSelect
                      ariaLabel="New cost center"
                      className="w-full"
                      value={form.new_cost_center_id ?? ""}
                      placeholder="Select"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          new_cost_center_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select" },
                        ...costCenters.map((row) => ({
                          value: rowId(row),
                          label: optionLabel(row),
                        })),
                      ]}
                    />
                  </label>
                ) : null}
                {showTarget &&
                (form.movement_type === "REPORTING_MANAGER_CHANGE" ||
                  form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New manager</span>
                    <FluentSelect
                      ariaLabel="New manager"
                      className="w-full"
                      value={form.new_manager_employee_id ?? ""}
                      placeholder="Select"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          new_manager_employee_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select" },
                        ...employees.map((row) => ({
                          value: rowId(row),
                          label: employeeLabel(row),
                        })),
                      ]}
                    />
                  </label>
                ) : null}
                {showTarget &&
                (form.movement_type === "EMPLOYMENT_TYPE_CHANGE" ||
                  form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New employment type</span>
                    <FluentSelect
                      ariaLabel="New employment type"
                      className="w-full"
                      value={form.new_employment_type ?? ""}
                      placeholder="Select"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          new_employment_type: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Select" },
                        ...EMPLOYMENT_TYPES.map((type) => ({
                          value: type,
                          label: prettify(type),
                        })),
                      ]}
                    />
                  </label>
                ) : null}
                {["SALARY_REVISION", "COMPOSITE"].includes(
                  form.movement_type,
                ) ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Base salary</span>
                      <input
                        className={inputClass}
                        value={form.base_salary ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            base_salary: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Currency</span>
                      <input
                        className={inputClass}
                        value={form.currency ?? "TZS"}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            currency: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Salary structure</span>
                      {salaryStructureCodes.length > 0 ? (
                        <FluentSelect
                          ariaLabel="Salary structure"
                          className="w-full"
                          value={form.salary_structure_code ?? ""}
                          placeholder="Keep current structure"
                          onChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              salary_structure_code: value,
                            }))
                          }
                          options={[
                            { value: "", label: "Keep current structure" },
                            ...salaryStructureCodes.map((item) => ({
                              value: item.code,
                              label: `${item.code} · ${item.name}`,
                            })),
                          ]}
                        />
                      ) : (
                        <input
                          className={inputClass}
                          placeholder="Leave blank to keep current structure"
                          value={form.salary_structure_code ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              salary_structure_code: event.target.value,
                            }))
                          }
                        />
                      )}
                    </label>
                    <MovementSalaryOverridesEditor
                      employeeId={form.employee_id ?? ""}
                      targetStructureCode={form.salary_structure_code ?? ""}
                      effectiveDate={form.effective_date ?? ""}
                      structures={salaryStructures}
                      initialOverrides={
                        initialSalaryOverrides?.employeeId === form.employee_id
                          ? initialSalaryOverrides.overrides
                          : undefined
                      }
                      onChange={setSalaryOverrides}
                    />
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Justification</span>
                      <Textarea
                        className={textareaClass}
                        value={form.justification ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            justification: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Decision</span>
                  <FluentSelect
                    ariaLabel="Decision"
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
                    ]}
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
            )}
            {formError ? (
              <p className="text-sm text-rose-600">{formError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => void onSave()}
              disabled={saving}
            >
              {saving ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                "Save"
              )}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
