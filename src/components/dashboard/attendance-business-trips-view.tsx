"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, RefreshCw } from "lucide-react"

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createAttendanceBusinessTrip,
  getAttendanceBusinessTrip,
  listAttendanceBusinessTrips,
  listEmployees,
  updateAttendanceBusinessTrip,
  type AdminRecord,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
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

const EMPTY_FORM: TripFormState = {
  employeeId: null,
  startDate: "",
  endDate: "",
  reason: "",
  submit: true,
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
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

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function getStatusMeta(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : ""
  const normalized = raw.toLowerCase()

  if (normalized === "approved") {
    return {
      label: raw || "Approved",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      terminal: true,
    }
  }
  if (normalized === "rejected") {
    return {
      label: raw || "Rejected",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      terminal: true,
    }
  }
  if (normalized === "cancelled") {
    return {
      label: raw || "Cancelled",
      className: "border-slate-200 bg-slate-100 text-slate-700",
      terminal: true,
    }
  }
  if (normalized === "submitted") {
    return {
      label: raw || "Submitted",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      terminal: false,
    }
  }
  if (normalized === "draft") {
    return {
      label: raw || "Draft",
      className: "border-slate-200 bg-white text-slate-600",
      terminal: false,
    }
  }

  return {
    label: raw || "—",
    className: "border-slate-200 bg-white text-slate-700",
    terminal: false,
  }
}

function getEmployeeLabel(row: AdminRecord | null) {
  const nestedEmployee = asRecord(row?.employee)
  const nestedUser = asRecord(nestedEmployee?.user) ?? asRecord(row?.user)
  const explicit =
    readString(row, ["employee_name", "full_name", "employee_full_name", "name"], "") ||
    readString(nestedEmployee, ["full_name", "name"], "") ||
    readString(nestedUser, ["full_name", "name"], "")

  const employeeNo =
    readString(row, ["employee_no", "employeeNo", "user_no"], "") ||
    readString(nestedEmployee, ["employee_no", "employeeNo", "user_no"], "") ||
    readString(nestedUser, ["employee_no", "employeeNo", "user_no"], "")

  if (explicit) {
    return employeeNo ? `${explicit} (${employeeNo})` : explicit
  }

  const firstName =
    readString(row, ["first_name"], "") ||
    readString(nestedEmployee, ["first_name"], "") ||
    readString(nestedUser, ["first_name"], "")
  const lastName =
    readString(row, ["last_name"], "") ||
    readString(nestedEmployee, ["last_name"], "") ||
    readString(nestedUser, ["last_name"], "")

  if (firstName || lastName) {
    const fullName = [firstName, lastName].filter(Boolean).join(" ")
    return employeeNo ? `${fullName} (${employeeNo})` : fullName
  }

  if (employeeNo) {
    return employeeNo
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

      const employeeNo = readString(row, [
        "employee_no",
        "employeeNo",
        "employee_number",
        "user_no",
      ], "")
      const fullName =
        readString(row, [
          "employee_name",
          "full_name",
          "fullName",
          "display_name",
          "displayName",
          "name",
        ], "") ||
        [
          readString(row, ["first_name", "firstName"], ""),
          readString(row, ["last_name", "lastName"], ""),
        ]
          .filter(Boolean)
          .join(" ")
          .trim()

      const label =
        fullName && employeeNo
          ? `${fullName} (${employeeNo})`
          : fullName || employeeNo || `Employee ${id}`

      return { id, label }
    })
    .filter((option): option is EmployeeOption => option !== null)
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200/80 bg-slate-50/80 px-2 py-1">
      <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="truncate text-xs font-medium text-slate-900" title={value}>
        {value}
      </p>
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  variant = "outline",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "outline" | "primary"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary"
          ? "bg-primary !text-white hover:brightness-95"
          : "border border-slate-300 text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  )
}

