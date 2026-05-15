"use client"

import * as React from "react"

import {
  adjustLeaveBalance,
  cancelLeaveRequest,
  createLeaveHoliday,
  createLeaveRequest,
  createLeaveType,
  deleteLeaveHoliday,
  deleteLeaveType,
  leaveRequestApprovalAction,
  listEmployees,
  listLeaveBalances,
  listLeaveHolidays,
  listLeaveRequests,
  listLeaveTypes,
  patchLeaveHoliday,
  patchLeaveType,
  type AdminRecord,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { Switch } from "@/components/ui/switch"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { showErrorAlert } from "@/lib/error-alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type LeaveTab = "types" | "requests" | "balances" | "holidays"
type LeaveManagementViewProps = {
  activeTab?: LeaveTab
  showTabButtons?: boolean
}

function readStoredToken() {
  if (typeof window === "undefined") {
    return ""
  }

  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  if (direct) {
    return direct
  }

  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (!authTokensRaw) {
    return ""
  }

  try {
    const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
    return (parsed.accessToken ?? parsed.access_token ?? "").trim()
  } catch {
    return ""
  }
}

function readString(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return "-"
}

function readNumber(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function readBoolean(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") {
      return value
    }
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") {
        return true
      }
      if (value.toLowerCase() === "false") {
        return false
      }
    }
  }
  return false
}

