'use client';

import { cn } from './cn';
import type { Tone } from './StatusBadge';

export type StatItem = { key: string; label: string; count: number | string; tone?: Tone };

/** Clickable counters that double as a status filter. */
export function StatCards({ items, value, onChange, label = 'Filter by status' }: {
  items: StatItem[];
  value?: string;
  onChange?: (key: string) => void;
  label?: string;
}) {
  return (
    <div className="v2-stats" role="group" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={cn('v2-seg', it.tone && `v2-tone-${it.tone}`)}
          aria-pressed={value === it.key}
          onClick={() => onChange?.(it.key)}
        >
          <b>{it.count}</b>
          <span>
            {it.tone && <i />}
            {it.label}
          </span>
        </button>
      ))}
    </div>
  );
}
