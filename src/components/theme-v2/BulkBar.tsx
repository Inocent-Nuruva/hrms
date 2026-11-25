import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './icons';

/** Appears when rows are selected. Put action <Button>s inside. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children?: ReactNode }) {
  if (count <= 0) return null;
  return (
    <div className="v2-bulk" role="region" aria-label="Bulk actions">
      <Icon name="check" size={16} />
      {count} selected
      <span className="v2-spacer" />
      {children}
      <Button onClick={onClear} aria-label="Clear selection">
        <Icon name="x" size={15} />
      </Button>
    </div>
  );
}
