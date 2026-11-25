import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...rest },
  ref,
) {
  return <select ref={ref} className={cn('v2-select', className)} {...rest} />;
});

/** Label + control, used inside <FilterPanel>. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="v2-field">
      {label}
      {children}
    </label>
  );
}
