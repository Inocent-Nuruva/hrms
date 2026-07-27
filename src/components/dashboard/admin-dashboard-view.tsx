"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { DataTable } from "@/components/data-table"
import { AccountSettingsPanel } from "@/components/dashboard/account-settings-panel"
import { SiteHeader } from "@/components/site-header"
import dynamic from "next/dynamic"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const HrAnalyticsDashboard = dynamic(
  () => import("@/components/dashboard/hr-analytics-dashboard"),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-x-4 gap-y-2 px-4 pt-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 lg:px-6">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="min-w-0 space-y-1.5 border-b border-border pb-2">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-8 w-14 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    ),
  }
)
import {
  createResource,
  deleteResource,
  assignRoleToUser,
  changeCurrentUserPassword,
  getCurrentAdmin,
  listEmployees,
  listResource,
  listUsers,
  patchResource,
  revokeRoleFromUser,
  updateUserById,
  type AdminRecord,
  type AdminResourceCollections,
  type AdminResourceKey,
  type UsersQueryParams,
} from "@/lib/admin-api"
import { useMyProfilePhoto } from "@/lib/my-profile-photo"
import {
  buildDashboardActorSnapshotFromSources,
  canAccessDashboardRoute,
  clearDashboardActorSnapshot,
  persistDashboardAccessToken,
  publishDashboardActorSnapshot,
} from "@/lib/dashboard-permissions"
import { authService } from "@/services/authService"
import { asRecord, isLikelyRefreshToken, readString } from "@/utils/token-utils"
import { AUTH_STORAGE_KEYS, ROUTES } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const LEGACY_TOKEN_STORAGE_KEY = "ess_auth_token"
const DEFAULT_USERS_QUERY: Required<UsersQueryParams> = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC",
  search: "",
}
const DEFAULT_EMPLOYEE_PREFETCH_QUERY = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC" as const,
}
const RESOURCE_ROUTE_MAP: Record<AdminResourceKey, string> = {
  users: "/dashboard/employees/all",
  roles: "/dashboard/access-control/roles",
  permissions: "/dashboard/access-control/permissions",
  companies: "/dashboard/companies",
}

const SELF_SERVICE_HOME_ROUTE = "/dashboard"
function decodeBase64Url(input: string) {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    return atob(padded)
  } catch {
    return null
  }
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[1]) {
    return null
  }

  const decoded = decodeBase64Url(parts[1])
  if (!decoded) {
    return null
  }

  try {
    return asRecord(JSON.parse(decoded))
  } catch {
    return null
  }
}

function getStringValue(record: AdminRecord | null, keys: string[]) {
  if (!record) {
    return null
  }
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return null
}

function resolveUserAvatarUrl(...sources: Array<AdminRecord | null>) {
  for (const source of sources) {
    if (!source) {
      continue
    }

    const direct = getStringValue(source, [
      "profile_photo_url",
      "photo_url",
      "avatar_url",
      "avatar",
      "image_url",
    ])
    if (direct) {
      return direct
    }

    const nestedCandidates = [
      asRecord(source.user),
      asRecord(source.company_user),
      asRecord(asRecord(source.company_user)?.user),
      asRecord(source.profile),
    ]
    for (const nested of nestedCandidates) {
      const nestedValue = getStringValue(nested, [
        "profile_photo_url",
        "photo_url",
        "avatar_url",
        "avatar",
        "image_url",
      ])
      if (nestedValue) {
        return nestedValue
      }
    }
  }

  return null
}

function collectRoleNamesFromUnknown(value: unknown, sink: Set<string>) {
  if (typeof value === "string" && value.trim()) {
    sink.add(value.trim())
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectRoleNamesFromUnknown(entry, sink))
    return
  }

  const record = asRecord(value)
  if (!record) {
    return
  }

  const directRole = readString(record, ["name", "display_name", "title", "role_name", "roleName"])
  if (directRole) {
    sink.add(directRole)
  }

  for (const key of ["role", "roles", "user_roles", "userRoles", "assigned_roles", "assignedRoles", "data", "items"]) {
    collectRoleNamesFromUnknown(record[key], sink)
  }
}

