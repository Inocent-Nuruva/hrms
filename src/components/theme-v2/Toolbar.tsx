'use client';

import type { ReactNode } from 'react';
import { Button, IconButton } from './Button';
import { Icon } from './icons';
import { Select } from './Select';

type SortOption = { value: string; label: string };

type Props = {
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;

  filtersOpen?: boolean;
  onToggleFilters?: () => void;
  activeFilters?: number;

  perPage?: number;
  perPageOptions?: number[];
  onPerPage?: (n: number) => void;

  /** Sort dropdown shown on phones, where column headers are hidden. */
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;

  onRefresh?: () => void;
  /** Extra controls placed before "Rows". */
  children?: ReactNode;
};

export function Toolbar({
  search, onSearch, searchPlaceholder = 'Search…',
  filtersOpen, onToggleFilters, activeFilters = 0,
  perPage, perPageOptions = [10, 25, 50, 100], onPerPage,
  sortOptions, sortValue, onSortChange,
  onRefresh, children,
}: Props) {
  return (
    <div className="v2-toolbar">
      {onSearch && (
        <label className="v2-tsearch">
          <Icon name="search" size={16} />
          <input type="search" value={search ?? ''} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
        </label>
      )}
      {onToggleFilters && (
        <Button icon={<Icon name="filter" size={15} />} active={filtersOpen || activeFilters > 0} badge={activeFilters || undefined} onClick={onToggleFilters} aria-expanded={filtersOpen}>
          Filters
        </Button>
      )}
      {sortOptions && onSortChange && (
        <label className="v2-lbl v2-sort-sm">
          Sort
          <Select value={sortValue} onChange={(e) => onSortChange(e.target.value)}>
            {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </label>
      )}
      <div className="v2-spacer v2-hide-sm" />
      {children}
      {perPage != null && onPerPage && (
        <label className="v2-lbl">
          <span className="v2-lbl-t">Rows</span>
          <Select value={perPage} onChange={(e) => onPerPage(Number(e.target.value))} aria-label="Rows per page">
            {perPageOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </label>
      )}
      {onRefresh && (
        <IconButton label="Reload" className="v2-hide-sm" onClick={onRefresh}>
          <Icon name="refresh" size={17} />
        </IconButton>
      )}
    </div>
  );
}
