import type { ReactNode } from 'react';

export type Tone = 'ok' | 'bad' | 'warn' | 'late' | 'info' | 'neutral';

export function StatusBadge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`v2-badge v2-tone-${tone}`}>{children}</span>;
}
