'use client';

/**
 * Theme 2 frame for /dashboard. AdminDashboardView renders this instead of the
 * Theme 1 sidebar + header when the ui-theme cookie is "v2", so sign-in,
 * route permission checks and the forced password reset stay in one place.
 *
 * Menu: the same permission-filtered items as the Theme 1 sidebar, with the
 * same Fluent icons. Check-in: the existing punch flow (location, selfie,
 * policy) behind the Theme 2 check-in panel.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, type ReactNode } from 'react';
import {
  ArrowClockwise20Regular,
  ArrowMaximize20Regular,
  Color20Regular,
  Headset20Regular,
  Settings20Regular,
  WeatherMoon20Regular,
  WeatherSunny20Regular,
} from '@fluentui/react-icons';

import type { DashboardNavItem } from '@/components/app-sidebar';
import { ThemeV2CheckIn } from '@/components/dashboard/dashboard-attendance-actions';
import type { HeaderSearchItem } from '@/components/header-global-search';
import { useTheme } from '@/components/theme-provider';
import { AppShell, type NavItem, type NavSection, type ToolItem } from '@/components/theme-v2';
import { useUiTheme } from '@/components/ui-theme/UiThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/lib/notifications-store';
import { ROUTES } from '@/utils/constants';

function toNavItem(item: DashboardNavItem): NavItem {
  const Icon = item.icon;
  const children = (item.items ?? []).flatMap((child) =>
    child.items?.length
      ? child.items.filter((leaf) => leaf.url).map((leaf) => ({ label: leaf.title, href: leaf.url! }))
      : child.url
        ? [{ label: child.title, href: child.url }]
        : [],
  );
  return {
    label: item.title,
    href: children.length ? undefined : item.url,
    icon: Icon ? <Icon style={{ width: 19, height: 19, color: 'var(--sidebar-icon-color, currentColor)' }} /> : undefined,
    children: children.length ? children : undefined,
  };
}

export type DashboardShellV2Props = {
  children: ReactNode;
  navItems: DashboardNavItem[];
  searchItems: HeaderSearchItem[];
  userName: string;
  userRole?: string;
  userAvatar?: string | null;
  companyName?: string | null;
  onRefresh?: () => void | Promise<void>;
};

export default function DashboardShellV2({
  children,
  navItems,
  searchItems,
  userName,
  userRole,
  userAvatar,
  companyName,
  onRefresh,
}: DashboardShellV2Props) {
  const router = useRouter();
  const { toggleUi } = useUiTheme();
  const { resolvedTheme, setTheme } = useTheme();
  const { logout } = useAuth();
  const { unreadCount, loadUnreadCount, connectSocket } = useNotifications();

  useEffect(() => {
    void loadUnreadCount();
    connectSocket();
  }, [connectSocket, loadUnreadCount]);

  const nav: NavSection[] = useMemo(
    () => [{ title: 'Workspaces', items: navItems.map(toNavItem) }],
    [navItems],
  );

  const dark = resolvedTheme === 'dark';
  const tools: ToolItem[] = [
    {
      key: 'fullscreen', label: 'Full screen', color: '#3B6FD8', icon: <ArrowMaximize20Regular />,
      onClick: () => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()),
    },
    {
      key: 'mode', label: dark ? 'Light mode' : 'Dark mode',
      icon: dark ? <WeatherSunny20Regular /> : <WeatherMoon20Regular />,
      onClick: () => setTheme(dark ? 'light' : 'dark'),
    },
    { key: 'design', label: 'Switch to classic design', icon: <Color20Regular />, onClick: toggleUi },
    { key: 'sync', label: 'Refresh', color: '#3B6FD8', icon: <ArrowClockwise20Regular />, onClick: () => void (onRefresh ? onRefresh() : router.refresh()) },
    { key: 'settings', label: 'Settings', color: '#8B4FD8', icon: <Settings20Regular />, onClick: () => router.push('/dashboard/settings') },
  ];

  const signOut = async () => {
    await logout();
    router.replace(ROUTES.login);
  };

  return (
    <AppShell
      brand={{ name: 'Alliance HRMS', subtitle: companyName ?? undefined }}
      nav={nav}
      footerNav={[{ label: 'Help & support', href: '/dashboard/help', icon: <Headset20Regular /> }]}
      user={{ name: userName, role: userRole, avatarUrl: userAvatar ?? null }}
      userMenu={
        <>
          <button type="button" className="v2-pop-item" onClick={() => router.push('/dashboard/settings')}><span>Account settings</span></button>
          <button type="button" className="v2-pop-item" onClick={toggleUi}><span>Switch to classic design</span></button>
          <button type="button" className="v2-pop-item" onClick={() => void signOut()}><span>Sign out</span></button>
        </>
      }
      notifications={{ count: unreadCount, onClick: () => router.push('/dashboard/notifications') }}
      tools={tools}
      onSearch={(query) => {
        const q = query.trim().toLowerCase();
        if (!q) return;
        const match =
          searchItems.find((item) => item.title.toLowerCase() === q) ??
          searchItems.find((item) => item.title.toLowerCase().includes(q)) ??
          searchItems.find((item) => item.keywords?.some((word) => word.toLowerCase().includes(q)));
        if (match) router.push(match.url);
      }}
      checkIn={<ThemeV2CheckIn />}
    >
      {children}
    </AppShell>
  );
}
