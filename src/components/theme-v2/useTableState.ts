'use client';

import { useCallback, useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';
export type SortState = { key: string; dir: SortDir } | null;
type SortValue = string | number | null | undefined;

type Options<T> = {
  rows: T[];
  getId: (row: T) => string;
  /** Return true when the row matches the (lower-cased) search text. Keep it stable (define outside the component or useCallback). */
  search?: (row: T, query: string) => boolean;
  /** Extra filter, e.g. selected status. */
  filter?: (row: T) => boolean;
  /** How to read the sort value for each sortable column key. */
  sorters?: Record<string, (row: T) => SortValue>;
  initialSort?: SortState;
  initialPerPage?: number;
};

/**
 * Client-side search, filter, sort, pagination and selection for <DataTable>.
 * For server-side paging, skip this hook and pass your API's page/total straight to the components.
 */
export function useTableState<T>({ rows, getId, search, filter, sorters, initialSort = null, initialPerPage = 25 }: Options<T>) {
  const [query, setQueryState] = useState('');
  const [sort, setSort] = useState<SortState>(initialSort);
  const [page, setPage] = useState(1);
  const [perPage, setPerPageState] = useState(initialPerPage);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!q || !search || search(r, q)) && (!filter || filter(r)));
  }, [rows, query, search, filter]);

  const sorted = useMemo(() => {
    const get = sort && sorters?.[sort.key];
    if (!sort || !get) return filtered;
    return [...filtered].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const v = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : Number(x) - Number(y);
      return sort.dir === 'asc' ? v : -v;
    });
  }, [filtered, sort, sorters]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => sorted.slice((safePage - 1) * perPage, safePage * perPage), [sorted, safePage, perPage]);

  const setQuery = useCallback((q: string) => { setQueryState(q); setPage(1); }, []);
  const setPerPage = useCallback((n: number) => { setPerPageState(n); setPage(1); }, []);
  const toggleSort = useCallback((key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }, []);

  return {
    query, setQuery,
    sort, setSort, toggleSort,
    page: safePage, setPage, pageCount,
    perPage, setPerPage,
    total: sorted.length,
    rows: sorted,
    pageRows,
    selected, setSelected,
    getId,
  };
}
