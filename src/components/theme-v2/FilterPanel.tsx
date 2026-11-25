import type { ReactNode } from 'react';
import { Button } from './Button';

/** Collapsible row of filter fields. Wrap each control in <FilterField>. */
export function FilterPanel({ open, onReset, children }: { open: boolean; onReset?: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="v2-filters">
      {children}
      {onReset && <Button onClick={onReset}>Clear filters</Button>}
    </div>
  );
}
