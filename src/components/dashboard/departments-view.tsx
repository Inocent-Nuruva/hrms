"use client"

import * as React from "react"
import { KeyRound, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { SearchToggleField } from "@/components/common/search-toggle-field"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

import {
  assignDepartmentPosition,
  createDepartment,
  deleteDepartment,
  grantDepartmentAccess,
  listBranches,
  listDepartmentAccess,
  listDepartments,
  listDepartmentPositions,
  listPositions,
  listUsers,
  patchDepartment,
  removeDepartmentPosition,
  revokeDepartmentAccess,
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
  position_ids: string[]
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

function readPositionIds(row: AdminRecord) {
  const ids = new Set<number>()
  const directIds = Array.isArray(row.position_ids)
    ? row.position_ids
    : Array.isArray(row.positionIds)
      ? row.positionIds
      : []
  for (const value of directIds) {
    const id = typeof value === "number" ? value : Number(value)
    if (Number.isFinite(id)) ids.add(id)
  }
  const positions = Array.isArray(row.positions) ? row.positions : []
  for (const position of positions) {
    if (typeof position !== "object" || position === null) continue
    const record = position as AdminRecord
    const id = readNumber(record, ["position_id", "positionId", "id"])
    if (id !== null) ids.add(id)
  }
  return Array.from(ids)
}

function asRecord(value: unknown): AdminRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AdminRecord) : null
}

function readCreatedDepartmentId(payload: unknown): number | null {
  const root = asRecord(payload)
  const nested = asRecord(root?.data) ?? asRecord(root?.result)
  return readNumber(nested ?? root ?? {}, ["id", "department_id", "departmentId"])
}

async function syncDepartmentPositions(
  token: string,
  departmentId: number,
  nextIds: number[],
) {
  const assigned = await listDepartmentPositions(token, departmentId)
  const currentIds = assigned
    .map((position) => readNumber(position, ["position_id", "positionId", "id"]))
    .filter((id): id is number => id !== null)
  const currentSet = new Set(currentIds)
  const nextSet = new Set(nextIds)
  for (const positionId of nextIds) {
    if (!currentSet.has(positionId)) {
      await assignDepartmentPosition(token, departmentId, positionId)
    }
  }
  for (const positionId of currentIds) {
    if (!nextSet.has(positionId)) {
      await removeDepartmentPosition(token, departmentId, positionId)
    }
  }
}

function emptyForm(): DepartmentForm {
  return {
    name: "",
    description: "",
    status: "active",
    branch_id: "",
    parent_id: "",
    position_ids: [],
  }
}

function userLabel(row: AdminRecord) {
  const first = readString(row, ["first_name", "firstName"])
  const last = readString(row, ["last_name", "lastName"])
  const fullName = [first, last].filter((value) => value !== "-").join(" ").trim()
  const displayName = fullName || readString(row, ["name", "full_name", "display_name"])
  const email = readString(row, ["email"])
  if (displayName !== "-" && email !== "-") {
    return `${displayName} (${email})`
  }
  if (displayName !== "-") {
    return displayName
  }
  if (email !== "-") {
    return email
  }
  const id = readNumber(row, ["id", "user_id"])
  return id === null ? "Unknown user" : `User #${id}`
}

function accessUserName(row: AdminRecord, users: AdminRecord[]) {
  const direct = readString(row, [
    "name",
    "full_name",
    "display_name",
    "user_name",
    "username",
    "email",
  ])
  if (direct !== "-") {
    return direct
  }

  const user = (row.user ?? row.company_user ?? null) as AdminRecord | null
  if (user) {
    const nested = userLabel(user)
    if (nested !== "Unknown user") {
      return nested
    }
  }

  const userId = readNumber(row, ["user_id", "id"])
  if (userId === null) {
    return "-"
  }

  const matched = users.find((candidate) => {
    const id = readNumber(candidate, ["id", "user_id"])
    return id === userId
  })
  return matched ? userLabel(matched) : "-"
}