export function AttendanceBusinessTripsView() {
  const router = useRouter()
  const actor = useDashboardActor()
  const [trips, setTrips] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [selectedTripId, setSelectedTripId] = React.useState("")
  const [selectedTripDetail, setSelectedTripDetail] = React.useState<AdminRecord | null>(null)
  const [allowed, setAllowed] = React.useState<boolean | null>(null)

  const [statusFilter, setStatusFilter] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [employeeFilterId, setEmployeeFilterId] = React.useState<number | null>(null)

  const [loading, setLoading] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingTripId, setEditingTripId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<TripFormState>(EMPTY_FORM)

  // HR/admin only — never show business trips on employee (user) side.
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

  const employeeOptions = React.useMemo(() => buildEmployeeOptions(employees), [employees])

  const selectedListTrip = React.useMemo(
    () => trips.find((row) => getTripId(row) === selectedTripId) ?? null,
    [trips, selectedTripId]
  )

  const activeTrip = React.useMemo(() => {
    if (!selectedListTrip && !selectedTripDetail) {
      return null
    }
    return {
      ...(selectedListTrip ?? {}),
      ...(selectedTripDetail ?? {}),
    } as AdminRecord
  }, [selectedListTrip, selectedTripDetail])

  const activeStatus = getStatusMeta(activeTrip?.status)
  const canEditActive =
    Boolean(activeTrip) && ["draft", "submitted"].includes(String(activeTrip?.status ?? "").toLowerCase())

  const selectedTripIdRef = React.useRef(selectedTripId)
  React.useEffect(() => {
    selectedTripIdRef.current = selectedTripId
  }, [selectedTripId])

  const loadTripDetail = React.useCallback(async (tripId: string) => {
    const token = readStoredToken()
    if (!token || !tripId) {
      return
    }

    setDetailLoading(true)
    try {
      const detail = await getAttendanceBusinessTrip(token, tripId)
      setSelectedTripDetail(detail)
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load business trip details."
      setError(message)
      showErrorAlert(message)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadTrips = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      setTrips([])
      setSelectedTripId("")
      setSelectedTripDetail(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listAttendanceBusinessTrips(token, {
        page: 1,
        limit: 100,
        sortBy: "created_at",
        sortOrder: "DESC",
        search: search.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
        employee_id: employeeFilterId ?? undefined,
      })
      setTrips(result.rows)

      const currentSelection =
        result.rows.find((row) => getTripId(row) === selectedTripIdRef.current) ??
        result.rows[0] ??
        null

      if (!currentSelection) {
        setSelectedTripId("")
        setSelectedTripDetail(null)
        return
      }

      const nextId = getTripId(currentSelection)
      setSelectedTripId(nextId)
      await loadTripDetail(nextId)
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load attendance business trips."
      setError(message)
      showErrorAlert(message)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, employeeFilterId, loadTripDetail, search, statusFilter])

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
    void listEmployees(token, {
      page: 1,
      limit: 200,
      sortBy: "first_name",
      sortOrder: "ASC",
    })
      .then((result) => {
        if (!cancelled) {
          setEmployees(result.rows || [])
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

  const openCreateDialog = () => {
    setEditingTripId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEditDialog = (row: AdminRecord) => {
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
      submit: String(row.status ?? "").toLowerCase() !== "draft",
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    if (!form.employeeId) {
      showErrorAlert("Select an employee for this business trip.")
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
    if (!form.reason.trim()) {
      showErrorAlert("Add a reason for the business trip.")
      return
    }

    setSaving(true)
    try {
      if (editingTripId) {
        await updateAttendanceBusinessTrip(token, editingTripId, {
          employee_id: form.employeeId,
          start_date: form.startDate,
          end_date: form.endDate,
          reason: form.reason.trim(),
          submit: form.submit,
          metadata: {},
        })
        showSuccessAlert("Business trip updated successfully.")
      } else {
        await createAttendanceBusinessTrip(token, {
          employee_id: form.employeeId,
          start_date: form.startDate,
          end_date: form.endDate,
          reason: form.reason.trim(),
          submit: form.submit,
          metadata: {},
        })
        showSuccessAlert(
          form.submit
            ? "Business trip created and submitted."
            : "Business trip draft created."
        )
      }
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      setEditingTripId(null)
      await loadTrips()
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : editingTripId
            ? "Failed to update business trip."
            : "Failed to create business trip."
      showErrorAlert(message)
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const columns = React.useMemo<Array<Column<AdminRecord>>>(
    () => [
      {
        key: "employee",
        label: "Employee",
        defaultWidth: 130,
        render: (row) => (
          <span className="text-xs font-medium text-slate-900">{getEmployeeLabel(row)}</span>
        ),
      },
      {
        key: "dates",
        label: "Dates",
        defaultWidth: 120,
        render: (row) => {
          const start = formatDateOnly(row.start_date ?? row.startDate ?? row.from_date)
          const end = formatDateOnly(row.end_date ?? row.endDate ?? row.to_date)
          return (
            <span className="text-xs text-slate-700 tabular-nums">
              {start === end ? start : `${start} – ${end}`}
            </span>
          )
        },
      },
      {
        key: "reason",
        label: "Reason",
        defaultWidth: 160,
        render: (row) => (
          <span className="line-clamp-1 text-xs text-slate-600">
            {readString(row, ["reason", "notes", "description"], "—")}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        defaultWidth: 78,
        render: (row) => {
          const meta = getStatusMeta(row.status)
          return (
            <Badge
              variant="outline"
              className={cn("px-1.5 py-0 text-[10px] capitalize", meta.className)}
            >
              {meta.label}
            </Badge>
          )
        },
      },
      {
        key: "actions",
        label: "",
        defaultWidth: 88,
        sortable: false,
        render: (row) => {
          const rowId = getTripId(row)
          const isSelected = rowId === selectedTripId
          const status = String(row.status ?? "").toLowerCase()
          const editable = status === "draft" || status === "submitted"
          return (
            <div className="flex justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
              {editable ? (
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                  onClick={() => openEditDialog(row)}
                >
                  Edit
                </button>
              ) : null}
              <button
                type="button"
                className={cn(
                  "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                  isSelected
                    ? "bg-primary !text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
                onClick={() => {
                  setSelectedTripId(rowId)
                  void loadTripDetail(rowId)
                }}
              >
                {isSelected ? "Open" : "View"}
              </button>
            </div>
          )
        },
      },
    ],
    [loadTripDetail, selectedTripId]
  )

  if (allowed !== true) {
    return (
      <div className="rounded-md border border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-500">
        {allowed === false
          ? "Business trips are only available to HR administrators."
          : "Checking access…"}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        <h2 className="shrink-0 text-sm font-semibold text-slate-900">Business Trips</h2>
        <Badge
          variant="outline"
          className="h-5 border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-600"
        >
          {trips.length}
        </Badge>

        <div className="mx-0.5 hidden h-4 w-px bg-slate-200 sm:block" />

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="h-7 w-auto min-w-[7.5rem] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={employeeFilterId != null ? String(employeeFilterId) : "all"}
          onValueChange={(value) =>
            setEmployeeFilterId(value && value !== "all" ? Number(value) : null)
          }
        >
          <SelectTrigger className="h-7 w-auto min-w-[9rem] max-w-[12rem] text-xs">
            <SelectValue placeholder="Employee">
              {employeeFilterId != null
                ? employeeOptions.find((option) => option.id === employeeFilterId)?.label ??
                  "Employee"
                : "All employees"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-search-text="all employees">
              All employees
            </SelectItem>
            {employeeOptions.map((option) => (
              <SelectItem
                key={option.id}
                value={String(option.id)}
                data-search-text={option.label}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="min-w-[7.5rem]">
          <DatePickerPresets
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="From"
            className="h-7 px-2 text-xs"
          />
        </div>
        <div className="min-w-[7.5rem]">
          <DatePickerPresets
            value={dateTo}
            onChange={setDateTo}
            placeholder="To"
            className="h-7 px-2 text-xs"
          />
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search…"
          className="h-7 w-28 text-xs"
        />

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <ToolbarButton
            onClick={() => {
              setStatusFilter("all")
              setDateFrom("")
              setDateTo("")
              setSearch("")
              setEmployeeFilterId(null)
            }}
          >
            Reset
          </ToolbarButton>
          <ToolbarButton onClick={() => void loadTrips()} disabled={loading}>
            <RefreshCw className={cn("size-3", loading ? "animate-spin" : "")} />
            Refresh
          </ToolbarButton>
          <ToolbarButton variant="primary" onClick={openCreateDialog}>
            <Plus className="size-3" />
            New
          </ToolbarButton>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,19rem)]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5">
            <p className="text-xs font-semibold text-slate-800">Trips</p>
            <p className="text-[11px] text-slate-500">Select a row to review</p>
          </div>
          <div className="p-1.5">
            <ResizableTable
              title="Business Trips"
              data={trips}
              columns={columns}
              itemsPerPage={12}
              loading={loading}
              storageKey="leave-business-trips-v2"
            />
            {!loading && trips.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500">
                No business trips match the current filters.
              </div>
            ) : null}
          </div>
        </div>

        <aside className="flex min-h-[14rem] flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5">
            <p className="text-xs font-semibold text-slate-800">Details</p>
            {activeTrip ? (
              <Badge
                variant="outline"
                className={cn("px-1.5 py-0 text-[10px] capitalize", activeStatus.className)}
              >
                {activeStatus.label}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col gap-2 p-2.5">
            {detailLoading ? (
              <div className="flex flex-1 items-center justify-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </div>
            ) : null}

            {!detailLoading && !activeTrip ? (
              <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
                Select a trip to view details
              </div>
            ) : null}

            {!detailLoading && activeTrip ? (
              <>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {getEmployeeLabel(activeTrip)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">
                    {readString(activeTrip, ["reason", "notes", "description"], "No reason")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <MetaChip
                    label="Start"
                    value={formatDateOnly(
                      activeTrip.start_date ?? activeTrip.startDate ?? activeTrip.from_date
                    )}
                  />
                  <MetaChip
                    label="End"
                    value={formatDateOnly(
                      activeTrip.end_date ?? activeTrip.endDate ?? activeTrip.to_date
                    )}
                  />
                  <MetaChip label="ID" value={getTripId(activeTrip) || "—"} />
                  <MetaChip
                    label="Created"
                    value={formatDateTime(activeTrip.created_at ?? activeTrip.createdAt)}
                  />
                </div>

                {canEditActive ? (
                  <div className="mt-auto border-t border-slate-100 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-full text-xs"
                      onClick={() => openEditDialog(activeTrip)}
                    >
                      <Pencil className="mr-1 size-3" />
                      Edit trip
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </aside>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup className="max-h-[min(90vh,36rem)] max-w-md overflow-y-auto" from="center">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingTripId ? "Edit business trip" : "New business trip"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingTripId
                ? "Update dates, reason, or submission status."
                : "Record a trip for an employee in the active company."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <Field label="Employee">
              <Select
                value={form.employeeId != null ? String(form.employeeId) : ""}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    employeeId: value ? Number(value) : null,
                  }))
                }
                disabled={saving}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder="Select employee">
                    {form.employeeId != null
                      ? employeeOptions.find((option) => option.id === form.employeeId)?.label ??
                        "Select employee"
                      : "Select employee"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employeeOptions.map((option) => (
                    <SelectItem
                      key={option.id}
                      value={String(option.id)}
                      data-search-text={option.label}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Start date">
                <DatePickerPresets
                  value={form.startDate}
                  onChange={(value) => setForm((prev) => ({ ...prev, startDate: value }))}
                  placeholder="Start"
                />
              </Field>
              <Field label="End date">
                <DatePickerPresets
                  value={form.endDate}
                  onChange={(value) => setForm((prev) => ({ ...prev, endDate: value }))}
                  placeholder="End"
                />
              </Field>
            </div>

            <Field label="Reason" htmlFor="business-trip-reason">
              <Textarea
                id="business-trip-reason"
                value={form.reason}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, reason: event.target.value }))
                }
                placeholder="e.g. Client visit in Arusha"
                className="min-h-20 text-xs"
                disabled={saving}
              />
            </Field>

            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="size-3.5 rounded border-slate-300"
                checked={form.submit}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, submit: event.target.checked }))
                }
                disabled={saving}
              />
              Submit immediately (uncheck for draft)
            </label>
          </div>

          <DialogFooter className="mt-4">
            <DialogClose
              render={
                <Button type="button" variant="outline" size="sm" disabled={saving}>
                  Cancel
                </Button>
              }
            />
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                  Saving…
                </>
              ) : editingTripId ? (
                "Save"
              ) : form.submit ? (
                "Create & submit"
              ) : (
                "Save draft"
              )}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}

export default AttendanceBusinessTripsView
