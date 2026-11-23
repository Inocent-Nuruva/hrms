"use client";

import { fluentConfirm } from "@/components/ui/fluent-dialog-service";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  LogIn,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import { SearchToggleField } from "@/components/common/search-toggle-field";
import { FluentSelect } from "@/components/ui/fluent-select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";
import { useFluentToastState } from "@/components/ui/use-fluent-toast-state";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  activateCompany,
  assignPermissionToCurrentCompanyUser,
  assignRoleToCurrentCompanyUser,
  createCompany,
  createCurrentCompanyUser,
  deleteCurrentCompanyUser,
  getCompanyById,
  getCompanyModules,
  getCurrentCompanyOnboardingStatus,
  getMyCompany,
  listCurrentCompanyUsers,
  listResource,
  listUsers,
  probePlatformCompaniesList,
  revokePermissionFromCurrentCompanyUser,
  revokeRoleFromCurrentCompanyUser,
  suspendCompany,
  updateCompanyById,
  updateCompanyModules,
  type AdminRecord,
  type UsersQueryParams,
} from "@/lib/admin-api";
import { usePublishedCompanyModules } from "@/hooks/use-company-modules";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { useAuth } from "@/hooks/useAuth";
import {
  useForbiddenRouteGuard,
  useLeaveIfForbidden,
} from "@/hooks/use-forbidden-route-guard";
import {
  companyModulesSummary,
  DEFAULT_COMPANY_MODULES,
  parseCompanyModules,
  parseCompanyModulesFromCompany,
  readRememberedCompanyModules,
  rememberCompanyModules,
  toCompanyModulesPayload,
  withCompanyModules,
  type CompanyModules,
} from "@/lib/company-modules";
import {
  canAccessDashboardRoute,
  canPerformPermission,
  COMPANY_MANAGEMENT_ROUTE_PERMISSION,
  requestDashboardAccessRefresh,
} from "@/lib/dashboard-permissions";
import { env } from "@/lib/env";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken";

const DEFAULT_MEMBERS_QUERY: Required<UsersQueryParams> = {
  page: 1,
  limit: 100,
  sortBy: "created_at",
  sortOrder: "DESC",
  search: "",
};

type CompanyForm = {
  name: string;
  timezone: string;
  modules: CompanyModules;
};

type CreateCompanyForm = {
  companyName: string;
  timezone: string;
  companySlug: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  modules: CompanyModules;
};

const EMPTY_CREATE_COMPANY_FORM: CreateCompanyForm = {
  companyName: "",
  timezone: "",
  companySlug: "",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminPhone: "",
  adminPassword: "",
  modules: { ...DEFAULT_COMPANY_MODULES },
};

function CompanyModulesFields({
  value,
  onChange,
}: {
  value: CompanyModules;
  onChange: (next: CompanyModules) => void;
}) {
  return (
    <fieldset className="grid gap-2 sm:col-span-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Roles and permissions
      </legend>
      <p className="text-sm text-muted-foreground">
        Enable or deny each catalog independently for this company. Platform
        administrators keep Access Governance regardless.
      </p>
      <label className="flex items-start gap-2 border border-border bg-background px-3 py-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={value.roles}
          onChange={(event) =>
            onChange({ ...value, roles: event.target.checked })
          }
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            Enable roles
          </span>
          <span className="block text-xs text-muted-foreground">
            Allows this company to view and manage roles in its dashboard.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 border border-border bg-background px-3 py-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={value.permissions}
          onChange={(event) =>
            onChange({ ...value, permissions: event.target.checked })
          }
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            Enable permissions
          </span>
          <span className="block text-xs text-muted-foreground">
            Allows this company to view and manage the permission catalog. Can
            stay off while roles remain enabled.
          </span>
        </span>
      </label>
    </fieldset>
  );
}

type CurrentCompanyUserForm = {
  userId: string;
  roleIds: string[];
};

function readStoredToken() {
  if (typeof window === "undefined") {
    return "";
  }

  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens);
  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw) as {
        accessToken?: string;
        access_token?: string;
      };
      const accessToken = (
        parsed.accessToken ??
        parsed.access_token ??
        ""
      ).trim();
      if (accessToken) {
        return accessToken;
      }
    } catch {
      // Fall through to legacy key.
    }
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? "";
}

function readString(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "-";
}

function readNumber(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "bigint") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function readCompanyId(row: AdminRecord | null | undefined) {
  if (!row) return null;
  return readNumber(row, ["id", "company_id", "companyId"]);
}

function readCompletedStepNames(status: AdminRecord) {
  for (const key of [
    "completed_steps",
    "completedSteps",
    "steps_completed",
    "stepsCompleted",
  ]) {
    const value = status[key];
    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          if (typeof entry === "string" && entry.trim()) return entry.trim();
          if (entry && typeof entry === "object") {
            return readString(entry as AdminRecord, [
              "name",
              "code",
              "step",
              "key",
            ]);
          }
          return "";
        })
        .filter((entry) => entry && entry !== "-");
    }
  }
  return [];
}

