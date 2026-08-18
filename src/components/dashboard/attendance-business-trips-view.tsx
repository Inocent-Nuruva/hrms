"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, RefreshCw } from "lucide-react"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { SearchToggleField } from "@/components/common/search-toggle-field"
import { TalentDoodle, TalentDoodleSprites } from "@/components/dashboard/talent-visuals"
import {
  approveAttendanceBusinessTrip,
  cancelAttendanceBusinessTrip,
  createAttendanceBusinessTrip,
  listAllAttendanceBusinessTrips,
  listAllEmployees,
  rejectAttendanceBusinessTrip,
  submitAttendanceBusinessTrip,
  updateAttendanceBusinessTrip,
  type AdminRecord,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type EmployeeOption = {
  id: number
  label: string
}

type TripFormState = {
  employeeId: number | null
  startDate: string
  endDate: string
  reason: string
  submit: boolean
}

type TripActionKind = "submit" | "approve" | "reject" | "cancel"
type TripStatus = "draft" | "submitted" | "approved" | "rejected" | "cancelled"

const EMPTY_FORM: TripFormState = {
  employeeId: null,
  startDate: "",
  endDate: "",
  reason: "",
  submit: true,
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null
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

function readString(row: AdminRecord | null, keys: string[], fallback = "-") {
  if (!row) {
    return fallback
  }
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }
  return fallback
}

function readNumber(row: AdminRecord | null, keys: string[]) {
  if (!row) {
    return null
  }
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value)
    }
  }
  return null
}

function getTripId(row: AdminRecord | null) {
  const id = readNumber(row, ["id", "business_trip_id"])
  return id === null ? "" : String(id)
}

function getTripStatus(row: AdminRecord | null): TripStatus | "" {
  const raw = readString(row, ["status"], "").toLowerCase()
  if (
    raw === "draft" ||
    raw === "submitted" ||
    raw === "approved" ||
    raw === "rejected" ||
    raw === "cancelled"
  ) {
    return raw
  }
  return ""
}

function formatDateOnly(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const datePart = trimmed.slice(0, 10)
    const [year, month, day] = datePart.split("-").map(Number)
    const date = new Date(year, month - 1, day)
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date)
    }
  }
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return trimmed
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

function getStatusMeta(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : ""
  const normalized = raw.toLowerCase()

  if (normalized === "approved") {
    return { label: "Approved", className: "text-emerald-700" }
  }
  if (normalized === "rejected") {
    return { label: "Rejected", className: "text-rose-700" }
  }
  if (normalized === "cancelled") {
    return { label: "Cancelled", className: "text-slate-500" }
  }
  if (normalized === "submitted") {
    return { label: "Awaiting approval", className: "text-amber-700" }
  }
  if (normalized === "draft") {
    return { label: "Draft", className: "text-slate-600" }
  }

  return { label: raw || "—", className: "text-slate-700" }
}

function getEmployeeLabel(row: AdminRecord | null) {
  const nestedEmployee = asRecord(row?.employee)
  const nestedUser = asRecord(nestedEmployee?.user) ?? asRecord(row?.user)
  const explicit =
    readString(row, ["employee_name", "full_name", "employee_full_name"], "") ||
    readString(nestedEmployee, ["full_name", "name"], "") ||
    readString(nestedUser, ["full_name", "name"], "")
  if (explicit && explicit !== "-") {
    return explicit
  }

  const firstName =
    readString(row, ["first_name", "firstName"], "") ||
    readString(nestedEmployee, ["first_name", "firstName"], "") ||
    readString(nestedUser, ["first_name", "firstName"], "")
  const lastName =
    readString(row, ["last_name", "lastName"], "") ||
    readString(nestedEmployee, ["last_name", "lastName"], "") ||
    readString(nestedUser, ["last_name", "lastName"], "")
  const composed = [firstName, lastName].filter((part) => part && part !== "-").join(" ").trim()
  if (composed) {
    return composed
  }

  const employeeId = readNumber(row, ["employee_id", "user_id"])
  return employeeId === null ? "Employee" : `Employee #${employeeId}`
}

