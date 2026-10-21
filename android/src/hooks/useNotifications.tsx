import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as DeviceNotifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api, normalizeList } from '../lib/api';
import { useAuth } from './useAuth';
import { ensureNotificationPermissionsAsync, registerRemotePushDeviceAsync, presentHrmsNotification } from '../lib/notification-settings';
import { resolveNotificationDestination, resolveNotificationResponseDestination, serializeNotificationDestination } from '../lib/mobile-notification-routing';

export type AppNotification = Record<string, unknown> & {
  id: string | number;
  title?: string;
  message?: string;
  status?: string;
  delivery_channels?: Array<{ channel?: string; status?: string }>;
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
  const router = useRouter();
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
  const locallyPresentedNotificationIds = useRef<Set<string>>(new Set());
  const latestRowsRef = useRef<AppNotification[]>([]);
  const handledNotificationResponses = useRef<Set<string>>(new Set());
  const latestRows = query.data?.pages[0]?.rows;
  useEffect(() => {
    latestRowsRef.current = latestRows ?? [];
  }, [latestRows]);

  useEffect(() => {
    if (!auth.isAuthenticated || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
    let active = true;
    void ensureNotificationPermissionsAsync().then(async (granted) => {
      if (!active) return;
      if (!granted) {
        if (Platform.OS === 'android') {
          console.warn('Android notification permission is not enabled. Allow notifications for HRMS in system settings.');
        }
        return;
      }
      await registerRemotePushDeviceAsync();
    }).catch((error) => {
      console.warn('Could not register this device for push notifications', error);
    });
    return () => { active = false; };
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    const handleResponse = (response: DeviceNotifications.NotificationResponse) => {
      const requestId = response.notification.request.identifier;
      const responseKey = `${requestId}:${response.actionIdentifier}`;
      if (handledNotificationResponses.current.has(responseKey)) return;
      handledNotificationResponses.current.add(responseKey);
      const payload = response.notification.request.content.data;
      const destination = resolveNotificationResponseDestination(payload, latestRowsRef.current);
      router.push((destination ?? '/notifications') as never);
      void DeviceNotifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    const subscription = DeviceNotifications.addNotificationResponseReceivedListener(
      handleResponse,
    );
    void DeviceNotifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    }).catch(() => {});
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (!latestRows) return;
    const currentIds = new Set(latestRows.map((item) => String(item.id)));
    if (seenNotificationIds.current === null) {
      seenNotificationIds.current = currentIds;
      return;
    }

    const newItems = latestRows.filter((item) => !seenNotificationIds.current?.has(String(item.id)));
    const failedPushItems = latestRows.filter((item) =>
      item.delivery_channels?.some(
        (delivery) => delivery.channel === 'PUSH' && delivery.status === 'FAILED',
      ),
    );
    currentIds.forEach((id) => seenNotificationIds.current?.add(id));
    [...new Map([...newItems, ...failedPushItems].map((item) => [String(item.id), item])).values()].forEach((item) => {
      if (locallyPresentedNotificationIds.current.has(String(item.id))) return;
      const pushIsPendingOrAccepted = item.delivery_channels?.some(
        (delivery) =>
          delivery.channel === 'PUSH' &&
          ['PENDING', 'DELIVERED'].includes(String(delivery.status)),
      );
      if (pushIsPendingOrAccepted) return;
      locallyPresentedNotificationIds.current.add(String(item.id));
      const title = firstNotificationText(item, ['title', 'subject', 'event_title']) || 'HRMS notification';
      const body = firstNotificationText(item, ['message', 'body', 'description', 'content']);
      void presentHrmsNotification({
        title,
        body: body || 'You have a new notification.',
        data: {
          notificationId: item.id,
          ...serializeNotificationDestination(resolveNotificationDestination(item)),
        },
      }).catch((error) => {
        console.warn('Could not show Android notification', error);
      });
    });
  }, [latestRows]);

  useEffect(() => {
    if (!auth.isAuthenticated) seenNotificationIds.current = null;
  }, [auth.isAuthenticated]);

  const notifications = useMemo(
    () => query.data?.pages.flatMap((page) => page.rows) ?? [],
    [query.data],
  );
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
