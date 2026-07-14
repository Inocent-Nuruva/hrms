"use client"

import * as React from "react"
import { ChartColumnIcon, ChevronRightIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  downloadAttendanceReport,
  listBranches,
  listDepartments,
  listEmployees,
  listShiftResources,
  listTimetableResources,
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

type ReportId = "attendance-download"

type ReportTone = "sky" | "emerald" | "amber" | "violet"

type ReportDefinition = {
  id: ReportId
  title: string
  description: string
  tone: ReportTone
  icon: React.ReactNode
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

export function AttendanceReportView() {
  const [activeReport, setActiveReport] = React.useState<ReportId | null>(null)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Choose a report to configure filters and download.
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
                      onClick={() => setActiveReport(report.id)}
                      className={cn(
                        "group flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-sm transition-all",
                        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                        tone.card
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
                          tone.icon
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
                          tone.chevron
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