function summarizeOnboardingStatus(status: AdminRecord | null) {
  if (!status) {
    return "Onboarding status is not available yet.";
  }

  const statusLabel = readString(status, [
    "status",
    "state",
    "phase",
    "current_status",
    "currentStatus",
  ]);
  const currentStep = readString(status, [
    "current_step",
    "currentStep",
    "step_name",
    "stepName",
  ]);
  const completedNames = readCompletedStepNames(status);
  const completedSteps =
    completedNames.length > 0
      ? completedNames.length
      : readNumber(status, ["completed_steps", "completedSteps"]);
  const totalSteps = readNumber(status, ["total_steps", "totalSteps"]);
  const percentage = readNumber(status, [
    "progress_percentage",
    "progressPercent",
    "completion_percentage",
    "completionPercent",
  ]);

  const summaryParts = [
    statusLabel !== "-" ? statusLabel : "",
    currentStep !== "-" ? `Current step: ${currentStep}` : "",
    completedNames.length > 0
      ? `${completedNames.length} step${completedNames.length === 1 ? "" : "s"} done`
      : completedSteps !== null && totalSteps !== null
        ? `${completedSteps}/${totalSteps} steps complete`
        : "",
    percentage !== null ? `${percentage}% complete` : "",
  ].filter(Boolean);

  if (summaryParts.length > 0) {
    return summaryParts.join(" · ");
  }

  const complete =
    status.setup_complete ??
    status.setupComplete ??
    status.is_complete ??
    status.isComplete;
  if (complete === true) return "Setup is complete.";
  if (complete === false) return "Setup is still in progress.";
  return "Status record loaded.";
}

function companyName(row: AdminRecord) {
  return readString(row, [
    "company_name",
    "companyName",
    "name",
    "display_name",
  ]);
}

function companySlug(row: AdminRecord) {
  return readString(row, ["company_slug", "companySlug", "slug", "code"]);
}

function companyFromStoredUser(): AdminRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AdminRecord;
    const nested =
      parsed.company && typeof parsed.company === "object"
        ? (parsed.company as AdminRecord)
        : null;
    if (
      nested &&
      (nested.company_name || nested.name || nested.company_slug || nested.slug)
    ) {
      return nested;
    }
    const name = readString(parsed, ["company_name", "companyName"]);
    const slug = readString(parsed, [
      "company_slug",
      "companySlug",
      "company_code",
    ]);
    const id = readNumber(parsed, ["company_id", "companyId"]);
    if (name === "-" && slug === "-" && id === null) return null;
    return {
      id: id ?? undefined,
      company_name: name === "-" ? undefined : name,
      company_slug: slug === "-" ? undefined : slug,
    };
  } catch {
    return null;
  }
}

function companyStatus(row: AdminRecord) {
  return readString(row, ["status", "state", "company_status"]);
}

function currentCompanyUserLabel(row: AdminRecord) {
  const nestedUser =
    (typeof row.user === "object" && row.user !== null
      ? (row.user as AdminRecord)
      : null) ??
    (typeof row.company_user === "object" && row.company_user !== null
      ? (row.company_user as AdminRecord)
      : null);
  const first = readString(nestedUser ?? row, ["first_name", "firstName"]);
  const last = readString(nestedUser ?? row, ["last_name", "lastName"]);
  const full = [first, last]
    .filter((value) => value !== "-")
    .join(" ")
    .trim();
  if (full) {
    return full;
  }
  const display = readString(nestedUser ?? row, [
    "name",
    "display_name",
    "full_name",
    "email",
  ]);
  return display === "-" ? "Unknown user" : display;
}

function currentCompanyUserEmail(row: AdminRecord) {
  const nestedUser =
    typeof row.user === "object" && row.user !== null
      ? (row.user as AdminRecord)
      : null;
  return readString(nestedUser ?? row, ["email"]);
}

function currentCompanyUserId(row: AdminRecord) {
  return readNumber(row, [
    "id",
    "user_id",
    "userId",
    "company_user_id",
    "companyUserId",
  ]);
}

function userOptionLabel(row: AdminRecord) {
  const first = readString(row, ["first_name", "firstName"]);
  const last = readString(row, ["last_name", "lastName"]);
  const full = [first, last]
    .filter((value) => value !== "-")
    .join(" ")
    .trim();
  const email = readString(row, ["email"]);
  if (full && email !== "-") {
    return `${full} (${email})`;
  }
  if (full) {
    return full;
  }
  return email === "-"
    ? `User #${readNumber(row, ["id", "user_id"]) ?? "?"}`
    : email;
}

function toggleStringSelection(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

function nestedAdminRecord(row: AdminRecord, key: string) {
  return typeof row[key] === "object" && row[key] !== null
    ? (row[key] as AdminRecord)
    : null;
}

function collectAssignmentIds(row: AdminRecord, keys: string[]) {
  const ids = new Set<string>();
  const consume = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      ids.add(String(value));
      return;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        ids.add(String(parsed));
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(consume);
      return;
    }
    if (typeof value !== "object" || value === null) {
      return;
    }
    const record = value as AdminRecord;
    for (const idKey of [
      "id",
      "role_id",
      "roleId",
      "permission_id",
      "permissionId",
    ]) {
      const next = readNumber(record, [idKey]);
      if (next !== null) {
        ids.add(String(next));
        return;
      }
    }
    for (const nestedKey of [
      "role",
      "permission",
      "roles",
      "permissions",
      "direct_permissions",
      "directPermissions",
    ]) {
      consume(record[nestedKey]);
    }
  };

  for (const key of keys) {
    consume(row[key]);
  }

  return Array.from(ids);
}

function memberRoleIds(row: AdminRecord) {
  const user = nestedAdminRecord(row, "user");
  const companyUser = nestedAdminRecord(row, "company_user");
  return collectAssignmentIds(row, ["roles", "user_roles", "userRoles"])
    .concat(
      user
        ? collectAssignmentIds(user, ["roles", "user_roles", "userRoles"])
        : [],
      companyUser
        ? collectAssignmentIds(companyUser, [
            "roles",
            "user_roles",
            "userRoles",
          ])
        : [],
    )
    .filter((value, index, values) => values.indexOf(value) === index);
}

function memberPermissionIds(row: AdminRecord) {
  const membership = nestedAdminRecord(row, "company_user") ?? row;
  return collectAssignmentIds(membership, ["direct_permissions", "directPermissions"]);
}

