"use client"

import * as React from "react"
import { SearchToggleField } from "@/components/common/search-toggle-field"
import { useRouter } from "next/navigation"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ResizableTable } from "@/components/ui/resizable-table"
import { listEmployees, type AdminRecord, type EmployeesQueryParams } from "@/lib/admin-api"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useRenderDiagnostics } from "@/hooks/use-render-diagnostics"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const EMPLOYEE_STATUS_REFRESH_KEY = "hrms.employees.status.updatedAt"
const EMPLOYEE_STATUS_REFRESH_EVENT = "hrms:employee-status-updated"
const EMPLOYEE_LIST_CACHE_PREFIX = "hrms.employees.list"
const EMPLOYEE_LIST_CACHE_TTL_MS = 60_000
const DEFAULT_QUERY: Required<Omit<EmployeesQueryParams, "employment_status">> & {
  employment_status: "" | NonNullable<EmployeesQueryParams["employment_status"]>
} = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC",
  search: "",
  employment_status: "",
  branch_id: 0,
  department_id: 0,
  position_id: 0,
}

type EmployeeListSnapshot = {
  rows: AdminRecord[]
  totalPages: number | null
  total: number | null
  cachedAt: number
}

const employeeListSnapshotCache = new Map<string, EmployeeListSnapshot>()

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

function asRecordArray(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry) => typeof entry === "object" && entry !== null) as AdminRecord[]
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
}

function readNestedName(value: unknown) {
  const record = asRecord(value)
  if (!record) {
    return "—"
  }
  return readString(record, ["name"])
}



function employeeDisplayName(row: AdminRecord) {
  const named = readString(row, ["full_name", "fullName", "name"])
  if (named !== "-") {
    return named
  }
  const first = readString(row, ["first_name", "firstName"])
  const middle = readString(row, ["middle_name", "middleName"])
  const last = readString(row, ["last_name", "lastName"])
  return [first, middle, last].filter((part) => part !== "-").join(" ").trim() || "-"
}

const REQUIRED_PROFILE_ITEMS: Array<{ key: string; label: string }> = [
  { key: "contacts", label: "Contacts" },
  { key: "addresses", label: "Addresses" },
  { key: "relatives", label: "Relatives" },
  { key: "identifications", label: "Identifications" },
  { key: "bank_accounts", label: "Bank Accounts" },
  { key: "departments", label: "Departments" },
  { key: "academic_qualifications", label: "Academic Qualifications" },
  { key: "professional_qualifications", label: "Professional Qualifications" },
  { key: "experience_details", label: "Experience Details" },
  { key: "documents", label: "Documents" },
]

function employeeProfileHref(employeeNo: string, missingItemKey?: string) {
  const params = new URLSearchParams()
  if (missingItemKey) {
    params.set("missing", missingItemKey)
  }
  const query = params.toString()
  const basePath = `/dashboard/employees/profile/${encodeURIComponent(employeeNo)}`
  return query ? `${basePath}?${query}` : basePath
}

function missingProfileItems(row: AdminRecord) {
  return REQUIRED_PROFILE_ITEMS.filter((item) => asRecordArray(row[item.key]).length === 0)
}

function readSnapshot(cacheKey: string) {
  const inMemory = employeeListSnapshotCache.get(cacheKey)
  if (inMemory && Date.now() - inMemory.cachedAt < EMPLOYEE_LIST_CACHE_TTL_MS) {
    return inMemory
  }

  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(`${EMPLOYEE_LIST_CACHE_PREFIX}:${cacheKey}`)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as EmployeeListSnapshot
    if (Date.now() - parsed.cachedAt > EMPLOYEE_LIST_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(`${EMPLOYEE_LIST_CACHE_PREFIX}:${cacheKey}`)
      return null
    }
    employeeListSnapshotCache.set(cacheKey, parsed)
    return parsed
  } catch {
    return null
  }
}

function writeSnapshot(cacheKey: string, snapshot: EmployeeListSnapshot) {
  employeeListSnapshotCache.set(cacheKey, snapshot)

  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.setItem(
      `${EMPLOYEE_LIST_CACHE_PREFIX}:${cacheKey}`,
      JSON.stringify(snapshot)
    )
  } catch {}
}



