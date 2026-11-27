"use client"

import * as React from "react"
import { Pencil, Power } from "lucide-react"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { LeaveCatalogFrame } from "@/components/dashboard/leave-catalog-frame"
import { Button } from "@/components/ui/button"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Checkbox } from "@/components/ui/checkbox"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import {
  deactivateLeaveManagementRule,
  listDepartments,
  listEmployeeGrades,
  listEmployees,
  listLeaveManagementRules,
  listLeaveTypes,
  listPositions,
  listRolesCatalog,
  saveLeaveManagementRule,
  type AdminRecord,
} from "@/lib/admin-api"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"

type Option = { value: string; label: string }

type RuleForm = {
  id: string | null
  name: string
  leave_type_ids: string[]
  min_total_days: string
  position_ids: string[]
  grade_ids: string[]
  department_ids: string[]
  approver_type: "role" | "position" | "company_user"
  approver_id: string
}

const EMPTY_FORM: RuleForm = {
  id: null,
  name: "",
  leave_type_ids: [],
  min_total_days: "",
  position_ids: [],
  grade_ids: [],
  department_ids: [],
  approver_type: "role",
  approver_id: "",
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

function toOptions(rows: AdminRecord[], label: (row: AdminRecord) => string): Option[] {
  return rows
    .filter((row) => row.id !== undefined && row.id !== null)
    .map((row) => ({ value: String(row.id), label: label(row) }))
}

function MultiPick({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string
  hint: string
  options: Option[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <fieldset className="grid min-w-0 gap-1">
      <legend className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</legend>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="max-h-32 overflow-y-auto rounded-md border border-border p-1.5">
        {options.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">None available.</p>
        ) : (
          options.map((option) => {
            const checked = value.includes(option.value)
            return (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() =>
                    onChange(checked ? value.filter((item) => item !== option.value) : [...value, option.value])
                  }
                />
                <span className="truncate">{option.label}</span>
              </label>
            )
          })
        )}
      </div>
    </fieldset>
  )
}

/**
 * HR-configured conditions that add a management approval after HR, e.g.
 * long leave, specific leave types, or senior positions/grades.
 */