function accessRowUserId(row: AdminRecord) {
  const nestedUser = (row.user ?? row.company_user ?? null) as AdminRecord | null
  if (nestedUser) {
    const nestedId = readNumber(nestedUser, ["id", "user_id"])
    if (nestedId !== null) {
      return nestedId
    }
  }
  return readNumber(row, ["user_id"])
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

  const [openAccess, setOpenAccess] = React.useState(false)
  const [accessDepartment, setAccessDepartment] = React.useState<AdminRecord | null>(null)
  const [accessRows, setAccessRows] = React.useState<AdminRecord[]>([])
  const [accessError, setAccessError] = React.useState<string | null>(null)
  const [companyUsers, setCompanyUsers] = React.useState<AdminRecord[]>([])
  const [accessUserId, setAccessUserId] = React.useState<number | null>(null)
  const [accessUserIds, setAccessUserIds] = React.useState<number[]>([])
  const [accessUserQuery, setAccessUserQuery] = React.useState("")
  const [accessPickerOpen, setAccessPickerOpen] = React.useState(false)

  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [allDepartments, setAllDepartments] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
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
  const availablePositions = React.useMemo(
    () =>
      positions.filter((position) => {
        const branchId = readNumber(position, ["branch_id", "branchId"])
        return !form.branch_id || branchId === null || String(branchId) === form.branch_id
      }),
    [form.branch_id, positions]
  )
  const availablePositionIds = React.useMemo(
    () =>
      availablePositions
        .map((position) => readNumber(position, ["id"]))
        .filter((id): id is number => id !== null)
        .map(String),
    [availablePositions]
  )
  const allAvailablePositionsSelected =
    availablePositionIds.length > 0 &&
    availablePositionIds.every((id) => form.position_ids.includes(id))

  const fetchDepartments = React.useCallback(async (signal?: AbortSignal, force = false) => {
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
          cacheTtlMs: force ? 0 : env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
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

  const queueAccessUser = React.useCallback((id: number) => {
    setAccessUserIds((previous) => (previous.includes(id) ? previous : [...previous, id]))
    setAccessUserId(null)
    setAccessUserQuery("")
    setAccessPickerOpen(true)
    setAccessError(null)
  }, [])

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
    if (!token) return
    void listPositions(
      token,
      { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" },
      { cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS }
    )
      .then((result) => setPositions(result.rows))
      .catch(() => setPositions([]))
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
      position_ids: readPositionIds(row).map(String),
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
    const nextPositionIds = form.position_ids
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0)

    setSaving(true)
    setError(null)
    try {
      let departmentId = editingId
      if (editingId === null) {
        const created = await createDepartment(token, payload)
        departmentId = readCreatedDepartmentId(created)
      } else {
        await patchDepartment(token, editingId, payload)
      }
      if (departmentId === null && nextPositionIds.length > 0) {
        throw new Error("Department saved, but its id was missing so positions were not assigned.")
      }
      if (departmentId !== null) {
        await syncDepartmentPositions(token, departmentId, nextPositionIds)
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

  async function openDepartmentAccess(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    if (!canManageDepartmentAccess) {
      setError("You do not have permission to manage department access.")
      return
    }
    setAccessDepartment(row)
    setAccessUserId(null)
    setAccessUserIds([])
    setAccessUserQuery("")
    setOpenAccess(true)
    setSaving(true)
    setError(null)
    setAccessError(null)
    try {
      const [records, usersResult] = await Promise.all([
        listDepartmentAccess(token, id),
        listUsers(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
      ])
      setAccessRows(records)
      setCompanyUsers(usersResult.rows)
    } catch (errorObject) {
      setAccessRows([])
      setCompanyUsers([])
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load department access.")
    } finally {
      setSaving(false)
    }
  }

  async function grantAccess() {
    const token = readStoredToken()
    const departmentId = readNumber(accessDepartment ?? {}, ["id"])
    let userId = accessUserId
    if (userId === null && accessUserQuery.trim()) {
      const matched = selectableUsers.find((user) => {
        const id = readNumber(user, ["id", "user_id"])
        if (id === null) {
          return false
        }
        return accessUserQuery.trim() === `${id} - ${userLabel(user)}`
      })
      userId = matched ? readNumber(matched, ["id", "user_id"]) : null
    }
    const queuedUserIds = accessUserIds.filter((id) => id > 0)
    if (queuedUserIds.length === 0 && userId !== null && userId > 0) {
      queuedUserIds.push(userId)
    }
    if (!token || departmentId === null || queuedUserIds.length === 0) {
      setAccessError("Please choose at least one valid user before granting department access.")
      return
    }
    if (!canManageDepartmentAccess) {
      setAccessError("You do not have permission to manage department access.")
      return
    }
    setSaving(true)
    setAccessError(null)
    try {
      await Promise.all(queuedUserIds.map((id) => grantDepartmentAccess(token, departmentId, id)))
      const records = await listDepartmentAccess(token, departmentId)
      setAccessRows(records)
      setAccessUserId(null)
      setAccessUserIds([])
      setAccessUserQuery("")
    } catch (errorObject) {
      setAccessError(
        errorObject instanceof Error ? errorObject.message : "Failed to grant department access."
      )
    } finally {
      setSaving(false)
    }
  }

  async function revokeAccess(userId: number) {
    const token = readStoredToken()
    const departmentId = readNumber(accessDepartment ?? {}, ["id"])
    if (!token || departmentId === null) {
      return
    }
    if (!canManageDepartmentAccess) {
      setAccessError("You do not have permission to manage department access.")
      return
    }
    setSaving(true)
    setAccessError(null)
    try {
      await revokeDepartmentAccess(token, departmentId, userId)
      const records = await listDepartmentAccess(token, departmentId)
      setAccessRows(records)
    } catch (errorObject) {
      setAccessError(
        errorObject instanceof Error ? errorObject.message : "Failed to revoke department access."
      )
    } finally {
      setSaving(false)
    }
  }

  const assignedUserIds = new Set(
    accessRows
      .map((row) => accessRowUserId(row))
      .filter((value): value is number => value !== null)
  )

  const selectableUsers = companyUsers.filter((user) => {
    const id = readNumber(user, ["id", "user_id"])
    return id !== null && !assignedUserIds.has(id)
  })

  const queryText = accessUserQuery.trim().toLowerCase()
  const filteredSelectableUsers = (!queryText
    ? selectableUsers.slice(0, 8)
    : selectableUsers
        .filter((user) =>
          `${readNumber(user, ["id", "user_id"]) ?? ""} ${userLabel(user)}`
            .toLowerCase()
            .includes(queryText)
        )
        .slice(0, 8))

  const canManageDepartmentAccess =
    permissionsReady && canPerformPermission(actorPermissions, "departments:manage-access")

  const accessColumns: Column<AdminRecord>[] = [
    {
      key: "user",
      label: "User",
      defaultWidth: 260,
      render: (row) => accessUserName(row, companyUsers),
    },
    {
      key: "user_id",
      label: "User ID",
      defaultWidth: 90,
      render: (row) => String(accessRowUserId(row) ?? "-"),
    },
    {
      key: "actions",
      label: "Actions",
      defaultWidth: 90,
      sortable: false,
      render: (row) => {
        const userId = accessRowUserId(row)
        return (
          <div className="flex justify-end gap-1 pr-1" onClick={(event) => event.stopPropagation()}>
            {canManageDepartmentAccess ? (
              <button
                type="button"
                className="admin-table-icon-button"
                data-variant="danger"
                disabled={saving || userId === null}
                onClick={() => {
                  if (userId !== null) {
                    void revokeAccess(userId)
                  }
                }}
                aria-label="Revoke department access"
                title="Revoke department access"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        )
      },
    },
  ]

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
                  const token = readStoredToken()
                  if (token && id !== null) {
                    void listDepartmentPositions(token, id)
                      .then((assigned) =>
                        setForm((previous) => ({
                          ...previous,
                          position_ids: assigned
                            .map((position) => readNumber(position, ["id", "position_id", "positionId"]))
                            .filter((positionId): positionId is number => positionId !== null)
                            .map(String),
                        }))
                      )
                      .catch(() => undefined)
                  }
                }}
                aria-label="Edit department"
                title="Edit department"
              >
                <Pencil className="size-4" />
              </button>
            ) : null}
            {canManageDepartmentAccess ? (
              <button
                type="button"
                className="admin-table-icon-button"
                onClick={() => void openDepartmentAccess(row)}
                aria-label="Department access"
                title="Department access"
              >
                <KeyRound className="size-4" />
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
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <ResizableTable
        title="Department"
        data={rows}
        columns={departmentColumns}
        itemsPerPage={20}
        loading={loading}
        storageKey="departments"
        toolbarStart={
          <>
            <SearchToggleField
              className="min-w-0 !w-auto !max-w-[12rem] !flex-none"
              placeholder="Search department"
              value={query.search}
              onChange={(value) => {
                setPage(1)
                setQuery((previous) => ({ ...previous, search: value }))
              }}
            />
            <FluentSelect
              ariaLabel="Filter department status"
              size="small"
              className="!w-[8.5rem] !max-w-[8.5rem] !flex-none"
              value={query.status}
              placeholder="All statuses"
              onChange={(value) => {
                setPage(1)
                setQuery((previous) => ({ ...previous, status: value }))
              }}
              options={[
                { value: "", label: "All statuses" },
                { value: "active", label: "active" },
                { value: "inactive", label: "inactive" },
              ]}
            />
          </>
        }
        toolbarActions={
          <>
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
              onClick={() => void fetchDepartments(undefined, true)}
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </>
        }
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
                <FluentSelect
                  ariaLabel="Branch"
                  placeholder="Select branch"
                  value={form.branch_id}
                  onChange={(value) => setForm((prev) => ({ ...prev, branch_id: value, position_ids: [] }))}
                  options={[
                    { value: "", label: "Select branch" },
                    ...branches.flatMap((branch) => {
                      const id = readNumber(branch, ["id"])
                      return id === null ? [] : [{ value: String(id), label: readString(branch, ["name"]) }]
                    }),
                  ]}
                />
              </label>
              <label className="grid gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
                <Textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                <FluentSelect
                  ariaLabel="Status"
                  value={form.status}
                  onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                  options={[
                    { value: "active", label: "active" },
                    { value: "inactive", label: "inactive" },
                  ]}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parent Department</span>
                <FluentSelect
                  ariaLabel="Parent department"
                  placeholder="No parent"
                  value={form.parent_id}
                  onChange={(value) => setForm((prev) => ({ ...prev, parent_id: value }))}
                  options={[
                    { value: "", label: "No parent" },
                    ...allDepartments.flatMap((department) => {
                      const id = readNumber(department, ["id"])
                      if (id === null || (editingId !== null && id === editingId)) return []
                      return [{ value: String(id), label: readString(department, ["name"]) }]
                    }),
                  ]}
                />
              </label>
              <fieldset className="grid gap-1 md:col-span-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Assigned Positions
                </legend>
                <div className="max-h-40 overflow-y-auto rounded-md border border-slate-300 bg-white p-2">
                  <label className="mb-1 flex items-center gap-2 rounded border-b border-slate-200 px-2 py-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={allAvailablePositionsSelected}
                      disabled={availablePositionIds.length === 0}
                      onChange={(event) =>
                        setForm((previous) => {
                          const availableIds = new Set(availablePositionIds)
                          return {
                            ...previous,
                            position_ids: event.target.checked
                              ? Array.from(new Set([...previous.position_ids, ...availablePositionIds]))
                              : previous.position_ids.filter((id) => !availableIds.has(id)),
                          }
                        })
                      }
                    />
                    <span>Select all available positions</span>
                  </label>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {availablePositions.map((position) => {
                        const id = readNumber(position, ["id"])
                        if (id === null) return null
                        const value = String(id)
                        return (
                          <label key={id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={form.position_ids.includes(value)}
                              onChange={(event) =>
                                setForm((previous) => ({
                                  ...previous,
                                  position_ids: event.target.checked
                                    ? Array.from(new Set([...previous.position_ids, value]))
                                    : previous.position_ids.filter((entry) => entry !== value),
                                }))
                              }
                            />
                            <span>{readString(position, ["name", "code"])}</span>
                          </label>
                        )
                      })}
                  </div>
                </div>
                <span className="text-[11px] text-slate-500">
                  Saving assigns or removes these positions on the department.
                </span>
              </fieldset>
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

      {openAccess && accessDepartment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">
              Department Access: {readString(accessDepartment, ["name", "code"])}
            </h3>
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="grid min-w-0 gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">User</span>
                {accessUserIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                    {accessUserIds.map((id) => {
                      const user = selectableUsers.find((candidate) => readNumber(candidate, ["id", "user_id"]) === id)
                      const label = user ? userLabel(user) : `User #${id}`
                      return (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
                          {label}
                          <button
                            type="button"
                            className="rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            onClick={() => {
                              setAccessUserIds((previous) => previous.filter((entry) => entry !== id))
                              if (accessUserId === id) {
                                setAccessUserId(null)
                              }
                            }}
                            aria-label={`Remove ${label}`}
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                  </div>
                ) : null}
                <div className="relative">
                  <input
                    className="h-10 w-full rounded-md border border-slate-300 px-4 text-sm"
                    value={accessUserQuery}
                    onFocus={() => setAccessPickerOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setAccessPickerOpen(false), 120)
                    }}
                    onChange={(event) => {
                      const raw = event.target.value
                      setAccessUserQuery(raw)
                      const matched = selectableUsers.find((user) => {
                        const id = readNumber(user, ["id", "user_id"])
                        if (id === null) {
                          return false
                        }
                        return raw === `${id} - ${userLabel(user)}`
                      })
                      if (matched) {
                        const id = readNumber(matched, ["id", "user_id"])
                        setAccessUserId(id)
                      } else {
                        setAccessUserId(null)
                      }
                    }}
                    placeholder="Search and select user (e.g. Emmanuel)"
                  />
                  {accessPickerOpen && filteredSelectableUsers.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                      {filteredSelectableUsers.map((user) => {
                        const id = readNumber(user, ["id", "user_id"])
                        if (id === null) {
                          return null
                        }
                        const label = `${id} - ${userLabel(user)}`
                        return (
                          <button
                            key={id}
                            type="button"
                            className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              queueAccessUser(id)
                            }}
                            onClick={() => queueAccessUser(id)}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </label>
              <button
                type="button"
                className="h-10 rounded-md bg-primary px-3 text-sm font-medium !text-white transition hover:brightness-95 md:whitespace-nowrap"
                onClick={() => void grantAccess()}
              >
                Grant Access
              </button>
            </div>
            {accessError ? <p className="mt-2 text-sm text-rose-600">{accessError}</p> : null}

            <ResizableTable
              title="Access"
              data={accessRows}
              columns={accessColumns}
              itemsPerPage={10}
              storageKey="department-access"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                onClick={() => {
                  setOpenAccess(false)
                  setAccessError(null)
                }}
              >
                Close
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
