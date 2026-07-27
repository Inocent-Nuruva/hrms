"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence, type Variants } from "framer-motion";
import { Download, ChevronDown } from "lucide-react";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";
import React from "react";
import { useTheme } from "@/components/theme-provider";
import { useRenderDiagnostics } from "@/hooks/use-render-diagnostics";
import { cn } from "@/lib/utils";

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
}

function isMeaningfulTableValue(value: React.ReactNode): boolean {
  if (value == null || value === false) {
    return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized !== "" && normalized !== "-" && normalized !== "—" && normalized.toLowerCase() !== "null";
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
  /** When false, hides the table toolbar Export dropdown. Default true. */
  showExport?: boolean;
  /** When false, hides the Sort control. Default true. */
  showSort?: boolean;
  /** When false, hides the entire toolbar row. Default true. */
  showToolbar?: boolean;
  /** Content on the left side of the toolbar (e.g. titles). */
  toolbarStart?: React.ReactNode;
  /** Extra actions rendered before Sort/Export (e.g. filter, refresh). */
  toolbarActions?: React.ReactNode;
  enableColumnVisibility?: boolean;
  hiddenColumnKeys?: string[];
  storageKey?: string;
}

type SortOrder = "asc" | "desc";

function buildInitialColumnWidths<T>(columns: Column<T>[], showCheckboxes: boolean): Record<string, number> {
  const initial: Record<string, number> = showCheckboxes ? { checkbox: 36 } : {};
  columns.forEach((col) => {
    initial[col.key] = col.defaultWidth ?? 105;
  });
  return initial;
}

function mergePersistedColumnWidths(base: Record<string, number>, storageKey: string): Record<string, number> {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return base;

    const parsed = JSON.parse(saved) as unknown;
    if (!parsed || typeof parsed !== "object") return base;

    const next = { ...base };
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === "number" && next[key] !== undefined) {
        next[key] = Math.max(60, Math.min(500, value));
      }
    });
    return next;
  } catch {
    return base;
  }
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
  showExport = true,
  showSort = true,
  showToolbar = true,
  toolbarStart,
  toolbarActions,
  enableColumnVisibility = false,
  hiddenColumnKeys = [],
  storageKey
}: ResizableTableProps<T> = {}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(hiddenColumnKeys);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const overflowRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const shouldReduceMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useRenderDiagnostics("ResizableTable", {
    title,
    rows: Array.isArray(data) ? data.length : Array.isArray(employees) ? employees.length : 0,
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
    const hasEmployeeShape = !!(sample.name || sample.email || sample.department);

    if (hasEmployeeShape || employees) {
      return [
        { key: "name", label: title || "Name", defaultWidth: 140, sortable: true },
        { key: "email", label: "Email", defaultWidth: 160, sortable: true },
        { key: "department", label: "Department", defaultWidth: 100, sortable: true },
        { key: "position", label: "Position", defaultWidth: 130, sortable: true },
        { key: "hireDate", label: "Hire Date", defaultWidth: 85, sortable: true },
        { key: "status", label: "Status", defaultWidth: 75, sortable: true },
      ];
    }

    // Generic fallback from first item's keys — skip internal fields to avoid "extra columns"
    const skip = new Set(["id", "_id", "avatar", "created_at", "updated_at", "createdAt", "updatedAt", "deleted_at", "salary", "base_salary", "compensation"]);
    const keys = Object.keys(sample).filter((k) => !skip.has(k) && !k.startsWith("_"));
    return keys.filter(k => !['id','employee_id','user_id','created_by'].includes(k)).slice(0, 6).map((key) => ({
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
        const value = col.render ? col.render(item) : (item as Record<string, unknown>)?.[col.key];
        return isMeaningfulTableValue(value as React.ReactNode);
      });
    });
  }, [columns, tableColumns, tableData]);

  const visibleTableColumns: Column<T>[] = useMemo(() => {
    if (!enableColumnVisibility || hiddenColumns.length === 0) {
      return candidateTableColumns;
    }

    const nextColumns = candidateTableColumns.filter((col) => !hiddenColumns.includes(col.key));
    return nextColumns.length > 0 ? nextColumns : candidateTableColumns;
  }, [candidateTableColumns, enableColumnVisibility, hiddenColumns]);

  // Column keys for widths (optional checkbox + data columns)
  const allColumnKeys = useMemo(
    () =>
      showCheckboxes
        ? ["checkbox", ...visibleTableColumns.map((c) => c.key)]
        : visibleTableColumns.map((c) => c.key),
    [showCheckboxes, visibleTableColumns]
  );

  // Column widths state - initialize from columns
  const effectiveStorageKey = storageKey || (title ? `resizable-table:${title.toLowerCase().replace(/\s+/g, '-')}` : 'resizable-table:default');
  const hiddenColumnsStorageKey = `${effectiveStorageKey}:hidden-columns`;
  const tableColumnKeys = useMemo(() => tableColumns.map((column) => column.key), [tableColumns]);
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
            (key): key is string => typeof key === "string" && allowedKeys.has(key)
          );
        }
      }
    } catch {}

    setHiddenColumns((prev) => (areStringArraysEqual(prev, nextHiddenColumns) ? prev : nextHiddenColumns));
  }, [defaultHiddenColumnsKey, enableColumnVisibility, hiddenColumnKeys, hiddenColumnsStorageKey, tableColumnKeys]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    buildInitialColumnWidths(visibleTableColumns, showCheckboxes)
  );

  // Compute display widths: start from base/persisted, then proportionally expand
  // all growable columns if their sum < available container width. This makes the
  // table fill the full width (no empty space on right), while keeping header
  // and cell sizes identical per column.
  const displayWidths = useMemo(() => {
    const res: Record<string, number> = {};
    const cbW = showCheckboxes ? (columnWidths.checkbox || 36) : 0;
    res.checkbox = cbW;
    let baseSum = cbW;
    visibleTableColumns.forEach((col) => {
      const w = columnWidths[col.key] ?? col.defaultWidth ?? 105;
      res[col.key] = w;
      baseSum += w;
    });
    if (containerWidth > 0 && baseSum < containerWidth) {
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
    const key = typeof col === 'string' ? col : col.key;
    return displayWidths[key] ?? columnWidths[key] ?? (typeof col === 'string' ? 36 : col.defaultWidth ?? 105);
  };

  // Reset widths if columns definition changes significantly
  useEffect(() => {
    setColumnWidths((prev) => {
      const next: Record<string, number> = showCheckboxes ? { checkbox: prev.checkbox || 36 } : {};
      visibleTableColumns.forEach((col) => {
        next[col.key] = prev[col.key] ?? col.defaultWidth ?? 105;
      });
      return next;
    });
  }, [visibleTableColumns, showCheckboxes]);

  // Restore saved widths after hydration so SSR and the first client render match.
  useEffect(() => {
    const base = buildInitialColumnWidths(visibleTableColumns, showCheckboxes);
    setColumnWidths(mergePersistedColumnWidths(base, effectiveStorageKey));
  }, [effectiveStorageKey, visibleTableColumns, showCheckboxes]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Measure available width for filling the table
  useEffect(() => {
    const el = overflowRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 0;
      setContainerWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const getRowIdentifier = (item: T, index: number): string => {
    if (getRowId) return getRowId(item, index);
    const record = item as Record<string, unknown>;
    return String(
      record?.id ?? record?.employee_id ?? record?.user_id ?? record?.employeeNo ?? record?.no ?? record?.key ?? index
    );
  };

  const handleRowSelect = (rowId: string, item?: T) => {
    setSelectedIds((prev) => {
      if (prev.includes(rowId)) {
        return prev.filter((id) => id !== rowId);
      } else {
        return [...prev, rowId];
      }
    });
    if (onRowSelect) {
      onRowSelect(rowId, item);
    }
    if (onEmployeeSelect) {
      onEmployeeSelect(rowId);
    }
  };

  const handleSelectAll = () => {
    const pageIds = paginatedData.map((item, idx) => getRowIdentifier(item, idx));
    if (selectedIds.length === pageIds.length && pageIds.length > 0) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const others = prev.filter((id) => !pageIds.includes(id));
        return [...others, ...pageIds];
      });
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setShowSortMenu(false);
    setCurrentPage(1);
  };

  const clearSort = () => {
    setSortField(null);
    setSortOrder("asc");
    setShowSortMenu(false);
    setCurrentPage(1);
  };

  const toggleColumnVisibility = (columnKey: string) => {
    if (!enableColumnVisibility) {
      return;
    }

    setHiddenColumns((prev) => {
      const isHidden = prev.includes(columnKey);
      const next = isHidden ? prev.filter((key) => key !== columnKey) : [...prev, columnKey];
      const visibleCount = candidateTableColumns.filter((col) => !next.includes(col.key)).length;
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

    return [...tableData].sort((a, b) => {
      const recordA = a as Record<string, unknown>;
      const recordB = b as Record<string, unknown>;
      let aVal: unknown = recordA?.[sortField];
      let bVal: unknown = recordB?.[sortField];

      const lowerField = sortField.toLowerCase();
      if (lowerField.includes("date") || lowerField.includes("time") || lowerField === "hiredate") {
        aVal = aVal ? new Date(aVal as string | number | Date).getTime() : 0;
        bVal = bVal ? new Date(bVal as string | number | Date).getTime() : 0;
      } else if (typeof aVal === "string" && typeof bVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const left = aVal as string | number;
      const right = bVal as string | number;
      if (left < right) return sortOrder === "asc" ? -1 : 1;
      if (left > right) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [tableData, sortField, sortOrder]);

  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIdx, startIdx + itemsPerPage);
    // itemsPerPage intentionally omitted: including it breaks the React Compiler's
    // preserve-manual-memoization check (see react-hooks/preserve-manual-memoization).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const loadingSkeletonRows = useMemo(
    () =>
      Array.from({
        length: Math.min(itemsPerPage, 6),
      }),
    [itemsPerPage]
  );

  const getStatusColor = (status: string) => {
    const normalized = String(status || "").toLowerCase().replace(/\s+/g, "-");
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

  const handleResize = (columnKey: string, { size }: { size: { width: number } }) => {
    const newDisplayW = Math.max(60, Math.min(500, size.width));
    // Compute current scale from base to map the drag delta back to intrinsic size
    const cbW = showCheckboxes ? (columnWidths.checkbox || 36) : 0;
    let baseSum = cbW;
    visibleTableColumns.forEach((c) => {
      baseSum += columnWidths[c.key] ?? c.defaultWidth ?? 105;
    });
    const curScale = (containerWidth > 0 && baseSum > 0) ? (containerWidth / baseSum) : 1;
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
      if (typeof window !== 'undefined') {
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
      })
    );

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(title || "data").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(sortedData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(title || "data").toLowerCase()}-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
  };

  const shouldAnimate = enableAnimations && !shouldReduceMotion;

  const containerVariants: Variants = {
    visible: {
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.05,
      },
    },
  };

  const rowVariants: Variants = {
    hidden: { opacity: 0, y: 12, scale: 0.985, filter: "blur(3px)" },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: { type: "spring", stiffness: 420, damping: 26, mass: 0.65 },
    },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  };

  // Cell renderer helper
  const renderCell = (col: Column<T>, item: T) => {
    if (col.render) {
      return col.render(item);
    }
    const raw = (item as Record<string, unknown>)?.[col.key];
    const keyLower = col.key.toLowerCase();

    if (col.key === "status" || keyLower === "status" || keyLower.includes("status")) {
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

    if (typeof raw === "number" && (keyLower.includes("amount") || keyLower.includes("pay") || keyLower.includes("price"))) {
      return <span className="font-semibold text-foreground/90 text-xs">{formatCurrency(raw)}</span>;
    }

    if (raw && (keyLower.includes("date") || keyLower.includes("time") || keyLower.includes("hired") || keyLower.includes("join"))) {
      return <span className="text-foreground/80 text-xs">{formatDate(String(raw))}</span>;
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

    return <span className="text-foreground/80 truncate text-xs">{raw != null ? String(raw) : "—"}</span>;
  };

  const sortableColumns = visibleTableColumns.filter((c) => c.sortable !== false);

  const toolbarButtonClass =
    "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground transition hover:bg-muted";

  return (
    <div className={`w-full ${className}`}>
      {showToolbar ? (
        <div className="mb-2 flex flex-nowrap items-center justify-between gap-2">
          <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
            {toolbarStart}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {toolbarActions}

            {enableColumnVisibility ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColumnsMenu(!showColumnsMenu)}
                  className={toolbarButtonClass}
                >
                  Columns
                  {hiddenColumns.length > 0 ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold !text-white">
                      {hiddenColumns.length}
                    </span>
                  ) : null}
                  <ChevronDown size={12} className="opacity-50" />
                </button>

                {showColumnsMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowColumnsMenu(false)} />
                    <div className="absolute right-0 mt-1 w-48 bg-background border border-border/50 shadow-lg rounded-md z-20 py-1 max-h-80 overflow-auto text-xs">
                      {candidateTableColumns.map((col) => {
                        const checked = !hiddenColumns.includes(col.key);
                        return (
                          <label
                            key={col.key}
                            className="flex cursor-pointer items-center gap-2 px-2 py-1 hover:bg-muted/50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-border/40"
                              checked={checked}
                              onChange={() => toggleColumnVisibility(col.key)}
                            />
                            <span className="truncate">{col.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {showSort ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className={toolbarButtonClass}
                  aria-label="Sort"
                  title="Sort"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-primary">
                    <path d="M3 6L6 3L9 6M6 3V13M13 10L10 13L7 10M10 13V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="hidden sm:inline">Sort</span>
                  {sortField ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold !text-white">
                      1
                    </span>
                  ) : null}
                </button>

                {showSortMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                    <div className="absolute right-0 mt-1 w-40 bg-background border border-border/50 shadow-lg rounded-md z-20 py-0.5 max-h-72 overflow-auto text-xs">
                      <button
                        type="button"
                        onClick={clearSort}
                        className={`w-full px-2 py-1 text-left hover:bg-muted/50 transition-colors ${sortField === null ? "bg-muted/30" : ""}`}
                      >
                        Default view
                      </button>
                      {sortableColumns.length > 0 ? (
                        <>
                          <div className="my-0.5 border-t border-border/40" />
                          {sortableColumns.map((col) => (
                            <button
                              key={col.key}
                              type="button"
                              onClick={() => handleSort(col.key)}
                              className={`w-full px-2 py-1 text-left hover:bg-muted/50 transition-colors ${sortField === col.key ? "bg-muted/30" : ""}`}
                            >
                              {col.label} {sortField === col.key && `(${sortOrder === "asc" ? "↑" : "↓"})`}
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-2 py-1 text-muted-foreground">No sortable columns</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {showExport ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className={toolbarButtonClass}
                >
                  <Download size={12} />
                  <span className="hidden sm:inline">Export</span>
                  <ChevronDown size={12} className="opacity-50" />
                </button>

                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 mt-1 w-28 bg-background border border-border/50 shadow-lg rounded-md z-20 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          exportToCSV();
                          setShowExportMenu(false);
                        }}
                        className="w-full px-2 py-1 text-left hover:bg-muted/50 transition-colors"
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          exportToJSON();
                          setShowExportMenu(false);
                        }}
                        className="w-full px-2 py-1 text-left hover:bg-muted/50 transition-colors border-t border-border/30"
                      >
                        JSON
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="bg-background border border-border/50 overflow-hidden rounded-lg relative">
        <div className="overflow-x-auto" ref={overflowRef}>
          <div className="min-w-full align-top" style={{ minWidth: containerWidth ? `${containerWidth}px` : undefined }}>
            {/* Header */}
            <div className="flex py-1 text-base font-semibold text-muted-foreground/70 bg-muted/5 border-b border-border w-full">
              {showCheckboxes && (
                <div className="flex items-center justify-center border-r border-border pr-1.5 flex-shrink-0" style={{ width: getColumnWidth('checkbox') || 36 }}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border/40 cursor-pointer"
                    style={mounted ? { accentColor: isDark ? "rgb(113, 113, 122)" : "rgb(161, 161, 170)" } : {}}
                    checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length}
                    onChange={handleSelectAll}
                  />
                </div>
              )}

              {visibleTableColumns.map((col) => {
                const isActions = col.key === "actions" || col.key === "act"
                return (
                <Resizable
                  key={col.key}
                  width={getColumnWidth(col)}
                  height={0}
                  onResize={(e, data) => handleResize(col.key, data)}
                  minConstraints={[isActions ? 44 : 60, 0]}
                  maxConstraints={[isActions ? 280 : 500, 0]}
                  handle={<div className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize bg-transparent hover:bg-primary/40 transition-all" />}
                >
                  <div
                    className={cn(
                      "relative flex flex-shrink-0 items-center border-r border-border px-1.5 text-base",
                      isActions ? "justify-end overflow-visible" : "overflow-hidden"
                    )}
                    style={{ width: getColumnWidth(col) }}
                  >
                    <span className="truncate">{col.label}</span>
                  </div>
                </Resizable>
                )
              })}
            </div>

            {/* Rows */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`page-${currentPage}`}
                variants={shouldAnimate ? containerVariants : undefined}
                initial={shouldAnimate ? "hidden" : false}
                animate="visible"
              >
                {paginatedData.map((item, index) => {
                  const rowId = getRowIdentifier(item, index);
                  const isSelected = selectedIds.includes(rowId);

                  return (
                    <motion.div key={rowId} variants={shouldAnimate ? rowVariants : undefined}>
                      <div
                        className={`py-1 group relative transition-all duration-150 border-b border-border flex cursor-pointer w-full ${
                          isSelected ? "bg-muted/30" : "bg-muted/5 hover:bg-muted/20"
                        }`}
                        onClick={() => handleRowSelect(rowId, item)}
                      >
                        {/* Checkbox */}
                        {showCheckboxes && (
                          <div className="flex items-center justify-center border-r border-border pr-1.5 flex-shrink-0" style={{ width: getColumnWidth('checkbox') || 36 }}>
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-border/40 cursor-pointer"
                              style={mounted ? { accentColor: isDark ? "rgb(113, 113, 122)" : "rgb(161, 161, 170)" } : {}}
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleRowSelect(rowId, item);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}

                        {/* Data columns */}
                        {visibleTableColumns.map((col) => {
                          const isActions = col.key === "actions" || col.key === "act"
                          return (
                          <div
                            key={col.key}
                            className={cn(
                              "flex min-w-0 flex-shrink-0 items-center border-r border-border px-1.5 text-xs",
                              isActions
                                ? "justify-end overflow-visible"
                                : "overflow-hidden"
                            )}
                            style={{ width: getColumnWidth(col) }}
                            onClick={(e) => {
                              // allow inner links/buttons to work
                              if ((e.target as HTMLElement).closest("a,button,[data-slot='popover-trigger'],[data-slot='dropdown-menu-trigger']")) {
                                e.stopPropagation();
                              }
                            }}
                          >
                            {renderCell(col, item)}
                          </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  );
                })}

                {loading && tableData.length === 0 ? (
                  <div className="border-b border-border">
                    {loadingSkeletonRows.map((_, index) => (
                      <div
                        key={`skeleton-row-${index}`}
                        className="flex w-full border-b border-border/60 px-1.5 py-2 last:border-b-0"
                      >
                        {allColumnKeys.map((columnKey) => (
                          <div
                            key={`${columnKey}-${index}`}
                            className="flex-shrink-0 px-1.5"
                            style={{ width: columnKey === "checkbox" ? getColumnWidth("checkbox") || 36 : getColumnWidth(columnKey) }}
                          >
                            <div className="h-4 animate-pulse rounded bg-muted/70" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : paginatedData.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground border-b border-border">
                    No records found.
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-1 flex items-center justify-between px-1 text-xs">
          <div className="text-muted-foreground/70">
            Page {currentPage} of {totalPages} • {sortedData.length} {title.toLowerCase()}s
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-1.5 py-0.5 bg-background border border-border/50 text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded text-xs"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-1.5 py-0.5 bg-background border border-border/50 text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded text-xs"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