export function LeaveManagementView({
  activeTab = "types",
  showTabButtons = true,
}: LeaveManagementViewProps) {
  const [tab, setTab] = React.useState<LeaveTab>(activeTab)
  const [types, setTypes] = React.useState<AdminRecord[]>([])
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [balances, setBalances] = React.useState<AdminRecord[]>([])
  const [holidays, setHolidays] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pendingTypeDelete, setPendingTypeDelete] = React.useState<AdminRecord | null>(null)
  const [pendingHolidayDelete, setPendingHolidayDelete] = React.useState<AdminRecord | null>(null)
  const [pendingRequestCancel, setPendingRequestCancel] = React.useState<AdminRecord | null>(null)
  const [cancelReason, setCancelReason] = React.useState("Cancelled by admin")

  const [typeForm, setTypeForm] = React.useState({
    name: "",
    code: "",
    description: "",
    status: "active",
    is_paid: "true",
    requires_attachment: "false",
  })

  const [requestForm, setRequestForm] = React.useState({
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    submit: "true",
  })

  const [balanceForm, setBalanceForm] = React.useState({
    employee_id: "",
    leave_type_id: "",
    fiscal_year: String(new Date().getFullYear()),
    allocated_days: "0",
    carried_forward_days: "0",
    expired_days: "0",
  })

  const [holidayForm, setHolidayForm] = React.useState({
    name: "",
    holiday_date: "",
    is_recurring: "false",
  })

  const reloadAll = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [typesResult, requestsResult, balancesResult, holidaysResult, employeesResult] = await Promise.all([
        listLeaveTypes(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listLeaveRequests(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listLeaveBalances(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listLeaveHolidays(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listEmployees(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
      ])
      setTypes(typesResult.rows)
      setRequests(requestsResult.rows)
      setBalances(balancesResult.rows)
      setHolidays(holidaysResult.rows)
      setEmployees(employeesResult.rows)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load leave management data."
      setError(message)
      showErrorAlert(message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  React.useEffect(() => {
    setTab(activeTab)
  }, [activeTab])

  const employeeLabel = (employeeId: number | null) => {
    if (employeeId === null) {
      return "-"
    }
    const match = employees.find((row) => readNumber(row, ["id", "employee_id", "user_id"]) === employeeId)
    if (!match) {
      return `#${employeeId}`
    }
    const fullName = readString(match, ["full_name", "name"])
    if (fullName !== "-") {
      return fullName
    }
    return [readString(match, ["first_name"]), readString(match, ["last_name"])]
      .filter((part) => part !== "-")
      .join(" ")
  }

  async function submitTypeForm() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createLeaveType(token, {
        name: typeForm.name.trim(),
        code: typeForm.code.trim(),
        description: typeForm.description.trim(),
        status: typeForm.status,
        is_paid: typeForm.is_paid === "true",
        requires_attachment: typeForm.requires_attachment === "true",
      })
      setTypeForm({
        name: "",
        code: "",
        description: "",
        status: "active",
        is_paid: "true",
        requires_attachment: "false",
      })
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create leave type."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function submitRequestForm() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createLeaveRequest(token, {
        employee_id: Number(requestForm.employee_id),
        leave_type_id: Number(requestForm.leave_type_id),
        start_date: requestForm.start_date,
        end_date: requestForm.end_date,
        reason: requestForm.reason.trim(),
        submit: requestForm.submit === "true",
      })
      setRequestForm({
        employee_id: "",
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
        submit: "true",
      })
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create leave request."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function submitBalanceAdjustment() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await adjustLeaveBalance(token, {
        employee_id: Number(balanceForm.employee_id),
        leave_type_id: Number(balanceForm.leave_type_id),
        fiscal_year: balanceForm.fiscal_year,
        allocated_days: Number(balanceForm.allocated_days),
        carried_forward_days: Number(balanceForm.carried_forward_days),
        expired_days: Number(balanceForm.expired_days),
      })
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to adjust leave balance."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function submitHolidayForm() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createLeaveHoliday(token, {
        name: holidayForm.name.trim(),
        holiday_date: holidayForm.holiday_date,
        is_recurring: holidayForm.is_recurring === "true",
      })
      setHolidayForm({ name: "", holiday_date: "", is_recurring: "false" })
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create holiday."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleTypeStatus(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    const currentStatus = readString(row, ["status"]) === "active" ? "active" : "inactive"
    const nextStatus = currentStatus === "active" ? "inactive" : "active"
    setSaving(true)
    try {
      await patchLeaveType(token, id, { status: nextStatus })
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to update leave type status."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function removeType(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await deleteLeaveType(token, id)
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete leave type."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function approveRequest(row: AdminRecord, approve: boolean) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await leaveRequestApprovalAction(token, id, {
        approve,
        comments: approve ? "Approved from dashboard" : "Rejected from dashboard",
      })
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to update leave request."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function cancelRequest(row: AdminRecord, reason: string) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    if (!reason.trim()) {
      return
    }
    setSaving(true)
    try {
      await cancelLeaveRequest(token, id, reason.trim())
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to cancel leave request."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleHolidayRecurring(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await patchLeaveHoliday(token, id, {
        is_recurring: !readBoolean(row, ["is_recurring"]),
      })
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to update holiday."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function removeHoliday(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await deleteLeaveHoliday(token, id)
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete holiday."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm lg:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {showTabButtons ? ["types", "requests", "balances", "holidays"].map((entry) => {
          const key = entry as LeaveTab
          return (
            <button
              key={entry}
              type="button"
              className={
                tab === key
                  ? "rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  : "rounded-md border border-slate-300 px-3 py-2 text-sm"
              }
              onClick={() => setTab(key)}
            >
              {entry === "types"
                ? "Leave Types"
                : entry === "requests"
                  ? "Leave Requests"
                  : entry === "balances"
                    ? "Leave Balances"
                    : "Holidays"}
            </button>
          )
        }) : null}
        <button
          type="button"
          className={`${showTabButtons ? "ml-auto" : ""} rounded-md border border-slate-300 px-3 py-2 text-sm`}
          onClick={() => void reloadAll()}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

      {tab === "types" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Type name" value={typeForm.name} onChange={(event) => setTypeForm((prev) => ({ ...prev, name: event.target.value }))} />
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Type code" value={typeForm.code} onChange={(event) => setTypeForm((prev) => ({ ...prev, code: event.target.value }))} />
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={typeForm.status} onChange={(event) => setTypeForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={typeForm.is_paid} onChange={(event) => setTypeForm((prev) => ({ ...prev, is_paid: event.target.value }))}>
              <option value="true">Paid</option>
              <option value="false">Unpaid</option>
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={typeForm.requires_attachment} onChange={(event) => setTypeForm((prev) => ({ ...prev, requires_attachment: event.target.value }))}>
              <option value="false">Attachment Optional</option>
              <option value="true">Attachment Required</option>
            </select>
            <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" disabled={saving} onClick={() => void submitTypeForm()}>
              Add Leave Type
            </button>
            <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-3" placeholder="Description" value={typeForm.description} onChange={(event) => setTypeForm((prev) => ({ ...prev, description: event.target.value }))} />
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.82rem] font-semibold uppercase tracking-[0.11em] text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left text-[0.82rem] font-semibold uppercase tracking-[0.11em] text-slate-700">Code</th>
                  <th className="px-4 py-3 text-left text-[0.82rem] font-semibold uppercase tracking-[0.11em] text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left text-[0.82rem] font-semibold uppercase tracking-[0.11em] text-slate-700">Paid</th>
                  <th className="px-4 py-3 text-right text-[0.82rem] font-semibold uppercase tracking-[0.11em] text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {types.map((row, index) => {
                  const id = readNumber(row, ["id"])
                  const isActive = readString(row, ["status"]) === "active"
                  return (
                    <tr key={String(id ?? index)}>
                      <td className="px-4 py-3">{readString(row, ["name"])}</td>
                      <td className="px-4 py-3">{readString(row, ["code"])}</td>
                      <td className="px-4 py-3">
                        <span className={isActive ? "inline-flex rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white" : "inline-flex rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{readBoolean(row, ["is_paid"]) ? "Yes" : "No"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          <Switch checked={isActive} onCheckedChange={() => void toggleTypeStatus(row)} aria-label="Toggle Status" />
                          <button type="button" className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => setPendingTypeDelete(row)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={requestForm.employee_id} onChange={(event) => setRequestForm((prev) => ({ ...prev, employee_id: event.target.value }))}>
              <option value="">Select employee</option>
              {employees.map((employee) => {
                const id = readNumber(employee, ["id", "employee_id", "user_id"])
                if (id === null) return null
                return <option key={id} value={String(id)}>{employeeLabel(id)}</option>
              })}
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={requestForm.leave_type_id} onChange={(event) => setRequestForm((prev) => ({ ...prev, leave_type_id: event.target.value }))}>
              <option value="">Select leave type</option>
              {types.map((type) => {
                const id = readNumber(type, ["id"])
                if (id === null) return null
                return <option key={id} value={String(id)}>{readString(type, ["name"])}</option>
              })}
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={requestForm.submit} onChange={(event) => setRequestForm((prev) => ({ ...prev, submit: event.target.value }))}>
              <option value="true">Submit now</option>
              <option value="false">Save draft</option>
            </select>
            <DatePickerPresets value={requestForm.start_date} onChange={(value) => setRequestForm((prev) => ({ ...prev, start_date: value }))} placeholder="Start date" />
            <DatePickerPresets value={requestForm.end_date} onChange={(value) => setRequestForm((prev) => ({ ...prev, end_date: value }))} placeholder="End date" />
            <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" disabled={saving} onClick={() => void submitRequestForm()}>
              Create Leave Request
            </button>
            <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-3" placeholder="Reason" value={requestForm.reason} onChange={(event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value }))} />
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Employee</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Leave Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Start</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">End</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((row, index) => {
                  const id = readNumber(row, ["id"])
                  return (
                    <tr key={String(id ?? index)}>
                      <td className="px-3 py-2">{employeeLabel(readNumber(row, ["employee_id"]))}</td>
                      <td className="px-3 py-2">{readString(row, ["leave_type_name", "leave_type", "leave_type_id"])}</td>
                      <td className="px-3 py-2">{readString(row, ["start_date"])}</td>
                      <td className="px-3 py-2">{readString(row, ["end_date"])}</td>
                      <td className="px-3 py-2">{readString(row, ["status"])}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-2">
                          <button type="button" className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700" onClick={() => void approveRequest(row, true)}>Approve</button>
                          <button type="button" className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-700" onClick={() => void approveRequest(row, false)}>Reject</button>
                          <button
                            type="button"
                            className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700"
                            onClick={() => {
                              setPendingRequestCancel(row)
                              setCancelReason("Cancelled by admin")
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "balances" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={balanceForm.employee_id} onChange={(event) => setBalanceForm((prev) => ({ ...prev, employee_id: event.target.value }))}>
              <option value="">Select employee</option>
              {employees.map((employee) => {
                const id = readNumber(employee, ["id", "employee_id", "user_id"])
                if (id === null) return null
                return <option key={id} value={String(id)}>{employeeLabel(id)}</option>
              })}
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={balanceForm.leave_type_id} onChange={(event) => setBalanceForm((prev) => ({ ...prev, leave_type_id: event.target.value }))}>
              <option value="">Select leave type</option>
              {types.map((type) => {
                const id = readNumber(type, ["id"])
                if (id === null) return null
                return <option key={id} value={String(id)}>{readString(type, ["name"])}</option>
              })}
            </select>
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Fiscal year" value={balanceForm.fiscal_year} onChange={(event) => setBalanceForm((prev) => ({ ...prev, fiscal_year: event.target.value }))} />
            <input type="number" min={0} className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Allocated days" value={balanceForm.allocated_days} onChange={(event) => setBalanceForm((prev) => ({ ...prev, allocated_days: event.target.value }))} />
            <input type="number" min={0} className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Carried forward" value={balanceForm.carried_forward_days} onChange={(event) => setBalanceForm((prev) => ({ ...prev, carried_forward_days: event.target.value }))} />
            <input type="number" min={0} className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Expired days" value={balanceForm.expired_days} onChange={(event) => setBalanceForm((prev) => ({ ...prev, expired_days: event.target.value }))} />
            <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white md:col-span-3" disabled={saving} onClick={() => void submitBalanceAdjustment()}>
              Adjust Leave Balance
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Employee</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Fiscal Year</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Allocated</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Used</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {balances.map((row, index) => {
                  const id = readNumber(row, ["id"])
                  return (
                    <tr key={String(id ?? index)}>
                      <td className="px-3 py-2">{employeeLabel(readNumber(row, ["employee_id"]))}</td>
                      <td className="px-3 py-2">{readString(row, ["leave_type_name", "leave_type", "leave_type_id"])}</td>
                      <td className="px-3 py-2">{readString(row, ["fiscal_year"])}</td>
                      <td className="px-3 py-2">{String(readNumber(row, ["allocated_days"]) ?? "-")}</td>
                      <td className="px-3 py-2">{String(readNumber(row, ["used_days"]) ?? "-")}</td>
                      <td className="px-3 py-2">{String(readNumber(row, ["remaining_days"]) ?? "-")}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "holidays" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Holiday name" value={holidayForm.name} onChange={(event) => setHolidayForm((prev) => ({ ...prev, name: event.target.value }))} />
            <DatePickerPresets value={holidayForm.holiday_date} onChange={(value) => setHolidayForm((prev) => ({ ...prev, holiday_date: value }))} placeholder="Holiday date" />
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={holidayForm.is_recurring} onChange={(event) => setHolidayForm((prev) => ({ ...prev, is_recurring: event.target.value }))}>
              <option value="false">One-time</option>
              <option value="true">Recurring</option>
            </select>
            <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white md:col-span-3" disabled={saving} onClick={() => void submitHolidayForm()}>
              Add Holiday
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Recurring</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {holidays.map((row, index) => {
                  const id = readNumber(row, ["id"])
                  return (
                    <tr key={String(id ?? index)}>
                      <td className="px-3 py-2">{readString(row, ["name"])}</td>
                      <td className="px-3 py-2">{readString(row, ["holiday_date"])}</td>
                      <td className="px-3 py-2">{readBoolean(row, ["is_recurring"]) ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-2">
                          <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-xs" onClick={() => void toggleHolidayRecurring(row)}>Toggle Recurring</button>
                          <button type="button" className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => setPendingHolidayDelete(row)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(pendingTypeDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTypeDelete(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave type? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingTypeDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingTypeDelete) {
                  return
                }
                const row = pendingTypeDelete
                setPendingTypeDelete(null)
                await removeType(row)
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingHolidayDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingHolidayDelete(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this holiday? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingHolidayDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingHolidayDelete) {
                  return
                }
                const row = pendingHolidayDelete
                setPendingHolidayDelete(null)
                await removeHoliday(row)
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRequestCancel)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRequestCancel(null)
            setCancelReason("Cancelled by admin")
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a reason for cancellation. This will be recorded against the request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reason
            </label>
            <textarea
              className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Enter cancellation reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingRequestCancel || !cancelReason.trim()}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingRequestCancel) {
                  return
                }
                const row = pendingRequestCancel
                const reason = cancelReason
                setPendingRequestCancel(null)
                setCancelReason("Cancelled by admin")
                await cancelRequest(row, reason)
              }}
            >
              {saving ? "Cancelling..." : "Cancel Request"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
