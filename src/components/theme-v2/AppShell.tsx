'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { Sidebar, type Brand, type NavItem, type NavSection } from './Sidebar';
import { Topbar, type TopbarProps } from './Topbar';

type Props = Omit<TopbarProps, 'onMenu'> & {
  brand: Brand;
  nav: NavSection[];
  footerNav?: NavItem[];
  children: ReactNode;
};

const RAIL_KEY = 'v2-sidebar-rail';

/**
 * Theme 2 page frame: sidebar + top bar + scrollable content area.
 * Pages render inside it; the first child can be <SubTabs /> to sit flush under the top bar.
 */
export function AppShell({ brand, nav, footerNav, children, ...topbar }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [rail, setRail] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try { setRail(localStorage.getItem(RAIL_KEY) === '1'); } catch { /* storage blocked */ }
  }, []);
  useEffect(() => { setDrawer(false); }, [pathname]);

  const toggle = () => {
    const wide = (ref.current?.clientWidth ?? 0) > 1024;
    if (!wide) { setDrawer((d) => !d); return; }
    setRail((r) => {
      try { localStorage.setItem(RAIL_KEY, r ? '0' : '1'); } catch { /* ignore */ }
      return !r;
    });
  };
  const expandRail = () => {
    setRail(false);
    try { localStorage.setItem(RAIL_KEY, '0'); } catch { /* ignore */ }
  };

  return (
    <div ref={ref} className="v2-app">
      <div className={cn('v2-shell', rail && 'is-rail', drawer && 'is-drawer')}>
        <Sidebar
          brand={brand}
          sections={nav}
          footer={footerNav}
          rail={rail}
          onToggle={toggle}
          onExpandRail={expandRail}
          onNavigate={() => setDrawer(false)}
        />
        <button type="button" className="v2-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setDrawer(false)} />
        <div className="v2-main">
          <Topbar {...topbar} onMenu={() => setDrawer(true)} />
          <main className="v2-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