export function EmployeesListView() {
  const router = useRouter()
  const [query, setQuery] = React.useState(DEFAULT_QUERY)
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState<number | null>(null)
  const [total, setTotal] = React.useState<number | null>(null)
  const [missingDialog, setMissingDialog] = React.useState<{ employeeNo: string; missing: Array<{ key: string; label: string }> } | null>(null)
  const debouncedSearch = useDebouncedValue(query.search, 350)
  const lastFetchAtRef = React.useRef(0)

  useRenderDiagnostics("EmployeesListView", {
    page,
    search: query.search,
    rows: rows.length,
    loading,
  })

  const normalizedQuery = React.useMemo(
    () => ({
      ...query,
      search: debouncedSearch,
      employment_status: query.employment_status || undefined,
      branch_id: query.branch_id > 0 ? query.branch_id : undefined,
      department_id: query.department_id > 0 ? query.department_id : undefined,
      position_id: query.position_id > 0 ? query.position_id : undefined,
    }),
    [debouncedSearch, query]
  )
  const queryCacheKey = React.useMemo(
    () => JSON.stringify({ ...normalizedQuery, page }),
    [normalizedQuery, page]
  )

  React.useLayoutEffect(() => {
    const snapshot = readSnapshot(queryCacheKey)
    if (!snapshot) {
      return
    }

    setRows(snapshot.rows)
    setTotalPages(snapshot.totalPages)
    setTotal(snapshot.total)
  }, [queryCacheKey])

  const fetchEmployees = React.useCallback(async (signal?: AbortSignal) => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listEmployees(
        token,
        {
          ...normalizedQuery,
          page,
        },
        {
          signal,
          cacheTtlMs: 20_000,
        }
      )
      lastFetchAtRef.current = Date.now()
      writeSnapshot(queryCacheKey, {
        rows: result.rows,
        totalPages: result.totalPages,
        total: result.total,
        cachedAt: Date.now(),
      })
      setRows(result.rows)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (errorObject) {
      if (signal?.aborted) {
        return
      }
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load employees.")
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [normalizedQuery, page, queryCacheKey])

  React.useEffect(() => {
    const controller = new AbortController()
    void fetchEmployees(controller.signal)
    return () => controller.abort()
  }, [fetchEmployees])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const onFocus = () => {
      if (Date.now() - lastFetchAtRef.current < 15_000) {
        return
      }
      void fetchEmployees()
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === EMPLOYEE_STATUS_REFRESH_KEY) {
        void fetchEmployees()
      }
    }

    window.addEventListener("focus", onFocus)
    window.addEventListener("storage", onStorage)
    window.addEventListener(EMPLOYEE_STATUS_REFRESH_EVENT, onFocus)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(EMPLOYEE_STATUS_REFRESH_EVENT, onFocus)
    }
  }, [fetchEmployees])

  const canGoPrevious = page > 1 && !loading
  const canGoNext = !loading && (totalPages === null || page < totalPages)

  const openEmployeeDetails = (row: AdminRecord, missingItemKey?: string) => {
    const employeeNo = readString(row, ["employee_no", "user_no", "employeeNo"])
    if (employeeNo === "-") {
      return
    }
    router.push(employeeProfileHref(employeeNo, missingItemKey))
  }

  const handleEmployeeSelect = (employeeId: string) => {
    const matched = rows.find((r) => {
      const id = String(r.id ?? r.employee_id ?? r.employee_no ?? "")
      return id === employeeId
    })
    if (matched) {
      openEmployeeDetails(matched)
    }
  }

  const employeeColumns = React.useMemo(() => [
    {
      key: "employee_no",
      label: "No",
      defaultWidth: 80,
      sortable: true,
      render: (row: AdminRecord) => readString(row, ["employee_no", "user_no"])
    },
    {
      key: "name",
      label: "Name",
      defaultWidth: 120,
      sortable: true,
      render: (row: AdminRecord) => employeeDisplayName(row)
    },
    {
      key: "department",
      label: "Dept",
      defaultWidth: 90,
      sortable: true,
      render: (row: AdminRecord) => readNestedName(row.primary_department)
    },
    {
      key: "position",
      label: "Position",
      defaultWidth: 100,
      sortable: true,
      render: (row: AdminRecord) => {
        const primaryPositionName = readNestedName(row.primary_position)
        if (primaryPositionName !== "—") {
          return primaryPositionName
        }
        return readNestedName(row.position)
      }
    },
    {
      key: "hireDate",
      label: "Hired",
      defaultWidth: 70,
      sortable: true,
      render: (row: AdminRecord) => {
        const raw = readString(row, ["hire_date", "hired_at", "joined_at", "join_date", "created_at"])
        return raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw : "—"
      }
    },
    {
      key: "status",
      label: "Status",
      defaultWidth: 70,
      sortable: true,
      render: (row: AdminRecord) => {
        const s = (readString(row, ["employment_status", "status"]) || "active").toLowerCase()
        const display = s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")
        const isActive = s === "active" || s === "onboarding"
        return (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {display}
          </span>
        )
      }
    },
  ], [])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={query.employment_status}
            onChange={(event) => {
              setPage(1)
              setQuery((previous) => ({
                ...previous,
                employment_status: event.target.value as typeof previous.employment_status,
              }))
            }}
          >
            <option value="">All</option>
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
            <option value="exited">Exited</option>
          </select>
        </div>
        <SearchToggleField
          className="min-w-[220px]"
          placeholder="Search name, email, phone, user_no"
          value={query.search}
          onChange={(value) => {
            setPage(1)
            setQuery((previous) => ({ ...previous, search: value }))
          }}
        />
      </div>

      {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

      <ResizableTable
        title="Employees"
        data={rows}
        columns={employeeColumns as any}
        onRowSelect={(id, row) => {
          if (row) openEmployeeDetails(row as AdminRecord)
        }}
        loading={loading}
        storageKey="employees"
        enableAnimations={false}
      />

      <AlertDialog
        open={Boolean(missingDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setMissingDialog(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Incomplete Profile Items</AlertDialogTitle>
            <AlertDialogDescription>
              {missingDialog
                ? `${missingDialog.employeeNo} has ${missingDialog.missing.length} incomplete item(s).`
                : "Incomplete profile details."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {missingDialog && missingDialog.missing.length > 0 ? (
            <div className="space-y-2">
              {missingDialog.missing.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-md border border-slate-200 p-2">
                  <span className="text-sm text-slate-800">{item.label}</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    onClick={() => {
                      router.push(employeeProfileHref(missingDialog.employeeNo, item.key))
                    }}
                  >
                    Open profile
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-700">All required items are completed.</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
