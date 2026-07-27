"use client"

import * as React from "react"
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { SearchToggleField } from "@/components/common/search-toggle-field"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

import {
  createDesignation,
  deleteDesignation,
  listDepartments,
  listDesignations,
  patchDesignation,
  type AdminRecord,
  type DesignationsQueryParams,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
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

const DEFAULT_QUERY: Required<Omit<DesignationsQueryParams, "status" | "department_id">> & {
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

type DesignationForm = {
  name: string
  code: string
  description: string
  status: string
  department_id: string
  hierarchy_level: string
  grade_level: string
  is_managerial: string
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

function emptyForm(): DesignationForm {
  return {
    name: "",
    code: "",
    description: "",
    status: "active",
    department_id: "",
    hierarchy_level: "0",
    grade_level: "0",
    is_managerial: "false",
  }
}

export function DesignationsView() {
  const actor = useDashboardActor()
  const actorPermissions = actor.permissionLabels
  const permissionsReady = actor.ready
  const canCreateDesignations = React.useMemo(
    () => permissionsReady && canPerformPermission(actorPermissions, "designations:create"),
    [actorPermissions, permissionsReady]
  )
  const canUpdateDesignations = React.useMemo(
    () => permissionsReady && canPerformPermission(actorPermissions, "designations:update"),
    [actorPermissions, permissionsReady]
  )
  const canDeleteDesignations = React.useMemo(
    () => permissionsReady && canPerformPermission(actorPermissions, "designations:delete"),
    [actorPermissions, permissionsReady]
  )
  const [query, setQuery] = React.useState(DEFAULT_QUERY)
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [, setTotalPages] = React.useState<number | null>(null)
  const [, setTotal] = React.useState<number | null>(null)

  const [openForm, setOpenForm] = React.useState(false)
  const [form, setForm] = React.useState<DesignationForm>(emptyForm())
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<AdminRecord | null>(null)
  const debouncedSearch = useDebouncedValue(query.search, 350)

  const normalizedQuery = React.useMemo(
    () => ({
      ...query,
      search: debouncedSearch,
      status: query.status || undefined,
      department_id: query.department_id > 0 ? query.department_id : undefined,
    }),
    [debouncedSearch, query]
  )

  const fetchDesignations = React.useCallback(async (signal?: AbortSignal) => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listDesignations(
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
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load designations.")
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [normalizedQuery, page])

  React.useEffect(() => {
    const controller = new AbortController()
    void fetchDesignations(controller.signal)
    return () => controller.abort()
  }, [fetchDesignations])

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
    }, { cacheTtlMs: 60_000 })
      .then((result) => setDepartments(result.rows))
      .catch(() => setDepartments([]))
  }, [])

  function fillFormFromRow(row: AdminRecord) {
    setForm({
      name: readString(row, ["name"]),
      code: readString(row, ["code"]),
      description: readString(row, ["description"]),
      status: readString(row, ["status"]) === "-" ? "active" : readString(row, ["status"]),
      department_id: String(readNumber(row, ["department_id"]) ?? ""),
      hierarchy_level: String(readNumber(row, ["hierarchy_level"]) ?? 0),
      grade_level: String(readNumber(row, ["grade_level"]) ?? 0),
      is_managerial: String(readBoolean(row, ["is_managerial"])),
    })
  }

  function departmentName(departmentId: number | null) {
    if (departmentId === null) {
      return "-"
    }
    const match = departments.find((department) => readNumber(department, ["id"]) === departmentId)
    if (!match) {
      return String(departmentId)
    }
    return readString(match, ["name", "code"])
  }

  async function submitForm() {
    if (editingId === null && !canCreateDesignations) {
      setError("You do not have permission to create designations.")
      return
    }
    if (editingId !== null && !canUpdateDesignations) {
      setError("You do not have permission to update designations.")
      return
    }

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
      department_id: form.department_id.trim() ? Number(form.department_id) : 0,
      hierarchy_level: Number(form.hierarchy_level || "0"),
      grade_level: Number(form.grade_level || "0"),
      is_managerial: form.is_managerial === "true",
    }

    setSaving(true)
    setError(null)
    try {
      if (editingId === null) {
        await createDesignation(token, payload)
      } else {
        await patchDesignation(token, editingId, payload)
      }
      setOpenForm(false)
      setEditingId(null)
      setForm(emptyForm())
      await fetchDesignations()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to save designation.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row: AdminRecord) {
    if (!canDeleteDesignations) {
      setError("You do not have permission to delete designations.")
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
      await deleteDesignation(token, id)
      await fetchDesignations()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to delete designation.")
    } finally {
      setSaving(false)
    }
  }

  const designationColumns: Column<AdminRecord>[] = [
    { key: "name", label: "Name", defaultWidth: 100, sortable: true, render: (r) => readString(r, ["name"]) },
    { key: "code", label: "Code", defaultWidth: 50, sortable: true, render: (r) => readString(r, ["code"]) },
    { key: "department", label: "Dept", defaultWidth: 75, render: (r) => departmentName(readNumber(r, ["department_id"])) },
    { key: "hierarchy", label: "Hier", defaultWidth: 45, sortable: true, render: (r) => String(readNumber(r, ["hierarchy_level"]) ?? "-") },
    { key: "grade", label: "Grade", defaultWidth: 40, sortable: true, render: (r) => String(readNumber(r, ["grade_level"]) ?? "-") },
    { key: "managerial", label: "Mgr", defaultWidth: 45, render: (r) => (readBoolean(r, ["is_managerial"]) ? "Y" : "N") },
    { key: "status", label: "Status", defaultWidth: 50, sortable: true, render: (r) => readString(r, ["status"]) },
    {
      key: "actions",
      label: "Act",
      defaultWidth: 55,
      sortable: false,
      render: (row) => {
        const id = readNumber(row, ["id"])
        return (
          <div className="flex justify-end gap-1 pr-1" onClick={(e) => e.stopPropagation()}>
            {canUpdateDesignations ? (
              <button
                type="button"
                className="admin-table-icon-button"
                onClick={() => {
                  fillFormFromRow(row)
                  setEditingId(id)
                  setOpenForm(true)
                }}
                aria-label="Edit designation"
                title="Edit designation"
              >
                <Pencil className="size-4" />
              </button>
            ) : null}
            {canDeleteDesignations ? (
              <button
                type="button"
                className="admin-table-icon-button"
                data-variant="danger"
                disabled={saving}
                onClick={() => setPendingDelete(row)}
                aria-label="Delete designation"
                title="Delete designation"
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
          placeholder="Search designation"
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
          aria-label="Filter designation status"
        >
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <select
          className="h-8 min-w-[9rem] max-w-[12rem] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
          value={query.department_id === 0 ? "" : String(query.department_id)}
          onChange={(event) => {
            setPage(1)
            setQuery((previous) => ({
              ...previous,
              department_id: event.target.value ? Number(event.target.value) : 0,
            }))
          }}
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
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
        <div className="ml-auto flex items-center gap-1.5">
          {canCreateDesignations ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white transition hover:brightness-95 disabled:opacity-60"
              onClick={() => {
                setEditingId(null)
                setForm(emptyForm())
                setOpenForm(true)
              }}
              aria-label="Add designation"
              title="Add designation"
            >
              <Plus className="size-3.5" />
              Add Designation
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-primary transition hover:bg-slate-50 disabled:opacity-60"
            onClick={() => void fetchDesignations()}
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
        title="Designation"
        data={rows}
        columns={designationColumns}
        itemsPerPage={20}
        loading={loading}
        storageKey="designations"
      />

      {openForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">{editingId === null ? "Add" : "Edit"} Designation</h3>
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
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hierarchy Level</span>
                <input type="number" min={0} className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.hierarchy_level} onChange={(event) => setForm((prev) => ({ ...prev, hierarchy_level: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grade Level</span>
                <input type="number" min={0} className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.grade_level} onChange={(event) => setForm((prev) => ({ ...prev, grade_level: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Managerial</span>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.is_managerial} onChange={(event) => setForm((prev) => ({ ...prev, is_managerial: event.target.value }))}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
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
                <Textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setOpenForm(false)}>
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
              Are you sure you want to delete this designation? This action cannot be undone.
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
