'use client';

import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './icons';
import type { SortState } from './useTableState';

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right';
  /** Use tabular numbers (times, money, counts). */
  numeric?: boolean;
  /** Hide when the content area is narrow: 'lg' ≤ 1000px, 'md' ≤ 760px. */
  hideBelow?: 'lg' | 'md';
  width?: number | string;
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;

  sort?: SortState;
  onSort?: (key: string) => void;

  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;

  /** Last column (e.g. a ⋯ menu). */
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;

  /** Phone layout. When given, rows become cards on narrow screens. */
  renderCard?: (row: T, ctx: { selected: boolean; toggle: () => void }) => ReactNode;

  loading?: boolean;
  empty?: ReactNode;
  /** Rendered at the bottom of the card, usually <Pagination>. */
  footer?: ReactNode;
  caption?: string;
};

export function DataTable<T>({
  columns, rows, getRowId, sort, onSort,
  selectable, selected = new Set(), onSelectedChange,
  rowActions, onRowClick, renderCard, loading, empty, footer, caption,
}: Props<T>) {
  const ids = rows.map(getRowId);
  const onPage = ids.filter((id) => selected.has(id)).length;
  const allOnPage = ids.length > 0 && onPage === ids.length;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectedChange?.(next);
  };
  const toggleAll = () => {
    const next = new Set(selected);
    ids.forEach((id) => (allOnPage ? next.delete(id) : next.add(id)));
    onSelectedChange?.(next);
  };

  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
  const hideCls = (c: Column<T>) => c.hideBelow && `v2-hide-${c.hideBelow}`;
  const emptyNode = empty ?? (
    <div className="v2-empty"><b>Nothing to show</b>Try another search or clear the filters.</div>
  );

  return (
    <div className={cn('v2-tcard', renderCard && 'v2-tcard--cards')}>
      <div className="v2-tscroll">
        <table className="v2-table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {selectable && (
                <th className="v2-col-chk">
                  <input
                    type="checkbox"
                    className="v2-check"
                    checked={allOnPage}
                    ref={(el) => { if (el) el.indeterminate = onPage > 0 && !allOnPage; }}
                    onChange={toggleAll}
                    aria-label="Select all on this page"
                  />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn(hideCls(c), c.align === 'right' && 'v2-right', c.className)}
                    style={c.width != null ? { width: c.width } : undefined}
                    aria-sort={c.sortable ? (active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                  >
                    {c.sortable && onSort ? (
                      <button type="button" className="v2-th" onClick={() => onSort(c.key)}>
                        {c.header}
                        <span className="v2-arrow"><Icon name="arrow" size={13} /></span>
                      </button>
                    ) : (
                      <span className="v2-th-plain">{c.header}</span>
                    )}
                  </th>
                );
              })}
              {rowActions && <th className="v2-col-act"><span className="v2-th-plain">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk-${i}`}>
                    {Array.from({ length: colCount }, (_, j) => (
                      <td key={j}><div className="v2-skel" style={{ width: j === 0 && selectable ? 16 : `${50 + ((i + j) % 4) * 12}%` }} /></td>
                    ))}
                  </tr>
                ))
              : rows.length === 0
                ? <tr><td colSpan={colCount}>{emptyNode}</td></tr>
                : rows.map((r) => {
                    const id = getRowId(r);
                    const isSel = selected.has(id);
                    return (
                      <tr
                        key={id}
                        className={cn(isSel && 'is-selected', onRowClick && 'is-clickable')}
                        onClick={onRowClick ? (e) => {
                          if ((e.target as HTMLElement).closest('button,a,input,select,label')) return;
                          onRowClick(r);
                        } : undefined}
                      >
                        {selectable && (
                          <td className="v2-col-chk">
                            <input type="checkbox" className="v2-check" checked={isSel} onChange={() => toggle(id)} aria-label="Select row" />
                          </td>
                        )}
                        {columns.map((c) => (
                          <td key={c.key} className={cn(hideCls(c), c.align === 'right' && 'v2-right', c.numeric && 'v2-numcol', c.className)}>
                            {c.cell(r)}
                          </td>
                        ))}
                        {rowActions && <td className="v2-col-act">{rowActions(r)}</td>}
                      </tr>
                    );
                  })}
          </tbody>
        </table>
      </div>

      {renderCard && (
        <div className="v2-cards">
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="v2-pc"><div className="v2-skel" style={{ width: '60%' }} /><div className="v2-skel" /></div>
              ))
            : rows.length === 0
              ? emptyNode
              : rows.map((r) => {
                  const id = getRowId(r);
                  const isSel = selected.has(id);
                  return (
                    <article key={id} className={cn('v2-pc', isSel && 'is-selected')} onClick={onRowClick ? (e) => {
                      if ((e.target as HTMLElement).closest('button,a,input,select,label')) return;
                      onRowClick(r);
                    } : undefined}>
                      {renderCard(r, { selected: isSel, toggle: () => toggle(id) })}
                    </article>
                  );
                })}
        </div>
      )}

      {footer}
    </div>
  );
}
