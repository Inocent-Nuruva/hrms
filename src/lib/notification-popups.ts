"use client"

import { toast } from "sonner"
import type { AdminRecord } from "@/lib/admin-api"
import { resolveNotificationUrl } from "@/lib/notification-attention"

const recentlyShown = new Map<number, number>()
const DEDUPE_MS = 2 * 60 * 1000

function text(row: AdminRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

export function showNotificationPopup(row: AdminRecord) {
  if (typeof document === "undefined" || document.visibilityState !== "visible" || !document.hasFocus()) return

  const id = Number(row.id ?? row.notification_id ?? row.notificationId)
  if (Number.isInteger(id) && id > 0) {
    const now = Date.now()
    for (const [seenId, time] of recentlyShown) {
      if (now - time > DEDUPE_MS) recentlyShown.delete(seenId)
    }
    if (recentlyShown.has(id)) return
    recentlyShown.set(id, now)
  }

  const title = text(row, "title") || "New notification"
  const description = text(row, "message", "body", "description")
  const destination = resolveNotificationUrl(row)
  toast(title, {
    description,
    duration: 8_000,
    action: { label: "View", onClick: () => window.location.assign(destination) },
  })
}

export function showMissedNotificationsPopup(count: number) {
  if (count < 1 || typeof document === "undefined" || document.visibilityState !== "visible") return
  toast.info(count === 1 ? "You have 1 unread notification" : `You have ${count} unread notifications`, {
    description: "Open your inbox to catch up on activity while you were away.",
    duration: 10_000,
    action: { label: "Open inbox", onClick: () => window.location.assign("/dashboard/operations/notifications") },
  })
}
