"use client"

import * as React from "react"
import { CheckCircle2, KeyRound, Pencil, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  activateCompany,
  assignPermissionToCurrentCompanyUser,
  assignRoleToCurrentCompanyUser,
  createCurrentCompanyUser,
  deleteCurrentCompanyUser,
  getCompanyById,
  getCurrentCompanyOnboardingStatus,
  getMyCompany,
  listCurrentCompanyUsers,
  listResource,
  listUsers,
  revokePermissionFromCurrentCompanyUser,
  revokeRoleFromCurrentCompanyUser,
  suspendCompany,
  updateCompanyById,
  type AdminRecord,
  type UsersQueryParams,
} from "@/lib/admin-api"
import { useRouter } from "next/navigation"

import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  canAccessDashboardRoute,
  canPerformPermission,
} from "@/lib/dashboard-permissions"
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

function summarizeOnboardingStatus(status: AdminRecord | null) {
  if (!status) {
    return "No onboarding status record returned."
  }

  const statusLabel = readString(status, [
    "status",
    "state",
    "phase",
    "current_status",
    "currentStatus",
  ])
  const currentStep = readString(status, ["current_step", "currentStep", "step_name", "stepName"])
  const completedSteps = readNumber(status, ["completed_steps", "completedSteps"])
  const totalSteps = readNumber(status, ["total_steps", "totalSteps"])
  const percentage = readNumber(status, [
    "progress_percentage",
    "progressPercent",
    "completion_percentage",
    "completionPercent",
  ])

  const summaryParts = [
    statusLabel !== "-" ? statusLabel : "",
    currentStep !== "-" ? `Current step: ${currentStep}` : "",
    completedSteps !== null && totalSteps !== null
      ? `${completedSteps}/${totalSteps} steps complete`
      : "",
    percentage !== null ? `${percentage}% complete` : "",
  ].filter(Boolean)

  if (summaryParts.length > 0) {
    return summaryParts.join(" · ")
  }

  return "Status record loaded."
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

function nestedAdminRecord(row: AdminRecord, key: string) {
  return typeof row[key] === "object" && row[key] !== null ? (row[key] as AdminRecord) : null
}

function collectAssignmentIds(row: AdminRecord, keys: string[]) {
  const ids = new Set<string>()
  const consume = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      ids.add(String(value))
      return
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        ids.add(String(parsed))
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach(consume)
      return
    }
    if (typeof value !== "object" || value === null) {
      return
    }
    const record = value as AdminRecord
    for (const idKey of ["id", "role_id", "roleId", "permission_id", "permissionId"]) {
      const next = readNumber(record, [idKey])
      if (next !== null) {
        ids.add(String(next))
        return
      }
    }
    for (const nestedKey of ["role", "permission", "roles", "permissions", "direct_permissions", "directPermissions"]) {
      consume(record[nestedKey])
    }
  }

  for (const key of keys) {
    consume(row[key])
  }

  return Array.from(ids)
}

function memberRoleIds(row: AdminRecord) {
  const user = nestedAdminRecord(row, "user")
  const companyUser = nestedAdminRecord(row, "company_user")
  return collectAssignmentIds(row, ["roles", "user_roles", "userRoles"]).concat(
    user ? collectAssignmentIds(user, ["roles", "user_roles", "userRoles"]) : [],
    companyUser ? collectAssignmentIds(companyUser, ["roles", "user_roles", "userRoles"]) : []
  ).filter((value, index, values) => values.indexOf(value) === index)
}

function memberPermissionIds(row: AdminRecord) {
  const user = nestedAdminRecord(row, "user")
  const companyUser = nestedAdminRecord(row, "company_user")
  return collectAssignmentIds(row, ["direct_permissions", "directPermissions", "permissions"]).concat(
    user ? collectAssignmentIds(user, ["direct_permissions", "directPermissions", "permissions"]) : [],
    companyUser ? collectAssignmentIds(companyUser, ["direct_permissions", "directPermissions", "permissions"]) : []
  ).filter((value, index, values) => values.indexOf(value) === index)
}

