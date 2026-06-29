"use client"

import * as React from "react"
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { SearchToggleField } from "@/components/common/search-toggle-field"
import { TableScrollContainer } from "@/components/common/table-scroll-container"

import {
  createDepartment,
  deleteDepartment,
  listBranches,
  listDepartments,
  patchDepartment,
  type AdminRecord,
  type DepartmentsQueryParams,
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

const DEFAULT_QUERY: Required<Omit<DepartmentsQueryParams, "status">> & {
  status: string
} = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC",
  search: "",
  status: "",
  branch_id: 0,
  parent_id: 0,
}

type DepartmentForm = {
  name: string
  description: string
  status: string
  branch_id: string
  parent_id: string
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

function emptyForm(): DepartmentForm {
  return {
    name: "",
    description: "",
    status: "active",
    branch_id: "",
    parent_id: "",
  }
}

export function DepartmentsView() {
  const [query, setQuery] = React.useState(DEFAULT_QUERY)
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState<number | null>(null)
  const [total, setTotal] = React.useState<number | null>(null)

  const [openCreate, setOpenCreate] = React.useState(false)
  const [form, setForm] = React.useState<DepartmentForm>(emptyForm())
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [allDepartments, setAllDepartments] = React.useState<AdminRecord[]>([])
  const [pendingDelete, setPendingDelete] = React.useState<AdminRecord | null>(null)

  const fetchDepartments = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listDepartments(token, {
        ...query,
        page,
        status: query.status || undefined,
        branch_id: query.branch_id > 0 ? query.branch_id : undefined,
        parent_id: query.parent_id > 0 ? query.parent_id : undefined,
      })
      setRows(result.rows)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (errorObject) {
      setRows([])
      setTotalPages(null)
      setTotal(null)
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load departments.")
    } finally {
      setLoading(false)
    }
  }, [page, query])

  React.useEffect(() => {
    void fetchDepartments()
  }, [fetchDepartments])

  React.useEffect(() => {
    const token = readStoredToken()
    if (!token) {
      return
    }
    void listBranches(token, {
      page: 1,
      limit: 100,
      sortBy: "created_at",
      sortOrder: "DESC",
      status: "active",
    })
      .then((result) => setBranches(result.rows))
      .catch(() => setBranches([]))
  }, [])

  React.useEffect(() => {
    const token = readStoredToken()
    if (!token) {
      return
    }
    void listDepartments(token, {
      page: 1,
      limit: 100,
      sortBy: "created_at",
      sortOrder: "DESC",
    })
      .then((result) => setAllDepartments(result.rows))
      .catch(() => setAllDepartments([]))
  }, [])

  const canGoPrevious = page > 1 && !loading
  const canGoNext = !loading && (totalPages === null || page < totalPages)

  function fillFormFromRow(row: AdminRecord) {
    setForm({
      name: readString(row, ["name"]),
      description: readString(row, ["description"]),
      status: readString(row, ["status"]) === "-" ? "active" : readString(row, ["status"]),
      branch_id: String(readNumber(row, ["branch_id"]) ?? ""),
      parent_id: String(readNumber(row, ["parent_id"]) ?? ""),
    })
  }

  function branchName(branchId: number | null) {
    if (branchId === null) {
      return "-"
    }
    const match = branches.find((branch) => readNumber(branch, ["id"]) === branchId)
    if (!match) {
      return String(branchId)
    }
    return readString(match, ["name", "code"])
  }

  function departmentName(departmentId: number | null) {
    if (departmentId === null) {
      return "-"
    }
    const match = allDepartments.find((department) => readNumber(department, ["id"]) === departmentId)
    if (!match) {
      return String(departmentId)
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
      description: form.description.trim(),
      status: form.status || "active",
      branch_id: form.branch_id.trim() ? Number(form.branch_id) : 0,
      parent_id: form.parent_id.trim() ? Number(form.parent_id) : undefined,
    }

    setSaving(true)
    setError(null)
    try {
      if (editingId === null) {
        await createDepartment(token, payload)
      } else {
        await patchDepartment(token, editingId, payload)
      }
      setOpenCreate(false)
      setEditingId(null)
      setForm(emptyForm())
      await fetchDepartments()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to save department.")
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
      await deleteDepartment(token, id)
      await fetchDepartments()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to delete department.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-data-surface">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-slate-900">
            Department Management
          </h2>
          <p className="mt-2 text-sm text-slate-500">Departments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-60"
            onClick={() => {
              setEditingId(null)
              setForm(emptyForm())
              setOpenCreate(true)
            }}
            aria-label="Add department"
            title="Add department"
          >
            <Plus className="size-5" />
          </button>
          <button
            type="button"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-primary transition hover:bg-slate-50 disabled:opacity-60"
            onClick={() => void fetchDepartments()}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`size-5 text-primary ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
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
        <SearchToggleField
          className="min-w-[220px]"
          placeholder="Search department"
          value={query.search}
          onChange={(value) => {
            setPage(1)
            setQuery((previous) => ({ ...previous, search: value }))
          }}
        />
      </div>

      {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

      <TableScrollContainer>
        <table className="admin-table-compact min-w-[720px]">
          <thead>
            <tr>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Name</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Code</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Branch</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Parent</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Status</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const id = readNumber(row, ["id"])
              return (
                <tr key={String(id ?? index)}>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["name"])}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["code"])}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{branchName(readNumber(row, ["branch_id"]))}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{departmentName(readNumber(row, ["parent_id"]))}</td>
                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["status"])}</td>
                  <td className="text-right">
                    <div className="table-actions">
                      <button
                        type="button"
                        className="admin-table-icon-button"
                        onClick={() => {
                          fillFormFromRow(row)
                          setEditingId(id)
                          setOpenCreate(true)
                        }}
                        aria-label="Edit department"
                        title="Edit department"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="admin-table-icon-button"
                        data-variant="danger"
                        disabled={saving}
                        onClick={() => setPendingDelete(row)}
                        aria-label="Delete department"
                        title="Delete department"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="py-10 text-center text-sm text-slate-500" colSpan={6}>
                  No departments found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableScrollContainer>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {loading ? "Loading departments..." : `Page ${page}${totalPages ? ` of ${totalPages}` : ""}`}
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

      {openCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">{editingId === null ? "Add" : "Edit"} Department</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch</span>
                <select
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={form.branch_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value }))}
                >
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
              <label className="grid gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
                <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parent Department</span>
                <select
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={form.parent_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, parent_id: event.target.value }))}
                >
                  <option value="">No parent</option>
                  {allDepartments
                    .filter((department) => {
                      const id = readNumber(department, ["id"])
                      return id !== null && (editingId === null || id !== editingId)
                    })
                    .map((department) => {
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
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setOpenCreate(false)}>
                Cancel
              </button>
              <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" disabled={saving} onClick={() => void submitForm()}>
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
              Are you sure you want to delete this department? This action cannot be undone.
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
