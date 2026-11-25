'use client';

import { Icon } from './icons';

function pageList(page: number, pages: number): Array<number | '…'> {
  const out: Array<number | '…'> = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
}

export function Pagination({ page, perPage, total, onChange, label = 'records' }: {
  page: number;
  perPage: number;
  total: number;
  onChange: (page: number) => void;
  /** Noun used in "Showing 1–25 of 132 people". */
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const start = total ? (page - 1) * perPage + 1 : 0;
  const end = Math.min(page * perPage, total);

  return (
    <div className="v2-pager">
      <div className="v2-pager-info">
        Showing <b>{start}–{end}</b> of <b>{total}</b> {label}
      </div>
      <nav className="v2-pages" aria-label="Pagination">
        <button type="button" className="v2-pg v2-pg--arrow" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <Icon name="left" size={16} />
        </button>
        {pageList(page, pages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="v2-pg v2-muted">…</span>
          ) : (
            <button key={p} type="button" className="v2-pg" aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>
              {p}
            </button>
          ),
        )}
        <span className="v2-pg-mini">Page {page} of {pages}</span>
        <button type="button" className="v2-pg v2-pg--arrow" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <Icon name="right" size={16} />
        </button>
      </nav>
    </div>
  );
}
