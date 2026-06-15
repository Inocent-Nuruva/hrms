"use client"

import * as React from "react"
import { TableScrollContainer } from "@/components/common/table-scroll-container"

import {
  createPosition,
  deletePosition,
  listBranches,
  listDepartments,
  listDesignations,
  listPositions,
  patchPosition,
  type AdminRecord,
  type PositionsQueryParams,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
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

const DEFAULT_QUERY: Required<Omit<PositionsQueryParams, "status" | "department_id">> & {
  status: string
  department_id: number
} = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC",
  search: "",
  status: "",
  department_id: 0,
}

type PositionForm = {
  name: string
  code: string
  description: string
  status: string
  branch_id: string
  department_id: string
  designation_id: string
  reports_to_position_id: string
  level: string
  is_manager: string
  headcount: string
  is_active: string
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

function emptyForm(): PositionForm {
  return {
    name: "",
    code: "",
    description: "",
    status: "active",
    branch_id: "",
    department_id: "",
    designation_id: "",
    reports_to_position_id: "",
    level: "1",
    is_manager: "false",
    headcount: "1",
    is_active: "true",
  }
}

export function PositionsView() {
  const [query, setQuery] = React.useState(DEFAULT_QUERY)
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [designations, setDesignations] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState<number | null>(null)
  const [total, setTotal] = React.useState<number | null>(null)

  const [openForm, setOpenForm] = React.useState(false)
  const [form, setForm] = React.useState<PositionForm>(emptyForm())
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<AdminRecord | null>(null)

  const fetchPositions = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listPositions(token, {
        ...query,
        page,
        status: query.status || undefined,
        department_id: query.department_id > 0 ? query.department_id : undefined,
      })
      setRows(result.rows)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (errorObject) {
      setRows([])
      setTotalPages(null)
      setTotal(null)
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load positions.")
    } finally {
      setLoading(false)
    }
  }, [page, query])

  React.useEffect(() => {
    void fetchPositions()
  }, [fetchPositions])

  React.useEffect(() => {
    const token = readStoredToken()
    if (!token) {
      return
    }

    void Promise.all([
      listBranches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
      listDepartments(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
      listDesignations(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
    ])
      .then(([branchResult, departmentResult, designationResult]) => {
        setBranches(branchResult.rows)
        setDepartments(departmentResult.rows)
        setDesignations(designationResult.rows)
      })
      .catch(() => {
        setBranches([])
        setDepartments([])
        setDesignations([])
      })
  }, [])

  const canGoPrevious = page > 1 && !loading
  const canGoNext = !loading && (totalPages === null || page < totalPages)

  function fillFormFromRow(row: AdminRecord) {
    setForm({
      name: readString(row, ["name"]),
      code: readString(row, ["code"]),
      description: readString(row, ["description"]),
      status: readString(row, ["status"]) === "-" ? "active" : readString(row, ["status"]),
      branch_id: String(readNumber(row, ["branch_id"]) ?? ""),
      department_id: String(readNumber(row, ["department_id"]) ?? ""),
      designation_id: String(readNumber(row, ["designation_id"]) ?? ""),
      reports_to_position_id: String(readNumber(row, ["reports_to_position_id"]) ?? ""),
      level: String(readNumber(row, ["level"]) ?? 1),
      is_manager: String(readBoolean(row, ["is_manager"])),
      headcount: String(readNumber(row, ["headcount"]) ?? 1),
      is_active: String(readBoolean(row, ["is_active"])),
    })
  }

  function labelById(list: AdminRecord[], id: number | null) {
    if (id === null) {
      return "-"
    }
    const match = list.find((row) => readNumber(row, ["id"]) === id)
    if (!match) {
      return String(id)
    }
    return readString(match, ["name", "code"])
  }

  async function submitForm() {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    const payload: AdminRecord = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim(),
      status: form.status || "active",
      branch_id: form.branch_id.trim() ? Number(form.branch_id) : 0,
      department_id: form.department_id.trim() ? Number(form.department_id) : 0,
      designation_id: form.designation_id.trim() ? Number(form.designation_id) : 0,
      reports_to_position_id: form.reports_to_position_id.trim() ? Number(form.reports_to_position_id) : 0,
      level: Math.min(100, Math.max(1, Number(form.level || "1"))),
      is_manager: form.is_manager === "true",
      headcount: Math.max(1, Number(form.headcount || "1")),
      is_active: form.is_active === "true",
    }

    setSaving(true)
    setError(null)
    try {
      if (editingId === null) {
        await createPosition(token, payload)
      } else {
        await patchPosition(token, editingId, payload)
      }
      setOpenForm(false)
      setEditingId(null)
      setForm(emptyForm())
      await fetchPositions()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to save position.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await deletePosition(token, id)
      await fetchPositions()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to delete position.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm lg:px-6">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Search</label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search position"
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
            value={query.status}
            onChange={(event) => {
              setPage(1)
              setQuery((previous) => ({ ...previous, status: event.target.value }))
            }}
          >
            <option value="">All</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={query.department_id === 0 ? "" : String(query.department_id)}
            onChange={(event) => {
              setPage(1)
              setQuery((previous) => ({
                ...previous,
                department_id: event.target.value ? Number(event.target.value) : 0,
              }))
            }}
          >
            <option value="">All</option>
            {departments.map((department) => {
              const id = readNumber(department, ["id"])
              if (id === null) {
                return null
              }
              return (
                <option key={id} value={String(id)}>
                  {readString(department, ["name"])}
                </option>
              )
            })}
          </select>
        </div>
        <button
          type="button"
          className="rounded-md bg-[var(--sidebar-active-link-color)] px-3 py-2 text-sm font-medium text-white transition hover:brightness-95"
          onClick={() => {
            setEditingId(null)
            setForm(emptyForm())
            setOpenForm(true)
          }}
        >
          Add Position
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

      <TableScrollContainer>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50/90">
            <tr>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Name</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Code</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Department</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Designation</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Level</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Headcount</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Manager</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Status</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="[&_tr:nth-child(odd)]:bg-slate-50/35 [&_tr]:border-t [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/80">
            {rows.map((row, index) => {
              const id = readNumber(row, ["id"])
              return (
                <tr key={String(id ?? index)}>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["name"])}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["code"])}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{labelById(departments, readNumber(row, ["department_id"]))}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{labelById(designations, readNumber(row, ["designation_id"]))}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{String(readNumber(row, ["level"]) ?? "-")}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{String(readNumber(row, ["headcount"]) ?? "-")}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readBoolean(row, ["is_manager"]) ? "Yes" : "No"}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["status"])}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        onClick={() => {
                          fillFormFromRow(row)
                          setEditingId(id)
                          setOpenForm(true)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700"
                        disabled={saving}
                        onClick={() => setPendingDelete(row)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={9}>
                  No positions found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableScrollContainer>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {loading ? "Loading positions..." : `Page ${page}${totalPages ? ` of ${totalPages}` : ""}`}
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

      {openForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">{editingId === null ? "Add" : "Edit"} Position</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Code</span>
                <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch</span>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.branch_id} onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value }))}>
                  <option value="">Select branch</option>
                  {branches.map((branch) => {
                    const id = readNumber(branch, ["id"])
                    if (id === null) {
                      return null
                    }
                    return (
                      <option key={id} value={String(id)}>
                        {readString(branch, ["name"])}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Department</span>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.department_id} onChange={(event) => setForm((prev) => ({ ...prev, department_id: event.target.value }))}>
                  <option value="">Select department</option>
                  {departments.map((department) => {
                    const id = readNumber(department, ["id"])
                    if (id === null) {
                      return null
                    }
                    return (
                      <option key={id} value={String(id)}>
                        {readString(department, ["name"])}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Designation</span>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.designation_id} onChange={(event) => setForm((prev) => ({ ...prev, designation_id: event.target.value }))}>
                  <option value="">Select designation</option>
                  {designations.map((designation) => {
                    const id = readNumber(designation, ["id"])
                    if (id === null) {
                      return null
                    }
                    return (
                      <option key={id} value={String(id)}>
                        {readString(designation, ["name"])}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reports To Position</span>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.reports_to_position_id} onChange={(event) => setForm((prev) => ({ ...prev, reports_to_position_id: event.target.value }))}>
                  <option value="">None</option>
                  {rows
                    .filter((row) => {
                      const id = readNumber(row, ["id"])
                      return id !== null && (editingId === null || id !== editingId)
                    })
                    .map((row) => {
                      const id = readNumber(row, ["id"])
                      if (id === null) {
                        return null
                      }
                      return (
                        <option key={id} value={String(id)}>
                          {readString(row, ["name", "code"])}
                        </option>
                      )
                    })}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Level</span>
                <input type="number" min={1} max={100} className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.level} onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Headcount</span>
                <input type="number" min={1} className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.headcount} onChange={(event) => setForm((prev) => ({ ...prev, headcount: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manager Position</span>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.is_manager} onChange={(event) => setForm((prev) => ({ ...prev, is_manager: event.target.value }))}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</span>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.value }))}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <label className="grid gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
                <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setOpenForm(false)}>
                Cancel
              </button>
              <button type="button" className="rounded-md bg-[var(--sidebar-active-link-color)] px-3 py-2 text-sm font-medium text-white transition hover:brightness-95" disabled={saving} onClick={() => void submitForm()}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this position? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingDelete) {
                  return
                }
                const row = pendingDelete
                setPendingDelete(null)
                await handleDelete(row)
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
