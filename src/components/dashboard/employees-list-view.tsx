"use client"

import * as React from "react"
import { TableScrollContainer } from "@/components/common/table-scroll-container"
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
import { listEmployees, type AdminRecord, type EmployeesQueryParams } from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const EMPLOYEE_STATUS_REFRESH_KEY = "hrms.employees.status.updatedAt"
const EMPLOYEE_STATUS_REFRESH_EVENT = "hrms:employee-status-updated"
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

function asRecordArray(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry) => typeof entry === "object" && entry !== null) as AdminRecord[]
}

function getPrimaryContact(row: AdminRecord) {
  const contacts = asRecordArray(row.contacts)
  if (contacts.length === 0) {
    return { email: "-", phone: "-" }
  }

  const primary = contacts.find((contact) => contact.is_primary === true) ?? contacts[0]
  if (!primary) {
    return { email: "-", phone: "-" }
  }

  return {
    email: readString(primary, ["email"]),
    phone: readString(primary, ["phone_number", "phone"]),
  }
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

function missingProfileItems(row: AdminRecord) {
  return REQUIRED_PROFILE_ITEMS.filter((item) => asRecordArray(row[item.key]).length === 0)
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

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const onFocus = () => {
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

  const openEmployeeDetails = (row: AdminRecord) => {
    const employeeNo = readString(row, ["employee_no", "user_no", "employeeNo"])
    if (employeeNo === "-") {
      return
    }
    router.push(`/dashboard/employees/profile/${encodeURIComponent(employeeNo)}`)
  }

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

      <TableScrollContainer>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50/90">
            <tr>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Employee No</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Name</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Email</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Phone</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white [&_tr:nth-child(odd)]:bg-slate-50/35 [&_tr]:border-t [&_tr]:border-slate-100 [&_tr]:transition-colors [&_tr]:hover:bg-slate-50">
            {rows.map((row, index) => {
              const primaryContact = getPrimaryContact(row)
              const employeeNo = readString(row, ["employee_no", "user_no", "employeeNo"])
              const missingItems = missingProfileItems(row)
              return (
                <tr
                  key={String(row.id ?? row.user_id ?? row.employee_id ?? index)}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => openEmployeeDetails(row)}
                >
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      className="font-medium text-slate-800 hover:text-slate-950"
                      onClick={(event) => {
                        event.stopPropagation()
                        openEmployeeDetails(row)
                      }}
                    >
                      {employeeNo}
                    </button>
                    <button
                      type="button"
                      className="mt-1 block text-left text-xs font-semibold text-red-200 hover:text-red-300"
                      onClick={(event) => {
                        event.stopPropagation()
                        setMissingDialog({
                          employeeNo,
                          missing: missingItems,
                        })
                      }}
                    >
                      {missingItems.length} out of {REQUIRED_PROFILE_ITEMS.length} incomplete
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">{employeeDisplayName(row)}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{primaryContact.email}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{primaryContact.phone}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{readString(row, ["employment_status", "status"])}</td>
                </tr>
              )
            })}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-slate-500" colSpan={5}>
                  No employees found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableScrollContainer>

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
                      router.push(`/dashboard/employees/profile/${encodeURIComponent(missingDialog.employeeNo)}`)
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