export function LeaveManagementRulesPanel({
  token,
  canEdit,
}: {
  token: string | null
  canEdit: boolean
}) {
  const [rules, setRules] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<RuleForm | null>(null)
  const [options, setOptions] = React.useState<{
    leaveTypes: Option[]
    positions: Option[]
    grades: Option[]
    departments: Option[]
    roles: Option[]
    users: Option[]
  }>({ leaveTypes: [], positions: [], grades: [], departments: [], roles: [], users: [] })

  const load = React.useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      setRules(await listLeaveManagementRules(token))
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not load management approval rules.")
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadOptions = React.useCallback(async () => {
    if (!token) return
    const safe = <T,>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback)
    const [leaveTypes, positions, grades, departments, roles, employees] = await Promise.all([
      safe(listLeaveTypes(token, { page: 1, limit: 200 }), { rows: [] as AdminRecord[], page: 1, limit: 0, total: 0, totalPages: 1 }),
      safe(listPositions(token, { page: 1, limit: 200 }), { rows: [] as AdminRecord[], page: 1, limit: 0, total: 0, totalPages: 1 }),
      safe(listEmployeeGrades(token), [] as AdminRecord[]),
      safe(listDepartments(token, { page: 1, limit: 200 }), { rows: [] as AdminRecord[], page: 1, limit: 0, total: 0, totalPages: 1 }),
      safe(listRolesCatalog(token), { rows: [] as AdminRecord[], page: 1, limit: 0, total: 0, totalPages: 1 }),
      safe(listEmployees(token, { page: 1, limit: 500 }), { rows: [] as AdminRecord[], page: 1, limit: 0, total: 0, totalPages: 1 }),
    ])
    const name = (row: AdminRecord) => String(row.name ?? row.title ?? row.display_name ?? `#${String(row.id)}`)
    setOptions({
      leaveTypes: toOptions(leaveTypes.rows, name),
      positions: toOptions(positions.rows, name),
      grades: toOptions(grades, name),
      departments: toOptions(departments.rows, name),
      roles: toOptions(roles.rows, (row) => String(row.display_name ?? row.name ?? `#${String(row.id)}`)),
      users: employees.rows
        .filter((row) => row.company_user_id)
        .map((row) => ({
          value: String(row.company_user_id),
          label: [row.first_name, row.last_name].filter(Boolean).join(" ") || `Employee #${String(row.id)}`,
        })),
    })
  }, [token])

  React.useEffect(() => {
    void load()
  }, [load])

  const openForm = (row?: AdminRecord) => {
    void loadOptions()
    if (!row) {
      setForm({ ...EMPTY_FORM })
      return
    }
    const approverType = (String(row.approver_type ?? "role") as RuleForm["approver_type"])
    setForm({
      id: String(row.id),
      name: String(row.name ?? ""),
      leave_type_ids: idList(row.leave_type_ids),
      min_total_days: row.min_total_days == null ? "" : String(Number(row.min_total_days)),
      position_ids: idList(row.position_ids),
      grade_ids: idList(row.grade_ids),
      department_ids: idList(row.department_ids),
      approver_type: approverType,
      approver_id: String(
        approverType === "role" ? (row.role_id ?? "") : approverType === "position" ? (row.position_id ?? "") : (row.company_user_id ?? ""),
      ),
    })
  }

  const save = async () => {
    if (!token || !form) return
    if (!form.name.trim() || !form.approver_id) {
      showErrorAlert("Give the rule a name and choose the management approver.")
      return
    }
    setSaving(true)
    try {
      const numbers = (values: string[]) => values.map(Number)
      await saveLeaveManagementRule(
        token,
        {
          name: form.name.trim(),
          leave_type_ids: numbers(form.leave_type_ids),
          min_total_days: form.min_total_days.trim() === "" ? null : Number(form.min_total_days),
          position_ids: numbers(form.position_ids),
          grade_ids: numbers(form.grade_ids),
          department_ids: numbers(form.department_ids),
          approver_type: form.approver_type,
          role_id: form.approver_type === "role" ? Number(form.approver_id) : null,
          position_id: form.approver_type === "position" ? Number(form.approver_id) : null,
          company_user_id: form.approver_type === "company_user" ? Number(form.approver_id) : null,
          status: "active",
        },
        form.id ?? undefined,
      )
      showSuccessAlert("Management approval rule saved.")
      setForm(null)
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not save the rule.")
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (row: AdminRecord) => {
    if (!token) return
    try {
      await deactivateLeaveManagementRule(token, String(row.id))
      showSuccessAlert("Rule deactivated. Requests already routed keep their approvers.")
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not deactivate the rule.")
    }
  }

  const describe = (row: AdminRecord) => {
    const parts: string[] = []
    if (idList(row.leave_type_ids).length) parts.push(`${idList(row.leave_type_ids).length} leave type(s)`)
    if (row.min_total_days != null) parts.push(`${Number(row.min_total_days)}+ days`)
    if (idList(row.position_ids).length) parts.push(`${idList(row.position_ids).length} position(s)`)
    if (idList(row.grade_ids).length) parts.push(`${idList(row.grade_ids).length} grade(s)`)
    if (idList(row.department_ids).length) parts.push(`${idList(row.department_ids).length} department(s)`)
    return parts.length ? parts.join(" · ") : "Every leave request"
  }

  const approverOptions =
    form?.approver_type === "position" ? options.positions : form?.approver_type === "company_user" ? options.users : options.roles

  return (
    <>
      <LeaveCatalogFrame
        title="Management approval rules"
        subtitle="Manager → HR → Management. Requests matching an active rule need management approval after HR."
        search=""
        onSearchChange={() => undefined}
        searchPlaceholder="Search rules"
        searchAriaLabel="Search management approval rules"
        filterAriaLabel="Filter management approval rules"
        filterGroups={[]}
        onFilterChange={() => undefined}
        onRefresh={() => void load()}
        loading={loading}
        createLabel="New rule"
        onCreate={() => openForm()}
        canCreate={canEdit}
        emptyTitle="No management approval rules"
        emptyDescription="Without rules, leave follows Manager → HR. Add a rule for long leave, specific leave types or senior staff."
        isEmpty={rules.length === 0}
        showSkeleton={loading && rules.length === 0}
      >
        <ul className="divide-y divide-slate-100 dark:divide-border">
          {rules.map((row) => {
            const inactive = String(row.status ?? "active") !== "active"
            return (
              <li key={String(row.id)} className={cn("flex items-center gap-3 px-3 py-2.5", inactive && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {String(row.name ?? "Rule")}
                    {inactive ? <span className="ml-2 text-xs font-normal text-muted-foreground">Inactive</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{describe(row)}</p>
                </div>
                {canEdit ? (
                  <div className="flex shrink-0 gap-1">
                    <Button appearance="subtle" size="small" icon={<Pencil className="size-3.5" />} aria-label="Edit rule" onClick={() => openForm(row)} />
                    {!inactive ? (
                      <Button appearance="subtle" size="small" icon={<Power className="size-3.5" />} aria-label="Deactivate rule" onClick={() => void deactivate(row)} />
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </LeaveCatalogFrame>

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogPopup className="sm:max-w-2xl" bodyClassName="!h-full !max-h-none">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit management approval rule" : "New management approval rule"}</DialogTitle>
            <DialogDescription>
              Every condition you set must match. Leave a condition empty to ignore it.
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
              <FormField label="Rule name" htmlFor="leave-rule-name" className="sm:col-span-2">
                <Input
                  id="leave-rule-name"
                  value={form.name}
                  placeholder="e.g. Long annual leave"
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </FormField>
              <FormField label="Minimum request length (days)" htmlFor="leave-rule-min-days">
                <Input
                  id="leave-rule-min-days"
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="Any length"
                  value={form.min_total_days}
                  onChange={(event) => setForm({ ...form, min_total_days: event.target.value })}
                />
              </FormField>
              <div className="grid gap-1 text-xs">
                <span className="font-medium">Management approver</span>
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-1.5">
                  <FluentSelect
                    ariaLabel="Approver type"
                    value={form.approver_type}
                    onChange={(value) => setForm({ ...form, approver_type: value as RuleForm["approver_type"], approver_id: "" })}
                    options={[
                      { value: "role", label: "Role" },
                      { value: "position", label: "Position" },
                      { value: "company_user", label: "Person" },
                    ]}
                  />
                  <FluentSelect
                    ariaLabel="Approver"
                    value={form.approver_id}
                    onChange={(value) => setForm({ ...form, approver_id: value })}
                    options={[{ value: "", label: "Choose…" }, ...approverOptions]}
                  />
                </div>
              </div>
              <MultiPick
                label="Leave types"
                hint="Empty = any leave type."
                options={options.leaveTypes}
                value={form.leave_type_ids}
                onChange={(next) => setForm({ ...form, leave_type_ids: next })}
              />
              <MultiPick
                label="Applicant positions"
                hint="Empty = any position."
                options={options.positions}
                value={form.position_ids}
                onChange={(next) => setForm({ ...form, position_ids: next })}
              />
              <MultiPick
                label="Applicant grades (levels)"
                hint="Empty = any grade."
                options={options.grades}
                value={form.grade_ids}
                onChange={(next) => setForm({ ...form, grade_ids: next })}
              />
              <MultiPick
                label="Applicant departments"
                hint="Empty = any department."
                options={options.departments}
                value={form.department_ids}
                onChange={(next) => setForm({ ...form, department_ids: next })}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button appearance="secondary" onClick={() => setForm(null)} disabled={saving}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save rule"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  )
}
