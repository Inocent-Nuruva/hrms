"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";
import { SiteHeader } from "@/components/site-header";
import { SupportChatWidget } from "@/components/support-chat-widget";
import { accessControlSectionTabGroups } from "@/lib/dashboard-sections";
import {
  isHumanResourcesEmployeeRecord,
  resolveHomeDashboardKind,
} from "@/lib/dashboard-home";
import dynamic from "next/dynamic";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const DataTable = dynamic(
  () => import("@/components/data-table").then((mod) => mod.DataTable),
  { ssr: false },
);
const AccountSettingsPanel = dynamic(
  () =>
    import("@/components/dashboard/account-settings-panel").then(
      (mod) => mod.AccountSettingsPanel,
    ),
  { ssr: false },
);

const HrAnalyticsDashboard = dynamic(
  () => import("@/components/dashboard/hr-analytics-dashboard"),
  {
    ssr: false,
    loading: () => {
      // After login we already showed a loader on the sign-in screen — skip a second skeleton flash.
      if (typeof window !== "undefined") {
        try {
          if (
            window.sessionStorage.getItem("hrms.dashboard.fromLogin") === "1"
          ) {
            return null;
          }
        } catch {
          // ignore
        }
      }
      return (
        <div className="grid gap-x-4 gap-y-2 px-4 pt-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 lg:px-6">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="min-w-0 space-y-1.5 border-b border-border pb-2"
            >
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="h-8 w-14 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      );
    },
  },
);
import type {
  CatalogQueryParams,
  AdminRecord,
  AdminResourceCollections,
  AdminResourceKey,
  UsersQueryParams,
} from "@/lib/admin-api";

function loadAdminApi() {
  return import("@/lib/admin-api");
}
import { useMyProfilePhoto } from "@/lib/my-profile-photo";
import { DashboardIdentityProvider } from "@/components/dashboard/dashboard-identity";
import {
  canAccessDashboardRoute,
  clearDashboardActorSnapshot,
  persistDashboardAccessToken,
  requestDashboardAccessRefresh,
} from "@/lib/dashboard-permissions";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { authService } from "@/services/authService";
import {
  asRecord,
  isLikelyRefreshToken,
  readString,
} from "@/utils/token-utils";
import { env } from "@/lib/env";
import { AUTH_STORAGE_KEYS, ROUTES } from "@/utils/constants";
import { isSelfServiceDashboardRoute } from "@/lib/dashboard-nav";
import {
  firstVisibleSiblingOrHome,
  rememberForbiddenRoute,
} from "@/lib/forbidden-routes";
import { useHideRememberedForbiddenPath } from "@/hooks/use-forbidden-route-guard";

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken";
const LEGACY_TOKEN_STORAGE_KEY = "ess_auth_token";
const FORCE_PASSWORD_RESET_EVENT = "hrms:force-password-reset";
const DEFAULT_USERS_QUERY: Required<UsersQueryParams> = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC",
  search: "",
};
const DEFAULT_CATALOG_QUERY: Required<CatalogQueryParams> = {
  page: 1,
  limit: 20,
  search: "",
};
const DEFAULT_EMPLOYEE_PREFETCH_QUERY = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC" as const,
};
const RESOURCE_ROUTE_MAP: Record<AdminResourceKey, string> = {
  users: "/dashboard/employees/all",
  roles: "/dashboard/access-control/roles",
  permissions: "/dashboard/access-control/permissions",
  companies: "/dashboard/companies",
};

function decodeBase64Url(input: string) {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return atob(padded);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) {
    return null;
  }

  try {
    return asRecord(JSON.parse(decoded));
  } catch {
    return null;
  }
}

function getStringValue(record: AdminRecord | null, keys: string[]) {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function resolveUserAvatarUrl(...sources: Array<AdminRecord | null>) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    const direct = getStringValue(source, [
      "profile_photo_url",
      "photo_url",
      "avatar_url",
      "avatar",
      "image_url",
    ]);
    if (direct) {
      return direct;
    }

    const nestedCandidates = [
      asRecord(source.user),
      asRecord(source.company_user),
      asRecord(asRecord(source.company_user)?.user),
      asRecord(source.profile),
    ];
    for (const nested of nestedCandidates) {
      const nestedValue = getStringValue(nested, [
        "profile_photo_url",
        "photo_url",
        "avatar_url",
        "avatar",
        "image_url",
      ]);
      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
}

function collectRoleNamesFromUnknown(value: unknown, sink: Set<string>) {
  if (typeof value === "string" && value.trim()) {
    sink.add(value.trim());
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectRoleNamesFromUnknown(entry, sink));
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }

  const directRole = readString(record, [
    "name",
    "display_name",
    "title",
    "role_name",
    "roleName",
  ]);
  if (directRole) {
    sink.add(directRole);
  }

  for (const key of [
    "role",
    "roles",
    "user_roles",
    "userRoles",
    "assigned_roles",
    "assignedRoles",
    "data",
    "items",
  ]) {
    collectRoleNamesFromUnknown(record[key], sink);
  }
}

