"use client"

import * as React from "react"

import { listEmployees, type AdminRecord, type EmployeesQueryParams } from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
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

export function EmployeesListView() {
  const [query, setQuery] = React.useState(DEFAULT_QUERY)
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState<number | null>(null)
  const [total, setTotal] = React.useState<number | null>(null)

  const fetchEmployees = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listEmployees(token, {
        ...query,
        page,
        employment_status: query.employment_status || undefined,
        branch_id: query.branch_id > 0 ? query.branch_id : undefined,
        department_id: query.department_id > 0 ? query.department_id : undefined,
        position_id: query.position_id > 0 ? query.position_id : undefined,
      })
      setRows(result.rows)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (errorObject) {
      setRows([])
      setTotalPages(null)
      setTotal(null)
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load employees.")
    } finally {
      setLoading(false)
    }
  }, [page, query])

  React.useEffect(() => {
    void fetchEmployees()
  }, [fetchEmployees])

  const canGoPrevious = page > 1 && !loading
  const canGoNext = !loading && (totalPages === null || page < totalPages)

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm lg:px-6">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Search</label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search name, email, phone, user_no"
            value={query.search}
            onChange={(event) => {
              setPage(1)
              setQuery((previous) => ({ ...previous, search: event.target.value }))
            }}
          />
        </div>
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
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Employee No</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Email</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Phone</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => (
              <tr key={String(row.id ?? row.user_id ?? row.employee_id ?? index)}>
                <td className="px-3 py-2">{readString(row, ["employee_no", "user_no", "employeeNo"])}</td>
                <td className="px-3 py-2">
                  {readString(row, ["full_name", "fullName", "name"]) !== "-"
                    ? readString(row, ["full_name", "fullName", "name"])
                    : `${readString(row, ["first_name", "firstName"])} ${readString(row, ["last_name", "lastName"])}`.trim()}
                </td>
                <td className="px-3 py-2">{readString(row, ["email"])}</td>
                <td className="px-3 py-2">{readString(row, ["phone", "phone_number"])}</td>
                <td className="px-3 py-2">{readString(row, ["employment_status", "status"])}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                  No employees found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {loading ? "Loading employees..." : `Page ${page}${totalPages ? ` of ${totalPages}` : ""}`}
          {typeof total === "number" ? ` • Total ${total}` : ""}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={!canGoPrevious}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={!canGoNext}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  )
}
