"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ArrowDownload16Regular,
  ArrowSortDownLines20Regular,
  ArrowSort20Regular,
  ArrowSortUpLines20Regular,
  ChevronDown16Regular,
  ColumnTriple20Regular,
  Filter16Regular,
} from "@fluentui/react-icons";
import {
  Checkbox as FluentCheckbox,
  Dropdown,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";
import React from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/components/theme-provider";
import { useRenderDiagnostics } from "@/hooks/use-render-diagnostics";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function SortControlPortal({ container, children }: { container?: HTMLElement | null; children: React.ReactNode }) {
  return container ? createPortal(children, container) : children;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  salary?: number;
  hireDate: string;
  status: "active" | "inactive" | "on-leave";
  avatar?: string;
}

export interface Column<T = Record<string, unknown>> {
  key: string;
  label: string;
  defaultWidth?: number;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  /** Optional explicit sort value. Prefer this when `key` does not match the API field. */
  sortValue?: (item: T) => unknown;
}

/** Common column-key → API field aliases (camelCase + snake_case). */
const SORT_FIELD_ALIASES: Record<string, string[]> = {
  name: [
    "fullName",
    "full_name",
    "displayName",
    "display_name",
    "employeeName",
    "employee_name",
    "name",
  ],
  employee_no: [
    "employeeNo",
    "employee_no",
    "employee_number",
    "employeeNumber",
    "user_no",
    "userNo",
  ],
  department: [
    "departmentName",
    "department_name",
    "department",
    "dept",
    "deptName",
  ],
  position: [
    "positionName",
    "position_name",
    "position",
    "title",
    "jobTitle",
    "job_title",
  ],
  status: ["employmentStatus", "employment_status", "status", "state"],
  hiredate: [
    "hireDate",
    "hire_date",
    "hired_at",
    "hiredAt",
    "joined_at",
    "joinedAt",
    "join_date",
    "joinDate",
    "created_at",
    "createdAt",
  ],
  email: ["email", "workEmail", "work_email", "userEmail", "user_email"],
  phone: [
    "phone",
    "mobile",
    "phoneNumber",
    "phone_number",
    "mobileNumber",
    "mobile_number",
  ],
  branch: [
    "branchName",
    "branch_name",
    "branch",
    "location",
    "locationName",
    "location_name",
  ],
  manager: [
    "managerName",
    "manager_name",
    "manager",
    "reportsTo",
    "reports_to",
  ],
};

function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function camelToSnake(value: string) {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function isEmptySortValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "-" ||
    value === "—"
  );
}

function readNestedRecordName(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of [
    "name",
    "fullName",
    "full_name",
    "departmentName",
    "department_name",
    "positionName",
    "position_name",
    "branchName",
    "branch_name",
    "title",
    "label",
  ]) {
    const nested = record[key];
    if (typeof nested === "string" && nested.trim()) {
      return nested.trim();
    }
  }
  return null;
}

function extractTextFromNode(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromNode).filter(Boolean).join(" ");
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode; title?: string };
    if (typeof props.title === "string" && props.title.trim()) {
      return props.title.trim();
    }
    return extractTextFromNode(props.children);
  }
  return "";
}

function buildSortCandidateKeys(columnKey: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const push = (key: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  push(columnKey);
  push(snakeToCamel(columnKey));
  push(camelToSnake(columnKey));

  const lower = columnKey.toLowerCase().replace(/[-_\s]/g, "");
  const aliases =
    SORT_FIELD_ALIASES[columnKey] ?? SORT_FIELD_ALIASES[lower] ?? [];
  for (const alias of aliases) {
    push(alias);
    push(snakeToCamel(alias));
    push(camelToSnake(alias));
  }

  return keys;
}

function readRecordField(
  record: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (!(key in record)) continue;
    const value = record[key];
    if (!isEmptySortValue(value)) {
      return value;
    }
  }
  return null;
}

function composePersonName(record: Record<string, unknown>): string | null {
  const first =
    record.firstName ??
    record.first_name ??
    record.preferredName ??
    record.preferred_name;
  const middle = record.middleName ?? record.middle_name;
  const last = record.lastName ?? record.last_name;
  const parts = [first, middle, last]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .map((part) => part.trim());
  return parts.length > 0 ? parts.join(" ") : null;
}

function resolveSortValue<T>(
  item: T,
  column: Column<T> | undefined,
  columnKey: string,
): unknown {
  if (column?.sortValue) {
    return column.sortValue(item);
  }

  const record =
    typeof item === "object" && item !== null
      ? (item as Record<string, unknown>)
      : null;
  if (!record) {
    return null;
  }

  const candidateKeys = buildSortCandidateKeys(columnKey);
  const direct = readRecordField(record, candidateKeys);
  if (!isEmptySortValue(direct)) {
    // Nested relation object → use its display name when present.
    if (typeof direct === "object") {
      return readNestedRecordName(direct) ?? direct;
    }
    return direct;
  }

  const lowerKey = columnKey.toLowerCase();

  // Nested relation fields commonly used by HRMS APIs.
  const relationNeedle = lowerKey.includes("department")
    ? "department"
    : lowerKey.includes("position")
      ? "position"
      : lowerKey.includes("branch")
        ? "branch"
        : lowerKey.includes("manager")
          ? "manager"
          : null;

  if (relationNeedle) {
    const nestedKeys = [
      `primary_${relationNeedle}`,
      `primary${relationNeedle.charAt(0).toUpperCase()}${relationNeedle.slice(1)}`,
      relationNeedle,
    ];
    for (const nestedKey of nestedKeys) {
      const nestedName = readNestedRecordName(record[nestedKey]);
      if (nestedName) return nestedName;
    }
  }

  if (
    lowerKey === "name" ||
    lowerKey.endsWith("_name") ||
    lowerKey.endsWith("name")
  ) {
    const composed = composePersonName(record);
    if (composed) return composed;
  }

  // Last resort: text content from custom cell render (e.g. status chips with title).
  if (column?.render) {
    try {
      const rendered = column.render(item);
      if (typeof rendered === "string" || typeof rendered === "number") {
        return rendered;
      }
      const text = extractTextFromNode(rendered).trim();
      if (text && text !== "-" && text !== "—") {
        return text;
      }
    } catch {
      // Ignore render errors during sort.
    }
  }

  return null;
}

