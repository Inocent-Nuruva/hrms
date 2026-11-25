import Link from 'next/link';
import type { ReactNode } from 'react';

export type Crumb = { label: string; href?: string };

export function PageHeader({ title, crumbs, description, actions }: {
  title: ReactNode;
  crumbs?: Crumb[];
  description?: ReactNode;
  /** Buttons on the right, e.g. date picker and Export. */
  actions?: ReactNode;
}) {
  return (
    <div className="v2-pagehead">
      <div>
        {crumbs?.length ? (
          <nav className="v2-crumb" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && ' / '}
                {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
              </span>
            ))}
          </nav>
        ) : null}
        <h1>{title}</h1>
        {description && <p className="v2-desc">{description}</p>}
      </div>
      {actions && <div className="v2-head-actions">{actions}</div>}
    </div>
  );
}
