"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
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
  applyEmployeeMovement,
  approveEmployeeMovement,
  cancelEmployeeMovement,
  createEmployeeMovement,
  listBranches,
  listCostCenters,
  listDepartments,
  listEmployeeGrades,
  listEmployeeMovementOperations,
  listEmployeeMovements,
  listEmployees,
  listPositions,
  rejectEmployeeMovement,
  retryEmployeeMovementOperation,
  returnEmployeeMovement,
  submitEmployeeMovement,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type MovementOpsTab = "overview" | "cases" | "operations"

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

export function MovementOperationsView({ activeTab }: { activeTab: MovementOpsTab }) {
  const actor = useDashboardActor()
  const canAccess =
    !actor.ready ||
    canAccessDashboardRoute("/dashboard/movements/overview", actor.permissionLabels, actor.accessMode)
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
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"create" | "decide">("create")
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
      listEmployeeMovements(token).then(setRows).catch((errorObject) => {
        setRows([])
        throw errorObject
      }),
    ]
    if (activeTab === "cases") {
      tasks.push(
        listEmployees(token, { page: 1, limit: 50 }).then((result) => setEmployees(result.rows)).catch(() => setEmployees([])),
        listBranches(token, { page: 1, limit: 50 }).then((result) => setBranches(result.rows)).catch(() => setBranches([])),
        listDepartments(token, { page: 1, limit: 50 }).then((result) => setDepartments(result.rows)).catch(() => setDepartments([])),
        listPositions(token, { page: 1, limit: 50 }).then((result) => setPositions(result.rows)).catch(() => setPositions([])),
        listEmployeeGrades(token).then(setGrades).catch(() => setGrades([])),
        listCostCenters(token).then(setCostCenters).catch(() => setCostCenters([])),
      )
    }
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load movements.")
    }
    setLoading(false)
  }, [activeTab, leaveIfForbidden])

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

  async function runAction(row: AdminRecord, action: "submit" | "cancel" | "apply") {
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
      toast.error(errorObject instanceof Error ? errorObject.message : `Could not ${action}.`)
    } finally {
      setBusyId("")
    }
  }

  async function onSave() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (createMode === "create") {
        if (!form.employee_id || !form.movement_type || !form.title || !form.reason || !form.effective_date) {
          throw new Error("Employee, type, title, reason, and effective date are required.")
        }
        const payload: AdminRecord = {
          employee_id: Number(form.employee_id),
          movement_type: form.movement_type,
          title: form.title,
          reason: form.reason,
          effective_date: form.effective_date,
        }
        if (form.new_branch_id) payload.new_branch_id = Number(form.new_branch_id)
        if (form.new_department_id) payload.new_department_id = Number(form.new_department_id)
        if (form.new_position_id) payload.new_position_id = Number(form.new_position_id)
        if (form.new_grade_id) payload.new_grade_id = Number(form.new_grade_id)
        if (form.new_cost_center_id) payload.new_cost_center_id = Number(form.new_cost_center_id)
        if (form.new_manager_employee_id) payload.new_manager_employee_id = Number(form.new_manager_employee_id)
        if (form.new_employment_type) payload.new_employment_type = form.new_employment_type
        if (form.movement_type === "SALARY_REVISION") {
          if (!form.base_salary || !form.currency || !form.justification) {
            throw new Error("Salary, currency, and justification are required.")
          }
          payload.salary_revision = {
            base_salary: form.base_salary,
            currency: form.currency,
            justification: form.justification,
          }
        }
        await createEmployeeMovement(token, payload)
      } else {
        if (!form.id || !form.decision) throw new Error("A decision is required.")
        if (form.decision !== "APPROVE" && !form.comments) throw new Error("Comments are required.")
        if (form.decision === "APPROVE") await approveEmployeeMovement(token, form.id, { comments: form.comments || undefined })
        if (form.decision === "REJECT") await rejectEmployeeMovement(token, form.id, { comments: form.comments })
        if (form.decision === "RETURN") await returnEmployeeMovement(token, form.id, { comments: form.comments })
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

  const visible = rows.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))
  const awaiting = rows.filter((row) => ["SUBMITTED", "PENDING_APPROVAL"].includes(statusOf(row))).length
  const approved = rows.filter((row) => statusOf(row) === "APPROVED").length
  const applied = rows.filter((row) => statusOf(row) === "APPLIED").length

  const columns = React.useMemo<Column<AdminRecord>[]>(() => [
    {
      key: "case",
      label: "Movement",
      render: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium">{readString(row, ["title", "movementNo", "movement_no"], `Movement #${rowId(row)}`)}</p>
          <p className="text-xs text-muted-foreground">{employeeLabel(row)} · {prettify(readString(row, ["movementType", "movement_type"], ""))}</p>
        </div>
      ),
    },
    { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} /> },
    { key: "effective", label: "Effective", render: (row) => formatDate(row.effectiveDate ?? row.effective_date) },
    {
      key: "actions",
      label: "Actions",
      render: (row) => {
        const id = rowId(row)
        const status = statusOf(row)
        return (
          <div className="flex flex-wrap gap-1">
            {["DRAFT", "RETURNED_FOR_CORRECTION"].includes(status) ? (
              <button type="button" className={actionButtonClass} disabled={busyId === `submit-${id}`} onClick={() => void runAction(row, "submit")}>Submit</button>
            ) : null}
            {["DRAFT", "SUBMITTED", "PENDING_APPROVAL", "RETURNED_FOR_CORRECTION"].includes(status) ? (
              <button type="button" className={actionButtonClass} disabled={busyId === `cancel-${id}`} onClick={() => void runAction(row, "cancel")}>Cancel</button>
            ) : null}
            {["SUBMITTED", "PENDING_APPROVAL"].includes(status) ? (
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
            {status === "APPROVED" ? (
              <button type="button" className={actionButtonClass} disabled={busyId === `apply-${id}`} onClick={() => void runAction(row, "apply")}>Apply</button>
            ) : null}
          </div>
        )
      },
    },
  ], [busyId])

  const operationColumns = React.useMemo<Column<AdminRecord>[]>(() => [
    { key: "type", label: "Operation", render: (row) => prettify(readString(row, ["operationType", "operation_type"], "Operation")) },
    { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "PENDING")} /> },
    { key: "error", label: "Last error", render: (row) => readString(row, ["lastError", "last_error"], "—") },
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
              void retryEmployeeMovementOperation(token, movementId, operationId)
                .then(() => { toast.success("Retry queued."); return loadOperations(selected!) })
                .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not retry."))
                .finally(() => setBusyId(""))
            }}
          >
            Retry
          </button>
        )
      },
    },
  ], [busyId, selected])

  if (!canAccess) return null

  const showTarget =
    form.movement_type === "COMPOSITE" ||
    ["BRANCH_TRANSFER", "DEPARTMENT_TRANSFER", "POSITION_CHANGE", "PROMOTION", "DEMOTION", "GRADE_CHANGE", "COST_CENTER_CHANGE", "REPORTING_MANAGER_CHANGE", "EMPLOYMENT_TYPE_CHANGE"].includes(form.movement_type ?? "")

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="Movements"
            title="Employee movement operations"
            description="Transfers, promotions, and other assignment changes — shown only if you have the grant."
            actions={
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                Refresh
              </button>
            }
          />
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Cases" value={rows.length} />
            <MetricTile label="Awaiting decision" value={awaiting} />
            <MetricTile label="Approved" value={approved} />
            <MetricTile label="Applied" value={applied} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Status mix</h2>
            <div className="mt-4"><StatusStack items={statusChartItems(rows)} /></div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{activeTab === "cases" ? "Movement cases" : "Follow-on operations"}</h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "cases" ? "Create, submit, decide, and apply movements." : "Retry operations that run after a movement is applied."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
            {activeTab === "cases" ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  setCreateMode("create")
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
          <SearchToggleField value={search} onChange={setSearch} placeholder="Search" />
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
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
            title={selected ? `Operations for ${readString(selected, ["title"], `#${rowId(selected)}`)}` : "Select a movement"}
            data={operations}
            columns={operationColumns}
            loading={false}
            itemsPerPage={20}
            showExport={false}
            storageKey="movement-operations"
          />
        </div>
      ) : null}

      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail)} row={detail} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{createMode === "create" ? "New movement" : "Decide movement"}</DialogTitle>
            <DialogDescription>Create a movement or record your decision.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "create" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Employee</span>
                  <select className={inputClass} value={form.employee_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))}>
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={rowId(employee)} value={rowId(employee)}>{employeeLabel(employee)}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Type</span>
                  <select className={inputClass} value={form.movement_type ?? "DEPARTMENT_TRANSFER"} onChange={(event) => setForm((current) => ({ ...current, movement_type: event.target.value }))}>
                    {MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{prettify(type)}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Title</span><input className={inputClass} value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Reason</span><textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Effective date</span><input type="date" className={inputClass} value={form.effective_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_date: event.target.value }))} /></label>
                {showTarget && (form.movement_type === "BRANCH_TRANSFER" || form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New branch</span>
                    <select className={inputClass} value={form.new_branch_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, new_branch_id: event.target.value }))}>
                      <option value="">Select</option>
                      {branches.map((row) => <option key={rowId(row)} value={rowId(row)}>{optionLabel(row)}</option>)}
                    </select>
                  </label>
                ) : null}
                {showTarget && (form.movement_type === "DEPARTMENT_TRANSFER" || form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New department</span>
                    <select className={inputClass} value={form.new_department_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, new_department_id: event.target.value }))}>
                      <option value="">Select</option>
                      {departments.map((row) => <option key={rowId(row)} value={rowId(row)}>{optionLabel(row)}</option>)}
                    </select>
                  </label>
                ) : null}
                {showTarget && ["POSITION_CHANGE", "PROMOTION", "DEMOTION", "COMPOSITE"].includes(form.movement_type ?? "") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New position</span>
                    <select className={inputClass} value={form.new_position_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, new_position_id: event.target.value }))}>
                      <option value="">Select</option>
                      {positions.map((row) => <option key={rowId(row)} value={rowId(row)}>{optionLabel(row)}</option>)}
                    </select>
                  </label>
                ) : null}
                {showTarget && (form.movement_type === "GRADE_CHANGE" || form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New grade</span>
                    <select className={inputClass} value={form.new_grade_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, new_grade_id: event.target.value }))}>
                      <option value="">Select</option>
                      {grades.map((row) => <option key={rowId(row)} value={rowId(row)}>{optionLabel(row)}</option>)}
                    </select>
                  </label>
                ) : null}
                {showTarget && (form.movement_type === "COST_CENTER_CHANGE" || form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New cost center</span>
                    <select className={inputClass} value={form.new_cost_center_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, new_cost_center_id: event.target.value }))}>
                      <option value="">Select</option>
                      {costCenters.map((row) => <option key={rowId(row)} value={rowId(row)}>{optionLabel(row)}</option>)}
                    </select>
                  </label>
                ) : null}
                {showTarget && (form.movement_type === "REPORTING_MANAGER_CHANGE" || form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New manager</span>
                    <select className={inputClass} value={form.new_manager_employee_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, new_manager_employee_id: event.target.value }))}>
                      <option value="">Select</option>
                      {employees.map((row) => <option key={rowId(row)} value={rowId(row)}>{employeeLabel(row)}</option>)}
                    </select>
                  </label>
                ) : null}
                {showTarget && (form.movement_type === "EMPLOYMENT_TYPE_CHANGE" || form.movement_type === "COMPOSITE") ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">New employment type</span>
                    <select className={inputClass} value={form.new_employment_type ?? ""} onChange={(event) => setForm((current) => ({ ...current, new_employment_type: event.target.value }))}>
                      <option value="">Select</option>
                      {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{prettify(type)}</option>)}
                    </select>
                  </label>
                ) : null}
                {form.movement_type === "SALARY_REVISION" ? (
                  <>
                    <label className="grid gap-1.5 text-sm"><span className="font-medium">Base salary</span><input className={inputClass} value={form.base_salary ?? ""} onChange={(event) => setForm((current) => ({ ...current, base_salary: event.target.value }))} /></label>
                    <label className="grid gap-1.5 text-sm"><span className="font-medium">Currency</span><input className={inputClass} value={form.currency ?? "TZS"} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} /></label>
                    <label className="grid gap-1.5 text-sm"><span className="font-medium">Justification</span><textarea className={textareaClass} value={form.justification ?? ""} onChange={(event) => setForm((current) => ({ ...current, justification: event.target.value }))} /></label>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Decision</span>
                  <select className={inputClass} value={form.decision ?? "APPROVE"} onChange={(event) => setForm((current) => ({ ...current, decision: event.target.value }))}>
                    <option value="APPROVE">Approve</option>
                    <option value="RETURN">Return</option>
                    <option value="REJECT">Reject</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Comments</span>
                  <textarea className={textareaClass} value={form.comments ?? ""} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} />
                </label>
              </>
            )}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSave()} disabled={saving}>{saving ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}</button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
