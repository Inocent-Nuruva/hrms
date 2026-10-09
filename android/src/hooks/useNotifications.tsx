import { createContext, createElement, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, normalizeList } from '../lib/api';
import { useAuth } from './useAuth';

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
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);
const QUERY_KEY = ['mobileNotifications'];

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => await normalizeList(await api.listMyNotifications({
      page: 1, limit: 50, sortBy: 'created_at', sortOrder: 'DESC',
    })) as AppNotification[],
    enabled: auth.isAuthenticated,
    refetchInterval: 30_000,
  });
  const notifications = query.data ?? [];
  const markAsRead = useCallback(async (id: string) => {
    await api.markNotificationAsRead(id);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);
  const markAllAsRead = useCallback(async () => {
    await api.markAllNotificationsAsRead();
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);
  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);
  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount: notifications.filter((item) => String(item.status ?? '').toUpperCase() === 'UNREAD').length,
    loading: query.isLoading,
    refresh,
    markAsRead,
    markAllAsRead,
  }), [markAllAsRead, markAsRead, notifications, query.isLoading, refresh]);
  return createElement(NotificationContext.Provider, { value }, children);
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
}
