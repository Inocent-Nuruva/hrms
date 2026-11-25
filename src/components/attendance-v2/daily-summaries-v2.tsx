'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Button,
  DataTable,
  EmployeeCell,
  FilterField,
  FilterPanel,
  Icon,
  PageHeader,
  Pagination,
  Select,
  ShiftTimeline,
  StatCards,
  StatusBadge,
  Toolbar,
  formatDuration,
  toMinutes,
  type Column,
  type Tone,
} from '@/components/theme-v2';
import { toast } from '@/components/ui/fluent-toast-store';
import { useDailySummaries, type DailySummaryRow } from './use-daily-summaries';

const STATUS_ORDER = ['PRESENT', 'LATE', 'EARLY_DEPARTURE', 'LATE_AND_EARLY_DEPARTURE', 'ABSENT', 'LEAVE'];

function statusTone(status: string): Tone {
  if (status === 'PRESENT' || status === 'OVERTIME' || status === 'OFF_DAY_PRESENT') return 'ok';
  if (status.includes('LATE')) return 'late';
  if (status === 'EARLY_DEPARTURE' || status === 'HALF_DAY' || status === 'MANUAL_CORRECTION') return 'warn';
  if (status === 'ABSENT') return 'bad';
  if (status.includes('LEAVE') || status === 'HOLIDAY' || status === 'BUSINESS_TRIP' || status === 'OFFICIAL_DUTY') return 'info';
  return 'neutral';
}
const statusLabel = (status: string) =>
  status ? status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '—';

