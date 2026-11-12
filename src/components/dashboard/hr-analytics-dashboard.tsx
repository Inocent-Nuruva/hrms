"use client";

import {
  loadAttendanceReportRows,
  attendanceReportRate,
} from "./attendance-report-data";
import { formsRequest } from "@/lib/forms-feedback";
import { useAccountAppearance } from "@/hooks/use-account-appearance";

import * as React from "react";
import { WelcomeCardBackground } from "./welcome-card-background";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UsersIcon,
  CalendarIcon,
  AlertCircleIcon,
  ArrowUpRightIcon,
  InfoIcon,
  UserCheckIcon,
  UserMinusIcon,
  UserXIcon,
  MoreHorizontalIcon,
  FileTextIcon,
  BellRingIcon,
  BriefcaseBusinessIcon,
  ChevronRightIcon,
  CircleCheckBigIcon,
  Clock3Icon,
  ListChecksIcon,
  SparklesIcon,
  UserRoundPlusIcon,
} from "lucide-react";
import {
  getAnalyticsDashboard,
  getHrDashboard,
  listDepartments,
  listLeaveRequests,
  listAttendanceHolidays,
  listAttendanceDailySummariesPage,
  listOnboardingRequests,
  listOffboardingRequests,
  listPayrollRuns,
  listPayrollPayslipsForRun,
  type AdminRecord,
} from "@/lib/admin-api";
import { isHistoricalEmployeeStatus } from "@/lib/employee-directory-search";
import {
  clearDashboardFromLoginFlag,
  consumeDashboardWarmCache,
  type DashboardWarmSnapshot,
} from "@/lib/dashboard-warm-cache";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  canAccessDashboardRoute,
  hasPermission,
} from "@/lib/dashboard-permissions";
import { DatePickerPresets } from "@/components/ui/date-picker-presets";
import {
  Card as UiCard,
  CardAction as UiCardAction,
  CardContent as UiCardContent,
  CardDescription as UiCardDescription,
  CardFooter as UiCardFooter,
  CardHeader as UiCardHeader,
  CardTitle as UiCardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Badge as FluentBadge,
  Button as FluentButton,
  Popover as FluentPopover,
  PopoverTrigger as FluentPopoverTrigger,
  PopoverSurface,
  PresenceBadge,
  Caption1,
  Link as FluentLink,
  Card as FluentCard,
  CardHeader as FluentCardHeader,
  Persona,
  Skeleton as FluentSkeleton,
  SkeletonItem,
  Text as FluentText,
} from "@fluentui/react-components";
import { FluentSearchBox } from "@/components/common/fluent-search-box";
import {
  CalendarLtr20Regular,
  PaintBrush20Regular,
  Filter20Regular,
  ArrowClockwise20Regular,
  CheckmarkCircleColor,
  ClipboardTaskColor,
  MoreHorizontal20Regular,
  PersonAddColor,
  PersonAvailableColor,
  PersonWarningColor,
} from "@fluentui/react-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";
import { motion } from "framer-motion";
import { useDashboardMotion } from "@/lib/dashboard-motion";

/** Short client cache so revisiting / refresh feels instant. */
const DASHBOARD_CACHE_TTL_MS = 20_000;

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken";

function readStoredToken(): string {
  if (typeof window === "undefined") return "";
  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? "";
  if (direct) return direct;
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens);
  if (!authTokensRaw) return "";
  try {
    const parsed = JSON.parse(authTokensRaw) as {
      accessToken?: string;
      access_token?: string;
    };
    return (parsed.accessToken ?? parsed.access_token ?? "").trim();
  } catch {
    return "";
  }
}

function readString(row: AdminRecord, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function readNumber(row: AdminRecord, keys: string[]): number | null {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function asRecordArray(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is AdminRecord => !!v && typeof v === "object");
}

function asRecord(value: unknown): AdminRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AdminRecord;
  }
  return null;
}

function readDeepValue(
  row: AdminRecord | null | undefined,
  keys: string[],
  depth = 0,
): unknown {
  if (!row) return null;
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined) {
      return row[key];
    }
  }
  if (depth >= 3) return null;
  for (const value of Object.values(row)) {
    const nested = asRecord(value);
    if (!nested) continue;
    const found = readDeepValue(nested, keys, depth + 1);
    if (found !== null && found !== undefined) {
      return found;
    }
  }
  return null;
}

function readNumberDeep(row: AdminRecord | null | undefined, keys: string[]) {
  const value = readDeepValue(row, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readStringDeep(row: AdminRecord | null | undefined, keys: string[]) {
  const value = readDeepValue(row, keys);
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function extractDepartmentHeadcountsFromAnalytics(
  row: AdminRecord | null | undefined,
): Array<[string, number]> {
  if (!row) return [];

  const direct = [
    "department_headcounts",
    "department_counts",
    "headcount_by_department",
    "departmentBreakdown",
    "departments_breakdown",
  ]
    .map((key) => readDeepValue(row, [key]))
    .find((value) => value !== null && value !== undefined);

  if (Array.isArray(direct)) {
    return direct
      .map((entry) => {
        const record = asRecord(entry);
        if (!record) return null;
        const label = readString(record, [
          "name",
          "department_name",
          "departmentName",
          "department",
          "label",
        ]);
        const count = readNumber(record, [
          "count",
          "headcount",
          "value",
          "total",
        ]);
        if (!label || count === null) return null;
        return [label, count] as [string, number];
      })
      .filter((entry): entry is [string, number] => Boolean(entry));
  }

  const record = asRecord(direct);
  if (!record) return [];
  return Object.entries(record)
    .map(([key, value]) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return [key, value] as [string, number];
      }
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return [key, parsed] as [string, number];
        }
      }
      return null;
    })
    .filter((entry): entry is [string, number] => Boolean(entry));
}

function formatDateShort(value: unknown): string {
  if (!value) return "-";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recordDateKey(value: unknown) {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  )
    return "";
  const raw = String(value);
  const direct = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : formatLocalDateKey(parsed);
}

function holidayDateKey(row: AdminRecord) {
  return recordDateKey(
    row.date ??
      row.holiday_date ??
      row.holidayDate ??
      row.start_date ??
      row.startDate,
  );
}

function shiftDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function getEmployeeName(row: AdminRecord): string {
  const direct = readString(row, [
    "full_name",
    "fullName",
    "name",
    "display_name",
  ]);
  if (direct) return direct;
  const parts = [
    readString(row, ["first_name", "firstName"]),
    readString(row, ["middle_name", "middleName"]),
    readString(row, ["last_name", "lastName"]),
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "-";
}

function getEmployeeNo(row: AdminRecord): string {
  return (
    readString(row, [
      "employee_no",
      "employeeNo",
      "user_no",
      "employee_number",
      "code",
    ]) || "-"
  );
}

function getEmploymentStatus(row: AdminRecord): string {
  const s = readString(row, [
    "employment_status",
    "status",
    "employmentStatus",
  ]);
  return s || "unknown";
}

function getDepartmentNameFromEmployee(row: AdminRecord): string {
  // Prefer nested objects (common in this system: primary_department or department)
  const primary = asRecord(row.primary_department);
  if (primary) {
    const n = readString(primary, ["name", "department_name", "title"]);
    if (n) return n;
  }

  const dept = asRecord(row.department);
  if (dept) {
    const n = readString(dept, ["name", "department_name", "title"]);
    if (n) return n;
  }

  const direct = readString(row, [
    "department_name",
    "departmentName",
    "dept_name",
    "primary_department",
    "department",
  ]);
  if (direct) return direct;

  const arr = asRecordArray(
    row.departments ?? row.dept ?? row.departments_list,
  );
  for (const item of arr) {
    const n = readString(item, ["name", "department_name", "title"]);
    if (n) return n;
  }

  const id = readNumber(row, [
    "department_id",
    "dept_id",
    "primary_department_id",
    "departmentId",
    "deptId",
    "department_id_fk",
  ]);
  if (id != null) return `Dept #${id}`;
  return "";
}

function normalizeDepartmentName(value: string): string {
  return value.trim().toLowerCase();
}

function getDepartmentIdFromRecord(row: AdminRecord): number | null {
  return readNumber(row, [
    "id",
    "department_id",
    "primary_department_id",
    "departmentId",
  ]);
}

function getDepartmentNameFromRecord(row: AdminRecord): string {
  return readString(row, [
    "name",
    "department_name",
    "departmentName",
    "title",
  ]);
}

function getDepartmentAssignmentFromEmployee(row: AdminRecord): {
  id: number | null;
  name: string;
} | null {
  const primary = asRecord(row.primary_department);
  if (primary) {
    const id = getDepartmentIdFromRecord(primary);
    const name = getDepartmentNameFromRecord(primary);
    if (id !== null || name) {
      return { id, name };
    }
  }

  const department = asRecord(row.department);
  if (department) {
    const id = getDepartmentIdFromRecord(department);
    const name = getDepartmentNameFromRecord(department);
    if (id !== null || name) {
      return { id, name };
    }
  }

  const assignments = asRecordArray(
    row.departments ?? row.dept ?? row.departments_list,
  );
  if (assignments.length > 0) {
    const primaryAssignment =
      assignments.find(
        (item) => item.is_primary === true || item.isPrimary === true,
      ) ?? assignments[0];

    if (primaryAssignment) {
      const nestedDepartment =
        asRecord(primaryAssignment.department) ??
        asRecord(primaryAssignment.primary_department);
      const id =
        (nestedDepartment
          ? getDepartmentIdFromRecord(nestedDepartment)
          : null) ?? getDepartmentIdFromRecord(primaryAssignment);
      const name =
        (nestedDepartment
          ? getDepartmentNameFromRecord(nestedDepartment)
          : "") || getDepartmentNameFromRecord(primaryAssignment);

      if (id !== null || name) {
        return { id, name };
      }
    }
  }

  const directId = readNumber(row, [
    "primary_department_id",
    "department_id",
    "departmentId",
    "dept_id",
    "department_id_fk",
  ]);
  const directName = readString(row, [
    "department_name",
    "departmentName",
    "dept_name",
    "primary_department",
    "department",
  ]);

  if (directId !== null || directName) {
    return { id: directId, name: directName };
  }

  return null;
}

function buildDepartmentHeadcounts(
  departmentRows: AdminRecord[],
  employeeRows: AdminRecord[],
): Array<[string, number]> {
  const countsByLabel = new Map<string, number>();
  const nameById = new Map<number, string>();
  const labelByNormalizedName = new Map<string, string>();

  for (const row of departmentRows) {
    const id = getDepartmentIdFromRecord(row);
    const name = getDepartmentNameFromRecord(row);
    const label = name || (id !== null ? `Dept #${id}` : "");
    if (!label) {
      continue;
    }
    countsByLabel.set(label, 0);
    if (id !== null) {
      nameById.set(id, label);
    }
    labelByNormalizedName.set(normalizeDepartmentName(label), label);
  }

  for (const employee of employeeRows) {
    // Prefer structured assignment, then fall back to loose name/id fields.
    const assignment =
      getDepartmentAssignmentFromEmployee(employee) ??
      (() => {
        const name = getDepartmentNameFromEmployee(employee);
        if (!name) return null;
        const id = readNumber(employee, [
          "primary_department_id",
          "department_id",
          "departmentId",
          "dept_id",
        ]);
        return { id, name };
      })();

    if (!assignment) {
      continue;
    }

    const label =
      ((assignment.id !== null ? nameById.get(assignment.id) : undefined) ??
        (assignment.name
          ? labelByNormalizedName.get(normalizeDepartmentName(assignment.name))
          : undefined) ??
        assignment.name) ||
      (assignment.id !== null ? `Dept #${assignment.id}` : "");

    if (!label) {
      continue;
    }

    // Register labels discovered from employees even if departments list omitted them.
    if (!countsByLabel.has(label)) {
      countsByLabel.set(label, 0);
      labelByNormalizedName.set(normalizeDepartmentName(label), label);
      if (assignment.id !== null && !nameById.has(assignment.id)) {
        nameById.set(assignment.id, label);
      }
    }

    countsByLabel.set(label, (countsByLabel.get(label) ?? 0) + 1);
  }

  // If we only have department rows and no employee matches, still show them.
  // Prefer non-zero first when sorting.
  return Array.from(countsByLabel.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });
}

