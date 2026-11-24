"use client"

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  CalendarClockIcon, ChevronDownIcon, DownloadIcon, FileSpreadsheetIcon, MailIcon, PlayIcon, RefreshCwIcon, ScaleIcon, ScrollTextIcon, XIcon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"

import {
  downloadAttendanceReport,
  exportAnalyticsReport,
  getAnalyticsDashboard,
  getAnalyticsFreshness,
  listAnalyticsDatasets,
  listAnalyticsMetrics,
  listAnalyticsSources,
  listBranches,
  listDepartments,
  listEmployees,
  listShiftResources,
  listTimetableResources,
  refreshAnalyticsDataset,
  runAnalyticsCustomReport,
  runAnalyticsReconciliation,
  runStatutoryReport,
  type AdminRecord,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { canAccessDashboardRoute, hasAnalyticsAccess } from "@/lib/dashboard-permissions"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { isPermissionError } from "@/components/dashboard/talent-visuals"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Button } from "@/components/ui/button"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

const DEFAULT_DIMENSIONS = [
  "department_name",
  "branch_name",
  "employment_status",
  "job_title",
  "grade",
  "gender",
  "month",
  "week",
  "date",
  "employee_name",
  "shift_name",
  "location",
  "cost_center",
] as const

const FORMAT_OPTIONS = [
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "csv", label: "CSV (.csv)" },
  { value: "pdf", label: "PDF (.pdf)" },
] as const

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "OFF_DAY", label: "Off day" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "NOT_TRACKED", label: "Not tracked" },
  { value: "ON_LEAVE", label: "On leave" },
] as const

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "", label: "All employment statuses" },
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
  { value: "exited", label: "Exited" },
] as const

type ReportId = "attendance-download"

const pageStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
}

const pageItem = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 380, damping: 28, mass: 0.7 },
  },
}

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
}

const listItem = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  },
}

type LookupOption = { id: number; label: string; branchId: number | null }

type EmployeeOption = {
  id: number
  label: string
  employeeNo: string
  branchId: number | null
  departmentId: number | null
}

function readStoredToken(): string {
  if (typeof window === "undefined") return ""
  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  if (direct) return direct
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (!authTokensRaw) return ""
  try {
    const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
    return (parsed.accessToken ?? parsed.access_token ?? "").trim()
  } catch {
    return ""
  }
}

function getId(record: AdminRecord): number | null {
  for (const key of ["id", "value", "branch_id", "department_id", "shift_id", "timetable_id", "employee_id"]) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value)
  }
  return null
}

function getName(record: AdminRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  const id = getId(record)
  return id !== null ? `#${id}` : "—"
}

