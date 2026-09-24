"use client";

import * as React from "react";
import { SearchToggleField } from "@/components/common/search-toggle-field";
import { useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";
import {
  EmployeeAccessRemovalDialog,
  type EmployeeAccessRemovalTarget,
} from "@/components/dashboard/employee-access-removal-dialog";
import {
  archiveEmployeeProfile,
  buildUserTwoFactorMap,
  disableUserTwoFactor,
  enableUserTwoFactor,
  listAllEmployees,
  listEmployees,
  readTwoFactorEnabled,
  resetUserPassword,
  resolveBackendMediaUrl,
  withNormalizedTwoFactorFields,
  type AdminRecord,
  type EmployeesQueryParams,
} from "@/lib/admin-api";
import {
  employeeBelongsToDirectory,
  filterEmployeesByDirectorySearch,
  mergeEmployeeDirectoryRows,
  type EmployeeDirectoryMode,
} from "@/lib/employee-directory-search";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRenderDiagnostics } from "@/hooks/use-render-diagnostics";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  canAccessDashboardRoute,
  canPerformPermission,
} from "@/lib/dashboard-permissions";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";
import { env } from "@/lib/env";
import {
  KeyRound,
  PlusIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  Trash2,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken";
const EMPLOYEE_STATUS_REFRESH_KEY = "hrms.employees.status.updatedAt";
const EMPLOYEE_STATUS_REFRESH_EVENT = "hrms:employee-status-updated";
const EMPLOYEE_LIST_CACHE_PREFIX = "hrms.employees.list";
const EMPLOYEE_LIST_CACHE_TTL_MS = env.NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS;
const ALL_STATUSES_VALUE = "__all_statuses__";
const DEFAULT_QUERY: Required<
  Omit<EmployeesQueryParams, "employment_status">
> & {
  employment_status:
    "" | NonNullable<EmployeesQueryParams["employment_status"]>;
} = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC",
  search: "",
  employment_status: "",
  branch_id: 0,
  department_id: 0,
  position_id: 0,
};

type EmployeeListSnapshot = {
  rows: AdminRecord[];
  totalPages: number | null;
  total: number | null;
  cachedAt: number;
};

const employeeListSnapshotCache = new Map<string, EmployeeListSnapshot>();

function readStoredToken() {
  if (typeof window === "undefined") {
    return "";
  }

  // Prefer session tokens bag (same order as branches/departments) so restricted
  // company users don't hit a stale legacy access-token key.
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

function employeeUserId(row: AdminRecord): string | number | null {
  const value =
    row.user_id ??
    row.userId ??
    row.account_id ??
    row.accountId ??
    // Nested user objects from employee payloads
    (typeof row.user === "object" && row.user !== null
      ? ((row.user as AdminRecord).id ??
        (row.user as AdminRecord).user_id ??
        (row.user as AdminRecord).userId)
      : null);
  return typeof value === "string" && value.trim()
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? value
      : null;
}

function employeeTwoFactorEnabled(row: AdminRecord): boolean {
  return readTwoFactorEnabled(row);
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null
    ? (value as AdminRecord)
    : null;
}

function readNestedName(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return "—";
  }
  return readString(record, [
    "name",
    "department_name",
    "departmentName",
    "position_name",
    "positionName",
  ]);
}

function formatEmployeeDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function employeeDisplayName(row: AdminRecord) {
  const named = readString(row, ["full_name", "fullName", "name"]);
  if (named !== "-") {
    return named;
  }
  const first = readString(row, ["first_name", "firstName"]);
  const middle = readString(row, ["middle_name", "middleName"]);
  const last = readString(row, ["last_name", "lastName"]);
  return (
    [first, middle, last]
      .filter((part) => part !== "-")
      .join(" ")
      .trim() || "-"
  );
}

function employeeInitials(row: AdminRecord) {
  return employeeDisplayName(row)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "E";
}

function employeePhotoUrl(row: AdminRecord) {
  const user = asRecord(row.user) ?? asRecord(row.company_user);
  const nestedUser = asRecord(user?.user);
  const candidates = [
    readString(row, [
      "profile_photo_url",
      "profilePhotoUrl",
      "avatar_url",
      "avatarUrl",
      "photo_url",
    ]),
    (user
      ? readString(user, [
          "profile_photo_url",
          "profilePhotoUrl",
          "avatar_url",
          "avatarUrl",
          "photo_url",
        ])
      : ""),
    (nestedUser
      ? readString(nestedUser, [
          "profile_photo_url",
          "profilePhotoUrl",
          "avatar_url",
          "avatarUrl",
          "photo_url",
        ])
      : ""),
  ];
  const value = candidates.find((candidate) => candidate && candidate !== "-") ?? "";

  return value ? resolveBackendMediaUrl(value) : null;
}

