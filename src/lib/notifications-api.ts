"use client"

import {
  deleteNotification,
  getUnreadNotificationsCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markNotificationAsSeen,
} from "@/lib/admin-api"

export type {
  NotificationCategory,
  NotificationItem,
  NotificationPriority,
  NotificationQueryParams,
  NotificationStatus,
} from "@/lib/admin-api"

export const notificationsApi = {
  list: listNotifications,
  unreadCount: getUnreadNotificationsCount,
  markSeen: markNotificationAsSeen,
  markRead: markNotificationAsRead,
  markAllRead: markAllNotificationsAsRead,
  archive: deleteNotification,
}

export type NotificationListResult = Awaited<ReturnType<typeof listNotifications>>
