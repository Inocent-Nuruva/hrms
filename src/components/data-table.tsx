"use client";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "@/components/ui/fluent-toast-store";
import { showErrorAlert } from "@/lib/error-alert";
import { showSuccessAlert } from "@/lib/success-alert";
import { cn } from "@/lib/utils";
import { requestDashboardAccessRefresh } from "@/lib/dashboard-permissions";

import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle, } from "@/components/animate-ui/components/base/dialog";
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, } from "@/components/ui/drawer";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { SearchToggleField } from "@/components/common/search-toggle-field";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";
import type {
  AdminRecord, AdminResourceKey, SortOrder, UsersQueryParams, } from "@/lib/admin-api";
import {
  RESOURCE_LABELS, USER_TWO_FACTOR_FIELDS, assignPermissionToCurrentCompanyUser, assignPermissionToRole, assignUserToRole, assignUserAvatar, disableUserTwoFactor, enableUserTwoFactor, readForceTwoFactor, setUserForceTwoFactor, extractDefaultAvatarImageUrl, getPermissionById, getRoleById, isSelectableDefaultAvatar, listAllCurrentCompanyUsers, listDefaultAvatars, listResource, listRolePermissions, readDefaultAvatarId, listRoleUsers, readTwoFactorEnabled, revokePermissionFromCurrentCompanyUser, revokePermissionFromRole, revokeUserFromRole, } from "@/lib/admin-api";
import {
  PermissionPicker, canonicalizePermissionNames, isPermissionSelected, permissionGroupFromName, permissionTokenFromAssignment, toPermissionOptions, type PermissionOption, } from "@/components/dashboard/permission-picker";
import { RoleSuggestionStrip } from "@/components/dashboard/role-suggestion-strip";
import {
  availableRoleSuggestions, resolveSuggestionPermissions, type ResolvedRoleSuggestion, } from "@/components/dashboard/role-suggestions";
import {
  CheckIcon, CopyIcon, EllipsisVerticalIcon, ImageIcon, KeyRoundIcon, PencilIcon, PlusIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldOffIcon, Trash2Icon, UsersIcon, UserPlusIcon, UserMinusIcon } from "lucide-react";
import {
  Copy16Regular as FluentCopyIcon,
  Delete16Regular as FluentDeleteIcon,
  Edit16Regular as FluentEditIcon,
} from "@fluentui/react-icons"
import { Tab, TabList } from "@fluentui/react-components"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePublishedCompanyModules } from "@/hooks/use-company-modules";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";

interface DataTableProps {
  token: string;
  activeResource: AdminResourceKey;
  rows: AdminRecord[];
  roles: AdminRecord[];
  permissions: AdminRecord[];
  /** Current actor permission names from JWT/session (e.g. roles:create). */
  actorPermissions?: string[];
  usersQuery: Required<UsersQueryParams>;
  usersTotal: number | null;
  usersTotalPages: number | null;
  onUsersQueryChange: (query: Partial<Required<UsersQueryParams>>) => void;
  catalogQuery?: { page: number; limit: number; search: string };
  catalogTotal?: number | null;
  catalogTotalPages?: number | null;
  onCatalogQueryChange?: (
    query: Partial<{ page: number; limit: number; search: string }>,
  ) => void;
  loading: boolean;
  error: string | null;
  onCreate: (resource: AdminResourceKey, payload: AdminRecord) => Promise<void>;
  onPatch: (
    resource: Exclude<AdminResourceKey, "companies">,
    id: string | number,
    payload: AdminRecord,
  ) => Promise<void>;
  onDelete: (
    resource: Exclude<AdminResourceKey, "companies">,
    id: string | number,
  ) => Promise<void>;
  onUpdateUser: (id: string | number, payload: AdminRecord) => Promise<void>;
  onSetUserPassword: (
    id: string | number,
    newPassword: string,
  ) => Promise<void>;
  onSyncUserRoles: (
    userId: string | number,
    addRoleIds: (string | number)[],
    removeRoleIds: (string | number)[],
  ) => Promise<void>;
  /** Reload list after side-effect mutations (e.g. admin 2FA toggle). */
  onRefresh?: () => Promise<void>;
}

function hasActorPermission(
  actorPermissions: string[] | undefined,
  required: string,
) {
  const normalized = (actorPermissions ?? []).map((entry) =>
    entry.trim().toLowerCase(),
  );
  if (normalized.length === 0) return false;
  const need = required.toLowerCase().replace(/\./g, ":");
  return normalized.some((entry) => entry.replace(/\./g, ":") === need);
}

function resourceActionPermission(
  resource: AdminResourceKey,
  action: "create" | "update" | "delete" | "read",
) {
  return `${resource}:${action}`;
}

type EditableResource = Exclude<AdminResourceKey, "companies">;
type EntityResource = Exclude<AdminResourceKey, "users" | "companies">;

interface UserFormState {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  password: string;
  user_no: string;
  status: string;
  roleIds: string[];
}

interface BasicEntityForm {
  name: string;
  display_name: string;
  description: string;
}

interface CompanyForm {
  company_name: string;
  company_slug: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_email: string;
  admin_phone: string;
  admin_password: string;
}

const EMPTY_USER_FORM: UserFormState = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  password: "",
  user_no: "",
  status: "active",
  roleIds: [],
};

const EMPTY_ENTITY_FORM: BasicEntityForm = {
  name: "",
  display_name: "",
  description: "",
};

function slugifyRoleKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const EMPTY_COMPANY_FORM: CompanyForm = {
  company_name: "",
  company_slug: "",
  admin_first_name: "",
  admin_last_name: "",
  admin_email: "",
  admin_phone: "",
  admin_password: "",
};

function isEditableResource(
  resource: AdminResourceKey,
): resource is EditableResource {
  return resource !== "companies";
}

function getRowId(row: AdminRecord, fallbackIndex: number): string | number {
  const candidates = [row.id, row.user_id, row.user_no, row.name, row.email];
  const identified = candidates.find(
    (value) => typeof value === "string" || typeof value === "number",
  );
  return identified ?? fallbackIndex;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "-";
    }
    const first = value[0];
    if (typeof first === "string" || typeof first === "number") {
      return (
        value
          .slice(0, 2)
          .map((item) => String(item))
          .join(", ") + (value.length > 2 ? "..." : "")
      );
    }
    return `${value.length} item(s)`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferredKeys = [
      "name",
      "display_name",
      "title",
      "slug",
      "email",
      "code",
      "id",
    ];
    for (const key of preferredKeys) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
      if (typeof candidate === "number" || typeof candidate === "boolean") {
        return String(candidate);
      }
    }
    return "Object";
  }
  return String(value);
}

function getVisibleColumns(rows: AdminRecord[], resource: AdminResourceKey) {
  if (rows.length === 0) {
    return ["id", "name", "email"];
  }

  const preferredOrder = [
    "id",
    "user_no",
    "first_name",
    "last_name",
    "email",
    "phone",
    "name",
    "display_name",
    "description",
    "company_name",
    "company_slug",
    "status",
    "two_factor_enabled",
    "created_at",
  ];

  const rowKeys = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => rowKeys.add(key));
  });

  // Always surface a normalized 2FA column for users when any 2FA-like flag exists
  // (or after listUsers normalization which always sets two_factor_enabled).
  const twoFactorAliases = resource === "users" ? USER_TWO_FACTOR_FIELDS : [
    "two_factor_enabled",
    "is_two_factor_enabled",
    "twoFactorEnabled",
    "isTwoFactorEnabled",
    "is_2fa_enabled",
    "mfa_enabled",
    "totp_enabled",
  ];
  const hasTwoFactorSignal =
    twoFactorAliases.some((key) => rowKeys.has(key)) ||
    rows.some(
      (row) => readTwoFactorEnabled(row) || "two_factor_enabled" in row,
    );

  const ordered = preferredOrder.filter(
    (key) =>
      rowKeys.has(key) || (key === "two_factor_enabled" && hasTwoFactorSignal),
  );
  const remaining = Array.from(rowKeys)
    .filter(
      (key) => !ordered.includes(key) && !twoFactorAliases.includes(key), // collapse aliases into two_factor_enabled
    )
    .sort((a, b) => a.localeCompare(b));
  const columns = [...ordered, ...remaining].slice(0, 8);
  if (resource === "users" && hasTwoFactorSignal && !columns.includes("two_factor_enabled")) {
    columns.splice(7, 1, "two_factor_enabled");
  }
  return columns;
}

function formatTwoFactorCell(row: AdminRecord): React.ReactNode {
  const enabled = readTwoFactorEnabled(row);
  const forced = readForceTwoFactor(row);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge
        variant={enabled ? "default" : "secondary"}
        className={cn(
          "text-[10px] font-semibold",
          enabled
            ? "bg-emerald-600/90 text-white hover:bg-emerald-600/90"
            : "bg-muted text-muted-foreground",
        )}
      >
        {enabled ? "On" : "Off"}
      </Badge>
      {forced ? (
        <Badge variant="outline" className="text-[10px] font-semibold">
          Required
        </Badge>
      ) : null}
    </div>
  );
}

function prettifyKey(key: string) {
  if (
    key === "two_factor_enabled" ||
    key === "is_two_factor_enabled" ||
    key === "twoFactorEnabled" ||
    key === "isTwoFactorEnabled"
  ) {
    return "2FA";
  }
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function asRoleId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function rolePayloadId(value: string): string | number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && String(parsed) === value) {
    return parsed;
  }
  return value;
}

function readRecordString(record: AdminRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function roleLabel(role: AdminRecord) {
  return (
    readRecordString(role, [
      "display_name",
      "displayName",
      "name",
      "title",
      "code",
      "key",
    ]) || "Unnamed role"
  );
}

/** Flatten useful text from a role/permission row for client-side search. */
function accessControlSearchHaystack(row: AdminRecord): string {
  const parts: string[] = [];
  const push = (value: unknown) => {
    if (value === null || value === undefined) return;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const text = String(value).trim();
      if (text) parts.push(text);
    }
  };

  push(roleLabel(row));
  push(permissionLabel(row));
  push(permissionKey(row));
  for (const key of [
    "name",
    "display_name",
    "displayName",
    "description",
    "title",
    "code",
    "key",
    "slug",
    "id",
  ]) {
    push(row[key]);
  }

  // Nested labels (e.g. company, role group)
  for (const nestKey of ["company", "group", "meta"]) {
    const nested = asRecordValue(row[nestKey]);
    if (!nested) continue;
    for (const key of ["name", "display_name", "displayName", "title"]) {
      push(nested[key]);
    }
  }

  return parts.join(" ").toLowerCase();
}