function employeeNumber(row: AdminRecord) {
  return readString(row, [
    "employee_no",
    "employeeNo",
    "user_no",
    "employee_number",
    "employeeNumber",
  ]);
}

function employeeDepartment(row: AdminRecord) {
  const direct = readString(row, ["department_name", "departmentName"]);
  if (direct !== "-") return direct;
  const primary = readNestedName(row.primary_department);
  return primary !== "—" ? primary : readNestedName(row.department);
}

function employeePosition(row: AdminRecord) {
  const direct = readString(row, ["position_name", "positionName"]);
  if (direct !== "-") return direct;
  const primary = readNestedName(row.primary_position);
  return primary !== "—" ? primary : readNestedName(row.position);
}

function employeeBranch(row: AdminRecord) {
  const direct = readString(row, ["branch_name", "branchName"]);
  if (direct !== "-") return direct;
  const primary = readNestedName(row.primary_branch);
  return primary !== "—" ? primary : readNestedName(row.branch);
}

function employeeRecordId(row: AdminRecord): number | null {
  const idRaw = row.id ?? row.employee_id ?? row.employeeId;
  if (typeof idRaw === "number" && Number.isFinite(idRaw)) {
    return idRaw;
  }
  if (typeof idRaw === "string" && idRaw.trim()) {
    const parsed = Number(idRaw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function employeeEmploymentStatus(row: AdminRecord) {
  return readString(row, [
    "employment_status",
    "employmentStatus",
    "status",
  ])
    .toLowerCase()
    .trim();
}

type EmployeesListViewProps = {
  directoryMode?: EmployeeDirectoryMode;
};


function employeeProfileHref(employeeNo: string, missingItemKey?: string) {
  const params = new URLSearchParams();
  if (missingItemKey) {
    params.set("missing", missingItemKey);
  }
  const query = params.toString();
  const basePath = `/dashboard/employees/profile/${encodeURIComponent(employeeNo)}`;
  return query ? `${basePath}?${query}` : basePath;
}

function readSnapshot(cacheKey: string) {
  const inMemory = employeeListSnapshotCache.get(cacheKey);
  if (inMemory && Date.now() - inMemory.cachedAt < EMPLOYEE_LIST_CACHE_TTL_MS) {
    return inMemory;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(
      `${EMPLOYEE_LIST_CACHE_PREFIX}:${cacheKey}`,
    );
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as EmployeeListSnapshot;
    if (Date.now() - parsed.cachedAt > EMPLOYEE_LIST_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(
        `${EMPLOYEE_LIST_CACHE_PREFIX}:${cacheKey}`,
      );
      return null;
    }
    employeeListSnapshotCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(cacheKey: string, snapshot: EmployeeListSnapshot) {
  employeeListSnapshotCache.set(cacheKey, snapshot);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      `${EMPLOYEE_LIST_CACHE_PREFIX}:${cacheKey}`,
      JSON.stringify(snapshot),
    );
  } catch {}
}

export function EmployeesListView({
  directoryMode = "current",
}: EmployeesListViewProps = {}) {
  const router = useRouter();
  const actor = useDashboardActor();
  const [query, setQuery] = React.useState(DEFAULT_QUERY);
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState<number | null>(null);
  const [total, setTotal] = React.useState<number | null>(null);
  const [missingDialog, setMissingDialog] = React.useState<{
    employeeNo: string;
    missing: Array<{ key: string; label: string }>;
  } | null>(null);
  const [removalOpen, setRemovalOpen] = React.useState(false);
  const [removalTarget, setRemovalTarget] =
    React.useState<EmployeeAccessRemovalTarget | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<string[]>([]);
  const [bulkArchiveOpen, setBulkArchiveOpen] = React.useState(false);
  const [bulkArchiveBusy, setBulkArchiveBusy] = React.useState(false);
  const [bulkArchiveResults, setBulkArchiveResults] = React.useState<
    Array<{ id: number; name: string; success: boolean; message?: string }>
  >([]);
  const [twoFactorTarget, setTwoFactorTarget] = React.useState<{
    userId: string | number;
    employeeName: string;
    enabled: boolean;
  } | null>(null);
  const [twoFactorBusy, setTwoFactorBusy] = React.useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = React.useState<{
    userId: string | number;
    employeeName: string;
  } | null>(null);
  const [temporaryPassword, setTemporaryPassword] = React.useState("");
  const [passwordResetBusy, setPasswordResetBusy] = React.useState(false);
  const debouncedSearch = useDebouncedValue(query.search, 350);
  const lastFetchAtRef = React.useRef(0);
  const requestSequenceRef = React.useRef(0);
  const canManageTwoFactor = canPerformPermission(
    actor.permissionLabels,
    "users:update",
  );
  const canRemoveEmployee =
    directoryMode === "current" &&
    canPerformPermission(actor.permissionLabels, {
      permissions: ["employees:update", "employees:delete"],
      mode: "any",
    });
  const canArchiveEmployees =
    directoryMode === "current" &&
    canPerformPermission(actor.permissionLabels, "employees:delete");
  const canAddEmployee =
    directoryMode === "current" &&
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/employees/registration",
      actor.permissionLabels,
      actor.accessMode,
    );
  const directoryStats = React.useMemo(() => {
    let active = 0;
    let onboarding = 0;
    let inactive = 0;

    rows.forEach((row) => {
      const status = employeeEmploymentStatus(row);
      if (status === "active") active += 1;
      else if (status === "onboarding") onboarding += 1;
      else if (["inactive", "terminated", "offboarding"].includes(status)) {
        inactive += 1;
      }
    });

    return { active, onboarding, inactive };
  }, [rows]);

  // Defense in depth: never render the company directory for employee shell users.
  React.useEffect(() => {
    if (!actor.ready) return;
    if (
      !canAccessDashboardRoute(
        "/dashboard/employees/all",
        actor.permissionLabels,
        actor.accessMode,
      )
    ) {
      router.replace(
        actor.accessMode === "employee" ? "/dashboard" : "/dashboard",
      );
    }
  }, [actor.accessMode, actor.permissionLabels, actor.ready, router]);

  useRenderDiagnostics("EmployeesListView", {
    page,
    search: query.search,
    rows: rows.length,
    loading,
  });

  const normalizedQuery = React.useMemo(
    () => ({
      ...query,
      search: debouncedSearch,
      employment_status:
        directoryMode === "inactive"
          ? undefined
          : query.employment_status || undefined,
      branch_id: query.branch_id > 0 ? query.branch_id : undefined,
      department_id: query.department_id > 0 ? query.department_id : undefined,
      position_id: query.position_id > 0 ? query.position_id : undefined,
    }),
    [debouncedSearch, directoryMode, query],
  );
  const queryCacheKey = React.useMemo(
    () => JSON.stringify({ directoryMode, ...normalizedQuery, page }),
    [directoryMode, normalizedQuery, page],
  );

  React.useEffect(() => {
    setSelectedEmployeeIds([]);
  }, [queryCacheKey]);

  React.useLayoutEffect(() => {
    const snapshot = readSnapshot(queryCacheKey);
    if (!snapshot) {
      return;
    }

    setRows(snapshot.rows);
    setTotalPages(snapshot.totalPages);
    setTotal(snapshot.total);
  }, [queryCacheKey]);

  const fetchEmployees = React.useCallback(
    async (signal?: AbortSignal) => {
      const requestSequence = ++requestSequenceRef.current;
      const token = readStoredToken();
      if (!token) {
        setError("Authentication required. Please log in again.");
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const requestController = new AbortController();
      let timedOut = false;
      const forwardAbort = () => requestController.abort();
      if (signal?.aborted) {
        requestController.abort();
      } else {
        signal?.addEventListener("abort", forwardAbort, { once: true });
      }
      const timeoutId = globalThis.setTimeout(() => {
        timedOut = true;
        requestController.abort();
      }, 15_000);
      try {
        const search = normalizedQuery.search.trim();
        const requestOptions = {
          signal: requestController.signal,
          cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
        };
        const needsFullDirectory =
          Boolean(search) || !normalizedQuery.employment_status;
        const result = needsFullDirectory
          ? await Promise.all([
              listAllEmployees(token, normalizedQuery, requestOptions),
              search
                ? listEmployees(
                    token,
                    {
                      ...normalizedQuery,
                      page: 1,
                      limit: Math.min(
                        100,
                        env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100,
                      ),
                      search,
                    },
                    requestOptions,
                  ).catch(() => ({ rows: [] as AdminRecord[] }))
                : Promise.resolve({ rows: [] as AdminRecord[] }),
            ]).then(([directoryRows, backendSearch]) => {
              const combinedRows = search
                ? mergeEmployeeDirectoryRows([
                    ...backendSearch.rows,
                    ...filterEmployeesByDirectorySearch(
                      directoryRows,
                      search,
                    ),
                  ])
                : directoryRows;
              const matchingRows = combinedRows.filter((row) => {
                const status = employeeEmploymentStatus(row);
                return employeeBelongsToDirectory(status, directoryMode);
              });
              const start = (page - 1) * normalizedQuery.limit;
              return {
                rows: matchingRows.slice(
                  start,
                  start + normalizedQuery.limit,
                ),
                page,
                limit: normalizedQuery.limit,
                total: matchingRows.length,
                totalPages: Math.max(
                  1,
                  Math.ceil(matchingRows.length / normalizedQuery.limit),
                ),
              };
            })
          : await listEmployees(
              token,
              {
                ...normalizedQuery,
                page,
              },
              requestOptions,
            );
        if (requestSequenceRef.current !== requestSequence || signal?.aborted) {
          return;
        }

        const baseRows = result.rows.map((row) =>
          withNormalizedTwoFactorFields(row),
        );
        lastFetchAtRef.current = Date.now();
        writeSnapshot(queryCacheKey, {
          rows: baseRows,
          totalPages: result.totalPages,
          total: result.total,
          cachedAt: Date.now(),
        });
        setRows(baseRows);
        setTotalPages(result.totalPages);
        setTotal(result.total);

        // 2FA lives on company users. Enrich it independently so a slow users
        // endpoint never blocks the employee directory from rendering.
        const neededUserIds = result.rows
          .map((row) => employeeUserId(row))
          .filter((id): id is string | number => id != null);
        void buildUserTwoFactorMap(token, neededUserIds, {
          signal,
          cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
        })
          .then((twoFactorByUserId) => {
            if (
              requestSequenceRef.current !== requestSequence ||
              signal?.aborted
            ) {
              return;
            }
            const rowsWithTwoFactor = result.rows.map((row) => {
              const userId = employeeUserId(row);
              const fromUser =
                userId != null
                  ? twoFactorByUserId.get(String(userId))
                  : undefined;
              const enabled =
                typeof fromUser === "boolean"
                  ? fromUser
                  : readTwoFactorEnabled(row);
              return withNormalizedTwoFactorFields({
                ...row,
                two_factor_enabled: enabled,
                is_two_factor_enabled: enabled,
                twoFactorEnabled: enabled,
              });
            });
            writeSnapshot(queryCacheKey, {
              rows: rowsWithTwoFactor,
              totalPages: result.totalPages,
              total: result.total,
              cachedAt: Date.now(),
            });
            setRows(rowsWithTwoFactor);
          })
          .catch(() => {
            // Employee rows are already available; retain their own 2FA flags.
          });
      } catch (errorObject) {
        if (signal?.aborted || requestSequenceRef.current !== requestSequence) {
          return;
        }
        setError(
          timedOut
            ? "Employee search took too long. Please try again."
            : errorObject instanceof Error
              ? errorObject.message
              : "Failed to load employees.",
        );
      } finally {
        globalThis.clearTimeout(timeoutId);
        signal?.removeEventListener("abort", forwardAbort);
        if (
          !signal?.aborted &&
          requestSequenceRef.current === requestSequence
        ) {
          setLoading(false);
        }
      }
    },
    [directoryMode, normalizedQuery, page, queryCacheKey],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void fetchEmployees(controller.signal);
    return () => controller.abort();
  }, [fetchEmployees]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onFocus = () => {
      if (Date.now() - lastFetchAtRef.current < 15_000) {
        return;
      }
      void fetchEmployees();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === EMPLOYEE_STATUS_REFRESH_KEY) {
        void fetchEmployees();
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener(EMPLOYEE_STATUS_REFRESH_EVENT, onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EMPLOYEE_STATUS_REFRESH_EVENT, onFocus);
    };
  }, [fetchEmployees]);

  const openEmployeeDetails = (row: AdminRecord, missingItemKey?: string) => {
    const employeeNo = readString(row, [
      "employee_no",
      "employeeNo",
      "user_no",
      "employee_number",
      "employeeNumber",
    ]);
    if (employeeNo === "-") {
      return;
    }
    router.push(employeeProfileHref(employeeNo, missingItemKey));
  };

  const openRemovalDialog = React.useCallback((row: AdminRecord) => {
    const employeeId = employeeRecordId(row);
    if (employeeId === null) {
      return;
    }
    setRemovalTarget({
      employeeId,
      employeeName: employeeDisplayName(row),
      employeeNo: readString(row, [
        "employee_no",
        "employeeNo",
        "user_no",
        "employee_number",
        "employeeNumber",
      ]),
    });
    setRemovalOpen(true);
  }, []);

  const selectedEmployees = React.useMemo(
    () =>
      rows.flatMap((row) => {
        const id = employeeRecordId(row);
        if (id === null || !selectedEmployeeIds.includes(String(id))) {
          return [];
        }
        return [{ id, name: employeeDisplayName(row) }];
      }),
    [rows, selectedEmployeeIds],
  );

  const confirmBulkArchive = React.useCallback(async () => {
    const token = readStoredToken();
    if (!token) {
      toast.error("Authentication required. Please log in again.");
      return;
    }
    if (selectedEmployees.length === 0) {
      toast.error("Select at least one employee.");
      return;
    }

    setBulkArchiveBusy(true);
    setBulkArchiveResults([]);
    const results = await Promise.all(
      selectedEmployees.map(async (employee) => {
        try {
          await archiveEmployeeProfile(token, employee.id);
          return { ...employee, success: true };
        } catch (errorObject) {
          return {
            ...employee,
            success: false,
            message:
              errorObject instanceof Error
                ? errorObject.message
                : "Could not archive this employee.",
          };
        }
      }),
    );

    const succeededIds = new Set(
      results.filter((result) => result.success).map((result) => String(result.id)),
    );
    setBulkArchiveResults(results);
    setSelectedEmployeeIds((current) =>
      current.filter((id) => !succeededIds.has(id)),
    );
    employeeListSnapshotCache.clear();
    await fetchEmployees();
    setBulkArchiveBusy(false);

    const successCount = results.filter((result) => result.success).length;
    const failureCount = results.length - successCount;
    if (failureCount === 0) {
      toast.success(`${successCount} employee${successCount === 1 ? "" : "s"} archived.`);
    } else if (successCount > 0) {
      toast.warning(`${successCount} archived; ${failureCount} failed.`);
    } else {
      toast.error("No employees were archived.");
    }
  }, [fetchEmployees, selectedEmployees]);

  const requestTwoFactorChange = React.useCallback(
    (row: AdminRecord) => {
      if (!canManageTwoFactor) {
        toast.error("You do not have permission to manage user 2FA.");
        return;
      }
      const userId = employeeUserId(row);
      if (userId == null) {
        toast.error("This employee does not have a linked user account.");
        return;
      }
      setTwoFactorTarget({
        userId,
        employeeName: employeeDisplayName(row),
        enabled: employeeTwoFactorEnabled(row),
      });
    },
    [canManageTwoFactor],
  );

  const confirmTwoFactorChange = React.useCallback(async () => {
    if (!twoFactorTarget) return;
    const token = readStoredToken();
    if (!token) {
      toast.error("Authentication required. Please log in again.");
      return;
    }
    setTwoFactorBusy(true);
    try {
      if (twoFactorTarget.enabled) {
        await disableUserTwoFactor(token, twoFactorTarget.userId);
        toast.success("2FA has been disabled for this user.");
      } else {
        await enableUserTwoFactor(token, twoFactorTarget.userId);
        toast.success(
          "2FA enabled. The user must complete setup during their next login.",
        );
      }
      setTwoFactorTarget(null);
      void fetchEmployees();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update 2FA.",
      );
    } finally {
      setTwoFactorBusy(false);
    }
  }, [fetchEmployees, twoFactorTarget]);

  const requestPasswordReset = React.useCallback(
    (row: AdminRecord) => {
      if (!canManageTwoFactor) {
        toast.error("You do not have permission to reset user passwords.");
        return;
      }
      const userId = employeeUserId(row);
      if (userId == null) {
        toast.error("This employee does not have a linked user account.");
        return;
      }
      setTemporaryPassword("");
      setPasswordResetTarget({
        userId,
        employeeName: employeeDisplayName(row),
      });
    },
    [canManageTwoFactor],
  );

  const confirmPasswordReset = React.useCallback(async () => {
    if (!passwordResetTarget || !temporaryPassword.trim()) {
      toast.error("Enter a temporary password.");
      return;
    }
    const token = readStoredToken();
    if (!token) {
      toast.error("Authentication required. Please log in again.");
      return;
    }
    setPasswordResetBusy(true);
    try {
      await resetUserPassword(
        token,
        passwordResetTarget.userId,
        temporaryPassword,
      );
      toast.success(
        "Password reset. The employee must change it after logging in.",
      );
      setPasswordResetTarget(null);
      setTemporaryPassword("");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to reset password.",
      );
    } finally {
      setPasswordResetBusy(false);
    }
  }, [passwordResetTarget, temporaryPassword]);

  const employeeColumns = React.useMemo<Column<AdminRecord>[]>(
    () => [
      {
        key: "employee",
        label: "Employee details",
        defaultWidth: 240,
        sortable: true,
        sortValue: (row: AdminRecord) => employeeDisplayName(row),
        render: (row: AdminRecord) => {
          const name = employeeDisplayName(row);
          const position = employeePosition(row);
          const number = employeeNumber(row);
          const photoUrl = employeePhotoUrl(row);
          return (
            <div className="flex min-w-0 items-center gap-2.5 py-1">
              <Avatar className="size-8 shrink-0 ring-1 ring-border">
                {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
                <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                  {employeeInitials(row)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{name}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {position !== "—" && position !== "-" ? position : "Position not assigned"}
                  {number !== "-" ? ` · ${number}` : ""}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        key: "department",
        label: "Department",
        defaultWidth: 145,
        sortable: true,
        sortValue: employeeDepartment,
        render: (row: AdminRecord) => (
          <span className="truncate text-xs font-medium text-foreground/85">
            {employeeDepartment(row)}
          </span>
        ),
      },
      {
        key: "branch",
        label: "Location",
        defaultWidth: 125,
        sortable: true,
        sortValue: employeeBranch,
        render: (row: AdminRecord) => (
          <span className="truncate text-xs text-muted-foreground">
            {employeeBranch(row)}
          </span>
        ),
      },
      {
        key: "hireDate",
        label: "Hired",
        defaultWidth: 105,
        sortable: true,
        render: (row: AdminRecord) => {
          const raw = readString(row, [
            "hire_date",
            "hireDate",
            "hired_at",
            "joined_at",
            "join_date",
            "created_at",
          ]);
          return raw && /^\d{4}-\d{2}-\d{2}/.test(raw)
            ? formatEmployeeDate(raw)
            : "—";
        },
      },
      {
        key: "status",
        label: "Status",
        defaultWidth: 105,
        sortable: true,
        render: (row: AdminRecord) => {
          const s = (
            readString(row, [
              "employment_status",
              "employmentStatus",
              "status",
            ]) || "active"
          )
            .toLowerCase()
            .trim();
          const display = s
            ? s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : "Unknown";
          const tone =
            s === "active" || s === "onboarding"
              ? "text-emerald-600"
              : s === "pending"
                ? "text-amber-600"
                : s === "inactive" || s === "terminated" || s === "offboarding"
                  ? "text-rose-600"
                  : "text-slate-600";
          const dot =
            s === "active" || s === "onboarding"
              ? "bg-emerald-500"
              : s === "pending"
                ? "bg-amber-500"
                : s === "inactive" || s === "terminated" || s === "offboarding"
                  ? "bg-rose-500"
                  : "bg-slate-400";
          return (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${tone}`}
              title={display}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              {display}
            </span>
          );
        },
      },
      {
        key: "actions",
        label: "Actions",
        defaultWidth: 175,
        sortable: false,
        render: (row: AdminRecord) => (
          <div
            className="flex items-center justify-end gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="text-[10px] font-medium text-muted-foreground">
              2FA
            </span>
            <Switch
              size="sm"
              checked={employeeTwoFactorEnabled(row)}
              disabled={!canManageTwoFactor || employeeUserId(row) == null}
              aria-label={`Toggle 2FA for ${employeeDisplayName(row)}`}
              title={
                !canManageTwoFactor
                  ? "You do not have permission to manage user 2FA"
                  : employeeUserId(row) == null
                    ? "No linked user account"
                    : employeeTwoFactorEnabled(row)
                      ? "2FA is enabled — click to disable"
                      : "2FA is off — click to require setup on next login"
              }
              onCheckedChange={() => requestTwoFactorChange(row)}
              onClick={(event) => event.stopPropagation()}
            />
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canManageTwoFactor || employeeUserId(row) == null}
              title={
                !canManageTwoFactor
                  ? "You do not have permission to reset user passwords"
                  : employeeUserId(row) == null
                    ? "No linked user account"
                    : "Reset password"
              }
              aria-label={`Reset password for ${employeeDisplayName(row)}`}
              onClick={(event) => {
                event.stopPropagation();
                requestPasswordReset(row);
              }}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>
            {canRemoveEmployee ? (
              <button
                type="button"
                className="inline-flex size-7 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Remove / disable access"
                aria-label="Remove or disable access"
                onClick={(event) => {
                  event.stopPropagation();
                  openRemovalDialog(row);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [
      canManageTwoFactor,
      canRemoveEmployee,
      openRemovalDialog,
      requestPasswordReset,
      requestTwoFactorChange,
    ],
  );

  return (
    <section className="overflow-hidden border border-border bg-background shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
            {directoryMode === "inactive" ? "Inactive employees" : "All employees"}
          </h1>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {directoryMode === "inactive"
              ? "Review former employees and retained employment records"
              : "Manage employee records, account security, and workforce access"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <UsersIcon className="size-3.5 text-primary" />
            {total ?? rows.length} {(total ?? rows.length) === 1 ? "person" : "people"}
          </span>
          <span>{rows.length} shown</span>
          {directoryMode === "current" ? (
            <>
              <span className="text-emerald-600 dark:text-emerald-400">
                {directoryStats.active} active
              </span>
              <span className="text-sky-600 dark:text-sky-400">
                {directoryStats.onboarding} onboarding
              </span>
            </>
          ) : (
            <span className="text-rose-600 dark:text-rose-400">
              {directoryStats.inactive} inactive
            </span>
          )}
        </div>
      </div>

      {error ? (
        <div className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <ResizableTable
        title="Employee"
        data={rows}
        columns={employeeColumns}
        onRowSelect={(id, row) => {
          if (row) openEmployeeDetails(row as AdminRecord);
        }}
        getRowId={(row, index) => String(employeeRecordId(row) ?? index)}
        showCheckboxes={canArchiveEmployees}
        selectedRowIds={selectedEmployeeIds}
        onSelectedRowIdsChange={setSelectedEmployeeIds}
        loading={loading}
        storageKey="employees"
        enableAnimations
        enableColumnVisibility
        compact
        itemsPerPage={query.limit}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setPage}
        className="[&>div:last-child]:mb-2"
        toolbarClassName="mb-0 border-b border-border bg-muted/[0.12] px-3 py-2"
        frameClassName="rounded-none border-0 shadow-none"
        toolbarStart={
          <>
            <span className="hidden shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:flex">
              <SlidersHorizontalIcon className="size-3" /> Filters
            </span>
            <SearchToggleField
              className="min-w-0 !w-auto !max-w-[15rem] !flex-none"
              placeholder="Search employees"
              value={query.search}
              onChange={(value) => {
                setPage(1);
                setQuery((previous) => ({ ...previous, search: value }));
              }}
            />
            {directoryMode === "current" ? (
              <Select
                value={query.employment_status || ALL_STATUSES_VALUE}
                onValueChange={(value) => {
                  setPage(1);
                  setQuery((previous) => ({
                    ...previous,
                    employment_status:
                      value === ALL_STATUSES_VALUE
                        ? ""
                        : (value as typeof previous.employment_status),
                  }));
                }}
              >
                <SelectTrigger size="sm" className="w-36 bg-background" aria-label="Filter employment status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_STATUSES_VALUE}>All statuses</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : null}
          </>
        }
        toolbarActions={
          <>
            {canArchiveEmployees && selectedEmployees.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                onClick={() => {
                  setBulkArchiveResults([]);
                  setBulkArchiveOpen(true);
                }}
              >
                <Trash2 data-icon="inline-start" />
                Archive ({selectedEmployees.length})
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={loading}
              aria-label="Refresh employees"
              title="Refresh employees"
              onClick={() => void fetchEmployees()}
            >
              <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
            </Button>
            {canAddEmployee ? (
              <Button
                type="button"
                size="sm"
                onClick={() => router.push("/dashboard/employees/registration")}
              >
                <PlusIcon data-icon="inline-start" />
                Add employee
              </Button>
            ) : null}
          </>
        }
      />

      <AlertDialog
        open={bulkArchiveOpen}
        onOpenChange={(open) => {
          if (bulkArchiveBusy) return;
          setBulkArchiveOpen(open);
          if (!open) setBulkArchiveResults([]);
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkArchiveResults.length > 0 ? "Bulk archive finished" : "Archive selected employees?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkArchiveResults.length > 0
                ? "Review the result for each selected employee."
                : `${selectedEmployees.length} employee${selectedEmployees.length === 1 ? "" : "s"} will be archived. Historical records remain available to the backend.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {bulkArchiveResults.length > 0 ? (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
              {bulkArchiveResults.map((result) => (
                <li
                  key={result.id}
                  className={result.success ? "text-emerald-700" : "text-rose-700"}
                >
                  {result.success ? "✓" : "✗"} {result.name}
                  {!result.success && result.message ? `: ${result.message}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="max-h-52 space-y-1 overflow-y-auto text-sm text-foreground">
              {selectedEmployees.map((employee) => (
                <li key={employee.id}>{employee.name}</li>
              ))}
            </ul>
          )}

          <AlertDialogFooter>
            {bulkArchiveResults.length > 0 ? (
              <AlertDialogCancel>Done</AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel disabled={bulkArchiveBusy}>Cancel</AlertDialogCancel>
                <button
                  type="button"
                  className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={bulkArchiveBusy || selectedEmployees.length === 0}
                  onClick={() => void confirmBulkArchive()}
                >
                  {bulkArchiveBusy ? "Archiving…" : "Archive employees"}
                </button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EmployeeAccessRemovalDialog
        open={removalOpen}
        target={removalTarget}
        onOpenChange={(open) => {
          setRemovalOpen(open);
          if (!open) setRemovalTarget(null);
        }}
        onCompleted={() => {
          void fetchEmployees();
        }}
      />

      <AlertDialog
        open={Boolean(twoFactorTarget)}
        onOpenChange={(open) => {
          if (!open && !twoFactorBusy) setTwoFactorTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {twoFactorTarget?.enabled ? "Disable 2FA" : "Enable 2FA"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {twoFactorTarget?.enabled
                ? `Disable two-factor authentication for ${twoFactorTarget.employeeName}? This revokes recovery data and may invalidate active sessions.`
                : `Enable two-factor authentication for ${twoFactorTarget?.employeeName}? They will complete setup on their next login.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={twoFactorBusy}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmTwoFactorChange();
              }}
              disabled={twoFactorBusy}
            >
              {twoFactorBusy
                ? "Updating…"
                : twoFactorTarget?.enabled
                  ? "Disable 2FA"
                  : "Enable 2FA"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(passwordResetTarget)}
        onOpenChange={(open) => {
          if (!open && !passwordResetBusy) {
            setPasswordResetTarget(null);
            setTemporaryPassword("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Set a temporary password for{" "}
              {passwordResetTarget?.employeeName ?? "this employee"}. This signs
              them out on every device, and they must change it after their next
              login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            value={temporaryPassword}
            onChange={(event) => setTemporaryPassword(event.target.value)}
            minLength={8}
            autoComplete="new-password"
            placeholder="Temporary password"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={passwordResetBusy}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmPasswordReset();
              }}
              disabled={passwordResetBusy || !temporaryPassword.trim()}
            >
              {passwordResetBusy ? "Resetting..." : "Reset Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(missingDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setMissingDialog(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Incomplete Profile Items</AlertDialogTitle>
            <AlertDialogDescription>
              {missingDialog
                ? `${missingDialog.employeeNo} has ${missingDialog.missing.length} incomplete item(s).`
                : "Incomplete profile details."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {missingDialog && missingDialog.missing.length > 0 ? (
            <div className="space-y-2">
              {missingDialog.missing.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-md border border-slate-200 p-2"
                >
                  <span className="text-sm text-slate-800">{item.label}</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    onClick={() => {
                      router.push(
                        employeeProfileHref(missingDialog.employeeNo, item.key),
                      );
                    }}
                  >
                    Open profile
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-700">
              All required items are completed.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