function collectAssignedRoleNames(
  value: unknown,
  sink: Set<string>,
  visited = new Set<AdminRecord>(),
) {
  const record = asRecord(value);
  if (!record || visited.has(record)) return;
  visited.add(record);

  for (const key of [
    "role",
    "roles",
    "user_roles",
    "userRoles",
    "assigned_roles",
    "assignedRoles",
  ]) {
    collectRoleNamesFromUnknown(record[key], sink);
  }

  for (const key of [
    "user",
    "company_user",
    "companyUser",
    "membership",
    "employee",
    "profile",
    "data",
    "result",
    "item",
    "dashboard",
    "fallback_dashboard",
  ]) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      nested.forEach((entry) => collectAssignedRoleNames(entry, sink, visited));
    } else {
      collectAssignedRoleNames(nested, sink, visited);
    }
  }
}

function formatRoleName(roleName: string) {
  return roleName
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface AdminDashboardViewProps {
  activeResource?: AdminResourceKey;
  showOverview?: boolean;
  showSettings?: boolean;
  useApis?: boolean;
  children?: React.ReactNode;
}

function isUnauthorizedError(errorObject: unknown) {
  if (typeof errorObject === "object" && errorObject !== null) {
    const statusValue = (
      errorObject as { status?: unknown; statusCode?: unknown }
    ).status;
    if (statusValue === 401) {
      return true;
    }
    const statusCodeValue = (
      errorObject as { status?: unknown; statusCode?: unknown }
    ).statusCode;
    if (statusCodeValue === 401) {
      return true;
    }
  }

  const message = errorObject instanceof Error ? errorObject.message : "";
  return /\b401\b|unauthorized/i.test(message);
}

function isPasswordResetRequiredMessage(message: string) {
  return /temporary password|must change.+password|change.+password before continuing|before you can continue/i.test(
    message,
  );
}

function readStoredUserPasswordChangeRequirement() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as { requiresPasswordChange?: unknown };
    return parsed.requiresPasswordChange === true;
  } catch {
    return false;
  }
}

