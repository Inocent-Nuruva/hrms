"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { AccessSkeleton } from "@/components/ui/access-skeleton"
import { Check, Pencil } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { LeaveCatalogFrame } from "@/components/dashboard/leave-catalog-frame"
import { WorkflowChoiceCard, WorkflowSelect } from "@/components/dashboard/leave-workflow-ui"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Textarea } from "@/components/ui/textarea"
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
import {
  ATTENDANCE_BUSINESS_TRIPS_ROUTE_PERMISSION,
  canPerformPermission,
} from "@/lib/dashboard-permissions"
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
type TripWizardStep = "who" | "when" | "review"

const TRIP_WIZARD_STEPS: Array<{ key: TripWizardStep; number: string; label: string }> = [
  { key: "who", number: "01", label: "Who" },
  { key: "when", number: "02", label: "Dates" },
  { key: "review", number: "03", label: "Review" },
]

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
  const actor = useDashboardActor()
  const [trips, setTrips] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [selectedTrip, setSelectedTrip] = React.useState<AdminRecord | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  const [statusFilter, setStatusFilter] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [searchInput, setSearchInput] = React.useState("")
  const [employeeFilterId, setEmployeeFilterId] = React.useState<number | null>(null)

  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogStep, setDialogStep] = React.useState<TripWizardStep>("who")
  const [editingTripId, setEditingTripId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<TripFormState>(EMPTY_FORM)
  const [actionDialogOpen, setActionDialogOpen] = React.useState(false)
  const [pendingAction, setPendingAction] = React.useState<TripActionKind | null>(null)
  const [actionTrip, setActionTrip] = React.useState<AdminRecord | null>(null)
  const [actionNote, setActionNote] = React.useState("")

  const canView =
    actor.ready &&
    canPerformPermission(
      actor.permissionLabels,
      ATTENDANCE_BUSINESS_TRIPS_ROUTE_PERMISSION,
    )
  const canCreate = canPerformPermission(
    actor.permissionLabels,
    "attendance_business_trips:create",
  )
  const canUpdate = canPerformPermission(
    actor.permissionLabels,
    "attendance_business_trips:update",
  )
  const canApprove = canPerformPermission(
    actor.permissionLabels,
    "attendance_business_trips:approve",
  )
  const canCancel = canPerformPermission(
    actor.permissionLabels,
    "attendance_business_trips:cancel",
  )

  const employeeOptions = React.useMemo(() => buildEmployeeOptions(employees), [employees])
  const employeeSelectOptions = React.useMemo(
    () => employeeOptions.map((option) => ({ value: String(option.id), label: option.label })),
    [employeeOptions],
  )

  const statusCounts = React.useMemo(() => {
    return {
      draft: trips.filter((row) => getTripStatus(row) === "draft").length,
      submitted: trips.filter((row) => getTripStatus(row) === "submitted").length,
      approved: trips.filter((row) => getTripStatus(row) === "approved").length,
    }
  }, [trips])

  const visibleTrips = React.useMemo(() => {
    const query = searchInput.trim().toLowerCase()
    return trips.filter((row) => {
      const status = getTripStatus(row)
      if (statusFilter !== "all" && status !== statusFilter) return false
      if (employeeFilterId != null) {
        const nestedEmployee = asRecord(row.employee)
        const id =
          readNumber(row, ["employee_id", "employeeId"]) ??
          readNumber(nestedEmployee, ["id", "employee_id"])
        if (id !== employeeFilterId) return false
      }
      const start = readString(row, ["start_date", "startDate", "from_date"], "").slice(0, 10)
      const end = readString(row, ["end_date", "endDate", "to_date"], "").slice(0, 10)
      if (dateFrom && end && end < dateFrom) return false
      if (dateTo && start && start > dateTo) return false
      if (!query) return true
      return [
        getEmployeeLabel(row),
        readString(row, ["reason", "notes", "description"], ""),
        status,
        tripDateRange(row),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [dateFrom, dateTo, employeeFilterId, searchInput, statusFilter, trips])

  const dialogStepIndex = TRIP_WIZARD_STEPS.findIndex((item) => item.key === dialogStep)
  const canContinueWho = form.employeeId != null
  const canContinueWhen = Boolean(form.startDate && form.endDate && form.endDate >= form.startDate)
  const selectedEmployeeLabel =
    employeeOptions.find((option) => option.id === form.employeeId)?.label || "Not selected"

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
  }, [])

  React.useEffect(() => {
    if (!canView) {
      return
    }
    void loadTrips()
  }, [canView, loadTrips])

  React.useEffect(() => {
    if (!canView) {
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
  }, [canView])

  function openCreateDialog() {
    setEditingTripId(null)
    setForm(EMPTY_FORM)
    setDialogStep("who")
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
    setDialogStep("who")
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
      setDialogStep("who")
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

  const selectedStatus = getTripStatus(selectedTrip)
  const selectedMeta = getStatusMeta(selectedStatus || selectedTrip?.status)

  if (!actor.ready || !canView) {
    return <AccessSkeleton />
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <LeaveCatalogFrame
        title="Business trips"
        subtitle={`${trips.length} ${trips.length === 1 ? "trip" : "trips"}${
          trips.length
            ? ` · ${statusCounts.submitted} awaiting · ${statusCounts.approved} approved`
            : ""
        }`}
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search trips"
        searchAriaLabel="Search business trips"
        filterAriaLabel="Filter business trips"
        filtersActive={
          statusFilter !== "all" || employeeFilterId != null || Boolean(dateFrom) || Boolean(dateTo)
        }
        filterGroups={[
          {
            key: "status",
            label: "Status",
            value: statusFilter,
            options: [
              { value: "all", label: "All" },
              { value: "draft", label: "Draft" },
              { value: "submitted", label: "Awaiting" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "cancelled", label: "Cancelled" },
            ],
          },
        ]}
        onFilterChange={(_, value) => setStatusFilter(value)}
        filterExtra={
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Employee</p>
              <WorkflowSelect
                value={employeeFilterId != null ? String(employeeFilterId) : ""}
                options={employeeSelectOptions}
                placeholder="All employees"
                allLabel="All employees"
                onValueChange={(next) => setEmployeeFilterId(next ? Number(next) : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">From</p>
                <DatePickerPresets value={dateFrom} onChange={setDateFrom} placeholder="From" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">To</p>
                <DatePickerPresets value={dateTo} onChange={setDateTo} placeholder="To" />
              </div>
            </div>
          </div>
        }
        onRefresh={() => void loadTrips()}
        loading={loading}
        createLabel="New trip"
        onCreate={openCreateDialog}
        canCreate={canCreate}
        emptyTitle="No business trips"
        emptyDescription={
          trips.length === 0 ? "Create a trip for official travel." : "Nothing matches these filters."
        }
        isEmpty={visibleTrips.length === 0}
        showSkeleton={loading && trips.length === 0}
      >
        <ul className="divide-y divide-slate-100 dark:divide-border">
          {visibleTrips.map((row) => {
            const status = getTripStatus(row)
            const meta = getStatusMeta(status || row.status)
            const editable = canUpdate && (status === "draft" || status === "submitted")
            return (
              <li key={getTripId(row) || getEmployeeLabel(row)}>
                <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-muted/40">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDetails(row)}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {getEmployeeLabel(row)}
                      </span>
                      <span className={cn("shrink-0 text-[11px] font-semibold", meta.className)}>{meta.label}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {[tripDateRange(row), readString(row, ["reason", "notes", "description"], "") || "No purpose"]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                  {editable ? (
                    <button
                      type="button"
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700"
                      onClick={() => openEditDialog(row)}
                      aria-label={`Edit trip for ${getEmployeeLabel(row)}`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </LeaveCatalogFrame>

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
            {selectedTrip && canUpdate && (selectedStatus === "draft" || selectedStatus === "submitted") ? (
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700"
                onClick={() => openEditDialog(selectedTrip)}
              >
                Edit
              </button>
            ) : null}
            {selectedTrip && canUpdate && selectedStatus === "draft" ? (
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium !text-white"
                disabled={saving}
                onClick={() => openActionDialog(selectedTrip, "submit")}
              >
                Send for approval
              </button>
            ) : null}
            {selectedTrip && canApprove && selectedStatus === "submitted" ? (
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
              </>
            ) : null}
            {selectedTrip && canCancel && selectedStatus === "submitted" ? (
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border border-rose-300 px-3 text-xs font-medium text-rose-700"
                disabled={saving}
                onClick={() => openActionDialog(selectedTrip, "cancel")}
              >
                Cancel trip
              </button>
            ) : null}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setForm(EMPTY_FORM)
            setDialogStep("who")
            setEditingTripId(null)
          }
        }}
      >
        <DialogPopup
          from="bottom"
          className="grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>{editingTripId ? "Edit business trip" : "New business trip"}</DialogTitle>
            <DialogDescription>
              {dialogStep === "who"
                ? "Choose who is travelling."
                : dialogStep === "when"
                  ? "Set the travel dates."
                  : "Add the purpose, then send for approval or save a draft."}
            </DialogDescription>
          </DialogHeader>
          <nav className="grid grid-cols-3 gap-2" aria-label="Business trip steps">
            {TRIP_WIZARD_STEPS.map((item, index) => {
              const active = item.key === dialogStep
              const done = dialogStepIndex > index
              const unlocked =
                item.key === "who" ||
                (item.key === "when" && canContinueWho) ||
                (item.key === "review" && canContinueWho && canContinueWhen)
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!unlocked || saving}
                  aria-current={active ? "step" : undefined}
                  onClick={() => unlocked && setDialogStep(item.key)}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    active
                      ? "border-primary bg-primary text-white"
                      : done
                        ? "border-primary/20 bg-primary/5 text-primary"
                        : unlocked
                          ? "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
                          : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      active ? "bg-white/20" : done ? "bg-primary text-white" : "bg-slate-100",
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : item.number}
                  </span>
                  <span className="min-w-0 truncate text-xs font-semibold">{item.label}</span>
                </button>
              )
            })}
          </nav>
          <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
            {dialogStep === "who" ? (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Who is travelling?</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Official travel is recorded against this employee.</p>
                </div>
                <div className="max-w-lg">
                  <p className="mb-1 text-sm font-semibold text-slate-800">Employee</p>
                  <WorkflowSelect
                    value={form.employeeId != null ? String(form.employeeId) : ""}
                    options={employeeSelectOptions}
                    placeholder="Select employee"
                    onValueChange={(next) =>
                      setForm((prev) => ({ ...prev, employeeId: next ? Number(next) : null }))
                    }
                  />
                </div>
              </section>
            ) : null}

            {dialogStep === "when" ? (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">When is the trip?</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{selectedEmployeeLabel}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800">Start date</p>
                    <DatePickerPresets
                      value={form.startDate}
                      onChange={(value) => setForm((prev) => ({ ...prev, startDate: value }))}
                      placeholder="Start date"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800">End date</p>
                    <DatePickerPresets
                      value={form.endDate}
                      onChange={(value) => setForm((prev) => ({ ...prev, endDate: value }))}
                      placeholder="End date"
                    />
                  </div>
                </div>
                {form.startDate && form.endDate && form.endDate < form.startDate ? (
                  <p className="text-xs text-rose-600">End date must be on or after the start date.</p>
                ) : null}
              </section>
            ) : null}

            {dialogStep === "review" ? (
              <section className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { label: "Employee", value: selectedEmployeeLabel },
                    { label: "Start", value: formatDateOnly(form.startDate) },
                    { label: "End", value: formatDateOnly(form.endDate) },
                    {
                      label: "Action",
                      value: editingTripId
                        ? "Save changes"
                        : form.submit
                          ? "Send for approval"
                          : "Save as draft",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-border dark:bg-muted/30"
                    >
                      <p className="text-xs font-medium text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">Purpose</p>
                  <Textarea
                    className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. Client visit in Arusha"
                    value={form.reason}
                    onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                    disabled={saving}
                  />
                </div>
                {editingTripId ? null : (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-slate-800">What should happen next?</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <WorkflowChoiceCard
                        active={form.submit}
                        layoutId="business-trip-submit-choice"
                        onClick={() => setForm((prev) => ({ ...prev, submit: true }))}
                      >
                        <span className={cn("block text-sm font-semibold", form.submit ? "text-white" : "text-slate-900")}>
                          Send for approval
                        </span>
                        <span className={cn("mt-0.5 block text-xs", form.submit ? "text-white/80" : "text-slate-500")}>
                          Move the trip into the approval path.
                        </span>
                      </WorkflowChoiceCard>
                      <WorkflowChoiceCard
                        active={!form.submit}
                        layoutId="business-trip-submit-choice"
                        onClick={() => setForm((prev) => ({ ...prev, submit: false }))}
                      >
                        <span className={cn("block text-sm font-semibold", !form.submit ? "text-white" : "text-slate-900")}>
                          Save as draft
                        </span>
                        <span className={cn("mt-0.5 block text-xs", !form.submit ? "text-white/80" : "text-slate-500")}>
                          Keep it until you are ready to send.
                        </span>
                      </WorkflowChoiceCard>
                    </div>
                  </div>
                )}
              </section>
            ) : null}
          </div>
          <DialogFooter className="border-t border-slate-200 pt-3 dark:border-border">
            {dialogStep !== "who" ? (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setDialogStep(dialogStep === "review" ? "when" : "who")}
                disabled={saving}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            {dialogStep === "who" ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canContinueWho || saving}
                onClick={() => setDialogStep("when")}
              >
                Next: Dates
              </button>
            ) : dialogStep === "when" ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canContinueWhen || saving}
                onClick={() => setDialogStep("review")}
              >
                Next: Review
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:opacity-60"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingTripId
                    ? "Save changes"
                    : form.submit
                      ? "Create and send"
                      : "Save draft"}
              </button>
            )}
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
              {saving ? <FluentLoadingIndicator className="mr-1 size-3.5 animate-spin" /> : null}
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