function readStringValue(record: AdminRecord | null | undefined, keys: string[]): string {
  if (!record) return ""
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function readRelatedId(record: AdminRecord, keys: string[]): number | null {
  for (const key of keys) {
    const direct = record[key]
    if (typeof direct === "number" && Number.isFinite(direct)) return direct
    if (typeof direct === "string" && direct.trim() && !Number.isNaN(Number(direct))) {
      return Number(direct)
    }
    if (typeof direct === "object" && direct !== null) {
      const nestedId = getId(direct as AdminRecord)
      if (nestedId !== null) return nestedId
    }
  }
  return null
}

function toOptions(
  rows: AdminRecord[],
  nameKeys: string[],
  branchKeys: string[] = []
): LookupOption[] {
  return rows
    .map<LookupOption | null>((row) => {
      const id = getId(row)
      if (id === null) return null
      return {
        id,
        label: getName(row, ...nameKeys),
        branchId: branchKeys.length ? readRelatedId(row, branchKeys) : null,
      }
    })
    .filter((option): option is LookupOption => option !== null)
}

function buildEmployeeLabel(row: AdminRecord, id: number): string {
  const employeeNo = readStringValue(row, [
    "employee_no",
    "employeeNo",
    "employee_number",
    "employee_code",
    "user_no",
  ])
  const fullName =
    readStringValue(row, [
      "employee_name",
      "employeeName",
      "full_name",
      "fullName",
      "display_name",
      "displayName",
      "name",
    ]) ||
    [
      readStringValue(row, ["first_name", "firstName", "preferred_name", "preferredName"]),
      readStringValue(row, ["middle_name", "middleName"]),
      readStringValue(row, ["last_name", "lastName"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim()

  if (fullName && employeeNo) return `${fullName} (${employeeNo})`
  if (fullName) return fullName
  if (employeeNo) return employeeNo
  return `Employee ${id}`
}

function toEmployeeOptions(rows: AdminRecord[]): EmployeeOption[] {
  return rows
    .map<EmployeeOption | null>((row) => {
      const id = getId(row)
      if (id === null) return null

      const nestedUser = typeof row.user === "object" && row.user !== null ? (row.user as AdminRecord) : null
      const employeeNo =
        readStringValue(row, [
          "employee_no",
          "employeeNo",
          "employee_number",
          "employee_code",
          "user_no",
        ]) ||
        (nestedUser
          ? readStringValue(nestedUser, ["employee_no", "employeeNo", "user_no"])
          : "")

      return {
        id,
        label: buildEmployeeLabel(row, id),
        employeeNo,
        branchId: readRelatedId(row, [
          "primary_branch_id",
          "branch_id",
          "primaryBranchId",
          "branch",
        ]),
        departmentId: readRelatedId(row, [
          "primary_department_id",
          "department_id",
          "primaryDepartmentId",
          "department",
        ]),
      }
    })
    .filter((option): option is EmployeeOption => option !== null)
}

function uniqueCodes(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const code = value?.trim()
    if (!code) continue
    const key = code.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(code)
  }
  return result
}

function SuggestField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  options: string[]
  placeholder?: string
  hint?: string
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const selected = React.useMemo(() => splitCsvInput(value), [value])
  const selectedSet = React.useMemo(
    () => new Set(selected.map((entry) => entry.toLowerCase())),
    [selected],
  )

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, "_")
    return options
      .filter((option) => !selectedSet.has(option.toLowerCase()))
      .filter((option) => {
        if (!needle) return true
        const haystack = option.toLowerCase()
        return haystack.includes(needle) || haystack.replace(/_/g, " ").includes(query.trim().toLowerCase())
      })
      .slice(0, 12)
  }, [options, query, selectedSet])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  const commit = (token: string) => {
    const next = token.trim()
    if (!next) return
    onChange(toggleCsvValue(value, next))
    setQuery("")
    setOpen(true)
  }

  const commitQuery = () => {
    const token = query.trim().replace(/,+$/, "")
    if (!token) return
    const exact = matches.find((option) => option.toLowerCase() === token.toLowerCase())
    commit(exact ?? token)
  }

  return (
    <div ref={rootRef} className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((entry) => (
            <button
              key={entry}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground"
              onClick={() => onChange(toggleCsvValue(value, entry))}
            >
              {entry.replace(/_/g, " ")}
              <XIcon className="size-3 opacity-70" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <Input
          id={id}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((current) => Math.min(current + 1, Math.max(matches.length - 1, 0)))
              return
            }
            if (event.key === "ArrowUp") {
              event.preventDefault()
              setActiveIndex((current) => Math.max(current - 1, 0))
              return
            }
            if (event.key === "Enter") {
              event.preventDefault()
              if (matches[activeIndex]) {
                commit(matches[activeIndex])
                return
              }
              commitQuery()
              return
            }
            if (event.key === "Escape") {
              setOpen(false)
              return
            }
            if (event.key === "Backspace" && !query && selected.length > 0) {
              onChange(selected.slice(0, -1).join(", "))
              return
            }
            if (event.key === "," || event.key === "Tab") {
              if (query.trim()) {
                event.preventDefault()
                commitQuery()
              }
            }
          }}
        />
        <AnimatePresence>
          {open && matches.length > 0 ? (
            <motion.ul
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              className="absolute top-[calc(100%+0.35rem)] z-40 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
              role="listbox"
            >
              {matches.map((option, index) => (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm",
                      index === activeIndex ? "bg-muted text-foreground" : "hover:bg-muted/70",
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => commit(option)}
                  >
                    <span>{option.replace(/_/g, " ")}</span>
                    <span className="text-[11px] text-muted-foreground">{option}</span>
                  </button>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>
      {open && query.trim() && matches.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No match. Press Enter to use “{query.trim()}”.
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
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

function selectedLabel(options: LookupOption[], id: number | null, fallback: string) {
  if (id === null) return fallback
  return options.find((option) => option.id === id)?.label ?? fallback
}

function AttendanceReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [token, setToken] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [downloading, setDownloading] = React.useState(false)
  const [lookupsLoaded, setLookupsLoaded] = React.useState(false)

  const [fromDate, setFromDate] = React.useState("")
  const [toDate, setToDate] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<number | null>(null)
  const [branchId, setBranchId] = React.useState<number | null>(null)
  const [departmentId, setDepartmentId] = React.useState<number | null>(null)
  const [shiftId, setShiftId] = React.useState<number | null>(null)
  const [timetableId, setTimetableId] = React.useState<number | null>(null)
  const [status, setStatus] = React.useState("")
  const [lateOnly, setLateOnly] = React.useState(false)
  const [earlyDepartureOnly, setEarlyDepartureOnly] = React.useState(false)
  const [overtimeOnly, setOvertimeOnly] = React.useState(false)
  const [format, setFormat] = React.useState<"xlsx" | "csv" | "pdf">("xlsx")

  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [shifts, setShifts] = React.useState<AdminRecord[]>([])
  const [timetables, setTimetables] = React.useState<AdminRecord[]>([])

  React.useEffect(() => {
    if (!open) return
    setToken(readStoredToken())
  }, [open])

  React.useEffect(() => {
    if (!open || !token || lookupsLoaded) return

    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [br, de, em, sh, tt] = await Promise.allSettled([
          listBranches(token, { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }),
          listDepartments(token, { page: 1, limit: 200, sortBy: "name", sortOrder: "ASC" }),
          listEmployees(token, {
            page: 1,
            limit: 200,
            sortBy: "first_name",
            sortOrder: "ASC",
          }),
          listShiftResources(token, "shifts", { page: 1, limit: 100 }),
          listTimetableResources(token, "timetables", { page: 1, limit: 100 }),
        ])
        if (cancelled) return

        setBranches(br.status === "fulfilled" ? br.value.rows || [] : [])
        setDepartments(de.status === "fulfilled" ? de.value.rows || [] : [])
        setEmployees(em.status === "fulfilled" ? em.value.rows || [] : [])
        setShifts(sh.status === "fulfilled" ? sh.value.rows || [] : [])
        setTimetables(tt.status === "fulfilled" ? tt.value.rows || [] : [])
        setLookupsLoaded(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [lookupsLoaded, open, token])

  const branchOptions = React.useMemo(
    () => toOptions(branches, ["name", "branch_name", "branchName"]),
    [branches]
  )

  const allDepartmentOptions = React.useMemo(
    () =>
      toOptions(
        departments,
        ["name", "department_name", "departmentName"],
        ["branch_id", "branchId", "branch"]
      ),
    [departments]
  )

  const departmentOptions = React.useMemo(() => {
    if (branchId === null) return allDepartmentOptions
    return allDepartmentOptions.filter((option) => option.branchId === branchId)
  }, [allDepartmentOptions, branchId])

  const allEmployeeOptions = React.useMemo(() => toEmployeeOptions(employees), [employees])

  const employeeOptions = React.useMemo(() => {
    let options = allEmployeeOptions
    if (branchId !== null) {
      const byBranch = options.filter(
        (option) => option.branchId === null || option.branchId === branchId
      )
      if (byBranch.length > 0) options = byBranch
    }
    if (departmentId !== null) {
      const byDepartment = options.filter(
        (option) => option.departmentId === null || option.departmentId === departmentId
      )
      if (byDepartment.length > 0) options = byDepartment
    }
    return options
  }, [allEmployeeOptions, branchId, departmentId])

  const selectedEmployee = React.useMemo(
    () => employeeOptions.find((option) => option.id === selectedEmployeeId) ?? null,
    [employeeOptions, selectedEmployeeId]
  )

  const shiftOptions = React.useMemo(
    () => toOptions(shifts, ["name", "shift_name", "shiftName", "code"]),
    [shifts]
  )

  const timetableOptions = React.useMemo(
    () => toOptions(timetables, ["name", "timetable_name", "timetableName", "code"]),
    [timetables]
  )

  React.useEffect(() => {
    if (departmentId === null) return
    if (!departmentOptions.some((option) => option.id === departmentId)) {
      setDepartmentId(null)
    }
  }, [departmentId, departmentOptions])

  React.useEffect(() => {
    if (selectedEmployeeId === null) return
    if (!employeeOptions.some((option) => option.id === selectedEmployeeId)) {
      setSelectedEmployeeId(null)
    }
  }, [employeeOptions, selectedEmployeeId])

  const resetFilters = () => {
    setFromDate("")
    setToDate("")
    setSearch("")
    setSelectedEmployeeId(null)
    setBranchId(null)
    setDepartmentId(null)
    setShiftId(null)
    setTimetableId(null)
    setStatus("")
    setLateOnly(false)
    setEarlyDepartureOnly(false)
    setOvertimeOnly(false)
    setFormat("xlsx")
  }

  const handleDownload = async () => {
    if (!token) {
      toast.error("Authentication required. Please log in again.")
      return
    }

    if (selectedEmployeeId !== null && !selectedEmployee?.employeeNo) {
      toast.error("Selected employee has no employee number. Pick another employee or clear the filter.")
      return
    }

    // Route the selected employee into the API's employee_no filter.
    const resolvedEmployeeNo = selectedEmployee?.employeeNo.trim() || undefined

    setDownloading(true)
    try {
      const result = await downloadAttendanceReport(token, {
        page: 1,
        limit: 100,
        sortBy: "created_at",
        sortOrder: "DESC",
        search: search.trim() || undefined,
        employee_no: resolvedEmployeeNo,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        branch_id: branchId ?? undefined,
        department_id: departmentId ?? undefined,
        shift_id: shiftId ?? undefined,
        timetable_id: timetableId ?? undefined,
        status: status || undefined,
        late_only: lateOnly || undefined,
        early_departure_only: earlyDepartureOnly || undefined,
        overtime_only: overtimeOnly || undefined,
        format,
      })

      const url = URL.createObjectURL(result.blob)
      const link = document.createElement("a")
      link.href = url
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast.success(`Attendance report downloaded (${format.toUpperCase()}).`)
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not download the attendance report."
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-h-[min(90vh,44rem)] max-w-3xl overflow-y-auto" from="center">
        <DialogHeader>
          <DialogTitle>Attendance report</DialogTitle>
          <DialogDescription>
            Download filtered attendance summaries as XLSX, CSV, or PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex flex-wrap gap-x-6 gap-y-3 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={lateOnly} onChange={(event) => setLateOnly(event.target.checked)} />
              Late only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={earlyDepartureOnly} onChange={(event) => setEarlyDepartureOnly(event.target.checked)} />
              Early departure only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={overtimeOnly} onChange={(event) => setOvertimeOnly(event.target.checked)} />
              Overtime only
            </label>
            <p className="basis-full text-xs text-muted-foreground">Select multiple options to include records that meet every selected condition.</p>
          </div>
          <Field label="From date">
            <DatePickerPresets
              value={fromDate}
              onChange={setFromDate}
              placeholder="Select start date"
            />
          </Field>
          <Field label="To date">
            <DatePickerPresets
              value={toDate}
              onChange={setToDate}
              placeholder="Select end date"
            />
          </Field>

          <Field label="Search" htmlFor="report-search">
            <Input
              id="report-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, phone, or user no"
              disabled={loading}
            />
          </Field>
          <Field label="Employee">
            <Select
              value={selectedEmployeeId != null ? String(selectedEmployeeId) : "all"}
              onValueChange={(value) => {
                setSelectedEmployeeId(value && value !== "all" ? Number(value) : null)
              }}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All employees">
                  {selectedEmployee?.label ?? "All employees"}
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
                    data-search-text={`${option.label} ${option.employeeNo}`}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Branch">
            <Select
              value={branchId != null ? String(branchId) : "all"}
              onValueChange={(value) => {
                setBranchId(value && value !== "all" ? Number(value) : null)
                setDepartmentId(null)
                setSelectedEmployeeId(null)
              }}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All branches">
                  {selectedLabel(branchOptions, branchId, "All branches")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branchOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Department">
            <Select
              value={departmentId != null ? String(departmentId) : "all"}
              onValueChange={(value) => {
                setDepartmentId(value && value !== "all" ? Number(value) : null)
                setSelectedEmployeeId(null)
              }}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All departments">
                  {selectedLabel(departmentOptions, departmentId, "All departments")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departmentOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Shift">
            <Select
              value={shiftId != null ? String(shiftId) : "all"}
              onValueChange={(value) =>
                setShiftId(value && value !== "all" ? Number(value) : null)
              }
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All shifts">
                  {selectedLabel(shiftOptions, shiftId, "All shifts")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All shifts</SelectItem>
                {shiftOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Timetable">
            <Select
              value={timetableId != null ? String(timetableId) : "all"}
              onValueChange={(value) =>
                setTimetableId(value && value !== "all" ? Number(value) : null)
              }
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All timetables">
                  {selectedLabel(timetableOptions, timetableId, "All timetables")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All timetables</SelectItem>
                {timetableOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status">
            <Select
              value={status || "all"}
              onValueChange={(value) => setStatus(value === "all" ? "" : value || "")}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses">
                  {STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "All statuses"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.label} value={option.value || "all"}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Format">
            <Select
              value={format}
              onValueChange={(value) => {
                if (value === "xlsx" || value === "csv" || value === "pdf") {
                  setFormat(value)
                }
              }}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? "Excel (.xlsx)"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={resetFilters} disabled={downloading}>
            Clear
          </Button>
          <DialogClose
            render={
              <Button type="button" variant="outline" disabled={downloading}>
                Close
              </Button>
            }
          />
          <Button type="button" onClick={handleDownload} disabled={downloading || loading}>
            {downloading ? (
              <>
                <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" />
                Downloading…
              </>
            ) : (
              "Download"
            )}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}

function keyValueEntries(row: AdminRecord | null | undefined) {
  if (!row) return []
  return Object.entries(row).filter(([, value]) => {
    if (value === null || value === undefined) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === "object") return true
    return String(value).trim().length > 0
  })
}

function splitCsvInput(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function toggleCsvValue(value: string, token: string) {
  const parts = splitCsvInput(value)
  if (parts.includes(token)) return parts.filter((entry) => entry !== token).join(", ")
  return [...parts, token].join(", ")
}

function catalogCodes(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return []
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      const parts = splitCsvInput(value)
      if (parts.length > 0) return parts
    }
    if (!Array.isArray(value)) continue
    return value
      .map((entry) => {
        if (typeof entry === "string") return entry.trim()
        if (entry && typeof entry === "object") {
          return readStringValue(entry as AdminRecord, [
            "code",
            "metric_code",
            "metricCode",
            "name",
            "field",
            "key",
            "id",
          ])
        }
        return ""
      })
      .filter(Boolean)
  }
  return []
}

function datasetCodeOf(row: AdminRecord | null | undefined) {
  if (!row) return ""
  return (
    readStringValue(row, [
      "code",
      "dataset_code",
      "datasetCode",
      "slug",
      "key",
      "name",
      "display_name",
      "displayName",
    ]) || (getId(row) !== null ? String(getId(row)) : "")
  )
}

function metricCode(row: AdminRecord) {
  return readStringValue(row, ["code", "metric_code", "metricCode", "name", "key", "field"])
}

function metricKind(row: AdminRecord): "dimension" | "measure" {
  const kind = readStringValue(row, ["kind", "type", "role", "category", "metric_kind"]).toLowerCase()
  if (kind.includes("dimension") || kind.includes("group")) return "dimension"
  if (kind.includes("measure") || kind.includes("metric") || kind.includes("fact")) return "measure"
  const code = metricCode(row).toLowerCase()
  if (/(department|branch|employee|month|week|date|status|grade|gender|job|title|unit|location)/.test(code)) {
    return "dimension"
  }
  return "measure"
}

function readSummaryNumber(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

export function AttendanceReportView() {
  const router = useRouter()
  const actor = useDashboardActor()
  const canAccessScheduledReporting = canAccessDashboardRoute(
    "/dashboard/operations/scheduled-reporting",
    actor.permissionLabels,
    actor.accessMode,
  )
  const [activeReport, setActiveReport] = React.useState<ReportId | null>(null)
  const [catalogAllowed, setCatalogAllowed] = React.useState(true)
  const [token, setToken] = React.useState("")
  const [loadingAnalytics, setLoadingAnalytics] = React.useState(true)
  const [analyticsError, setAnalyticsError] = React.useState<string | null>(null)
  const [dashboardSummary, setDashboardSummary] = React.useState<AdminRecord | null>(null)
  const [datasets, setDatasets] = React.useState<AdminRecord[]>([])
  const [metrics, setMetrics] = React.useState<AdminRecord[]>([])
  const [sources, setSources] = React.useState<AdminRecord[]>([])
  const [freshness, setFreshness] = React.useState<AdminRecord[]>([])
  const [fromDate, setFromDate] = React.useState("")
  const [toDate, setToDate] = React.useState("")
  const [purpose, setPurpose] = React.useState("reporting")
  const [datasetCode, setDatasetCode] = React.useState("")
  const [dimensions, setDimensions] = React.useState("")
  const [measures, setMeasures] = React.useState("")
  const [filterBranchId, setFilterBranchId] = React.useState<number | null>(null)
  const [filterDepartmentId, setFilterDepartmentId] = React.useState<number | null>(null)
  const [filterEmployeeId, setFilterEmployeeId] = React.useState<number | null>(null)
  const [filterEmploymentStatus, setFilterEmploymentStatus] = React.useState("")
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [loadingFilters, setLoadingFilters] = React.useState(false)
  const [limit, setLimit] = React.useState("1000")
  const [outputFormat, setOutputFormat] = React.useState<"CSV" | "JSON">("CSV")
  const [reportCode, setReportCode] = React.useState("PAYE")
  const [runningCustom, setRunningCustom] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [refreshingDatasetCode, setRefreshingDatasetCode] = React.useState("")
  const [reconciling, setReconciling] = React.useState(false)
  const [runningStatutory, setRunningStatutory] = React.useState(false)
  const [customRows, setCustomRows] = React.useState<AdminRecord[]>([])
  const [customSummary, setCustomSummary] = React.useState<AdminRecord | null>(null)
  const [actionSummary, setActionSummary] = React.useState<AdminRecord | null>(null)
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const [showAllMetrics, setShowAllMetrics] = React.useState(false)
  const loadGenerationRef = React.useRef(0)

  const loadAnalytics = React.useCallback(async () => {
    const accessToken = readStoredToken()
    setToken(accessToken)
    if (!accessToken) {
      setAnalyticsError("Authentication required. Please log in again.")
      setLoadingAnalytics(false)
      return
    }

    const generation = loadGenerationRef.current + 1
    loadGenerationRef.current = generation
    setLoadingAnalytics(true)
    setAnalyticsError(null)
    try {
      const [summaryResult, datasetsResult, metricsResult, sourcesResult, freshnessResult] =
        await Promise.allSettled([
          getAnalyticsDashboard(accessToken, "hr", { purpose: "reports" }),
          listAnalyticsDatasets(accessToken),
          listAnalyticsMetrics(accessToken),
          listAnalyticsSources(accessToken),
          getAnalyticsFreshness(accessToken),
        ])

      if (loadGenerationRef.current !== generation) return

      const catalogError =
        datasetsResult.status === "rejected"
          ? datasetsResult.reason
          : metricsResult.status === "rejected"
            ? metricsResult.reason
            : null

      setDashboardSummary(
        summaryResult.status === "fulfilled" && summaryResult.value ? summaryResult.value : null,
      )
      setDatasets(datasetsResult.status === "fulfilled" ? datasetsResult.value : [])
      setMetrics(metricsResult.status === "fulfilled" ? metricsResult.value : [])
      setSources(sourcesResult.status === "fulfilled" ? sourcesResult.value : [])
      setFreshness(freshnessResult.status === "fulfilled" ? freshnessResult.value : [])
      if (catalogError && isPermissionError(catalogError)) {
        setCatalogAllowed(false)
        setAnalyticsError(null)
      } else if (catalogError) {
        setAnalyticsError(
          catalogError instanceof Error
            ? catalogError.message
            : "Could not load the analytics catalog.",
        )
      }
    } catch (errorObject) {
      if (loadGenerationRef.current !== generation) return
      if (isPermissionError(errorObject)) {
        setCatalogAllowed(false)
        setAnalyticsError(null)
      } else {
        setAnalyticsError(
          errorObject instanceof Error ? errorObject.message : "Failed to load analytics workspace.",
        )
      }
    } finally {
      if (loadGenerationRef.current === generation) {
        setLoadingAnalytics(false)
      }
    }
  }, [])

  const canBuildCustomReport =
    actor.ready && hasAnalyticsAccess(actor.permissionLabels) && catalogAllowed

  React.useEffect(() => {
    if (!actor.ready) return
    if (!hasAnalyticsAccess(actor.permissionLabels)) {
      setCatalogAllowed(false)
      setLoadingAnalytics(false)
      return
    }
    void loadAnalytics()
  }, [actor.permissionLabels, actor.ready, loadAnalytics])

  React.useEffect(() => {
    if (!token) return
    let cancelled = false
    async function loadFilters() {
      setLoadingFilters(true)
      try {
        const [br, de, em] = await Promise.allSettled([
          listBranches(token, { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }),
          listDepartments(token, { page: 1, limit: 200, sortBy: "name", sortOrder: "ASC" }),
          listEmployees(token, { page: 1, limit: 200, sortBy: "first_name", sortOrder: "ASC" }),
        ])
        if (cancelled) return
        setBranches(br.status === "fulfilled" ? br.value.rows || [] : [])
        setDepartments(de.status === "fulfilled" ? de.value.rows || [] : [])
        setEmployees(em.status === "fulfilled" ? em.value.rows || [] : [])
      } finally {
        if (!cancelled) setLoadingFilters(false)
      }
    }
    void loadFilters()
    return () => {
      cancelled = true
    }
  }, [token])

  React.useEffect(() => {
    if (datasetCode || datasets.length === 0) return
    const firstCode = datasetCodeOf(datasets[0])
    if (firstCode) setDatasetCode(firstCode)
  }, [datasetCode, datasets])

  const selectedDataset = React.useMemo(
    () => datasets.find((row) => datasetCodeOf(row) === datasetCode) ?? null,
    [datasetCode, datasets],
  )

  const activeDatasetLabel = selectedDataset
    ? getName(selectedDataset, "name", "display_name", "displayName", "code", "dataset_code", "datasetCode")
    : datasetCode || "No dataset selected"

  const freshnessRecord = React.useMemo(() => {
    if (!datasetCode) return freshness[0] ?? null
    return (
      freshness.find((row) => datasetCodeOf(row) === datasetCode) ??
      freshness[0] ??
      null
    )
  }, [datasetCode, freshness])

  const dimensionChoices = React.useMemo(() => {
    const fromDataset = catalogCodes(selectedDataset, [
      "dimensions",
      "dimension_fields",
      "dimensionFields",
      "group_by",
      "groupBy",
      "available_dimensions",
      "availableDimensions",
      "fields",
      "columns",
    ])
    const fromMetrics = metrics.filter((row) => metricKind(row) === "dimension").map(metricCode)
    const fromDatasetKeys = selectedDataset
      ? Object.keys(selectedDataset).filter((key) => {
          const value = selectedDataset[key]
          return typeof value !== "object" || value === null
        })
      : []
    return uniqueCodes([...fromDataset, ...fromMetrics, ...fromDatasetKeys, ...DEFAULT_DIMENSIONS])
  }, [metrics, selectedDataset])

  const measureChoices = React.useMemo(() => {
    const fromDataset = catalogCodes(selectedDataset, [
      "measures",
      "measure_fields",
      "measureFields",
      "facts",
      "available_measures",
      "availableMeasures",
    ])
    const fromMetrics = metrics.filter((row) => metricKind(row) === "measure").map(metricCode)
    return Array.from(new Set([...fromDataset, ...fromMetrics].filter(Boolean)))
  }, [metrics, selectedDataset])

  const isRefreshingDataset = refreshingDatasetCode.length > 0 && refreshingDatasetCode === datasetCode

  const selectedDimensions = React.useMemo(() => splitCsvInput(dimensions), [dimensions])
  const selectedMeasures = React.useMemo(() => splitCsvInput(measures), [measures])
  const stepComplete = {
    dataset: Boolean(datasetCode.trim()),
    columns: selectedDimensions.length > 0 && selectedMeasures.length > 0,
  }

  const branchOptions = React.useMemo(
    () => toOptions(branches, ["name", "branch_name", "branchName"]),
    [branches],
  )
  const allDepartmentOptions = React.useMemo(
    () =>
      toOptions(
        departments,
        ["name", "department_name", "departmentName"],
        ["branch_id", "branchId", "branch"],
      ),
    [departments],
  )
  const departmentOptions = React.useMemo(() => {
    if (filterBranchId === null) return allDepartmentOptions
    return allDepartmentOptions.filter((option) => option.branchId === filterBranchId)
  }, [allDepartmentOptions, filterBranchId])
  const allEmployeeOptions = React.useMemo(() => toEmployeeOptions(employees), [employees])
  const employeeOptions = React.useMemo(() => {
    let options = allEmployeeOptions
    if (filterBranchId !== null) {
      const byBranch = options.filter(
        (option) => option.branchId === null || option.branchId === filterBranchId,
      )
      if (byBranch.length > 0) options = byBranch
    }
    if (filterDepartmentId !== null) {
      const byDepartment = options.filter(
        (option) => option.departmentId === null || option.departmentId === filterDepartmentId,
      )
      if (byDepartment.length > 0) options = byDepartment
    }
    return options
  }, [allEmployeeOptions, filterBranchId, filterDepartmentId])
  const selectedFilterEmployee = React.useMemo(
    () => employeeOptions.find((option) => option.id === filterEmployeeId) ?? null,
    [employeeOptions, filterEmployeeId],
  )

  React.useEffect(() => {
    if (filterDepartmentId === null) return
    if (!departmentOptions.some((option) => option.id === filterDepartmentId)) {
      setFilterDepartmentId(null)
    }
  }, [departmentOptions, filterDepartmentId])

  React.useEffect(() => {
    if (filterEmployeeId === null) return
    if (!employeeOptions.some((option) => option.id === filterEmployeeId)) {
      setFilterEmployeeId(null)
    }
  }, [employeeOptions, filterEmployeeId])

  function analyticsScope() {
    const filters: Record<string, unknown> = {}
    if (filterEmploymentStatus.trim()) {
      filters.employment_status = filterEmploymentStatus.trim()
    }
    return {
      date_from: fromDate || undefined,
      date_to: toDate || undefined,
      purpose: purpose.trim() || undefined,
      branch_id: filterBranchId ?? undefined,
      department_id: filterDepartmentId ?? undefined,
      employee_id: filterEmployeeId ?? undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    }
  }

  const snapshotStats = React.useMemo(() => {
    const headcount = readSummaryNumber(dashboardSummary, [
      "headcount",
      "employee_count",
      "employees_total",
      "total_headcount",
    ])
    const attendanceRate = readSummaryNumber(dashboardSummary, [
      "attendance_rate",
      "attendance_percentage",
      "present_rate",
    ])
    return {
      headcount: headcount !== null ? String(headcount) : "",
      attendance: attendanceRate !== null ? `${attendanceRate}%` : "",
    }
  }, [dashboardSummary])

  const customResultColumns = React.useMemo(() => {
    const sample = customRows[0]
    if (!sample) return []
    return Object.keys(sample)
      .filter((key) => key !== "id")
      .slice(0, 6)
  }, [customRows])

  async function onRunCustomReport() {
    if (!token) {
      toast.error("Authentication required. Please log in again.")
      return
    }
    const parsedDimensions = splitCsvInput(dimensions)
    const parsedMeasures = splitCsvInput(measures)
    if (!datasetCode.trim() || parsedDimensions.length === 0 || parsedMeasures.length === 0) {
      toast.error("Dataset, dimensions, and measures are required.")
      return
    }

    setRunningCustom(true)
    setActionSummary(null)
    try {
      const result = await runAnalyticsCustomReport(token, {
        ...analyticsScope(),
        dataset_code: datasetCode.trim(),
        dimensions: parsedDimensions,
        measures: parsedMeasures,
        limit: limit.trim() ? Number(limit) : undefined,
      })

      if (Array.isArray(result)) {
        setCustomRows(result)
        setCustomSummary({
          dataset_code: datasetCode.trim(),
          row_count: result.length,
          dimensions: parsedDimensions.join(", "),
          measures: parsedMeasures.join(", "),
        })
      } else {
        setCustomRows([])
        setCustomSummary(result as AdminRecord)
      }
      toast.success("Custom report executed.")
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error ? errorObject.message : "Failed to run custom report.",
      )
    } finally {
      setRunningCustom(false)
    }
  }

  async function onExportReport() {
    if (!token) {
      toast.error("Authentication required. Please log in again.")
      return
    }
    const parsedDimensions = splitCsvInput(dimensions)
    const parsedMeasures = splitCsvInput(measures)
    if (!datasetCode.trim() || parsedDimensions.length === 0 || parsedMeasures.length === 0) {
      toast.error("Dataset, dimensions, and measures are required before export.")
      return
    }

    setExporting(true)
    try {
      const result = await exportAnalyticsReport(token, {
        ...analyticsScope(),
        dataset_code: datasetCode.trim(),
        dimensions: parsedDimensions,
        measures: parsedMeasures,
        limit: limit.trim() ? Number(limit) : undefined,
        output_format: outputFormat,
        idempotency_key: `analytics-export-${datasetCode.trim()}-${Date.now()}`,
      })
      setActionSummary(result as AdminRecord)
      toast.success(`Analytics export queued (${outputFormat}).`)
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error ? errorObject.message : "Failed to queue analytics export.",
      )
    } finally {
      setExporting(false)
    }
  }

  async function onRefreshDataset() {
    if (!token || !datasetCode.trim()) {
      toast.error("Select a dataset before refreshing.")
      return
    }

    setRefreshingDatasetCode(datasetCode)
    try {
      const result = await refreshAnalyticsDataset(token, {
        ...analyticsScope(),
        dataset_code: datasetCode.trim(),
        refresh_mode: "MANUAL",
      })
      setActionSummary(result as AdminRecord)
      await loadAnalytics()
      toast.success("Dataset refresh requested.")
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error ? errorObject.message : "Failed to refresh dataset.",
      )
    } finally {
      setRefreshingDatasetCode("")
    }
  }

  async function onRunReconciliation() {
    if (!token) {
      toast.error("Authentication required. Please log in again.")
      return
    }
    setReconciling(true)
    try {
      const result = await runAnalyticsReconciliation(token)
      setActionSummary(result as AdminRecord)
      toast.success("Analytics reconciliation started.")
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to start analytics reconciliation.",
      )
    } finally {
      setReconciling(false)
    }
  }

  async function onRunStatutory() {
    if (!token || !reportCode.trim()) {
      toast.error("Report code is required.")
      return
    }
    setRunningStatutory(true)
    try {
      const result = await runStatutoryReport(token, {
        ...analyticsScope(),
        report_code: reportCode.trim(),
      })
      setActionSummary(result as AdminRecord)
      toast.success("Statutory report run created.")
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error ? errorObject.message : "Failed to run statutory report.",
      )
    } finally {
      setRunningStatutory(false)
    }
  }

  const lastRefresh =
    readStringValue(freshnessRecord, ["refreshed_at", "updated_at", "last_refreshed_at"]) ||
    readStringValue(freshness[0], ["refreshed_at", "updated_at", "last_refreshed_at"])

  const visibleMeasures = showAllMetrics ? measureChoices : measureChoices.slice(0, 10)
  const hasMoreChoices = measureChoices.length > 10
  const freshnessLabel =
    readStringValue(freshnessRecord, ["status", "freshness_status", "state"]) || ""

  return (
    <motion.div
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-12"
      initial="hidden"
      animate="show"
      variants={pageStagger}
    >
      <motion.header variants={pageItem} className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Operations
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {canBuildCustomReport
            ? "Download a ready-made attendance file, or build a custom report from a dataset."
            : canAccessScheduledReporting
              ? "Download a filtered attendance file, or set up email delivery."
              : "Download a filtered attendance file by people, branch, and dates."}
        </p>
      </motion.header>

      <motion.section variants={pageItem} className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Start here</h2>
          <p className="text-xs text-muted-foreground">Ready-made files — no setup</p>
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <motion.button
            type="button"
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50"
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.995 }}
            onClick={() => setActiveReport("attendance-download")}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheetIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">Download attendance</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Filter by people, branch, and dates. Save as Excel, CSV, or PDF.
              </span>
            </span>
            <DownloadIcon className="size-4 shrink-0 text-muted-foreground" />
          </motion.button>
          {canAccessScheduledReporting ? (
            <motion.button
              type="button"
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50"
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.995 }}
              onClick={() => router.push("/dashboard/operations/scheduled-reporting")}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                <MailIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">Email reports on a schedule</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Templates, SMTP, and delivery history.
                </span>
              </span>
              <CalendarClockIcon className="size-4 shrink-0 text-muted-foreground" />
            </motion.button>
          ) : null}
        </div>
      </motion.section>

      {canBuildCustomReport ? (
      <motion.section variants={pageItem} className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Build a custom report</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Choose data, click the columns you want, then run.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
            disabled={loadingAnalytics}
            onClick={() => void loadAnalytics()}
          >
            <RefreshCwIcon className={cn("size-4", loadingAnalytics && "animate-spin")} />
            Refresh catalog
          </button>
        </div>

        <ol className="flex flex-wrap items-center gap-2 border-y border-border px-5 py-2.5 text-xs">
          {[
            { n: "1", label: "Pick data", done: stepComplete.dataset },
            { n: "2", label: "Choose columns", done: stepComplete.columns },
            { n: "3", label: "Run", done: Boolean(customSummary) },
          ].map((step, index) => (
            <li key={step.n} className="flex items-center gap-2">
              {index > 0 ? <span className="hidden h-px w-6 bg-border sm:block" /> : null}
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  step.done
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground",
                )}
              >
                {step.n}
              </span>
              <span className={cn(step.done ? "font-medium text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>

        {analyticsError ? (
          <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {analyticsError}
          </div>
        ) : null}

        <p className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-2.5 text-xs text-muted-foreground">
          <span>
            <strong className="font-medium text-foreground">{loadingAnalytics ? "…" : datasets.length}</strong>{" "}
            datasets
          </span>
          <span>
            <strong className="font-medium text-foreground">{loadingAnalytics ? "…" : metrics.length}</strong>{" "}
            metrics
          </span>
          {sources.length > 0 ? (
            <span>
              <strong className="font-medium text-foreground">{sources.length}</strong> sources
            </span>
          ) : null}
          {snapshotStats.headcount ? (
            <span>
              Headcount <strong className="font-medium text-foreground">{snapshotStats.headcount}</strong>
            </span>
          ) : null}
          {snapshotStats.attendance ? (
            <span>
              Attendance <strong className="font-medium text-foreground">{snapshotStats.attendance}</strong>
            </span>
          ) : null}
          {lastRefresh ? <span>Last refresh {lastRefresh}</span> : null}
        </p>

        <div className="grid gap-0 border-t border-border lg:grid-cols-[minmax(15rem,18.5rem)_minmax(0,1fr)]">
          <aside className="border-b border-border lg:border-r lg:border-b-0">
            <div className="px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                1 · Dataset
              </p>
            </div>
            <div className="max-h-[28rem] overflow-y-auto px-2 pb-3">
              {loadingAnalytics ? (
                <p className="px-3 py-6 text-sm text-muted-foreground">Loading datasets…</p>
              ) : datasets.length === 0 ? (
                <p className="px-3 py-6 text-sm text-muted-foreground">No datasets published yet.</p>
              ) : (
                <motion.ul variants={listStagger} initial="hidden" animate="show">
                  {datasets.map((row, index) => {
                    const code = datasetCodeOf(row)
                    const selected = Boolean(code) && datasetCode === code
                    return (
                      <motion.li key={`dataset-${code || index}`} variants={listItem}>
                        <button
                          type="button"
                          className={cn(
                            "relative flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition",
                            selected ? "bg-primary/10 text-foreground" : "hover:bg-muted/60",
                          )}
                          onClick={() => {
                            if (!code) return
                            setDatasetCode(code)
                            setCustomRows([])
                            setCustomSummary(null)
                          }}
                        >
                          {selected ? (
                            <motion.span
                              layoutId="dataset-indicator"
                              className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
                            />
                          ) : null}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {getName(
                                row,
                                "name",
                                "display_name",
                                "displayName",
                                "code",
                                "dataset_code",
                                "datasetCode",
                              )}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {code || "No code"}
                            </span>
                          </span>
                        </button>
                      </motion.li>
                    )
                  })}
                </motion.ul>
              )}
            </div>
          </aside>

          <div className="space-y-5 px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                2 · Columns and period
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Using <span className="font-medium text-foreground">{activeDatasetLabel}</span>
                {freshnessLabel ? ` · ${freshnessLabel}` : null}
              </p>
            </div>

            <div className="space-y-3">
              <SuggestField
                id="report-group-by"
                label="Group by"
                value={dimensions}
                onChange={setDimensions}
                options={dimensionChoices}
                placeholder="Type to search columns"
                hint="How rows should be split — type to search, click to add or remove."
              />

              <Field label="Numbers to show">
                <Input
                  value={measures}
                  onChange={(event) => setMeasures(event.target.value)}
                  placeholder="headcount, attendance_rate"
                />
              </Field>
              {visibleMeasures.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {visibleMeasures.map((code) => {
                    const selected = selectedMeasures.includes(code)
                    return (
                      <button
                        key={`measure-${code}`}
                        type="button"
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted",
                        )}
                        onClick={() => setMeasures((current) => toggleCsvValue(current, code))}
                      >
                        {code.replace(/_/g, " ")}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The values calculated for each group. Type them here if no metrics are listed yet.
                </p>
              )}

              {hasMoreChoices ? (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setShowAllMetrics((current) => !current)}
                >
                  {showAllMetrics ? "Show fewer columns" : "Show all catalog columns"}
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="From">
                <DatePickerPresets value={fromDate} onChange={setFromDate} placeholder="Optional start date" />
              </Field>
              <Field label="To">
                <DatePickerPresets value={toDate} onChange={setToDate} placeholder="Optional end date" />
              </Field>
              <Field label="Branch">
                <Select
                  value={filterBranchId != null ? String(filterBranchId) : "all"}
                  onValueChange={(value) => {
                    setFilterBranchId(value && value !== "all" ? Number(value) : null)
                    setFilterDepartmentId(null)
                    setFilterEmployeeId(null)
                  }}
                  disabled={loadingFilters}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All branches">
                      {selectedLabel(branchOptions, filterBranchId, "All branches")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branchOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Department">
                <Select
                  value={filterDepartmentId != null ? String(filterDepartmentId) : "all"}
                  onValueChange={(value) => {
                    setFilterDepartmentId(value && value !== "all" ? Number(value) : null)
                    setFilterEmployeeId(null)
                  }}
                  disabled={loadingFilters}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All departments">
                      {selectedLabel(departmentOptions, filterDepartmentId, "All departments")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departmentOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Employee">
                <Select
                  value={filterEmployeeId != null ? String(filterEmployeeId) : "all"}
                  onValueChange={(value) => {
                    setFilterEmployeeId(value && value !== "all" ? Number(value) : null)
                  }}
                  disabled={loadingFilters}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All employees">
                      {selectedFilterEmployee?.label ?? "All employees"}
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
                        data-search-text={`${option.label} ${option.employeeNo}`}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Employment status">
                <Select
                  value={filterEmploymentStatus || "all"}
                  onValueChange={(value) => setFilterEmploymentStatus(value === "all" ? "" : value || "")}
                  disabled={loadingFilters}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All employment statuses">
                      {EMPLOYMENT_STATUS_OPTIONS.find((option) => option.value === filterEmploymentStatus)?.label ??
                        "All employment statuses"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.label} value={option.value || "all"}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              onClick={() => setShowAdvanced((current) => !current)}
              aria-expanded={showAdvanced}
            >
              <ChevronDownIcon
                className={cn("size-4 transition-transform", showAdvanced ? "rotate-180" : "rotate-0")}
              />
              More options
            </button>

            <AnimatePresence initial={false}>
              {showAdvanced ? (
                <motion.div
                  key="advanced"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Purpose">
                      <Input
                        value={purpose}
                        onChange={(event) => setPurpose(event.target.value)}
                        placeholder="reporting"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Row limit">
                        <Input value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="1000" />
                      </Field>
                      <Field label="Export as">
                        <Select
                          value={outputFormat}
                          onValueChange={(value) => {
                            if (value === "CSV" || value === "JSON") setOutputFormat(value)
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>{outputFormat}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CSV">CSV</SelectItem>
                            <SelectItem value="JSON">JSON</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="space-y-3 rounded-xl border border-dashed border-border px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Specialized
                      </p>
                      <Field label="Statutory code">
                        <Input
                          value={reportCode}
                          onChange={(event) => setReportCode(event.target.value)}
                          placeholder="PAYE"
                        />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void onRunStatutory()}
                          disabled={runningStatutory}
                        >
                          {runningStatutory ? (
                            <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" />
                          ) : (
                            <ScrollTextIcon data-icon="inline-start" />
                          )}
                          Run statutory
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void onRunReconciliation()}
                          disabled={reconciling}
                        >
                          {reconciling ? (
                            <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" />
                          ) : (
                            <ScaleIcon data-icon="inline-start" />
                          )}
                          Reconcile warehouse
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <p className="w-full text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                3 · Run
              </p>
              <Button type="button" onClick={() => void onRunCustomReport()} disabled={runningCustom}>
                {runningCustom ? (
                  <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" />
                ) : (
                  <PlayIcon data-icon="inline-start" />
                )}
                {runningCustom ? "Running…" : "Run report"}
              </Button>
              <Button type="button" variant="outline" onClick={() => void onExportReport()} disabled={exporting}>
                {exporting ? (
                  <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" />
                ) : (
                  <DownloadIcon data-icon="inline-start" />
                )}
                {exporting ? "Exporting…" : `Export ${outputFormat}`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void onRefreshDataset()}
                disabled={isRefreshingDataset || !datasetCode.trim()}
              >
                {isRefreshingDataset ? (
                  <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" />
                ) : (
                  <RefreshCwIcon data-icon="inline-start" />
                )}
                {isRefreshingDataset ? "Refreshing…" : "Refresh data"}
              </Button>
            </div>

            <AnimatePresence initial={false}>
              {customSummary ? (
                <motion.div
                  key="custom-result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.24 }}
                  className="border-t border-border pt-4"
                >
                  <h3 className="text-sm font-semibold tracking-tight">Result</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    First 20 rows for {activeDatasetLabel}.
                  </p>
                  {customRows.length > 0 ? (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                      <StandardTable className="min-w-full text-sm">
                        <StandardTableHeader className="border-b border-border bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          <StandardTableRow>
                            {customResultColumns.map((column) => (
                              <StandardTableHead key={column} className="px-3 py-2">
                                {column.replace(/_/g, " ")}
                              </StandardTableHead>
                            ))}
                          </StandardTableRow>
                        </StandardTableHeader>
                        <StandardTableBody className="divide-y divide-border text-foreground">
                          {customRows.slice(0, 20).map((row, index) => (
                            <StandardTableRow key={`custom-row-${index}`}>
                              {customResultColumns.map((column) => (
                                <StandardTableCell key={`${index}-${column}`} className="px-3 py-2 align-top text-xs">
                                  {typeof row[column] === "object" && row[column] !== null
                                    ? readStringValue(row[column] as AdminRecord, [
                                        "name",
                                        "label",
                                        "title",
                                        "code",
                                      ]) || "Structured value"
                                    : String(row[column] ?? "—")}
                                </StandardTableCell>
                              ))}
                            </StandardTableRow>
                          ))}
                        </StandardTableBody>
                      </StandardTable>
                    </div>
                  ) : (
                    <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
                      {keyValueEntries(customSummary).map(([key, value]) => (
                        <React.Fragment key={key}>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {key.replace(/_/g, " ")}
                          </dt>
                          <dd className="text-sm text-foreground">
                            {typeof value === "object" && value !== null
                              ? readStringValue(value as AdminRecord, ["name", "label", "title", "code"]) ||
                                "Structured response"
                              : String(value)}
                          </dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {actionSummary ? (
                <motion.div
                  key="action-result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.24 }}
                  className="border-t border-border pt-4"
                >
                  <h3 className="text-sm font-semibold tracking-tight">Latest action</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Export, refresh, statutory, or reconcile response.
                  </p>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
                    {keyValueEntries(actionSummary).map(([key, value]) => (
                      <React.Fragment key={key}>
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {key.replace(/_/g, " ")}
                        </dt>
                        <dd className="text-sm text-foreground">
                          {typeof value === "object" && value !== null
                            ? readStringValue(value as AdminRecord, [
                                "name",
                                "label",
                                "title",
                                "code",
                                "status",
                              ]) || "Structured response"
                            : String(value)}
                        </dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </motion.section>
      ) : null}

      <AttendanceReportDialog
        open={activeReport === "attendance-download"}
        onOpenChange={(open) => {
          if (!open) setActiveReport(null)
        }}
      />
    </motion.div>
  )
}

export default AttendanceReportView