export function CompaniesView() {
  const searchParams = useSearchParams();
  const actor = useDashboardActor();
  const { switchCompany } = useAuth();
  const actorPermissions = actor.permissionLabels;
  const permissionsReady = actor.ready;
  const isPlatformScope = actor.scope === "platform";
  const companyModules = usePublishedCompanyModules();
  const canUsePermissionCatalog = companyModules.permissions !== false;
  const canAccessCompaniesRoute =
    permissionsReady &&
    canAccessDashboardRoute(
      "/dashboard/companies",
      actorPermissions,
      actor.accessMode,
    );
  const canListPlatformCompanies =
    permissionsReady &&
    isPlatformScope &&
    canPerformPermission(actorPermissions, COMPANY_MANAGEMENT_ROUTE_PERMISSION);
  const leaveIfForbidden = useLeaveIfForbidden();
  useForbiddenRouteGuard(canAccessCompaniesRoute);
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const [editingCompany, setEditingCompany] =
    React.useState<AdminRecord | null>(null);
  const [editingCompanyId, setEditingCompanyId] = React.useState<number | null>(
    null,
  );
  const [companyForm, setCompanyForm] = React.useState<CompanyForm>({
    name: "",
    timezone: "",
    modules: { ...DEFAULT_COMPANY_MODULES },
  });
  const [pendingStatusChange, setPendingStatusChange] = React.useState<{
    company: AdminRecord;
    nextAction: "activate" | "suspend";
  } | null>(null);
  const [showCreateCompany, setShowCreateCompany] = React.useState(false);
  const [createCompanyForm, setCreateCompanyForm] =
    React.useState<CreateCompanyForm>(EMPTY_CREATE_COMPANY_FORM);
  const [switchingCompanyId, setSwitchingCompanyId] = React.useState<
    number | null
  >(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );

  useFluentToastState(successMessage, setSuccessMessage, "success");

  const [myCompany, setMyCompany] = React.useState<AdminRecord | null>(null);
  const [onboardingStatus, setOnboardingStatus] =
    React.useState<AdminRecord | null>(null);
  const [members, setMembers] = React.useState<AdminRecord[]>([]);
  const [allUsers, setAllUsers] = React.useState<AdminRecord[]>([]);
  const [roles, setRoles] = React.useState<AdminRecord[]>([]);
  const [permissions, setPermissions] = React.useState<AdminRecord[]>([]);
  const [memberForm, setMemberForm] = React.useState<CurrentCompanyUserForm>({
    userId: "",
    roleIds: [],
  });
  const [membersError, setMembersError] = React.useState<string | null>(null);
  const [editingMember, setEditingMember] = React.useState<AdminRecord | null>(
    null,
  );
  const [grantSearch, setGrantSearch] = React.useState("");
  const [editingMemberRoleIds, setEditingMemberRoleIds] = React.useState<
    string[]
  >([]);
  const [editingMemberPermissionIds, setEditingMemberPermissionIds] =
    React.useState<string[]>([]);
  const handledAccessRequestRef = React.useRef("");

  const canUpdateCompanies =
    permissionsReady &&
    isPlatformScope &&
    canPerformPermission(actorPermissions, {
      permissions: ["companies:update", "companies:update"],
      mode: "any",
    });
  const canCreateCompanies =
    permissionsReady &&
    isPlatformScope &&
    canPerformPermission(actorPermissions, {
      permissions: ["companies:create", "companies:create"],
      mode: "any",
    });
  const canManageCompanyUsers =
    permissionsReady &&
    (canPerformPermission(actorPermissions, "company_users:create") ||
      canPerformPermission(actorPermissions, "company_users:update") ||
      canPerformPermission(actorPermissions, "company_users:delete") ||
      canPerformPermission(actorPermissions, "users:update"));
  const canManageCompanyUserPermissions =
    permissionsReady &&
    (canPerformPermission(actorPermissions, "company_users:update") ||
      canPerformPermission(actorPermissions, "permissions:update") ||
      canPerformPermission(actorPermissions, "users:update"));

  const loadData = React.useCallback(async () => {
    if (!permissionsReady) {
      return;
    }
    if (!canAccessCompaniesRoute) {
      setRows([]);
      setMembers([]);
      setAllUsers([]);
      setRoles([]);
      setPermissions([]);
      setError(null);
      return;
    }

    const token = readStoredToken();
    if (!token) {
      setError("Authentication required. Please log in again.");
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);
    setMembersError(null);

    if (isPlatformScope) {
      try {
        const companies = await probePlatformCompaniesList(token);
        const hydrated = await Promise.all(
          companies.map(async (row) => {
            const id = readCompanyId(row);
            if (id === null) return row;
            const payload = await getCompanyModules(token, id).catch(
              () => null,
            );
            const modules = payload
              ? parseCompanyModules(payload)
              : readRememberedCompanyModules(id);
            if (!modules) return row;
            rememberCompanyModules(id, modules);
            return withCompanyModules(row, modules);
          }),
        );
        setRows(hydrated);
        setMyCompany(null);
        setOnboardingStatus(null);
        setMembers([]);
        setAllUsers([]);
        setRoles([]);
        setPermissions([]);
      } catch (errorObject) {
        const message =
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to load platform companies.";
        setRows([]);
        setError(message);
        if (/platform access is required|forbidden|permission/i.test(message)) {
          leaveIfForbidden(Object.assign(new Error(message), { status: 403 }));
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    const settled = await Promise.allSettled([
      getMyCompany(token),
      getCurrentCompanyOnboardingStatus(token),
      listCurrentCompanyUsers(token, DEFAULT_MEMBERS_QUERY, {
        cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
      }).then((result) => result.rows),
      listUsers(
        token,
        { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" },
        { cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS },
      ).then((result) => result.rows),
      listResource("roles", token, { pageAll: false }),
      canUsePermissionCatalog
        ? listResource("permissions", token, { pageAll: false })
        : Promise.resolve([] as AdminRecord[]),
    ]);

    const value = <T,>(index: number, fallback: T): T => {
      const result = settled[index];
      return result.status === "fulfilled" ? (result.value as T) : fallback;
    };
    const reason = (index: number) => {
      const result = settled[index];
      return result.status === "rejected" && result.reason instanceof Error
        ? result.reason.message
        : result.status === "rejected"
          ? String(result.reason)
          : null;
    };

    setRows([]);
    setMyCompany(value(0, null) ?? companyFromStoredUser());
    setOnboardingStatus(value(1, null));
    setMembers(value(2, [] as AdminRecord[]));
    setAllUsers(value(3, [] as AdminRecord[]));
    setRoles(value(4, [] as AdminRecord[]));
    setPermissions(value(5, [] as AdminRecord[]));

    const contextError = reason(0) || reason(2);
    setError(contextError);
    setMembersError(reason(2));
    setLoading(false);
  }, [
    canAccessCompaniesRoute,
    canUsePermissionCatalog,
    isPlatformScope,
    leaveIfForbidden,
    permissionsReady,
  ]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    const membershipId = Number(searchParams?.get("membership_id"));
    const requestedPermission = searchParams?.get("permission")?.trim() ?? "";
    if (
      !Number.isFinite(membershipId) ||
      membershipId <= 0 ||
      members.length === 0 ||
      !canManageCompanyUserPermissions
    ) {
      return;
    }

    const requestKey = `${membershipId}:${requestedPermission}`;
    if (handledAccessRequestRef.current === requestKey) return;

    const member = members.find(
      (row) =>
        readNumber(row, [
          "company_user_id",
          "companyUserId",
          "membership_id",
          "membershipId",
        ]) === membershipId,
    );
    if (!member) return;

    const permission = requestedPermission
      ? permissions.find(
          (row) =>
            readString(row, [
              "name",
              "permission_name",
              "permissionName",
              "code",
            ]) === requestedPermission,
        )
      : null;
    const permissionId = permission
      ? readNumber(permission, ["id", "permission_id", "permissionId"])
      : null;

    setEditingMember(member);
    setEditingMemberRoleIds(memberRoleIds(member));
    setEditingMemberPermissionIds(() => {
      const assigned = memberPermissionIds(member);
      if (permissionId === null) return assigned;
      return Array.from(new Set([...assigned, String(permissionId)]));
    });
    setMembersError(
      requestedPermission && permissionId === null
        ? `The requested permission (${requestedPermission}) is not available in this company permission catalog.`
        : null,
    );
    handledAccessRequestRef.current = requestKey;
  }, [canManageCompanyUserPermissions, members, permissions, searchParams]);

  const filteredRows = React.useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) =>
      `${companyName(row)} ${companySlug(row)} ${companyStatus(row)}`
        .toLowerCase()
        .includes(query),
    );
  }, [debouncedSearch, rows]);

  const assignedCurrentCompanyUserIds = React.useMemo(
    () =>
      new Set(
        members
          .map((row) => readNumber(row, ["user_id", "userId", "id"]))
          .filter((value): value is number => value !== null),
      ),
    [members],
  );

  const selectableUsers = React.useMemo(
    () =>
      allUsers.filter((row) => {
        const id = readNumber(row, ["id", "user_id"]);
        return id !== null && !assignedCurrentCompanyUserIds.has(id);
      }),
    [allUsers, assignedCurrentCompanyUserIds],
  );

  const roleNameById = React.useCallback(
    (id: string) => {
      const match = roles.find(
        (role) => String(readNumber(role, ["id"]) ?? "") === id,
      );
      return match
        ? readString(match, ["display_name", "name"])
        : `Role #${id}`;
    },
    [roles],
  );

  const permissionNameById = React.useCallback(
    (id: string) => {
      const match = permissions.find(
        (permission) => String(readNumber(permission, ["id"]) ?? "") === id,
      );
      return match
        ? readString(match, ["display_name", "name"])
        : `Permission #${id}`;
    },
    [permissions],
  );

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
      key: "modules",
      label: "Roles & permissions",
      defaultWidth: 170,
      sortable: false,
      render: (row) =>
        companyModulesSummary(parseCompanyModulesFromCompany(row)),
    },
    {
      key: "actions",
      label: "Actions",
      defaultWidth: 220,
      sortable: false,
      render: (row) => {
        const status = companyStatus(row).toLowerCase();
        const companyId = readNumber(row, ["id", "company_id", "companyId"]);
        const switchDisabled =
          saving ||
          companyId === null ||
          switchingCompanyId !== null ||
          status === "suspended" ||
          status === "inactive";
        return (
          <div
            className="flex justify-end gap-1 pr-1"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="admin-table-icon-button"
              disabled={switchDisabled}
              onClick={() => {
                if (companyId !== null) {
                  void enterCompany(companyId);
                }
              }}
              aria-label={`Enter ${companyName(row)}`}
              title={
                status === "suspended" || status === "inactive"
                  ? "Activate the company before entering it"
                  : "Switch to this company"
              }
            >
              {switchingCompanyId === companyId ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
            </button>
            {canUpdateCompanies ? (
              <button
                type="button"
                className="admin-table-icon-button"
                onClick={async () => {
                  const token = readStoredToken();
                  const id = readCompanyId(row);
                  if (!token || id === null) {
                    return;
                  }
                  setError(null);
                  setEditingCompanyId(id);
                  try {
                    const detail = (await getCompanyById(token, id)) ?? row;
                    const modulesPayload = await getCompanyModules(
                      token,
                      id,
                    ).catch(() => null);
                    const modules = modulesPayload
                      ? parseCompanyModules(modulesPayload)
                      : parseCompanyModulesFromCompany({ ...row, ...detail });
                    rememberCompanyModules(id, modules);
                    setEditingCompany({
                      ...row,
                      ...detail,
                      id,
                    });
                    setCompanyForm({
                      name:
                        readString(detail, [
                          "name",
                          "company_name",
                          "display_name",
                          "companyName",
                        ]) === "-"
                          ? readString(row, [
                              "name",
                              "company_name",
                              "display_name",
                              "companyName",
                            ]) === "-"
                            ? ""
                            : readString(row, [
                                "name",
                                "company_name",
                                "display_name",
                                "companyName",
                              ])
                          : readString(detail, [
                              "name",
                              "company_name",
                              "display_name",
                              "companyName",
                            ]),
                      timezone:
                        detail.metadata &&
                        typeof detail.metadata === "object" &&
                        !Array.isArray(detail.metadata)
                          ? readString(detail.metadata as AdminRecord, [
                              "timezone",
                            ]).replace(/^-$/, "")
                          : "",
                      modules,
                    });
                  } catch (errorObject) {
                    setEditingCompanyId(null);
                    setError(
                      errorObject instanceof Error
                        ? errorObject.message
                        : "Failed to load company details.",
                    );
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
                aria-label={
                  status === "active" ? "Suspend company" : "Activate company"
                }
                title={
                  status === "active" ? "Suspend company" : "Activate company"
                }
              >
                {status === "active" ? (
                  <ShieldAlert className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];

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
        const ids = memberRoleIds(row);
        if (ids.length === 0) {
          return "-";
        }
        return ids.slice(0, 3).map(roleNameById).join(", ");
      },
    },
    ...(canUsePermissionCatalog
      ? [
          {
            key: "direct_permissions",
            label: "Direct Permissions",
            defaultWidth: 180,
            render: (row: AdminRecord) => {
              const ids = memberPermissionIds(row);
              if (ids.length === 0) {
                return "-";
              }
              return ids.slice(0, 2).map(permissionNameById).join(", ");
            },
          } satisfies Column<AdminRecord>,
        ]
      : []),
    {
      key: "actions",
      label: "Actions",
      defaultWidth: 150,
      sortable: false,
      render: (row) => {
        const userId = currentCompanyUserId(row);
        return (
          <div
            className="flex justify-end gap-1 pr-1"
            onClick={(event) => event.stopPropagation()}
          >
            {canManageCompanyUserPermissions ? (
              <button
                type="button"
                className="admin-table-icon-button"
                disabled={userId === null}
                onClick={() => {
                  setEditingMember(row);
                  setEditingMemberRoleIds(memberRoleIds(row));
                  setEditingMemberPermissionIds(memberPermissionIds(row));
                  setMembersError(null);
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
                  const token = readStoredToken();
                  if (!token || userId === null) {
                    return;
                  }
                  setSaving(true);
                  setMembersError(null);
                  try {
                    await deleteCurrentCompanyUser(token, userId);
                    await loadData();
                  } catch (errorObject) {
                    setMembersError(
                      errorObject instanceof Error
                        ? errorObject.message
                        : "Failed to remove user from current company.",
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
                aria-label="Remove from current company"
                title="Remove from current company"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];

  async function enterCompany(companyId: number) {
    setSwitchingCompanyId(companyId);
    setError(null);
    setSuccessMessage(null);
    try {
      await switchCompany(companyId);
      // A full navigation rebuilds the dashboard shell and all permission-
      // controlled tabs from the refreshed company-scoped access token.
      window.location.replace("/dashboard");
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to switch to the selected company.",
      );
      setSwitchingCompanyId(null);
    }
  }

  async function submitCreateCompany() {
    const token = readStoredToken();
    if (!token) {
      setError("Authentication required. Please log in again.");
      return;
    }

    const firstName = createCompanyForm.adminFirstName.trim();
    const lastName = createCompanyForm.adminLastName.trim();
    if (!createCompanyForm.companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    const timezone = createCompanyForm.timezone.trim();
    if (!timezone) {
      setError("Company timezone is required.");
      return;
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(
        new Date(),
      );
    } catch {
      setError("Enter a valid IANA timezone, such as Africa/Dar_es_Salaam.");
      return;
    }
    if (!/^[A-Za-z\s]+$/.test(firstName) || !/^[A-Za-z\s]+$/.test(lastName)) {
      setError(
        "Administrator first and last names may only contain letters and spaces.",
      );
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(createCompanyForm.adminEmail.trim())) {
      setError("Enter a valid administrator email address.");
      return;
    }
    if (!createCompanyForm.adminPhone.trim()) {
      setError("Administrator phone is required.");
      return;
    }
    if (createCompanyForm.adminPassword.length < 8) {
      setError("Administrator password must contain at least 8 characters.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const created = await createCompany(token, {
        company_name: createCompanyForm.companyName.trim(),
        metadata: { timezone },
        ...(createCompanyForm.companySlug.trim()
          ? { company_slug: createCompanyForm.companySlug.trim() }
          : {}),
        admin_first_name: firstName,
        admin_last_name: lastName,
        admin_email: createCompanyForm.adminEmail.trim().toLowerCase(),
        admin_phone: createCompanyForm.adminPhone.trim(),
        admin_password: createCompanyForm.adminPassword,
      });
      const createdRecord =
        created && typeof created === "object" && !Array.isArray(created)
          ? (created as AdminRecord)
          : null;
      const nestedCreated =
        createdRecord &&
        typeof createdRecord.data === "object" &&
        createdRecord.data
          ? (createdRecord.data as AdminRecord)
          : createdRecord;
      const createdId =
        readCompanyId(nestedCreated) ?? readCompanyId(createdRecord);
      if (createdId !== null) {
        const modules = toCompanyModulesPayload(createCompanyForm.modules);
        await updateCompanyModules(token, createdId, modules);
        rememberCompanyModules(createdId, modules);
      }
      setShowCreateCompany(false);
      setCreateCompanyForm(EMPTY_CREATE_COMPANY_FORM);
      setSuccessMessage(
        "Company and its first administrator were created successfully.",
      );
      await loadData();
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to create company.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveCompany() {
    const token = readStoredToken();
    const companyId = editingCompanyId ?? readCompanyId(editingCompany);
    if (!token) {
      setError("Authentication required. Please log in again.");
      return;
    }
    if (companyId === null || !editingCompany) {
      setError("This company record is missing an id, so it cannot be saved.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const name = companyForm.name.trim();
      const timezone = companyForm.timezone.trim();
      if (timezone) {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(
            new Date(),
          );
        } catch {
          setError(
            "Enter a valid IANA timezone, such as Africa/Dar_es_Salaam.",
          );
          return;
        }
      }
      const existingMetadata =
        editingCompany.metadata &&
        typeof editingCompany.metadata === "object" &&
        !Array.isArray(editingCompany.metadata)
          ? (editingCompany.metadata as AdminRecord)
          : {};
      await updateCompanyById(token, companyId, {
        name,
        company_name: name,
        metadata: { ...existingMetadata, timezone: timezone || null },
      });
      const modules = toCompanyModulesPayload(companyForm.modules);
      await updateCompanyModules(token, companyId, modules);
      rememberCompanyModules(companyId, modules);
      setEditingCompany(null);
      setEditingCompanyId(null);
      await loadData();
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update company.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmStatusChange() {
    const token = readStoredToken();
    const companyId = readNumber(pendingStatusChange?.company ?? {}, ["id"]);
    if (!token || companyId === null || !pendingStatusChange) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (pendingStatusChange.nextAction === "activate") {
        await activateCompany(token, companyId);
      } else {
        await suspendCompany(token, companyId);
      }
      setPendingStatusChange(null);
      await loadData();
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : `Failed to ${pendingStatusChange.nextAction} company.`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function addCurrentCompanyUser() {
    const token = readStoredToken();
    const userId = Number(memberForm.userId);
    if (!token || !Number.isFinite(userId) || userId <= 0) {
      setMembersError("Choose a valid platform user first.");
      return;
    }

    setSaving(true);
    setMembersError(null);
    try {
      await createCurrentCompanyUser(token, {
        user_id: userId,
        role_ids: memberForm.roleIds.map(Number),
      });
      setMemberForm({ userId: "", roleIds: [] });
      await loadData();
    } catch (errorObject) {
      setMembersError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to add the user to the current company.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveMemberAccess() {
    const token = readStoredToken();
    const userId = currentCompanyUserId(editingMember ?? {});
    if (!token || userId === null || !editingMember) {
      return;
    }

    const previousRoleIds = new Set(memberRoleIds(editingMember));
    const nextRoleIds = new Set(editingMemberRoleIds);
    const addRoleIds = Array.from(nextRoleIds).filter(
      (id) => !previousRoleIds.has(id),
    );
    const removeRoleIds = Array.from(previousRoleIds).filter(
      (id) => !nextRoleIds.has(id),
    );

    const previousPermissionIds = new Set(memberPermissionIds(editingMember));
    const nextPermissionIds = new Set(
      canUsePermissionCatalog
        ? editingMemberPermissionIds
        : Array.from(previousPermissionIds),
    );
    const addPermissionIds = Array.from(nextPermissionIds).filter(
      (id) => !previousPermissionIds.has(id),
    );
    const removePermissionIds = Array.from(previousPermissionIds).filter(
      (id) => !nextPermissionIds.has(id),
    );

    const changes = addRoleIds.length + removeRoleIds.length + addPermissionIds.length + removePermissionIds.length;
    if (changes && !(await fluentConfirm(`Apply ${changes} access change(s) to ${currentCompanyUserLabel(editingMember)} in this company? Role and data-scope changes affect the records this member can access.`))) return;
    setSaving(true);
    setMembersError(null);
    try {
      for (const roleId of addRoleIds) {
        await assignRoleToCurrentCompanyUser(token, userId, roleId);
      }
      for (const roleId of removeRoleIds) {
        await revokeRoleFromCurrentCompanyUser(token, userId, roleId);
      }
      for (const permissionId of addPermissionIds) {
        await assignPermissionToCurrentCompanyUser(token, userId, permissionId);
      }
      for (const permissionId of removePermissionIds) {
        await revokePermissionFromCurrentCompanyUser(
          token,
          userId,
          permissionId,
        );
      }
      setEditingMember(null);
      await loadData();
      requestDashboardAccessRefresh();
    } catch (errorObject) {
      setMembersError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update current company user access.",
      );
    } finally {
      setSaving(false);
    }
  }

  const onboardingCompleted = React.useMemo(() => {
    if (!onboardingStatus) {
      return false;
    }
    const complete =
      onboardingStatus.setup_complete ??
      onboardingStatus.setupComplete ??
      onboardingStatus.is_complete ??
      onboardingStatus.isComplete;
    return complete === true;
  }, [onboardingStatus]);

  if (permissionsReady && !canAccessCompaniesRoute) {
    return null;
  }

  return (
    <div className="space-y-4">
      {!isPlatformScope ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  Current Company
                </h3>
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
                <RefreshCw
                  className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Company
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {myCompany ? companyName(myCompany) : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Slug: {myCompany ? companySlug(myCompany) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Onboarding
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {!onboardingStatus
                    ? "Unknown"
                    : onboardingCompleted
                      ? "Complete"
                      : "In progress"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summarizeOnboardingStatus(onboardingStatus)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                Current Company Users
              </h3>
              <p className="text-sm text-muted-foreground">
                Add an existing platform user to the active company and
                optionally seed roles.
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Platform user
                </span>
                <FluentSelect
                  ariaLabel="Platform user"
                  value={memberForm.userId}
                  onChange={(value) =>
                    setMemberForm((previous) => ({
                      ...previous,
                      userId: value,
                    }))
                  }
                  placeholder="Select user"
                  options={[
                    { value: "", label: "Select user" },
                    ...selectableUsers.flatMap((user) => {
                      const id = readNumber(user, ["id", "user_id"]);
                      if (id === null) return [];
                      return [
                        { value: String(id), label: userOptionLabel(user) },
                      ];
                    }),
                  ]}
                />
              </label>
              <fieldset className="grid gap-1">
                <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Seed roles
                </legend>
                <div className="flex flex-wrap gap-2 rounded-md border border-slate-300 bg-white p-2">
                  {roles.map((role) => {
                    const id = readNumber(role, ["id"]);
                    if (id === null) return null;
                    const value = String(id);
                    const active = memberForm.roleIds.includes(value);
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
                            roleIds: toggleStringSelection(
                              previous.roleIds,
                              value,
                            ),
                          }))
                        }
                      >
                        {readString(role, ["display_name", "name"])}
                      </button>
                    );
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
              {membersError ? (
                <p className="text-sm text-rose-600">{membersError}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {canListPlatformCompanies ? (
        <div className="border border-border/70 bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Tenant companies
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create and maintain tenants, or enter a company to work in its
                  own dashboard context.
                </p>
              </div>
            </div>
            {canCreateCompanies ? (
              <button
                type="button"
                className="ml-auto inline-flex h-9 items-center gap-1.5 bg-primary px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setShowCreateCompany(true);
                }}
                disabled={saving}
              >
                <Plus className="size-4" />
                Create company
              </button>
            ) : null}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SearchToggleField
              className="min-w-0"
              placeholder="Search company"
              value={search}
              onChange={setSearch}
            />
            <div className="ml-auto text-xs text-muted-foreground">
              {filteredRows.length} compan
              {filteredRows.length === 1 ? "y" : "ies"}
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
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}

      {!isPlatformScope ? (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            Active Company Members
          </h3>
          <ResizableTable
            title="Current company users"
            data={members}
            columns={memberColumns}
            itemsPerPage={10}
            loading={loading}
            storageKey="current-company-users"
          />
        </div>
      ) : null}

      {showCreateCompany ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-company-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-border bg-background p-5 shadow-xl"
          >
            <div>
              <h3
                id="create-company-title"
                className="text-lg font-semibold text-foreground"
              >
                Create company
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the tenant and the administrator who will complete its
                setup.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Company name
                </span>
                <input
                  autoFocus
                  className="h-10 border border-border bg-background px-3 text-sm"
                  value={createCompanyForm.companyName}
                  onChange={(event) =>
                    setCreateCompanyForm((previous) => ({
                      ...previous,
                      companyName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Company timezone
                </span>
                <input
                  className="h-10 border border-border bg-background px-3 text-sm"
                  placeholder="Africa/Dar_es_Salaam"
                  value={createCompanyForm.timezone}
                  onChange={(event) =>
                    setCreateCompanyForm((previous) => ({
                      ...previous,
                      timezone: event.target.value,
                    }))
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Required for date boundaries across dashboards. Enter an IANA
                  timezone.
                </span>
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Company slug{" "}
                  <span className="font-normal normal-case">(optional)</span>
                </span>
                <input
                  className="h-10 border border-border bg-background px-3 text-sm"
                  placeholder="alliance-insurance"
                  value={createCompanyForm.companySlug}
                  onChange={(event) =>
                    setCreateCompanyForm((previous) => ({
                      ...previous,
                      companySlug: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Admin first name
                </span>
                <input
                  className="h-10 border border-border bg-background px-3 text-sm"
                  autoComplete="given-name"
                  value={createCompanyForm.adminFirstName}
                  onChange={(event) =>
                    setCreateCompanyForm((previous) => ({
                      ...previous,
                      adminFirstName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Admin last name
                </span>
                <input
                  className="h-10 border border-border bg-background px-3 text-sm"
                  autoComplete="family-name"
                  value={createCompanyForm.adminLastName}
                  onChange={(event) =>
                    setCreateCompanyForm((previous) => ({
                      ...previous,
                      adminLastName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Admin email
                </span>
                <input
                  type="email"
                  className="h-10 border border-border bg-background px-3 text-sm"
                  autoComplete="email"
                  value={createCompanyForm.adminEmail}
                  onChange={(event) =>
                    setCreateCompanyForm((previous) => ({
                      ...previous,
                      adminEmail: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Admin phone
                </span>
                <input
                  type="tel"
                  className="h-10 border border-border bg-background px-3 text-sm"
                  autoComplete="tel"
                  value={createCompanyForm.adminPhone}
                  onChange={(event) =>
                    setCreateCompanyForm((previous) => ({
                      ...previous,
                      adminPhone: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Temporary admin password
                </span>
                <input
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  className="h-10 border border-border bg-background px-3 text-sm"
                  value={createCompanyForm.adminPassword}
                  onChange={(event) =>
                    setCreateCompanyForm((previous) => ({
                      ...previous,
                      adminPassword: event.target.value,
                    }))
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Minimum 8 characters.
                </span>
              </label>
              <CompanyModulesFields
                value={createCompanyForm.modules}
                onChange={(modules) =>
                  setCreateCompanyForm((previous) => ({ ...previous, modules }))
                }
              />
            </div>

            {error ? (
              <p className="mt-3 text-sm text-rose-600">{error}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="border border-border px-3 py-2 text-sm"
                disabled={saving}
                onClick={() => {
                  setShowCreateCompany(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
                disabled={saving}
                onClick={() => void submitCreateCompany()}
              >
                {saving ? "Creating..." : "Create company"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingCompany ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-company-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border border-border bg-background shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="edit-company-title"
              className="shrink-0 px-4 pt-4 text-lg font-semibold text-foreground"
            >
              Edit Company
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Name
                  </span>
                  <input
                    className="h-10 border border-border bg-background px-3 text-sm"
                    value={companyForm.name}
                    onChange={(event) =>
                      setCompanyForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Company timezone
                  </span>
                  <input
                    className="h-10 border border-border bg-background px-3 text-sm"
                    value={companyForm.timezone}
                    placeholder="Africa/Dar_es_Salaam"
                    aria-describedby="company-timezone-help"
                    onChange={(event) =>
                      setCompanyForm((previous) => ({
                        ...previous,
                        timezone: event.target.value,
                      }))
                    }
                  />
                  <span
                    id="company-timezone-help"
                    className="text-xs text-muted-foreground"
                  >
                    Required for dashboard date boundaries. Enter an IANA
                    timezone; leave blank to mark it unconfigured.
                  </span>
                </label>
                <CompanyModulesFields
                  value={companyForm.modules}
                  onChange={(modules) =>
                    setCompanyForm((previous) => ({ ...previous, modules }))
                  }
                />
              </div>
              {error ? (
                <p className="mt-3 text-sm text-rose-600">{error}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                className="inline-flex h-9 cursor-pointer items-center border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
                onClick={() => {
                  setEditingCompany(null);
                  setEditingCompanyId(null);
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-9 cursor-pointer items-center bg-primary px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">
              Manage Access: {currentCompanyUserLabel(editingMember)}
            </h3>
            <label className="mt-3 grid gap-1 text-sm">Find a permission
              <input type="search" className="rounded border p-2" value={grantSearch} onChange={event => setGrantSearch(event.target.value)} />
            </label>
            <details className="mt-2 text-sm"><summary>Effective permissions in this company</summary>
              <ul className="max-h-44 overflow-y-auto p-2">{(Array.isArray(editingMember.permission_names) ? editingMember.permission_names : []).filter((name): name is string => typeof name === "string" && name.toLowerCase().includes(grantSearch.trim().toLowerCase())).sort().map(name => <li key={name}>{name}</li>)}</ul>
            </details>
            <div
              className={`mt-4 grid gap-4 ${canUsePermissionCatalog ? "lg:grid-cols-2" : ""}`}
            >
              <fieldset className="grid gap-1">
                <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Company Roles
                </legend>
                <div className="max-h-72 overflow-y-auto rounded-md border border-slate-300 bg-white p-2">
                  <div className="grid gap-1">
                    {roles.map((role) => {
                      const id = readNumber(role, ["id"]);
                      if (id === null) return null;
                      const value = String(id);
                      return (
                        <label
                          key={id}
                          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={editingMemberRoleIds.includes(value)}
                            onChange={(event) =>
                              setEditingMemberRoleIds((previous) =>
                                event.target.checked
                                  ? Array.from(new Set([...previous, value]))
                                  : previous.filter((entry) => entry !== value),
                              )
                            }
                          />
                          <span>
                            {readString(role, ["display_name", "name"])}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </fieldset>

              {canUsePermissionCatalog ? (
                <fieldset className="grid gap-1">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Direct Permissions
                  </legend>
                  <div className="max-h-72 overflow-y-auto rounded-md border border-slate-300 bg-white p-2">
                    <div className="grid gap-1">
                      {permissions.filter(permission => [permission.name, permission.display_name].some(value => String(value ?? "").toLowerCase().includes(grantSearch.trim().toLowerCase()))).map((permission) => {
                        const id = readNumber(permission, ["id"]);
                        if (id === null) return null;
                        const value = String(id);
                        const permissionName = readString(permission, [
                          "name",
                          "permission_name",
                          "permissionName",
                          "code",
                        ]);
                        const isRequestedPermission =
                          permissionName ===
                          searchParams?.get("permission")?.trim();
                        return (
                          <label
                            key={id}
                            className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 ${
                              isRequestedPermission
                                ? "bg-primary/10 ring-1 ring-primary/30"
                                : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={editingMemberPermissionIds.includes(
                                value,
                              )}
                              onChange={(event) =>
                                setEditingMemberPermissionIds((previous) =>
                                  event.target.checked
                                    ? Array.from(new Set([...previous, value]))
                                    : previous.filter(
                                        (entry) => entry !== value,
                                      ),
                                )
                              }
                            />
                            <span>
                              {readString(permission, ["display_name", "name"])}
                            </span>
                            {isRequestedPermission ? (
                              <span className="ml-auto text-xs font-medium text-primary">
                                Required for assignment
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </fieldset>
              ) : null}
            </div>

            {membersError ? (
              <p className="mt-3 text-sm text-rose-600">{membersError}</p>
            ) : null}

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
            setPendingStatusChange(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatusChange?.nextAction === "activate"
                ? "Activate company?"
                : "Suspend company?"}
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
              {saving
                ? "Working..."
                : pendingStatusChange?.nextAction === "activate"
                  ? "Activate"
                  : "Suspend"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
