import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api, normalizeList } from '../lib/api';
import { useAuth } from './useAuth';
import { ensureNotificationPermissionsAsync, presentHrmsNotification } from '../lib/notification-settings';

export type AppNotification = Record<string, unknown> & {
  id: string | number;
  title?: string;
  message?: string;
  status?: string;
};

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markManyAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archive: (id: string) => Promise<void>;
  archiveMany: (ids: string[]) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);
const QUERY_KEY = ['mobileNotifications'];

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: QUERY_KEY,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const payload = await api.listMyNotifications({
        page: pageParam, limit: 50, sortBy: 'created_at', sortOrder: 'DESC',
      });
      const rows = await normalizeList(payload) as AppNotification[];
      const result = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
      const meta = result.meta && typeof result.meta === 'object' ? result.meta as Record<string, unknown> : {};
      const totalPages = Number(meta.total_pages ?? meta.totalPages ?? pageParam);
      return { rows, nextPage: pageParam < totalPages ? pageParam + 1 : undefined };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: auth.isAuthenticated,
    refetchInterval: 30_000,
  });
  const seenNotificationIds = useRef<Set<string> | null>(null);
  const latestRows = query.data?.pages[0]?.rows;

  useEffect(() => {
    if (!auth.isAuthenticated || Platform.OS !== 'android') return;
    let active = true;
    void ensureNotificationPermissionsAsync().then((granted) => {
      if (active && !granted) {
        console.warn('Android notification permission is not enabled. Allow notifications for HRMS in system settings.');
      }
    }).catch((error) => {
      console.warn('Could not enable Android notifications', error);
    });
    return () => { active = false; };
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (!latestRows) return;
    const currentIds = new Set(latestRows.map((item) => String(item.id)));
    if (seenNotificationIds.current === null) {
      seenNotificationIds.current = currentIds;
      return;
    }

    const newItems = latestRows.filter((item) => !seenNotificationIds.current?.has(String(item.id)));
    currentIds.forEach((id) => seenNotificationIds.current?.add(id));
    newItems.forEach((item) => {
      const title = firstNotificationText(item, ['title', 'subject', 'event_title']) || 'HRMS notification';
      const body = firstNotificationText(item, ['message', 'body', 'description', 'content']);
      void presentHrmsNotification({
        title,
        body: body || 'You have a new notification.',
        data: { notificationId: item.id },
      }).catch((error) => {
        console.warn('Could not show Android notification', error);
      });
    });
  }, [latestRows]);

  useEffect(() => {
    if (!auth.isAuthenticated) seenNotificationIds.current = null;
  }, [auth.isAuthenticated]);

  const notifications = query.data?.pages.flatMap((page) => page.rows) ?? [];
  const markAsRead = useCallback(async (id: string) => {
    await api.markNotificationAsRead(id);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);
  const markManyAsRead = useCallback(async (ids: string[]) => {
    await Promise.all(ids.map((id) => api.markNotificationAsRead(id)));
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);
  const markAllAsRead = useCallback(async () => {
    await api.markAllNotificationsAsRead();
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);
  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);
  const loadMore = useCallback(async () => {
    if (query.hasNextPage && !query.isFetchingNextPage) await query.fetchNextPage();
  }, [query]);
  const archive = useCallback(async (id: string) => {
    await api.archiveNotification(id);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);
  const archiveMany = useCallback(async (ids: string[]) => {
    await Promise.all(ids.map((id) => api.archiveNotification(id)));
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);
  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount: notifications.filter((item) => String(item.status ?? '').toUpperCase() === 'UNREAD').length,
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    hasMore: Boolean(query.hasNextPage),
    refresh,
    loadMore,
    markAsRead,
    markManyAsRead,
    markAllAsRead,
    archive,
    archiveMany,
  }), [archive, archiveMany, loadMore, markAllAsRead, markAsRead, markManyAsRead, notifications, query.hasNextPage, query.isFetchingNextPage, query.isLoading, refresh]);
  return createElement(NotificationContext.Provider, { value }, children);
}

function firstNotificationText(item: AppNotification, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
}