/** Current time in minutes, client only (avoids a hydration mismatch). */
function useNowMinutes() {
  const [m, setM] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setM(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return m;
}

function ExportMenu({ busy, onExport }: { busy: boolean; onExport: (format: 'pdf' | 'xlsx' | 'csv') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div className="v2-pop-wrap" ref={ref}>
      <Button variant="primary" icon={<Icon name="dl" size={16} />} disabled={busy} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {busy ? 'Preparing…' : 'Export'}
      </Button>
      {open ? (
        <div className="v2-pop" role="menu">
          {([['pdf', 'PDF'], ['xlsx', 'Excel'], ['csv', 'CSV']] as const).map(([format, label]) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              className="v2-pop-item"
              onClick={() => {
                setOpen(false);
                onExport(format);
              }}
            >
              <span>{label}, full day</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function DailySummariesV2() {
  const ds = useDailySummaries();
  const now = useNowMinutes();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const isToday = ds.filters.date === todayKey;
  const liveNow = isToday ? now : null;

  const worked = (r: DailySummaryRow) => {
    if (r.workedMinutes != null) return r.workedMinutes;
    const i = toMinutes(r.checkInTime);
    const o = toMinutes(r.checkOutTime) ?? liveNow;
    return i == null || o == null ? null : Math.max(0, o - i);
  };
  const outCell = (r: DailySummaryRow) =>
    r.checkOutTime ? (
      r.checkOutTime
    ) : r.checkInTime && isToday ? (
      <span className="v2-live">Still in</span>
    ) : (
      <span className="v2-muted">—</span>
    );
  const timeline = (r: DailySummaryRow, showScale = false) => (
    <ShiftTimeline
      checkIn={r.checkInTime}
      checkOut={r.checkOutTime}
      shiftStart={r.shiftStart ?? '08:00'}
      shiftEnd={r.shiftEnd ?? '17:00'}
      now={liveNow}
      tone={statusTone(r.attendanceStatus)}
      showScale={showScale}
    />
  );

  const counterKeys = [
    ...STATUS_ORDER,
    ...Object.keys(ds.counts?.counts ?? {}).filter((key) => !STATUS_ORDER.includes(key)).sort(),
  ].filter((key) => (ds.counts?.counts[key] ?? 0) > 0 || STATUS_ORDER.slice(0, 5).includes(key));

  const columns: Column<DailySummaryRow>[] = [
    {
      key: 'name',
      header: 'Employee',
      cell: (r) => <EmployeeCell name={r.employeeName} meta={r.employeeNo || undefined} />,
    },
    { key: 'branch', header: 'Branch', hideBelow: 'md', cell: (r) => r.branchName || <span className="v2-muted">—</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusBadge tone={statusTone(r.attendanceStatus)}>{statusLabel(r.attendanceStatus)}</StatusBadge>,
    },
    { key: 'in', header: 'Check in', numeric: true, cell: (r) => r.checkInTime ?? <span className="v2-muted">—</span> },
    { key: 'out', header: 'Check out', numeric: true, cell: outCell },
    { key: 'worked', header: 'Worked', numeric: true, hideBelow: 'lg', cell: (r) => formatDuration(worked(r)) },
    { key: 'shift', header: 'Shift', hideBelow: 'lg', cell: (r) => timeline(r) },
  ];

  const prettyDate = new Date(`${ds.filters.date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Attendance operations' }, { label: 'Daily summaries' }]}
        title="Daily summaries"
        actions={
          <>
            <label className="v2-btn" title={prettyDate}>
              <Icon name="cal" size={16} />
              <input
                type="date"
                value={ds.filters.date}
                max={todayKey}
                aria-label="Attendance date"
                onChange={(e) => e.target.value && ds.updateFilters({ date: e.target.value })}
                style={{ border: 0, background: 'transparent', color: 'inherit', font: 'inherit', outline: 0 }}
              />
            </label>
            <ExportMenu
              busy={ds.exporting}
              onExport={(format) => {
                void ds.exportReport(format).catch((err: unknown) =>
                  toast.error(err instanceof Error ? err.message : 'Could not prepare the report.'),
                );
              }}
            />
          </>
        }
      />

      <StatCards
        value={ds.filters.status}
        onChange={(key) => ds.updateFilters({ status: key === ds.filters.status ? '' : key })}
        items={[
          { key: '', label: 'All', count: ds.counts?.total ?? ds.total },
          ...counterKeys.map((key) => ({
            key,
            label: statusLabel(key),
            tone: statusTone(key),
            count: ds.counts?.counts[key] ?? 0,
          })),
        ]}
      />

      <Toolbar
        search={ds.filters.search}
        onSearch={(value) => ds.updateFilters({ search: value })}
        searchPlaceholder="Search name or employee number"
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        activeFilters={ds.filters.branchId ? 1 : 0}
        perPage={ds.perPage}
        perPageOptions={[25, 50, 100, 200]}
        onPerPage={ds.setPerPage}
        onRefresh={ds.reload}
      />

      <FilterPanel open={filtersOpen} onReset={() => ds.updateFilters({ branchId: '' })}>
        <FilterField label="Branch">
          <Select value={ds.filters.branchId} onChange={(e) => ds.updateFilters({ branchId: e.target.value })}>
            <option value="">All branches</option>
            {ds.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterPanel>

      {ds.error ? (
        <div className="v2-empty" role="alert">
          <b>Could not load daily summaries</b>
          {ds.error}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={ds.rows}
        getRowId={(r) => r.id}
        loading={ds.loading}
        renderCard={(r) => (
          <>
            <div className="v2-pc-top">
              <EmployeeCell name={r.employeeName} meta={[r.employeeNo, r.branchName].filter(Boolean).join(', ')} />
              <StatusBadge tone={statusTone(r.attendanceStatus)}>{statusLabel(r.attendanceStatus)}</StatusBadge>
            </div>
            <div className="v2-pc-stats">
              <div><span>Check in</span><b>{r.checkInTime ?? '—'}</b></div>
              <div><span>Check out</span><b>{outCell(r)}</b></div>
              <div><span>Worked</span><b>{formatDuration(worked(r))}</b></div>
            </div>
            {timeline(r, true)}
          </>
        )}
        empty={
          <div className="v2-empty">
            <b>No one matches these filters</b>
            Try another name or date, or clear the filters.
          </div>
        }
        footer={
          <Pagination page={ds.page} perPage={ds.perPage} total={ds.total} onChange={ds.setPage} label="people" />
        }
      />
    </>
  );
}
