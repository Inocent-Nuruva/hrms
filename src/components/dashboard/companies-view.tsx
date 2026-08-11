"use client"

import * as React from "react"
import { CheckCircle2, Pencil, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  activateCompany,
  createCurrentCompanyUser,
  deleteCurrentCompanyUser,
  getCompanyById,
  getCurrentCompanyOnboardingStatus,
  getMyCompany,
  listCurrentCompanyUsers,
  listResource,
  listUsers,
  suspendCompany,
  updateCompanyById,
  type AdminRecord,
  type UsersQueryParams,
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

const DEFAULT_MEMBERS_QUERY: Required<UsersQueryParams> = {
  page: 1,
  limit: 100,
  sortBy: "created_at",
  sortOrder: "DESC",
  search: "",
}

type CompanyForm = {
  name: string
  metadata: string
}

type CurrentCompanyUserForm = {
  userId: string
  roleIds: string[]
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

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

function formatMetadata(value: unknown) {
  if (!value || typeof value !== "object") {
    return ""
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ""
  }
}

function companyName(row: AdminRecord) {
  return readString(row, ["company_name", "name", "display_name"])
}

function companySlug(row: AdminRecord) {
  return readString(row, ["company_slug", "slug", "code"])
}

function companyStatus(row: AdminRecord) {
  return readString(row, ["status", "state", "company_status"])
}

function currentCompanyUserLabel(row: AdminRecord) {
  const nestedUser =
    (typeof row.user === "object" && row.user !== null ? (row.user as AdminRecord) : null) ??
    (typeof row.company_user === "object" && row.company_user !== null ? (row.company_user as AdminRecord) : null)
  const first = readString(nestedUser ?? row, ["first_name", "firstName"])
  const last = readString(nestedUser ?? row, ["last_name", "lastName"])
  const full = [first, last].filter((value) => value !== "-").join(" ").trim()
  if (full) {
    return full
  }
  const display = readString(nestedUser ?? row, ["name", "display_name", "full_name", "email"])
  return display === "-" ? "Unknown user" : display
}

function currentCompanyUserEmail(row: AdminRecord) {
  const nestedUser = typeof row.user === "object" && row.user !== null ? (row.user as AdminRecord) : null
  return readString(nestedUser ?? row, ["email"])
}

function currentCompanyUserId(row: AdminRecord) {
  return readNumber(row, ["id", "user_id", "userId", "company_user_id", "companyUserId"])
}

function userOptionLabel(row: AdminRecord) {
  const first = readString(row, ["first_name", "firstName"])
  const last = readString(row, ["last_name", "lastName"])
  const full = [first, last].filter((value) => value !== "-").join(" ").trim()
  const email = readString(row, ["email"])
  if (full && email !== "-") {
    return `${full} (${email})`
  }
  if (full) {
    return full
  }
  return email === "-" ? `User #${readNumber(row, ["id", "user_id"]) ?? "?"}` : email
}

function toggleStringSelection(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue]
}

export function CompaniesView() {
  const actor = useDashboardActor()
  const actorPermissions = actor.permissionLabels
  const permissionsReady = actor.ready
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search, 300)

  const [editingCompany, setEditingCompany] = React.useState<AdminRecord | null>(null)
  const [companyForm, setCompanyForm] = React.useState<CompanyForm>({ name: "", metadata: "" })
  const [pendingStatusChange, setPendingStatusChange] = React.useState<{
    company: AdminRecord
    nextAction: "activate" | "suspend"
  } | null>(null)

  const [myCompany, setMyCompany] = React.useState<AdminRecord | null>(null)
  const [onboardingStatus, setOnboardingStatus] = React.useState<AdminRecord | null>(null)
  const [members, setMembers] = React.useState<AdminRecord[]>([])
  const [allUsers, setAllUsers] = React.useState<AdminRecord[]>([])
  const [roles, setRoles] = React.useState<AdminRecord[]>([])
  const [memberForm, setMemberForm] = React.useState<CurrentCompanyUserForm>({
    userId: "",
    roleIds: [],
  })
  const [membersError, setMembersError] = React.useState<string | null>(null)

  const canUpdateCompanies =
    permissionsReady && canPerformPermission(actorPermissions, "companies:update")
  const canManageCompanyUsers =
    permissionsReady &&
    (canPerformPermission(actorPermissions, "company_users:create") ||
      canPerformPermission(actorPermissions, "company_users:update") ||
      canPerformPermission(actorPermissions, "company_users:delete") ||
      canPerformPermission(actorPermissions, "users:update"))

  const loadData = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      return
    }

    setLoading(true)
    setError(null)
    setMembersError(null)
    try {
      const [companies, currentCompany, status, companyUsers, platformUsers, roleRows] =
        await Promise.all([
          listResource("companies", token),
          getMyCompany(token).catch(() => null),
          getCurrentCompanyOnboardingStatus(token).catch(() => null),
          listCurrentCompanyUsers(token, DEFAULT_MEMBERS_QUERY, {
            cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
          }).then((result) => result.rows),
          listUsers(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }, {
            cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
          }).then((result) => result.rows),
          listResource("roles", token),
        ])
      setRows(companies)
      setMyCompany(currentCompany)
      setOnboardingStatus(status ?? null)
      setMembers(companyUsers)
      setAllUsers(platformUsers)
      setRoles(roleRows)
    } catch (errorObject) {
      setRows([])
      setMembers([])
      setAllUsers([])
      setRoles([])
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load companies.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRows = React.useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    if (!query) {
      return rows
    }
    return rows.filter((row) =>
      `${companyName(row)} ${companySlug(row)} ${companyStatus(row)}`.toLowerCase().includes(query)
    )
  }, [debouncedSearch, rows])

  const assignedCurrentCompanyUserIds = React.useMemo(
    () =>
      new Set(
        members
          .map((row) => readNumber(row, ["user_id", "userId", "id"]))
          .filter((value): value is number => value !== null)
      ),
    [members]
  )

  const selectableUsers = React.useMemo(
    () =>
      allUsers.filter((row) => {
        const id = readNumber(row, ["id", "user_id"])
        return id !== null && !assignedCurrentCompanyUserIds.has(id)
      }),
    [allUsers, assignedCurrentCompanyUserIds]
  )

  const companyColumns: Column<AdminRecord>[] = [
    {
      key: "name",
      label: "Company",
      defaultWidth: 180,
      sortable: true,
      render: (row) => companyName(row),
    },
    {
      key: "slug",
      label: "Slug",
      defaultWidth: 120,
      sortable: true,
      render: (row) => companySlug(row),
    },
    {
      key: "status",
      label: "Status",
      defaultWidth: 100,
      sortable: true,
      render: (row) => companyStatus(row),
    },
    {
      key: "actions",
      label: "Actions",
      defaultWidth: 160,
      sortable: false,
      render: (row) => {
        const status = companyStatus(row).toLowerCase()
        return (
          <div className="flex justify-end gap-1 pr-1" onClick={(event) => event.stopPropagation()}>
            {canUpdateCompanies ? (
              <button
                type="button"
                className="admin-table-icon-button"
                onClick={async () => {
                  const token = readStoredToken()
                  const id = readNumber(row, ["id"])
                  if (!token || id === null) {
                    return
                  }
                  setSaving(true)
                  setError(null)
                  try {
                    const detail = (await getCompanyById(token, id)) ?? row
                    setEditingCompany(detail)
                    setCompanyForm({
                      name: readString(detail, ["name", "company_name", "display_name"]) === "-"
                        ? ""
                        : readString(detail, ["name", "company_name", "display_name"]),
                      metadata: formatMetadata(detail.metadata),
                    })
                  } catch (errorObject) {
                    setError(errorObject instanceof Error ? errorObject.message : "Failed to load company details.")
                  } finally {
                    setSaving(false)
                  }
                }}
                aria-label="Edit company"
                title="Edit company"
              >
                <Pencil className="size-4" />
              </button>
            ) : null}
            {canUpdateCompanies ? (
              <button
                type="button"
                className="admin-table-icon-button"
                data-variant={status === "active" ? "danger" : undefined}
                onClick={() =>
                  setPendingStatusChange({
                    company: row,
                    nextAction: status === "active" ? "suspend" : "activate",
                  })
                }
                aria-label={status === "active" ? "Suspend company" : "Activate company"}
                title={status === "active" ? "Suspend company" : "Activate company"}
              >
                {status === "active" ? <ShieldAlert className="size-4" /> : <CheckCircle2 className="size-4" />}
              </button>
            ) : null}
          </div>
        )
      },
    },
  ]

  const memberColumns: Column<AdminRecord>[] = [
    {
      key: "name",
      label: "User",
      defaultWidth: 220,
      render: (row) => currentCompanyUserLabel(row),
    },
    {
      key: "email",
      label: "Email",
      defaultWidth: 220,
      render: (row) => currentCompanyUserEmail(row),
    },
    {
      key: "status",
      label: "Status",
      defaultWidth: 100,
      render: (row) => readString(row, ["status", "membership_status"]),
    },
    {
      key: "actions",
      label: "Actions",
      defaultWidth: 100,
      sortable: false,
      render: (row) => {
        const userId = currentCompanyUserId(row)
        return (
          <div className="flex justify-end gap-1 pr-1" onClick={(event) => event.stopPropagation()}>
            {canManageCompanyUsers ? (
              <button
                type="button"
                className="admin-table-icon-button"
                data-variant="danger"
                disabled={saving || userId === null}
                onClick={async () => {
                  const token = readStoredToken()
                  if (!token || userId === null) {
                    return
                  }
                  setSaving(true)
                  setMembersError(null)
                  try {
                    await deleteCurrentCompanyUser(token, userId)
                    await loadData()
                  } catch (errorObject) {
                    setMembersError(
                      errorObject instanceof Error
                        ? errorObject.message
                        : "Failed to remove user from current company."
                    )
                  } finally {
                    setSaving(false)
                  }
                }}
                aria-label="Remove from current company"
                title="Remove from current company"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        )
      },
    },
  ]

  async function saveCompany() {
    const token = readStoredToken()
    const companyId = readNumber(editingCompany ?? {}, ["id"])
    if (!token || companyId === null || !editingCompany) {
      return
    }

    const metadataText = companyForm.metadata.trim()
    const metadata = metadataText ? safeJsonParse(metadataText) : null
    if (metadataText && !metadata) {
      setError("Metadata must be valid JSON.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateCompanyById(token, companyId, {
        name: companyForm.name.trim(),
        metadata,
      })
      setEditingCompany(null)
      await loadData()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to update company.")
    } finally {
      setSaving(false)
    }
  }

  async function confirmStatusChange() {
    const token = readStoredToken()
    const companyId = readNumber(pendingStatusChange?.company ?? {}, ["id"])
    if (!token || companyId === null || !pendingStatusChange) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (pendingStatusChange.nextAction === "activate") {
        await activateCompany(token, companyId)
      } else {
        await suspendCompany(token, companyId)
      }
      setPendingStatusChange(null)
      await loadData()
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : `Failed to ${pendingStatusChange.nextAction} company.`
      )
    } finally {
      setSaving(false)
    }
  }

  async function addCurrentCompanyUser() {
    const token = readStoredToken()
    const userId = Number(memberForm.userId)
    if (!token || !Number.isFinite(userId) || userId <= 0) {
      setMembersError("Choose a valid platform user first.")
      return
    }

    setSaving(true)
    setMembersError(null)
    try {
      await createCurrentCompanyUser(token, {
        user_id: userId,
        role_ids: memberForm.roleIds.map(Number),
      })
      setMemberForm({ userId: "", roleIds: [] })
      await loadData()
    } catch (errorObject) {
      setMembersError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to add the user to the current company."
      )
    } finally {
      setSaving(false)
    }
  }

  const onboardingCompleted = React.useMemo(() => {
    if (!onboardingStatus) {
      return false
    }
    const complete =
      onboardingStatus.setup_complete ??
      onboardingStatus.setupComplete ??
      onboardingStatus.is_complete ??
      onboardingStatus.isComplete
    return complete === true
  }, [onboardingStatus])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Current Company</h3>
              <p className="text-sm text-muted-foreground">
                Active company context and onboarding readiness.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-primary transition hover:bg-slate-50 disabled:opacity-60"
              onClick={() => void loadData()}
              disabled={loading}
              aria-label="Refresh companies"
              title="Refresh companies"
            >
              <RefreshCw className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {myCompany ? companyName(myCompany) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Slug: {myCompany ? companySlug(myCompany) : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Onboarding</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {onboardingCompleted ? "Complete" : "In progress"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {onboardingStatus
                  ? formatMetadata(onboardingStatus).slice(0, 160) || "Status record loaded."
                  : "No onboarding status record returned."}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Current Company Users</h3>
            <p className="text-sm text-muted-foreground">
              Add an existing platform user to the active company and optionally seed roles.
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform user</span>
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={memberForm.userId}
                onChange={(event) =>
                  setMemberForm((previous) => ({ ...previous, userId: event.target.value }))
                }
              >
                <option value="">Select user</option>
                {selectableUsers.map((user) => {
                  const id = readNumber(user, ["id", "user_id"])
                  if (id === null) return null
                  return (
                    <option key={id} value={String(id)}>
                      {userOptionLabel(user)}
                    </option>
                  )
                })}
              </select>
            </label>
            <fieldset className="grid gap-1">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Seed roles
              </legend>
              <div className="flex flex-wrap gap-2 rounded-md border border-slate-300 bg-white p-2">
                {roles.map((role) => {
                  const id = readNumber(role, ["id"])
                  if (id === null) return null
                  const value = String(id)
                  const active = memberForm.roleIds.includes(value)
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`rounded-md border px-2 py-1 text-xs ${
                        active
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-background text-foreground"
                      }`}
                      onClick={() =>
                        setMemberForm((previous) => ({
                          ...previous,
                          roleIds: toggleStringSelection(previous.roleIds, value),
                        }))
                      }
                    >
                      {readString(role, ["display_name", "name"])}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <div className="flex justify-end">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold !text-white transition hover:brightness-95 disabled:opacity-60"
                disabled={saving || !canManageCompanyUsers}
                onClick={() => void addCurrentCompanyUser()}
              >
                <Plus className="size-3.5" />
                Add to current company
              </button>
            </div>
            {membersError ? <p className="text-sm text-rose-600">{membersError}</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchToggleField
            className="min-w-0"
            placeholder="Search company"
            value={search}
            onChange={setSearch}
          />
          <div className="ml-auto text-xs text-muted-foreground">
            {filteredRows.length} compan{filteredRows.length === 1 ? "y" : "ies"}
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        <ResizableTable
          title="Companies"
          data={filteredRows}
          columns={companyColumns}
          itemsPerPage={20}
          loading={loading}
          storageKey="companies"
        />
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h3 className="mb-3 text-base font-semibold text-foreground">Active Company Members</h3>
        <ResizableTable
          title="Current company users"
          data={members}
          columns={memberColumns}
          itemsPerPage={10}
          loading={loading}
          storageKey="current-company-users"
        />
      </div>

      {editingCompany ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Edit Company</h3>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={companyForm.name}
                  onChange={(event) =>
                    setCompanyForm((previous) => ({ ...previous, name: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metadata JSON</span>
                <Textarea
                  className="min-h-32 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                  value={companyForm.metadata}
                  onChange={(event) =>
                    setCompanyForm((previous) => ({ ...previous, metadata: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setEditingCompany(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white transition hover:brightness-95 disabled:opacity-60"
                disabled={saving}
                onClick={() => void saveCompany()}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(pendingStatusChange)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatusChange(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatusChange?.nextAction === "activate" ? "Activate company?" : "Suspend company?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusChange?.nextAction === "activate"
                ? `Activate ${pendingStatusChange ? companyName(pendingStatusChange.company) : "this company"} so it can operate normally again.`
                : `Suspend ${pendingStatusChange ? companyName(pendingStatusChange.company) : "this company"}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingStatusChange}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void confirmStatusChange()}
            >
              {saving ? "Working..." : pendingStatusChange?.nextAction === "activate" ? "Activate" : "Suspend"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