function formatRoleName(roleName: string) {
  return roleName
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function collectPermissionLabelsFromUnknown(value: unknown, sink: Set<string>) {
  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().toLowerCase()
    const looksLikePermission =
      normalized.includes(":") ||
      normalized.startsWith("view_") ||
      normalized.startsWith("create_") ||
      normalized.startsWith("update_") ||
      normalized.startsWith("delete_") ||
      normalized.startsWith("manage_")
    if (looksLikePermission) {
      sink.add(normalized)
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectPermissionLabelsFromUnknown(entry, sink))
    return
  }

  const record = asRecord(value)
  if (!record) {
    return
  }

  const direct = readString(record, ["name", "key", "code", "slug", "permission", "action"])
  if (direct) {
    collectPermissionLabelsFromUnknown(direct, sink)
  }

  for (const key of [
    "permissions",
    "permission",
    "authorities",
    "scopes",
    "actions",
    "role_permissions",
    "rolePermissions",
    "granted_permissions",
    "grantedPermissions",
    "data",
    "items",
    "records",
    "results",
    "user",
    "profile",
    "meta",
  ]) {
    collectPermissionLabelsFromUnknown(record[key], sink)
  }

  for (const nestedValue of Object.values(record)) {
    if (typeof nestedValue === "object" && nestedValue !== null) {
      collectPermissionLabelsFromUnknown(nestedValue, sink)
    }
  }
}

function resolvePermissionLabels(root: AdminRecord | null) {
  const labels = new Set<string>()
  if (!root) {
    return labels
  }

  for (const key of [
    "permissions",
    "permission",
    "authorities",
    "scopes",
    "actions",
    "role_permissions",
    "rolePermissions",
  ]) {
    collectPermissionLabelsFromUnknown(root[key], labels)
  }

  collectPermissionLabelsFromUnknown(root.role, labels)
  collectPermissionLabelsFromUnknown(root.roles, labels)

  return labels
}

interface AdminDashboardViewProps {
  activeResource?: AdminResourceKey
  showOverview?: boolean
  showSettings?: boolean
  useApis?: boolean
  children?: React.ReactNode
}

function isUnauthorizedError(errorObject: unknown) {
  if (typeof errorObject === "object" && errorObject !== null) {
    const statusValue = (errorObject as { status?: unknown; statusCode?: unknown }).status
    if (statusValue === 401) {
      return true
    }
    const statusCodeValue = (errorObject as { status?: unknown; statusCode?: unknown }).statusCode
    if (statusCodeValue === 401) {
      return true
    }
  }

  const message = errorObject instanceof Error ? errorObject.message : ""
  return /\b401\b|unauthorized/i.test(message)
}

