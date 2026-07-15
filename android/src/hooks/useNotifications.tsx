import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';

import { api, normalizeList } from '../lib/api';
import {
  ensureNotificationChannelsAsync,
  ensureNotificationPermissionsAsync,
  presentHrmsNotification,
} from '../lib/notification-settings';
import * as SecureStore from '../lib/secure-store';
import { useAuth } from './useAuth';

type NotificationRoute = '/(tabs)/leave';

export interface AppNotification {
  id: string;
  type: 'leave-status';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  route: NotificationRoute;
  requestId: string;
  status: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = String(auth.user?.id ?? '');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [bootstrappedUserId, setBootstrappedUserId] = useState<string | null>(null);

  const notificationStorageKey = userId ? `hrms.notifications.${userId}` : '';
  const snapshotStorageKey = userId ? `hrms.notificationSnapshot.${userId}` : '';

  const leaveRequestsQuery = useQuery({
    queryKey: ['mobileNotificationLeaveRequests', userId],
    queryFn: async () => normalizeList(await api.listMyLeaveRequests({ limit: 50 })),
    enabled: auth.isAuthenticated && !!userId,
    refetchInterval: 1000 * 30,
  });

  useEffect(() => {
    if (!auth.isAuthenticated) return;

    let cancelled = false;

    async function prepareNativeNotifications() {
      try {
        await ensureNotificationChannelsAsync();
        if (!cancelled) {
          await ensureNotificationPermissionsAsync();
        }
      } catch {
        // Keep in-app notifications working even if native notifications fail.
      }
    }

    void prepareNativeNotifications();

    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated]);

  useEffect(() => {
    let cancelled = false;

    async function loadStoredNotifications() {
      if (!userId) {
        if (!cancelled) {
          setNotifications([]);
          setBootstrappedUserId(null);
        }
        return;
      }

      const stored = await SecureStore.getItemAsync(notificationStorageKey);
      if (cancelled) return;

      if (!stored) {
        setNotifications([]);
        setBootstrappedUserId(userId);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as AppNotification[];
        setNotifications(Array.isArray(parsed) ? parsed : []);
      } catch {
        setNotifications([]);
      }
      setBootstrappedUserId(userId);
    }

    void loadStoredNotifications();
    return () => {
      cancelled = true;
    };
  }, [notificationStorageKey, userId]);

  useEffect(() => {
    if (!userId || bootstrappedUserId !== userId) return;
    void SecureStore.setItemAsync(notificationStorageKey, JSON.stringify(notifications));
  }, [bootstrappedUserId, notificationStorageKey, notifications, userId]);

  useEffect(() => {
    if (!auth.isAuthenticated || !userId || bootstrappedUserId !== userId) return;
    if (!leaveRequestsQuery.data) return;

    let cancelled = false;

    async function reconcileNotifications() {
      const currentSnapshot = buildLeaveSnapshot(leaveRequestsQuery.data);
      const storedSnapshotRaw = await SecureStore.getItemAsync(snapshotStorageKey);
      if (cancelled) return;

      if (!storedSnapshotRaw) {
        await SecureStore.setItemAsync(snapshotStorageKey, JSON.stringify(currentSnapshot));
        return;
      }

      let previousSnapshot: Record<string, { status: string; leaveType: string; startDate: string; endDate: string }> = {};
      try {
        previousSnapshot = JSON.parse(storedSnapshotRaw) as typeof previousSnapshot;
      } catch {
        previousSnapshot = {};
      }

      const freshNotifications: AppNotification[] = [];

      Object.entries(currentSnapshot).forEach(([requestId, current]) => {
        const previous = previousSnapshot[requestId];
        if (!previous) return;
        if (previous.status === current.status) return;

        freshNotifications.push({
          id: `leave-status:${requestId}:${current.status}`,
          type: 'leave-status',
          title: `${capitalizeStatus(current.status)} leave request`,
          body: `${current.leaveType || 'Your leave request'} is now ${humanizeStatus(current.status)}.`,
          createdAt: new Date().toISOString(),
          read: false,
          route: '/(tabs)/leave',
          requestId,
          status: current.status,
        });
      });

      const unseenNotifications = freshNotifications.filter(
        (item) => !notifications.some((existing) => existing.id === item.id)
      );

      if (unseenNotifications.length) {
        setNotifications((existing) => {
          const seenIds = new Set(existing.map((item) => item.id));
          const merged = [...unseenNotifications.filter((item) => !seenIds.has(item.id)), ...existing];
          return merged.slice(0, 50);
        });

        await Promise.allSettled(
          unseenNotifications.map((item) =>
            presentHrmsNotification({
              title: item.title,
              body: item.body,
              data: {
                route: item.route,
                requestId: item.requestId,
                status: item.status,
                type: item.type,
              },
            })
          )
        );
      }

      await SecureStore.setItemAsync(snapshotStorageKey, JSON.stringify(currentSnapshot));
    }

    void reconcileNotifications();

    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, bootstrappedUserId, leaveRequestsQuery.data, notifications, snapshotStorageKey, userId]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
      markAsRead,
      markAllAsRead,
    }),
    [markAllAsRead, markAsRead, notifications]
  );

  return createElement(NotificationContext.Provider, { value }, children);
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}

function buildLeaveSnapshot(items: Record<string, unknown>[] | undefined) {
  return (items || []).reduce<Record<string, { status: string; leaveType: string; startDate: string; endDate: string }>>(
    (snapshot, item) => {
      const requestId = String(item.id ?? '');
      if (!requestId) return snapshot;
      const leaveType =
        readString(asRecord(item.leave_type), ['name']) ||
        readString(item, ['leave_type_name']) ||
        'Leave request';

      snapshot[requestId] = {
        status: readString(item, ['status']) || 'pending',
        leaveType,
        startDate: readString(item, ['start_date']),
        endDate: readString(item, ['end_date']),
      };
      return snapshot;
    },
    {}
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown, keys: string[]) {
  const record = asRecord(value);
  if (!record) return '';
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

function humanizeStatus(value: string) {
  return value.replaceAll('_', ' ');
}

function capitalizeStatus(value: string) {
  const cleaned = humanizeStatus(value);
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
