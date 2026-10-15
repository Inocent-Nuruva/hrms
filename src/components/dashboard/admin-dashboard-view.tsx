"use client";
import {
  clearStoredSession as clearSharedSession,
  persistSessionTokens as persistSharedTokens,
  readStoredSessionTokens as readSharedTokens,
} from "@/lib/session-client";

import * as React from "react";
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
} from "@/lib/auth-session-store";
import { usePathname, useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";

import {
  AppSidebar,
  resolveDashboardSearchItems,
} from "@/components/app-sidebar";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";
import { AccessSkeleton } from "@/components/ui/access-skeleton";
import { SiteHeader } from "@/components/site-header";
import {
  accessControlSectionTabGroups,
  accessGovernanceSectionTabGroups,
} from "@/lib/dashboard-sections";
import {
  isHumanResourcesEmployeeRecord,
  resolveHomeDashboardKind,
} from "@/lib/dashboard-home";
import dynamic from "next/dynamic";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const DataTable = dynamic(
  () => import("@/components/data-table").then((mod) => mod.DataTable),
  { ssr: false },
);
const SupportChatWidget = dynamic(
  () =>
    import("@/components/support-chat-widget").then(
      (mod) => mod.SupportChatWidget,
    ),
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
import {
  useMyProfilePhoto,
  withMyProfilePhotoRevision,
} from "@/lib/my-profile-photo";
import { DashboardIdentityProvider } from "@/components/dashboard/dashboard-identity";
import {
  DEFAULT_COMPANY_MODULES,
  isDashboardRouteEnabledForCompanyModules,
  PLATFORM_COMPANY_MODULES,
  publishCompanyModules,
  readPublishedCompanyModules,
  resolveCompanyDashboardModules,
} from "@/lib/company-modules";
import {
  canAccessDashboardRoute,
  clearDashboardActorSnapshot,
  persistDashboardAccessToken,
  requestDashboardAccessRefresh,
} from "@/lib/dashboard-permissions";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { authService } from "@/services/authService";
import { asRecord, readString } from "@/utils/token-utils";
import { env } from "@/lib/env";
import { AUTH_STORAGE_KEYS, ROUTES } from "@/utils/constants";
import { isSelfServiceDashboardRoute } from "@/lib/dashboard-nav";
import {
  firstVisibleSiblingOrHome,
  rememberForbiddenRoute,
} from "@/lib/forbidden-routes";
import { useHideRememberedForbiddenPath } from "@/hooks/use-forbidden-route-guard";

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
  // Keep Access Control tabs mounted in the shell so switching Devices → Roles
  // (different route trees) does not remount/refresh the tab rail.
  // Platform Access Governance is roles/permissions only — not tenant devices.
  const showAccessControlTabs =
    currentPath === "/dashboard/roles" ||
    currentPath === "/dashboard/permissions" ||
    currentPath === "/dashboard/access-control" ||
    currentPath.startsWith("/dashboard/access-control/");
  const accessControlTabGroups =
    actorSnapshot.scope === "platform"
      ? accessGovernanceSectionTabGroups
      : accessControlSectionTabGroups;
  const authSession = React.useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const token = authSession.tokens?.accessToken ?? "";
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

  const resolveStoredTokens = React.useCallback(readSharedTokens, []);

  const clearStoredSession = React.useCallback(clearSharedSession, []);
  const persistSessionTokens = React.useCallback(persistSharedTokens, []);

  const hydrateTokenFromStorage = React.useCallback(() => {
    return resolveStoredTokens().accessToken;
  }, [resolveStoredTokens]);

  const attemptRefreshToken = React.useCallback(async () => {
    const { refreshToken, accessToken: previousAccessToken } =
      resolveStoredTokens();
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
      if (
        readSharedTokens().refreshToken !== refreshToken ||
        readSharedTokens().accessToken !== previousAccessToken
      )
        return "";
      persistSessionTokens(nextAccessToken, nextRefreshToken, response.user);
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
            await runLoadData(refreshedToken, false);
            return;
          }

          clearStoredSession();

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
    setCollections({ users: [], roles: [], permissions: [], companies: [] });
    setRows([]);
    setMyCompany(null);
    setCurrentAdmin(null);
    setCurrentEmployeeIdentity(null);
    setCurrentEmployeeProfile(null);
  }, [authSession.credentialVersion]);

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
        await handleChangeMyPassword(
          payload.currentPassword,
          payload.newPassword,
        );
        setForcePasswordResetOpen(false);
        clearStoredSession();

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
  const [companyModulesReady, setCompanyModulesReady] = React.useState(false);

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
      setForcePasswordResetOpen(
        Boolean(token) && readStoredUserPasswordChangeRequirement(),
      );
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
  const { url: myProfilePhotoUrl, revision: myProfilePhotoRevision } =
    useMyProfilePhoto(token);
  const resolvedAdminAvatar =
    myProfilePhotoUrl ||
    resolveUserAvatarUrl(
      currentAdmin,
      currentEmployeeProfile,
      currentEmployeeIdentity,
      clientIdentity.rawUser,
      clientIdentity.tokenPayload,
    ) ||
    null;
  const adminAvatar = myProfilePhotoUrl
    ? withMyProfilePhotoRevision(resolvedAdminAvatar, myProfilePhotoRevision)
    : resolvedAdminAvatar;
  const companyName =
    getStringValue(myCompany, ["company_name", "name", "display_name"]) ??
    getStringValue(currentAdmin, ["company_name", "companyName", "company"]) ??
    clientIdentity.companyName ??
    clientIdentity.tokenCompanyName ??
    null;
  const adminRoleNames = React.useMemo(() => {
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
    return orderedNames;
  }, [
    actorSnapshot.roleNames,
    clientIdentity.rawUser,
    clientIdentity.tokenPayload,
    currentAdmin,
    currentEmployeeIdentity,
    currentEmployeeProfile,
  ]);
  const adminRolesLabel =
    adminRoleNames.length > 0 ? adminRoleNames.join(" • ") : null;
  const accessMode = actorSnapshot.accessMode;
  const effectivePermissionLabels = actorSnapshot.permissionLabels;
  const accessIdentityReady = identityReady && actorSnapshot.ready;

  React.useEffect(() => {
    if (!accessIdentityReady) {
      setCompanyModulesReady(false);
      return;
    }

    if (actorSnapshot.scope === "platform") {
      publishCompanyModules(PLATFORM_COMPANY_MODULES);
      setMyCompany(null);
      setCompanyModulesReady(true);
      return;
    }

    if (!token) {
      publishCompanyModules(DEFAULT_COMPANY_MODULES);
      setCompanyModulesReady(true);
      return;
    }

    let active = true;
    setCompanyModulesReady(false);
    void loadAdminApi()
      .then(async (api) => {
        const company = await api.getMyCompany(token);
        if (!active) return;
        setMyCompany(company);
        const modules = await resolveCompanyDashboardModules({
          company,
          extraIdSources: [clientIdentity.rawUser, clientIdentity.tokenPayload],
          loadModules: (id) => api.getCompanyModules(token, id),
        });
        if (!active) return;
        publishCompanyModules(modules);
      })
      .catch(() => {
        if (!active) return;
        setMyCompany(null);
        publishCompanyModules(DEFAULT_COMPANY_MODULES);
      })
      .finally(() => {
        if (active) setCompanyModulesReady(true);
      });

    return () => {
      active = false;
    };
  }, [
    accessIdentityReady,
    actorSnapshot.scope,
    clientIdentity.rawUser,
    clientIdentity.tokenPayload,
    token,
  ]);

  const navigationReady = accessIdentityReady && companyModulesReady;
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
          const dashboard = await api
            .getEmployeeDashboard(token)
            .catch(() => null);
          if (isHumanResourcesEmployeeRecord(dashboard)) identity = dashboard;
        }

        if (!isHumanResourcesEmployeeRecord(identity)) {
          const fallbackDashboard = await api
            .getMyDashboard(token)
            .catch(() => null);
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

  React.useEffect(() => {
    if (
      !resolvedShowOverview ||
      !accessIdentityReady ||
      !token ||
      currentAdmin
    ) {
      return;
    }

    let active = true;
    void loadAdminApi()
      .then((api) => api.getCurrentAdmin(token))
      .then((admin) => {
        if (active) setCurrentAdmin(admin);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [accessIdentityReady, currentAdmin, resolvedShowOverview, token]);

  const effectiveHomeDashboardKind =
    homeDashboardKind === "employee" &&
    isHumanResourcesEmployeeRecord(currentEmployeeIdentity)
      ? "hr"
      : homeDashboardKind;
  const showWorkforceDashboard =
    accessIdentityReady &&
    (effectiveHomeDashboardKind === "company" ||
      effectiveHomeDashboardKind === "hr");
  const checkingEmployeeDashboardIdentity =
    accessIdentityReady &&
    homeDashboardKind === "employee" &&
    !employeeIdentityChecked;

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

    if (
      accessMode !== "admin" ||
      actorSnapshot.scope === "platform" ||
      !token
    ) {
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
      currentPath === "/dashboard/performance" ||
      currentPath.startsWith("/dashboard/performance/")
    ) {
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
        homeDashboardKind: effectiveHomeDashboardKind,
      }}
    >
      <SidebarProvider
        style={
          {
            "--sidebar-width": "15.5rem",
            "--header-height": "calc(var(--spacing) * 14)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          accessMode={accessMode}
          scope={actorSnapshot.scope}
          homeDashboardKind={effectiveHomeDashboardKind}
          identityReady={navigationReady}
          permissionLabels={effectivePermissionLabels}
          activeResource={resolvedActiveResource}
          onSelectResource={navigateToResource}
        />
        <SidebarTrigger
          className="fixed left-3 top-2 z-[60] !hidden text-[var(--sidebar-icon-color)] transition-colors duration-200 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-active-link-color)] md:!inline-flex"
          aria-label="Toggle navigation"
          title="Navigation"
        />
        <SidebarInset className="min-w-0 overflow-hidden">
          {/* Header stays pinned; only this page body scrolls (single scrollbar). */}
          <SiteHeader
            onRefresh={handleHeaderRefresh}
            loading={loading}
            adminName={adminName}
            adminEmail={adminEmail}
            adminAvatar={adminAvatar}
            companyName={companyName}
            scope={actorSnapshot.scope}
            searchItems={
              navigationReady
                ? resolveDashboardSearchItems({
                    scope: actorSnapshot.scope,
                    permissionLabels: effectivePermissionLabels,
                    accessMode,
                    homeDashboardKind: effectiveHomeDashboardKind,
                  })
                : []
            }
          />
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
            <div className="@container/main flex min-w-0 max-w-full flex-col">
              {resolvedShowOverview && showWorkforceDashboard ? (
                <HrAnalyticsDashboard
                  refreshKey={overviewRefreshKey}
                  companyName={companyName}
                  adminRolesLabel={adminRolesLabel}
                  assignedRoleNames={adminRoleNames}
                  userName={adminName}
                  profilePhotoUrl={adminAvatar}
                  showLeaveRequests={effectiveHomeDashboardKind === "hr"}
                  showHrAnalytics={effectiveHomeDashboardKind === "hr"}
                />
              ) : null}
              <div
                className={`flex min-w-0 max-w-full flex-col px-3 pt-0 pb-3 sm:px-4 md:px-4 md:pb-4 ${showAccessControlTabs ? "gap-2 md:gap-3" : "gap-3 md:gap-4"}`}
              >
                {navigationReady && showAccessControlTabs ? (
                  <DashboardSectionTabs groups={accessControlTabGroups} />
                ) : null}
                <div className="min-w-0">
                  {accessIdentityReady ? (
                    resolvedShowOverview &&
                    (showWorkforceDashboard ||
                      checkingEmployeeDashboardIdentity) ? null : (
                      children
                    )
                  ) : (
                    <AccessSkeleton className="min-h-40" variant="dashboard" />
                  )}
                </div>
                {accessIdentityReady &&
                resolvedActiveResource &&
                resolvedUseApis &&
                resolvedActiveResource !== "companies" &&
                (resolvedActiveResource !== "roles" &&
                resolvedActiveResource !== "permissions"
                  ? true
                  : navigationReady &&
                    isDashboardRouteEnabledForCompanyModules(
                      `/dashboard/${resolvedActiveResource}`,
                      readPublishedCompanyModules(),
                    )) ? (
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
                      actorSnapshot.scope !== "platform"
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
            className="!h-dvh !w-screen !max-w-none !max-h-none !rounded-none !border-0 !p-0"
            bodyClassName="!h-full !max-h-none !gap-0 !overflow-y-auto !p-0"
            showCloseButton={false}
          >
            <div className="relative flex min-h-full w-full items-center justify-center bg-background p-3 text-card-foreground sm:p-5 lg:p-8">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
              <div className="fixed right-3 top-3 z-20 md:right-4 md:top-4">
                <ThemeTogglerButton
                  variant="ghost"
                  size="icon-sm"
                  modes={["light", "dark", "system"]}
                  className="!border-0 !bg-transparent text-foreground !shadow-none hover:!bg-transparent"
                />
              </div>
              <div className="relative z-10 w-full max-w-[860px] py-8 sm:py-10">
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xl md:grid md:min-h-[min(640px,calc(100dvh-4rem))] md:grid-cols-2">
                  <section
                    className="relative hidden flex-col justify-between overflow-hidden p-8 text-white md:flex lg:p-10"
                    style={{ backgroundColor: "var(--colorBrandBackground)" }}
                    aria-label="Alliance HRMS account security"
                  >
                    <div className="relative z-10">
                      <span className="text-sm font-semibold tracking-tight">
                        Alliance HRMS
                      </span>
                      <div className="mt-16 max-w-sm">
                        <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                          <ShieldCheck className="size-6" />
                        </div>
                        <h1 className="text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
                          A fresh start for your account.
                        </h1>
                        <p className="mt-4 text-sm leading-6 text-white/80">
                          Choose a personal password to keep your HRMS account
                          secure.
                        </p>
                      </div>
                    </div>
                    <p className="relative z-10 text-xs text-white/60">
                      © {new Date().getFullYear()} Alliance Insurance
                      Corporation Ltd
                    </p>
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_0.9px,transparent_1px)] bg-[length:5px_5px] opacity-20" />
                  </section>

                  <section className="flex min-w-0 items-center bg-background px-5 py-7 sm:px-8 sm:py-9 md:bg-card lg:px-10">
                    <div className="mx-auto w-full max-w-[360px]">
                      <div className="mb-6 text-center md:hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/assets/alliance-logo.png"
                          alt="Alliance Insurance"
                          className="mx-auto mb-4 h-8 w-auto dark:brightness-0 dark:invert"
                        />
                        <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <LockKeyhole className="size-5" />
                        </div>
                      </div>
                      <DialogHeader className="mb-5">
                        <DialogTitle className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                          Change your temporary password
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-5 text-muted-foreground">
                          Your administrator provided a temporary password.
                          Create a new one before continuing.
                        </DialogDescription>
                      </DialogHeader>
                      <ChangePasswordForm
                        onSubmit={handleForcedPasswordReset}
                        loading={forcePasswordResetBusy}
                        error={forcePasswordResetError}
                        requiredMode
                        onUseDifferentAccount={
                          handleUseDifferentAccountForForcedReset
                        }
                      />
                    </div>
                  </section>
                </div>
                <p className="mt-4 text-center text-[10px] text-muted-foreground md:hidden">
                  © {new Date().getFullYear()} Alliance Insurance Corporation
                  Ltd
                </p>
              </div>
            </div>
          </DialogPopup>
        </Dialog>
        <SupportChatWidget />
      </SidebarProvider>
    </DashboardIdentityProvider>
  );
}