export default function AdminDashboardView({
  activeResource,
  showOverview = false,
  showSettings = false,
  useApis = false,
  children,
}: AdminDashboardViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const currentPath = pathname ?? ""
  const inferredActiveResource = React.useMemo(() => {
    const match = currentPath.match(
      /^\/dashboard\/(?:(?:access-control\/)?(roles|permissions)|(users|companies))(?:\/|$)/
    )
    return ((match?.[1] ?? match?.[2]) as AdminResourceKey | undefined) ?? undefined
  }, [currentPath])
  const resolvedActiveResource = activeResource ?? inferredActiveResource
  const resolvedShowOverview = showOverview || currentPath === "/dashboard"
  const resolvedShowSettings = showSettings || currentPath === "/dashboard/settings"
  const resolvedUseApis = useApis || Boolean(resolvedActiveResource)
  const [token, setToken] = React.useState("")
  const [collections, setCollections] = React.useState<AdminResourceCollections>({
    users: [],
    roles: [],
    permissions: [],
    companies: [],
  })
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [currentAdmin, setCurrentAdmin] = React.useState<AdminRecord | null>(null)
  const [overviewRefreshKey, setOverviewRefreshKey] = React.useState(0)
  const [myCompany, setMyCompany] = React.useState<AdminRecord | null>(null)
  const [usersQuery, setUsersQuery] =
    React.useState<Required<UsersQueryParams>>(DEFAULT_USERS_QUERY)
  const [usersTotal, setUsersTotal] = React.useState<number | null>(null)
  const [usersTotalPages, setUsersTotalPages] = React.useState<number | null>(null)

  const resolveStoredTokens = React.useCallback(() => {
    if (typeof window === "undefined") {
      return {
        accessToken: "",
        refreshToken: "",
      }
    }

    const adminToken = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
    const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
    const legacySessionToken = window.sessionStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)?.trim() ?? ""

    let authAccessToken = ""
    let authRefreshToken = ""
    if (authTokensRaw) {
      try {
        const parsed = JSON.parse(authTokensRaw) as unknown
        if (typeof parsed === "string") {
          authAccessToken = parsed.trim()
        }
        const root = asRecord(parsed)
        const rootTokens = asRecord(root?.tokens)
        const rootData = asRecord(root?.data)
        const rootDataTokens = asRecord(rootData?.tokens)
        const candidates = [root, rootTokens, rootData, rootDataTokens]

        for (const candidate of candidates) {
          const candidateAccess = readString(candidate, ["accessToken", "access_token", "token"])
          const candidateRefresh = readString(candidate, ["refreshToken", "refresh_token"])
          if (candidateRefresh && !authRefreshToken) {
            authRefreshToken = candidateRefresh
          }
          if (
            candidateAccess &&
            !isLikelyRefreshToken(candidateAccess, candidateRefresh ?? authRefreshToken)
          ) {
            authAccessToken = candidateAccess
            break
          }
        }
      } catch {
        authAccessToken = authTokensRaw.trim()
        authRefreshToken = ""
      }
    }

    const preferredToken =
      authAccessToken ||
      (adminToken && !isLikelyRefreshToken(adminToken, authRefreshToken) ? adminToken : "") ||
      (legacySessionToken && !isLikelyRefreshToken(legacySessionToken, authRefreshToken)
        ? legacySessionToken
        : "")

    if (preferredToken) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, preferredToken)
      persistDashboardAccessToken(preferredToken)
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
      clearDashboardActorSnapshot()
    }

    return {
      accessToken: preferredToken,
      refreshToken: authRefreshToken,
    }
  }, [])

  const clearStoredSession = React.useCallback(() => {
    if (typeof window === "undefined") {
      return
    }
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.tokens)
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.user)
    window.sessionStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY)
    clearDashboardActorSnapshot()
  }, [])

  const persistSessionTokens = React.useCallback((nextAccessToken: string, nextRefreshToken: string) => {
    if (typeof window === "undefined") {
      return
    }
    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextAccessToken)
    window.localStorage.setItem(
      AUTH_STORAGE_KEYS.tokens,
      JSON.stringify({
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
      })
    )
    persistDashboardAccessToken(nextAccessToken)
  }, [])

  const hydrateTokenFromStorage = React.useCallback(() => {
    return resolveStoredTokens().accessToken
  }, [resolveStoredTokens])

  const attemptRefreshToken = React.useCallback(async () => {
    const { refreshToken } = resolveStoredTokens()
    if (!refreshToken) {
      return ""
    }

    try {
      const response = await authService.refresh(refreshToken)
      const nextAccessToken = response.tokens.accessToken.trim()
      const nextRefreshToken = response.tokens.refreshToken.trim()
      if (!nextAccessToken || !nextRefreshToken) {
        return ""
      }
      persistSessionTokens(nextAccessToken, nextRefreshToken)
      return nextAccessToken
    } catch {
      return ""
    }
  }, [persistSessionTokens, resolveStoredTokens])

  const loadData = React.useCallback(
    async function runLoadData(accessToken: string, retryOnUnauthorized = true) {
      // Use path-resolved flag so /dashboard/permissions and /dashboard/roles
      // still hit GET /api/permissions and GET /api/roles even when the layout
      // mounts AdminDashboardView without useApis/activeResource props.
      if (!resolvedUseApis) {
        setCollections({ users: [], roles: [], permissions: [], companies: [] })
        setRows([])
        setCurrentAdmin(null)
        setMyCompany(null)
        setUsersTotal(null)
        setUsersTotalPages(null)
        setError(null)
        setLoading(false)
        return
      }

      if (!accessToken) {
        setCollections({ users: [], roles: [], permissions: [], companies: [] })
        setRows([])
        setCurrentAdmin(null)
        setMyCompany(null)
        setUsersTotal(null)
        setUsersTotalPages(null)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [usersResult, roles, permissions, admin] = await Promise.all([
          listUsers(accessToken, usersQuery),
          listResource("roles", accessToken).catch(() => []),
          // Catalog from GET /api/permissions (all permissions visible to actor)
          listResource("permissions", accessToken).catch(() => []),
          getCurrentAdmin(accessToken).catch(() => null),
        ])

        const fetchedCollections: AdminResourceCollections = {
          users: usersResult.rows,
          roles,
          permissions,
          companies: [],
        }
        setCollections(fetchedCollections)
        setRows(
          resolvedActiveResource
            ? fetchedCollections[resolvedActiveResource] ?? []
            : []
        )
        setCurrentAdmin(admin)
        setMyCompany(null)
        setUsersTotal(usersResult.total)
        setUsersTotalPages(usersResult.totalPages)
      } catch (errorObject) {
        if (retryOnUnauthorized && isUnauthorizedError(errorObject)) {
          const refreshedToken = await attemptRefreshToken()
          if (refreshedToken) {
            if (refreshedToken !== token) {
              setToken(refreshedToken)
            }
            await runLoadData(refreshedToken, false)
            return
          }

          clearStoredSession()
          setToken("")
          setError("Your session has expired. Please log in again.")
          router.replace(ROUTES.login)
          return
        }

        const message =
          errorObject instanceof Error ? errorObject.message : "Failed to load dashboard data."
        setError(message)
        setCollections({ users: [], roles: [], permissions: [], companies: [] })
        setRows([])
        setUsersTotal(null)
        setUsersTotalPages(null)
      } finally {
        setLoading(false)
      }
    },
    [
      attemptRefreshToken,
      clearStoredSession,
      resolvedActiveResource,
      resolvedUseApis,
      router,
      token,
      usersQuery,
    ]
  )

  React.useEffect(() => {
    const stored = hydrateTokenFromStorage()
    if (stored) {
      setToken(stored)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, stored)
      }
    }
  }, [hydrateTokenFromStorage])

  React.useEffect(() => {
    if (!resolvedUseApis) {
      return
    }
    void loadData(token)
  }, [token, loadData, resolvedUseApis])

  React.useEffect(() => {
    setRows(resolvedActiveResource ? collections[resolvedActiveResource] ?? [] : [])
  }, [resolvedActiveResource, collections])

  const navigateToResource = React.useCallback(
    (resource: AdminResourceKey) => {
      const target = RESOURCE_ROUTE_MAP[resource]
      if (target) {
        router.push(target)
      }
    },
    [router]
  )

  const refreshCurrentResource = React.useCallback(async () => {
    const accessToken = resolveStoredTokens().accessToken
    if (accessToken !== token) {
      setToken(accessToken)
    }
    await loadData(accessToken)
  }, [loadData, resolveStoredTokens, token])

  const handleHeaderRefresh = React.useCallback(async () => {
    if (resolvedShowOverview) {
      setOverviewRefreshKey((k) => k + 1)
    }
    if (resolvedUseApis) {
      await refreshCurrentResource()
    }
    router.refresh()
  }, [resolvedShowOverview, resolvedUseApis, refreshCurrentResource, router])

  const handleCreate = async (resource: AdminResourceKey, payload: AdminRecord) => {
    const accessToken = resolveStoredTokens().accessToken
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.")
    }
    if (accessToken !== token) {
      setToken(accessToken)
    }
    await createResource(resource, accessToken, payload)
    await loadData(accessToken)
  }

  const handlePatch = async (
    resource: Exclude<AdminResourceKey, "companies">,
    id: string | number,
    payload: AdminRecord
  ) => {
    const accessToken = resolveStoredTokens().accessToken
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.")
    }
    if (accessToken !== token) {
      setToken(accessToken)
    }
    await patchResource(resource, id, accessToken, payload)
    await loadData(accessToken)
  }

  const handleDelete = async (
    resource: Exclude<AdminResourceKey, "companies">,
    id: string | number
  ) => {
    const accessToken = resolveStoredTokens().accessToken
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.")
    }
    if (accessToken !== token) {
      setToken(accessToken)
    }
    await deleteResource(resource, id, accessToken)
    await loadData(accessToken)
  }

  const handleUsersQueryChange = (next: Partial<Required<UsersQueryParams>>) => {
    setUsersQuery((previous) => {
      const updated = { ...previous, ...next }
      const shouldResetPage =
        next.search !== undefined ||
        next.sortBy !== undefined ||
        next.sortOrder !== undefined ||
        next.limit !== undefined
      if (shouldResetPage && next.page === undefined) {
        updated.page = 1
      }
      return updated
    })
  }

  const handleUpdateUser = async (id: string | number, payload: AdminRecord) => {
    const accessToken = resolveStoredTokens().accessToken
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.")
    }
    if (accessToken !== token) {
      setToken(accessToken)
    }
    await updateUserById(id, accessToken, payload)
    await loadData(accessToken)
  }

  const handleChangeMyPassword = async (oldPassword: string, newPassword: string) => {
    const accessToken = resolveStoredTokens().accessToken
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.")
    }
    if (accessToken !== token) {
      setToken(accessToken)
    }
    await changeCurrentUserPassword(accessToken, oldPassword, newPassword)
  }

  const handleSetUserPassword = async (id: string | number, newPassword: string) => {
    const accessToken = resolveStoredTokens().accessToken
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.")
    }
    if (accessToken !== token) {
      setToken(accessToken)
    }
    await updateUserById(id, accessToken, { password: newPassword })
    await loadData(accessToken)
  }

  const handleSyncUserRoles = async (
    userId: string | number,
    addRoleIds: (string | number)[],
    removeRoleIds: (string | number)[]
  ) => {
    const accessToken = resolveStoredTokens().accessToken
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.")
    }
    if (accessToken !== token) {
      setToken(accessToken)
    }

    for (const roleId of addRoleIds) {
      await assignRoleToUser(accessToken, userId, roleId)
    }
    for (const roleId of removeRoleIds) {
      await revokeRoleFromUser(accessToken, userId, roleId)
    }
    await loadData(accessToken)
  }

  const [clientIdentity, setClientIdentity] = React.useState<{
    adminName: string | null
    adminEmail: string | null
    companyName: string | null
    tokenCompanyName: string | null
    permissionLabels: string[]
    rawUser: AdminRecord | null
    tokenPayload: AdminRecord | null
  }>({
    adminName: null,
    adminEmail: null,
    companyName: null,
    tokenCompanyName: null,
    permissionLabels: [],
    rawUser: null,
    tokenPayload: null,
  })
  const [identityReady, setIdentityReady] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    let adminName: string | null = null
    let adminEmail: string | null = null
    let companyName: string | null = null
    let parsedUser: AdminRecord | null = null
    const permissionLabels = new Set<string>()

    const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser) as unknown
        const root = asRecord(parsed)
        parsedUser = root
        const companyCandidates = [
          root,
          asRecord(root?.company),
          asRecord(root?.organization),
          asRecord(root?.tenant),
        ]

        for (const candidate of companyCandidates) {
          const value = readString(candidate, [
            "companyName",
            "company_name",
            "display_name",
            "company",
            "organization_name",
            "tenant_name",
            "name",
          ])
          if (value) {
            companyName = value
            break
          }
        }

        const composedAdminName =
          [readString(root, ["firstName", "first_name"]), readString(root, ["lastName", "last_name"])]
            .filter(Boolean)
            .join(" ")
            .trim() || null
        adminName = readString(root, ["fullName", "full_name", "name"]) ?? composedAdminName
        adminEmail = readString(root, ["email"]) ?? null
        resolvePermissionLabels(root).forEach((entry) => permissionLabels.add(entry))
      } catch {
        adminName = null
        adminEmail = null
        companyName = null
      }
    }

    const accessToken = resolveStoredTokens().accessToken
    const payload = accessToken ? decodeJwtPayload(accessToken) : null
    const tokenCompanyName =
      readString(payload, [
        "companyName",
        "company_name",
        "company",
        "organization_name",
      ]) ?? null
    resolvePermissionLabels(payload).forEach((entry) => permissionLabels.add(entry))

    setClientIdentity({
      adminName,
      adminEmail,
      companyName,
      tokenCompanyName,
      permissionLabels: Array.from(permissionLabels),
      rawUser: parsedUser,
      tokenPayload: payload,
    })
    setIdentityReady(true)
  }, [resolveStoredTokens])
  const adminName =
    getStringValue(currentAdmin, ["full_name", "fullName", "name"]) ??
    ([
      getStringValue(currentAdmin, ["first_name"]),
      getStringValue(currentAdmin, ["last_name"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || null) ??
    clientIdentity.adminName ??
    null
  const adminEmail = getStringValue(currentAdmin, ["email"]) ?? clientIdentity.adminEmail ?? null
  const { url: myProfilePhotoUrl } = useMyProfilePhoto(token)
  const adminAvatar =
    myProfilePhotoUrl ||
    resolveUserAvatarUrl(currentAdmin, clientIdentity.rawUser, clientIdentity.tokenPayload) ||
    null
  const companyName =
    getStringValue(myCompany, ["company_name", "name", "display_name"]) ??
    getStringValue(currentAdmin, ["company_name", "companyName", "company"]) ??
    clientIdentity.companyName ??
    clientIdentity.tokenCompanyName ??
    null
  const adminRolesLabel = React.useMemo(() => {
    const roleNames = new Set<string>()
    collectRoleNamesFromUnknown(currentAdmin?.role, roleNames)
    collectRoleNamesFromUnknown(currentAdmin?.roles, roleNames)
    collectRoleNamesFromUnknown(clientIdentity.rawUser?.role, roleNames)
    collectRoleNamesFromUnknown(clientIdentity.rawUser?.roles, roleNames)
    collectRoleNamesFromUnknown(clientIdentity.tokenPayload?.role, roleNames)
    collectRoleNamesFromUnknown(clientIdentity.tokenPayload?.roles, roleNames)

    const orderedNames = Array.from(roleNames)
      .filter(Boolean)
      .map((roleName) => formatRoleName(roleName))
    if (orderedNames.length === 0) {
      return null
    }

    return orderedNames.join(" • ")
  }, [clientIdentity.rawUser, clientIdentity.tokenPayload, currentAdmin])
  const actorSnapshot = React.useMemo(
    () =>
      buildDashboardActorSnapshotFromSources(
        currentAdmin,
        clientIdentity.rawUser,
        clientIdentity.tokenPayload,
        clientIdentity.permissionLabels
      ),
    [
      clientIdentity.permissionLabels,
      clientIdentity.rawUser,
      clientIdentity.tokenPayload,
      currentAdmin,
    ]
  )
  const accessMode = actorSnapshot.accessMode
  const effectivePermissionLabels = actorSnapshot.permissionLabels

  React.useEffect(() => {
    if (!identityReady) {
      return
    }

    publishDashboardActorSnapshot(actorSnapshot)
  }, [actorSnapshot, identityReady])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    if (accessMode !== "admin" || !token) {
      return
    }

    const prefetchEmployees = () => {
      void listEmployees(token, DEFAULT_EMPLOYEE_PREFETCH_QUERY, {
        cacheTtlMs: 20_000,
      }).catch(() => undefined)
    }

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(prefetchEmployees, { timeout: 2500 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = globalThis.setTimeout(prefetchEmployees, 600)
    return () => globalThis.clearTimeout(timeoutId)
  }, [accessMode, token])

  React.useEffect(() => {
    if (!identityReady) {
      return
    }

    if (currentPath === "/dashboard") {
      return
    }

    if (!canAccessDashboardRoute(currentPath, effectivePermissionLabels)) {
      router.replace(SELF_SERVICE_HOME_ROUTE)
      return
    }
  }, [accessMode, currentPath, effectivePermissionLabels, identityReady, router])

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "15.75rem",
          "--header-height": "calc(var(--spacing) * 11)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        userName={adminName}
        userEmail={adminEmail}
        userAvatar={adminAvatar}
        accessMode={accessMode}
        permissionLabels={effectivePermissionLabels}
        activeResource={resolvedActiveResource}
        onSelectResource={navigateToResource}
      />
      <SidebarInset className="overflow-hidden">
        {/* Header stays pinned; only this page body scrolls (single scrollbar). */}
        <SiteHeader
          onRefresh={handleHeaderRefresh}
          loading={loading}
          adminName={adminName}
          companyName={companyName}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <div className="@container/main flex flex-col">
            {/* Overview sits flush under the top bar (full width of the content pane). */}
            {resolvedShowOverview && accessMode === "admin" ? (
              <HrAnalyticsDashboard
                refreshKey={overviewRefreshKey}
                companyName={companyName}
                adminRolesLabel={adminRolesLabel}
              />
            ) : null}
            <div className="flex flex-col gap-3 px-3 py-3 md:gap-4 md:px-4 md:py-4">
              {children}
              {resolvedActiveResource && resolvedUseApis ? (
                <DataTable
                  token={token}
                  activeResource={resolvedActiveResource}
                  rows={rows}
                  roles={collections.roles}
                  permissions={collections.permissions}
                  actorPermissions={effectivePermissionLabels}
                  usersQuery={usersQuery}
                  usersTotal={usersTotal}
                  usersTotalPages={usersTotalPages}
                  onUsersQueryChange={handleUsersQueryChange}
                  loading={loading}
                  error={error}
                  onCreate={handleCreate}
                  onPatch={handlePatch}
                  onDelete={handleDelete}
                  onUpdateUser={handleUpdateUser}
                  onSetUserPassword={handleSetUserPassword}
                  onSyncUserRoles={handleSyncUserRoles}
                />
              ) : null}
              {resolvedShowSettings ? (
                <AccountSettingsPanel
                  token={token}
                  loading={loading}
                  onChangeMyPassword={handleChangeMyPassword}
                  profilePhotoUrl={adminAvatar}
                  displayName={adminName}
                  profilePictureHref={
                    accessMode === "employee" ? "/dashboard/me/profile?tab=summary&edit=profile-photo" : null
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