function normalizeComparable(
  value: unknown,
  columnKey: string,
): string | number | null {
  if (isEmptySortValue(value)) {
    return null;
  }

  const lowerKey = columnKey.toLowerCase();
  const isDateField =
    lowerKey.includes("date") ||
    lowerKey.includes("time") ||
    lowerKey.includes("hired") ||
    lowerKey.includes("joined") ||
    lowerKey === "hiredate";

  if (isDateField) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    // Numeric strings (ids, codes with leading zeros kept as strings for natural-ish compare)
    const asNumber = Number(trimmed);
    if (
      trimmed !== "" &&
      Number.isFinite(asNumber) &&
      /^-?\d+(\.\d+)?$/.test(trimmed)
    ) {
      // Prefer numeric compare for pure numbers, but keep employee codes with letters as text.
      if (!/[a-z]/i.test(trimmed)) {
        return asNumber;
      }
    }
    return trimmed.toLowerCase();
  }

  if (typeof value === "object") {
    const nestedName = readNestedRecordName(value);
    if (nestedName) {
      return nestedName.toLowerCase();
    }
  }

  return String(value).toLowerCase();
}

function isMeaningfulTableValue(value: React.ReactNode): boolean {
  if (value == null || value === false) {
    return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return (
      normalized !== "" &&
      normalized !== "-" &&
      normalized !== "—" &&
      normalized.toLowerCase() !== "null"
    );
  }

  if (typeof value === "number") {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => isMeaningfulTableValue(entry));
  }

  return React.isValidElement(value);
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areWidthMapsEqual(
  left: Record<string, number>,
  right: Record<string, number>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
}

interface ResizableTableProps<T = Record<string, unknown>> {
  title?: string;
  data?: T[];
  columns?: Column<T>[];
  // legacy support
  employees?: Employee[];
  onEmployeeSelect?: (employeeId: string) => void;
  onRowSelect?: (rowId: string, row?: T) => void;
  onColumnResize?: (columnKey: string, newWidth: number) => void;
  className?: string;
  enableAnimations?: boolean;
  getRowId?: (item: T, index: number) => string;
  itemsPerPage?: number;
  loading?: boolean;
  showCheckboxes?: boolean;
  selectedRowIds?: string[];
  onSelectedRowIdsChange?: (rowIds: string[]) => void;
  /**
   * Server-driven pagination: when `onPageChange` is set, the table does not
   * slice `data` client-side. Pass the current page (1-based), total pages,
   * and total items from the API meta so Prev/Next fetch the next server page.
   */
  page?: number;
  totalPages?: number | null;
  totalItems?: number | null;
  onPageChange?: (page: number) => void;
  /** When false, hides the table toolbar Export dropdown. Default true. */
  showExport?: boolean;
  /** When false, hides the Sort control. Default true. */
  showSort?: boolean;
  /** When false, hides the entire toolbar row. Default true. */
  showToolbar?: boolean;
  /** Content on the left side of the toolbar (e.g. titles). */
  toolbarStart?: React.ReactNode;
  /** Optional compact summary row rendered immediately above the table frame. */
  toolbarSummary?: React.ReactNode;
  /** Controls grouped inside one Filter popover. Sort is included automatically. */
  filterContent?: React.ReactNode;
  /** Number of active page filters shown on the Filter trigger. */
  filterCount?: number;
  /** Extra actions rendered before Sort/Export (e.g. filter, refresh). */
  toolbarActions?: React.ReactNode;
  /** Optional page-specific styling for the toolbar row. */
  toolbarClassName?: string;
  /** Optional page-specific styling for the bordered table frame. */
  frameClassName?: string;
  /** Purpose-built content displayed when the data source is empty. */
  emptyContent?: React.ReactNode;
  /** Use denser typography and row spacing. Defaults to the app-wide table density. */
  compact?: boolean;
  enableColumnVisibility?: boolean;
  hiddenColumnKeys?: string[];
  storageKey?: string;
  /** Render the data surface with Fluent UI table primitives. */
  fluent?: boolean;
  /** Roomier rows, muted uppercase header and rounded frame (employees section look). */
  modern?: boolean;
  /** Use a borderless Fluent icon button for the standalone Sort action. */
  sortIconOnly?: boolean;
  /** Optional destination for the standalone Sort control. */
  sortContainer?: HTMLElement | null;
}

type SortOrder = "asc" | "desc";

function buildInitialColumnWidths<T>(
  columns: Column<T>[],
  showCheckboxes: boolean,
): Record<string, number> {
  const initial: Record<string, number> = showCheckboxes
    ? { checkbox: 36 }
    : {};
  columns.forEach((col) => {
    initial[col.key] = col.defaultWidth ?? 105;
  });
  return initial;
}

function mergePersistedColumnWidths(
  base: Record<string, number>,
  storageKey: string,
): Record<string, number> {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return base;

    const parsed = JSON.parse(saved) as unknown;
    if (!parsed || typeof parsed !== "object") return base;

    const next = { ...base };
    Object.entries(parsed as Record<string, unknown>).forEach(
      ([key, value]) => {
        if (typeof value === "number" && next[key] !== undefined) {
          next[key] = Math.max(60, Math.min(500, value));
        }
      },
    );
    return next;
  } catch {
    return base;
  }
}

const MOBILE_QUERY = "(max-width: 767px)";
/** True on phone-sized screens; false during SSR and where matchMedia is missing (tests). */
function useIsMobileTable() {
  return React.useSyncExternalStore(
    (notify) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const media = window.matchMedia(MOBILE_QUERY);
      media.addEventListener?.("change", notify);
      return () => media.removeEventListener?.("change", notify);
    },
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && Boolean(window.matchMedia(MOBILE_QUERY)?.matches),
    () => false,
  );
}

