"use client"

import * as React from "react"
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { SearchToggleField } from "@/components/common/search-toggle-field"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

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
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
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
  const actor = useDashboardActor()
  const actorPermissions = actor.permissionLabels
  const permissionsReady = actor.ready
  const canCreatePositions = React.useMemo(
    () => permissionsReady && canPerformPermission(actorPermissions, "positions:create"),
    [actorPermissions, permissionsReady]
  )
  const canUpdatePositions = React.useMemo(
    () => permissionsReady && canPerformPermission(actorPermissions, "positions:update"),
    [actorPermissions, permissionsReady]
  )
  const canDeletePositions = React.useMemo(
    () => permissionsReady && canPerformPermission(actorPermissions, "positions:delete"),
    [actorPermissions, permissionsReady]
  )
  const [query, setQuery] = React.useState(DEFAULT_QUERY)
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [designations, setDesignations] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [, setTotalPages] = React.useState<number | null>(null)
  const [, setTotal] = React.useState<number | null>(null)

  const [openForm, setOpenForm] = React.useState(false)
  const [form, setForm] = React.useState<PositionForm>(emptyForm())
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

  const fetchPositions = React.useCallback(async (signal?: AbortSignal) => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listPositions(
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
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load positions.")
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [normalizedQuery, page])

  React.useEffect(() => {
    const controller = new AbortController()
    void fetchPositions(controller.signal)
    return () => controller.abort()
  }, [fetchPositions])

  React.useEffect(() => {
    const token = readStoredToken()
    if (!token) {
      return
    }

    void Promise.all([
      listBranches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }, { cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS }),
      listDepartments(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }, { cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS }),
      listDesignations(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }, { cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS }),
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
    if (editingId === null && !canCreatePositions) {
      setError("You do not have permission to create positions.")
      return
    }
    if (editingId !== null && !canUpdatePositions) {
      setError("You do not have permission to update positions.")
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
    if (!canDeletePositions) {
      setError("You do not have permission to delete positions.")
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
      await deletePosition(token, id)
      await fetchPositions()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to delete position.")
    } finally {
      setSaving(false)
    }
  }

  const positionColumns: Column<AdminRecord>[] = [
    { key: "name", label: "Name", defaultWidth: 100, sortable: true, render: (r) => readString(r, ["name"]) },
    { key: "code", label: "Code", defaultWidth: 50, sortable: true, render: (r) => readString(r, ["code"]) },
    { key: "department", label: "Dept", defaultWidth: 75, render: (r) => labelById(departments, readNumber(r, ["department_id"])) },
    { key: "designation", label: "Desig", defaultWidth: 70, render: (r) => labelById(designations, readNumber(r, ["designation_id"])) },
    { key: "level", label: "Lvl", defaultWidth: 40, sortable: true, render: (r) => String(readNumber(r, ["level"]) ?? "-") },
    { key: "headcount", label: "HC", defaultWidth: 45, sortable: true, render: (r) => String(readNumber(r, ["headcount"]) ?? "-") },
    { key: "manager", label: "Mgr", defaultWidth: 40, render: (r) => (readBoolean(r, ["is_manager"]) ? "Y" : "N") },
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
            {canUpdatePositions ? (
              <button
                type="button"
                className="admin-table-icon-button"
                onClick={() => {
                  fillFormFromRow(row)
                  setEditingId(id)
                  setOpenForm(true)
                }}
                aria-label="Edit position"
                title="Edit position"
              >
                <Pencil className="size-4" />
              </button>
            ) : null}
            {canDeletePositions ? (
              <button
                type="button"
                className="admin-table-icon-button"
                data-variant="danger"
                disabled={saving}
                onClick={() => setPendingDelete(row)}
                aria-label="Delete position"
                title="Delete position"
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
          placeholder="Search position"
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
          aria-label="Filter position status"
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
          {canCreatePositions ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white transition hover:brightness-95 disabled:opacity-60"
              onClick={() => {
                setEditingId(null)
                setForm(emptyForm())
                setOpenForm(true)
              }}
              aria-label="Add position"
              title="Add position"
            >
              <Plus className="size-3.5" />
              Add Position
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-primary transition hover:bg-slate-50 disabled:opacity-60"
            onClick={() => void fetchPositions()}
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
        title="Position"
        data={rows}
        columns={positionColumns}
        itemsPerPage={20}
        loading={loading}
        storageKey="positions"
      />

      {openForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/35 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-lg max-sm:min-h-[calc(100svh-1.5rem)] sm:max-h-[min(92svh,860px)]">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <h3 className="text-lg font-semibold text-slate-900">{editingId === null ? "Add" : "Edit"} Position</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="grid gap-3 md:grid-cols-2">
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
                <Textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
            </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-4 sm:px-5">
              <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setOpenForm(false)}>
                Cancel
              </button>
              <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white transition hover:brightness-95 disabled:opacity-60" disabled={saving} onClick={() => void submitForm()}>
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
