/** "08:13", "08:13:00", "2026-11-24T08:13:00" or minutes → minutes since midnight. */
export function toMinutes(value?: string | number | null): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const m = /(\d{1,2}):(\d{2})/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 493 → "08:13" */
export function formatTime(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 515 → "8h 35m" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