export function ResizableTable<T = Record<string, unknown>>({
  title = "Item",
  data,
  columns,
  employees,
  onEmployeeSelect,
  onRowSelect,
  onColumnResize,
  className = "",
  enableAnimations = true,
  getRowId,
  itemsPerPage = 10,
  loading = false,
  showCheckboxes = false,
  selectedRowIds: controlledSelectedRowIds,
  onSelectedRowIdsChange,
  page: controlledPage,
  totalPages: controlledTotalPages,
  totalItems: controlledTotalItems,
  onPageChange,
  showExport = true,
  showSort = true,
  showToolbar = true,
  toolbarStart,
  toolbarSummary,
  filterContent,
  filterCount = 0,
  toolbarActions,
  toolbarClassName,
  frameClassName,
  emptyContent,
  compact = true,
  enableColumnVisibility = false,
  hiddenColumnKeys = [],
  storageKey,
  fluent = true,
  modern = false,
  sortIconOnly = false,
  sortContainer,
}: ResizableTableProps<T> = {}) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const selectedIds = controlledSelectedRowIds ?? internalSelectedIds;
  const [mounted, setMounted] = useState(false);
  const isMobileTable = useIsMobileTable();
  const [currentPage, setCurrentPage] = useState(1);
  const isServerPagination = typeof onPageChange === "function";
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [hiddenColumns, setHiddenColumns] =
    useState<string[]>(hiddenColumnKeys);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const overflowRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useRenderDiagnostics("ResizableTable", {
    title,
    rows: Array.isArray(data)
      ? data.length
      : Array.isArray(employees)
        ? employees.length
        : 0,
    loading,
  });

  // Normalize data
  // IMPORTANT: Always respect explicitly passed data (even empty array) so real pages
  // don't flash fake demo employees like "Sarah Chen".
  const tableData: T[] = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(employees)) return employees as unknown as T[];
    return []; // safe default - no fake demo data in production tables
  }, [data, employees]);

  // Normalize columns (auto-generate for legacy employee-like data if needed)
  const tableColumns: Column<T>[] = useMemo(() => {
    if (columns && columns.length > 0) {
      return columns;
    }
    // Legacy / auto detection
    const sample = (tableData[0] || {}) as Record<string, unknown>;
    const hasEmployeeShape = !!(
      sample.name ||
      sample.email ||
      sample.department
    );

    if (hasEmployeeShape || employees) {
      return [
        {
          key: "name",
          label: title || "Name",
          defaultWidth: 140,
          sortable: true,
        },
        { key: "email", label: "Email", defaultWidth: 160, sortable: true },
        {
          key: "department",
          label: "Department",
          defaultWidth: 100,
          sortable: true,
        },
        {
          key: "position",
          label: "Position",
          defaultWidth: 130,
          sortable: true,
        },
        {
          key: "hireDate",
          label: "Hire Date",
          defaultWidth: 85,
          sortable: true,
        },
        { key: "status", label: "Status", defaultWidth: 75, sortable: true },
      ];
    }

    // Generic fallback from first item's keys — skip internal fields to avoid "extra columns"
    const skip = new Set([
      "id",
      "_id",
      "avatar",
      "created_at",
      "updated_at",
      "createdAt",
      "updatedAt",
      "deleted_at",
      "salary",
      "base_salary",
      "compensation",
    ]);
    const keys = Object.keys(sample).filter(
      (k) => !skip.has(k) && !k.startsWith("_"),
    );
    return keys
      .filter(
        (k) => !["id", "employee_id", "user_id", "created_by"].includes(k),
      )
      .slice(0, 6)
      .map((key) => ({
        key,
        label: key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (s) => s.toUpperCase())
          .trim(),
        defaultWidth: 105,
        sortable: true,
      }));
  }, [columns, tableData, employees, title]);

  const candidateTableColumns: Column<T>[] = useMemo(() => {
    if (tableData.length === 0) {
      return tableColumns;
    }

    if (columns && columns.length > 0) {
      return tableColumns;
    }

    return tableColumns.filter((col) => {
      if (col.key === "actions") {
        return true;
      }

      return tableData.some((item) => {
        const value = col.render
          ? col.render(item)
          : (item as Record<string, unknown>)?.[col.key];
        return isMeaningfulTableValue(value as React.ReactNode);
      });
    });
  }, [columns, tableColumns, tableData]);

  const visibleTableColumns: Column<T>[] = useMemo(() => {
    if (!enableColumnVisibility || hiddenColumns.length === 0) {
      return candidateTableColumns;
    }

    const nextColumns = candidateTableColumns.filter(
      (col) => !hiddenColumns.includes(col.key),
    );
    return nextColumns.length > 0 ? nextColumns : candidateTableColumns;
  }, [candidateTableColumns, enableColumnVisibility, hiddenColumns]);

  // Column keys for widths (optional checkbox + data columns)
  const allColumnKeys = useMemo(
    () =>
      showCheckboxes
        ? ["checkbox", ...visibleTableColumns.map((c) => c.key)]
        : visibleTableColumns.map((c) => c.key),
    [showCheckboxes, visibleTableColumns],
  );

  // Column widths state - initialize from columns
  const effectiveStorageKey =
    storageKey ||
    (title
      ? `resizable-table:${title.toLowerCase().replace(/\s+/g, "-")}`
      : "resizable-table:default");
  const hiddenColumnsStorageKey = `${effectiveStorageKey}:hidden-columns`;
  const tableColumnKeys = useMemo(
    () => tableColumns.map((column) => column.key),
    [tableColumns],
  );
  const defaultHiddenColumnsKey = hiddenColumnKeys.join("|");

  useEffect(() => {
    if (!enableColumnVisibility) {
      setHiddenColumns((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    let nextHiddenColumns = hiddenColumnKeys;

    try {
      const saved = localStorage.getItem(hiddenColumnsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          const allowedKeys = new Set(tableColumnKeys);
          nextHiddenColumns = parsed.filter(
            (key): key is string =>
              typeof key === "string" && allowedKeys.has(key),
          );
        }
      }
    } catch {}

    setHiddenColumns((prev) =>
      areStringArraysEqual(prev, nextHiddenColumns) ? prev : nextHiddenColumns,
    );
  }, [
    defaultHiddenColumnsKey,
    enableColumnVisibility,
    hiddenColumnKeys,
    hiddenColumnsStorageKey,
    tableColumnKeys,
  ]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    buildInitialColumnWidths(visibleTableColumns, showCheckboxes),
  );

  // Compute display widths: start from base/persisted, then proportionally expand
  // all growable columns if their sum < available container width. This makes the
  // table fill the full width (no empty space on right), while keeping header
  // and cell sizes identical per column.
  const displayWidths = useMemo(() => {
    const res: Record<string, number> = {};
    const cbW = showCheckboxes ? columnWidths.checkbox || 36 : 0;
    res.checkbox = cbW;
    let baseSum = cbW;
    visibleTableColumns.forEach((col) => {
      const w = columnWidths[col.key] ?? col.defaultWidth ?? 105;
      res[col.key] = w;
      baseSum += w;
    });
    if (containerWidth > 0 && baseSum < containerWidth - 2) {
      const extra = containerWidth - baseSum;
      const growSum = baseSum - cbW;
      if (growSum > 0) {
        visibleTableColumns.forEach((col) => {
          const w = res[col.key];
          res[col.key] = w + extra * (w / growSum);
        });
      }
    }
    return res;
  }, [columnWidths, visibleTableColumns, containerWidth, showCheckboxes]);

  // Unified display widths for both headers and content cells (ensures they match exactly per column)
  const getColumnWidth = (col: Column<T> | string) => {
    const key = typeof col === "string" ? col : col.key;
    return (
      displayWidths[key] ??
      columnWidths[key] ??
      (typeof col === "string" ? 36 : (col.defaultWidth ?? 105))
    );
  };

  const tableContentWidth = useMemo(() => {
    const checkboxWidth = showCheckboxes
      ? (displayWidths.checkbox ?? columnWidths.checkbox ?? 36)
      : 0;
    const columnsWidth = visibleTableColumns.reduce(
      (total, column) =>
        total +
        (displayWidths[column.key] ??
          columnWidths[column.key] ??
          column.defaultWidth ??
          105),
      0,
    );
    return Math.ceil(checkboxWidth + columnsWidth);
  }, [columnWidths, displayWidths, showCheckboxes, visibleTableColumns]);

  const visibleColumnSignature = useMemo(
    () =>
      `${showCheckboxes ? "cb|" : ""}${visibleTableColumns
        .map((col) => `${col.key}:${col.defaultWidth ?? 105}`)
        .join("|")}`,
    [showCheckboxes, visibleTableColumns],
  );

  // Restore saved widths after hydration, and when the visible column set actually changes.
  useEffect(() => {
    const base = buildInitialColumnWidths(visibleTableColumns, showCheckboxes);
    const next = mergePersistedColumnWidths(base, effectiveStorageKey);
    setColumnWidths((prev) => (areWidthMapsEqual(prev, next) ? prev : next));
  }, [
    effectiveStorageKey,
    showCheckboxes,
    visibleColumnSignature,
    visibleTableColumns,
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Measure available width for filling the table. Ignore sub-pixel jitter so
  // fill-to-width + scrollbar changes cannot loop and shake the page.
  useEffect(() => {
    const el = overflowRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.round(el.clientWidth || 0);
      setContainerWidth((current) => (Math.abs(current - w) < 2 ? current : w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const getRowIdentifier = useCallback(
    (item: T, index: number): string => {
      if (getRowId) return getRowId(item, index);
      const record = item as Record<string, unknown>;
      return String(
        record?.id ??
          record?.employee_id ??
          record?.user_id ??
          record?.employeeNo ??
          record?.no ??
          record?.key ??
          index,
      );
    },
    [getRowId],
  );

  const handleSelectionToggle = (rowId: string) => {
    const next = selectedIds.includes(rowId)
      ? selectedIds.filter((id) => id !== rowId)
      : [...selectedIds, rowId];
    if (controlledSelectedRowIds === undefined) {
      setInternalSelectedIds(next);
    }
    onSelectedRowIdsChange?.(next);
  };

  const handleRowSelect = (rowId: string, item?: T) => {
    if (onRowSelect) {
      onRowSelect(rowId, item);
    }
    if (onEmployeeSelect) {
      onEmployeeSelect(rowId);
    }
  };

  const handleSelectAll = () => {
    const pageIds = paginatedData.map((item, idx) =>
      getRowIdentifier(item, idx),
    );
    const allPageRowsSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    const next = allPageRowsSelected
      ? selectedIds.filter((id) => !pageIds.includes(id))
      : [...selectedIds.filter((id) => !pageIds.includes(id)), ...pageIds];
    if (controlledSelectedRowIds === undefined) {
      setInternalSelectedIds(next);
    }
    onSelectedRowIdsChange?.(next);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setShowSortMenu(false);
    setShowFilterMenu(false);
    setCurrentPage(1);
  };

  const clearSort = () => {
    setSortField(null);
    setSortOrder("asc");
    setShowSortMenu(false);
    setShowFilterMenu(false);
    setCurrentPage(1);
  };

  const toggleColumnVisibility = (columnKey: string) => {
    if (!enableColumnVisibility) {
      return;
    }

    setHiddenColumns((prev) => {
      const isHidden = prev.includes(columnKey);
      const next = isHidden
        ? prev.filter((key) => key !== columnKey)
        : [...prev, columnKey];
      const visibleCount = candidateTableColumns.filter(
        (col) => !next.includes(col.key),
      ).length;
      if (visibleCount === 0) {
        return prev;
      }

      try {
        localStorage.setItem(hiddenColumnsStorageKey, JSON.stringify(next));
      } catch {}

      return next;
    });
  };

  const sortedData = useMemo(() => {
    if (!sortField) return tableData;

    const sortColumn = tableColumns.find((col) => col.key === sortField);

    return [...tableData].sort((a, b) => {
      const aVal = normalizeComparable(
        resolveSortValue(a, sortColumn, sortField),
        sortField,
      );
      const bVal = normalizeComparable(
        resolveSortValue(b, sortColumn, sortField),
        sortField,
      );

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      }

      const left = String(aVal);
      const right = String(bVal);
      const compared = left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortOrder === "asc" ? compared : -compared;
    });
  }, [tableData, sortField, sortOrder, tableColumns]);

  const clientPageCount =
    itemsPerPage > 0
      ? Math.max(1, Math.ceil(sortedData.length / itemsPerPage))
      : 1;

  React.useEffect(() => {
    if (isServerPagination) {
      return;
    }
    setCurrentPage((page) => {
      const next = Math.min(Math.max(1, page), clientPageCount);
      return next === page ? page : next;
    });
  }, [clientPageCount, isServerPagination, storageKey, title]);

  const activePage = isServerPagination
    ? Math.max(1, controlledPage ?? 1)
    : Math.min(Math.max(1, currentPage), clientPageCount);

  // Server pagination already supplies one page; client pagination uses live sizing.
  const paginatedData = isServerPagination
    ? sortedData
    : itemsPerPage > 0
      ? sortedData.slice(
          (activePage - 1) * itemsPerPage,
          activePage * itemsPerPage,
        )
      : [];

  const totalPages = isServerPagination
    ? Math.max(
        1,
        controlledTotalPages ??
          (controlledTotalItems != null && itemsPerPage > 0
            ? Math.ceil(controlledTotalItems / itemsPerPage)
            : 1),
      )
    : Math.ceil(sortedData.length / itemsPerPage);

  const totalCountLabel = isServerPagination
    ? (controlledTotalItems ?? sortedData.length)
    : sortedData.length;

  const goToPage = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    if (isServerPagination) {
      onPageChange?.(clamped);
      return;
    }
    setCurrentPage(clamped);
  };

  const loadingSkeletonRows = useMemo(
    () =>
      Array.from({
        length: Math.min(itemsPerPage, 6),
      }),
    [itemsPerPage],
  );

  const getStatusColor = (status: string) => {
    const normalized = String(status || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
    if (!mounted) {
      return {
        textColor: "text-emerald-500",
        dotColor: "bg-emerald-500",
      };
    }

    const statusMap: Record<string, { textColor: string; dotColor: string }> = {
      active: {
        textColor: isDark ? "text-emerald-400" : "text-emerald-600",
        dotColor: isDark ? "bg-emerald-400" : "bg-emerald-500",
      },
      inactive: {
        textColor: isDark ? "text-rose-400" : "text-rose-600",
        dotColor: isDark ? "bg-rose-400" : "bg-rose-500",
      },
      "on-leave": {
        textColor: isDark ? "text-amber-400" : "text-amber-600",
        dotColor: isDark ? "bg-amber-400" : "bg-amber-500",
      },
      onboarding: {
        textColor: isDark ? "text-sky-400" : "text-sky-600",
        dotColor: isDark ? "bg-sky-400" : "bg-sky-500",
      },
      pending: {
        textColor: isDark ? "text-amber-400" : "text-amber-600",
        dotColor: isDark ? "bg-amber-400" : "bg-amber-500",
      },
    };

    return (
      statusMap[normalized] || {
        textColor: isDark ? "text-slate-400" : "text-slate-600",
        dotColor: isDark ? "bg-slate-400" : "bg-slate-500",
      }
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return String(dateString);
    }
  };

  const handleResize = (
    columnKey: string,
    { size }: { size: { width: number } },
  ) => {
    const newDisplayW = Math.max(60, Math.min(500, size.width));
    // Compute current scale from base to map the drag delta back to intrinsic size
    const cbW = showCheckboxes ? columnWidths.checkbox || 36 : 0;
    let baseSum = cbW;
    visibleTableColumns.forEach((c) => {
      baseSum += columnWidths[c.key] ?? c.defaultWidth ?? 105;
    });
    const curScale =
      containerWidth > 0 && baseSum > 0 ? containerWidth / baseSum : 1;
    let newIntrinsic = newDisplayW;
    if (curScale > 1) {
      newIntrinsic = newDisplayW / curScale;
    }
    const clamped = Math.max(60, Math.min(500, newIntrinsic));
    setColumnWidths((prev) => {
      const next = {
        ...prev,
        [columnKey]: clamped,
      };
      // Persist the intrinsic (user's preferred) widths
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(effectiveStorageKey, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
    if (onColumnResize) {
      onColumnResize(columnKey, clamped);
    }
  };

  const getExportValue = (item: T, col: Column<T>) => {
    const record = item as Record<string, unknown>;
    if (col.render) {
      // Best effort: use raw when render is custom
      const raw = record?.[col.key];
      return raw != null ? raw : "";
    }
    const v = record?.[col.key];
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  };

  const exportToCSV = () => {
    const headers = visibleTableColumns.map((c) => c.label);
    const rows = sortedData.map((item) =>
      visibleTableColumns.map((col) => {
        const cell = getExportValue(item, col);
        return `"${String(cell).replace(/"/g, '""')}"`;
      }),
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(title || "data").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(sortedData, null, 2);
    const blob = new Blob([jsonContent], {
      type: "application/json;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(title || "data").toLowerCase()}-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
  };

  void enableAnimations;

  // Cell renderer helper
  const renderCell = (col: Column<T>, item: T) => {
    if (col.render) {
      return col.render(item);
    }
    const raw = (item as Record<string, unknown>)?.[col.key];
    const keyLower = col.key.toLowerCase();

    if (
      col.key === "status" ||
      keyLower === "status" ||
      keyLower.includes("status")
    ) {
      const statusRaw = String(raw ?? "").trim();
      const { textColor, dotColor } = getStatusColor(statusRaw || "unknown");
      const display = (statusRaw || "Unknown")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${textColor}`}
          title={display}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
          <span className="max-w-[9rem] truncate">{display}</span>
        </span>
      );
    }

    if (
      typeof raw === "number" &&
      (keyLower.includes("amount") ||
        keyLower.includes("pay") ||
        keyLower.includes("price"))
    ) {
      return (
        <span className="font-semibold text-foreground/90 text-xs">
          {formatCurrency(raw)}
        </span>
      );
    }

    if (
      raw &&
      (keyLower.includes("date") ||
        keyLower.includes("time") ||
        keyLower.includes("hired") ||
        keyLower.includes("join"))
    ) {
      return (
        <span className="text-foreground/80 text-xs">
          {formatDate(String(raw))}
        </span>
      );
    }

    if (keyLower.includes("email") && raw) {
      return (
        <a
          href={`mailto:${raw}`}
          className="text-blue-500 hover:text-blue-600 truncate text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {String(raw)}
        </a>
      );
    }

    return (
      <span className="text-foreground/80 truncate text-xs">
        {raw != null ? String(raw) : "—"}
      </span>
    );
  };

  const sortableColumns = visibleTableColumns.filter(
    (c) => c.sortable !== false,
  );

  return (
    <div className={`w-full min-w-0 max-w-full ${className}`}>
      {showToolbar ? (
        <div
          className={cn(
            "mb-2 flex min-w-0 max-w-full items-center justify-between gap-1.5",
            toolbarClassName,
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {filterContent ? (
              <Popover open={showFilterMenu} onOpenChange={setShowFilterMenu}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      appearance="outline"
                      size="small"
                      className={cn(
                        "h-8 min-h-8 shrink-0",
                        filterCount > 0 && "!border-primary/40 !text-primary",
                      )}
                    />
                  }
                  aria-label="Open filters and sorting"
                  title="Filters and sorting"
                >
                  <Filter16Regular data-icon="inline-start" />
                  <span>Filters</span>
                  {filterCount > 0 ? <Badge>{filterCount}</Badge> : null}
                  <ChevronDown16Regular data-icon="inline-end" />
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="max-h-[min(34rem,calc(100vh-8rem))] w-[min(27rem,calc(100vw-1.5rem))] overflow-y-auto p-0"
                >
                  <div className="border-b border-border bg-muted/25 px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">Refine results</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Filter the table, change its order, or choose visible columns.
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col gap-4 p-4">
                    <section className="space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Filter16Regular />
                        Filters
                      </div>
                      {filterContent}
                    </section>
                    {showSort ? (
                      <section className="space-y-2.5 border-t border-border pt-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <ArrowSort20Regular />
                          Sort by
                        </div>
                        <div className="flex items-center gap-2">
                          <Dropdown
                            aria-label="Sort table by"
                            className="min-w-0 flex-1"
                            value={
                              sortField
                                ? sortableColumns.find((column) => column.key === sortField)?.label ?? "Default view"
                                : "Default view"
                            }
                            selectedOptions={[sortField ?? "default"]}
                            onOptionSelect={(_event, data) => {
                              const value = data.optionValue;
                              if (!value || value === "default") {
                                setSortField(null);
                                setSortOrder("asc");
                              } else {
                                setSortField(value);
                              }
                              setCurrentPage(1);
                            }}
                          >
                            <Option value="default">Default view</Option>
                            {sortableColumns.map((column) => (
                              <Option key={column.key} value={column.key}>
                                {column.label}
                              </Option>
                            ))}
                          </Dropdown>
                          <Button
                            type="button"
                            appearance="outline"
                            size="small"
                            className="size-8 shrink-0 !min-w-8 !p-0"
                            aria-label={sortOrder === "asc" ? "Sort ascending" : "Sort descending"}
                            title={sortOrder === "asc" ? "Ascending" : "Descending"}
                            disabled={!sortField}
                            onClick={() => setSortOrder((order) => (order === "asc" ? "desc" : "asc"))}
                          >
                            {sortOrder === "asc" ? (
                              <ArrowSortUpLines20Regular />
                            ) : (
                              <ArrowSortDownLines20Regular />
                            )}
                          </Button>
                        </div>
                      </section>
                    ) : null}
                    {showSort && enableColumnVisibility ? (
                      <section className="space-y-2.5 border-t border-border pt-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <ColumnTriple20Regular />
                          Visible columns
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {candidateTableColumns.map((col) => {
                            const checked = !hiddenColumns.includes(col.key);
                            return (
                              <label
                                key={col.key}
                                className={cn(
                                  "flex min-w-0 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors",
                                  checked
                                    ? "border-primary/25 bg-primary/5 text-foreground"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleColumnVisibility(col.key)}
                                />
                                <span className="truncate">{col.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
            {toolbarStart}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {toolbarActions}

            {showSort && !filterContent ? (
              <SortControlPortal container={sortContainer}>
              <div className="relative">
                <Button
                  type="button"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  appearance={sortIconOnly ? "subtle" : "outline"}
                  icon={sortIconOnly ? <ArrowSort20Regular /> : undefined}
                  size="small"
                  className="!h-8 !min-h-8"
                  aria-label="Sort"
                  title="Sort"
                >
                  {!sortIconOnly ? (
                    <>
                      <ArrowSort20Regular className="size-3.5 text-primary" />
                      <span className="hidden sm:inline">Sort</span>
                    </>
                  ) : null}
                  {sortField ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold !text-white">
                      1
                    </span>
                  ) : null}
                </Button>

                {showSortMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowSortMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 w-40 bg-background border border-border/50 shadow-lg rounded-md z-20 py-0.5 max-h-72 overflow-auto text-xs">
                      <Button
                        type="button"
                        onClick={clearSort}
                        appearance={sortField === null ? "secondary" : "subtle"}
                        size="small"
                        className="w-full justify-start"
                      >
                        Default view
                      </Button>
                      {sortableColumns.length > 0 ? (
                        <>
                          <div className="my-0.5 border-t border-border/40" />
                          {sortableColumns.map((col) => (
                            <Button
                              key={col.key}
                              type="button"
                              onClick={() => handleSort(col.key)}
                              appearance={
                                sortField === col.key ? "secondary" : "subtle"
                              }
                              size="small"
                              className="w-full justify-start"
                            >
                              {col.label}{" "}
                              {sortField === col.key &&
                                `(${sortOrder === "asc" ? "↑" : "↓"})`}
                            </Button>
                          ))}
                        </>
                      ) : (
                        <div className="px-2 py-1 text-muted-foreground">
                          No sortable columns
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              </SortControlPortal>
            ) : null}

            {showExport ? (
              <div className="relative">
                <Button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  appearance="outline"
                  size="small"
                  className="!h-8 !min-h-8"
                >
                  <ArrowDownload16Regular data-icon="inline-start" />
                  <span className="hidden sm:inline">Export</span>
                  <ChevronDown16Regular data-icon="inline-end" />
                </Button>

                {showExportMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 w-28 bg-background border border-border/50 shadow-lg rounded-md z-20 text-xs">
                      <Button
                        type="button"
                        onClick={() => {
                          exportToCSV();
                          setShowExportMenu(false);
                        }}
                        appearance="subtle"
                        size="small"
                        className="w-full justify-start"
                      >
                        CSV
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          exportToJSON();
                          setShowExportMenu(false);
                        }}
                        appearance="subtle"
                        size="small"
                        className="w-full justify-start"
                      >
                        JSON
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {toolbarSummary ? (
        <div className="mb-2 flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-1 pb-1.5 text-[10px] text-muted-foreground">
          {toolbarSummary}
        </div>
      ) : null}

      {isMobileTable ? (
        <ul aria-label={`${title} list`} className="flex flex-col gap-2">
          {paginatedData.map((item, index) => {
            const rowId = getRowIdentifier(item, index);
            const isSelected = selectedIds.includes(rowId);
            const actionCols = visibleTableColumns.filter((col) => col.key === "actions" || col.key === "act");
            const dataCols = visibleTableColumns.filter((col) => col.key !== "actions" && col.key !== "act");
            const [primary, ...rest] = dataCols;
            return (
              <li
                key={rowId}
                className={cn(
                  "cursor-pointer rounded-xl border border-border bg-background p-3 shadow-sm transition-colors active:bg-muted/40",
                  isSelected && "border-primary/50 bg-primary/5",
                )}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a,button,input,[role='menuitem'],[data-slot='popover-trigger'],[data-slot='dropdown-menu-trigger']")) return;
                  handleRowSelect(rowId, item);
                }}
              >
                <div className="flex items-start gap-2">
                  {showCheckboxes ? (
                    <input
                      type="checkbox"
                      aria-label={`${isSelected ? "Deselect" : "Select"} ${title.toLowerCase()} row ${index + 1}`}
                      className="mt-1 size-4 shrink-0 cursor-pointer"
                      checked={isSelected}
                      onChange={() => handleSelectionToggle(rowId)}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                    {primary ? renderCell(primary, item) : null}
                  </div>
                </div>
                {rest.length ? (
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    {rest.map((col) => (
                      <div key={col.key} className="min-w-0">
                        <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{col.label}</dt>
                        <dd className="mt-0.5 min-w-0 break-words text-foreground">{renderCell(col, item)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {actionCols.length ? (
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-2">
                    {actionCols.map((col) => <React.Fragment key={col.key}>{renderCell(col, item)}</React.Fragment>)}
                  </div>
                ) : null}
              </li>
            );
          })}
          {loading && paginatedData.length === 0 ? (
            <li className="rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">Loading…</li>
          ) : null}
          {!loading && paginatedData.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No {title.toLowerCase()} records found.</li>
          ) : null}
        </ul>
      ) : null}

      <div
        className={cn(
          "relative max-w-full overflow-hidden border border-border bg-background shadow-sm",
          modern && "rounded-xl",
          frameClassName,
          isMobileTable && "hidden",
        )}
      >
        {fluent ? (
          <div
            className="max-w-full overflow-x-auto overflow-y-clip overscroll-x-contain"
            ref={overflowRef}
          >
            <Table
              sortable
              aria-label={`${title} table`}
              className="min-w-full"
              style={{
                minWidth: Math.max(tableContentWidth, 640),
                width: "100%",
              }}
            >
              <TableHeader>
                <TableRow>
                  {showCheckboxes ? (
                    <TableHeaderCell
                      className={cn(
                        compact &&
                          "!h-8 !px-2 !py-1 !text-[10px] !font-semibold uppercase tracking-[0.08em]",
                          modern && "!h-10 !bg-muted/50 !px-3",
                      )}
                      style={{ width: getColumnWidth("checkbox") || 36 }}
                    >
                      <FluentCheckbox
                        aria-label={`Select all ${title.toLowerCase()} on this page`}
                        checked={
                          paginatedData.length > 0 &&
                          paginatedData.every((item, index) =>
                            selectedIds.includes(getRowIdentifier(item, index)),
                          )
                        }
                        onChange={() => handleSelectAll()}
                      />
                    </TableHeaderCell>
                  ) : null}

                  {visibleTableColumns.map((col) => {
                    const isActions =
                      col.key === "actions" || col.key === "act";
                    const canSort = !isActions && col.sortable !== false;
                    const isActiveSort = sortField === col.key;
                    return (
                      <TableHeaderCell
                        key={col.key}
                        className={cn(
                          isActions && "text-right",
                          compact &&
                            "!h-8 !px-2 !py-1 !text-[10px] !font-semibold uppercase tracking-[0.08em]",
                          modern && "!h-10 !bg-muted/50 !px-3 !text-[11px] !text-muted-foreground",
                        )}
                        style={{ width: getColumnWidth(col) }}
                        sortDirection={
                          isActiveSort
                            ? sortOrder === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                        onClick={
                          canSort ? () => handleSort(col.key) : undefined
                        }
                      >
                        {col.label}
                      </TableHeaderCell>
                    );
                  })}
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedData.map((item, index) => {
                  const rowId = getRowIdentifier(item, index);
                  const isSelected = selectedIds.includes(rowId);
                  return (
                    <TableRow
                      key={rowId}
                      className={cn(
                        "cursor-pointer",
                        compact && "!h-9",
                        modern && "!h-12",
                        isSelected && "bg-muted/30",
                      )}
                      onClick={() => handleRowSelect(rowId, item)}
                    >
                      {showCheckboxes ? (
                        <TableCell
                          className={cn(
                            compact &&
                              "!h-9 !px-2 !py-1 !text-[11px] !leading-4",
                              modern && "!h-12 !px-3 !text-[13px] !leading-5",
                          )}
                          style={{ width: getColumnWidth("checkbox") || 36 }}
                        >
                          <FluentCheckbox
                            aria-label={`${isSelected ? "Deselect" : "Select"} ${title.toLowerCase()} row ${index + 1}`}
                            checked={isSelected}
                            onChange={(event) => {
                              event.stopPropagation();
                              handleSelectionToggle(rowId);
                            }}
                          />
                        </TableCell>
                      ) : null}

                      {visibleTableColumns.map((col) => {
                        const isActions =
                          col.key === "actions" || col.key === "act";
                        return (
                          <TableCell
                            key={col.key}
                            className={cn(
                              "min-w-0",
                              compact &&
                                "!h-9 !px-2 !py-1 !text-[11px] !leading-4",
                              modern && "!h-12 !px-3 !text-[13px] !leading-5",
                              isActions && "overflow-visible text-right",
                            )}
                            style={{ width: getColumnWidth(col) }}
                            onClick={(event) => {
                              if (
                                (event.target as HTMLElement).closest(
                                  "a,button,[data-slot='popover-trigger'],[data-slot='dropdown-menu-trigger']",
                                )
                              ) {
                                event.stopPropagation();
                              }
                            }}
                          >
                            {renderCell(col, item)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}

                {loading && tableData.length === 0 ? (
                  loadingSkeletonRows.map((_, index) => (
                    <TableRow key={`skeleton-row-${index}`}>
                      {showCheckboxes ? (
                        <TableCell
                          className={cn(compact && "!h-9 !px-2 !py-1")}
                          style={{ width: getColumnWidth("checkbox") || 36 }}
                        >
                          <div className="h-4 animate-pulse rounded bg-muted/70" />
                        </TableCell>
                      ) : null}
                      {visibleTableColumns.map((column) => (
                        <TableCell
                          key={`${column.key}-${index}`}
                          className={cn(compact && "!h-9 !px-2 !py-1")}
                          style={{ width: getColumnWidth(column) }}
                        >
                          <div className="h-4 animate-pulse rounded bg-muted/70" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={
                        visibleTableColumns.length + (showCheckboxes ? 1 : 0)
                      }
                      className="py-4 text-center text-xs text-muted-foreground"
                    >
                      {emptyContent ?? "No records found."}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div
            className="max-w-full overflow-x-auto overflow-y-clip overscroll-x-contain"
            ref={overflowRef}
          >
            <div
              className="min-w-full align-top"
              style={{
                width: tableContentWidth > 0 ? tableContentWidth : undefined,
              }}
            >
              {/* Header */}
              <div
                className={cn(
                  "flex w-full border-b border-border bg-muted/5 py-1 text-base font-bold text-foreground",
                  compact &&
                    "min-h-9 bg-muted/20 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                )}
              >
                {showCheckboxes && (
                  <div
                    className="flex items-center justify-center border-r border-border pr-1.5 flex-shrink-0"
                    style={{ width: getColumnWidth("checkbox") || 36 }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select all ${title.toLowerCase()} on this page`}
                      className="w-4 h-4 rounded border-border/40 cursor-pointer"
                      style={
                        mounted
                          ? {
                              accentColor: isDark
                                ? "rgb(113, 113, 122)"
                                : "rgb(161, 161, 170)",
                            }
                          : {}
                      }
                      checked={
                        paginatedData.length > 0 &&
                        paginatedData.every((item, index) =>
                          selectedIds.includes(getRowIdentifier(item, index)),
                        )
                      }
                      onChange={handleSelectAll}
                    />
                  </div>
                )}

                {visibleTableColumns.map((col) => {
                  const isActions = col.key === "actions" || col.key === "act";
                  const canSort = !isActions && col.sortable !== false;
                  const isActiveSort = sortField === col.key;
                  return (
                    <Resizable
                      key={col.key}
                      width={getColumnWidth(col)}
                      height={0}
                      onResize={(e, data) => handleResize(col.key, data)}
                      minConstraints={[isActions ? 44 : 60, 0]}
                      maxConstraints={[isActions ? 280 : 500, 0]}
                      handle={
                        <div className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize bg-transparent hover:bg-primary/40 transition-all" />
                      }
                    >
                      <div
                        className={cn(
                          "relative flex flex-shrink-0 items-center border-r border-border px-1.5",
                          compact ? "text-[11px]" : "text-base",
                          isActions
                            ? "justify-end overflow-visible"
                            : "overflow-hidden",
                          canSort &&
                            "cursor-pointer select-none hover:text-foreground",
                        )}
                        style={{ width: getColumnWidth(col) }}
                        onClick={
                          canSort ? () => handleSort(col.key) : undefined
                        }
                        onKeyDown={
                          canSort
                            ? (event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  handleSort(col.key);
                                }
                              }
                            : undefined
                        }
                        role={canSort ? "button" : undefined}
                        tabIndex={canSort ? 0 : undefined}
                        title={canSort ? `Sort by ${col.label}` : undefined}
                      >
                        <span className="truncate">{col.label}</span>
                        {isActiveSort ? (
                          <span
                            className="ml-1 shrink-0 text-[10px] text-primary"
                            aria-hidden
                          >
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        ) : null}
                      </div>
                    </Resizable>
                  );
                })}
              </div>

              {/* Rows */}
              <div className="overflow-hidden">
                {paginatedData.map((item, index) => {
                  const rowId = getRowIdentifier(item, index);
                  const isSelected = selectedIds.includes(rowId);

                  return (
                    <div
                      key={rowId}
                      className={cn(
                        "group relative flex w-full cursor-pointer border-b border-border",
                        compact ? "min-h-11 py-0.5" : "py-1",
                        isSelected
                          ? "bg-muted/30"
                          : index % 2 === 1
                            ? "bg-primary/[0.08] hover:bg-primary/[0.13]"
                            : "bg-background hover:bg-muted/20",
                      )}
                      onClick={() => handleRowSelect(rowId, item)}
                    >
                      {/* Checkbox */}
                      {showCheckboxes && (
                        <div
                          className="flex items-center justify-center border-r border-border pr-1.5 flex-shrink-0"
                          style={{ width: getColumnWidth("checkbox") || 36 }}
                        >
                          <input
                            type="checkbox"
                            aria-label={`${isSelected ? "Deselect" : "Select"} ${title.toLowerCase()} row ${index + 1}`}
                            className="w-4 h-4 rounded border-border/40 cursor-pointer"
                            style={
                              mounted
                                ? {
                                    accentColor: isDark
                                      ? "rgb(113, 113, 122)"
                                      : "rgb(161, 161, 170)",
                                  }
                                : {}
                            }
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectionToggle(rowId);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}

                      {/* Data columns */}
                      {visibleTableColumns.map((col) => {
                        const isActions =
                          col.key === "actions" || col.key === "act";
                        return (
                          <div
                            key={col.key}
                            className={cn(
                              "flex min-w-0 flex-shrink-0 items-center border-r border-border px-1.5 text-xs",
                              isActions
                                ? "justify-end overflow-visible"
                                : "overflow-hidden",
                            )}
                            style={{ width: getColumnWidth(col) }}
                            onClick={(e) => {
                              // allow inner links/buttons to work
                              if (
                                (e.target as HTMLElement).closest(
                                  "a,button,[data-slot='popover-trigger'],[data-slot='dropdown-menu-trigger']",
                                )
                              ) {
                                e.stopPropagation();
                              }
                            }}
                          >
                            {renderCell(col, item)}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {loading && tableData.length === 0 ? (
                  <div className="border-b border-border">
                    {loadingSkeletonRows.map((_, index) => (
                      <div
                        key={`skeleton-row-${index}`}
                        className={cn(
                          "flex w-full border-b border-border/60 px-1.5 py-2 last:border-b-0",
                          index % 2 === 1
                            ? "bg-primary/[0.08]"
                            : "bg-background",
                        )}
                      >
                        {allColumnKeys.map((columnKey) => (
                          <div
                            key={`${columnKey}-${index}`}
                            className="flex-shrink-0 px-1.5"
                            style={{
                              width:
                                columnKey === "checkbox"
                                  ? getColumnWidth("checkbox") || 36
                                  : getColumnWidth(columnKey),
                            }}
                          >
                            <div className="h-4 animate-pulse rounded bg-muted/70" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : sortedData.length === 0 ? (
                  <div className="border-b border-border py-4 text-center text-xs text-muted-foreground">
                    {emptyContent ?? "No records found."}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-1 flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2 px-1 text-xs">
          <div className="min-w-0 text-muted-foreground/70">
            Page {activePage} of {totalPages} • {totalCountLabel}{" "}
            {title.toLowerCase()}
            {totalCountLabel === 1 ? "" : "s"}
          </div>

          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              onClick={() => goToPage(activePage - 1)}
              disabled={activePage === 1 || loading}
              appearance="outline"
              size="small"
            >
              Prev
            </Button>
            <Button
              type="button"
              onClick={() => goToPage(activePage + 1)}
              disabled={activePage === totalPages || loading}
              appearance="outline"
              size="small"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
