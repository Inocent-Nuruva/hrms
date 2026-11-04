"use client";

import {
  deleteNotification,
  dismissAllNotifications,
  getUnreadNotificationsCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markNotificationAsSeen,
} from "@/lib/admin-api";

export type {
  NotificationCategory,
  NotificationItem,
  NotificationPriority,
  NotificationQueryParams,
  NotificationStatus,
} from "@/lib/admin-api";

export const notificationsApi = {
  list: listNotifications,
  unreadCount: getUnreadNotificationsCount,
  markSeen: markNotificationAsSeen,
  markRead: markNotificationAsRead,
  markAllRead: markAllNotificationsAsRead,
  delete: deleteNotification,
  dismissAll: dismissAllNotifications,
};

export type NotificationListResult = Awaited<
  ReturnType<typeof listNotifications>
>;