export function CompaniesView() {
  const router = useRouter()
  const actor = useDashboardActor()
  const actorPermissions = actor.permissionLabels
  const permissionsReady = actor.ready
  const canAccessCompaniesRoute =
    !permissionsReady ||
    canAccessDashboardRoute("/dashboard/companies", actorPermissions, actor.accessMode)
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
  const [permissions, setPermissions] = React.useState<AdminRecord[]>([])
  const [memberForm, setMemberForm] = React.useState<CurrentCompanyUserForm>({
    userId: "",
    roleIds: [],
  })
  const [membersError, setMembersError] = React.useState<string | null>(null)
  const [editingMember, setEditingMember] = React.useState<AdminRecord | null>(null)
  const [editingMemberRoleIds, setEditingMemberRoleIds] = React.useState<string[]>([])
  const [editingMemberPermissionIds, setEditingMemberPermissionIds] = React.useState<string[]>([])

  const canUpdateCompanies =
    permissionsReady && canPerformPermission(actorPermissions, "companies:update")
  const canManageCompanyUsers =
    permissionsReady &&
    (canPerformPermission(actorPermissions, "company_users:create") ||
      canPerformPermission(actorPermissions, "company_users:update") ||
      canPerformPermission(actorPermissions, "company_users:delete") ||
      canPerformPermission(actorPermissions, "users:update"))
  const canManageCompanyUserPermissions =
    permissionsReady &&
    (canPerformPermission(actorPermissions, "company_users:update") ||
      canPerformPermission(actorPermissions, "permissions:update") ||
      canPerformPermission(actorPermissions, "users:update"))

  React.useEffect(() => {
    if (!permissionsReady) {
      return
    }
    if (!canAccessCompaniesRoute) {
      router.replace("/dashboard")
    }
  }, [canAccessCompaniesRoute, permissionsReady, router])

  const loadData = React.useCallback(async () => {
    if (!permissionsReady) {
      return
    }
    if (!canAccessCompaniesRoute) {
      setRows([])
      setMembers([])
      setAllUsers([])
      setRoles([])
      setPermissions([])
      setError(null)
      return
    }

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
      const [companies, currentCompany, status, companyUsers, platformUsers, roleRows, permissionRows] =
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
          listResource("permissions", token),
        ])
      setRows(companies)
      setMyCompany(currentCompany)
      setOnboardingStatus(status ?? null)
      setMembers(companyUsers)
      setAllUsers(platformUsers)
      setRoles(roleRows)
      setPermissions(permissionRows)
    } catch (errorObject) {
      setRows([])
      setMembers([])
      setAllUsers([])
      setRoles([])
      setPermissions([])
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load companies.")
    } finally {
      setLoading(false)
    }
  }, [canAccessCompaniesRoute, permissionsReady])

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

  const roleNameById = React.useCallback(
    (id: string) => {
      const match = roles.find((role) => String(readNumber(role, ["id"]) ?? "") === id)
      return match ? readString(match, ["display_name", "name"]) : `Role #${id}`
    },
    [roles]
  )

  const permissionNameById = React.useCallback(
    (id: string) => {
      const match = permissions.find((permission) => String(readNumber(permission, ["id"]) ?? "") === id)
      return match ? readString(match, ["display_name", "name"]) : `Permission #${id}`
    },
    [permissions]
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
      key: "roles",
      label: "Roles",
      defaultWidth: 180,
      render: (row) => {
        const ids = memberRoleIds(row)
        if (ids.length === 0) {
          return "-"
        }
        return ids.slice(0, 3).map(roleNameById).join(", ")
      },
    },
    {
      key: "direct_permissions",
      label: "Direct Permissions",
      defaultWidth: 180,
      render: (row) => {
        const ids = memberPermissionIds(row)
        if (ids.length === 0) {
          return "-"
        }
        return ids.slice(0, 2).map(permissionNameById).join(", ")
      },
    },
    {
      key: "actions",
      label: "Actions",
      defaultWidth: 150,
      sortable: false,
      render: (row) => {
        const userId = currentCompanyUserId(row)
        return (
          <div className="flex justify-end gap-1 pr-1" onClick={(event) => event.stopPropagation()}>
            {canManageCompanyUserPermissions ? (
              <button
                type="button"
                className="admin-table-icon-button"
                disabled={userId === null}
                onClick={() => {
                  setEditingMember(row)
                  setEditingMemberRoleIds(memberRoleIds(row))
                  setEditingMemberPermissionIds(memberPermissionIds(row))
                  setMembersError(null)
                }}
                aria-label="Manage member access"
                title="Manage member access"
              >
                <KeyRound className="size-4" />
              </button>
            ) : null}
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

  async function saveMemberAccess() {
    const token = readStoredToken()
    const userId = currentCompanyUserId(editingMember ?? {})
    if (!token || userId === null || !editingMember) {
      return
    }

    const previousRoleIds = new Set(memberRoleIds(editingMember))
    const nextRoleIds = new Set(editingMemberRoleIds)
    const addRoleIds = Array.from(nextRoleIds).filter((id) => !previousRoleIds.has(id))
    const removeRoleIds = Array.from(previousRoleIds).filter((id) => !nextRoleIds.has(id))

    const previousPermissionIds = new Set(memberPermissionIds(editingMember))
    const nextPermissionIds = new Set(editingMemberPermissionIds)
    const addPermissionIds = Array.from(nextPermissionIds).filter((id) => !previousPermissionIds.has(id))
    const removePermissionIds = Array.from(previousPermissionIds).filter((id) => !nextPermissionIds.has(id))

    setSaving(true)
    setMembersError(null)
    try {
      for (const roleId of addRoleIds) {
        await assignRoleToCurrentCompanyUser(token, userId, roleId)
      }
      for (const roleId of removeRoleIds) {
        await revokeRoleFromCurrentCompanyUser(token, userId, roleId)
      }
      for (const permissionId of addPermissionIds) {
        await assignPermissionToCurrentCompanyUser(token, userId, permissionId)
      }
      for (const permissionId of removePermissionIds) {
        await revokePermissionFromCurrentCompanyUser(token, userId, permissionId)
      }
      setEditingMember(null)
      await loadData()
    } catch (errorObject) {
      setMembersError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update current company user access."
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

  if (permissionsReady && !canAccessCompaniesRoute) {
    return null
  }

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
                {summarizeOnboardingStatus(onboardingStatus)}
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

      {editingMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">
              Manage Access: {currentCompanyUserLabel(editingMember)}
            </h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <fieldset className="grid gap-1">
                <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Company Roles
                </legend>
                <div className="max-h-72 overflow-y-auto rounded-md border border-slate-300 bg-white p-2">
                  <div className="grid gap-1">
                    {roles.map((role) => {
                      const id = readNumber(role, ["id"])
                      if (id === null) return null
                      const value = String(id)
                      return (
                        <label key={id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={editingMemberRoleIds.includes(value)}
                            onChange={(event) =>
                              setEditingMemberRoleIds((previous) =>
                                event.target.checked
                                  ? Array.from(new Set([...previous, value]))
                                  : previous.filter((entry) => entry !== value)
                              )
                            }
                          />
                          <span>{readString(role, ["display_name", "name"])}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </fieldset>

              <fieldset className="grid gap-1">
                <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Direct Permissions
                </legend>
                <div className="max-h-72 overflow-y-auto rounded-md border border-slate-300 bg-white p-2">
                  <div className="grid gap-1">
                    {permissions.map((permission) => {
                      const id = readNumber(permission, ["id"])
                      if (id === null) return null
                      const value = String(id)
                      return (
                        <label key={id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={editingMemberPermissionIds.includes(value)}
                            onChange={(event) =>
                              setEditingMemberPermissionIds((previous) =>
                                event.target.checked
                                  ? Array.from(new Set([...previous, value]))
                                  : previous.filter((entry) => entry !== value)
                              )
                            }
                          />
                          <span>{readString(permission, ["display_name", "name"])}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </fieldset>
            </div>

            {membersError ? <p className="mt-3 text-sm text-rose-600">{membersError}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setEditingMember(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white transition hover:brightness-95 disabled:opacity-60"
                disabled={saving}
                onClick={() => void saveMemberAccess()}
              >
                {saving ? "Saving..." : "Save Access"}
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
