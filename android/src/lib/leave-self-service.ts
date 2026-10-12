type LeaveRecord = Record<string, unknown>;

export type LeaveStatusKey = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'other';

function asRecord(value: unknown): LeaveRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as LeaveRecord) : null;
}

export function readNumberish(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function formatDayValue(value: unknown): string {
  const numeric = readNumberish(value);
  if (numeric === null) return '—';
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

export function findBalanceAvailableDays(row: LeaveRecord | null): number | null {
  if (!row) return null;
  return readNumberish(
    row.available_days ??
      row.availableDays ??
      row.available ??
      row.remaining_days ??
      row.remainingDays ??
      row.remaining ??
      row.balance ??
      row.current_balance ??
      row.currentBalance
  );
}

export function readLeaveTypeId(row: LeaveRecord | null): number | null {
  if (!row) return null;
  const nested =
    asRecord(row.leave_type) ?? asRecord(row.leaveType) ?? asRecord(row.type) ?? asRecord(row.leave);
  return (
    readNumberish(row.leave_type_id ?? row.leaveTypeId ?? row.type_id ?? row.typeId) ??
    readNumberish(nested?.id ?? nested?.leave_type_id ?? nested?.leaveTypeId)
  );
}

export function countInclusiveLeaveDays(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const startTime = new Date(`${startDate}T00:00:00Z`).getTime();
  const endTime = new Date(`${endDate}T00:00:00Z`).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) return null;
  return Math.floor((endTime - startTime) / 86_400_000) + 1;
}

export function readRequestedLeaveDays(row: LeaveRecord | null): number | null {
  if (!row) return null;
  const explicit = readNumberish(
    row.days ?? row.total_days ?? row.totalDays ?? row.number_of_days ?? row.numberOfDays ?? row.duration_days
  );
  if (explicit !== null) return explicit;
  const start = typeof row.start_date === 'string' ? row.start_date : '';
  const end = typeof row.end_date === 'string' ? row.end_date : '';
  return countInclusiveLeaveDays(start, end);
}

function balanceSubmissionError(availableDays: number | null) {
  const normalized = availableDays !== null ? availableDays.toFixed(2) : null;
  if (normalized !== null && Number(normalized) < 0) {
    return `This leave type is already overdrawn (${normalized} day(s) available). New submitted requests are blocked until HR adjusts the balance or the leave policy allows negative balances.`;
  }
  if (normalized !== null) {
    return `This request exceeds the available balance for the selected leave type (${normalized} day(s) left).`;
  }
  return 'This request exceeds the available balance for the selected leave type.';
}

export function validateLeaveSubmissionBalance({
  availableDays,
  requestedDays,
}: {
  availableDays: number | null;
  requestedDays: number | null;
}): string | null {
  if (availableDays === null) return null;
  if (availableDays < 0) return balanceSubmissionError(availableDays);
  if (requestedDays !== null && requestedDays > availableDays) return balanceSubmissionError(availableDays);
  return null;
}

export function formatLeaveRequestError(error: unknown, availableDays: number | null) {
  const fallback = error instanceof Error ? error.message : 'Failed to submit leave request.';
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (!/insufficient leave balance/i.test(message)) return fallback;
  const parsed = message.match(/available:\s*(-?\d+(?:\.\d+)?)\s*day/i);
  const parsedDays = parsed ? Number(parsed[1]) : availableDays;
  const normalized = Number.isFinite(parsedDays) ? Number(parsedDays) : availableDays;
  return balanceSubmissionError(normalized ?? null);
}

export function resolveLeaveStatus(value: unknown): { key: LeaveStatusKey; label: string } {
  const raw = typeof value === 'string' ? value.trim() : '';
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'draft') return { key: 'draft', label: 'Draft' };
  if (['pending', 'submitted', 'in_review', 'under_review'].includes(normalized)) {
    return { key: 'pending', label: raw.replace(/_/g, ' ') || 'Pending' };
  }
  if (normalized === 'approved' || normalized === 'completed') {
    return { key: 'approved', label: normalized === 'completed' ? 'Completed' : 'Approved' };
  }
  if (normalized === 'rejected') return { key: 'rejected', label: 'Rejected' };
  if (normalized === 'cancelled' || normalized === 'canceled') return { key: 'cancelled', label: 'Cancelled' };
  return { key: 'other', label: raw.replace(/_/g, ' ') || 'Pending' };
}

export function unwrapCreatedLeave(payload: unknown): LeaveRecord | null {
  const root = asRecord(payload);
  if (!root) return null;
  const data = asRecord(root.data);
  const candidates = [
    data,
    asRecord(root.result),
    asRecord(root.item),
    asRecord(root.leave_request),
    asRecord(root.leaveRequest),
    asRecord(data?.leave_request),
    asRecord(data?.leaveRequest),
    asRecord(data?.data),
    root,
  ];
  return (
    candidates.find((record) => {
      if (!record) return false;
      return ['id', 'leave_request_id', 'leaveRequestId', 'status'].some((key) => {
        const candidate = record[key];
        return (
          (typeof candidate === 'number' && Number.isFinite(candidate)) ||
          (typeof candidate === 'string' && candidate.trim().length > 0)
        );
      });
    }) ?? root
  );
}

export function readBalanceNumber(row: LeaveRecord | null, keys: string[]): number | null {
  if (!row) return null;
  for (const key of keys) {
    const value = readNumberish(row[key]);
    if (value !== null) return value;
  }
  return null;
}

export function readTotalsNumber(totals: LeaveRecord | null, keys: string[]): number | null {
  return readBalanceNumber(totals, keys);
}

export function sumBalanceField(rows: LeaveRecord[], keys: string[]): number | null {
  let total = 0;
  let found = false;
  for (const row of rows) {
    const value = readBalanceNumber(row, keys);
    if (value === null) continue;
    total += value;
    found = true;
  }
  return found ? total : null;
}
