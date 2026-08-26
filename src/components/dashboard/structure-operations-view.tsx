"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  HeroBand,
  StatStrip,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  inputClass,
  optionLabel,
  primaryButtonClass,
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
  createCostCenter,
  createEmployeeGrade,
  deleteCostCenter,
  deleteEmployeeGrade,
  getCostCenter,
  getEmployeeGrade,
  listBranches,
  listCostCenters,
  listDepartments,
  listEmployeeGrades,
  patchCostCenter,
  patchEmployeeGrade,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { EmployeeSetupView } from "@/components/dashboard/employee-setup-view"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type StructureOpsTab = "cost-centers" | "grades" | "numbering"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

export function StructureOperationsView({ activeTab }: { activeTab: StructureOpsTab }) {
  const actor = useDashboardActor()
  const structurePath =
    activeTab === "grades"
      ? "/dashboard/structure/grades"
      : activeTab === "numbering"
        ? "/dashboard/structure/numbering"
        : "/dashboard/structure/cost-centers"
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute(structurePath, actor.permissionLabels, actor.accessMode)
  const leaveIfForbidden = useLeaveIfForbidden()
  useForbiddenRouteGuard(canAccess)

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
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
      activeTab === "grades"
        ? listEmployeeGrades(token).then(setRows).catch((errorObject) => {
            setRows([])
            throw errorObject
          })
        : listCostCenters(token).then(setRows).catch((errorObject) => {
            setRows([])
            throw errorObject
          }),
    ]
    if (activeTab === "cost-centers") {
      tasks.push(
        listBranches(token, { page: 1, limit: 50 }).then((result) => setBranches(result.rows)).catch(() => setBranches([])),
        listDepartments(token, { page: 1, limit: 50 }).then((result) => setDepartments(result.rows)).catch(() => setDepartments([])),
      )
    }
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load structure data.")
    }
    setLoading(false)
  }, [activeTab, leaveIfForbidden])

  React.useEffect(() => {
    if (!canAccess || activeTab === "numbering") return
    void load()
  }, [activeTab, canAccess, load])

  const visible = rows.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

  async function onSave() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (activeTab === "grades") {
        if (!form.code || !form.name) throw new Error("Add a short code and a grade name.")
        const payload = {
          code: form.code,
          name: form.name,
          level: form.level ? Number(form.level) : undefined,
          description: form.description || undefined,
          status: form.status || undefined,
        }
        if (form.id) await patchEmployeeGrade(token, form.id, payload)
        else await createEmployeeGrade(token, payload)
      } else {
        if (!form.code || !form.name) throw new Error("Add a short code and a cost center name.")
        const payload: AdminRecord = {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          status: form.status || undefined,
        }
        if (form.branch_id) payload.branch_id = Number(form.branch_id)
        if (form.department_id) payload.department_id = Number(form.department_id)
        if (form.id) await patchCostCenter(token, form.id, payload)
        else await createCostCenter(token, payload)
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

  async function onDelete(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setBusyId(`del-${id}`)
    try {
      if (activeTab === "grades") await deleteEmployeeGrade(token, id)
      else await deleteCostCenter(token, id)
      toast.success("Deleted.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not delete.")
    } finally {
      setBusyId("")
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "grades") {
      return [
        { key: "code", label: "Short code", render: (row) => readString(row, ["code"], "—") },
        { key: "name", label: "Grade name", render: (row) => optionLabel(row) },
        { key: "level", label: "Rank", render: (row) => readString(row, ["level"], "—") },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} /> },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <div className="flex flex-wrap gap-1">
              <button type="button" className={actionButtonClass} onClick={(event) => {
                event.stopPropagation()
                setForm({
                  id: rowId(row),
                  code: readString(row, ["code"]),
                  name: readString(row, ["name"]),
                  level: readString(row, ["level"]),
                  description: readString(row, ["description"]),
                  status: readString(row, ["status"], "active"),
                })
                setCreateOpen(true)
              }}>Edit</button>
              <button type="button" className={actionButtonClass} disabled={busyId === `del-${rowId(row)}`} onClick={(event) => {
                event.stopPropagation()
                void onDelete(row)
              }}>Delete</button>
            </div>
          ),
        },
      ]
    }
    return [
      { key: "code", label: "Code", render: (row) => readString(row, ["code"], "—") },
      { key: "name", label: "Name", render: (row) => optionLabel(row) },
      { key: "branch", label: "Branch", render: (row) => optionLabel(row.branch as AdminRecord) === "—" ? readString(row, ["branchName", "branch_name"], "—") : optionLabel(row.branch as AdminRecord) },
      { key: "department", label: "Department", render: (row) => optionLabel(row.department as AdminRecord) === "—" ? readString(row, ["departmentName", "department_name"], "—") : optionLabel(row.department as AdminRecord) },
      { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} /> },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            <button type="button" className={actionButtonClass} onClick={(event) => {
              event.stopPropagation()
              setForm({
                id: rowId(row),
                code: readString(row, ["code"]),
                name: readString(row, ["name"]),
                description: readString(row, ["description"]),
                status: readString(row, ["status"], "active"),
                branch_id: readString(row, ["branchId", "branch_id"]),
                department_id: readString(row, ["departmentId", "department_id"]),
              })
              setCreateOpen(true)
            }}>Edit</button>
            <button type="button" className={actionButtonClass} disabled={busyId === `del-${rowId(row)}`} onClick={(event) => {
              event.stopPropagation()
              void onDelete(row)
            }}>Delete</button>
          </div>
        ),
      },
    ]
  }, [activeTab, busyId])

  if (!canAccess) return null

  if (activeTab === "numbering") {
    return (
      <section className="space-y-4">
        <TalentDoodleSprites />
        <HeroBand
          eyebrow="Structure"
          title="Employee numbering"
          description="Set the prefix, digit width, and next ID assigned when someone joins."
        />
        <EmployeeSetupView />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="Structure"
        title={activeTab === "grades" ? "Pay grades" : "Cost centers"}
        description={
          activeTab === "grades"
            ? "Grades group people by pay and seniority. Use them on employee records and promotions."
            : "Cost centers show where money is spent. Assign them to branches or departments."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                setForm({ status: "active" })
                setFormError(null)
                setCreateOpen(true)
              }}
            >
              <PlusIcon className="size-4" />
              {activeTab === "grades" ? "Add a grade" : "Add a cost center"}
            </button>
          </div>
        }
      />
      <StatStrip
        items={[
          {
            label: activeTab === "grades" ? "Grades" : "Cost centers",
            value: rows.length,
            hint: activeTab === "grades" ? "Pay bands on file" : "Spend codes on file",
          },
          {
            label: "In use",
            value: rows.filter((row) => !["inactive", "disabled"].includes(readString(row, ["status"]).toLowerCase())).length,
            hint: activeTab === "grades" ? "Ready to assign" : "Open for posting",
          },
          {
            label: activeTab === "grades" ? "With a rank" : "Linked to a team",
            value: rows.filter((row) =>
              readString(
                row,
                activeTab === "grades"
                  ? ["level"]
                  : ["departmentId", "department_id", "branchId", "branch_id"],
              ),
            ).length,
            hint: activeTab === "grades" ? "Have a seniority level" : "Tied to a branch or department",
          },
        ]}
      />
      <SearchToggleField value={search} onChange={setSearch} placeholder="Search" />
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ResizableTable
          title={activeTab === "grades" ? "Grades" : "Cost centers"}
          data={visible}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          storageKey={`structure-${activeTab}`}
          onRowSelect={(_, row) => {
            if (!row) return
            setDetail(row)
            const token = readStoredToken()
            const id = rowId(row)
            if (!token || !id) return
            const loader = activeTab === "grades" ? getEmployeeGrade : getCostCenter
            void loader(token, id).then((record) => record && setDetail(record)).catch(() => undefined)
          }}
        />
      </div>
      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail)} row={detail} />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {form.id
                ? activeTab === "grades"
                  ? "Edit pay grade"
                  : "Edit cost center"
                : activeTab === "grades"
                  ? "Add a pay grade"
                  : "Add a cost center"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "grades"
                ? "Give this grade a short code and a name people will recognize, like G4 or Senior Officer."
                : "Give this cost center a short code and a name, then link it to a branch or department if needed."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Short code</span>
              <input
                className={inputClass}
                value={form.code ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                placeholder={activeTab === "grades" ? "e.g. G4" : "e.g. CC-OPS"}
              />
              <span className="text-xs text-muted-foreground">Used in reports and employee records. Keep it short.</span>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{activeTab === "grades" ? "Grade name" : "Cost center name"}</span>
              <input
                className={inputClass}
                value={form.name ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={activeTab === "grades" ? "e.g. Senior Officer" : "e.g. Operations"}
              />
            </label>
            {activeTab === "grades" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Rank (optional)</span>
                <input
                  type="number"
                  className={inputClass}
                  value={form.level ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}
                  placeholder="e.g. 4"
                />
                <span className="text-xs text-muted-foreground">Lower numbers are usually more junior.</span>
              </label>
            ) : (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Branch (optional)</span>
                  <select className={inputClass} value={form.branch_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, branch_id: event.target.value }))}>
                    <option value="">All branches</option>
                    {branches.map((row) => <option key={rowId(row)} value={rowId(row)}>{optionLabel(row)}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Department (optional)</span>
                  <select className={inputClass} value={form.department_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value }))}>
                    <option value="">All departments</option>
                    {departments.map((row) => <option key={rowId(row)} value={rowId(row)}>{optionLabel(row)}</option>)}
                  </select>
                </label>
              </>
            )}
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">In use</span>
              <select className={inputClass} value={form.status ?? "active"} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="active">Yes, assign this to people</option>
                <option value="inactive">No, keep it on file only</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Notes (optional)</span>
              <textarea
                className={textareaClass}
                value={form.description ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={
                  activeTab === "grades"
                    ? "Anything HR should remember about this grade"
                    : "Anything finance should remember about this cost center"
                }
              />
            </label>
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSave()} disabled={saving}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : form.id ? "Save changes" : activeTab === "grades" ? "Add grade" : "Add cost center"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