function asPermissionName(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function permissionLabel(permission: AdminRecord) {
  return (
    readRecordString(permission, ["display_name", "displayName", "name"]) ||
    "Unnamed permission"
  );
}

function permissionKey(permission: AdminRecord) {
  return (
    asPermissionName(permission.name) ??
    asPermissionName(permission.key) ??
    asPermissionName(permission.code) ??
    asPermissionName(permission.display_name) ??
    asPermissionName(permission.displayName) ??
    ""
  );
}

function isSystemGenerated(record: AdminRecord) {
  const value = record.is_system_generated ?? record.isSystemGenerated;
  return value === true;
}

/** System roles with no company are platform roles; company admins can't edit them. */
function isLockedSystemRole(record: AdminRecord) {
  if (!isSystemGenerated(record)) return false;
  const companyId = record.company_id ?? record.companyId;
  return companyId === null || companyId === undefined;
}

function isProtectedCompanyAdminRole(record: AdminRecord) {
  return isSystemGenerated(record) && record.name === "COMPANY_ADMIN";
}

function asRecordValue(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null
    ? (value as AdminRecord)
    : null;
}

function companyUserMembershipId(record: AdminRecord): string | null {
  const id = record.id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

function readFiniteId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (
    typeof value === "string" &&
    value.trim() &&
    !Number.isNaN(Number(value.trim()))
  ) {
    return value.trim();
  }
  return null;
}

function companyUserLinkedUserId(record: AdminRecord): string | null {
  // Prefer explicit user identity fields over membership id.
  for (const key of [
    "user_id",
    "userId",
    "platform_user_id",
    "platformUserId",
    "auth_user_id",
    "authUserId",
  ]) {
    const id = readFiniteId(record[key]);
    if (id) return id;
  }

  for (const nestKey of ["user", "account", "profile", "person"]) {
    const nested = asRecordValue(record[nestKey]);
    if (!nested) continue;
    for (const key of ["id", "user_id", "userId"]) {
      const id = readFiniteId(nested[key]);
      if (id) return id;
    }
  }

  return null;
}

/**
 * Resolve the id required by POST /api/roles/{roleId}/users { user_id }.
 * Company-user rows sometimes only expose membership `id`; backends often accept that
 * as user_id, so fall back to membership id when no linked user id is present.
 */
function resolveRoleAssignUserId(record: AdminRecord): string | null {
  return companyUserLinkedUserId(record) ?? companyUserMembershipId(record);
}

function companyUserDisplayName(record: AdminRecord): string {
  const nested = asRecordValue(record.user);
  const first =
    readRecordString(record, ["first_name", "firstName"]) ||
    (nested ? readRecordString(nested, ["first_name", "firstName"]) : "");
  const last =
    readRecordString(record, ["last_name", "lastName"]) ||
    (nested ? readRecordString(nested, ["last_name", "lastName"]) : "");
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const email =
    readRecordString(record, ["email"]) ||
    (nested ? readRecordString(nested, ["email"]) : "");
  if (email) return email;
  const userNo =
    readRecordString(record, ["user_no", "userNo"]) ||
    (nested ? readRecordString(nested, ["user_no", "userNo"]) : "");
  return userNo || `User ${companyUserMembershipId(record) ?? "?"}`;
}

function companyUserEmail(record: AdminRecord): string {
  const nested = asRecordValue(record.user);
  return (
    readRecordString(record, ["email"]) ||
    (nested ? readRecordString(nested, ["email"]) : "") ||
    "—"
  );
}

function companyUserStatus(record: AdminRecord): string {
  const nested = asRecordValue(record.user);
  return (
    readRecordString(record, ["status"]) ||
    (nested ? readRecordString(nested, ["status"]) : "") ||
    "—"
  );
}

function idsMatchPermission(
  candidate: unknown,
  permissionId: string | number,
): boolean {
  const target = String(permissionId);
  if (candidate === null || candidate === undefined) return false;
  if (typeof candidate === "string" || typeof candidate === "number") {
    return String(candidate) === target;
  }
  if (typeof candidate === "object") {
    const rec = candidate as AdminRecord;
    const id = rec.id ?? rec.permission_id ?? rec.permissionId;
    if (id !== undefined && String(id) === target) return true;
    const name = rec.name;
    // name match is not used for id-based assignment; only id
    void name;
  }
  return false;
}

function companyUserHasPermission(
  record: AdminRecord,
  permissionId: string | number,
): boolean {
  const assignmentKeys = [
    "permission_assignments",
    "permissionAssignments",
    "direct_permissions",
    "directPermissions",
  ];
  for (const key of assignmentKeys) {
    const list = record[key];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (idsMatchPermission(entry, permissionId)) return true;
      const rec = asRecordValue(entry);
      if (!rec) continue;
      if (
        idsMatchPermission(rec.permission_id ?? rec.permissionId, permissionId)
      )
        return true;
      const nestedPermission = asRecordValue(rec.permission);
      if (
        nestedPermission &&
        idsMatchPermission(nestedPermission.id, permissionId)
      )
        return true;
    }
  }

  const nestedUser = asRecordValue(record.user);
  const permissionLists = [record.permissions, nestedUser?.permissions];
  for (const list of permissionLists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (idsMatchPermission(entry, permissionId)) return true;
    }
  }
  return false;
}

function companyUserHasRole(
  record: AdminRecord,
  roleId: string | number,
): boolean {
  const target = String(roleId);
  const assignmentKeys = ["role_assignments", "roleAssignments", "roles"];
  for (const key of assignmentKeys) {
    const list = record[key];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry === "string" || typeof entry === "number") {
        if (String(entry) === target) return true;
        continue;
      }
      const rec = asRecordValue(entry);
      if (!rec) continue;
      if (String(rec.role_id ?? rec.roleId ?? rec.id ?? "") === target)
        return true;
      const nestedRole = asRecordValue(rec.role);
      if (nestedRole && String(nestedRole.id ?? "") === target) return true;
    }
  }
  const nestedUser = asRecordValue(record.user);
  if (Array.isArray(nestedUser?.roles)) {
    for (const entry of nestedUser.roles) {
      if (typeof entry === "string" || typeof entry === "number") {
        if (String(entry) === target) return true;
        continue;
      }
      const rec = asRecordValue(entry);
      if (rec && String(rec.id ?? "") === target) return true;
    }
  }
  return false;
}

type AssignedMemberUser = {
  membershipId: string;
  userId: string | null;
  name: string;
  email: string;
  status: string;
  source: AdminRecord;
};

type DetailSheetTab = "general" | "assigned" | "permissions";

function SectionLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12">
      <FluentLoadingIndicator className="size-6 animate-spin text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DetailTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: DetailSheetTab; label: string }[];
  value: DetailSheetTab;
  onChange: (next: DetailSheetTab) => void;
}) {
  return (
    <TabList
      selectedValue={value}
      onTabSelect={(_event, data) => onChange(data.value as DetailSheetTab)}
      appearance="subtle"
      size="medium"
      className="border-b border-border/70"
    >
      {tabs.map((tab) => (
        <Tab key={tab.id} value={tab.id}>
          {tab.label}
        </Tab>
      ))}
    </TabList>
  );
}

