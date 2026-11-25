'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type SubTab = { label: string; href: string; count?: number };

/** Horizontal page tabs. Put it first inside the page so it sits flush under the top bar. */
export function SubTabs({ items }: { items: SubTab[] }) {
  const pathname = usePathname() ?? '';
  const active = items
    .filter((t) => pathname === t.href || pathname.startsWith(t.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="v2-subtabs" aria-label="Sections">
      {items.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === active ? 'page' : undefined}>
          {t.label}
          {!!t.count && <span className="v2-count">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
