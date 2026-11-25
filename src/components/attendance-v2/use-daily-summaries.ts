'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  downloadAttendanceReport,
  getAttendanceDailySummaryStatusCounts,
  listAttendanceDailySummariesPage,
  listBranches,
  type AdminRecord,
  type AttendanceQueryParams,
} from '@/lib/admin-api';
import { readStoredSessionTokens } from '@/lib/session-client';

/** One daily summary, flattened for Theme 2 tables. */
export type DailySummaryRow = {
  id: string;
  employeeId: number | null;
  employeeNo: string;
  employeeName: string;
  branchName: string;
  attendanceDate: string;
  attendanceStatus: string;
  /** Local "HH:MM", or null. */
  checkInTime: string | null;
  checkOutTime: string | null;
  workedMinutes: number | null;
  lateMinutes: number | null;
  shiftName: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  raw: AdminRecord;
};

export type DailySummaryFilters = {
  date: string;
  search: string;
  branchId: string;
  status: string;
};

export type Branch = { id: string; name: string };

const str = (value: unknown): string | null => {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
};
const num = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const pick = (record: AdminRecord | null | undefined, keys: string[]) => {
  if (!record) return null;
  for (const key of keys) {
    const value = str(record[key]);
    if (value) return value;
  }
  return null;
};
const nested = (record: AdminRecord, key: string) => {
  const value = record[key];
  return value && typeof value === 'object' ? (value as AdminRecord) : null;
};

/** ISO timestamp → local "HH:MM"; "08:13[:00]" passes through. */
function toLocalClock(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{1,2}:\d{2}/.test(value)) return value.slice(0, 5).padStart(5, '0');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function mapDailySummary(row: AdminRecord, branchNames: Map<string, string>): DailySummaryRow {
  const employee = nested(row, 'employee');
  const shift = nested(row, 'shift') ?? nested(row, 'timetable');
  const fullName =
    pick(row, ['employee_name', 'employeeName', 'full_name', 'fullName']) ??
    ([pick(employee, ['first_name', 'firstName']), pick(employee, ['middle_name', 'middleName']), pick(employee, ['last_name', 'lastName'])]
      .filter(Boolean)
      .join(' ') || null);
  const employeeNo = pick(row, ['employee_no', 'employeeNo']) ?? pick(employee, ['employee_no', 'employeeNo']) ?? '';
  const branchId = pick(row, ['branch_id', 'branchId']) ?? pick(employee, ['primary_branch_id', 'primaryBranchId']);
  return {
    id: String(row.id ?? `${row.employee_id ?? row.employeeId}-${row.attendance_date ?? row.attendanceDate}`),
    employeeId: num(row.employee_id ?? row.employeeId ?? employee?.id),
    employeeNo,
    employeeName: fullName ?? (employeeNo || 'Unknown employee'),
    branchName: pick(row, ['branch_name', 'branchName']) ?? (branchId ? branchNames.get(branchId) ?? '' : ''),
    attendanceDate: pick(row, ['attendance_date', 'attendanceDate', 'date']) ?? '',
    attendanceStatus: (pick(row, ['attendance_status', 'attendanceStatus', 'status']) ?? '').toUpperCase(),
    checkInTime: toLocalClock(pick(row, ['check_in_at', 'checkInAt', 'check_in_time', 'checkInTime', 'first_punch_at'])),
    checkOutTime: toLocalClock(pick(row, ['check_out_at', 'checkOutAt', 'check_out_time', 'checkOutTime', 'last_punch_at'])),
    workedMinutes: num(row.worked_minutes ?? row.workedMinutes ?? row.work_minutes ?? row.workMinutes),
    lateMinutes: num(row.late_minutes ?? row.lateMinutes),
    shiftName: pick(shift, ['name', 'code']),
    shiftStart: toLocalClock(pick(shift, ['start_time', 'startTime'])),
    shiftEnd: toLocalClock(pick(shift, ['end_time', 'endTime'])),
    raw: row,
  };
}

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Daily summaries for one day, paged on the server, with whole-day status
 * counts from /daily-summaries/status-counts and the PDF/Excel/CSV report.
 */
export function useDailySummaries() {
  const [filters, setFilters] = useState<DailySummaryFilters>(() => ({
    date: todayInput(),
    search: '',
    branchId: '',
    status: '',
  }));
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [rows, setRows] = useState<DailySummaryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<{ total: number; counts: Record<string, number> } | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const branchNamesRef = useRef(new Map<string, string>());

  // Debounce typing in the search box.
  const [search, setSearch] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(filters.search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [filters.search]);

  useEffect(() => {
    const token = readStoredSessionTokens().accessToken;
    if (!token) return;
    void listBranches(token, { page: 1, limit: 200 })
      .then((result) => {
        const list = result.rows
          .map((row) => ({ id: String(row.id ?? ''), name: String(row.name ?? row.branch_name ?? '') }))
          .filter((branch) => branch.id && branch.name)
          .sort((a, b) => a.name.localeCompare(b.name));
        branchNamesRef.current = new Map(list.map((branch) => [branch.id, branch.name]));
        setBranches(list);
      })
      .catch(() => undefined);
  }, []);

  const queryParams = useCallback(
    (): AttendanceQueryParams => ({
      from_date: filters.date,
      to_date: filters.date,
      search: search || undefined,
      branch_id: filters.branchId ? Number(filters.branchId) : undefined,
      status: filters.status || undefined,
    }),
    [filters.branchId, filters.date, filters.status, search],
  );

  useEffect(() => {
    const token = readStoredSessionTokens().accessToken;
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    const params = queryParams();
    void Promise.all([
      listAttendanceDailySummariesPage(token, { ...params, page, limit: perPage }),
      getAttendanceDailySummaryStatusCounts(token, params).catch(() => null),
    ])
      .then(([result, statusCounts]) => {
        if (!alive) return;
        setRows(result.rows.map((row) => mapDailySummary(row, branchNamesRef.current)));
        setTotal(result.total ?? result.rows.length);
        setCounts(statusCounts);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : 'Could not load daily summaries.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, perPage, queryParams, reloadKey, branches]);

  const updateFilters = useCallback((patch: Partial<DailySummaryFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const exportReport = useCallback(
    async (format: 'pdf' | 'xlsx' | 'csv') => {
      const token = readStoredSessionTokens().accessToken;
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      setExporting(true);
      try {
        const { blob, filename } = await downloadAttendanceReport(token, {
          ...queryParams(),
          include_all_employees: true,
          format,
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } finally {
        setExporting(false);
      }
    },
    [queryParams],
  );

  return {
    filters,
    updateFilters,
    page,
    setPage,
    perPage,
    setPerPage: (n: number) => {
      setPerPage(n);
      setPage(1);
    },
    rows,
    total,
    counts,
    branches,
    loading,
    error,
    exporting,
    exportReport,
    reload: () => setReloadKey((k) => k + 1),
  };
}