export default function AdminDashboardView({
  activeResource,
  showOverview = false,
  showSettings = false,
  useApis = false,
  children,
}: AdminDashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const actorSnapshot = useDashboardActor();
  useHideRememberedForbiddenPath();
  const inferredActiveResource = React.useMemo(() => {
    const match = currentPath.match(
      /^\/dashboard\/(?:(?:access-control\/)?(roles|permissions)|users)(?:\/|$)/,
    );
    return (
      ((match?.[1] ?? match?.[2]) as AdminResourceKey | undefined) ?? undefined
    );
  }, [currentPath]);
  const resolvedActiveResource = activeResource ?? inferredActiveResource;
  const resolvedShowOverview = showOverview || currentPath === "/dashboard";
  const resolvedShowSettings =
    showSettings || currentPath === "/dashboard/settings";
  const resolvedUseApis = useApis || Boolean(resolvedActiveResource);
  // Keep Access Control tabs mounted in the shell so switching Devices → Roles
  // (different route trees) does not remount/refresh the tab rail.
  const showAccessControlTabs =
    currentPath === "/dashboard/roles" ||
    currentPath === "/dashboard/permissions" ||
    currentPath === "/dashboard/access-control" ||
    currentPath.startsWith("/dashboard/access-control/");
  const [token, setToken] = React.useState("");
  const [collections, setCollections] =
    React.useState<AdminResourceCollections>({
      users: [],
      roles: [],
      permissions: [],
      companies: [],
    });
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [currentAdmin, setCurrentAdmin] = React.useState<AdminRecord | null>(
    null,
  );
  const [currentEmployeeIdentity, setCurrentEmployeeIdentity] =
    React.useState<AdminRecord | null>(null);
  const [currentEmployeeProfile, setCurrentEmployeeProfile] =
    React.useState<AdminRecord | null>(null);
  const [employeeIdentityChecked, setEmployeeIdentityChecked] =
    React.useState(false);
  const [overviewRefreshKey, setOverviewRefreshKey] = React.useState(0);
  const [forcePasswordResetOpen, setForcePasswordResetOpen] =
    React.useState(false);
  const [forcePasswordResetBusy, setForcePasswordResetBusy] =
    React.useState(false);
  const [forcePasswordResetError, setForcePasswordResetError] = React.useState<
    string | null
  >(null);
  const [myCompany, setMyCompany] = React.useState<AdminRecord | null>(null);
  const [usersQuery, setUsersQuery] =
    React.useState<Required<UsersQueryParams>>(DEFAULT_USERS_QUERY);
  const [usersTotal, setUsersTotal] = React.useState<number | null>(null);
  const [usersTotalPages, setUsersTotalPages] = React.useState<number | null>(
    null,
  );
  const [catalogByResource, setCatalogByResource] = React.useState<
    Record<"roles" | "permissions", Required<CatalogQueryParams>>
  >({
    roles: { page: 1, limit: 100, search: "" },
    permissions: DEFAULT_CATALOG_QUERY,
  });
  const [catalogMeta, setCatalogMeta] = React.useState<
    Record<
      "roles" | "permissions",
      { total: number | null; totalPages: number | null }
    >
  >({
    roles: { total: null, totalPages: null },
    permissions: { total: null, totalPages: null },
  });
  const catalogQuery =
    resolvedActiveResource === "roles" ||
    resolvedActiveResource === "permissions"
      ? catalogByResource[resolvedActiveResource]
      : DEFAULT_CATALOG_QUERY;
  const catalogTotal =
    resolvedActiveResource === "roles" ||
    resolvedActiveResource === "permissions"
      ? catalogMeta[resolvedActiveResource].total
      : null;
  const catalogTotalPages =
    resolvedActiveResource === "roles" ||
    resolvedActiveResource === "permissions"
      ? catalogMeta[resolvedActiveResource].totalPages
      : null;

  const resolveStoredTokens = React.useCallback(() => {
    if (typeof window === "undefined") {
      return {
        accessToken: "",
        refreshToken: "",
      };
    }

    const adminToken =
      window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? "";
    const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens);
    const legacySessionToken =
      window.sessionStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)?.trim() ?? "";

    let authAccessToken = "";
    let authRefreshToken = "";
    if (authTokensRaw) {
      try {
        const parsed = JSON.parse(authTokensRaw) as unknown;
        if (typeof parsed === "string") {
          authAccessToken = parsed.trim();
        }
        const root = asRecord(parsed);
        const rootTokens = asRecord(root?.tokens);
        const rootData = asRecord(root?.data);
        const rootDataTokens = asRecord(rootData?.tokens);
        const candidates = [root, rootTokens, rootData, rootDataTokens];

        for (const candidate of candidates) {
          const candidateAccess = readString(candidate, [
            "accessToken",
            "access_token",
            "token",
          ]);
          const candidateRefresh = readString(candidate, [
            "refreshToken",
            "refresh_token",
          ]);
          if (candidateRefresh && !authRefreshToken) {
            authRefreshToken = candidateRefresh;
          }
          if (
            candidateAccess &&
            !isLikelyRefreshToken(
              candidateAccess,
              candidateRefresh ?? authRefreshToken,
            )
          ) {
            authAccessToken = candidateAccess;
            break;
          }
        }
      } catch {
        authAccessToken = authTokensRaw.trim();
        authRefreshToken = "";
      }
    }

    const preferredToken =
      authAccessToken ||
      (adminToken && !isLikelyRefreshToken(adminToken, authRefreshToken)
        ? adminToken
        : "") ||
      (legacySessionToken &&
      !isLikelyRefreshToken(legacySessionToken, authRefreshToken)
        ? legacySessionToken
        : "");

    if (preferredToken) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, preferredToken);
      persistDashboardAccessToken(preferredToken);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      clearDashboardActorSnapshot();
    }

    return {
      accessToken: preferredToken,
      refreshToken: authRefreshToken,
    };
  }, []);

  const clearStoredSession = React.useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.tokens);
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.user);
    window.sessionStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    clearDashboardActorSnapshot();
  }, []);

  const persistSessionTokens = React.useCallback(
    (nextAccessToken: string, nextRefreshToken: string) => {
      if (typeof window === "undefined") {
        return;
      }
      window.localStorage.setItem(TOKEN_STORAGE_KEY, nextAccessToken);
      window.localStorage.setItem(
        AUTH_STORAGE_KEYS.tokens,
        JSON.stringify({
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken,
        }),
      );
      persistDashboardAccessToken(nextAccessToken);
    },
    [],
  );

  const hydrateTokenFromStorage = React.useCallback(() => {
    return resolveStoredTokens().accessToken;
  }, [resolveStoredTokens]);

  const attemptRefreshToken = React.useCallback(async () => {
    const { refreshToken } = resolveStoredTokens();
    if (!refreshToken) {
      return "";
    }

    try {
      const response = await authService.refresh(refreshToken);
      const nextAccessToken = response.tokens.accessToken.trim();
      const nextRefreshToken = response.tokens.refreshToken.trim();
      if (!nextAccessToken || !nextRefreshToken) {
        return "";
      }
      persistSessionTokens(nextAccessToken, nextRefreshToken);
      if (response.user && typeof window !== "undefined") {
        window.localStorage.setItem(
          AUTH_STORAGE_KEYS.user,
          JSON.stringify(response.user),
        );
      }
      return nextAccessToken;
    } catch {
      return "";
    }
  }, [persistSessionTokens, resolveStoredTokens]);

  const loadData = React.useCallback(
    async function runLoadData(
      accessToken: string,
      retryOnUnauthorized = true,
    ) {
      // Use path-resolved flag so /dashboard/permissions and /dashboard/roles
      // still hit GET /api/permissions and GET /api/roles even when the layout
      // mounts AdminDashboardView without useApis/activeResource props.
      if (!resolvedUseApis) {
        setLoading(false);
        return;
      }

      if (!accessToken) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // One backend page only. Roles/permissions lists are already paginated
        // server-side — walking every page here trips the API throttle.
        const needsUsers = resolvedActiveResource === "users";
        const needsRoles = resolvedActiveResource === "roles";
        const needsPermissions = resolvedActiveResource === "permissions";

        const rolesQuery = catalogByResource.roles;
        const permissionsQuery = catalogByResource.permissions;
        const api = await loadAdminApi();
        const [usersResult, rolesResult, permissionsResult, admin] =
          await Promise.all([
            needsUsers
              ? api.listUsers(accessToken, usersQuery)
              : Promise.resolve(null),
            needsRoles
              ? api.listRolesCatalog(accessToken, rolesQuery)
              : Promise.resolve(null),
            needsPermissions
              ? api.listResourcePage(
                  "permissions",
                  accessToken,
                  permissionsQuery,
                )
              : Promise.resolve(null),
            api.getCurrentAdmin(accessToken).catch(() => null),
          ]);

        setCollections((previous) => ({
          users: usersResult ? usersResult.rows : previous.users,
          roles: rolesResult ? rolesResult.rows : previous.roles,
          permissions: permissionsResult
            ? permissionsResult.rows
            : previous.permissions,
          companies: previous.companies,
        }));
        setCurrentAdmin(admin);
        setMyCompany(null);
        if (usersResult) {
          setUsersTotal(usersResult.total);
          setUsersTotalPages(usersResult.totalPages);
        }
        if (rolesResult) {
          setCatalogMeta((previous) => ({
            ...previous,
            roles: {
              total: rolesResult.total,
              totalPages: rolesResult.totalPages,
            },
          }));
        }
        if (permissionsResult) {
          setCatalogMeta((previous) => ({
            ...previous,
            permissions: {
              total: permissionsResult.total,
              totalPages: permissionsResult.totalPages,
            },
          }));
        }
      } catch (errorObject) {
        if (retryOnUnauthorized && isUnauthorizedError(errorObject)) {
          const refreshedToken = await attemptRefreshToken();
          if (refreshedToken) {
            if (refreshedToken !== token) {
              setToken(refreshedToken);
            }
            await runLoadData(refreshedToken, false);
            return;
          }

          clearStoredSession();
          setToken("");
          setError("Your session has expired. Please log in again.");
          router.replace(ROUTES.login);
          return;
        }

        const message =
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to load dashboard data.";
        if (isPasswordResetRequiredMessage(message)) {
          setError(null);
          setForcePasswordResetOpen(true);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(FORCE_PASSWORD_RESET_EVENT));
          }
          return;
        }
        setError(message);
      } finally {
        setLoading(false);
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
      catalogByResource,
    ],
  );

  React.useEffect(() => {
    const stored = hydrateTokenFromStorage();
    if (stored) {
      setToken(stored);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, stored);
      }
    }
  }, [hydrateTokenFromStorage]);

  React.useEffect(() => {
    setRows(
      resolvedActiveResource ? (collections[resolvedActiveResource] ?? []) : [],
    );
  }, [resolvedActiveResource, collections]);

  React.useEffect(() => {
    if (
      resolvedActiveResource === "roles" ||
      resolvedActiveResource === "permissions"
    ) {
      setLoading(true);
    }
  }, [resolvedActiveResource]);

  const navigateToResource = React.useCallback(
    (resource: AdminResourceKey) => {
      const target = RESOURCE_ROUTE_MAP[resource];
      if (target) {
        router.push(target);
      }
    },
    [router],
  );

  const refreshCurrentResource = React.useCallback(async () => {
    const accessToken = resolveStoredTokens().accessToken;
    if (accessToken !== token) {
      setToken(accessToken);
    }
    await loadData(accessToken);
  }, [loadData, resolveStoredTokens, token]);

  const handleHeaderRefresh = React.useCallback(async () => {
    if (resolvedShowOverview) {
      setOverviewRefreshKey((k) => k + 1);
    }
    if (resolvedUseApis) {
      await refreshCurrentResource();
    }
    router.refresh();
  }, [resolvedShowOverview, resolvedUseApis, refreshCurrentResource, router]);

  const handleCreate = async (
    resource: AdminResourceKey,
    payload: AdminRecord,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }
    if (accessToken !== token) {
      setToken(accessToken);
    }
    const api = await loadAdminApi();
    await api.createResource(resource, accessToken, payload);
    await loadData(accessToken);
  };

  const handlePatch = async (
    resource: Exclude<AdminResourceKey, "companies">,
    id: string | number,
    payload: AdminRecord,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }
    if (accessToken !== token) {
      setToken(accessToken);
    }
    const api = await loadAdminApi();
    await api.patchResource(resource, id, accessToken, payload);
    await loadData(accessToken);
  };

  const handleDelete = async (
    resource: Exclude<AdminResourceKey, "companies">,
    id: string | number,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }
    if (accessToken !== token) {
      setToken(accessToken);
    }
    const api = await loadAdminApi();
    await api.deleteResource(resource, id, accessToken);
    await loadData(accessToken);
  };

  const handleCatalogQueryChange = (
    next: Partial<Required<CatalogQueryParams>>,
  ) => {
    if (
      resolvedActiveResource !== "roles" &&
      resolvedActiveResource !== "permissions"
    ) {
      return;
    }
    const resource = resolvedActiveResource;
    setCatalogByResource((previous) => {
      const updated = { ...previous[resource], ...next };
      if (next.search !== undefined && next.page === undefined) {
        updated.page = 1;
      }
      return { ...previous, [resource]: updated };
    });
  };

  const handleUsersQueryChange = (
    next: Partial<Required<UsersQueryParams>>,
  ) => {
    setUsersQuery((previous) => {
      const updated = { ...previous, ...next };
      const shouldResetPage =
        next.search !== undefined ||
        next.sortBy !== undefined ||
        next.sortOrder !== undefined ||
        next.limit !== undefined;
      if (shouldResetPage && next.page === undefined) {
        updated.page = 1;
      }
      return updated;
    });
  };

  const handleUpdateUser = async (
    id: string | number,
    payload: AdminRecord,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }
    if (accessToken !== token) {
      setToken(accessToken);
    }
    const api = await loadAdminApi();
    await api.updateUserById(id, accessToken, payload);
    await loadData(accessToken);
  };

  const handleChangeMyPassword = async (
    oldPassword: string,
    newPassword: string,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }
    if (accessToken !== token) {
      setToken(accessToken);
    }
    const api = await loadAdminApi();
    await api.changeCurrentUserPassword(accessToken, oldPassword, newPassword);
  };

  const handleForcedPasswordReset = React.useCallback(
    async (payload: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      setForcePasswordResetBusy(true);
      setForcePasswordResetError(null);
      try {
        await handleChangeMyPassword(payload.currentPassword, payload.newPassword);
        setForcePasswordResetOpen(false);
        clearStoredSession();
        setToken("");
        router.replace(ROUTES.login);
      } catch (err) {
        setForcePasswordResetError(
          err instanceof Error ? err.message : "Unable to update password.",
        );
      } finally {
        setForcePasswordResetBusy(false);
      }
    },
    [clearStoredSession, handleChangeMyPassword, router],
  );

  const handleUseDifferentAccountForForcedReset = React.useCallback(() => {
    setForcePasswordResetOpen(false);
    setForcePasswordResetError(null);
    clearStoredSession();
    setToken("");
    router.replace(ROUTES.login);
  }, [clearStoredSession, router]);

  const handleSetUserPassword = async (
    id: string | number,
    newPassword: string,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }
    if (accessToken !== token) {
      setToken(accessToken);
    }
    const api = await loadAdminApi();
    await api.resetUserPassword(accessToken, id, newPassword);
    await loadData(accessToken);
  };

  const handleSyncUserRoles = async (
    userId: string | number,
    addRoleIds: (string | number)[],
    removeRoleIds: (string | number)[],
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }
    if (accessToken !== token) {
      setToken(accessToken);
    }

    const api = await loadAdminApi();
    for (const roleId of addRoleIds) {
      await api.assignRoleToCurrentCompanyUser(accessToken, userId, roleId);
    }
    for (const roleId of removeRoleIds) {
      await api.revokeRoleFromCurrentCompanyUser(accessToken, userId, roleId);
    }
    await loadData(accessToken);
    requestDashboardAccessRefresh();
  };

  const [clientIdentity, setClientIdentity] = React.useState<{
    adminName: string | null;
    adminEmail: string | null;
    companyName: string | null;
    tokenCompanyName: string | null;
    rawUser: AdminRecord | null;
    tokenPayload: AdminRecord | null;
  }>({
    adminName: null,
    adminEmail: null,
    companyName: null,
    tokenCompanyName: null,
    rawUser: null,
    tokenPayload: null,
  });
  const [identityReady, setIdentityReady] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let adminName: string | null = null;
    let adminEmail: string | null = null;
    let companyName: string | null = null;
    let parsedUser: AdminRecord | null = null;

    const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user);
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser) as unknown;
        const root = asRecord(parsed);
        parsedUser = root;
        const companyCandidates = [
          root,
          asRecord(root?.company),
          asRecord(root?.organization),
          asRecord(root?.tenant),
        ];

        for (const candidate of companyCandidates) {
          const value = readString(candidate, [
            "companyName",
            "company_name",
            "display_name",
            "company",
            "organization_name",
            "tenant_name",
            "name",
          ]);
          if (value) {
            companyName = value;
            break;
          }
        }

        const composedAdminName =
          [
            readString(root, ["firstName", "first_name"]),
            readString(root, ["lastName", "last_name"]),
          ]
            .filter(Boolean)
            .join(" ")
            .trim() || null;
        adminName =
          readString(root, ["fullName", "full_name", "name"]) ??
          composedAdminName;
        adminEmail = readString(root, ["email"]) ?? null;
      } catch {
        adminName = null;
        adminEmail = null;
        companyName = null;
      }
    }

    const accessToken = resolveStoredTokens().accessToken;
    const payload = accessToken ? decodeJwtPayload(accessToken) : null;
    const tokenCompanyName =
      readString(payload, [
        "companyName",
        "company_name",
        "company",
        "organization_name",
      ]) ?? null;
    setClientIdentity({
      adminName,
      adminEmail,
      companyName,
      tokenCompanyName,
      rawUser: parsedUser,
      tokenPayload: payload,
    });
    setIdentityReady(true);
  }, [resolveStoredTokens]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromStoredUser = () => {
      setForcePasswordResetOpen(Boolean(token) && readStoredUserPasswordChangeRequirement());
    };
    const openFromApiGuard = () => {
      setForcePasswordResetOpen(Boolean(token));
    };

    syncFromStoredUser();
    window.addEventListener("focus", syncFromStoredUser);
    window.addEventListener(FORCE_PASSWORD_RESET_EVENT, openFromApiGuard);

    return () => {
      window.removeEventListener("focus", syncFromStoredUser);
      window.removeEventListener(FORCE_PASSWORD_RESET_EVENT, openFromApiGuard);
    };
  }, [token]);

  const adminName =
    getStringValue(currentAdmin, ["full_name", "fullName", "name"]) ??
    ([
      getStringValue(currentAdmin, ["first_name"]),
      getStringValue(currentAdmin, ["last_name"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
      null) ??
    clientIdentity.adminName ??
    null;
  const adminEmail =
    getStringValue(currentAdmin, ["email"]) ??
    clientIdentity.adminEmail ??
    null;
  const { url: myProfilePhotoUrl } = useMyProfilePhoto(token);
  const adminAvatar =
    myProfilePhotoUrl ||
    resolveUserAvatarUrl(
      currentAdmin,
      currentEmployeeProfile,
      currentEmployeeIdentity,
      clientIdentity.rawUser,
      clientIdentity.tokenPayload,
    ) ||
    null;
  const companyName =
    getStringValue(myCompany, ["company_name", "name", "display_name"]) ??
    getStringValue(currentAdmin, ["company_name", "companyName", "company"]) ??
    clientIdentity.companyName ??
    clientIdentity.tokenCompanyName ??
    null;
  const adminRolesLabel = React.useMemo(() => {
    const roleNames = new Set<string>();
    actorSnapshot.roleNames.forEach((roleName) => roleNames.add(roleName));
    collectAssignedRoleNames(currentAdmin, roleNames);
    collectAssignedRoleNames(currentEmployeeProfile, roleNames);
    collectAssignedRoleNames(currentEmployeeIdentity, roleNames);
    collectAssignedRoleNames(clientIdentity.rawUser, roleNames);
    collectAssignedRoleNames(clientIdentity.tokenPayload, roleNames);

    const orderedNames = Array.from(
      new Set(
        Array.from(roleNames)
          .filter(Boolean)
          .map((roleName) => formatRoleName(roleName)),
      ),
    )
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    if (orderedNames.length === 0) {
      return null;
    }

    return orderedNames.join(" • ");
  }, [
    actorSnapshot.roleNames,
    clientIdentity.rawUser,
    clientIdentity.tokenPayload,
    currentAdmin,
    currentEmployeeIdentity,
    currentEmployeeProfile,
  ]);
  const accessMode = actorSnapshot.accessMode;
  const effectivePermissionLabels = actorSnapshot.permissionLabels;
  const accessIdentityReady = identityReady && actorSnapshot.ready;
  const homeDashboardKind = resolveHomeDashboardKind({
    accessMode,
    scope: actorSnapshot.scope,
    permissionLabels: effectivePermissionLabels,
    roleNames: actorSnapshot.roleNames,
  });
  React.useEffect(() => {
    if (
      !accessIdentityReady ||
      !token ||
      actorSnapshot.scope === "platform" ||
      homeDashboardKind !== "employee"
    ) {
      setCurrentEmployeeIdentity(null);
      setCurrentEmployeeProfile(null);
      setEmployeeIdentityChecked(homeDashboardKind !== "employee");
      return;
    }

    let active = true;
    setEmployeeIdentityChecked(false);
    void loadAdminApi()
      .then(async (api) => {
        const [employee, profile] = await Promise.all([
          api.getCurrentEmployee(token).catch(() => null),
          api.getMyProfile(token).catch(() => null),
        ]);
        let identity = employee;

        // The employee dashboard endpoint is the authoritative source used by
        // the employee home itself and can contain a richer nested department.
        if (!isHumanResourcesEmployeeRecord(identity)) {
          const dashboard = await api.getEmployeeDashboard(token).catch(() => null);
          if (isHumanResourcesEmployeeRecord(dashboard)) identity = dashboard;
        }

        if (!isHumanResourcesEmployeeRecord(identity)) {
          const fallbackDashboard = await api.getMyDashboard(token).catch(() => null);
          if (isHumanResourcesEmployeeRecord(fallbackDashboard)) {
            identity = fallbackDashboard;
          }
        }

        return { identity, profile };
      })
      .then(({ identity, profile }) => {
        if (!active) return;
        setCurrentEmployeeIdentity(identity);
        setCurrentEmployeeProfile(profile);
      })
      .catch(() => {
        if (!active) return;
        setCurrentEmployeeIdentity(null);
        setCurrentEmployeeProfile(null);
      })
      .finally(() => {
        if (active) setEmployeeIdentityChecked(true);
      });

    return () => {
      active = false;
    };
  }, [accessIdentityReady, actorSnapshot.scope, homeDashboardKind, token]);

  const effectiveHomeDashboardKind =
    homeDashboardKind === "employee" &&
    isHumanResourcesEmployeeRecord(currentEmployeeIdentity)
      ? "hr"
      : homeDashboardKind;
  const showWorkforceDashboard =
    accessIdentityReady &&
    (effectiveHomeDashboardKind === "company" || effectiveHomeDashboardKind === "hr");
  const checkingEmployeeDashboardIdentity =
    accessIdentityReady && homeDashboardKind === "employee" && !employeeIdentityChecked;

  React.useEffect(() => {
    if (!resolvedUseApis || !accessIdentityReady || !token) {
      return;
    }
    void loadData(token);
  }, [
    accessMode,
    currentPath,
    effectivePermissionLabels,
    accessIdentityReady,
    token,
    loadData,
    resolvedUseApis,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (accessMode !== "admin" || actorSnapshot.scope === "platform" || !token) {
      return;
    }

    const prefetchEmployees = () => {
      void loadAdminApi()
        .then((api) =>
          api.listEmployees(token, DEFAULT_EMPLOYEE_PREFETCH_QUERY, {
            cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
          }),
        )
        .catch(() => undefined);
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(prefetchEmployees, {
        timeout: 2500,
      });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(prefetchEmployees, 600);
    return () => globalThis.clearTimeout(timeoutId);
  }, [accessMode, actorSnapshot.scope, token]);

  React.useEffect(() => {
    if (!accessIdentityReady) {
      return;
    }

    if (currentPath === "/dashboard") {
      return;
    }

    if (isSelfServiceDashboardRoute(currentPath)) {
      return;
    }

    if (
      !canAccessDashboardRoute(
        currentPath,
        effectivePermissionLabels,
        accessMode,
      )
    ) {
      rememberForbiddenRoute(currentPath);
      router.replace(
        firstVisibleSiblingOrHome(
          currentPath,
          effectivePermissionLabels,
          accessMode,
        ),
      );
    }
  }, [
    accessMode,
    currentPath,
    effectivePermissionLabels,
    accessIdentityReady,
    router,
  ]);

  return (
    <DashboardIdentityProvider
      value={{
        name: adminName,
        photoUrl: adminAvatar,
        rolesLabel: adminRolesLabel,
      }}
    >
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
        scope={actorSnapshot.scope}
        homeDashboardKind={effectiveHomeDashboardKind}
        identityReady={accessIdentityReady}
        permissionLabels={effectivePermissionLabels}
        activeResource={resolvedActiveResource}
        onSelectResource={navigateToResource}
      />
      <SidebarInset className="min-w-0 overflow-hidden">
        {/* Header stays pinned; only this page body scrolls (single scrollbar). */}
        <SiteHeader
          onRefresh={handleHeaderRefresh}
          loading={loading}
          adminName={adminName}
          companyName={companyName}
          scope={actorSnapshot.scope}
        />
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <div className="@container/main flex min-w-0 max-w-full flex-col">
            {resolvedShowOverview && showWorkforceDashboard ? (
              <HrAnalyticsDashboard
                refreshKey={overviewRefreshKey}
                companyName={companyName}
                adminRolesLabel={adminRolesLabel}
                userName={adminName}
                profilePhotoUrl={adminAvatar}
              />
            ) : null}
            <div className="flex min-w-0 max-w-full flex-col gap-3 px-3 pt-0 pb-3 sm:px-4 md:gap-4 md:px-4 md:pb-4">
              {accessIdentityReady && showAccessControlTabs ? (
                <DashboardSectionTabs groups={accessControlSectionTabGroups} />
              ) : null}
              <div className="min-w-0">
                {accessIdentityReady ? (
                  resolvedShowOverview &&
                  (showWorkforceDashboard || checkingEmployeeDashboardIdentity) ? null : (
                    children
                  )
                ) : (
                  <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                    Checking your access…
                  </div>
                )}
              </div>
              {accessIdentityReady &&
              resolvedActiveResource &&
              resolvedUseApis &&
              resolvedActiveResource !== "companies" ? (
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
                  catalogQuery={catalogQuery}
                  catalogTotal={catalogTotal}
                  catalogTotalPages={catalogTotalPages}
                  onCatalogQueryChange={handleCatalogQueryChange}
                  loading={
                    loading ||
                    ((resolvedActiveResource === "roles" ||
                      resolvedActiveResource === "permissions") &&
                      !token)
                  }
                  error={error}
                  onCreate={handleCreate}
                  onPatch={handlePatch}
                  onDelete={handleDelete}
                  onUpdateUser={handleUpdateUser}
                  onSetUserPassword={handleSetUserPassword}
                  onSyncUserRoles={handleSyncUserRoles}
                  onRefresh={refreshCurrentResource}
                />
              ) : null}
              {accessIdentityReady && resolvedShowSettings ? (
                <AccountSettingsPanel
                  token={token}
                  loading={loading}
                  onChangeMyPassword={handleChangeMyPassword}
                  profilePhotoUrl={adminAvatar}
                  displayName={adminName}
                  profilePictureHref={
                    accessMode === "employee"
                      ? "/dashboard/me/profile?tab=summary&edit=profile-photo"
                      : null
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      </SidebarInset>
        <Dialog open={forcePasswordResetOpen}>
          <DialogPopup
            className="w-[min(94vw,440px)] border-primary/20 p-0"
            showCloseButton={false}
          >
            <div className="overflow-hidden rounded-[inherit]">
              <div className="bg-gradient-to-br from-primary via-primary to-[#18195f] px-6 py-5 text-primary-foreground">
                <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
                  <ShieldCheck className="size-5" />
                </div>
                <DialogHeader>
                  <DialogTitle className="text-lg text-primary-foreground">
                    Change your temporary password
                  </DialogTitle>
                  <DialogDescription className="text-primary-foreground/75">
                    Your account was reset by an administrator. Set a new password
                    here before continuing.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="bg-card p-6">
                <ChangePasswordForm
                  onSubmit={handleForcedPasswordReset}
                  loading={forcePasswordResetBusy}
                  error={forcePasswordResetError}
                  requiredMode
                  onUseDifferentAccount={handleUseDifferentAccountForForcedReset}
                />
              </div>
            </div>
          </DialogPopup>
        </Dialog>
        <SupportChatWidget />
      </SidebarProvider>
    </DashboardIdentityProvider>
  );
}