function getLeaveStatus(row: AdminRecord): string {
  return (
    readString(row, [
      "status",
      "leave_status",
      "request_status",
    ]).toLowerCase() || "unknown"
  );
}

function getLeaveType(row: AdminRecord): string {
  const t = readString(row, [
    "leave_type_name",
    "leave_type",
    "type_name",
    "name",
  ]);
  if (t) return t;
  const lt = row.leave_type as AdminRecord | undefined;
  if (lt && typeof lt === "object") {
    return readString(lt, ["name", "code", "title"]) || "Leave";
  }
  return "Leave";
}

function getLeaveEmployeeName(row: AdminRecord): string {
  const direct = readString(row, [
    "employee_name",
    "full_name",
    "employee_full_name",
  ]);
  if (direct) return direct;
  const emp = row.employee as AdminRecord | undefined;
  if (emp && typeof emp === "object") {
    return getEmployeeName(emp);
  }
  return "-";
}

function getLeaveEmployeeNo(row: AdminRecord): string {
  const direct = readString(row, ["employee_no", "employeeNo"]);
  if (direct) return direct;
  const emp = asRecord(row.employee);
  if (emp) return getEmployeeNo(emp);
  return "";
}

function getLeaveId(row: AdminRecord): number | null {
  return readNumber(row, ["id", "leave_request_id", "leaveRequestId"]);
}

function leaveDetailHref(row: AdminRecord): string {
  const id = getLeaveId(row);
  if (id != null) {
    return `/dashboard/leave-management/requests?highlight=${id}`;
  }
  return "/dashboard/leave-management/requests";
}

function getLeaveDates(row: AdminRecord): string {
  const from = readString(row, ["from_date", "start_date", "date_from"]);
  const to = readString(row, ["to_date", "end_date", "date_to"]);
  if (from && to) return `${formatDateShort(from)} – ${formatDateShort(to)}`;
  if (from) return formatDateShort(from);
  return "-";
}

function leaveStatusTone(status: string) {
  const s = status.toLowerCase();
  if (["rejected", "cancelled", "canceled"].includes(s)) {
    return "text-primary/55";
  }
  if (
    s.includes("pending") ||
    s.includes("review") ||
    s.includes("submitted")
  ) {
    return "text-primary";
  }
  return "text-primary/80";
}

function getAttendanceStatus(row: AdminRecord): string {
  return readString(row, [
    "status",
    "attendance_status",
    "work_status",
    "day_status",
  ]).toLowerCase();
}

interface Metric {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  compact?: boolean;
}

type WorkforceMetricTone = "emerald" | "amber" | "rose";

interface WorkforceMetric {
  label: string;
  value: number | null;
  percentage: number | null;
  description: React.ReactNode;
  icon: React.ReactNode;
  tone: WorkforceMetricTone;
  visualization: "sparkline" | "bars" | "ticks" | "progress";
  href?: string;
}

type PagedRowsResult = {
  rows: AdminRecord[];
  total: number | null;
};

interface HrAnalyticsDashboardProps {
  refreshKey?: number;
  companyName?: string | null;
  adminRolesLabel?: string | null;
  assignedRoleNames?: string[];
  userName?: string | null;
  profilePhotoUrl?: string | null;
  showLeaveRequests?: boolean;
  showHrAnalytics?: boolean;
}

type DashboardPriorityTone = "urgent" | "warning" | "info";

interface DashboardPriority {
  id: string;
  title: string;
  description: string;
  owner: string;
  count: number;
  href?: string;
  tone: DashboardPriorityTone;
  icon: React.ReactNode;
}

interface LifecycleStage {
  label: string;
  count: number;
  description: string;
  icon: React.ReactNode;
  countColor: "brand" | "success" | "warning" | "subtle";
  href?: string;
}

interface DashboardInsight {
  title: string;
  href?: string;
}

const priorityToneClasses = {
  urgent: "before:bg-destructive text-destructive",
  warning: "before:bg-primary text-primary",
  info: "before:bg-muted-foreground text-foreground",
} satisfies Record<DashboardPriorityTone, string>;

function DashboardPriorityCard({ priority }: { priority: DashboardPriority }) {
  return (
    <UiCard
      size="sm"
      className={cn(
        "relative h-full gap-0 rounded-lg border-border/70 bg-card py-0 shadow-sm transition before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r-full hover:-translate-y-px hover:border-primary/25 hover:shadow-md",
        priorityToneClasses[priority.tone],
      )}
    >
      <UiCardHeader className="border-b border-border/60 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 [&_svg]:size-4">
            {priority.icon}
          </span>
          <div className="min-w-0">
            <UiCardTitle className="text-foreground">
              {priority.title}
            </UiCardTitle>
            <UiCardDescription className="mt-0.5 text-xs">
              Responsible: {priority.owner}
            </UiCardDescription>
          </div>
        </div>
        <UiCardAction>
          <Badge variant="secondary" className="tabular-nums">
            {priority.count}
          </Badge>
        </UiCardAction>
      </UiCardHeader>
      <UiCardContent className="py-3">
        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {priority.description}
        </p>
      </UiCardContent>
      {priority.href ? (
        <UiCardFooter className="justify-end border-border/60 bg-muted/20 py-2.5">
          <Link
            href={priority.href}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Review
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </UiCardFooter>
      ) : null}
    </UiCard>
  );
}

