"use client"

import * as React from "react"
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { SearchToggleField } from "@/components/common/search-toggle-field"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

import {
  createDepartment,
  deleteDepartment,
  listBranches,
  listDepartments,
  patchDepartment,
  type AdminRecord,
  type DepartmentsQueryParams,
} from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { env } from "@/lib/env"
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

  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
      const accessToken = (parsed.accessToken ?? parsed.access_token ?? "").trim()
      if (accessToken) {
        return accessToken
      }
    } catch {
      // Fall through to legacy key.
    }
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
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
  const actor = useDashboardActor()
  const actorPermissions = actor.permissionLabels
  const permissionsReady = actor.ready
  const canCreateDepartments = React.useMemo(
    () => permissionsReady && canPerformPermission(actorPermissions, "departments:create"),
    [actorPermissions, permissionsReady]
  )
  const canUpdateDepartments = React.useMemo(
    () => permissionsReady && canPerformPermission(actorPermissions, "departments:update"),
    [actorPermissions, permissionsReady]
  )
  const canDeleteDepartments = React.useMemo(
    () => permissionsReady && canPerformPermission(actorPermissions, "departments:delete"),
    [actorPermissions, permissionsReady]
  )
  const [query, setQuery] = React.useState(DEFAULT_QUERY)
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [, setTotalPages] = React.useState<number | null>(null)
  const [, setTotal] = React.useState<number | null>(null)

  const [openCreate, setOpenCreate] = React.useState(false)
  const [form, setForm] = React.useState<DepartmentForm>(emptyForm())
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [allDepartments, setAllDepartments] = React.useState<AdminRecord[]>([])
  const [pendingDelete, setPendingDelete] = React.useState<AdminRecord | null>(null)
  const debouncedSearch = useDebouncedValue(query.search, 350)

  const normalizedQuery = React.useMemo(
    () => ({
      ...query,
      search: debouncedSearch,
      status: query.status || undefined,
      branch_id: query.branch_id > 0 ? query.branch_id : undefined,
      parent_id: query.parent_id > 0 ? query.parent_id : undefined,
    }),
    [debouncedSearch, query]
  )

  const fetchDepartments = React.useCallback(async (signal?: AbortSignal) => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listDepartments(
        token,
        {
          ...normalizedQuery,
          page,
        },
        {
          signal,
          cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
        }
      )
      setRows(result.rows)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (errorObject) {
      if (signal?.aborted) {
        return
      }
      setRows([])
      setTotalPages(null)
      setTotal(null)
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load departments.")
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [normalizedQuery, page])

  React.useEffect(() => {
    const controller = new AbortController()
    void fetchDepartments(controller.signal)
    return () => controller.abort()
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
    }, { cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS })
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
    }, { cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS })
      .then((result) => setAllDepartments(result.rows))
      .catch(() => setAllDepartments([]))
  }, [])

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
    if (editingId === null && !canCreateDepartments) {
      setError("You do not have permission to create departments.")
      return
    }
    if (editingId !== null && !canUpdateDepartments) {
      setError("You do not have permission to update departments.")
      return
    }

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
    if (!canDeleteDepartments) {
      setError("You do not have permission to delete departments.")
      return
    }

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

  const departmentColumns: Column<AdminRecord>[] = [
    { key: "name", label: "Name", defaultWidth: 120, sortable: true, render: (r) => readString(r, ["name"]) },
    { key: "code", label: "Code", defaultWidth: 60, sortable: true, render: (r) => readString(r, ["code"]) },
    { key: "branch", label: "Branch", defaultWidth: 80, render: (r) => branchName(readNumber(r, ["branch_id"])) },
    { key: "parent", label: "Parent", defaultWidth: 80, render: (r) => departmentName(readNumber(r, ["parent_id"])) },
    { key: "status", label: "Status", defaultWidth: 60, sortable: true, render: (r) => readString(r, ["status"]) },
    {
      key: "actions",
      label: "Actions",
      defaultWidth: 60,
      sortable: false,
      render: (row) => {
        const id = readNumber(row, ["id"])
        return (
          <div className="flex justify-end gap-1 pr-1" onClick={(e) => e.stopPropagation()}>
            {canUpdateDepartments ? (
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
            ) : null}
            {canDeleteDepartments ? (
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
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <SearchToggleField
          className="min-w-0"
          placeholder="Search department"
          value={query.search}
          onChange={(value) => {
            setPage(1)
            setQuery((previous) => ({ ...previous, search: value }))
          }}
        />
        <select
          className="h-8 min-w-[8rem] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
          value={query.status}
          onChange={(event) => {
            setPage(1)
            setQuery((previous) => ({ ...previous, status: event.target.value }))
          }}
          aria-label="Filter department status"
        >
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <div className="ml-auto flex items-center gap-1.5">
          {canCreateDepartments ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white transition hover:brightness-95 disabled:opacity-60"
              onClick={() => {
                setEditingId(null)
                setForm(emptyForm())
                setOpenCreate(true)
              }}
              aria-label="Add department"
              title="Add department"
            >
              <Plus className="size-3.5" />
              Add Department
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-primary transition hover:bg-slate-50 disabled:opacity-60"
            onClick={() => void fetchDepartments()}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <ResizableTable
        title="Department"
        data={rows}
        columns={departmentColumns}
        itemsPerPage={20}
        loading={loading}
        storageKey="departments"
      />

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
                <Textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
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
              <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white" disabled={saving} onClick={() => void submitForm()}>
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
