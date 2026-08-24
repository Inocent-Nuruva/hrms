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
import { ResizableTable, type Column } from "@/components/ui/resizable-table";
import {
  EmployeeAccessRemovalDialog,
  type EmployeeAccessRemovalTarget,
} from "@/components/dashboard/employee-access-removal-dialog";
import {
  buildUserTwoFactorMap,
  disableUserTwoFactor,
  enableUserTwoFactor,
  listAllEmployees,
  listEmployees,
  readTwoFactorEnabled,
  resetUserPassword,
  withNormalizedTwoFactorFields,
  type AdminRecord,
  type EmployeesQueryParams,
} from "@/lib/admin-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRenderDiagnostics } from "@/hooks/use-render-diagnostics";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  canAccessDashboardRoute,
  canPerformPermission,
} from "@/lib/dashboard-permissions";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";
import { env } from "@/lib/env";
import { KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken";
const EMPLOYEE_STATUS_REFRESH_KEY = "hrms.employees.status.updatedAt";
const EMPLOYEE_STATUS_REFRESH_EVENT = "hrms:employee-status-updated";
const EMPLOYEE_LIST_CACHE_PREFIX = "hrms.employees.list";
const EMPLOYEE_LIST_CACHE_TTL_MS = env.NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS;
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

function normalizeEmployeeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesEmployeeSearch(row: AdminRecord, search: string) {
  const linkedUser =
    asRecord(row.company_user) ??
    asRecord(row.companyUser) ??
    asRecord(row.user) ??
    asRecord(row.account);
  const values = [
    employeeDisplayName(row),
    readString(row, ["first_name", "firstName"]),
    readString(row, ["middle_name", "middleName"]),
    readString(row, ["last_name", "lastName"]),
    readString(row, [
      "preferred_name",
      "preferredName",
      "display_name",
      "displayName",
    ]),
    readString(row, [
      "employee_no",
      "employeeNo",
      "employee_number",
      "employeeNumber",
    ]),
    readString(row, [
      "email",
      "work_email",
      "workEmail",
      "personal_email",
      "personalEmail",
    ]),
    readString(linkedUser ?? {}, ["first_name", "firstName"]),
    readString(linkedUser ?? {}, ["middle_name", "middleName"]),
    readString(linkedUser ?? {}, ["last_name", "lastName"]),
    readString(linkedUser ?? {}, ["username", "user_no", "email"]),
  ];
  const haystack = normalizeEmployeeSearchValue(
    values.filter((value) => value !== "-").join(" "),
  );
  const terms = normalizeEmployeeSearchValue(search)
    .split(/\s+/)
    .filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}

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

export function EmployeesListView() {
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
  const canRemoveEmployee = canPerformPermission(actor.permissionLabels, {
    permissions: ["employees:update", "employees:delete"],
    mode: "any",
  });

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
      employment_status: query.employment_status || undefined,
      branch_id: query.branch_id > 0 ? query.branch_id : undefined,
      department_id: query.department_id > 0 ? query.department_id : undefined,
      position_id: query.position_id > 0 ? query.position_id : undefined,
    }),
    [debouncedSearch, query],
  );
  const queryCacheKey = React.useMemo(
    () => JSON.stringify({ ...normalizedQuery, page }),
    [normalizedQuery, page],
  );

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
        const result = search
          ? await listAllEmployees(token, normalizedQuery, requestOptions).then(
              (directoryRows) => {
                const matchingRows = directoryRows.filter((row) =>
                  matchesEmployeeSearch(row, search),
                );
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
              },
            )
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
    [normalizedQuery, page, queryCacheKey],
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
    const idRaw = row.id ?? row.employee_id ?? row.employeeId;
    const employeeId =
      typeof idRaw === "number" && Number.isFinite(idRaw)
        ? idRaw
        : typeof idRaw === "string" && idRaw.trim()
          ? Number(idRaw)
          : null;
    if (employeeId === null || !Number.isFinite(employeeId)) {
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
        key: "employee_no",
        label: "No",
        defaultWidth: 80,
        sortable: true,
        render: (row: AdminRecord) =>
          readString(row, [
            "employee_no",
            "employeeNo",
            "user_no",
            "employee_number",
            "employeeNumber",
          ]),
      },
      {
        key: "name",
        label: "Name",
        defaultWidth: 120,
        sortable: true,
        render: (row: AdminRecord) => employeeDisplayName(row),
      },
      {
        key: "department",
        label: "Dept",
        defaultWidth: 90,
        sortable: true,
        render: (row: AdminRecord) => {
          const directDepartmentName = readString(row, [
            "department_name",
            "departmentName",
          ]);
          if (directDepartmentName !== "-") {
            return directDepartmentName;
          }
          const primaryDepartmentName = readNestedName(row.primary_department);
          if (primaryDepartmentName !== "—") {
            return primaryDepartmentName;
          }
          return readNestedName(row.department);
        },
      },
      {
        key: "position",
        label: "Position",
        defaultWidth: 100,
        sortable: true,
        render: (row: AdminRecord) => {
          const directPositionName = readString(row, [
            "position_name",
            "positionName",
          ]);
          if (directPositionName !== "-") {
            return directPositionName;
          }
          const primaryPositionName = readNestedName(row.primary_position);
          if (primaryPositionName !== "—") {
            return primaryPositionName;
          }
          return readNestedName(row.position);
        },
      },
      {
        key: "hireDate",
        label: "Hired",
        defaultWidth: 70,
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
        defaultWidth: 130,
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
        defaultWidth: 80,
        sortable: false,
        render: (row: AdminRecord) => (
          <div
            className="flex items-center justify-end gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="text-xs font-medium text-muted-foreground">
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
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
    <div className="space-y-2">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <ResizableTable
        title="Employees"
        data={rows}
        columns={employeeColumns}
        onRowSelect={(id, row) => {
          if (row) openEmployeeDetails(row as AdminRecord);
        }}
        loading={loading}
        storageKey="employees"
        enableAnimations
        itemsPerPage={query.limit}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setPage}
        toolbarStart={
          <>
            <SearchToggleField
              className="min-w-0 !w-auto !max-w-[14rem] !flex-none"
              placeholder="Search name, email, phone, user_no"
              value={query.search}
              onChange={(value) => {
                setPage(1);
                setQuery((previous) => ({ ...previous, search: value }));
              }}
            />
            <select
              className="h-8 w-[8.5rem] shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
              value={query.employment_status}
              onChange={(event) => {
                setPage(1);
                setQuery((previous) => ({
                  ...previous,
                  employment_status: event.target
                    .value as typeof previous.employment_status,
                }));
              }}
              aria-label="Filter employment status"
            >
              <option value="">All statuses</option>
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="terminated">Terminated</option>
              <option value="exited">Exited</option>
            </select>
          </>
        }
      />

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
    </div>
  );
}