function buildEmployeeOptions(rows: AdminRecord[]): EmployeeOption[] {
  return rows
    .map<EmployeeOption | null>((row) => {
      const id = readNumber(row, ["id", "employee_id", "employeeId"])
      if (id === null) {
        return null
      }
      const fullName =
        readString(row, ["employee_name", "full_name", "fullName", "display_name", "displayName"], "") ||
        [readString(row, ["first_name", "firstName"], ""), readString(row, ["last_name", "lastName"], "")]
          .filter((part) => part && part !== "-")
          .join(" ")
          .trim()
      return { id, label: fullName || `Employee ${id}` }
    })
    .filter((option): option is EmployeeOption => option !== null)
}

function tripDateRange(row: AdminRecord) {
  const start = formatDateOnly(row.start_date ?? row.startDate ?? row.from_date)
  const end = formatDateOnly(row.end_date ?? row.endDate ?? row.to_date)
  return start === end ? start : `${start} – ${end}`
}

export function AttendanceBusinessTripsView() {
  const router = useRouter()
  const actor = useDashboardActor()
  const [trips, setTrips] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [selectedTrip, setSelectedTrip] = React.useState<AdminRecord | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [allowed, setAllowed] = React.useState<boolean | null>(null)

  const [statusFilter, setStatusFilter] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [employeeFilterId, setEmployeeFilterId] = React.useState<number | null>(null)

  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingTripId, setEditingTripId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<TripFormState>(EMPTY_FORM)
  const [actionDialogOpen, setActionDialogOpen] = React.useState(false)
  const [pendingAction, setPendingAction] = React.useState<TripActionKind | null>(null)
  const [actionTrip, setActionTrip] = React.useState<AdminRecord | null>(null)
  const [actionNote, setActionNote] = React.useState("")

  const canCreate = canPerformPermission(actor.permissionLabels, {
    permissions: ["attendance_business_trips:create", "attendance_business_trips:update"],
    mode: "any",
  })
  const canManage = canPerformPermission(actor.permissionLabels, "attendance_business_trips:update")

  React.useEffect(() => {
    if (!actor.ready) {
      return
    }
    if (!actor.isAdmin) {
      setAllowed(false)
      router.replace("/dashboard/me/leave/requests")
      return
    }
    setAllowed(true)
  }, [actor.isAdmin, actor.ready, router])

  React.useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const employeeOptions = React.useMemo(() => buildEmployeeOptions(employees), [employees])

  const statusCounts = React.useMemo(() => {
    return {
      draft: trips.filter((row) => getTripStatus(row) === "draft").length,
      submitted: trips.filter((row) => getTripStatus(row) === "submitted").length,
      approved: trips.filter((row) => getTripStatus(row) === "approved").length,
    }
  }, [trips])

  const loadTrips = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      setTrips([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listAllAttendanceBusinessTrips(token, {
        page: 1,
        limit: 100,
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
        employee_id: employeeFilterId ?? undefined,
      })
      setTrips(result.rows)
      setSelectedTrip((current) => {
        if (!current) {
          return current
        }
        return result.rows.find((row) => getTripId(row) === getTripId(current)) ?? current
      })
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Failed to load business trips."
      setError(message)
      showErrorAlert(message)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, employeeFilterId, search, statusFilter])

  React.useEffect(() => {
    if (allowed !== true) {
      return
    }
    void loadTrips()
  }, [allowed, loadTrips])

  React.useEffect(() => {
    if (allowed !== true) {
      return
    }
    const token = readStoredToken()
    if (!token) {
      return
    }

    let cancelled = false
    void listAllEmployees(token, {})
      .then((rows) => {
        if (!cancelled) {
          setEmployees(rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEmployees([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [allowed])

  function openCreateDialog() {
    setEditingTripId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEditDialog(row: AdminRecord) {
    const id = getTripId(row)
    if (!id) {
      return
    }
    const nestedEmployee = asRecord(row.employee)
    const employeeId =
      readNumber(row, ["employee_id", "employeeId"]) ??
      readNumber(nestedEmployee, ["id", "employee_id"])
    setEditingTripId(id)
    setForm({
      employeeId,
      startDate: readString(row, ["start_date", "startDate", "from_date"], "").slice(0, 10),
      endDate: readString(row, ["end_date", "endDate", "to_date"], "").slice(0, 10),
      reason: readString(row, ["reason", "notes", "description"], ""),
      submit: getTripStatus(row) !== "draft",
    })
    setDetailsOpen(false)
    setDialogOpen(true)
  }

  function openDetails(row: AdminRecord) {
    setSelectedTrip(row)
    setDetailsOpen(true)
  }

  async function handleSave() {
    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }
    if (!form.employeeId) {
      showErrorAlert("Select who is travelling.")
      return
    }
    if (!form.startDate || !form.endDate) {
      showErrorAlert("Start date and end date are required.")
      return
    }
    if (form.endDate < form.startDate) {
      showErrorAlert("End date must be on or after the start date.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        employee_id: form.employeeId,
        start_date: form.startDate,
        end_date: form.endDate,
        reason: form.reason.trim() || undefined,
        submit: form.submit,
      }
      if (editingTripId) {
        await updateAttendanceBusinessTrip(token, editingTripId, payload)
        showSuccessAlert("Business trip updated.")
      } else {
        await createAttendanceBusinessTrip(token, payload)
        showSuccessAlert(form.submit ? "Trip sent for approval." : "Draft trip saved.")
      }
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      setEditingTripId(null)
      await loadTrips()
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : editingTripId
            ? "Failed to update business trip."
            : "Failed to create business trip."
      )
    } finally {
      setSaving(false)
    }
  }

  function openActionDialog(trip: AdminRecord, action: TripActionKind) {
    setActionTrip(trip)
    setPendingAction(action)
    setActionNote(action === "cancel" ? "Cancelled by admin" : action === "reject" ? "" : "")
    setActionDialogOpen(true)
  }

  async function handleTripAction() {
    const token = readStoredToken()
    const tripId = getTripId(actionTrip)
    if (!token || !tripId || !pendingAction) {
      return
    }
    if ((pendingAction === "reject" || pendingAction === "cancel") && !actionNote.trim()) {
      showErrorAlert(pendingAction === "cancel" ? "Enter a cancellation reason." : "Enter a rejection reason.")
      return
    }

    setSaving(true)
    try {
      if (pendingAction === "submit") {
        await submitAttendanceBusinessTrip(token, tripId)
        showSuccessAlert("Trip submitted for approval.")
      } else if (pendingAction === "approve") {
        await approveAttendanceBusinessTrip(token, tripId, actionNote)
        showSuccessAlert("Trip approved.")
      } else if (pendingAction === "reject") {
        await rejectAttendanceBusinessTrip(token, tripId, actionNote)
        showSuccessAlert("Trip rejected.")
      } else {
        await cancelAttendanceBusinessTrip(token, tripId, actionNote)
        showSuccessAlert("Trip cancelled.")
      }
      setActionDialogOpen(false)
      setPendingAction(null)
      setActionTrip(null)
      setActionNote("")
      setDetailsOpen(false)
      await loadTrips()
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to update the trip.")
    } finally {
      setSaving(false)
    }
  }

  const columns = React.useMemo<Array<Column<AdminRecord>>>(
    () => [
      {
        key: "employee",
        label: "Employee",
        defaultWidth: 160,
        sortValue: (row) => getEmployeeLabel(row),
        render: (row) => getEmployeeLabel(row),
      },
      {
        key: "dates",
        label: "Travel dates",
        defaultWidth: 150,
        sortValue: (row) => String(row.start_date ?? row.startDate ?? ""),
        render: (row) => tripDateRange(row),
      },
      {
        key: "reason",
        label: "Purpose",
        defaultWidth: 180,
        sortValue: (row) => readString(row, ["reason", "notes", "description"], ""),
        render: (row) => (
          <span className="line-clamp-1">{readString(row, ["reason", "notes", "description"], "—")}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        defaultWidth: 110,
        sortValue: (row) => getTripStatus(row),
        render: (row) => {
          const meta = getStatusMeta(row.status)
          return <span className={cn("font-medium", meta.className)}>{meta.label}</span>
        },
      },
      {
        key: "actions",
        label: "Act",
        defaultWidth: 50,
        sortable: false,
        render: (row) => {
          const status = getTripStatus(row)
          const editable = canCreate && (status === "draft" || status === "submitted")
          if (!editable) {
            return null
          }
          return (
            <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="admin-table-icon-button"
                title="Edit trip"
                onClick={() => openEditDialog(row)}
              >
                <Pencil className="size-4" />
              </button>
            </div>
          )
        },
      },
    ],
    [canCreate]
  )

  const selectedStatus = getTripStatus(selectedTrip)
  const selectedMeta = getStatusMeta(selectedTrip?.status)

  if (allowed !== true) {
    return (
      <div className="rounded-md border border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-500">
        {allowed === false ? "Business trips are only available to HR administrators." : "Checking access…"}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <TalentDoodleSprites />
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Drafts", value: statusCounts.draft },
          { label: "Awaiting approval", value: statusCounts.submitted },
          { label: "Approved", value: statusCounts.approved },
        ].map((item) => (
          <div
            key={item.label}
            className="relative overflow-hidden rounded-2xl p-3 text-white"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <TalentDoodle />
            <div className="relative z-10">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">{item.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums leading-none">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <ResizableTable
        title="Business trips"
        toolbarStart={
          <>
            <SearchToggleField
              className="min-w-0 !w-auto !max-w-[12rem] !flex-none"
              placeholder="Search trips"
              value={searchInput}
              onChange={setSearchInput}
            />
            <select
              className="h-8 w-[9.5rem] shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter trip status"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Awaiting approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              className="h-8 max-w-[12rem] shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
              value={employeeFilterId != null ? String(employeeFilterId) : "all"}
              onChange={(event) =>
                setEmployeeFilterId(event.target.value === "all" ? null : Number(event.target.value))
              }
              aria-label="Filter employee"
            >
              <option value="all">All employees</option>
              {employeeOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </select>
            <DatePickerPresets value={dateFrom} onChange={setDateFrom} placeholder="From" />
            <DatePickerPresets value={dateTo} onChange={setDateTo} placeholder="To" />
          </>
        }
        toolbarActions={
          <>
            {canCreate ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                onClick={openCreateDialog}
              >
                <Plus className="h-3.5 w-3.5" />
                New trip
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white"
              onClick={() => void loadTrips()}
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-primary", loading ? "animate-spin" : "")} />
            </button>
          </>
        }
        data={trips}
        columns={columns}
        itemsPerPage={20}
        loading={loading}
        storageKey="leave-business-trips-v3"
        getRowId={(row) => getTripId(row)}
        onRowSelect={(_, row) => {
          if (row) {
            openDetails(row)
          }
        }}
      />

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open)
          if (!open) {
            setSelectedTrip(null)
          }
        }}
      >
        <DialogPopup from="bottom" className="flex max-h-[min(92dvh,36rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-3 sm:p-4">
          <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
            <DialogTitle className="text-base leading-snug sm:text-lg">
              {selectedTrip ? getEmployeeLabel(selectedTrip) : "Business trip"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedTrip
                ? `${selectedMeta.label} · ${tripDateRange(selectedTrip)}`
                : "Trip details"}
            </DialogDescription>
          </DialogHeader>

          {selectedTrip ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
              <p className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-sm text-slate-700">
                {readString(selectedTrip, ["reason", "notes", "description"], "No purpose recorded.")}
              </p>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border/60 px-2.5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Start</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDateOnly(selectedTrip.start_date ?? selectedTrip.startDate)}
                  </dd>
                </div>
                <div className="rounded-md border border-border/60 px-2.5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">End</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDateOnly(selectedTrip.end_date ?? selectedTrip.endDate)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <DialogFooter className="mt-2 shrink-0 flex-wrap border-t border-slate-100 pt-2">
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700"
              onClick={() => setDetailsOpen(false)}
            >
              Close
            </button>
            {selectedTrip && canCreate && (selectedStatus === "draft" || selectedStatus === "submitted") ? (
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700"
                onClick={() => openEditDialog(selectedTrip)}
              >
                Edit
              </button>
            ) : null}
            {selectedTrip && canCreate && selectedStatus === "draft" ? (
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium !text-white"
                disabled={saving}
                onClick={() => openActionDialog(selectedTrip, "submit")}
              >
                Send for approval
              </button>
            ) : null}
            {selectedTrip && canManage && selectedStatus === "submitted" ? (
              <>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-emerald-300 px-3 text-xs font-medium text-emerald-700"
                  disabled={saving}
                  onClick={() => openActionDialog(selectedTrip, "approve")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-amber-300 px-3 text-xs font-medium text-amber-700"
                  disabled={saving}
                  onClick={() => openActionDialog(selectedTrip, "reject")}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-rose-300 px-3 text-xs font-medium text-rose-700"
                  disabled={saving}
                  onClick={() => openActionDialog(selectedTrip, "cancel")}
                >
                  Cancel trip
                </button>
              </>
            ) : null}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup from="bottom" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTripId ? "Edit trip" : "New business trip"}</DialogTitle>
            <DialogDescription>
              {editingTripId
                ? "Update the travel dates or purpose."
                : "Record official travel so those days are treated as a business trip."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Employee</span>
              <select
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                value={form.employeeId != null ? String(form.employeeId) : ""}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    employeeId: event.target.value ? Number(event.target.value) : null,
                  }))
                }
                disabled={saving}
              >
                <option value="">Select employee</option>
                {employeeOptions.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Start</span>
                <DatePickerPresets
                  value={form.startDate}
                  onChange={(value) => setForm((prev) => ({ ...prev, startDate: value }))}
                  placeholder="Start date"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">End</span>
                <DatePickerPresets
                  value={form.endDate}
                  onChange={(value) => setForm((prev) => ({ ...prev, endDate: value }))}
                  placeholder="End date"
                />
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Purpose</span>
              <Textarea
                className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Client visit in Arusha"
                value={form.reason}
                onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                disabled={saving}
              />
            </label>
            {editingTripId ? null : (
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-slate-300"
                  checked={form.submit}
                  onChange={(event) => setForm((prev) => ({ ...prev, submit: event.target.checked }))}
                  disabled={saving}
                />
                Send for approval now
              </label>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:opacity-60"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving..." : editingTripId ? "Save" : form.submit ? "Create and send" : "Save draft"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogPopup from="bottom" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingAction === "submit"
                ? "Send for approval"
                : pendingAction === "approve"
                  ? "Approve trip"
                  : pendingAction === "reject"
                    ? "Reject trip"
                    : "Cancel trip"}
            </DialogTitle>
            <DialogDescription>
              {actionTrip ? getEmployeeLabel(actionTrip) : "Business trip"}
            </DialogDescription>
          </DialogHeader>
          {pendingAction === "submit" ? (
            <p className="text-sm text-slate-600">This trip will move to awaiting approval.</p>
          ) : (
            <label className="space-y-1">
              <span className="text-xs text-slate-500">
                {pendingAction === "approve" ? "Note (optional)" : "Reason"}
              </span>
              <Textarea
                className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                disabled={saving}
              />
            </label>
          )}
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setActionDialogOpen(false)}
              disabled={saving}
            >
              Close
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:opacity-60"
              onClick={() => void handleTripAction()}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
              {pendingAction === "submit"
                ? "Send"
                : pendingAction === "approve"
                  ? "Approve"
                  : pendingAction === "reject"
                    ? "Reject"
                    : "Cancel trip"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}

export default AttendanceBusinessTripsView
