"use client"

import * as React from "react"
import { KeyRound, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { BuildingRegular } from "@fluentui/react-icons"
import {
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  SearchBox,
  createTableColumn,
  useTableFeatures,
  useTableSort,
  type TableColumnDefinition,
  type TableColumnId,
} from "@fluentui/react-components"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { countries as countryCodes } from "country-flag-icons"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

import {
  createBranch,
  deleteBranch,
  grantBranchAccess,
  listBranchAccess,
  listBranches,
  listUsers,
  patchBranch,
  revokeBranchAccess,
  type AdminRecord,
  type BranchesQueryParams,
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

const DEFAULT_QUERY: Required<Omit<BranchesQueryParams, "status">> & {
  status: string
} = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC",
  search: "",
  status: "",
}

type BranchForm = {
  name: string
  country: string
  city: string
  address: string
  status: string
}

type CountryOption = { code: string; name: string }

const regionDisplayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null

function safeCountryName(code: string) {
  try {
    return regionDisplayNames?.of(code) ?? code
  } catch {
    return code
  }
}

const COUNTRY_OPTIONS: CountryOption[] = (countryCodes as string[])
  .map((code) => ({
    code,
    name: safeCountryName(code),
  }))
  .sort((first, second) => first.name.localeCompare(second.name))

const CITY_OPTIONS_BY_COUNTRY: Record<string, string[]> = {
  Tanzania: ["Dar es Salaam", "Arusha", "Moshi", "Mwanza", "Zanzibar", "Dodoma", "Mbeya", "Morogoro"],
  Kenya: ["Nairobi", "Mombasa", "Kisumu", "Nakuru"],
  Uganda: ["Kampala", "Entebbe", "Gulu", "Jinja"],
  Rwanda: ["Kigali", "Huye", "Musanze"],
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
      // Fall back to legacy key below.
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

function emptyForm(): BranchForm {
  return {
    name: "",
    country: "",
    city: "",
    address: "",
    status: "active",
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

type BranchItem = {
  key: string
  name: string
  code: string
  country: string
  city: string
  status: string
  row: AdminRecord
}

const branchColumns: TableColumnDefinition<BranchItem>[] = [
  createTableColumn<BranchItem>({
    columnId: "name",
    compare: (a, b) => a.name.localeCompare(b.name),
  }),
  createTableColumn<BranchItem>({
    columnId: "code",
    compare: (a, b) => a.code.localeCompare(b.code),
  }),
  createTableColumn<BranchItem>({
    columnId: "country",
    compare: (a, b) => a.country.localeCompare(b.country),
  }),
  createTableColumn<BranchItem>({
    columnId: "city",
    compare: (a, b) => a.city.localeCompare(b.city),
  }),
  createTableColumn<BranchItem>({
    columnId: "status",
    compare: (a, b) => a.status.localeCompare(b.status),
  }),
]

function BranchDirectoryTable({
  rows,
  canUpdate,
  canDelete,
  canAccess,
  saving,
  onEdit,
  onAccess,
  onDelete,
}: {
  rows: AdminRecord[]
  canUpdate: boolean
  canDelete: boolean
  canAccess: boolean
  saving: boolean
  onEdit: (row: AdminRecord) => void
  onAccess: (row: AdminRecord) => void
  onDelete: (row: AdminRecord) => void
}) {
  const items = React.useMemo<BranchItem[]>(
    () =>
      rows.map((row, index) => ({
        key: String(readNumber(row, ["id"]) ?? index),
        name: readString(row, ["name"]),
        code: readString(row, ["code"]),
        country: readString(row, ["country"]),
        city: readString(row, ["city"]),
        status: readString(row, ["status"]),
        row,
      })),
    [rows],
  )
  const {
    getRows,
    sort: { getSortDirection, toggleColumnSort, sort },
  } = useTableFeatures(
    { columns: branchColumns, items },
    [useTableSort({ defaultSortState: { sortColumn: "name", sortDirection: "ascending" } })],
  )
  const headerSortProps = (columnId: TableColumnId) => ({
    onClick: (event: React.MouseEvent) => {
      toggleColumnSort(event, columnId)
    },
    sortDirection: getSortDirection(columnId),
  })
  const sortedRows = sort(getRows())

  return (
    <Table sortable aria-label="Branches" style={{ minWidth: "640px" }}>
      <TableHeader>
        <TableRow>
          <TableHeaderCell {...headerSortProps("name")}>Name</TableHeaderCell>
          <TableHeaderCell {...headerSortProps("code")}>Code</TableHeaderCell>
          <TableHeaderCell {...headerSortProps("country")}>Country</TableHeaderCell>
          <TableHeaderCell {...headerSortProps("city")}>City</TableHeaderCell>
          <TableHeaderCell {...headerSortProps("status")}>Status</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map(({ item }) => (
          <TableRow key={item.key}>
            <TableCell>
              <TableCellLayout media={<BuildingRegular />}>
                {item.name}
              </TableCellLayout>
            </TableCell>
            <TableCell>{item.code}</TableCell>
            <TableCell>{item.country}</TableCell>
            <TableCell>{item.city}</TableCell>
            <TableCell>
              <TableCellLayout
                media={
                  <Avatar
                    aria-label={item.status}
                    name={item.name}
                    badge={{ status: item.status.toLowerCase() === "active" ? "available" : "offline" }}
                  />
                }
              >
                {item.status}
              </TableCellLayout>
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                {canUpdate ? (
                  <button
                    type="button"
                    className="admin-table-icon-button"
                    onClick={() => onEdit(item.row)}
                    aria-label="Edit branch"
                    title="Edit branch"
                  >
                    <Pencil className="size-4" />
                  </button>
                ) : null}
                {canAccess ? (
                  <button
                    type="button"
                    className="admin-table-icon-button"
                    onClick={() => onAccess(item.row)}
                    aria-label="Branch access"
                    title="Branch access"
                  >
                    <KeyRound className="size-4" />
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    className="admin-table-icon-button"
                    data-variant="danger"
                    disabled={saving}
                    onClick={() => onDelete(item.row)}
                    aria-label="Delete branch"
                    title="Delete branch"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
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

export function BranchesView() {
  const actor = useDashboardActor()
  const actorPermissions = actor.permissionLabels
  const permissionsReady = actor.ready
  const [query, setQuery] = React.useState(DEFAULT_QUERY)
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [, setTotalPages] = React.useState<number | null>(null)
  const [, setTotal] = React.useState<number | null>(null)

  const [openForm, setOpenForm] = React.useState(false)
  const [form, setForm] = React.useState<BranchForm>(emptyForm())
  const [editingId, setEditingId] = React.useState<number | null>(null)

  const [openAccess, setOpenAccess] = React.useState(false)
  const [accessBranch, setAccessBranch] = React.useState<AdminRecord | null>(null)
  const [accessRows, setAccessRows] = React.useState<AdminRecord[]>([])
  const [accessError, setAccessError] = React.useState<string | null>(null)
  const [companyUsers, setCompanyUsers] = React.useState<AdminRecord[]>([])
  const [accessUserId, setAccessUserId] = React.useState<number | null>(null)
  const [accessUserIds, setAccessUserIds] = React.useState<number[]>([])
  const [accessUserQuery, setAccessUserQuery] = React.useState("")
  const [accessPickerOpen, setAccessPickerOpen] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<AdminRecord | null>(null)
  const debouncedSearch = useDebouncedValue(query.search, 350)

  const cityOptions = React.useMemo(() => {
    const selectedCountry = form.country.trim().toLowerCase()
    if (!selectedCountry) {
      return [] as string[]
    }

    const knownCities = Object.entries(CITY_OPTIONS_BY_COUNTRY).find(
      ([country]) => country.toLowerCase() === selectedCountry
    )?.[1] ?? []

    const existingBranchCities = rows
      .filter((row) => readString(row, ["country"]).toLowerCase() === selectedCountry)
      .map((row) => readString(row, ["city"]))
      .filter((value) => value !== "-")

    return Array.from(new Set([...knownCities, ...existingBranchCities]))
  }, [form.country, rows])

  const normalizedQuery = React.useMemo(
    () => ({
      ...query,
      search: debouncedSearch,
      status: query.status || undefined,
    }),
    [debouncedSearch, query]
  )

  const fetchBranches = React.useCallback(async (signal?: AbortSignal, force = false) => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listBranches(
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
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load branches.")
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [normalizedQuery, page])

  React.useEffect(() => {
    const controller = new AbortController()
    void fetchBranches(controller.signal)
    return () => controller.abort()
  }, [fetchBranches])

  const queueAccessUser = React.useCallback((id: number) => {
    setAccessUserIds((previous) => (previous.includes(id) ? previous : [...previous, id]))
    setAccessUserId(null)
    setAccessUserQuery("")
    setAccessPickerOpen(true)
    setAccessError(null)
  }, [])

  function fillFormFromRow(row: AdminRecord) {
    setForm({
      name: readString(row, ["name"]),
      country: readString(row, ["country"]),
      city: readString(row, ["city"]),
      address: readString(row, ["address"]),
      status: readString(row, ["status"]) === "-" ? "active" : readString(row, ["status"]),
    })
  }

  async function submitForm() {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }
    if (editingId === null && !canCreateBranches) {
      setError("You do not have permission to create branches.")
      return
    }
    if (editingId !== null && !canUpdateBranches) {
      setError("You do not have permission to update branches.")
      return
    }

    const payload: AdminRecord = {
      name: form.name.trim(),
      country: form.country.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      status: form.status || "active",
    }

    setSaving(true)
    setError(null)
    try {
      if (editingId === null) {
        await createBranch(token, payload)
      } else {
        await patchBranch(token, editingId, payload)
      }
      setOpenForm(false)
      setEditingId(null)
      setForm(emptyForm())
      await fetchBranches()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to save branch.")
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
    if (!canDeleteBranches) {
      setError("You do not have permission to delete branches.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await deleteBranch(token, id)
      await fetchBranches()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to delete branch.")
    } finally {
      setSaving(false)
    }
  }

  async function openBranchAccess(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    if (!canManageBranchAccess) {
      setError("You do not have permission to manage branch access.")
      return
    }
    setAccessBranch(row)
    setAccessUserId(null)
    setAccessUserIds([])
    setAccessUserQuery("")
    setOpenAccess(true)
    setSaving(true)
    setError(null)
    setAccessError(null)
    try {
      const [records, usersResult] = await Promise.all([
        listBranchAccess(token, id),
        listUsers(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
      ])
      setAccessRows(records)
      setCompanyUsers(usersResult.rows)
    } catch (errorObject) {
      setAccessRows([])
      setCompanyUsers([])
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load branch access.")
    } finally {
      setSaving(false)
    }
  }

  async function grantAccess() {
    const token = readStoredToken()
    const branchId = readNumber(accessBranch ?? {}, ["id"])
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
    if (!token || branchId === null || queuedUserIds.length === 0) {
      setAccessError("Please choose at least one valid user before granting branch access.")
      return
    }
    if (!canManageBranchAccess) {
      setAccessError("You do not have permission to manage branch access.")
      return
    }
    setSaving(true)
    setAccessError(null)
    try {
      await Promise.all(queuedUserIds.map((id) => grantBranchAccess(token, branchId, id)))
      const records = await listBranchAccess(token, branchId)
      setAccessRows(records)
      setAccessUserId(null)
      setAccessUserIds([])
      setAccessUserQuery("")
    } catch (errorObject) {
      setAccessError(errorObject instanceof Error ? errorObject.message : "Failed to grant branch access.")
    } finally {
      setSaving(false)
    }
  }

  async function revokeAccess(userId: number) {
    const token = readStoredToken()
    const branchId = readNumber(accessBranch ?? {}, ["id"])
    if (!token || branchId === null) {
      return
    }
    if (!canManageBranchAccess) {
      setAccessError("You do not have permission to manage branch access.")
      return
    }
    setSaving(true)
    setAccessError(null)
    try {
      await revokeBranchAccess(token, branchId, userId)
      const records = await listBranchAccess(token, branchId)
      setAccessRows(records)
    } catch (errorObject) {
      setAccessError(errorObject instanceof Error ? errorObject.message : "Failed to revoke branch access.")
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
        .filter((user) => `${readNumber(user, ["id", "user_id"]) ?? ""} ${userLabel(user)}`.toLowerCase().includes(queryText))
        .slice(0, 8))

  const canCreateBranches =
    permissionsReady && canPerformPermission(actorPermissions, "branches:create")
  const canUpdateBranches =
    permissionsReady && canPerformPermission(actorPermissions, "branches:update")
  const canDeleteBranches =
    permissionsReady && canPerformPermission(actorPermissions, "branches:delete")
  const canManageBranchAccess =
    permissionsReady && canPerformPermission(actorPermissions, "branches:manage-access")

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
            {canManageBranchAccess ? (
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
                aria-label="Revoke branch access"
                title="Revoke branch access"
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
    <div className="space-y-2 pt-3">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="overflow-hidden border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-sm font-semibold tracking-tight">Branches</h1>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              size="medium"
              placeholder="Search branch"
              aria-label="Search branches"
              value={query.search}
              className="!w-64 max-w-full shrink-0"
              onChange={(_event, data) => {
                setPage(1)
                setQuery((previous) => ({ ...previous, search: data.value }))
              }}
            />
            <div className="w-44 shrink-0 self-center">
              <FluentSelect
                ariaLabel="Filter branch status"
                size="medium"
                value={query.status || "all"}
                placeholder="All statuses"
                onChange={(value) => {
                  setPage(1)
                  setQuery((previous) => ({ ...previous, status: value === "all" ? "" : value }))
                }}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "active", label: "active" },
                  { value: "inactive", label: "inactive" },
                ]}
              />
            </div>
            {canCreateBranches ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--primary)] px-2.5 text-xs font-semibold !text-white transition hover:brightness-95 disabled:opacity-60"
                onClick={() => {
                  setEditingId(null)
                  setForm(emptyForm())
                  setOpenForm(true)
                }}
                aria-label="Add branch"
                title="Add branch"
              >
                <Plus className="size-3.5" />
                Add Branch
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-primary transition hover:bg-slate-50 disabled:opacity-60"
              onClick={() => void fetchBranches(undefined, true)}
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        {loading ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">Loading branches…</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">No branches found.</p>
        ) : (
          <BranchDirectoryTable
            rows={rows}
            canUpdate={canUpdateBranches}
            canDelete={canDeleteBranches}
            canAccess={canManageBranchAccess}
            saving={saving}
            onEdit={(row) => {
              fillFormFromRow(row)
              setEditingId(readNumber(row, ["id"]))
              setOpenForm(true)
            }}
            onAccess={(row) => void openBranchAccess(row)}
            onDelete={setPendingDelete}
          />
        )}
      </div>

      {openForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">{editingId === null ? "Add" : "Edit"} Branch</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Country</span>
                <input
                  list="branch-country-options"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={form.country}
                  onChange={(event) => {
                    const nextCountry = event.target.value
                    setForm((prev) => {
                      const selectedChanged = prev.country.trim().toLowerCase() !== nextCountry.trim().toLowerCase()
                      return {
                        ...prev,
                        country: nextCountry,
                        city: selectedChanged ? "" : prev.city,
                      }
                    })
                  }}
                  placeholder="Select country"
                />
                <datalist id="branch-country-options">
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.code} value={option.name} />
                  ))}
                </datalist>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">City</span>
                <input
                  list="branch-city-options"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                  placeholder={form.country ? "Select city" : "Select country first"}
                />
                <datalist id="branch-city-options">
                  {cityOptions.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </label>
              <label className="grid gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</span>
                <Textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                <FluentSelect
                  id="branch-status"
                  value={form.status}
                  onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                  options={[
                    { value: "active", label: "active" },
                    { value: "inactive", label: "inactive" },
                  ]}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setOpenForm(false)}>
                Cancel
              </button>
              <button type="button" className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium !text-white transition hover:brightness-95 disabled:opacity-60" disabled={saving} onClick={() => void submitForm()}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openAccess && accessBranch ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Branch Access: {readString(accessBranch, ["name", "code"])}</h3>
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
                className="h-10 rounded-md bg-[var(--primary)] px-3 text-sm font-medium !text-white transition hover:brightness-95 md:whitespace-nowrap"
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
              storageKey="branch-access"
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
              Are you sure you want to delete this branch? This action cannot be undone.
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