function DashboardLifecycle({ stages }: { stages: LifecycleStage[] }) {
  return (
    <section className="border-y border-border/70 py-4">
      <h2 className="px-1 text-base font-semibold text-foreground">
        Workforce lifecycle
      </h2>
      <ol className="mt-3 grid sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-border/70">
        {stages.map((stage) => {
          const content = (
            <div className="flex min-h-16 items-center gap-3 px-3 py-2 transition hover:bg-muted/25">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/30 [&_svg]:size-5">
                {stage.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{stage.label}</p>
                  <FluentBadge
                    appearance="tint"
                    color={stage.countColor}
                    shape="rounded"
                    size="medium"
                    className="min-w-8 justify-center tabular-nums"
                  >
                    {stage.count}
                  </FluentBadge>
                </div>
                <p className="mt-1 text-xs leading-4 text-muted-foreground">
                  {stage.description}
                </p>
              </div>
            </div>
          );

          return (
            <li key={stage.label}>
              {stage.href ? (
                <Link
                  href={stage.href}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DashboardIntelligence({ insights }: { insights: DashboardInsight[] }) {
  return (
    <section className="border-b border-border/70 pb-4">
      <div className="flex items-center gap-2 px-1">
        <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <SparklesIcon className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            HR briefing
          </h2>
          <p className="text-xs text-muted-foreground">
            Today’s workforce signals.
          </p>
        </div>
      </div>
      <div className="mt-3 grid sm:grid-cols-3 sm:divide-x sm:divide-border/70">
        {insights.map((insight) => (
          <div key={insight.title} className="flex min-h-16 flex-col px-3 py-2">
            <p className="text-sm font-medium text-foreground">
              {insight.title}
            </p>
            {insight.href ? (
              <Link
                href={insight.href}
                className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-medium text-primary"
              >
                Open workspace{" "}
                <ChevronRightIcon className="size-3" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function AnimatedMetricValue({ value }: { value: string | number }) {
  const [displayValue, setDisplayValue] = React.useState(() =>
    typeof value === "number"
      ? "0"
      : typeof value === "string" && value.endsWith("%")
        ? "0%"
        : String(value),
  );

  React.useEffect(() => {
    if (typeof value === "number" && Number.isFinite(value)) {
      let frame = 0;
      const duration = 860;
      const startedAt = performance.now();

      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        setDisplayValue(String(Math.round(value * eased)));
        if (progress < 1) {
          frame = window.requestAnimationFrame(tick);
        }
      };

      frame = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(frame);
    }

    if (typeof value === "string" && value.endsWith("%")) {
      const numeric = Number(value.replace("%", ""));
      if (!Number.isFinite(numeric)) {
        setDisplayValue(value);
        return;
      }

      let frame = 0;
      const duration = 860;
      const startedAt = performance.now();

      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        setDisplayValue(`${Math.round(numeric * eased)}%`);
        if (progress < 1) {
          frame = window.requestAnimationFrame(tick);
        }
      };

      frame = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(frame);
    }

    setDisplayValue(String(value));
  }, [value]);

  return <>{displayValue}</>;
}

function MetricValueSkeleton() {
  return (
    <FluentSkeleton
      aria-label="Loading metric"
      className="mt-1.5 flex flex-col gap-1.5"
    >
      <SkeletonItem
        shape="rectangle"
        className="!h-6 !w-12 !rounded-md sm:!h-7 sm:!w-14"
      />
      <SkeletonItem
        shape="rectangle"
        className="hidden !h-2.5 !w-16 !rounded-md sm:block"
      />
    </FluentSkeleton>
  );
}

function MetricCard({
  metric,
  reduce,
  variants,
  hover,
}: {
  metric: Metric & { ready: boolean };
  reduce: boolean;
  variants: ReturnType<typeof useDashboardMotion>["metricCard"];
  hover: ReturnType<typeof useDashboardMotion>["hover"];
}) {
  const router = useRouter();
  const cardClassName = cn(
    "dashboard-metric-card group relative block h-full w-full min-w-0 overflow-hidden !gap-0 !rounded-lg !border-border/70 !bg-card !p-4 after:!border-border/70 before:absolute before:inset-y-4 before:left-0 before:w-0.5 before:rounded-r-full before:bg-primary/55 dark:!border-border/80 dark:after:!border-border/80",
    "shadow-sm transition duration-200",
    metric.href ? "outline-none hover:-translate-y-px hover:shadow-md" : null,
  );

  const cardBody = (
    <>
      <FluentCardHeader
        className="!p-0"
        header={
          metric.href ? (
            <Link
              href={metric.href}
              className="truncate !no-underline hover:!no-underline"
            >
              <FluentText size={200} weight="semibold">
                {metric.label}
              </FluentText>
            </Link>
          ) : (
            <FluentText size={200} weight="semibold">
              {metric.label}
            </FluentText>
          )
        }
        action={
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={`${metric.label} actions`}
            >
              <MoreHorizontal20Regular aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem
                disabled={!metric.href}
                onClick={() => metric.href && router.push(metric.href)}
              >
                Open records
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!metric.href}
                onClick={() =>
                  metric.href &&
                  window.open(metric.href, "_blank", "noopener,noreferrer")
                }
              >
                Open in new tab
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {!metric.ready ? (
        <MetricValueSkeleton />
      ) : (
        <div className="mt-3 flex min-w-0 items-baseline gap-1.5">
          <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
            <AnimatedMetricValue value={metric.value} />
          </div>
          {metric.sub ? (
            <span className="truncate text-[10px] text-foreground">
              {metric.sub}
            </span>
          ) : null}
        </div>
      )}
      <div className="mt-4 flex items-end justify-between gap-3">
        <FluentBadge
          color="success"
          appearance="tint"
          shape="rounded"
          size="small"
        >
          <ArrowUpRightIcon className="size-2.5" aria-hidden="true" />
          Current period
        </FluentBadge>
        {metric.label === "Departments" ? (
          <div className="flex h-7 items-end gap-1" aria-hidden="true">
            {[25, 42, 58, 78, 100].map((height, index) => (
              <span
                key={height}
                className={cn(
                  "w-1.5 rounded-sm",
                  index === 4 ? "bg-emerald-500" : "bg-emerald-500/10",
                )}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        ) : metric.label === "New hires" ? (
          <div
            className="flex h-2 w-20 overflow-hidden rounded-full bg-muted"
            aria-hidden="true"
          >
            <span className="w-3/5 bg-emerald-500" />
            <span className="w-1/5 bg-emerald-500/40" />
          </div>
        ) : (
          <svg viewBox="0 0 72 24" className="h-7 w-20" aria-hidden="true">
            <path
              d="M2 15 C8 3 13 22 20 10 C27 -1 31 22 39 10 C47 0 52 22 59 9 C64 2 67 14 70 8"
              fill="none"
              stroke="rgb(16 185 129)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </>
  );

  return (
    <motion.div
      variants={variants}
      whileHover={hover}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      className="h-full w-full min-w-0"
    >
      <FluentCard appearance="outline" size="small" className={cardClassName}>
        {cardBody}
      </FluentCard>
    </motion.div>
  );
}

const workforceMetricTone = {
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    pill: "bg-emerald-500 text-white",
    accent: "before:bg-emerald-500/65",
    visual: "bg-emerald-500",
    soft: "bg-emerald-500/10",
    stroke: "rgb(16 185 129)",
  },
  amber: {
    icon: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    pill: "bg-orange-500 text-white",
    accent: "before:bg-orange-500/65",
    visual: "bg-orange-500",
    soft: "bg-orange-500/12",
    stroke: "rgb(249 115 22)",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    pill: "bg-rose-500 text-white",
    accent: "before:bg-rose-500/65",
    visual: "bg-rose-500",
    soft: "bg-rose-500/12",
    stroke: "rgb(244 63 94)",
  },
} satisfies Record<WorkforceMetricTone, Record<string, string>>;

function WorkforceMetricVisual({ metric }: { metric: WorkforceMetric }) {
  const tone = workforceMetricTone[metric.tone];
  const percentage = Math.min(100, Math.max(0, metric.percentage ?? 0));
  if (metric.value === null) return null;

  if (metric.visualization === "sparkline") {
    return (
      <svg viewBox="0 0 150 42" className="h-8 w-full" aria-hidden="true">
        <path
          d="M2 34 C17 34 17 38 30 38 C42 38 38 20 52 20 C66 20 62 35 77 35 C94 35 88 38 104 38 C119 38 113 10 128 10 C140 10 136 3 148 3"
          fill="none"
          stroke={tone.stroke}
          strokeLinecap="round"
          strokeWidth="2"
          opacity="0.7"
        />
      </svg>
    );
  }

  if (metric.visualization === "bars") {
    return (
      <div className="flex h-8 items-end gap-1" aria-hidden="true">
        {[45, 62, 38, 88, 58, 76, 52].map((height, index) => (
          <span
            key={height + index}
            className={cn(
              "w-2.5 rounded-t-md",
              index === 3 ? tone.visual : tone.soft,
            )}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    );
  }

  if (metric.visualization === "ticks") {
    return (
      <div className="flex h-8 items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-6 w-1 rounded-full",
              index < Math.round(percentage / 5.56) ? tone.visual : tone.soft,
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("h-5 overflow-hidden rounded-full", tone.soft)}
      aria-hidden="true"
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700",
          tone.visual,
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function WorkforceMetricCard({
  metric,
  reduce,
  variants,
}: {
  metric: WorkforceMetric;
  reduce: boolean;
  variants: ReturnType<typeof useDashboardMotion>["metricCard"];
}) {
  const tone = workforceMetricTone[metric.tone];
  const badgeColor =
    metric.tone === "emerald"
      ? "success"
      : metric.tone === "amber"
        ? "warning"
        : "severe";
  const content = (
    <>
      <FluentCardHeader
        className="!p-0"
        header={
          <span className="flex min-w-0 items-center gap-1.5">
            <FluentText size={200} weight="semibold" truncate>
              {metric.label}
            </FluentText>
            <InfoIcon
              className="size-3 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
        }
        action={
          metric.percentage !== null ? (
            <FluentBadge
              color={badgeColor}
              appearance="tint"
              shape="rounded"
              size="small"
            >
              <ArrowUpRightIcon className="size-2.5" aria-hidden="true" />
              {metric.percentage}%
            </FluentBadge>
          ) : null
        }
      />

      <div className="mt-3 flex items-center gap-2.5">
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
            tone.icon,
          )}
        >
          {metric.icon}
        </span>
        <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {metric.value === null ? (
            "Unavailable"
          ) : (
            <AnimatedMetricValue value={metric.value} />
          )}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-[minmax(52px,0.65fr)_minmax(0,1.35fr)] items-end gap-2">
        <WorkforceMetricVisual metric={metric} />
        <Caption1
          block
          className="truncate !text-muted-foreground"
          title={
            typeof metric.description === "string"
              ? metric.description
              : undefined
          }
        >
          {metric.description}
        </Caption1>
      </div>
    </>
  );

  return (
    <motion.div
      variants={variants}
      whileTap={reduce ? undefined : { scale: 0.99 }}
      className="h-full w-full min-w-0"
    >
      {metric.href ? (
        <Link
          href={metric.href}
          className="block h-full !no-underline hover:!no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&_*]:!no-underline"
        >
          <FluentCard
            appearance="outline"
            className={cn(
              "relative h-full min-h-32 overflow-hidden !gap-0 !rounded-lg !border-border/70 !bg-card !p-3 shadow-sm transition duration-200 after:!border-border/70 before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r-full hover:-translate-y-px hover:shadow-md dark:!border-border/80 dark:after:!border-border/80",
              tone.accent,
            )}
          >
            {content}
          </FluentCard>
        </Link>
      ) : (
        <FluentCard
          appearance="outline"
          className={cn(
            "relative h-full min-h-32 overflow-hidden !gap-0 !rounded-lg !border-border/70 !bg-card !p-3 shadow-sm after:!border-border/70 before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r-full dark:!border-border/80 dark:after:!border-border/80",
            tone.accent,
          )}
        >
          {content}
        </FluentCard>
      )}
    </motion.div>
  );
}

type AttendanceChartDay = {
  label: string;
  present: number;
  late: number;
  absent: number;
};

function WorkforceInsightPanels({
  rangeLabel,
  attendanceRate,
  present,
  late,
  absent,
  attendanceDays,
  attendanceUnavailable,
}: {
  rangeLabel: string;
  attendanceRate: number | null;
  present: number | null;
  late: number | null;
  absent: number | null;
  attendanceDays: AttendanceChartDay[];
  attendanceUnavailable: boolean;
}) {
  return (
    <div className="mt-3 w-full">
      <section className="h-full min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-[0_16px_42px_-34px_rgb(15_23_42_/_0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Attendance report
            </h2>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-semibold leading-none tabular-nums text-foreground">
                {attendanceRate === null
                  ? attendanceUnavailable
                    ? "Unavailable"
                    : "—"
                  : `${attendanceRate}%`}
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                Attendance rate
              </span>
            </div>
          </div>
          <span className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] font-medium text-foreground">
            {rangeLabel}
          </span>
        </div>
        <div className="mt-4 grid w-full grid-cols-3 gap-2 border-y border-border/60 py-3">
          {[
            ["On time", present, "border-emerald-500"],
            ["Late", late, "border-amber-400"],
            ["Absent", absent, "border-rose-400"],
          ].map(([label, value, border]) => (
            <div key={String(label)} className={cn("border-l-2 pl-2", border)}>
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                {value === null ? "Unavailable" : value}
              </p>
            </div>
          ))}
        </div>
        {attendanceDays.length > 0 ? (
          <div className="mt-4 flex h-40 items-end gap-2 overflow-hidden">
            {attendanceDays.map((day) => {
              const total = Math.max(1, day.present + day.late + day.absent);
              return (
                <div
                  key={day.label}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2"
                >
                  <div className="flex h-28 w-full max-w-8 flex-col-reverse overflow-hidden rounded-t-md bg-muted/40">
                    <span
                      className="bg-emerald-500"
                      style={{ height: `${(day.present / total) * 100}%` }}
                    />
                    <span
                      className="bg-amber-300"
                      style={{ height: `${(day.late / total) * 100}%` }}
                    />
                    <span
                      className="bg-rose-300"
                      style={{ height: `${(day.absent / total) * 100}%` }}
                    />
                  </div>
                  <span className="truncate text-[9px] text-muted-foreground">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : attendanceUnavailable ? (
          <div className="mt-4 flex h-40 items-center justify-center rounded-xl bg-amber-50 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Attendance history is unavailable.
          </div>
        ) : (
          <div className="mt-4 flex h-40 items-center justify-center rounded-xl bg-muted/20 text-xs text-muted-foreground">
            No attendance records in this period.
          </div>
        )}
      </section>

    </div>
  );
}

function formatDashboardCurrency(value: unknown, currency = "TZS") {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function PeopleExperiencePanels({
  satisfactionScore,
  satisfactionCategories,
  satisfactionUnavailable,
  satisfactionDistribution,
  payrollRows,
  canOpenPayroll,
}: {
  satisfactionScore: number | null;
  satisfactionUnavailable: boolean;
  satisfactionDistribution: {
    satisfied: number;
    neutral: number;
    needsAttention: number;
  } | null;
  satisfactionCategories: Array<{ label: string; value: number }>;
  payrollRows: AdminRecord[];
  canOpenPayroll: boolean;
}) {
  const [payrollSearch, setPayrollSearch] = React.useState("");
  const filteredPayrollRows = payrollRows.filter((row) => {
    if (!payrollSearch.trim()) return true;
    const employee = asRecord(row.employee);
    const haystack = [
      readStringDeep(row, [
        "employee_name",
        "full_name",
        "employee_no",
        "employeeNo",
      ]),
      readStringDeep(employee, [
        "full_name",
        "name",
        "employee_no",
        "employeeNo",
      ]),
      readStringDeep(row, ["job_title", "designation_name", "position_name"]),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(payrollSearch.trim().toLowerCase());
  });
  const gaugeLength = 126;
  const gaugeProgress =
    gaugeLength * (Math.min(100, Math.max(0, satisfactionScore ?? 0)) / 100);

  return (
    <div className="mt-3 grid w-full gap-3 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
      <section className="h-full min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            Employee satisfaction
          </h2>
          <MoreHorizontalIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <div className="mt-4 grid grid-cols-[180px_minmax(0,1fr)] items-center gap-3">
          <div className="relative h-24">
            <svg
              viewBox="0 0 120 68"
              className="h-full w-full"
              aria-hidden="true"
            >
              <path
                d="M12 58 A48 48 0 0 1 108 58"
                fill="none"
                stroke="rgb(226 232 240)"
                strokeWidth="10"
                strokeLinecap="round"
                pathLength={gaugeLength}
              />
              <path
                d="M12 58 A48 48 0 0 1 108 58"
                fill="none"
                stroke="rgb(16 185 129)"
                strokeWidth="10"
                strokeLinecap="round"
                pathLength={gaugeLength}
                strokeDasharray={`${gaugeProgress} ${gaugeLength}`}
              />
            </svg>
            <div className="absolute inset-x-0 bottom-1 text-center">
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {satisfactionScore === null ? "—" : `${satisfactionScore}%`}
              </p>
              <p className="text-[9px] text-muted-foreground">
                average satisfaction
              </p>
            </div>
          </div>
          <div className="space-y-2 text-[10px] text-muted-foreground">
            <p>
              <span className="mr-1.5 inline-block size-2 rounded-sm bg-emerald-500" />
              Satisfied · {satisfactionDistribution?.satisfied ?? "—"}
            </p>
            <p>
              <span className="mr-1.5 inline-block size-2 rounded-sm bg-emerald-500/25" />
              Neutral · {satisfactionDistribution?.neutral ?? "—"}
            </p>
            <p>
              <span className="mr-1.5 inline-block size-2 rounded-sm bg-muted" />
              Needs attention ·{" "}
              {satisfactionDistribution?.needsAttention ?? "—"}
            </p>
          </div>
        </div>
        {satisfactionCategories.length > 0 ? (
          <div className="mt-4 space-y-3">
            {satisfactionCategories.map((item) => (
              <div
                key={item.label}
                className="grid grid-cols-[minmax(0,1fr)_100px] items-center gap-3"
              >
                <div>
                  <p className="text-[11px] font-semibold text-foreground">
                    {item.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.value}% satisfaction
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, item.value)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            {satisfactionUnavailable
              ? "Satisfaction results could not be loaded."
              : "No reportable satisfaction responses for this period yet."}
          </p>
        )}
      </section>

      <section className="h-full min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Payroll summary
            </h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Latest generated employee payslips
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FluentSearchBox
              size="small"
              value={payrollSearch}
              onChange={(_event, data) => setPayrollSearch(data.value)}
              placeholder="Search employee"
              aria-label="Search payroll employees"
              className="hidden !w-44 sm:flex"
            />
            {canOpenPayroll ? (
              <Link
                href="/dashboard/operations/payroll"
                className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[10px] font-semibold !text-primary-foreground !no-underline hover:!no-underline"
              >
                View payroll
              </Link>
            ) : null}
          </div>
        </div>
        {filteredPayrollRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-muted/35 text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium">Job title</th>
                  <th className="px-3 py-2 font-medium">Gross</th>
                  <th className="px-3 py-2 font-medium">Deductions</th>
                  <th className="px-3 py-2 font-medium">Net pay</th>
                  <th className="px-4 py-2 text-right font-medium">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredPayrollRows.slice(0, 6).map((row, index) => {
                  const employee = asRecord(row.employee);
                  const name =
                    readStringDeep(row, ["employee_name", "full_name"]) ||
                    readStringDeep(employee, ["full_name", "name"]) ||
                    `Employee ${index + 1}`;
                  const number =
                    readStringDeep(row, ["employee_no", "employeeNo"]) ||
                    readStringDeep(employee, ["employee_no", "employeeNo"]);
                  const title =
                    readStringDeep(row, [
                      "job_title",
                      "designation_name",
                      "position_name",
                    ]) ||
                    readStringDeep(employee, [
                      "job_title",
                      "designation_name",
                      "position_name",
                    ]) ||
                    "—";
                  const currency =
                    readStringDeep(row, ["currency", "currency_code"]) || "TZS";
                  return (
                    <tr
                      key={`${readNumber(row, ["id", "payslip_id"]) ?? index}`}
                      className="text-xs text-foreground hover:bg-muted/20"
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{name}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {number || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {title}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatDashboardCurrency(
                          readDeepValue(row, [
                            "gross_pay",
                            "grossPay",
                            "total_gross_pay",
                          ]),
                          currency,
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatDashboardCurrency(
                          readDeepValue(row, [
                            "total_deductions",
                            "deductions",
                            "deduction_amount",
                          ]),
                          currency,
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatDashboardCurrency(
                          readDeepValue(row, [
                            "net_pay",
                            "netPay",
                            "total_net_pay",
                          ]),
                          currency,
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canOpenPayroll ? (
                          <Link
                            href="/dashboard/operations/payroll"
                            className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-700 !no-underline hover:!no-underline"
                          >
                            <FileTextIcon className="size-3" />
                            Open
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-56 items-center justify-center px-6 text-center text-xs text-muted-foreground">
            {canOpenPayroll
              ? "No generated payslips are available for the latest payroll run."
              : "Payroll access is not available for this account."}
          </div>
        )}
      </section>
    </div>
  );
}

function DashboardSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <UiCard
      size="sm"
      className={cn(
        "gap-0 rounded-2xl border-border/70 bg-card py-0 shadow-[0_18px_42px_-34px_rgb(var(--primary-rgb)_/_0.6)]",
        className,
      )}
    >
      <UiCardContent className="p-4 sm:p-5">{children}</UiCardContent>
    </UiCard>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <FluentSkeleton
      className="flex flex-col gap-2 py-1"
      aria-label="Loading content"
    >
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonItem
          key={i}
          shape="rectangle"
          className="!h-9 !w-full !rounded-md"
        />
      ))}
    </FluentSkeleton>
  );
}

type DashboardSlice =
  | "employees"
  | "departments"
  | "leave"
  | "attendance"
  | "onboarding"
  | "offboarding";

const ALL_SLICES: DashboardSlice[] = [
  "employees",
  "departments",
  "leave",
  "attendance",
  "onboarding",
  "offboarding",
];

const emptySliceState = (): Record<DashboardSlice, boolean> =>
  Object.fromEntries(ALL_SLICES.map((s) => [s, false])) as Record<
    DashboardSlice,
    boolean
  >;

const readySliceState = (): Record<DashboardSlice, boolean> =>
  Object.fromEntries(ALL_SLICES.map((s) => [s, true])) as Record<
    DashboardSlice,
    boolean
  >;

function readInitialWarmSnapshot(): DashboardWarmSnapshot | null {
  if (typeof window === "undefined") return null;
  return consumeDashboardWarmCache();
}

export default function HrAnalyticsDashboard({
  refreshKey = 0,
  adminRolesLabel,
  assignedRoleNames = [],
  userName,
  profilePhotoUrl,
  showLeaveRequests = false,
  showHrAnalytics = false,
}: HrAnalyticsDashboardProps) {
  const actor = useDashboardActor();
  // Lazy state (not a ref) so initial warm cache can seed UI without reading refs during render.
  const [warm] = React.useState<DashboardWarmSnapshot | null>(
    readInitialWarmSnapshot,
  );

  /** True while any request is in flight (refresh icon only). */
  const [loading, setLoading] = React.useState(!warm);
  /** Per-slice: true only until that slice has completed its first successful/failed load. */
  const [sliceReady, setSliceReady] = React.useState(
    warm ? readySliceState() : emptySliceState(),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [partialSourceErrors, setPartialSourceErrors] = React.useState<
    string[]
  >([]);

  const [fromDate, setFromDate] = React.useState(
    warm?.fromDate ?? formatInputDate(shiftDays(new Date(), -30)),
  );
  const [toDate, setToDate] = React.useState(
    warm?.toDate ?? formatInputDate(new Date()),
  );
  const [dateFilterOpen, setDateFilterOpen] = React.useState(false);
  const [welcomeBackground, setWelcomeBackground] = React.useState<
    "aurora" | "geometric" | "glow"
  >("aurora");
  const nextWelcomeBackground =
    welcomeBackground === "aurora"
      ? "geometric"
      : welcomeBackground === "geometric"
        ? "glow"
        : "aurora";

  const saveWelcomeBackground = useAccountAppearance(
    "managerBackground",
    "aurora",
    setWelcomeBackground,
  );
  const toggleWelcomeBackground = () =>
    saveWelcomeBackground(nextWelcomeBackground);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<Date | null>(null);

  const [employees, setEmployees] = React.useState<AdminRecord[]>(
    warm?.employees ?? [],
  );
  const [departments, setDepartments] = React.useState<AdminRecord[]>(
    warm?.departments ?? [],
  );
  const [departmentHeadcounts, setDepartmentHeadcounts] = React.useState<
    Array<[string, number]>
  >(warm ? buildDepartmentHeadcounts(warm.departments, warm.employees) : []);
  const [leaveRequests, setLeaveRequests] = React.useState<AdminRecord[]>(
    warm?.leaveRequests ?? [],
  );
  const [attendanceSummaries, setAttendanceSummaries] = React.useState<
    AdminRecord[]
  >(warm?.attendanceSummaries ?? []);
  const [todayAttendanceSummaries, setTodayAttendanceSummaries] =
    React.useState<AdminRecord[]>([]);
  const [onboardingRequests, setOnboardingRequests] = React.useState<
    AdminRecord[]
  >(warm?.onboardingRequests ?? []);
  const [offboardingRequests, setOffboardingRequests] = React.useState<
    AdminRecord[]
  >(warm?.offboardingRequests ?? []);
  const [payrollPayslips, setPayrollPayslips] = React.useState<AdminRecord[]>(
    [],
  );
  const [analyticsSummary, setAnalyticsSummary] =
    React.useState<AdminRecord | null>(null);
  const [surveySatisfaction, setSurveySatisfaction] = React.useState<{
    score: number | null;
    categories: Record<string, number>;
    satisfied: number;
    neutral: number;
    needsAttention: number;
  } | null>(null);
  const canReadForms = hasPermission(
    actor.permissionLabels,
    "forms_feedback:manage",
  );
  const [workforceSummary, setWorkforceSummary] =
    React.useState<AdminRecord | null>(null);
  const [upcomingHoliday, setUpcomingHoliday] =
    React.useState<AdminRecord | null>(null);

  const employeesRef = React.useRef(employees);
  const departmentsRef = React.useRef(departments);
  const hydratedFromWarmRef = React.useRef(Boolean(warm));
  const firstFetchRef = React.useRef(true);
  const canOpenLeaveRequests =
    showLeaveRequests &&
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/leave-management/requests",
      actor.permissionLabels,
      actor.accessMode,
    );
  const canOpenEmployeeDirectory =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/employees/all",
      actor.permissionLabels,
      actor.accessMode,
    );
  const canOpenOnboarding =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/employees/onboarding",
      actor.permissionLabels,
      actor.accessMode,
    );
  const canOpenOffboarding =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/employees/offboarding",
      actor.permissionLabels,
      actor.accessMode,
    );
  const canOpenDepartments =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/departments",
      actor.permissionLabels,
      actor.accessMode,
    );
  const canOpenAttendance =
    actor.ready &&
    (canAccessDashboardRoute(
      "/dashboard/attendance/daily-summaries",
      actor.permissionLabels,
      actor.accessMode,
    ) ||
      canAccessDashboardRoute(
        "/dashboard/attendance",
        actor.permissionLabels,
        actor.accessMode,
      ));
  const canOpenPayroll =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/operations/payroll",
      actor.permissionLabels,
      actor.accessMode,
    );
  const attendanceHref = canOpenAttendance
    ? canAccessDashboardRoute(
        "/dashboard/attendance/daily-summaries",
        actor.permissionLabels,
        actor.accessMode,
      )
      ? "/dashboard/attendance/daily-summaries"
      : "/dashboard/attendance"
    : undefined;

  React.useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  React.useEffect(() => {
    departmentsRef.current = departments;
  }, [departments]);

  React.useEffect(() => {
    // One-shot: clear post-login shell flag after overview mounts with data.
    if (hydratedFromWarmRef.current) {
      clearDashboardFromLoginFlag();
    }
  }, []);

  const markReady = React.useCallback((slice: DashboardSlice) => {
    setSliceReady((prev) => (prev[slice] ? prev : { ...prev, [slice]: true }));
  }, []);

  const recordPartialSourceError = React.useCallback((source: string) => {
    setPartialSourceErrors((previous) =>
      previous.includes(source) ? previous : [...previous, source],
    );
  }, []);

  const fetchAll = React.useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      const token = readStoredToken();
      if (!token) {
        setError("No active session. Please sign in again.");
        setPartialSourceErrors([]);
        setEmployees([]);
        setDepartments([]);
        setLeaveRequests([]);
        setAttendanceSummaries([]);
        setTodayAttendanceSummaries([]);
        setOnboardingRequests([]);
        setOffboardingRequests([]);
        setWorkforceSummary(null);
        setAnalyticsSummary(null);
        setUpcomingHoliday(null);
        setDepartmentHeadcounts([]);
        setSliceReady(readySliceState());
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      }
      setError(null);
      setPartialSourceErrors([]);

      const from_date = fromDate.trim() || undefined;
      const to_date = toDate.trim() || undefined;
      const listOpts = { cacheTtlMs: DASHBOARD_CACHE_TTL_MS };

      const leaveParams: Record<string, string | number> = {
        page: 1,
        limit: 40,
      };
      if (from_date) leaveParams.from_date = from_date;
      if (to_date) leaveParams.to_date = to_date;

      const todayAttendanceDate = formatLocalDateKey(new Date());
      const todayAttendanceParams: Record<string, string | number> = {
        page: 1,
        limit: 500,
        from_date: todayAttendanceDate,
        to_date: todayAttendanceDate,
      };

      const analyticsDashboardTask = getAnalyticsDashboard(token, "hr", {
        date_from: from_date,
        date_to: to_date,
        purpose: "dashboard",
      })
        .catch(() =>
          getHrDashboard(token, "hr", {
            date_from: from_date,
            date_to: to_date,
          }),
        )
        .catch(() => null);

      // Progressive paint: each slice updates as soon as it resolves (no waiting on the slowest).
      const tasks: Promise<void>[] = [
        canReadForms
          ? formsRequest<{
              score: number | null;
              categories: Record<string, number>;
              satisfied: number;
              neutral: number;
              needsAttention: number;
            }>(
              `hr/forms-feedback/satisfaction?from=${encodeURIComponent(`${from_date}T00:00:00`)}&to=${encodeURIComponent(`${to_date}T23:59:59`)}`,
            )
              .then(setSurveySatisfaction)
              .catch(() => {
                setSurveySatisfaction(null);
                recordPartialSourceError("Satisfaction results");
              })
          : Promise.resolve().then(() => setSurveySatisfaction(null)),
        // The advanced analytics HR dashboard is the authoritative structured
        // contract. Keep the older role dashboard as a compatibility fallback.
        analyticsDashboardTask.then((summary) => {
          if (!summary) {
            recordPartialSourceError("HR analytics summary");
          }
          setAnalyticsSummary(summary);
        }),

        getHrDashboard(token, "hr", {
          date_from: from_date,
          date_to: to_date,
        })
          .catch(async () => {
            const analytics = await analyticsDashboardTask;
            if (!analytics) {
              recordPartialSourceError("Workforce summary");
              return null;
            }
            const currentCount = readNumberDeep(analytics, [
              "period_end_headcount",
            ]);

            return {
              workforce_summary: {
                current_count: currentCount,
                status_counts: { ACTIVE: currentCount },
              },
              movements: {
                new_joiners:
                  readNumberDeep(analytics, ["joiners", "new_hires"]) ?? 0,
                exits: readNumberDeep(analytics, ["exits"]) ?? 0,
              },
              manpower: [],
              source: "analytics_fallback",
            } satisfies AdminRecord;
          })
          .then((summary) => {
            setWorkforceSummary(summary);
            setEmployees([]);
            const manpower = Array.isArray(summary?.manpower)
              ? summary.manpower
              : [];
            setDepartmentHeadcounts(
              manpower
                .map((entry) => {
                  const row = asRecord(entry) ?? {};
                  const label = readString(row, ["department_name", "name"]);
                  const count = readNumber(row, ["headcount", "count"]);
                  return label && count !== null
                    ? ([label, count] as [string, number])
                    : null;
                })
                .filter((entry): entry is [string, number] => Boolean(entry)),
            );
            markReady("employees");
          }),

        listDepartments(token, { page: 1, limit: 100 }, listOpts)
          .catch(() => {
            recordPartialSourceError("Department list");
            return { rows: [], total: null } as PagedRowsResult;
          })
          .then((deptRes) => {
            const deptRows = deptRes.rows ?? [];
            setDepartments(deptRows);
            setDepartmentHeadcounts(
              buildDepartmentHeadcounts(deptRows, employeesRef.current),
            );
            markReady("departments");
          }),

        showLeaveRequests
          ? listLeaveRequests(token, leaveParams)
              .catch(() => {
                recordPartialSourceError("Leave requests");
                return { rows: [], total: null } as PagedRowsResult;
              })
              .then((leaveRes) => {
                setLeaveRequests(leaveRes.rows ?? []);
                markReady("leave");
              })
          : Promise.resolve().then(() => {
              setLeaveRequests([]);
              markReady("leave");
            }),

        loadAttendanceReportRows(token, from_date, to_date)
          .catch(() => {
            recordPartialSourceError("Attendance history");
            return [];
          })
          .then((rows) => {
            setAttendanceSummaries(rows);
            markReady("attendance");
          }),

        listAttendanceDailySummariesPage(token, todayAttendanceParams, {
          cacheTtlMs: 0,
        })
          .catch(() => {
            recordPartialSourceError("Today's attendance");
            return { rows: [], total: null } as PagedRowsResult;
          })
          .then((attRes) => {
            setTodayAttendanceSummaries(attRes.rows ?? []);
          }),

        listAttendanceHolidays(token, { page: 1, limit: 100 })
          .catch(() => {
            recordPartialSourceError("Attendance holidays");
            return { rows: [], total: null } as PagedRowsResult;
          })
          .then((holidayResult) => {
            const today = formatLocalDateKey(new Date());
            const nextHoliday = [...(holidayResult.rows ?? [])]
              .filter((holiday) => {
                const date = holidayDateKey(holiday);
                return Boolean(date && date >= today);
              })
              .sort((left, right) =>
                holidayDateKey(left).localeCompare(holidayDateKey(right)),
              )[0];
            setUpcomingHoliday(nextHoliday ?? null);
          }),

        listOnboardingRequests(token, { page: 1, limit: 50 })
          .catch(() => {
            recordPartialSourceError("Onboarding requests");
            return { rows: [], total: null } as PagedRowsResult;
          })
          .then((onboardRes) => {
            setOnboardingRequests(onboardRes.rows ?? []);
            markReady("onboarding");
          }),

        listOffboardingRequests(token, { page: 1, limit: 50 })
          .catch(() => {
            recordPartialSourceError("Offboarding requests");
            return { rows: [], total: null } as PagedRowsResult;
          })
          .then((offboardRes) => {
            setOffboardingRequests(offboardRes.rows ?? []);
            markReady("offboarding");
          }),

        canOpenPayroll
          ? listPayrollRuns(token, {
              page: 1,
              limit: 1,
              sortBy: "created_at",
              sortOrder: "DESC",
            })
              .then(async (result) => {
                const run = result.rows[0];
                const runId = run
                  ? readNumber(run, ["id", "payroll_run_id", "payrollRunId"])
                  : null;
                setPayrollPayslips(
                  runId === null
                    ? []
                    : await listPayrollPayslipsForRun(token, runId).catch(
                        () => {
                          recordPartialSourceError("Payroll payslips");
                          return [];
                        },
                      ),
                );
              })
              .catch(() => {
                recordPartialSourceError("Payroll payslips");
                setPayrollPayslips([]);
              })
          : Promise.resolve().then(() => setPayrollPayslips([])),
      ];

      await Promise.allSettled(tasks);
      setLastUpdatedAt(new Date());
      setLoading(false);
    },
    [
      canReadForms,
      canOpenPayroll,
      fromDate,
      toDate,
      markReady,
      recordPartialSourceError,
      showLeaveRequests,
    ],
  );

  React.useEffect(() => {
    // First mount after login: revalidate quietly so we don't flash skeletons again.
    const silent = firstFetchRef.current && hydratedFromWarmRef.current;
    firstFetchRef.current = false;
    void fetchAll({ silent });
  }, [fetchAll]);

  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      void fetchAll();
    }
  }, [refreshKey, fetchAll]);

  const statusCounts = React.useMemo(() => {
    const summaryCounts = asRecord(
      asRecord(workforceSummary?.workforce_summary)?.status_counts,
    );
    if (summaryCounts) {
      return Object.fromEntries(
        Object.entries(summaryCounts).map(([status, count]) => [
          status.toLowerCase(),
          Number(count) || 0,
        ]),
      );
    }
    const counts: Record<string, number> = {};
    for (const e of employees) {
      const s = getEmploymentStatus(e).toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [employees, workforceSummary]);

  const currentEmployees = React.useMemo(
    () =>
      employees.filter(
        (employee) =>
          !isHistoricalEmployeeStatus(getEmploymentStatus(employee)),
      ),
    [employees],
  );

  // Derived metrics
  const summaryHeadcount = readNumber(
    asRecord(workforceSummary?.workforce_summary) ?? {},
    ["current_count"],
  );
  const totalHeadcount = summaryHeadcount ?? currentEmployees.length;

  const activeCount = statusCounts["active"] ?? 0;
  // Always derive from latest employees + departments so the chart cannot go stale
  // when one list request finishes before the other.
  const resolvedDepartmentHeadcounts = React.useMemo(() => {
    const analyticsRows =
      extractDepartmentHeadcountsFromAnalytics(analyticsSummary);
    const serverRows = departmentHeadcounts;
    if (serverRows.length > 0) return serverRows;
    return analyticsRows.length > 0
      ? analyticsRows
      : buildDepartmentHeadcounts(departments, currentEmployees);
  }, [analyticsSummary, currentEmployees, departments, departmentHeadcounts]);

  const recentLeaves = React.useMemo(() => {
    return [...leaveRequests]
      .sort((a, b) => {
        const da = String(a.created_at || a.requested_at || "");
        const db = String(b.created_at || b.requested_at || "");
        return db.localeCompare(da);
      })
      .slice(0, 6);
  }, [leaveRequests]);

  // Prefer the scoped server aggregate; retain legacy fallbacks for cached snapshots.
  const hiresInRange = React.useMemo(() => {
    const analyticsValue = readNumberDeep(analyticsSummary, [
      "new_hires",
      "hires_in_range",
      "recent_hires",
      "joiners",
    ]);
    if (analyticsValue !== null) return analyticsValue;
    const serverJoiners = readNumber(
      asRecord(workforceSummary?.movements) ?? {},
      ["new_joiners"],
    );
    if (serverJoiners !== null) return serverJoiners;
    if (!fromDate || !toDate) return 0;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
    let c = 0;
    for (const e of employees) {
      const ds = readString(e, [
        "created_at",
        "createdAt",
        "hire_date",
        "hired_at",
        "joined_at",
        "start_date",
        "employment_start",
      ]);
      if (!ds) continue;
      const d = new Date(ds);
      if (isNaN(d.getTime())) continue;
      if (d >= from && d <= to) c += 1;
    }
    return c;
  }, [analyticsSummary, employees, fromDate, toDate, workforceSummary]);

  const pendingOnboarding = React.useMemo(() => {
    const analyticsValue = readNumberDeep(analyticsSummary, [
      "pending_onboarding",
      "open_onboarding_requests",
      "onboarding_pending",
    ]);
    if (analyticsValue !== null) return analyticsValue;
    return onboardingRequests.filter((r) => {
      const s = readString(r, ["status", "request_status"]).toLowerCase();
      return (
        !s ||
        s.includes("pend") ||
        s.includes("progress") ||
        s === "open" ||
        s === "in_progress"
      );
    }).length;
  }, [analyticsSummary, onboardingRequests]);

  const pendingOffboarding = React.useMemo(() => {
    const analyticsValue = readNumberDeep(analyticsSummary, [
      "pending_offboarding",
      "open_offboarding_requests",
      "offboarding_pending",
    ]);
    if (analyticsValue !== null) return analyticsValue;
    return offboardingRequests.filter((r) => {
      const s = readString(r, ["status", "request_status"]).toLowerCase();
      return (
        !s ||
        s.includes("pend") ||
        s.includes("progress") ||
        s === "open" ||
        s === "in_progress"
      );
    }).length;
  }, [analyticsSummary, offboardingRequests]);

  const todayKey = formatLocalDateKey(new Date());
  const analyticsTodayPresent = readNumberDeep(analyticsSummary, [
    "today_present",
    "todayPresent",
    "present_today",
    "presentToday",
  ]);
  const analyticsTodayAbsent = readNumberDeep(analyticsSummary, [
    "today_absent",
    "todayAbsent",
    "absent_today",
    "absentToday",
  ]);
  const analyticsTodayLeave = readNumberDeep(analyticsSummary, [
    "today_on_leave",
    "todayOnLeave",
    "employees_currently_on_leave",
    "employeesCurrentlyOnLeave",
    "on_leave_today",
    "onLeaveToday",
  ]);
  const todayAttendance = React.useMemo(() => {
    const rows = new Map<string, AdminRecord>();
    const sourceSummaries = [
      ...attendanceSummaries,
      ...todayAttendanceSummaries,
    ];
    sourceSummaries.forEach((summary, index) => {
      const date = recordDateKey(
        readDeepValue(summary, [
          "attendance_date",
          "work_date",
          "summary_date",
          "date",
          "record_date",
        ]),
      );
      if (date !== todayKey) return;
      const employeeId = readNumberDeep(summary, [
        "employee_id",
        "employeeId",
        "company_user_id",
        "user_id",
      ]);
      const employeeNo = readStringDeep(summary, [
        "employee_no",
        "employeeNo",
        "staff_no",
      ]);
      rows.set(
        employeeId !== null
          ? `id:${employeeId}`
          : employeeNo
            ? `no:${employeeNo}`
            : `row:${index}`,
        summary,
      );
    });
    return Array.from(rows.values());
  }, [attendanceSummaries, todayAttendanceSummaries, todayKey]);

  const sampledTodayPresent = React.useMemo(
    () =>
      todayAttendance.filter((summary) => {
        const status = getAttendanceStatus(summary);
        return (
          status.includes("present") ||
          status.includes("late") ||
          status.includes("early_departure") ||
          status.includes("early departure") ||
          status.includes("overtime") ||
          status.includes("half_day") ||
          status.includes("half day") ||
          status.includes("worked") ||
          status.includes("early_departure") ||
          status.includes("overtime") ||
          status.includes("half_day") ||
          status.includes("manual_correction") ||
          status.includes("on_time") ||
          status.includes("ontime") ||
          status === "ok" ||
          status.includes("full")
        );
      }).length,
    [todayAttendance],
  );
  const todayPresent =
    analyticsTodayPresent !== null
      ? analyticsTodayPresent
      : sampledTodayPresent;

  const sampledTodayLeave = React.useMemo(() => {
    const employeesOnLeave = new Set<string>();
    todayAttendance.forEach((summary, index) => {
      const status = getAttendanceStatus(summary);
      if (!status.includes("leave")) return;
      const employeeId = readNumberDeep(summary, [
        "employee_id",
        "employeeId",
        "company_user_id",
        "user_id",
      ]);
      const employeeNo = readStringDeep(summary, [
        "employee_no",
        "employeeNo",
        "staff_no",
      ]);
      employeesOnLeave.add(
        employeeId !== null
          ? `id:${employeeId}`
          : employeeNo
            ? `no:${employeeNo}`
            : `attendance:${index}`,
      );
    });
    leaveRequests.forEach((request, index) => {
      const status = getLeaveStatus(request);
      if (status !== "approved") return;
      const start = recordDateKey(
        readDeepValue(request, ["start_date", "from_date", "date_from"]),
      );
      const end =
        recordDateKey(
          readDeepValue(request, ["end_date", "to_date", "date_to"]),
        ) || start;
      if (!start || todayKey < start || todayKey > end) return;
      const employeeId = readNumberDeep(request, [
        "employee_id",
        "employeeId",
        "company_user_id",
        "user_id",
      ]);
      const employeeNo = readStringDeep(request, [
        "employee_no",
        "employeeNo",
        "staff_no",
      ]);
      employeesOnLeave.add(
        employeeId !== null
          ? `id:${employeeId}`
          : employeeNo
            ? `no:${employeeNo}`
            : `row:${index}`,
      );
    });
    return employeesOnLeave.size;
  }, [leaveRequests, todayAttendance, todayKey]);
  const todayLeave =
    analyticsTodayLeave !== null ? analyticsTodayLeave : sampledTodayLeave;

  const explicitTodayAbsent = React.useMemo(
    () =>
      todayAttendance.filter((summary) => {
        const status = getAttendanceStatus(summary);
        return (
          status.includes("absent") ||
          status.includes("no_show") ||
          status.includes("no show")
        );
      }).length,
    [todayAttendance],
  );
  const todayAbsent =
    analyticsTodayAbsent !== null ? analyticsTodayAbsent : explicitTodayAbsent;
  const percentageOfHeadcount = (value: number) =>
    totalHeadcount > 0
      ? Math.min(100, Math.round((value / totalHeadcount) * 100))
      : 0;
  const toneForPercentage = (percentage: number): WorkforceMetricTone => {
    if (percentage <= 0) return "rose";
    if (percentage < 70) return "amber";
    return "emerald";
  };
  const attendanceReport = React.useMemo(() => {
    const byDate = new Map<string, AttendanceChartDay>();
    let present = 0;
    let late = 0;
    let absent = 0;

    attendanceSummaries.forEach((summary) => {
      const status = getAttendanceStatus(summary);
      const isLate = status.includes("late");
      const isAbsent =
        status.includes("absent") ||
        status.includes("no_show") ||
        status.includes("no show");
      const isPresent =
        !isAbsent &&
        (isLate ||
          status.includes("present") ||
          status.includes("worked") ||
          status.includes("early_departure") ||
          status.includes("overtime") ||
          status.includes("half_day") ||
          status.includes("manual_correction") ||
          status.includes("on_time") ||
          status.includes("ontime") ||
          status === "ok" ||
          status.includes("full"));

      if (isAbsent) absent += 1;
      else if (isLate) late += 1;
      else if (isPresent) present += 1;

      const date = recordDateKey(
        readDeepValue(summary, [
          "attendance_date",
          "work_date",
          "summary_date",
          "date",
          "record_date",
        ]),
      );
      if (!date || (!isPresent && !isAbsent)) return;
      const current = byDate.get(date) ?? {
        label: date,
        present: 0,
        late: 0,
        absent: 0,
      };
      if (isAbsent) current.absent += 1;
      else if (isLate) current.late += 1;
      else current.present += 1;
      byDate.set(date, current);
    });

    return {
      present,
      late,
      absent,
      rate: attendanceReportRate(present, late, absent),
      days: Array.from(byDate.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(-14)
        .map(([date, values]) => ({
          ...values,
          label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
            day: "2-digit",
          }),
        })),
    };
  }, [attendanceSummaries]);
  const satisfactionScore = surveySatisfaction?.score ?? null;
  const satisfactionCategories = Object.entries(
    surveySatisfaction?.categories ?? {},
  ).map(([key, value]) => ({ label: key.replaceAll("_", " "), value }));

  const workforceUnavailable =
    partialSourceErrors.includes("Workforce summary") ||
    summaryHeadcount === null;
  const attendanceUnavailable =
    workforceUnavailable ||
    (partialSourceErrors.includes("Today's attendance") &&
      (analyticsTodayPresent === null || analyticsTodayAbsent === null));
  const leaveUnavailable =
    workforceUnavailable ||
    (analyticsTodayLeave === null &&
      (partialSourceErrors.includes("Today's attendance") ||
        (showLeaveRequests && partialSourceErrors.includes("Leave requests"))));
  const workforceMetrics: WorkforceMetric[] = [
    {
      label: "Total employees",
      value: workforceUnavailable ? null : totalHeadcount,
      percentage: workforceUnavailable ? null : totalHeadcount > 0 ? 100 : 0,
      description: workforceUnavailable
        ? "Workforce summary is unavailable"
        : `${activeCount} active across ${departments.length || resolvedDepartmentHeadcounts.length} departments`,
      icon: <UsersIcon className="size-5" aria-hidden="true" />,
      tone: workforceUnavailable
        ? "amber"
        : toneForPercentage(totalHeadcount > 0 ? 100 : 0),
      visualization: "sparkline",
      href: canOpenEmployeeDirectory ? "/dashboard/employees/all" : undefined,
    },
    {
      label: "Today present",
      value: attendanceUnavailable ? null : todayPresent,
      percentage: attendanceUnavailable
        ? null
        : percentageOfHeadcount(todayPresent),
      description: attendanceUnavailable
        ? "Workforce or attendance data is unavailable"
        : `${percentageOfHeadcount(todayPresent)}% of employees are present today (${todayPresent} of ${totalHeadcount})`,
      icon: <UserCheckIcon className="size-5" aria-hidden="true" />,
      tone: attendanceUnavailable
        ? "amber"
        : toneForPercentage(percentageOfHeadcount(todayPresent)),
      visualization: "bars",
      href: attendanceHref,
    },
    {
      label: "Today absent",
      value: attendanceUnavailable ? null : todayAbsent,
      percentage: attendanceUnavailable
        ? null
        : percentageOfHeadcount(todayAbsent),
      description: attendanceUnavailable
        ? "Workforce or attendance data is unavailable"
        : `${percentageOfHeadcount(todayAbsent)}% of employees are absent today (${todayAbsent} of ${totalHeadcount})`,
      icon: <UserXIcon className="size-5" aria-hidden="true" />,
      tone: attendanceUnavailable
        ? "amber"
        : toneForPercentage(percentageOfHeadcount(todayAbsent)),
      visualization: "ticks",
      href: attendanceHref,
    },
    {
      label: "Today on leave",
      value: leaveUnavailable ? null : todayLeave,
      percentage: leaveUnavailable ? null : percentageOfHeadcount(todayLeave),
      description: leaveUnavailable
        ? "Workforce or leave data is unavailable"
        : `${percentageOfHeadcount(todayLeave)}% of employees are on approved leave today (${todayLeave} of ${totalHeadcount})`,
      icon: <UserMinusIcon className="size-5" aria-hidden="true" />,
      tone: leaveUnavailable
        ? "amber"
        : toneForPercentage(percentageOfHeadcount(todayLeave)),
      visualization: "progress",
      href: canOpenLeaveRequests
        ? "/dashboard/leave-management/requests"
        : undefined,
    },
  ];

  type MetricWithReady = Metric & { ready: boolean };

  const metrics: MetricWithReady[] = [
    {
      label: "Departments",
      value: partialSourceErrors.includes("Department list")
        ? "Unavailable"
        : departments.length || departmentHeadcounts.length || "-",
      sub: "Active structures",
      ready: sliceReady.departments,
      href: canOpenDepartments ? "/dashboard/departments" : undefined,
    },
    {
      label: "New hires",
      value: partialSourceErrors.includes("Workforce summary")
        ? "Unavailable"
        : hiresInRange,
      sub:
        fromDate && toDate
          ? `${formatDateShort(fromDate)} - ${formatDateShort(toDate)}`
          : "Selected range",
      ready: sliceReady.employees,
      compact: true,
      href: canOpenEmployeeDirectory ? "/dashboard/employees/all" : undefined,
    },
    {
      label: "Onboarding",
      value: partialSourceErrors.includes("Onboarding requests")
        ? "Unavailable"
        : pendingOnboarding,
      sub: "open requests",
      ready: sliceReady.onboarding,
      compact: true,
      href: canOpenOnboarding ? "/dashboard/employees/onboarding" : undefined,
    },
    {
      label: "Offboarding",
      value: partialSourceErrors.includes("Offboarding requests")
        ? "Unavailable"
        : pendingOffboarding,
      sub: "open requests",
      ready: sliceReady.offboarding,
      compact: true,
      href: canOpenOffboarding ? "/dashboard/employees/offboarding" : undefined,
    },
  ];

  const pendingLeaveRequests = leaveRequests.filter((request) => {
    const status = getLeaveStatus(request);
    return (
      !status ||
      status.includes("pending") ||
      status.includes("submitted") ||
      status.includes("review")
    );
  }).length;
  const pendingActions =
    readNumberDeep(analyticsSummary, [
      "pending_actions",
      "pending_approvals",
      "actions_pending",
    ]) ?? 0;
  const riskIndicatorCount = Array.isArray(analyticsSummary?.risk_indicators)
    ? analyticsSummary.risk_indicators.length
    : 0;
  const invitedCount =
    readNumberDeep(analyticsSummary, [
      "pending_invitations",
      "invited_employees",
      "invitations",
    ]) ?? 0;
  const registeredCount =
    readNumberDeep(analyticsSummary, [
      "registered_employees",
      "registrations",
      "registration_completed",
    ]) ?? 0;

  const priorities: DashboardPriority[] = [
    ...(pendingActions > 0
      ? [
          {
            id: "approvals",
            title: "Approvals waiting",
            description:
              "Requests are waiting for an assigned approver to make a decision.",
            owner: "Assigned approvers",
            count: pendingActions,
            tone: "urgent" as const,
            icon: <ListChecksIcon aria-hidden="true" />,
          },
        ]
      : []),
    ...(pendingOnboarding > 0
      ? [
          {
            id: "onboarding",
            title: "Onboarding needs progress",
            description:
              "Open employee journeys still have readiness steps or responsible teams to follow up.",
            owner: "HR and responsible teams",
            count: pendingOnboarding,
            href: canOpenOnboarding
              ? "/dashboard/employees/onboarding"
              : undefined,
            tone: "warning" as const,
            icon: <UserRoundPlusIcon aria-hidden="true" />,
          },
        ]
      : []),
    ...(todayAbsent > 0
      ? [
          {
            id: "attendance",
            title: "Attendance exceptions",
            description:
              "Employees are recorded absent today and may need verification or manager follow-up.",
            owner: "HR and line managers",
            count: todayAbsent,
            href: attendanceHref,
            tone: "urgent" as const,
            icon: <Clock3Icon aria-hidden="true" />,
          },
        ]
      : []),
    ...(pendingLeaveRequests > 0
      ? [
          {
            id: "leave",
            title: "Leave requests waiting",
            description:
              "Submitted leave requests are awaiting review or a final decision.",
            owner: "Leave approvers",
            count: pendingLeaveRequests,
            href: canOpenLeaveRequests
              ? "/dashboard/leave-management/requests"
              : undefined,
            tone: "info" as const,
            icon: <CalendarIcon aria-hidden="true" />,
          },
        ]
      : []),
    ...(pendingOffboarding > 0
      ? [
          {
            id: "offboarding",
            title: "Offboarding in progress",
            description:
              "Exit journeys still require completion, clearance, or ownership follow-up.",
            owner: "HR and line managers",
            count: pendingOffboarding,
            href: canOpenOffboarding
              ? "/dashboard/employees/offboarding"
              : undefined,
            tone: "warning" as const,
            icon: <BriefcaseBusinessIcon aria-hidden="true" />,
          },
        ]
      : []),
    ...(riskIndicatorCount > 0
      ? [
          {
            id: "risks",
            title: "Workforce risk signals",
            description:
              "Analytics detected workforce conditions that deserve a closer HR review.",
            owner: "HR leadership",
            count: riskIndicatorCount,
            tone: "urgent" as const,
            icon: <BellRingIcon aria-hidden="true" />,
          },
        ]
      : []),
  ];

  const lifecycleStages: LifecycleStage[] = [
    {
      label: "Invited",
      count: invitedCount,
      description: "Waiting to accept",
      icon: <PersonAddColor aria-hidden="true" />,
      countColor: invitedCount > 0 ? "brand" : "subtle",
      href: canOpenOnboarding ? "/dashboard/employees/onboarding" : undefined,
    },
    {
      label: "Registered",
      count: registeredCount,
      description: "Profile created",
      icon: <PersonAvailableColor aria-hidden="true" />,
      countColor: registeredCount > 0 ? "brand" : "subtle",
      href: canOpenOnboarding ? "/dashboard/employees/onboarding" : undefined,
    },
    {
      label: "Onboarding",
      count: pendingOnboarding,
      description: "Readiness in progress",
      icon: <ClipboardTaskColor aria-hidden="true" />,
      countColor: pendingOnboarding > 0 ? "warning" : "subtle",
      href: canOpenOnboarding ? "/dashboard/employees/onboarding" : undefined,
    },
    {
      label: "Active",
      count: activeCount,
      description: "Currently employed",
      icon: <CheckmarkCircleColor aria-hidden="true" />,
      countColor: activeCount > 0 ? "success" : "subtle",
      href: canOpenEmployeeDirectory ? "/dashboard/employees/all" : undefined,
    },
    {
      label: "Exiting",
      count: pendingOffboarding,
      description: "Clearance in progress",
      icon: <PersonWarningColor aria-hidden="true" />,
      countColor: pendingOffboarding > 0 ? "warning" : "subtle",
      href: canOpenOffboarding ? "/dashboard/employees/offboarding" : undefined,
    },
  ];

  const insights: DashboardInsight[] = [
    {
      title:
        priorities.length > 0
          ? `${priorities.length} areas need attention`
          : "Your queue is clear",
    },
    {
      title: partialSourceErrors.includes("Attendance history")
        ? "Attendance unavailable"
        : attendanceReport.rate === null
          ? "No attendance rate available"
          : `${attendanceReport.rate}% attendance rate`,
      href: attendanceHref,
    },
    {
      title:
        pendingOnboarding > 0
          ? `${pendingOnboarding} onboarding journeys open`
          : "Onboarding is under control",
      href: canOpenOnboarding ? "/dashboard/employees/onboarding" : undefined,
    },
  ];

  const leaveSectionReady = sliceReady.leave;
  const motionPreset = useDashboardMotion();
  const hrAnalyticsGroups = React.useMemo(() => {
    if (!analyticsSummary) return [];

    const number = (keys: string[]) => readNumberDeep(analyticsSummary, keys);
    const decimal = (value: number | null) =>
      value === null
        ? "—"
        : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
            value,
          );
    const percent = (keys: string[]) => {
      const value = number(keys);
      return value === null ? "—" : `${decimal(value)}%`;
    };
    const workMinutes = number(["work_minutes"]);
    const hours =
      workMinutes === null ? null : Math.round((workMinutes / 60) * 10) / 10;
    const risks = Array.isArray(analyticsSummary.risk_indicators)
      ? analyticsSummary.risk_indicators.length
      : null;

    return [
      {
        title: "Workforce movement",
        items: [
          {
            label: "Period-end headcount",
            value: decimal(number(["period_end_headcount"])),
          },
          { label: "Joiners", value: decimal(number(["joiners"])) },
          { label: "Exits", value: decimal(number(["exits"])) },
          { label: "Attrition rate", value: percent(["attrition_rate"]) },
        ],
      },
      {
        title: "Attendance and leave",
        items: [
          {
            label: "Finalized days",
            value: decimal(number(["finalized_days"])),
          },
          { label: "Work hours", value: decimal(hours) },
          { label: "Late rate", value: percent(["late_rate"]) },
          {
            label: "Missing punch days",
            value: decimal(number(["missing_punch_days"])),
          },
          {
            label: "Approved leave requests",
            value: decimal(number(["approved_requests"])),
          },
          {
            label: "Approved leave days",
            value: decimal(number(["approved_days"])),
          },
        ],
      },
      {
        title: "Payroll and employee finance",
        items: [
          {
            label: "Locked payroll runs",
            value: decimal(number(["locked_runs"])),
          },
          { label: "Gross pay", value: decimal(number(["gross_pay"])) },
          { label: "Net pay", value: decimal(number(["net_pay"])) },
          { label: "Employer cost", value: decimal(number(["employer_cost"])) },
          {
            label: "Outstanding finance",
            value: decimal(number(["total_outstanding"])),
          },
          { label: "Arrears ratio", value: percent(["arrears_ratio"]) },
        ],
      },
      {
        title: "Operations",
        items: [
          {
            label: "Approved daily reports",
            value: decimal(number(["approved_daily_reports"])),
          },
          {
            label: "Reviewed field visits",
            value: decimal(number(["reviewed_field_visits"])),
          },
          {
            label: "Pending approvals",
            value: decimal(number(["pending_actions"])),
          },
          { label: "Risk indicators", value: decimal(risks) },
        ],
      },
    ];
  }, [analyticsSummary]);
  const dateRangePresets = [
    { label: "Last week", days: 7 },
    { label: "Last 2 weeks", days: 14 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
  ];
  const todayInputDate = formatInputDate(new Date());
  const activeDateRangeLabel =
    dateRangePresets.find(
      (preset) =>
        fromDate === formatInputDate(shiftDays(new Date(), -preset.days)) &&
        toDate === todayInputDate,
    )?.label ?? "Custom range";

  const applyDateRangePreset = (days: number) => {
    setFromDate(formatInputDate(shiftDays(new Date(), -days)));
    setToDate(formatInputDate(new Date()));
    setDateFilterOpen(false);
  };
  const visibleRoleNames = Array.from(
    new Set([
      ...assignedRoleNames,
      ...(adminRolesLabel
        ?.split("•")
        .map((role) => role.trim())
        .filter(Boolean) ?? []),
    ]),
  );
  const upcomingHolidayName = upcomingHoliday
    ? readString(upcomingHoliday, [
        "name",
        "holiday_name",
        "holidayName",
        "title",
      ])
    : "";
  const upcomingHolidayDate = upcomingHoliday
    ? holidayDateKey(upcomingHoliday)
    : "";
  const firstName = (userName || "Company user").trim().split(/\s+/)[0];
  const primaryRole =
    visibleRoleNames.find(
      (roleName) => !/^(company user|user|employee)$/i.test(roleName),
    ) ?? visibleRoleNames[0];
  const secondaryRoleNames = visibleRoleNames.filter(
    (roleName) => roleName !== primaryRole,
  );
  const secondaryRoleCount = secondaryRoleNames.length;
  const lastUpdatedLabel = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Waiting for data";

  return (
    <motion.div
      className="w-full pb-6"
      variants={motionPreset.container}
      initial="hidden"
      animate="show"
    >
      <header>
        <FluentCard
          appearance="filled"
          className="relative isolate z-10 w-full !rounded-none !border !border-border !bg-card !px-5 !pb-5 !pt-2 !shadow-md sm:!px-6 sm:!pb-6"
        >
          <WelcomeCardBackground background={welcomeBackground} />
          <div className="relative z-10 grid gap-4 md:grid-cols-[minmax(18rem,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <Persona
                name={userName || "Company user"}
                primaryText=""
                secondaryText=""
                presence={{ status: "available" }}
                avatar={{
                  color: "brand",
                  image: profilePhotoUrl
                    ? { src: profilePhotoUrl, alt: userName || "HR profile" }
                    : undefined,
                }}
                size="huge"
                className="shrink-0"
              />
              <div className="min-w-0">
                <FluentText
                  as="p"
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-foreground/80"
                >
                  Welcome back
                </FluentText>
                <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
                  <FluentText
                    as="h1"
                    size={800}
                    weight="semibold"
                    className="relative truncate pb-1 text-2xl font-semibold tracking-tight text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary/45 sm:text-3xl"
                    aria-label={`Welcome back, ${firstName}`}
                  >
                    {firstName}
                  </FluentText>
                  <FluentBadge
                    appearance="tint"
                    color="success"
                    icon={<PresenceBadge status="available" />}
                  >
                    Available
                  </FluentBadge>
                </div>
                <FluentText
                  as="p"
                  className="mt-0.5 text-sm text-muted-foreground dark:text-foreground/75"
                >
                  {priorities.length > 0
                    ? `${priorities.length} areas need attention.`
                    : "No urgent items."}
                </FluentText>
                <div
                  className="mt-2 flex flex-wrap items-center gap-2"
                  aria-label="Assigned roles"
                >
                  {primaryRole && secondaryRoleCount === 0 ? (
                    <FluentBadge appearance="outline">
                      {primaryRole}
                    </FluentBadge>
                  ) : null}
                  {secondaryRoleCount > 0 ? (
                    <FluentPopover positioning="below-start">
                      <FluentPopoverTrigger disableButtonEnhancement>
                        <FluentButton
                          appearance="outline"
                          shape="circular"
                          size="small"
                          type="button"
                          aria-label={`${primaryRole}, view ${secondaryRoleCount} additional role${secondaryRoleCount === 1 ? "" : "s"}`}
                        >
                          {primaryRole}
                          <FluentBadge
                            appearance="tint"
                            size="small"
                            className="ml-1.5"
                          >
                            +{secondaryRoleCount}
                          </FluentBadge>
                        </FluentButton>
                      </FluentPopoverTrigger>
                      <PopoverSurface className="w-56 p-3">
                        <FluentText
                          as="p"
                          className="text-xs font-semibold text-foreground"
                        >
                          Additional roles
                        </FluentText>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {secondaryRoleNames.map((roleName) => (
                            <FluentBadge key={roleName} appearance="tint">
                              {roleName}
                            </FluentBadge>
                          ))}
                        </div>
                      </PopoverSurface>
                    </FluentPopover>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              {upcomingHoliday && upcomingHolidayDate ? (
                <FluentLink
                  href="/dashboard/attendance/holidays"
                  className="!inline-flex max-w-full items-center gap-2 !text-foreground dark:!text-slate-100 [&_svg]:!text-primary dark:[&_svg]:!text-violet-300"
                  aria-label={`Upcoming holiday ${upcomingHolidayName || "Holiday"} on ${formatDateShort(upcomingHolidayDate)}`}
                >
                  <CalendarLtr20Regular
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  <Caption1 className="min-w-0 !text-current">
                    {upcomingHolidayName || "Holiday"}
                  </Caption1>
                  <Caption1 className="shrink-0 whitespace-nowrap !text-current opacity-75">
                    {formatDateShort(upcomingHolidayDate)}
                  </Caption1>
                </FluentLink>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <FluentButton
                  appearance="subtle"
                  size="small"
                  icon={
                    <PaintBrush20Regular className="!text-primary dark:!text-violet-300" />
                  }
                  type="button"
                  aria-label={`Background: ${welcomeBackground}. Switch to ${nextWelcomeBackground}`}
                  title={`Background: ${welcomeBackground}. Switch to ${nextWelcomeBackground}`}
                  onClick={toggleWelcomeBackground}
                />
                <FluentPopover
                  positioning="below-end"
                  open={dateFilterOpen}
                  onOpenChange={(_, data) => setDateFilterOpen(data.open)}
                >
                  <FluentPopoverTrigger disableButtonEnhancement>
                    <FluentButton
                      appearance="subtle"
                      size="small"
                      icon={
                        <Filter20Regular className="!text-primary dark:!text-violet-300" />
                      }
                      type="button"
                      aria-label="Filter dashboard date range"
                      title={`Filter date range: ${activeDateRangeLabel}`}
                    />
                  </FluentPopoverTrigger>
                  <PopoverSurface className="w-[min(19rem,calc(100vw-1.5rem))] p-2.5">
                    <div>
                      <FluentText
                        as="p"
                        className="text-xs font-semibold text-foreground"
                      >
                        Dashboard period
                      </FluentText>
                      <FluentText
                        as="p"
                        className="mt-0.5 text-[10px] text-muted-foreground"
                      >
                        {formatDateShort(fromDate)} – {formatDateShort(toDate)}
                      </FluentText>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      {dateRangePresets.map((preset) => {
                        const active = activeDateRangeLabel === preset.label;
                        return (
                          <FluentButton
                            appearance={active ? "primary" : "secondary"}
                            size="small"
                            aria-pressed={active}
                            key={preset.days}
                            type="button"
                            onClick={() => applyDateRangePreset(preset.days)}
                          >
                            {preset.label}
                          </FluentButton>
                        );
                      })}
                    </div>
                    <div className="mt-2.5 border-t border-border pt-2.5">
                      <FluentText
                        as="p"
                        className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        Custom range
                      </FluentText>
                      <div className="grid grid-cols-2 gap-2">
                        <DatePickerPresets
                          value={fromDate}
                          onChange={setFromDate}
                          placeholder="From date"
                          className="h-7 px-2 text-[10px]"
                        />
                        <DatePickerPresets
                          value={toDate}
                          onChange={setToDate}
                          placeholder="To date"
                          className="h-7 px-2 text-[10px]"
                        />
                      </div>
                    </div>
                  </PopoverSurface>
                </FluentPopover>
                <FluentButton
                  appearance="subtle"
                  size="small"
                  icon={
                    <ArrowClockwise20Regular
                      className={cn("!text-primary dark:!text-violet-300", loading && "animate-spin")}
                    />
                  }
                  onClick={() => void fetchAll()}
                  disabled={loading}
                  aria-label="Refresh dashboard"
                  title={`Last updated ${lastUpdatedLabel}`}
                />
              </div>
              <Caption1 className="tabular-nums text-muted-foreground">
                Updated {lastUpdatedLabel}
              </Caption1>
            </div>
          </div>
        </FluentCard>
      </header>
      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="gap-0.5 p-3 pr-12">
            <SheetTitle>Guided HR review</SheetTitle>
            <SheetDescription>Today’s priority items.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
            <div className="flex items-center gap-2 border-b border-border/70 px-1 py-2 text-xs">
              <SparklesIcon
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span className="font-medium text-foreground">
                Daily briefing
              </span>
              <span className="truncate text-muted-foreground">
                {priorities.length > 0
                  ? `${priorities.length} areas · urgent first`
                  : "No urgent items."}
              </span>
            </div>
            {priorities.length > 0 ? (
              <div className="divide-y divide-border/70">
                {priorities.map((priority) => {
                  const row = (
                    <div className="flex min-h-16 items-center gap-2.5 px-1 py-2 transition hover:bg-muted/25">
                      <span
                        className={cn(
                          "inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60 [&_svg]:size-4",
                          priority.tone === "urgent"
                            ? "text-destructive"
                            : "text-primary",
                        )}
                      >
                        {priority.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {priority.title}
                          </p>
                          <Badge
                            variant="secondary"
                            className="shrink-0 tabular-nums"
                          >
                            {priority.count}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {priority.owner} · {priority.description}
                        </p>
                      </div>
                      {priority.href ? (
                        <ChevronRightIcon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                  );
                  return priority.href ? (
                    <Link
                      key={priority.id}
                      href={priority.href}
                      prefetch={false}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div key={priority.id}>{row}</div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 px-1 py-4">
                <CircleCheckBigIcon
                  className="size-6 shrink-0 text-emerald-500"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Review complete
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No action required.
                  </p>
                </div>
              </div>
            )}
          </div>
          <SheetFooter className="p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdatedLabel}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewOpen(false)}
              >
                Close
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="w-full px-1 sm:px-2 lg:px-3">
        <motion.section
          className="relative pb-1 pt-3 md:pt-4"
          variants={motionPreset.item}
        >
          <div className="flex flex-col gap-3">
            <section className="border-b border-border/70 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">
                      Needs your attention
                    </h2>
                    <Badge
                      variant={priorities.length > 0 ? "default" : "secondary"}
                    >
                      {priorities.length > 0
                        ? `${priorities.length} areas`
                        : "All clear"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Approvals and workforce exceptions.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setReviewOpen(true)}
                  className="gap-1.5"
                  style={{
                    backgroundColor: "var(--primary)",
                    borderColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  <ListChecksIcon data-icon="inline-start" aria-hidden="true" />
                  Review all
                </Button>
              </div>
              <div className="mt-3">
                {priorities.length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {priorities.slice(0, 3).map((priority) => (
                      <DashboardPriorityCard
                        key={priority.id}
                        priority={priority}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-1 py-2">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <CircleCheckBigIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">
                        Nothing urgent is waiting
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        No urgent items right now.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <DashboardLifecycle stages={lifecycleStages} />
            <DashboardIntelligence insights={insights} />
          </div>

          <div className="mb-3 mt-5">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Today at a glance
            </h2>
          </div>
          <motion.div
            className="grid w-full grid-cols-1 items-stretch gap-2.5 min-[520px]:grid-cols-2 lg:grid-cols-4"
            aria-busy={loading}
            aria-live="polite"
            variants={motionPreset.metrics}
          >
            {workforceMetrics.map((metric) => (
              <WorkforceMetricCard
                key={metric.label}
                metric={metric}
                reduce={motionPreset.reduce}
                variants={motionPreset.metricCard}
              />
            ))}
          </motion.div>
          <div className="mb-3 mt-5">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Workforce movement
            </h2>
          </div>
          <motion.div
            className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] items-stretch gap-2.5"
            variants={motionPreset.metrics}
          >
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                metric={metric}
                reduce={motionPreset.reduce}
                variants={motionPreset.metricCard}
                hover={motionPreset.hover}
              />
            ))}
          </motion.div>
          <WorkforceInsightPanels
            rangeLabel={activeDateRangeLabel}
            attendanceRate={
              partialSourceErrors.includes("Attendance history")
                ? null
                : attendanceReport.rate
            }
            present={
              partialSourceErrors.includes("Attendance history")
                ? null
                : attendanceReport.present
            }
            late={
              partialSourceErrors.includes("Attendance history")
                ? null
                : attendanceReport.late
            }
            absent={
              partialSourceErrors.includes("Attendance history")
                ? null
                : attendanceReport.absent
            }
            attendanceDays={attendanceReport.days}
            attendanceUnavailable={partialSourceErrors.includes(
              "Attendance history",
            )}
          />
          <PeopleExperiencePanels
            satisfactionUnavailable={partialSourceErrors.includes(
              "Satisfaction results",
            )}
            satisfactionDistribution={surveySatisfaction}
            satisfactionScore={satisfactionScore}
            satisfactionCategories={satisfactionCategories}
            payrollRows={payrollPayslips}
            canOpenPayroll={canOpenPayroll}
          />
        </motion.section>

        {error ? (
          <motion.div
            variants={motionPreset.item}
            className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        ) : null}

        {partialSourceErrors.length > 0 ? (
          <motion.div
            variants={motionPreset.item}
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100"
            role="status"
            aria-live="polite"
          >
            <div>
              <p className="font-semibold">
                Some dashboard sources are unavailable
              </p>
              <p className="mt-1 text-xs">
                Empty results are not confirmed zero counts:{" "}
                {partialSourceErrors.join(", ")}. Last successful refresh:{" "}
                {lastUpdatedLabel}.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void fetchAll()}
              disabled={loading}
            >
              <ArrowClockwise20Regular
                className={cn("size-4", loading && "animate-spin")}
                aria-hidden="true"
              />
              Retry unavailable sources
            </Button>
          </motion.div>
        ) : null}

        {showHrAnalytics && hrAnalyticsGroups.length > 0 ? (
          <motion.section className="mt-6" variants={motionPreset.item}>
            <div className="mb-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                HR analytics
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Workforce, attendance, and pay snapshot
              </p>
            </div>
            <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3">
              {hrAnalyticsGroups.map((group) => (
                <UiCard
                  key={group.title}
                  size="sm"
                  className="gap-0 rounded-2xl border-border/70 py-0 shadow-sm"
                >
                  <UiCardContent className="p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      {group.title}
                    </h3>
                    <dl className="mt-3 flex flex-col gap-2">
                      {group.items.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-3 border-t border-border/70 pt-2 first:border-t-0 first:pt-0"
                        >
                          <dt className="text-xs leading-5 text-muted-foreground">
                            {item.label}
                          </dt>
                          <dd className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </UiCardContent>
                </UiCard>
              ))}
            </div>
          </motion.section>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
          {showLeaveRequests ? (
            <motion.section
              className="lg:col-span-12"
              variants={motionPreset.item}
            >
              <DashboardSurface>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Leave requests
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {fromDate && toDate
                        ? `${formatDateShort(fromDate)} – ${formatDateShort(toDate)}`
                        : "Latest activity"}
                    </div>
                  </div>
                  {canOpenLeaveRequests ? (
                    <Link
                      href="/dashboard/leave-management/requests"
                      className="inline-flex h-8 items-center rounded-full border border-primary/15 bg-primary/10 px-3 text-[11px] font-semibold text-primary transition hover:bg-primary/15"
                    >
                      View all
                    </Link>
                  ) : null}
                </div>

                <div className="mt-4">
                  {!leaveSectionReady ? (
                    <SectionSkeleton rows={4} />
                  ) : partialSourceErrors.includes("Leave requests") ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-5 text-center text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      Leave request data is unavailable. No zero-count
                      conclusion can be drawn.
                    </div>
                  ) : recentLeaves.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-primary/10">
                      <table className="w-full text-xs">
                        <thead className="bg-primary/5 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">
                              Employee
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Type
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Dates
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-primary/10 text-foreground">
                          {recentLeaves.map((lr, i) => {
                            const href = leaveDetailHref(lr);
                            const empNo = getLeaveEmployeeNo(lr);
                            const canOpenLeaveLink =
                              canOpenLeaveRequests && Boolean(href);
                            return (
                              <motion.tr
                                key={getLeaveId(lr) ?? i}
                                className="transition hover:bg-primary/5"
                                initial={
                                  motionPreset.reduce
                                    ? false
                                    : { opacity: 0, x: -8 }
                                }
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.28, delay: i * 0.04 }}
                              >
                                <td className="px-3 py-2.5 font-medium">
                                  {canOpenLeaveLink ? (
                                    <Link
                                      href={href}
                                      className="hover:text-primary hover:underline"
                                    >
                                      {getLeaveEmployeeName(lr)}
                                    </Link>
                                  ) : (
                                    getLeaveEmployeeName(lr)
                                  )}
                                  {empNo ? (
                                    <div className="font-mono text-[10px] text-muted-foreground">
                                      {empNo}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2.5">
                                  {getLeaveType(lr)}
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground">
                                  {getLeaveDates(lr)}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={cn(
                                      "inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                      leaveStatusTone(getLeaveStatus(lr)),
                                    )}
                                  >
                                    {getLeaveStatus(lr)}
                                  </span>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-primary/4 px-4 py-8 text-center">
                      <span className="inline-flex size-11 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
                        <CalendarIcon className="size-4" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        No leave requests to display
                      </p>
                      <p className="mt-1 max-w-[16rem] text-[11px] leading-4 text-muted-foreground">
                        Nothing is waiting in this date range.
                      </p>
                    </div>
                  )}
                </div>
              </DashboardSurface>
            </motion.section>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
