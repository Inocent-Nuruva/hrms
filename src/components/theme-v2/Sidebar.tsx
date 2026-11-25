'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './icons';

export type NavChild = { label: string; href: string; count?: number };
export type NavItem = {
  label: string;
  href?: string;
  /** Pass your existing icon component here to keep your icon style. */
  icon?: ReactNode;
  count?: number;
  /** Shows a pin on hover (favourites). */
  pinned?: boolean;
  children?: NavChild[];
};
export type NavSection = { title: string; items: NavItem[]; action?: ReactNode };
export type Brand = { name: string; subtitle?: string; logo?: ReactNode };

type Props = {
  brand: Brand;
  sections: NavSection[];
  footer?: NavItem[];
  onToggle: () => void;
  rail: boolean;
  onExpandRail: () => void;
  onNavigate?: () => void;
};

export function Sidebar({ brand, sections, footer, onToggle, rail, onExpandRail, onNavigate }: Props) {
  const pathname = usePathname() ?? '';

  // The current page is the longest href that matches the URL.
  const activeHref = useMemo(() => {
    const all: string[] = [];
    [...sections.flatMap((s) => s.items), ...(footer ?? [])].forEach((i) => {
      if (i.href) all.push(i.href);
      i.children?.forEach((c) => all.push(c.href));
    });
    return all
      .filter((h) => pathname === h || pathname.startsWith(h + '/'))
      .sort((a, b) => b.length - a.length)[0];
  }, [pathname, sections, footer]);

  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    sections.forEach((s) => s.items.forEach((i) => {
      if (i.children?.some((c) => c.href === activeHref)) o[i.label] = true;
    }));
    return o;
  });
  const [find, setFind] = useState('');
  const q = find.trim().toLowerCase();

  const renderItem = (item: NavItem) => {
    const kidsAll = item.children ?? [];
    const hasKids = kidsAll.length > 0;
    const headHit = !q || item.label.toLowerCase().includes(q);
    const kids = hasKids ? kidsAll.filter((c) => headHit || c.label.toLowerCase().includes(q)) : [];
    if (q && !headHit && kids.length === 0) return null;

    const expanded = q ? kids.length > 0 : !!open[item.label];
    const selfActive = !hasKids && !!item.href && item.href === activeHref;
    const childActive = hasKids && kidsAll.some((c) => c.href === activeHref);
    const cls = cn('v2-sb-item', selfActive && 'is-active', childActive && 'is-parent');
    const icon = item.icon ?? <Icon name="form" size={19} />;
    const tail = (
      <>
        {!!item.count && <span className="v2-sb-count">{item.count}</span>}
        {item.pinned && <span className="v2-sb-pin" title="Pinned to favourites"><Icon name="pushpin" size={15} /></span>}
        {hasKids && <span className="v2-sb-chev"><Icon name="down" size={15} /></span>}
      </>
    );

    return (
      <div className="v2-sb-node" key={item.label}>
        {hasKids ? (
          <button
            type="button"
            className={cls}
            title={item.label}
            aria-expanded={expanded}
            onClick={() => {
              if (rail) { onExpandRail(); setOpen((o) => ({ ...o, [item.label]: true })); return; }
              setOpen((o) => ({ ...o, [item.label]: !o[item.label] }));
            }}
          >
            {icon}<span className="v2-sb-t">{item.label}</span>{tail}
          </button>
        ) : (
          <Link href={item.href ?? '#'} className={cls} title={item.label} aria-current={selfActive ? 'page' : undefined} onClick={onNavigate}>
            {icon}<span className="v2-sb-t">{item.label}</span>{tail}
          </Link>
        )}
        {hasKids && expanded && (
          <div className="v2-sb-sub">
            {kids.map((c) => (
              <Link key={c.href} href={c.href} aria-current={c.href === activeHref ? 'page' : undefined} onClick={onNavigate}>
                <span>{c.label}</span>
                {!!c.count && <span className="v2-sb-count">{c.count}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="v2-sb" aria-label="Main navigation">
      <div className="v2-sb-head">
        {brand.logo ?? <div className="v2-mark">{brand.name.charAt(0)}</div>}
        <div className="v2-sb-brand">
          <b>{brand.name}</b>
          {brand.subtitle && <small>{brand.subtitle}</small>}
        </div>
        <button type="button" className="v2-icon-btn v2-sb-toggle" onClick={onToggle} aria-label="Collapse or expand menu">
          <Icon name="menu" size={20} />
        </button>
      </div>

      <label className="v2-sb-find">
        <Icon name="search" size={15} />
        <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a page" aria-label="Find a page" />
      </label>

      <nav className="v2-sb-scroll">
        {sections.map((s) => {
          const items = s.items.map(renderItem).filter(Boolean);
          if (!items.length) return null;
          return (
            <div key={s.title}>
              <div className="v2-sb-label"><span>{s.title}</span>{!q && s.action}</div>
              {items}
            </div>
          );
        })}
      </nav>

      {footer?.length ? <div className="v2-sb-foot">{footer.map(renderItem)}</div> : null}
    </aside>
  );
}