function MicrosoftPermissionList({
  options,
  selectedNames,
  emptyLabel = "No permissions included in this role.",
}: {
  options: PermissionOption[];
  selectedNames: string[];
  emptyLabel?: string;
}) {
  const selectedSet = React.useMemo(
    () => new Set(selectedNames),
    [selectedNames],
  );
  const grouped = React.useMemo(() => {
    const map = new Map<string, PermissionOption[]>();
    for (const option of options) {
      if (!isPermissionSelected(option, selectedSet)) continue;
      const list = map.get(option.group) ?? [];
      list.push(option);
      map.set(option.group, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [options, selectedSet]);

  if (grouped.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          {selectedNames.length}
        </span>{" "}
        permissions included in this role
      </p>
      {grouped.map(([group, items]) => (
        <section
          key={group}
          className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-muted/20 px-3 py-2">
            {/* Primary color only on permission group titles */}
            <h4 className="text-sm font-semibold text-primary">{group}</h4>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
              {items.length}
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-px bg-border/40 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item.name}
                className="flex items-start gap-2 bg-card px-3 py-2.5"
              >
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-primary"
                  strokeWidth={2.5}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-snug text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                    {item.name}
                  </p>
                  {item.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground/90">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function permissionScope(name: string) {
  return permissionGroupFromName(name);
}

type AccessControlTableRow = AdminRecord & {
  __id: string;
  display: string;
  key: string;
  module: string;
  description: string;
  type: string;
  permissions_count?: number;
  /** Users assigned to this role when the list payload includes a count. */
  users_count?: number;
  __source: AdminRecord;
};

function readEmbeddedRoleUserCount(row: AdminRecord): number | null {
  for (const key of [
    "users_count",
    "user_count",
    "usersCount",
    "userCount",
    "members_count",
    "membersCount",
    "assigned_users_count",
    "assignedUsersCount",
    "total_users",
    "totalUsers",
  ]) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }
  }
  for (const key of ["users", "members", "assigned_users", "assignedUsers"]) {
    const value = row[key];
    if (Array.isArray(value)) {
      return value.length;
    }
  }
  return null;
}

function rolePermissionNamesFromRecord(row: AdminRecord): string[] {
  const candidates = [
    row.permissions,
    row.permission_assignments,
    row.role_permissions,
  ];
  for (const source of candidates) {
    if (!Array.isArray(source)) {
      continue;
    }

    const names = source
      .map((entry) => permissionTokenFromAssignment(entry))
      .filter((value): value is string => Boolean(value));

    if (names.length > 0) {
      return Array.from(new Set(names));
    }
  }
  return [];
}

function roleUserIdFromRecord(row: AdminRecord): string | null {
  const direct = row.user_id ?? row.userId;
  if (typeof direct === "number" && Number.isFinite(direct))
    return String(direct);
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  for (const key of ["user", "company_user", "companyUser", "member"]) {
    const nested = asRecordValue(row[key]);
    if (!nested) continue;
    const nestedId = nested.id ?? nested.user_id ?? nested.userId;
    if (typeof nestedId === "number" && Number.isFinite(nestedId))
      return String(nestedId);
    if (typeof nestedId === "string" && nestedId.trim()) return nestedId.trim();
  }
  // Last resort: only treat bare id as user id when no nested user object exists.
  const id = row.id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

function mapRoleApiUserToMember(
  row: AdminRecord,
  index: number,
): AssignedMemberUser {
  const nestedUser =
    asRecordValue(row.user) ??
    asRecordValue(row.company_user) ??
    asRecordValue(row.companyUser) ??
    asRecordValue(row.member);
  const displaySource = nestedUser ?? row;
  const userId = roleUserIdFromRecord(row);
  const membershipId =
    companyUserMembershipId(row) ??
    companyUserMembershipId(displaySource) ??
    userId ??
    `role-user-${index}`;

  return {
    membershipId,
    userId,
    name: companyUserDisplayName(displaySource),
    email: companyUserEmail(displaySource),
    status: companyUserStatus(displaySource),
    source: row,
  };
}

function userRoleIds(row: AdminRecord): string[] {
  const roles = row.roles;
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles
    .map((role) => {
      if (typeof role === "string" || typeof role === "number") {
        return asRoleId(role);
      }
      if (typeof role === "object" && role !== null) {
        return asRoleId((role as AdminRecord).id);
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
}

function toUserForm(row: AdminRecord): UserFormState {
  return {
    first_name: typeof row.first_name === "string" ? row.first_name : "",
    last_name: typeof row.last_name === "string" ? row.last_name : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    email: typeof row.email === "string" ? row.email : "",
    password: "",
    user_no: typeof row.user_no === "string" ? row.user_no : "",
    status:
      typeof row.status === "string" && row.status.trim()
        ? row.status
        : "active",
    roleIds: userRoleIds(row),
  };
}

function toEntityForm(row: AdminRecord): BasicEntityForm {
  return {
    name: readRecordString(row, ["name"]),
    display_name: readRecordString(row, ["display_name", "displayName"]),
    description: readRecordString(row, ["description"]),
  };
}

/** Match ResizableTable row population animation (per-row delay, valid HTML). */
const adminTableRowHidden = {
  opacity: 0,
  y: 12,
  scale: 0.985,
  filter: "blur(3px)",
};

const adminTableRowVisible = (index: number) => ({
  opacity: 1,
  y: 0,
  scale: 1,
  filter: "blur(0px)",
  transition: {
    type: "spring" as const,
    stiffness: 420,
    damping: 26,
    mass: 0.65,
    delay: 0.05 + index * 0.03,
  },
});

export function DataTable({
  token,
  activeResource,
  rows,
  roles,
  permissions,
  actorPermissions = [],
  usersQuery,
  usersTotal,
  usersTotalPages,
  onUsersQueryChange,
  catalogQuery = { page: 1, limit: 20, search: "" },
  catalogTotal = null,
  catalogTotalPages = null,
  onCatalogQueryChange,
  loading,
  error,
  onCreate,
  onPatch,
  onDelete,
  onUpdateUser,
  onSetUserPassword,
  onSyncUserRoles,
  onRefresh,
}: DataTableProps) {
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimateRows = !shouldReduceMotion;
  const companyModules = usePublishedCompanyModules();
  const dashboardActor = useDashboardActor();
  const canUsePermissionCatalog = companyModules.permissions !== false;
  const canUsePermissionCatalogRef = React.useRef(canUsePermissionCatalog);
  React.useEffect(() => {
    canUsePermissionCatalogRef.current = canUsePermissionCatalog;
  }, [canUsePermissionCatalog]);
  const [searchInput, setSearchInput] = React.useState(usersQuery.search);
  const [createUserForm, setCreateUserForm] =
    React.useState<UserFormState>(EMPTY_USER_FORM);
  const [editingUser, setEditingUser] = React.useState<{
    id: string | number;
    label: string;
  } | null>(null);
  const [editUserForm, setEditUserForm] =
    React.useState<UserFormState>(EMPTY_USER_FORM);
  const [targetPasswordUser, setTargetPasswordUser] = React.useState<{
    id: string | number;
    label: string;
  } | null>(null);
  const [targetPassword, setTargetPassword] = React.useState("");
  const [twoFactorUser, setTwoFactorUser] = React.useState<{
    id: string | number;
    label: string;
    mode: "enable" | "disable" | "force" | "unforce";
  } | null>(null);
  const [twoFactorReason, setTwoFactorReason] = React.useState("");
  const [twoFactorBusy, setTwoFactorBusy] = React.useState(false);
  const [avatarUser, setAvatarUser] = React.useState<{
    id: string | number;
    label: string;
  } | null>(null);
  const [defaultAvatars, setDefaultAvatars] = React.useState<AdminRecord[]>([]);
  const [avatarsLoading, setAvatarsLoading] = React.useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = React.useState<number | null>(
    null,
  );
  const [avatarBusy, setAvatarBusy] = React.useState(false);

  const [roleForm, setRoleForm] =
    React.useState<BasicEntityForm>(EMPTY_ENTITY_FORM);
  const [rolePermissionNames, setRolePermissionNames] = React.useState<
    string[]
  >([]);
  const [createAccessOpen, setCreateAccessOpen] = React.useState(false);
  const [roleKeyTouched, setRoleKeyTouched] = React.useState(false);
  const [activeRoleSuggestion, setActiveRoleSuggestion] =
    React.useState<ResolvedRoleSuggestion | null>(null);
  const [companyForm, setCompanyForm] =
    React.useState<CompanyForm>(EMPTY_COMPANY_FORM);
  const [editingEntity, setEditingEntity] = React.useState<{
    resource: EntityResource;
    /** Platform-level system role: read-only for company admins. */
    systemRole: boolean;
    /** Built-in (seeded) role: editable, but its internal key is fixed. */
    builtInRole: boolean;
    id: string | number;
    label: string;
  } | null>(null);
  const [editingEntityForm, setEditingEntityForm] =
    React.useState<BasicEntityForm>(EMPTY_ENTITY_FORM);
  const [initialEditingEntityForm, setInitialEditingEntityForm] =
    React.useState<BasicEntityForm>(EMPTY_ENTITY_FORM);
  const [editingRolePermissionNames, setEditingRolePermissionNames] =
    React.useState<string[]>([]);
  const [
    initialEditingRolePermissionNames,
    setInitialEditingRolePermissionNames,
  ] = React.useState<string[]>([]);
  const [permissionSaveProgress, setPermissionSaveProgress] = React.useState<{
    done: number;
    total: number;
  } | null>(null);
  const [accessControlSearch, setAccessControlSearch] = React.useState("");
  const [pickerPermissions, setPickerPermissions] = React.useState<
    AdminRecord[]
  >([]);
  const [pickerPermissionsLoading, setPickerPermissionsLoading] =
    React.useState(false);
  const [detailSheetTab, setDetailSheetTab] =
    React.useState<DetailSheetTab>("general");
  const [memberCompanyUsers, setMemberCompanyUsers] = React.useState<
    AdminRecord[]
  >([]);
  const [assignedMemberIds, setAssignedMemberIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  /** Users from GET /api/roles/{roleId}/users — source of truth for role Assigned tab. */
  const [roleAssignedUsers, setRoleAssignedUsers] = React.useState<
    AssignedMemberUser[]
  >([]);
  const [membersLoading, setMembersLoading] = React.useState(false);
  const [membersError, setMembersError] = React.useState<string | null>(null);
  const [membersBusy, setMembersBusy] = React.useState(false);
  const [memberSearch, setMemberSearch] = React.useState("");
  const [memberToAdd, setMemberToAdd] = React.useState<string>("");
  /** Filters the assign-user picker list (not the assigned people list). */
  const [assignPickerQuery, setAssignPickerQuery] = React.useState("");
  const [membersRefreshKey, setMembersRefreshKey] = React.useState(0);
  const [, setRolePermissionNamesFromApi] =
    React.useState<string[] | null>(null);
  const [rolePermissionsLoading, setRolePermissionsLoading] =
    React.useState(false);
  const [revokeConfirm, setRevokeConfirm] = React.useState<{
    membershipId: string;
    userId: string | null;
    displayName: string;
  } | null>(null);
  const [peopleDialogOpen, setPeopleDialogOpen] = React.useState(false);
  const rolePermissionsDraftDirtyRef = React.useRef(false);
  const permissionOptionsRef = React.useRef<PermissionOption[]>([]);
  const permissionMutationNextAllowedAtRef = React.useRef(0);

  const columns = React.useMemo(() => {
    const baseColumns = getVisibleColumns(rows, activeResource);
    if (activeResource === "roles") {
      return baseColumns.filter(
        (column) => column !== "company_id" && column !== "companyId",
      );
    }
    return baseColumns;
  }, [activeResource, rows]);
  const roleOptions = React.useMemo(() => {
    return roles
      .map((role) => {
        const id = asRoleId(role.id);
        if (!id) {
          return null;
        }
        return { id, label: roleLabel(role) };
      })
      .filter((item): item is { id: string; label: string } => Boolean(item));
  }, [roles]);
  const permissionOptions = React.useMemo(
    () =>
      toPermissionOptions(
        pickerPermissions.length > 0 ? pickerPermissions : permissions,
      ),
    [permissions, pickerPermissions],
  );
  const roleSuggestions = React.useMemo(
    () =>
      activeResource === "roles"
        ? availableRoleSuggestions(rows, permissionOptions)
        : [],
    [activeResource, permissionOptions, rows],
  );

  React.useEffect(() => {
    permissionOptionsRef.current = permissionOptions;
  }, [permissionOptions]);

  React.useEffect(() => {
    if (permissionOptions.length === 0) return;
    const remap = (current: string[]) =>
      canonicalizePermissionNames(current, permissionOptions);
    setEditingRolePermissionNames(remap);
    setInitialEditingRolePermissionNames(remap);
    setRolePermissionNamesFromApi((current) =>
      current ? remap(current) : current,
    );
  }, [permissionOptions]);
  const filteredAccessControlRows = React.useMemo(() => {
    const query = accessControlSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      accessControlSearchHaystack(row).includes(query),
    );
  }, [accessControlSearch, rows]);

  const accessControlTableRows = React.useMemo((): AccessControlTableRow[] => {
    if (activeResource !== "roles" && activeResource !== "permissions") {
      return [];
    }
    const mapped = filteredAccessControlRows.map((row, index) => {
      const id = String(getRowId(row, index + 1));
      if (activeResource === "permissions") {
        const key = permissionKey(row);
        return {
          ...row,
          __id: id,
          display: permissionLabel(row),
          key: key || "—",
          module: permissionScope(key),
          description: readRecordString(row, ["description"]) || "—",
          type: isSystemGenerated(row) ? "System" : "Custom",
          __source: row,
        };
      }
      const embeddedUsers = readEmbeddedRoleUserCount(row);
      return {
        ...row,
        __id: id,
        display: roleLabel(row),
        key: readRecordString(row, ["name"]) || "—",
        module: "Role",
        description: readRecordString(row, ["description"]) || "—",
        type: isSystemGenerated(row) ? "System" : "Custom",
        permissions_count: rolePermissionNamesFromRecord(row).length,
        users_count: embeddedUsers ?? undefined,
        __source: row,
      };
    });
    // Stable alphabetical order so system roles (e.g. "Company User") are easy to find.
    return mapped.sort((a, b) =>
      String(a.display).localeCompare(String(b.display), undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );
  }, [activeResource, filteredAccessControlRows]);

  const openAccessControlRow = React.useCallback(
    (row: AdminRecord) => {
      if (activeResource !== "roles" && activeResource !== "permissions") {
        return;
      }
      const rowId = getRowId(row, 0);
      const rowLabel = stringifyValue(
        row.name ?? row.display_name ?? row.displayName ?? row.email ?? rowId,
      );
      const nextEntityForm = toEntityForm(row);
      const nextRolePermissions =
        activeResource === "roles"
          ? canonicalizePermissionNames(
              rolePermissionNamesFromRecord(row),
              permissionOptions,
            )
          : [];
      rolePermissionsDraftDirtyRef.current = false;
      setEditingEntity({
        resource: activeResource,
        systemRole: activeResource === "roles" && isLockedSystemRole(row),
        builtInRole: activeResource === "roles" && isSystemGenerated(row),
        id: rowId,
        label: rowLabel,
      });
      setEditingEntityForm(nextEntityForm);
      setInitialEditingEntityForm(nextEntityForm);
      setEditingRolePermissionNames(nextRolePermissions);
      setInitialEditingRolePermissionNames(nextRolePermissions);
      setRolePermissionNamesFromApi(null);
    },
    [activeResource, permissionOptions],
  );

  const permissionIdsFromSelection = React.useCallback(
    (selection: string[]) => {
      const resolved = selection
        .map((value) => {
          const byName = permissionOptions.find(
            (permission) => permission.name === value,
          );
          if (byName) {
            return rolePayloadId(byName.id);
          }
          return rolePayloadId(value);
        })
        .filter((value) => value !== "");
      return Array.from(new Set(resolved));
    },
    [permissionOptions],
  );

  const applyRoleSuggestion = React.useCallback(
    (suggestion: ResolvedRoleSuggestion) => {
      const resolved = resolveSuggestionPermissions(
        suggestion,
        permissionOptions.map((option) => option.name),
      );
      setRoleForm({
        name: slugifyRoleKey(`${suggestion.displayName} custom`),
        display_name: `${suggestion.displayName} (custom)`,
        description: suggestion.description,
      });
      setRolePermissionNames(
        canonicalizePermissionNames(
          resolved.length > 0 ? resolved : suggestion.permissionNames,
          permissionOptions,
        ),
      );
      setRoleKeyTouched(true);
      setActiveRoleSuggestion(suggestion);
      setCreateAccessOpen(true);
    },
    [permissionOptions],
  );

  React.useEffect(() => {
    if (!activeRoleSuggestion || permissionOptions.length === 0) return;
    setRolePermissionNames((current) => {
      if (current.length > 0) return current;
      const resolved = resolveSuggestionPermissions(
        activeRoleSuggestion,
        permissionOptions.map((option) => option.name),
      );
      return canonicalizePermissionNames(resolved, permissionOptions);
    });
  }, [activeRoleSuggestion, permissionOptions]);

  const canCreateResource = hasActorPermission(
    actorPermissions,
    resourceActionPermission(activeResource, "create"),
  );
  const canUpdateResource = hasActorPermission(
    actorPermissions,
    resourceActionPermission(activeResource, "update"),
  );
  const canDeleteResource = hasActorPermission(
    actorPermissions,
    resourceActionPermission(activeResource, "delete"),
  );

  const isEditingEntityDirty = React.useMemo(() => {
    if (!editingEntity) {
      return false;
    }

    return (
      editingEntityForm.name !== initialEditingEntityForm.name ||
      editingEntityForm.display_name !==
        initialEditingEntityForm.display_name ||
      editingEntityForm.description !== initialEditingEntityForm.description
    );
  }, [
    editingEntity,
    editingEntityForm.description,
    editingEntityForm.display_name,
    editingEntityForm.name,
    initialEditingEntityForm.description,
    initialEditingEntityForm.display_name,
    initialEditingEntityForm.name,
  ]);

  const isRolePermissionsDirty = React.useMemo(() => {
    if (!editingEntity || editingEntity.resource !== "roles") {
      return false;
    }
    const current = new Set(editingRolePermissionNames);
    const initial = new Set(initialEditingRolePermissionNames);
    if (current.size !== initial.size) return true;
    for (const name of current) {
      if (!initial.has(name)) return true;
    }
    return false;
  }, [
    editingEntity,
    editingRolePermissionNames,
    initialEditingRolePermissionNames,
  ]);

  React.useEffect(() => {
    setSearchInput(usersQuery.search);
  }, [usersQuery.search]);

  const toggleRoleId = (
    roleIds: string[],
    roleId: string,
    onChange: (next: string[]) => void,
  ) => {
    if (roleIds.includes(roleId)) {
      onChange(roleIds.filter((id) => id !== roleId));
      return;
    }
    onChange([...roleIds, roleId]);
  };

  const handleCreate = async () => {
    if (!token) {
      toast.error("Your session expired. Please sign in again.");
      return;
    }

    try {
      if (activeResource === "users") {
        if (
          !createUserForm.first_name.trim() ||
          !createUserForm.last_name.trim()
        ) {
          toast.error("First name and last name are required.");
          return;
        }
        if (!createUserForm.email.trim()) {
          toast.error("Email is required.");
          return;
        }
        if (!createUserForm.password.trim()) {
          toast.error("Password is required.");
          return;
        }

        await onCreate("users", {
          first_name: createUserForm.first_name.trim(),
          last_name: createUserForm.last_name.trim(),
          phone: createUserForm.phone.trim(),
          email: createUserForm.email.trim().toLowerCase(),
          password: createUserForm.password,
          user_no: createUserForm.user_no.trim(),
          status: createUserForm.status,
          roles: createUserForm.roleIds.map((id) => ({
            id: rolePayloadId(id),
          })),
        });
        setCreateUserForm(EMPTY_USER_FORM);
      }

      if (activeResource === "roles") {
        if (!roleForm.name.trim()) {
          toast.error("Role name is required.");
          return;
        }
        if (!roleForm.display_name.trim()) {
          toast.error("Display name is required.");
          return;
        }
        await onCreate("roles", {
          name: roleForm.name.trim(),
          display_name: roleForm.display_name.trim(),
          description: roleForm.description.trim(),
          permission_ids: canUsePermissionCatalog
            ? permissionIdsFromSelection(rolePermissionNames)
            : [],
        });
        setRoleForm(EMPTY_ENTITY_FORM);
        setRolePermissionNames([]);
        setRoleKeyTouched(false);
        setActiveRoleSuggestion(null);
        setCreateAccessOpen(false);
      }

      if (activeResource === "permissions") {
        if (!roleForm.name.trim() || !roleForm.display_name.trim()) {
          toast.error("Permission key and display name are required.");
          return;
        }
        await onCreate("permissions", {
          name: roleForm.name.trim(),
          display_name: roleForm.display_name.trim(),
          description: roleForm.description.trim(),
        });
        setRoleForm(EMPTY_ENTITY_FORM);
        setRoleKeyTouched(false);
        setCreateAccessOpen(false);
      }

      if (activeResource === "companies") {
        if (
          !companyForm.company_name.trim() ||
          !companyForm.company_slug.trim()
        ) {
          toast.error("Company name and slug are required.");
          return;
        }
        await onCreate("companies", {
          company_name: companyForm.company_name.trim(),
          company_slug: companyForm.company_slug.trim(),
          admin_first_name: companyForm.admin_first_name.trim(),
          admin_last_name: companyForm.admin_last_name.trim(),
          admin_email: companyForm.admin_email.trim().toLowerCase(),
          admin_phone: companyForm.admin_phone.trim(),
          admin_password: companyForm.admin_password,
        });
        setCompanyForm(EMPTY_COMPANY_FORM);
      }

      showSuccessAlert(`${RESOURCE_LABELS[activeResource]} created.`);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Create failed.";
      toast.error(message);
    }
  };

  const handleSaveUserEdit = async () => {
    if (!token || !editingUser) {
      return;
    }

    try {
      await onUpdateUser(editingUser.id, {
        first_name: editUserForm.first_name.trim(),
        last_name: editUserForm.last_name.trim(),
        phone: editUserForm.phone.trim(),
        email: editUserForm.email.trim().toLowerCase(),
        user_no: editUserForm.user_no.trim(),
        status: editUserForm.status,
      });

      const existingRow = rows.find(
        (row, index) => getRowId(row, index + 1) === editingUser.id,
      );
      const previousRoleIds = new Set(
        existingRow ? userRoleIds(existingRow) : [],
      );
      const nextRoleIds = new Set(editUserForm.roleIds);
      const addRoleIds = Array.from(nextRoleIds)
        .filter((id) => !previousRoleIds.has(id))
        .map(rolePayloadId);
      const removeRoleIds = Array.from(previousRoleIds)
        .filter((id) => !nextRoleIds.has(id))
        .map(rolePayloadId);

      if (addRoleIds.length > 0 || removeRoleIds.length > 0) {
        await onSyncUserRoles(editingUser.id, addRoleIds, removeRoleIds);
      }

      setEditingUser(null);
      showSuccessAlert("User updated.");
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Update failed.";
      toast.error(message);
    }
  };

  const handleSaveEntityEdit = async () => {
    if (!token || !editingEntity) {
      return;
    }

    try {
      // Role field updates: PATCH /api/roles/{id}
      // Role permission membership is managed live via
      // POST/DELETE /api/roles/{roleId}/permissions (not permission_ids on PATCH).
      await onPatch(editingEntity.resource, editingEntity.id, {
        name: editingEntityForm.name.trim(),
        display_name: editingEntityForm.display_name.trim(),
        description: editingEntityForm.description.trim(),
      });
      setEditingEntity(null);
      setInitialEditingEntityForm(EMPTY_ENTITY_FORM);
      setEditingRolePermissionNames([]);
      setInitialEditingRolePermissionNames([]);
      setRolePermissionNamesFromApi(null);
      showSuccessAlert(`${RESOURCE_LABELS[editingEntity.resource]} updated.`);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Update failed.";
      toast.error(message);
    }
  };

  const handleDelete = React.useCallback(
    async (rowId: string | number) => {
      if (!token) {
        toast.error("Your session expired. Please sign in again.");
        return;
      }
      if (!isEditableResource(activeResource)) {
        return;
      }

      try {
        await onDelete(activeResource, rowId);
        showSuccessAlert(`${RESOURCE_LABELS[activeResource]} deleted.`);
      } catch (errorObject) {
        const message =
          errorObject instanceof Error ? errorObject.message : "Delete failed.";
        toast.error(message);
      }
    },
    [token, activeResource, onDelete],
  );

  const accessControlColumns =
    React.useMemo((): Column<AccessControlTableRow>[] => {
      const actionsColumn: Column<AccessControlTableRow> = {
        key: "actions",
        label: "Actions",
        defaultWidth: canDeleteResource ? 96 : 72,
        sortable: false,
        render: (row) => (
          <div
            className="flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Open details"
              aria-label="Open details"
              onClick={() => openAccessControlRow(row.__source)}
            >
              <FluentEditIcon className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Copy details"
              aria-label="Copy details"
              onClick={() => {
                void navigator.clipboard
                  .writeText(JSON.stringify(row.__source, null, 2))
                  .then(() => showSuccessAlert("Record details copied."))
                  .catch(() => showErrorAlert("Clipboard access was denied."));
              }}
            >
              <FluentCopyIcon className="size-4" aria-hidden="true" />
            </button>
            {isEditableResource(activeResource) && canDeleteResource && !(activeResource === "roles" && (isLockedSystemRole(row.__source) || isProtectedCompanyAdminRole(row.__source))) ? (
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Delete"
                aria-label="Delete"
                onClick={() => void handleDelete(row.__id)}
              >
                <FluentDeleteIcon className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ),
      };

      if (activeResource === "permissions") {
        return [
          {
            key: "display",
            label: "Permission",
            defaultWidth: 200,
            sortable: true,
            render: (row) => (
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {row.display}
              </span>
            ),
          },
          {
            key: "module",
            label: "Module",
            defaultWidth: 140,
            sortable: true,
            render: (row) => (
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {row.module}
              </span>
            ),
          },
          {
            key: "description",
            label: "Description",
            defaultWidth: 260,
            sortable: true,
            render: (row) => (
              <span className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                {row.description}
              </span>
            ),
          },
          {
            key: "type",
            label: "Type",
            defaultWidth: 100,
            sortable: true,
            render: (row) => (
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {row.type}
              </span>
            ),
          },
          actionsColumn,
        ];
      }

      return [
        {
          key: "display",
          label: "Role",
          defaultWidth: 200,
          sortable: true,
          render: (row) => (
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {row.display}
            </span>
          ),
        },
        {
          key: "users_count",
          label: "Users",
          defaultWidth: 90,
          sortable: true,
          render: (row) => (
            <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
              {row.users_count ?? "—"}
            </span>
          ),
        },
        ...(canUsePermissionCatalog
          ? ([
              {
                key: "permissions_count",
                label: "Permissions",
                defaultWidth: 110,
                sortable: true,
                render: (row) => (
                  <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                    {row.permissions_count ?? 0}
                  </span>
                ),
              },
            ] as Column<AccessControlTableRow>[])
          : []),
        {
          key: "description",
          label: "Description",
          defaultWidth: 240,
          sortable: true,
          render: (row) => (
            <span className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
              {row.description}
            </span>
          ),
        },
        {
          key: "type",
          label: "Type",
          defaultWidth: 100,
          sortable: true,
          render: (row) => (
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {row.type}
            </span>
          ),
        },
        actionsColumn,
      ];
    }, [
      activeResource,
      canDeleteResource,
      canUsePermissionCatalog,
      handleDelete,
      openAccessControlRow,
    ]);

  const handleSetPassword = async () => {
    if (!token || !targetPasswordUser) {
      return;
    }
    if (!targetPassword.trim()) {
      toast.error("New password is required.");
      return;
    }

    try {
      await onSetUserPassword(targetPasswordUser.id, targetPassword);
      setTargetPassword("");
      setTargetPasswordUser(null);
      showSuccessAlert("Password updated.");
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Password update failed.";
      toast.error(message);
    }
  };

  React.useEffect(() => {
    if (!avatarUser || !token) return;
    let cancelled = false;
    setAvatarsLoading(true);
    void listDefaultAvatars(token, { status: "active" })
      .then((rows) => {
        if (!cancelled) {
          setDefaultAvatars(
            rows.filter((row) => isSelectableDefaultAvatar(row)),
          );
        }
      })
      .catch((errorObject) => {
        if (!cancelled) {
          setDefaultAvatars([]);
          const message =
            errorObject instanceof Error
              ? errorObject.message
              : "Failed to load avatars.";
          toast.error(message);
        }
      })
      .finally(() => {
        if (!cancelled) setAvatarsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarUser, token]);

  const handleAdminTwoFactor = async () => {
    if (!token || !twoFactorUser) return;
    setTwoFactorBusy(true);
    try {
      if (twoFactorUser.mode === "enable") {
        await enableUserTwoFactor(token, twoFactorUser.id);
        showSuccessAlert(
          "2FA required for this user. They complete setup during their next login.",
        );
      } else if (twoFactorUser.mode === "force") {
        await setUserForceTwoFactor(token, twoFactorUser.id, true);
        showSuccessAlert(
          "Two-factor is now mandatory for this user until they complete setup.",
        );
      } else if (twoFactorUser.mode === "unforce") {
        await setUserForceTwoFactor(token, twoFactorUser.id, false);
        showSuccessAlert("Two-factor is no longer mandatory for this user.");
      } else {
        await disableUserTwoFactor(token, twoFactorUser.id, twoFactorReason);
        showSuccessAlert("2FA has been disabled for this user.");
      }
      setTwoFactorUser(null);
      setTwoFactorReason("");
      if (onRefresh) {
        await onRefresh();
      }
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update 2FA.";
      toast.error(message);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const handleAssignAvatar = async () => {
    if (!token || !avatarUser || selectedAvatarId == null) return;
    setAvatarBusy(true);
    try {
      await assignUserAvatar(token, avatarUser.id, selectedAvatarId);
      showSuccessAlert("Avatar assigned successfully.");
      setAvatarUser(null);
      setSelectedAvatarId(null);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to assign avatar.";
      toast.error(message);
    } finally {
      setAvatarBusy(false);
    }
  };

  const sortOrder = usersQuery.sortOrder as SortOrder;
  const canPrevPage = usersQuery.page > 1;
  const userCount = usersTotal ?? rows.length;
  const canNextPage = usersTotalPages
    ? usersQuery.page < usersTotalPages
    : rows.length >= usersQuery.limit;
  const isAccessControlResource =
    activeResource === "roles" || activeResource === "permissions";

  React.useEffect(() => {
    setAccessControlSearch(catalogQuery.search);
  }, [activeResource, catalogQuery.search]);

  const debouncedAccessControlSearch = useDebouncedValue(
    accessControlSearch,
    400,
  );
  React.useEffect(() => {
    if (activeResource !== "roles" && activeResource !== "permissions") {
      return;
    }
    if (!onCatalogQueryChange) {
      return;
    }
    if (debouncedAccessControlSearch === catalogQuery.search) {
      return;
    }
    onCatalogQueryChange({ search: debouncedAccessControlSearch, page: 1 });
  }, [
    activeResource,
    catalogQuery.search,
    debouncedAccessControlSearch,
    onCatalogQueryChange,
  ]);

  const canManageAssignments =
    hasActorPermission(actorPermissions, "users:update") ||
    hasActorPermission(actorPermissions, "company_users:update") ||
    hasActorPermission(actorPermissions, "company_users:manage") ||
    hasActorPermission(actorPermissions, "permissions:update") ||
    hasActorPermission(actorPermissions, "roles:update") ||
    hasActorPermission(actorPermissions, "users:assign-role");

  React.useEffect(() => {
    if (!editingEntity) {
      rolePermissionsDraftDirtyRef.current = false;
      setDetailSheetTab("general");
      setMemberCompanyUsers([]);
      setAssignedMemberIds(new Set());
      setRoleAssignedUsers([]);
      setMembersError(null);
      setMembersLoading(false);
      setMemberSearch("");
      setMemberToAdd("");
      setRolePermissionNamesFromApi(null);
      setRolePermissionsLoading(false);
      setRevokeConfirm(null);
      setPeopleDialogOpen(false);
      return;
    }
    rolePermissionsDraftDirtyRef.current = false;
    // Roles open on Assigned so the people summary from GET /roles/{id}/users is visible first.
    setDetailSheetTab("assigned");
    setMemberSearch("");
    setMemberToAdd("");
    setAssignPickerQuery("");
    setRoleAssignedUsers([]);
    setPeopleDialogOpen(false);
    // Intentionally keyed on id/resource (not the whole editingEntity object) so that
    // in-place label updates don't reset the detail sheet's tab/search/picker state.
  }, [editingEntity, editingEntity?.id, editingEntity?.resource]);

  const roleSheetTab: DetailSheetTab =
    !canUsePermissionCatalog && detailSheetTab === "permissions"
      ? "assigned"
      : detailSheetTab;

  React.useEffect(() => {
    const needsCatalog =
      canUsePermissionCatalogRef.current &&
      Boolean(token) &&
      (editingEntity?.resource === "roles" ||
        (createAccessOpen && activeResource === "roles"));
    if (!needsCatalog) {
      return;
    }
    let cancelled = false;
    setPickerPermissionsLoading(true);
    void listResource("permissions", token, { pageAll: true, pageSize: 100 })
      .then((rows) => {
        if (!cancelled) {
          setPickerPermissions(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPickerPermissions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPickerPermissionsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeResource, createAccessOpen, editingEntity?.resource, token]);

  React.useEffect(() => {
    if (!editingEntity) return;
    if (
      editingEntity.resource !== "permissions" &&
      editingEntity.resource !== "roles"
    )
      return;
    if (!token) {
      setMembersError("Sign in to load assigned users.");
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loadMembers = async () => {
      setMembersLoading(true);
      setMembersError(null);
      try {
        const companyUsers = await listAllCurrentCompanyUsers(token, {
          signal: controller.signal,
        });
        if (cancelled) return;
        setMemberCompanyUsers(companyUsers);

        const assigned = new Set<string>();
        const entityId = editingEntity.id;

        if (editingEntity.resource === "permissions") {
          for (const companyUser of companyUsers) {
            const membershipId = companyUserMembershipId(companyUser);
            if (
              membershipId &&
              companyUserHasPermission(companyUser, entityId)
            ) {
              assigned.add(membershipId);
            }
          }
          const permissionDetail = await getPermissionById(
            entityId,
            token,
          ).catch(() => null);
          if (cancelled) return;
          if (permissionDetail && Array.isArray(permissionDetail.users)) {
            const linkedUserIds = new Set<string>();
            for (const entry of permissionDetail.users) {
              if (typeof entry === "number" || typeof entry === "string") {
                linkedUserIds.add(String(entry));
                continue;
              }
              const rec = asRecordValue(entry);
              if (rec?.id !== undefined && rec.id !== null) {
                linkedUserIds.add(String(rec.id));
              }
            }
            for (const companyUser of companyUsers) {
              const membershipId = companyUserMembershipId(companyUser);
              const linkedUserId = companyUserLinkedUserId(companyUser);
              if (
                membershipId &&
                linkedUserId &&
                linkedUserIds.has(linkedUserId)
              ) {
                assigned.add(membershipId);
              }
            }
          }
        } else {
          // Roles: GET /api/roles/{id}, /permissions, /users
          let roleUsersResult: { rows: AdminRecord[] };
          try {
            roleUsersResult = await listRoleUsers(token, entityId, {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            });
          } catch (roleUsersError) {
            // Don't swallow silently — surface API failures for the Assigned list.
            throw roleUsersError instanceof Error
              ? roleUsersError
              : new Error("Failed to load users assigned to this role.");
          }

          const [roleDetail, rolePermissions] = await Promise.all([
            getRoleById(entityId, token).catch(() => null),
            canUsePermissionCatalogRef.current
              ? listRolePermissions(token, entityId).catch(
                  () => [] as AdminRecord[],
                )
              : Promise.resolve([] as AdminRecord[]),
          ]);
          if (cancelled) return;

          const permissionNames = canonicalizePermissionNames(
            (() => {
              if (rolePermissions.length > 0) {
                return rolePermissionNamesFromRecord({
                  permissions: rolePermissions,
                });
              }
              if (roleDetail) {
                return rolePermissionNamesFromRecord(roleDetail);
              }
              return [] as string[];
            })(),
            permissionOptionsRef.current,
          );

          setInitialEditingRolePermissionNames(permissionNames);
          if (!rolePermissionsDraftDirtyRef.current) {
            setRolePermissionNamesFromApi(permissionNames);
            setEditingRolePermissionNames(permissionNames);
          }

          if (roleDetail) {
            const nextForm = toEntityForm(roleDetail);
            setEditingEntityForm(nextForm);
            setInitialEditingEntityForm(nextForm);
          }

          // Primary list: render GET /api/roles/{roleId}/users rows directly.
          const fromApi = roleUsersResult.rows.map((row, index) =>
            mapRoleApiUserToMember(row, index),
          );
          setRoleAssignedUsers(fromApi);

          const linkedUserIds = new Set(
            fromApi
              .map((entry) => entry.userId)
              .filter((id): id is string => Boolean(id)),
          );

          for (const companyUser of companyUsers) {
            const membershipId = companyUserMembershipId(companyUser);
            const linkedUserId = companyUserLinkedUserId(companyUser);
            if (
              membershipId &&
              ((linkedUserId && linkedUserIds.has(linkedUserId)) ||
                companyUserHasRole(companyUser, entityId))
            ) {
              assigned.add(membershipId);
            }
          }
        }

        setAssignedMemberIds(assigned);
      } catch (errorObject) {
        if (cancelled || controller.signal.aborted) return;
        const message =
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to load assignment details.";
        setMembersError(message);
        setMemberCompanyUsers([]);
        setAssignedMemberIds(new Set());
      } finally {
        if (!cancelled) {
          setMembersLoading(false);
          setRolePermissionsLoading(false);
        }
      }
    };

    if (editingEntity.resource === "roles" && canUsePermissionCatalogRef.current) {
      setRolePermissionsLoading(true);
    }
    void loadMembers();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [editingEntity, editingEntity?.id, editingEntity?.resource, token, membersRefreshKey]);

  const assignedMembers = React.useMemo((): AssignedMemberUser[] => {
    const query = memberSearch.trim().toLowerCase();

    // Roles: show people returned by GET /api/roles/{roleId}/users.
    if (editingEntity?.resource === "roles") {
      return roleAssignedUsers
        .filter((row) => {
          if (!query) return true;
          return `${row.name} ${row.email} ${row.status} ${row.userId ?? ""}`
            .toLowerCase()
            .includes(query);
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return memberCompanyUsers
      .filter((row) => {
        const membershipId = companyUserMembershipId(row);
        return membershipId ? assignedMemberIds.has(membershipId) : false;
      })
      .map((row) => {
        const membershipId = companyUserMembershipId(row) ?? "";
        return {
          membershipId,
          userId: companyUserLinkedUserId(row),
          name: companyUserDisplayName(row),
          email: companyUserEmail(row),
          status: companyUserStatus(row),
          source: row,
        };
      })
      .filter((row) => {
        if (!query) return true;
        return `${row.name} ${row.email} ${row.status}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    assignedMemberIds,
    editingEntity?.resource,
    memberCompanyUsers,
    memberSearch,
    roleAssignedUsers,
  ]);

  const availableMembers = React.useMemo(() => {
    const assignedUserIds = new Set(
      roleAssignedUsers
        .flatMap((entry) => [entry.userId, entry.membershipId])
        .filter((id): id is string => Boolean(id)),
    );
    return memberCompanyUsers
      .filter((row) => {
        const membershipId = companyUserMembershipId(row);
        if (!membershipId) return false;
        if (editingEntity?.resource === "roles") {
          const assignUserId = resolveRoleAssignUserId(row);
          if (assignUserId && assignedUserIds.has(assignUserId)) return false;
          if (assignedMemberIds.has(membershipId)) return false;
          return true;
        }
        return !assignedMemberIds.has(membershipId);
      })
      .map((row) => {
        const membershipId = companyUserMembershipId(row) ?? "";
        const name = companyUserDisplayName(row);
        const email = companyUserEmail(row);
        const userId = resolveRoleAssignUserId(row);
        return {
          membershipId,
          userId,
          name,
          email,
          label: email && email !== "—" ? `${name} · ${email}` : name,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [
    assignedMemberIds,
    editingEntity?.resource,
    memberCompanyUsers,
    roleAssignedUsers,
  ]);

  const selectedMemberToAdd = React.useMemo(
    () =>
      availableMembers.find((entry) => entry.membershipId === memberToAdd) ??
      null,
    [availableMembers, memberToAdd],
  );

  const filteredAssignableMembers = React.useMemo(() => {
    const query = assignPickerQuery.trim().toLowerCase();
    if (!query) return availableMembers;
    const tokens = query.split(/\s+/).filter(Boolean);
    return availableMembers.filter((user) => {
      const haystack =
        `${user.name} ${user.email} ${user.label} ${user.userId ?? ""} ${user.membershipId}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [assignPickerQuery, availableMembers]);

  const displayedRolePermissionNames = editingRolePermissionNames;

  const handleAssignMember = async () => {
    if (!token || !editingEntity) return;
    if (
      editingEntity.resource !== "permissions" &&
      editingEntity.resource !== "roles"
    )
      return;
    if (!memberToAdd) {
      toast.error(
        editingEntity.resource === "roles"
          ? "Select a user to assign this role."
          : "Select a user to assign this permission.",
      );
      return;
    }
    const membershipId = String(memberToAdd);
    const selected = availableMembers.find(
      (entry) => entry.membershipId === membershipId,
    );
    setMembersBusy(true);
    try {
      if (editingEntity.resource === "permissions") {
        await assignPermissionToCurrentCompanyUser(
          token,
          membershipId,
          editingEntity.id,
        );
        showSuccessAlert("Permission assigned to user.");
        setAssignedMemberIds((prev) => {
          const next = new Set(prev);
          next.add(membershipId);
          return next;
        });
      } else {
        // POST /api/roles/{roleId}/users  body: { user_id }
        const companyUser = memberCompanyUsers.find(
          (row) => companyUserMembershipId(row) === membershipId,
        );
        const userId =
          selected?.userId ??
          (companyUser ? resolveRoleAssignUserId(companyUser) : null) ??
          membershipId;
        if (!userId) {
          throw new Error(
            "Could not resolve user_id for the selected person. Check that the company user has a linked account.",
          );
        }
        await assignUserToRole(token, editingEntity.id, userId);
        showSuccessAlert(
          selected?.name
            ? `Assigned ${selected.name} to this role.`
            : "Role assigned to user.",
        );
        // Reload from GET /api/roles/{roleId}/users so the list stays accurate.
        setMembersRefreshKey((key) => key + 1);
      }
      requestDashboardAccessRefresh();
      setMemberToAdd("");
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to assign to user.";
      showErrorAlert(message);
    } finally {
      setMembersBusy(false);
    }
  };

  const requestRevokeMember = (
    membershipId: string,
    userId?: string | null,
    displayName?: string,
  ) => {
    if (!token || !editingEntity) return;
    if (
      editingEntity.resource !== "permissions" &&
      editingEntity.resource !== "roles"
    )
      return;
    setRevokeConfirm({
      membershipId,
      userId: userId ?? null,
      displayName: displayName?.trim() || "this person",
    });
  };

  const handleConfirmRevokeMember = async () => {
    if (!token || !editingEntity || !revokeConfirm) return;
    if (
      editingEntity.resource !== "permissions" &&
      editingEntity.resource !== "roles"
    )
      return;

    const { membershipId, userId, displayName: personLabel } = revokeConfirm;
    setMembersBusy(true);
    try {
      if (editingEntity.resource === "permissions") {
        await revokePermissionFromCurrentCompanyUser(
          token,
          membershipId,
          editingEntity.id,
        );
        showSuccessAlert("Permission removed from user.");
        setAssignedMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(String(membershipId));
          return next;
        });
      } else {
        // DELETE /api/roles/{roleId}/users/{userId}
        let resolvedUserId = userId;
        if (!resolvedUserId) {
          const companyUser = memberCompanyUsers.find(
            (row) => companyUserMembershipId(row) === membershipId,
          );
          resolvedUserId = companyUser
            ? resolveRoleAssignUserId(companyUser)
            : membershipId;
        }
        if (!resolvedUserId) {
          throw new Error("Could not resolve user_id for this assignment.");
        }
        await revokeUserFromRole(token, editingEntity.id, resolvedUserId);
        showSuccessAlert(`Removed ${personLabel} from this role.`);
        setMembersRefreshKey((key) => key + 1);
      }
      requestDashboardAccessRefresh();
      setRevokeConfirm(null);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to remove assignment.";
      showErrorAlert(message);
    } finally {
      setMembersBusy(false);
    }
  };

  const handleRolePermissionsChange = (nextNames: string[]) => {
    if (
      !canUsePermissionCatalog ||
      !editingEntity ||
      editingEntity.resource !== "roles"
    ) {
      return;
    }
    rolePermissionsDraftDirtyRef.current = true;
    const canonical = canonicalizePermissionNames(nextNames, permissionOptions);
    setEditingRolePermissionNames(canonical);
    setRolePermissionNamesFromApi(canonical);
  };

  const handleSaveRolePermissions = async () => {
    if (
      !canUsePermissionCatalog ||
      !token ||
      !editingEntity ||
      editingEntity.resource !== "roles"
    ) {
      return;
    }

    const previous = [...initialEditingRolePermissionNames];
    const nextNames = [...displayedRolePermissionNames];
    const previousSet = new Set(previous);
    const nextSet = new Set(nextNames);
    const toAdd = nextNames.filter((name) => !previousSet.has(name));
    const toRemove = previous.filter((name) => !nextSet.has(name));

    if (toAdd.length === 0 && toRemove.length === 0) {
      return;
    }

    const resolvePermissionId = (name: string) => {
      const option = permissionOptions.find(
        (entry) =>
          entry.name === name || entry.id === name || entry.label === name,
      );
      if (!option?.id) {
        throw new Error(`Unknown permission: ${name}`);
      }
      return option.id;
    };

    const sleep = (ms: number) =>
      new Promise((resolve) => window.setTimeout(resolve, ms));
    const waitForPermissionWindow = async (gapMs: number) => {
      const waitMs = Math.max(
        0,
        permissionMutationNextAllowedAtRef.current - Date.now(),
      );
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      permissionMutationNextAllowedAtRef.current = Date.now() + gapMs;
    };
    const runWithRetry = async (fn: () => Promise<unknown>, gapMs: number) => {
      let retryDelay = Math.max(gapMs * 2, 1_500);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await waitForPermissionWindow(gapMs);
        try {
          return await fn();
        } catch (errorObject) {
          const status = (errorObject as { status?: number }).status;
          if (status !== 429 || attempt === 4) {
            throw errorObject;
          }
          permissionMutationNextAllowedAtRef.current = Date.now() + retryDelay;
          await sleep(retryDelay);
          retryDelay = Math.min(Math.max(retryDelay * 2, 2_500), 10_000);
        }
      }
    };

    const removeOnly = toRemove.length > 0 && toAdd.length === 0;
    const addGapMs = removeOnly ? 0 : 450;
    const removeGapMs = removeOnly ? 900 : 650;

    const tasks: Array<{ run: () => Promise<void>; isRemoval: boolean }> = [
      ...toAdd.map((name) => ({
        isRemoval: false,
        run: async () => {
          await runWithRetry(
            () =>
              assignPermissionToRole(
                token,
                editingEntity.id,
                resolvePermissionId(name),
              ),
            addGapMs,
          );
        },
      })),
      ...toRemove.map((name) => ({
        isRemoval: true,
        run: async () => {
          await runWithRetry(
            () =>
              revokePermissionFromRole(
                token,
                editingEntity.id,
                resolvePermissionId(name),
              ),
            removeGapMs,
          );
        },
      })),
    ];

    const batchSize = removeOnly ? 2 : 4;
    const pauseBetweenBatchesMs = removeOnly ? 1_250 : 500;

    setMembersBusy(true);
    setPermissionSaveProgress({ done: 0, total: tasks.length });
    let done = 0;
    try {
      for (let start = 0; start < tasks.length; start += batchSize) {
        const batch = tasks.slice(start, start + batchSize);
        for (const task of batch) {
          await task.run();
          done += 1;
          setPermissionSaveProgress({ done, total: tasks.length });
        }
        if (start + batchSize < tasks.length) {
          await sleep(pauseBetweenBatchesMs);
        }
      }
      setInitialEditingRolePermissionNames(nextNames);
      requestDashboardAccessRefresh();
      showSuccessAlert(
        toAdd.length > 0 && toRemove.length === 0
          ? toAdd.length === 1
            ? "Permission assigned to role."
            : `${toAdd.length} permissions assigned to role.`
          : toRemove.length > 0 && toAdd.length === 0
            ? toRemove.length === 1
              ? "Permission removed from role."
              : `${toRemove.length} permissions removed from role.`
            : "Role permissions updated.",
      );
    } catch (errorObject) {
      try {
        const rolePermissions = await listRolePermissions(
          token,
          editingEntity.id,
        );
        const permissionNames = rolePermissionNamesFromRecord({
          permissions: rolePermissions,
        });
        setEditingRolePermissionNames(permissionNames);
        setRolePermissionNamesFromApi(permissionNames);
        setInitialEditingRolePermissionNames(permissionNames);
      } catch {
        setEditingRolePermissionNames(previous);
        setRolePermissionNamesFromApi(previous);
      }
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update role permissions.";
      showErrorAlert(message);
    } finally {
      setMembersBusy(false);
      setPermissionSaveProgress(null);
    }
  };

  const isCreatingRole = activeResource === "roles";
  const accessControlCreateDrawer =
    canCreateResource && isAccessControlResource ? (
      <>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white transition hover:brightness-95"
          onClick={() => {
            setActiveRoleSuggestion(null);
            setCreateAccessOpen(true);
          }}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {isCreatingRole ? "Create role" : "Create permission"}
          </span>
        </button>
        <Dialog
          open={createAccessOpen}
          onOpenChange={(open) => {
            setCreateAccessOpen(open);
            if (!open) {
              setRoleForm(EMPTY_ENTITY_FORM);
              setRolePermissionNames([]);
              setRoleKeyTouched(false);
              setActiveRoleSuggestion(null);
            }
          }}
        >
          <DialogPopup
            from="right"
            className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
          >
            <DialogHeader className="shrink-0 space-y-1 border-b border-slate-200 px-4 py-3 pr-10 text-left dark:border-border">
              <DialogTitle className="text-base">
                {isCreatingRole ? "Create role" : "Create permission"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isCreatingRole
                  ? activeRoleSuggestion
                    ? `Started from ${activeRoleSuggestion.displayName}. Review the selected permissions, then create.`
                    : "Give it a name, then pick what this role can do."
                  : "Add a permission key and a short label."}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="create-role-display" className="text-xs">
                    Display name
                  </Label>
                  <Input
                    id="create-role-display"
                    value={roleForm.display_name}
                    onChange={(event) => {
                      const displayName = event.target.value;
                      setRoleForm((prev) => ({
                        ...prev,
                        display_name: displayName,
                        name:
                          isCreatingRole && !roleKeyTouched
                            ? slugifyRoleKey(displayName)
                            : prev.name,
                      }));
                    }}
                    placeholder={
                      isCreatingRole ? "HR Manager" : "Read employees"
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="create-role-key" className="text-xs">
                    {isCreatingRole ? "Key" : "Name (key)"}
                  </Label>
                  <Input
                    id="create-role-key"
                    value={roleForm.name}
                    onChange={(event) => {
                      setRoleKeyTouched(true);
                      setRoleForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }));
                    }}
                    placeholder={
                      isCreatingRole ? "hr_manager" : "employees:read"
                    }
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-role-description" className="text-xs">
                  Description
                  <span className="ml-1 font-normal text-slate-400">
                    optional
                  </span>
                </Label>
                <Input
                  id="create-role-description"
                  value={roleForm.description}
                  onChange={(event) =>
                    setRoleForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="What this is for"
                />
              </div>
              {isCreatingRole && canUsePermissionCatalog ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Permissions
                    {rolePermissionNames.length > 0 ? (
                      <span className="ml-1 font-normal text-muted-foreground">
                        {rolePermissionNames.length} selected
                      </span>
                    ) : null}
                  </Label>
                  {activeRoleSuggestion ? (
                    <p className="text-[11px] text-muted-foreground">
                      Selected permissions are shown first. Uncheck anything this role should not have.
                    </p>
                  ) : null}
                  <div className="rounded-md border border-slate-200 p-2 dark:border-border">
                    <PermissionPicker
                      compact
                      loading={pickerPermissionsLoading}
                      reviewSelected={Boolean(activeRoleSuggestion)}
                      options={permissionOptions}
                      selectedNames={rolePermissionNames}
                      onChange={setRolePermissionNames}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <DialogFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-border">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setCreateAccessOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={() => void handleCreate()}
              >
                {loading
                  ? "Creating…"
                  : isCreatingRole
                    ? "Create role"
                    : "Create permission"}
              </Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      </>
    ) : null;

  return (
    <div className="w-full flex-col justify-start gap-4">
      <div className="flex flex-col gap-2 px-3 lg:px-4">
        {!isAccessControlResource ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div />
            {canCreateResource ? (
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm">
                    <PlusIcon data-icon="inline-start" />
                    <span>
                      Create{" "}
                      {RESOURCE_LABELS[activeResource]
                        .slice(0, -1)
                        .toLowerCase()}
                    </span>
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>
                      Create {RESOURCE_LABELS[activeResource].slice(0, -1)}
                    </DrawerTitle>
                    <DrawerDescription>
                      Fill in the details and submit.
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="grid gap-3 px-4 pb-2 md:grid-cols-2">
                    {activeResource === "users" ? (
                      <>
                        <div className="space-y-1">
                          <Label>First Name</Label>
                          <Input
                            value={createUserForm.first_name}
                            onChange={(event) =>
                              setCreateUserForm((prev) => ({
                                ...prev,
                                first_name: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Last Name</Label>
                          <Input
                            value={createUserForm.last_name}
                            onChange={(event) =>
                              setCreateUserForm((prev) => ({
                                ...prev,
                                last_name: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={createUserForm.email}
                            onChange={(event) =>
                              setCreateUserForm((prev) => ({
                                ...prev,
                                email: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Phone</Label>
                          <Input
                            value={createUserForm.phone}
                            onChange={(event) =>
                              setCreateUserForm((prev) => ({
                                ...prev,
                                phone: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>User Number</Label>
                          <Input
                            value={createUserForm.user_no}
                            onChange={(event) =>
                              setCreateUserForm((prev) => ({
                                ...prev,
                                user_no: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Status</Label>
                          <Select
                            value={createUserForm.status}
                            onValueChange={(value) =>
                              setCreateUserForm((prev) => ({
                                ...prev,
                                status: value ?? "active",
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <Label>Password</Label>
                          <Input
                            type="password"
                            value={createUserForm.password}
                            onChange={(event) =>
                              setCreateUserForm((prev) => ({
                                ...prev,
                                password: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Assign Roles</Label>
                          <div className="flex flex-wrap gap-2">
                            {roleOptions.map((role) => (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() =>
                                  toggleRoleId(
                                    createUserForm.roleIds,
                                    role.id,
                                    (next) =>
                                      setCreateUserForm((prev) => ({
                                        ...prev,
                                        roleIds: next,
                                      })),
                                  )
                                }
                                className={cn(
                                  "rounded-md border px-2 py-1 text-sm",
                                  createUserForm.roleIds.includes(role.id)
                                    ? "border-primary bg-primary !text-white"
                                    : "border-border bg-background",
                                )}
                              >
                                {role.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}

                    {activeResource === "companies" ? (
                      <>
                        <div className="space-y-1">
                          <Label>Company Name</Label>
                          <Input
                            value={companyForm.company_name}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({
                                ...prev,
                                company_name: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Company Slug</Label>
                          <Input
                            value={companyForm.company_slug}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({
                                ...prev,
                                company_slug: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Admin First Name</Label>
                          <Input
                            value={companyForm.admin_first_name}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({
                                ...prev,
                                admin_first_name: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Admin Last Name</Label>
                          <Input
                            value={companyForm.admin_last_name}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({
                                ...prev,
                                admin_last_name: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Admin Email</Label>
                          <Input
                            type="email"
                            value={companyForm.admin_email}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({
                                ...prev,
                                admin_email: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Admin Phone</Label>
                          <Input
                            value={companyForm.admin_phone}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({
                                ...prev,
                                admin_phone: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <Label>Admin Password</Label>
                          <Input
                            type="password"
                            value={companyForm.admin_password}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({
                                ...prev,
                                admin_password: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                  <DrawerFooter>
                    <Button onClick={handleCreate} disabled={loading}>
                      Create Record
                    </Button>
                    <DrawerClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            ) : null}
          </div>
        ) : null}

        {!isAccessControlResource && activeResource === "users" ? (
          <div className="rounded-lg border p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <SearchToggleField
                  className="w-full"
                  label="Search users"
                  value={searchInput}
                  placeholder="Search name, email, phone, user number"
                  onChange={(value) => {
                    setSearchInput(value);
                    if (!value) {
                      onUsersQueryChange({ search: "" });
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onUsersQueryChange({ search: searchInput });
                    }
                  }}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Sort By</Label>
                  <Select
                    value={usersQuery.sortBy}
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }
                      onUsersQueryChange({ sortBy: value });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Created Date</SelectItem>
                      <SelectItem value="first_name">First Name</SelectItem>
                      <SelectItem value="last_name">Last Name</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Order</Label>
                  <Select
                    value={sortOrder}
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }
                      onUsersQueryChange({ sortOrder: value as SortOrder });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DESC">DESC</SelectItem>
                      <SelectItem value="ASC">ASC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onUsersQueryChange({ search: searchInput })}
                disabled={loading}
              >
                Apply
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchInput("");
                  onUsersQueryChange({ search: "" });
                }}
                disabled={loading}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative flex min-w-0 max-w-full flex-col gap-3 overflow-x-hidden overflow-y-auto px-0 sm:px-1 lg:px-2">
        {isAccessControlResource ? (
          <div className="space-y-2">
            {!token ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-muted-foreground">
                Sign in to load data.
              </div>
            ) : error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                {error}
              </div>
            ) : (
              <div className="space-y-3">
              {activeResource === "roles" &&
              canCreateResource &&
              dashboardActor.scope !== "platform" ? (
                <RoleSuggestionStrip
                  suggestions={roleSuggestions}
                  onUse={applyRoleSuggestion}
                />
              ) : null}
              <ResizableTable
                key={`access-control-${activeResource}`}
                title={RESOURCE_LABELS[activeResource]}
                data={accessControlTableRows}
                columns={accessControlColumns}
                getRowId={(row, index) => row.__id || String(index + 1)}
                onRowSelect={(_id, row) => {
                  if (row?.__source) {
                    openAccessControlRow(row.__source);
                  }
                }}
                loading={loading}
                itemsPerPage={
                  activeResource === "roles"
                    ? Math.max(
                        filteredAccessControlRows.length,
                        catalogQuery.limit || 20,
                      )
                    : catalogQuery.limit || 20
                }
                page={activeResource === "roles" ? 1 : catalogQuery.page}
                totalPages={activeResource === "roles" ? 1 : catalogTotalPages}
                totalItems={
                  activeResource === "roles"
                    ? filteredAccessControlRows.length
                    : catalogTotal
                }
                onPageChange={
                  activeResource === "roles"
                    ? undefined
                    : (page) => onCatalogQueryChange?.({ page })
                }
                showExport={false}
                enableColumnVisibility
                enableAnimations={false}
                storageKey={`access-control-${activeResource}`}
                toolbarStart={
                  <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Access Control
                      </span>
                      <h2 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                        {RESOURCE_LABELS[activeResource]}
                      </h2>
                    </div>
                    <Badge
                      variant="outline"
                      className="h-5 border-border bg-muted/40 px-1.5 text-[10px] text-muted-foreground"
                    >
                      {filteredAccessControlRows.length}
                      {catalogTotal != null &&
                      catalogTotal !== filteredAccessControlRows.length
                        ? ` of ${catalogTotal}`
                        : filteredAccessControlRows.length !== rows.length
                          ? ` of ${rows.length}`
                          : ""}
                    </Badge>
                  </div>
                }
                toolbarActions={
                  <>
                    <Input
                      value={accessControlSearch}
                      onChange={(event) =>
                        setAccessControlSearch(event.target.value)
                      }
                      placeholder={
                        activeResource === "permissions"
                          ? "Search permissions…"
                          : "Search roles…"
                      }
                      className="h-8 w-36 text-xs sm:w-52"
                      autoComplete="off"
                    />
                    {accessControlCreateDrawer}
                  </>
                }
              />
              </div>
            )}
          </div>
        ) : null}

        {!isAccessControlResource ? (
          <>
            <div className="rounded-lg border-0 bg-transparent shadow-none">
              <Table>
                <TableHeader
                  className="sticky top-0 z-10"
                  style={{ backgroundColor: "var(--table-header-accent-bg)" }}
                >
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead
                        key={column}
                        style={{ color: "var(--table-header-accent)" }}
                      >
                        {prettifyKey(column)}
                      </TableHead>
                    ))}
                    <TableHead
                      className="w-16 text-right"
                      style={{ color: "var(--table-header-accent)" }}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!token ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + 1}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Sign in to load data.
                      </TableCell>
                    </TableRow>
                  ) : loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + 1}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Loading {RESOURCE_LABELS[activeResource].toLowerCase()}
                        ...
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + 1}
                        className="h-24 text-center text-destructive"
                      >
                        {error}
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + 1}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, index) => {
                      const rowId = getRowId(row, index + 1);
                      const rowLabel = stringifyValue(
                        row.name ?? row.email ?? rowId,
                      );
                      const twoFactorOn =
                        activeResource === "users"
                          ? readTwoFactorEnabled(row)
                          : false;
                      const twoFactorForced =
                        activeResource === "users"
                          ? readForceTwoFactor(row)
                          : false;

                      return (
                        <motion.tr
                          key={`${activeResource}-${usersQuery.page}-${rowId}`}
                          data-slot="table-row"
                          className={cn(
                            "border-0 transition-colors hover:bg-[color:var(--section-tab-rail-bg)] has-aria-expanded:bg-[color:var(--section-tab-rail-bg)] data-[state=selected]:bg-[color:var(--section-tab-rail-bg)]",
                          )}
                          initial={
                            shouldAnimateRows ? adminTableRowHidden : false
                          }
                          animate={
                            shouldAnimateRows
                              ? adminTableRowVisible(index)
                              : { opacity: 1 }
                          }
                        >
                          {columns.map((column) => (
                            <TableCell key={`${rowId}-${column}`}>
                              {column === "two_factor_enabled" ||
                              column === "is_two_factor_enabled" ||
                              column === "twoFactorEnabled" ||
                              column === "isTwoFactorEnabled" ? (
                                formatTwoFactorCell(row)
                              ) : (
                                <span className="block max-w-[24rem] truncate">
                                  {stringifyValue(row[column])}
                                </span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                  />
                                }
                              >
                                <EllipsisVerticalIcon />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem
                                  onClick={() => {
                                    void navigator.clipboard
                                      .writeText(JSON.stringify(row, null, 2))
                                      .then(() => {
                                        showSuccessAlert(
                                          "Record details copied.",
                                        );
                                      })
                                      .catch(() => {
                                        showErrorAlert(
                                          "Clipboard access was denied.",
                                        );
                                      });
                                  }}
                                >
                                  <CopyIcon />
                                  Copy Details
                                </DropdownMenuItem>

                                {activeResource === "users" &&
                                canUpdateResource ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingUser({
                                        id: rowId,
                                        label: rowLabel,
                                      });
                                      setEditUserForm(toUserForm(row));
                                    }}
                                  >
                                    <PencilIcon />
                                    Edit User
                                  </DropdownMenuItem>
                                ) : null}

                                {activeResource === "users" ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setTargetPasswordUser({
                                        id: rowId,
                                        label: rowLabel,
                                      });
                                      setTargetPassword("");
                                    }}
                                  >
                                    <KeyRoundIcon />
                                    Reset Password
                                  </DropdownMenuItem>
                                ) : null}

                                {activeResource === "users" ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setAvatarUser({
                                        id: rowId,
                                        label: rowLabel,
                                      });
                                      setSelectedAvatarId(null);
                                    }}
                                  >
                                    <ImageIcon />
                                    Assign avatar
                                  </DropdownMenuItem>
                                ) : null}

                                {activeResource === "users" && !twoFactorOn ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setTwoFactorUser({
                                        id: rowId,
                                        label: rowLabel,
                                        mode: "enable",
                                      });
                                      setTwoFactorReason("");
                                    }}
                                  >
                                    <ShieldCheckIcon />
                                    Enable 2FA
                                  </DropdownMenuItem>
                                ) : null}

                                {activeResource === "users" && twoFactorOn ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setTwoFactorUser({
                                        id: rowId,
                                        label: rowLabel,
                                        mode: "disable",
                                      });
                                      setTwoFactorReason("");
                                    }}
                                  >
                                    <ShieldOffIcon />
                                    Disable 2FA
                                  </DropdownMenuItem>
                                ) : null}

                                {activeResource === "users" &&
                                !twoFactorForced ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setTwoFactorUser({
                                        id: rowId,
                                        label: rowLabel,
                                        mode: "force",
                                      });
                                      setTwoFactorReason("");
                                    }}
                                  >
                                    <ShieldAlertIcon />
                                    Require 2FA
                                  </DropdownMenuItem>
                                ) : null}

                                {activeResource === "users" &&
                                twoFactorForced ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setTwoFactorUser({
                                        id: rowId,
                                        label: rowLabel,
                                        mode: "unforce",
                                      });
                                      setTwoFactorReason("");
                                    }}
                                  >
                                    <ShieldCheckIcon />
                                    Make 2FA optional
                                  </DropdownMenuItem>
                                ) : null}

                                {isEditableResource(activeResource) &&
                                (canUpdateResource || canDeleteResource) ? (
                                  <DropdownMenuSeparator />
                                ) : null}
                                {isEditableResource(activeResource) &&
                                canDeleteResource ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => void handleDelete(rowId)}
                                  >
                                    <Trash2Icon />
                                    Delete
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </motion.tr>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
              <div>
                {activeResource === "users"
                  ? `${userCount} ${userCount === 1 ? "user" : "users"} found`
                  : `${rows.length} ${RESOURCE_LABELS[activeResource].toLowerCase()} loaded`}
              </div>
              <Badge variant="outline">{activeResource}</Badge>
            </div>

            {activeResource === "users" ? (
              <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
                <div>
                  Page {usersQuery.page}
                  {usersTotalPages ? ` of ${usersTotalPages}` : ""}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canPrevPage || loading}
                    onClick={() =>
                      onUsersQueryChange({ page: usersQuery.page - 1 })
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canNextPage || loading}
                    onClick={() =>
                      onUsersQueryChange({ page: usersQuery.page + 1 })
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <Drawer
        open={Boolean(editingUser)}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit {editingUser?.label ?? "user"}</DrawerTitle>
            <DrawerDescription>
              Update user details and assigned roles.
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-3 px-4 pb-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label>First Name</Label>
              <Input
                value={editUserForm.first_name}
                onChange={(event) =>
                  setEditUserForm((prev) => ({
                    ...prev,
                    first_name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input
                value={editUserForm.last_name}
                onChange={(event) =>
                  setEditUserForm((prev) => ({
                    ...prev,
                    last_name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={editUserForm.email}
                onChange={(event) =>
                  setEditUserForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={editUserForm.phone}
                onChange={(event) =>
                  setEditUserForm((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>User Number</Label>
              <Input
                value={editUserForm.user_no}
                onChange={(event) =>
                  setEditUserForm((prev) => ({
                    ...prev,
                    user_no: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={editUserForm.status}
                onValueChange={(value) =>
                  setEditUserForm((prev) => ({
                    ...prev,
                    status: value ?? "active",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Assigned Roles</Label>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() =>
                      toggleRoleId(editUserForm.roleIds, role.id, (next) =>
                        setEditUserForm((prev) => ({ ...prev, roleIds: next })),
                      )
                    }
                    className={cn(
                      "rounded-md border px-2 py-1 text-sm",
                      editUserForm.roleIds.includes(role.id)
                        ? "border-primary bg-primary !text-white"
                        : "border-border bg-background",
                    )}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DrawerFooter>
            <Button
              onClick={handleSaveUserEdit}
              disabled={loading || !editingUser}
            >
              Save Changes
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(targetPasswordUser)}
        onOpenChange={(open) => !open && setTargetPasswordUser(null)}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              Reset Password for {targetPasswordUser?.label ?? "user"}
            </DrawerTitle>
            <DrawerDescription>
              Set a temporary password. This signs the user out everywhere and
              they must change it after their next login.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-1 px-4 pb-2">
            <Label htmlFor="admin-reset-password">Temporary Password</Label>
            <Input
              id="admin-reset-password"
              type="password"
              value={targetPassword}
              onChange={(event) => setTargetPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <DrawerFooter>
            <Button
              onClick={handleSetPassword}
              disabled={loading || !targetPasswordUser}
            >
              Reset Password
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog
        open={Boolean(twoFactorUser)}
        onOpenChange={(open) => {
          if (!open && !twoFactorBusy) {
            setTwoFactorUser(null);
            setTwoFactorReason("");
          }
        }}
      >
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {twoFactorUser?.mode === "disable"
                ? "Disable 2FA"
                : twoFactorUser?.mode === "force"
                  ? "Require 2FA"
                  : twoFactorUser?.mode === "unforce"
                    ? "Make 2FA optional"
                    : "Enable 2FA"}{" "}
              for {twoFactorUser?.label ?? "user"}
            </DialogTitle>
            <DialogDescription>
              {twoFactorUser?.mode === "disable"
                ? "This disables two-factor authentication, revokes recovery data, and may invalidate active sessions."
                : twoFactorUser?.mode === "force"
                  ? "Two-factor becomes mandatory for this user. If they have not set it up yet, they are blocked until setup is complete."
                  : twoFactorUser?.mode === "unforce"
                    ? "Two-factor will no longer be mandatory. Existing 2FA setup is left unchanged."
                    : "The user must complete 2FA setup during their next login. No secret is shown here."}
            </DialogDescription>
          </DialogHeader>
          {twoFactorUser?.mode === "disable" ? (
            <div className="space-y-1.5">
              <Label htmlFor="disable-2fa-reason">Reason (optional)</Label>
              <Input
                id="disable-2fa-reason"
                value={twoFactorReason}
                onChange={(event) => setTwoFactorReason(event.target.value)}
                placeholder="e.g. User lost authenticator device"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={twoFactorBusy}
              onClick={() => {
                setTwoFactorUser(null);
                setTwoFactorReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={
                twoFactorUser?.mode === "disable" ? "destructive" : "default"
              }
              disabled={twoFactorBusy || !twoFactorUser}
              onClick={() => void handleAdminTwoFactor()}
            >
              {twoFactorBusy
                ? "Working…"
                : twoFactorUser?.mode === "disable"
                  ? "Disable 2FA"
                  : twoFactorUser?.mode === "force"
                    ? "Require 2FA"
                    : twoFactorUser?.mode === "unforce"
                      ? "Make optional"
                      : "Enable 2FA"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(avatarUser)}
        onOpenChange={(open) => {
          if (!open && !avatarBusy) {
            setAvatarUser(null);
            setSelectedAvatarId(null);
          }
        }}
      >
        <DialogPopup className="max-h-[min(90vh,36rem)] max-w-lg overflow-hidden p-0">
          <DialogHeader className="mb-0 border-b border-border/70 px-5 pb-3 pt-5">
            <DialogTitle>Assign avatar</DialogTitle>
            <DialogDescription>
              Choose an active default avatar for{" "}
              {avatarUser?.label ?? "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,24rem)] overflow-y-auto px-5 py-4">
            {avatarsLoading ? (
              <SectionLoader label="Loading avatars…" />
            ) : defaultAvatars.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No active default avatars found. Add some under Settings →
                Default Avatars.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {defaultAvatars.map((avatar, index) => {
                  const idRaw = readDefaultAvatarId(avatar);
                  const id = idRaw == null ? NaN : Number(idRaw);
                  if (!Number.isFinite(id)) return null;
                  const imageUrl = extractDefaultAvatarImageUrl(avatar);
                  const name =
                    (typeof avatar.avatar_name === "string" &&
                      avatar.avatar_name) ||
                    (typeof avatar.name === "string" && avatar.name) ||
                    `Avatar ${id}`;
                  const selected = selectedAvatarId === id;
                  return (
                    <button
                      key={`av-${id}-${index}`}
                      type="button"
                      title={name}
                      onClick={() => setSelectedAvatarId(id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                          : "border-border/70 hover:border-primary/40 hover:bg-muted/30",
                      )}
                    >
                      <Avatar className="size-14 ring-1 ring-border" size="lg">
                        {imageUrl ? (
                          <AvatarImage src={imageUrl} alt={name} />
                        ) : null}
                        <AvatarFallback className="text-[10px]">
                          {name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="line-clamp-2 w-full text-center text-[10px] text-muted-foreground">
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="mt-0 border-t border-border/70 px-5 py-3">
            <Button
              type="button"
              variant="outline"
              disabled={avatarBusy}
              onClick={() => {
                setAvatarUser(null);
                setSelectedAvatarId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={avatarBusy || selectedAvatarId == null || !avatarUser}
              onClick={() => void handleAssignAvatar()}
            >
              {avatarBusy ? "Assigning…" : "Assign avatar"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(editingEntity)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEntity(null);
            setInitialEditingEntityForm(EMPTY_ENTITY_FORM);
            setEditingRolePermissionNames([]);
            setInitialEditingRolePermissionNames([]);
            setRolePermissionNamesFromApi(null);
          }
        }}
      >
        <DialogPopup
          from="center"
          className="flex h-[calc(100vh-1.25rem)] w-[calc(100%-1.25rem)] max-h-none max-w-none flex-col gap-0 overflow-hidden bg-background p-0 sm:h-[calc(100vh-1.75rem)] sm:w-[calc(100%-1.75rem)]"
        >
          <DialogHeader className="mb-0 shrink-0 space-y-2 border-b border-border/70 px-5 pb-0 pt-4 text-left sm:px-6">
            <div className="pr-8">
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {editingEntity?.label ?? "Details"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {editingEntity?.resource === "roles"
                  ? canUsePermissionCatalog
                    ? "Review role details, assigned people, and included permissions."
                    : "Review role details and assigned people."
                  : "Review this permission and manage direct user grants."}
              </DialogDescription>
            </div>
            <DetailTabs
              tabs={
                editingEntity?.resource === "roles"
                  ? [
                      { id: "general", label: "General" },
                      { id: "assigned", label: "Assigned" },
                      ...(canUsePermissionCatalog
                        ? [{ id: "permissions" as const, label: "Permissions" }]
                        : []),
                    ]
                  : [
                      { id: "general", label: "General" },
                      { id: "assigned", label: "Assigned" },
                    ]
              }
              value={roleSheetTab}
              onChange={setDetailSheetTab}
            />
          </DialogHeader>

          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden",
              roleSheetTab === "permissions" && editingEntity?.resource === "roles"
                ? "p-0"
                : "px-5 py-3 sm:px-6 sm:py-4",
            )}
          >
            {roleSheetTab === "general" ? (
              <div className="space-y-4 overflow-y-auto">
                {canUpdateResource && !editingEntity?.systemRole ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="entity-display-name">Display name</Label>
                      <Input
                        id="entity-display-name"
                        value={editingEntityForm.display_name}
                        onChange={(event) =>
                          setEditingEntityForm((prev) => ({
                            ...prev,
                            display_name: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="entity-name">
                        {editingEntity?.resource === "roles"
                          ? "Name (key)"
                          : "Name"}
                      </Label>
                      <Input
                        id="entity-name"
                        value={editingEntityForm.name}
                        onChange={(event) =>
                          setEditingEntityForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        disabled={!!editingEntity?.builtInRole}
                        title={
                          editingEntity?.builtInRole
                            ? "The key of a built-in role cannot be changed"
                            : undefined
                        }
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="entity-description">Description</Label>
                      <Input
                        id="entity-description"
                        value={editingEntityForm.description}
                        onChange={(event) =>
                          setEditingEntityForm((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Display name
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {editingEntityForm.display_name ||
                          editingEntity?.label ||
                          "—"}
                      </p>
                    </div>
                    {editingEntity?.resource === "roles" ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Name
                        </p>
                        <p className="font-mono text-sm text-foreground">
                          {editingEntityForm.name || "—"}
                        </p>
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Description
                      </p>
                      <p className="text-sm leading-relaxed text-foreground">
                        {editingEntityForm.description ||
                          "No description provided."}
                      </p>
                    </div>
                  </>
                )}
                {editingEntity?.resource === "roles" &&
                canUsePermissionCatalog ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Permissions included
                    </p>
                    <p className="text-sm text-foreground">
                      {displayedRolePermissionNames.length} permission
                      {displayedRolePermissionNames.length === 1 ? "" : "s"}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {roleSheetTab === "assigned" ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
                <div className="flex shrink-0 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {editingEntity?.resource === "roles"
                        ? "Assigned people"
                        : "Assigned people"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {editingEntity?.resource === "roles"
                        ? "People who currently have this role."
                        : "People with this permission assigned directly."}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    {membersLoading
                      ? "…"
                      : `${
                          editingEntity?.resource === "roles"
                            ? roleAssignedUsers.length
                            : assignedMemberIds.size
                        } assigned`}
                  </span>
                  {canManageAssignments &&
                  editingEntity?.resource === "roles" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0"
                      disabled={membersLoading || membersBusy}
                      onClick={() => {
                        setMemberToAdd("");
                        setAssignPickerQuery("");
                        setPeopleDialogOpen(true);
                      }}
                    >
                      <UserPlusIcon
                        className="size-3.5"
                        data-icon="inline-start"
                      />
                      Add
                    </Button>
                  ) : null}
                </div>

                <Input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search assigned people…"
                  className="h-8 shrink-0 text-xs"
                />

                <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/60">
                  {membersLoading ? (
                    <SectionLoader
                      label={
                        editingEntity?.resource === "roles"
                          ? "Loading assigned people…"
                          : "Loading permission assignments…"
                      }
                    />
                  ) : membersError ? (
                    <p className="px-3 py-8 text-center text-sm text-rose-600">
                      {membersError}
                    </p>
                  ) : assignedMembers.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                      <UsersIcon className="size-5 text-muted-foreground/60" />
                      <p className="text-xs text-muted-foreground">
                        {editingEntity?.resource === "roles"
                          ? roleAssignedUsers.length === 0 &&
                            !memberSearch.trim()
                            ? "No one is assigned this role yet."
                            : "No people match your search."
                          : assignedMemberIds.size === 0
                            ? "No one has this permission assigned directly."
                            : "No people match your search."}
                      </p>
                      {canManageAssignments &&
                      editingEntity?.resource === "roles" &&
                      roleAssignedUsers.length === 0 &&
                      !memberSearch.trim() ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-1 h-8"
                          onClick={() => setPeopleDialogOpen(true)}
                        >
                          <UserPlusIcon
                            className="size-3.5"
                            data-icon="inline-start"
                          />
                          Add person
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/50">
                      {assignedMembers.map((user) => (
                        <li
                          key={`${user.membershipId}-${user.userId ?? "x"}`}
                          className="flex items-center gap-2.5 px-2.5 py-2"
                        >
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                            {user.name
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase() ?? "")
                              .join("") || "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-foreground">
                              {user.name}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                          {canManageAssignments ? (
                            <button
                              type="button"
                              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50"
                              title={`Remove ${user.name}`}
                              aria-label={`Remove ${user.name}`}
                              disabled={membersBusy}
                              onClick={() =>
                                requestRevokeMember(
                                  user.membershipId,
                                  user.userId,
                                  user.name,
                                )
                              }
                            >
                              <UserMinusIcon className="size-3.5" />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}

            {canUsePermissionCatalog &&
            roleSheetTab === "permissions" &&
            editingEntity?.resource === "roles" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {membersLoading || rolePermissionsLoading ? (
                  <SectionLoader label="Loading role permissions…" />
                ) : canUpdateResource || editingEntity?.systemRole ? (
                  <PermissionPicker
                    loading={pickerPermissionsLoading}
                    options={permissionOptions}
                    selectedNames={displayedRolePermissionNames}
                    onChange={handleRolePermissionsChange}
                    selectionDisabled={membersBusy || !!editingEntity?.systemRole}
                    reviewSelected={editingEntity?.systemRole}
                    className="min-h-0 flex-1"
                  />
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <MicrosoftPermissionList
                      options={permissionOptions}
                      selectedNames={displayedRolePermissionNames}
                      emptyLabel="No permissions are included in this role yet."
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-0 shrink-0 border-t border-border/70 px-6 py-3">
            {canUpdateResource && !editingEntity?.systemRole &&
            roleSheetTab === "general" &&
            isEditingEntityDirty ? (
              <Button
                type="button"
                disabled={loading || membersBusy}
                onClick={() => void handleSaveEntityEdit()}
              >
                Save changes
              </Button>
            ) : null}
            {canUsePermissionCatalog &&
            canUpdateResource && !editingEntity?.systemRole &&
            roleSheetTab === "permissions" &&
            editingEntity?.resource === "roles" &&
            isRolePermissionsDirty ? (
              <Button
                type="button"
                disabled={loading || membersBusy}
                onClick={() => void handleSaveRolePermissions()}
              >
                {membersBusy && permissionSaveProgress
                  ? `Saving ${permissionSaveProgress.done}/${permissionSaveProgress.total}…`
                  : "Save permissions"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingEntity(null);
                setInitialEditingEntityForm(EMPTY_ENTITY_FORM);
                setEditingRolePermissionNames([]);
                setInitialEditingRolePermissionNames([]);
                setRolePermissionNamesFromApi(null);
                setPermissionSaveProgress(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <AlertDialog
        open={Boolean(revokeConfirm)}
        onOpenChange={(open) => {
          if (!open && !membersBusy) {
            setRevokeConfirm(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editingEntity?.resource === "roles"
                ? "Remove from role?"
                : "Remove permission?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editingEntity?.resource === "roles"
                ? `Remove ${revokeConfirm?.displayName ?? "this person"} from this role? They will lose permissions granted only through this role.`
                : `Remove ${revokeConfirm?.displayName ?? "this person"}'s direct permission grant?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={membersBusy} />
            <Button
              type="button"
              variant="destructive"
              disabled={membersBusy}
              onClick={() => void handleConfirmRevokeMember()}
            >
              {membersBusy ? (
                <>
                  <FluentLoadingIndicator
                    className="size-3.5 animate-spin"
                    data-icon="inline-start"
                  />
                  Removing…
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add-person dialog only (assigned list stays on the Assigned tab) */}
      <Dialog
        open={peopleDialogOpen && editingEntity?.resource === "roles"}
        onOpenChange={(open) => {
          setPeopleDialogOpen(open);
          if (!open) {
            setMemberToAdd("");
            setAssignPickerQuery("");
          }
        }}
      >
        <DialogPopup
          className="flex max-h-[min(90vh,32rem)] w-[min(96vw,28rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[28rem]"
          from="center"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 py-4 text-left">
            <DialogTitle className="text-base">Add person</DialogTitle>
            <DialogDescription className="text-xs">
              {editingEntity?.label
                ? `Search and assign someone to “${editingEntity.label}”.`
                : "Search and assign someone to this role."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-5 py-3">
            <Input
              value={assignPickerQuery}
              onChange={(event) => setAssignPickerQuery(event.target.value)}
              placeholder={
                availableMembers.length === 0
                  ? "Everyone is already assigned"
                  : "Search people to assign…"
              }
              className="h-8 shrink-0 text-xs"
              disabled={
                membersBusy || membersLoading || availableMembers.length === 0
              }
              autoFocus
            />
            {selectedMemberToAdd ? (
              <p className="shrink-0 text-[11px] text-muted-foreground">
                Selected:{" "}
                <span className="font-medium text-foreground">
                  {selectedMemberToAdd.label}
                </span>
              </p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/60 bg-background">
              {membersLoading ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Loading people…
                </p>
              ) : availableMembers.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Everyone is already assigned.
                </p>
              ) : filteredAssignableMembers.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No people match “{assignPickerQuery.trim()}”.
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {filteredAssignableMembers.map((user) => {
                    const selected = user.membershipId === memberToAdd;
                    return (
                      <li key={user.membershipId}>
                        <button
                          type="button"
                          disabled={membersBusy}
                          onClick={() => setMemberToAdd(user.membershipId)}
                          className={cn(
                            "flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors",
                            selected
                              ? "bg-primary/10 text-foreground"
                              : "hover:bg-muted/50",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                              selected
                                ? "border-primary bg-primary !text-white"
                                : "border-border",
                            )}
                          >
                            {selected ? (
                              <CheckIcon className="size-2" strokeWidth={3} />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">
                              {user.name}
                            </span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {user.email !== "—"
                                ? user.email
                                : `ID ${user.userId ?? user.membershipId}`}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border/60 px-5 py-3">
            <DialogClose
              render={
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              }
            />
            <Button
              type="button"
              size="sm"
              disabled={!memberToAdd || membersBusy || membersLoading}
              onClick={() => void handleAssignMember()}
            >
              {membersBusy ? (
                <>
                  <FluentLoadingIndicator
                    className="size-3.5 animate-spin"
                    data-icon="inline-start"
                  />
                  Assigning…
                </>
              ) : (
                <>
                  <UserPlusIcon className="size-3.5" data-icon="inline-start" />
                  Assign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
