"use client"

import * as React from "react"

import { notificationAttentionRoutes } from "@/lib/notification-attention"
import { useNotifications } from "@/lib/notifications-store"

export function useNotificationAttentionRoutes() {
  const { attentionItems } = useNotifications()
  return React.useMemo(
    () => notificationAttentionRoutes(attentionItems),
    [attentionItems],
  )
}
