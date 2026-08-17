"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarClockIcon,
  ChartColumnIcon,
  ChevronRightIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"

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
  { value: "ON_LEAVE", label: "On leave" },
] as const

type ReportId = "attendance-download" | "scheduled-reporting"

type ReportTone = "sky" | "emerald" | "amber" | "violet"

type ReportDefinition = {
  id: ReportId
  title: string
  description: string
  tone: ReportTone
  icon: React.ReactNode
  href?: string
}

type ReportGroup = {
  id: string
  title: string
  reports: ReportDefinition[]
}

const REPORT_TONE_CLASSES: Record<
  ReportTone,
  { card: string; icon: string; chevron: string }
> = {
  sky: {
    card: "border-sky-200 bg-sky-50/70 hover:border-sky-300 hover:bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/30 dark:hover:border-sky-800 dark:hover:bg-sky-950/45",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/70 dark:text-sky-300",
    chevron: "text-sky-600 dark:text-sky-400",
  },
  emerald: {
    card: "border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/45",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300",
    chevron: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    card: "border-amber-200 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 dark:hover:border-amber-800 dark:hover:bg-amber-950/45",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300",
    chevron: "text-amber-600 dark:text-amber-400",
  },
  violet: {
    card: "border-violet-200 bg-violet-50/70 hover:border-violet-300 hover:bg-violet-50 dark:border-violet-900/60 dark:bg-violet-950/30 dark:hover:border-violet-800 dark:hover:bg-violet-950/45",
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-300",
    chevron: "text-violet-600 dark:text-violet-400",
  },
}

const REPORT_GROUPS: ReportGroup[] = [
  {
    id: "attendance",
    title: "Attendance",
    reports: [
      {
        id: "attendance-download",
        title: "Attendance report",
        description: "Download filtered attendance summaries as XLSX, CSV, or PDF.",
        tone: "sky",
        icon: <ChartColumnIcon className="size-5" />,
      },
    ],
  },
  {
    id: "scheduled",
    title: "Scheduled Reporting",
    reports: [
      {
        id: "scheduled-reporting",
        title: "Scheduled reporting",
        description:
          "Manage report templates, delivery schedules, SMTP settings, and execution history.",
        tone: "violet",
        icon: <CalendarClockIcon className="size-5" />,
        href: "/dashboard/operations/scheduled-reporting",
      },
    ],
  },
]

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

function readStringValue(record: AdminRecord, keys: string[]): string {
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
                <Loader2Icon data-icon="inline-start" className="animate-spin" />
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

function readSummaryString(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return ""
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

export function AttendanceReportView() {
  const router = useRouter()
  const [activeReport, setActiveReport] = React.useState<ReportId | null>(null)
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
  const [filtersJson, setFiltersJson] = React.useState("")
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

  const loadAnalytics = React.useCallback(async () => {
    const accessToken = readStoredToken()
    setToken(accessToken)
    if (!accessToken) {
      setAnalyticsError("Authentication required. Please log in again.")
      setLoadingAnalytics(false)
      return
    }

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

      setDashboardSummary(
        summaryResult.status === "fulfilled" && summaryResult.value ? summaryResult.value : null,
      )
      setDatasets(datasetsResult.status === "fulfilled" ? datasetsResult.value : [])
      setMetrics(metricsResult.status === "fulfilled" ? metricsResult.value : [])
      setSources(sourcesResult.status === "fulfilled" ? sourcesResult.value : [])
      setFreshness(freshnessResult.status === "fulfilled" ? freshnessResult.value : [])
    } catch (errorObject) {
      setAnalyticsError(
        errorObject instanceof Error ? errorObject.message : "Failed to load analytics workspace.",
      )
    } finally {
      setLoadingAnalytics(false)
    }
  }, [])

  React.useEffect(() => {
    void loadAnalytics()
  }, [loadAnalytics])

  React.useEffect(() => {
    if (!datasetCode && datasets.length > 0) {
      const firstCode = readStringValue(datasets[0], ["code", "dataset_code", "name"])
      if (firstCode) {
        setDatasetCode(firstCode)
      }
    }
  }, [datasetCode, datasets])

  const activeDatasetLabel = React.useMemo(() => {
    return (
      datasets.find((row) => readStringValue(row, ["code", "dataset_code", "name"]) === datasetCode)
        ? getName(
            datasets.find(
              (row) => readStringValue(row, ["code", "dataset_code", "name"]) === datasetCode,
            ) as AdminRecord,
            "name",
            "display_name",
            "code",
            "dataset_code",
          )
        : datasetCode || "No dataset selected"
    )
  }, [datasetCode, datasets])

  const freshnessRecord = React.useMemo(() => {
    if (!datasetCode) return freshness[0] ?? null
    return (
      freshness.find(
        (row) =>
          readStringValue(row, ["dataset_code", "datasetCode", "code"]) === datasetCode,
      ) ??
      freshness[0] ??
      null
    )
  }, [datasetCode, freshness])

  const summaryCards = React.useMemo(() => {
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
    const pendingLeave = readSummaryNumber(dashboardSummary, [
      "pending_leave",
      "pending_leaves",
      "leave_pending",
    ])
    const openOnboarding = readSummaryNumber(dashboardSummary, [
      "pending_onboarding",
      "open_onboarding_requests",
      "onboarding_pending",
    ])

    return [
      {
        label: "Datasets",
        value: String(datasets.length),
        help: "Analytics datasets returned by the backend catalog.",
      },
      {
        label: "Metrics",
        value: String(metrics.length),
        help: "Metric definitions available for custom reports and dashboards.",
      },
      {
        label: "Headcount",
        value: headcount !== null ? String(headcount) : "—",
        help: "HR dashboard summary from the analytics endpoint.",
      },
      {
        label: "Attendance",
        value: attendanceRate !== null ? `${attendanceRate}%` : "—",
        help: pendingLeave !== null || openOnboarding !== null
          ? `Pending leave ${pendingLeave ?? 0} • onboarding ${openOnboarding ?? 0}`
          : "No summary metric returned for the selected snapshot.",
      },
    ]
  }, [dashboardSummary, datasets.length, metrics.length])

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

    let parsedFilters: Record<string, unknown> | undefined
    if (filtersJson.trim()) {
      try {
        parsedFilters = JSON.parse(filtersJson) as Record<string, unknown>
      } catch {
        toast.error("Filters must be valid JSON.")
        return
      }
    }

    setRunningCustom(true)
    setActionSummary(null)
    try {
      const result = await runAnalyticsCustomReport(token, {
        date_from: fromDate || undefined,
        date_to: toDate || undefined,
        purpose: purpose.trim() || undefined,
        dataset_code: datasetCode.trim(),
        dimensions: parsedDimensions,
        measures: parsedMeasures,
        filters: parsedFilters,
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

    let parsedFilters: Record<string, unknown> | undefined
    if (filtersJson.trim()) {
      try {
        parsedFilters = JSON.parse(filtersJson) as Record<string, unknown>
      } catch {
        toast.error("Filters must be valid JSON.")
        return
      }
    }

    setExporting(true)
    try {
      const result = await exportAnalyticsReport(token, {
        date_from: fromDate || undefined,
        date_to: toDate || undefined,
        purpose: purpose.trim() || undefined,
        dataset_code: datasetCode.trim(),
        dimensions: parsedDimensions,
        measures: parsedMeasures,
        filters: parsedFilters,
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
        dataset_code: datasetCode.trim(),
        refresh_mode: "MANUAL",
        date_from: fromDate || undefined,
        date_to: toDate || undefined,
        purpose: purpose.trim() || undefined,
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
        report_code: reportCode.trim(),
        date_from: fromDate || undefined,
        date_to: toDate || undefined,
        purpose: purpose.trim() || undefined,
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Download on-demand attendance files, manage scheduled delivery, and work directly with the new analytics/reporting APIs.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {REPORT_GROUPS.map((group) => (
          <section key={group.id} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.title}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.reports.map((report) => {
                const tone = REPORT_TONE_CLASSES[report.tone]
                return (
                  <li key={report.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (report.href) {
                          router.push(report.href)
                          return
                        }
                        setActiveReport(report.id)
                      }}
                      className={cn(
                        "group flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-sm transition-all",
                        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                        tone.card,
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
                          tone.icon,
                        )}
                      >
                        {report.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {report.title}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {report.description}
                        </span>
                      </span>
                      <ChevronRightIcon
                        className={cn(
                          "mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                          tone.chevron,
                        )}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Analytics Studio
            </h2>
            <p className="text-sm text-muted-foreground">
              Catalog datasets and metrics, refresh analytics sources, run custom reports, queue exports, and start statutory reporting from one place.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
            disabled={loadingAnalytics}
            onClick={() => void loadAnalytics()}
          >
            <RefreshCwIcon className={cn("size-4", loadingAnalytics && "animate-spin")} />
            Refresh analytics
          </button>
        </div>

        {analyticsError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {analyticsError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {loadingAnalytics ? "…" : card.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{card.help}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4 rounded-2xl border border-border bg-background/60 p-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Catalog and freshness
              </h3>
              <p className="text-sm text-muted-foreground">
                Review the analytics assets the backend has published for reporting.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">Datasets</h4>
                  <span className="text-xs text-muted-foreground">{datasets.length}</span>
                </div>
                {loadingAnalytics ? (
                  <p className="text-sm text-muted-foreground">Loading datasets…</p>
                ) : datasets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No datasets returned yet.</p>
                ) : (
                  <div className="space-y-2">
                    {datasets.slice(0, 6).map((row, index) => {
                      const code = readStringValue(row, ["code", "dataset_code", "name"])
                      return (
                        <button
                          key={`dataset-${code || index}`}
                          type="button"
                          className={cn(
                            "flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition hover:bg-muted/40",
                            datasetCode === code ? "border-primary bg-primary/5" : "border-border",
                          )}
                          onClick={() => {
                            setDatasetCode(code)
                            setCustomRows([])
                            setCustomSummary(null)
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {getName(row, "name", "display_name", "code", "dataset_code")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {code || "No dataset code"}
                            </p>
                          </div>
                          <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">Freshness</h4>
                  <span className="text-xs text-muted-foreground">{freshness.length}</span>
                </div>
                {loadingAnalytics ? (
                  <p className="text-sm text-muted-foreground">Loading freshness…</p>
                ) : freshness.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No freshness records were returned.</p>
                ) : (
                  <div className="space-y-2">
                    {freshness.slice(0, 6).map((row, index) => {
                      const code = readStringValue(row, ["dataset_code", "datasetCode", "code", "name"])
                      return (
                        <div
                          key={`freshness-${code || index}`}
                          className={cn(
                            "rounded-lg border px-3 py-2",
                            datasetCode && datasetCode === code ? "border-primary bg-primary/5" : "border-border",
                          )}
                        >
                          <p className="text-sm font-medium text-foreground">{code || "Dataset"}</p>
                          <p className="text-xs text-muted-foreground">
                            Last update:{" "}
                            {readStringValue(row, ["refreshed_at", "updated_at", "last_refreshed_at", "lastUpdatedAt"]) ||
                              "Not provided"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Status:{" "}
                            {readStringValue(row, ["status", "freshness_status", "state"]) || "Unknown"}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">Metrics</h4>
                  <span className="text-xs text-muted-foreground">{metrics.length}</span>
                </div>
                {loadingAnalytics ? (
                  <p className="text-sm text-muted-foreground">Loading metrics…</p>
                ) : metrics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No metric definitions returned.</p>
                ) : (
                  <div className="space-y-2">
                    {metrics.slice(0, 6).map((row, index) => (
                      <div key={`metric-${index}`} className="rounded-lg border border-border px-3 py-2">
                        <p className="text-sm font-medium text-foreground">
                          {getName(row, "name", "display_name", "code", "metric_code")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {readStringValue(row, ["code", "metric_code", "slug"]) || "No metric code"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">Sources</h4>
                  <span className="text-xs text-muted-foreground">{sources.length}</span>
                </div>
                {loadingAnalytics ? (
                  <p className="text-sm text-muted-foreground">Loading sources…</p>
                ) : sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No analytics sources were returned.</p>
                ) : (
                  <div className="space-y-2">
                    {sources.slice(0, 6).map((row, index) => (
                      <div key={`source-${index}`} className="rounded-lg border border-border px-3 py-2">
                        <p className="text-sm font-medium text-foreground">
                          {getName(row, "name", "display_name", "code", "source_code")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {readStringValue(row, ["status", "state", "mode", "type"]) || "Source metadata"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-background/60 p-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Report builder
              </h3>
              <p className="text-sm text-muted-foreground">
                Build a custom analytics run, queue an export, refresh a dataset, or trigger statutory and reconciliation flows.
              </p>
            </div>

            <div className="grid gap-3">
              <Field label="Dataset">
                <Select
                  value={datasetCode || "none"}
                  onValueChange={(value) =>
                    setDatasetCode(!value || value === "none" ? "" : value)
                  }
                  disabled={loadingAnalytics}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select dataset">
                      {activeDatasetLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select dataset</SelectItem>
                    {datasets.map((row, index) => {
                      const code = readStringValue(row, ["code", "dataset_code", "name"])
                      if (!code) return null
                      return (
                        <SelectItem key={`builder-dataset-${code}-${index}`} value={code}>
                          {getName(row, "name", "display_name", "code", "dataset_code")}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Date from">
                  <DatePickerPresets value={fromDate} onChange={setFromDate} placeholder="Optional start date" />
                </Field>
                <Field label="Date to">
                  <DatePickerPresets value={toDate} onChange={setToDate} placeholder="Optional end date" />
                </Field>
              </div>

              <Field label="Purpose">
                <Input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="reporting" />
              </Field>
              <Field label="Dimensions (comma separated)">
                <Input value={dimensions} onChange={(event) => setDimensions(event.target.value)} placeholder="department_name,branch_name" />
              </Field>
              <Field label="Measures (comma separated)">
                <Input value={measures} onChange={(event) => setMeasures(event.target.value)} placeholder="headcount,attendance_rate" />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Row limit">
                  <Input value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="1000" />
                </Field>
                <Field label="Export format">
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
              <Field label="Filters JSON">
                <textarea
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={filtersJson}
                  onChange={(event) => setFiltersJson(event.target.value)}
                  placeholder='{"employment_status":"active"}'
                />
              </Field>
              <Field label="Statutory report code">
                <Input value={reportCode} onChange={(event) => setReportCode(event.target.value)} placeholder="PAYE" />
              </Field>
            </div>

            {freshnessRecord ? (
              <div className="rounded-xl border border-border bg-card px-3 py-2">
                <p className="text-sm font-medium text-foreground">Selected dataset freshness</p>
                <p className="text-xs text-muted-foreground">
                  {readStringValue(freshnessRecord, ["dataset_code", "datasetCode", "code"]) || datasetCode || "Dataset"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {readStringValue(freshnessRecord, ["refreshed_at", "updated_at", "last_refreshed_at"]) || "No freshness timestamp"}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void onRunCustomReport()} disabled={runningCustom}>
                {runningCustom ? (
                  <>
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    Running…
                  </>
                ) : (
                  "Run custom report"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => void onExportReport()} disabled={exporting}>
                {exporting ? (
                  <>
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    Exporting…
                  </>
                ) : (
                  `Queue ${outputFormat} export`
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => void onRefreshDataset()} disabled={refreshingDatasetCode === datasetCode || !datasetCode.trim()}>
                {refreshingDatasetCode === datasetCode ? (
                  <>
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    Refreshing…
                  </>
                ) : (
                  "Refresh dataset"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => void onRunReconciliation()} disabled={reconciling}>
                {reconciling ? (
                  <>
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    Reconciling…
                  </>
                ) : (
                  "Run reconciliation"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => void onRunStatutory()} disabled={runningStatutory}>
                {runningStatutory ? (
                  <>
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    Running…
                  </>
                ) : (
                  "Run statutory report"
                )}
              </Button>
            </div>
          </div>
        </div>

        {customSummary ? (
          <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Custom report result
              </h3>
              <p className="text-sm text-muted-foreground">
                The custom-report endpoint returned the result below for the currently selected dataset.
              </p>
            </div>

            {Array.isArray(customRows) && customRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      {customResultColumns.map((column) => (
                        <th key={column} className="px-3 py-2">
                          {column.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {customRows.slice(0, 20).map((row, index) => (
                      <tr key={`custom-row-${index}`}>
                        {customResultColumns.map((column) => (
                          <td key={`${index}-${column}`} className="px-3 py-2 align-top text-xs">
                            {typeof row[column] === "object" && row[column] !== null
                              ? readStringValue(row[column] as AdminRecord, [
                                  "name",
                                  "label",
                                  "title",
                                  "code",
                                ]) || "Structured value"
                              : String(row[column] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-x-6 gap-y-3 md:grid-cols-[minmax(10rem,13rem)_1fr]">
                {keyValueEntries(customSummary).map(([key, value]) => (
                  <React.Fragment key={key}>
                    <div className="border-b border-border py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {key.replace(/_/g, " ")}
                    </div>
                    <div className="border-b border-border py-2 text-sm text-foreground">
                      {typeof value === "object" && value !== null
                        ? readStringValue(value as AdminRecord, ["name", "label", "title", "code"]) ||
                          "Structured response"
                        : String(value)}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {actionSummary ? (
          <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Latest backend action
              </h3>
              <p className="text-sm text-muted-foreground">
                The most recent export, refresh, reconciliation, or statutory action response is summarized below.
              </p>
            </div>
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-[minmax(10rem,13rem)_1fr]">
              {keyValueEntries(actionSummary).map(([key, value]) => (
                <React.Fragment key={key}>
                  <div className="border-b border-border py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {key.replace(/_/g, " ")}
                  </div>
                  <div className="border-b border-border py-2 text-sm text-foreground">
                    {typeof value === "object" && value !== null
                      ? readStringValue(value as AdminRecord, ["name", "label", "title", "code", "status"]) ||
                        "Structured response"
                      : String(value)}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <AttendanceReportDialog
        open={activeReport === "attendance-download"}
        onOpenChange={(open) => {
          if (!open) setActiveReport(null)
        }}
      />
    </div>
  )
}

export default AttendanceReportView
