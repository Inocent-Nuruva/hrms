"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getUnreadNotificationsCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type AdminRecord,
} from "@/lib/admin-api"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const LEGACY_ADMIN_TOKEN_KEY = "hrms.admin.accessToken"
const POLL_INTERVAL_MS = 60_000

function readStoredToken() {
  if (typeof window === "undefined") {
    return ""
  }

  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
      const accessToken = (parsed.accessToken ?? parsed.access_token ?? "").trim()
      if (accessToken) {
        return accessToken
      }
    } catch {
      // Fall through to legacy key.
    }
  }

  return window.localStorage.getItem(LEGACY_ADMIN_TOKEN_KEY)?.trim() ?? ""
}

function readString(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return ""
}

function readNumber(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function readMetadata(row: AdminRecord) {
  const metadata = row.metadata
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as AdminRecord
  }
  return null
}

function isUnreadNotification(row: AdminRecord) {
  const status = readString(row, ["status"]).toUpperCase()
  const readAt = readString(row, ["read_at", "readAt"])
  return status === "UNREAD" || !readAt
}

function formatNotificationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const deltaMs = date.getTime() - Date.now()
  const deltaMinutes = Math.round(deltaMs / 60_000)
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (Math.abs(deltaMinutes) < 60) {
    return formatter.format(deltaMinutes, "minute")
  }

  const deltaHours = Math.round(deltaMinutes / 60)
  if (Math.abs(deltaHours) < 24) {
    return formatter.format(deltaHours, "hour")
  }

  const deltaDays = Math.round(deltaHours / 24)
  if (Math.abs(deltaDays) < 7) {
    return formatter.format(deltaDays, "day")
  }

  return date.toLocaleString()
}

function resolveNotificationUrl(row: AdminRecord) {
  const directUrl = readString(row, ["action_url", "actionUrl", "url", "href"])
  if (directUrl) {
    if (directUrl.startsWith("/")) {
      return directUrl
    }

    try {
      const parsed = new URL(directUrl)
      if (parsed.pathname) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`
      }
    } catch {
      // Ignore malformed absolute URL and try entity mapping below.
    }
  }

  const metadata = readMetadata(row)
  const entityType = readString(row, ["entity_type", "entityType", "type"]).toLowerCase()
  const mappedType = (readString(metadata ?? {}, ["entity_type", "entityType"]) || entityType).toLowerCase()

  switch (mappedType) {
    case "profile_update_request":
    case "hr_profile_update_request":
    case "self_service_request":
      return "/dashboard/employees/profile-update-approvals"
    case "attendance_correction_request":
    case "attendance_correction":
    case "hr_attendance_correction_request":
      return "/dashboard/attendance/correction-requests"
    case "onboarding_request":
    case "onboarding_workflow":
      return "/dashboard/employees/onboarding"
    case "offboarding_request":
    case "offboarding_workflow":
      return "/dashboard/employees/offboarding"
    case "leave_request":
      return "/dashboard/leave-management/requests"
    case "leave_balance":
      return "/dashboard/leave-management/balances"
    case "leave_type":
      return "/dashboard/leave-management/types"
    case "attendance_summary":
    case "attendance_daily_summary":
    case "attendance_report":
      return "/dashboard/attendance/daily-summaries"
    case "branch":
      return "/dashboard/branches"
    case "department":
      return "/dashboard/departments"
    case "position":
      return "/dashboard/positions"
    case "designation":
      return "/dashboard/designations"
    default:
      return "/dashboard"
  }
}

function notificationTypeLabel(row: AdminRecord) {
  const type = readString(row, ["type", "entity_type", "entityType"])
  if (!type) {
    return "Notification"
  }
  return type
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export function NotificationCenter({
  open,
  onOpenChange,
  onUnreadCountChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnreadCountChange?: (count: number) => void
}) {
  const router = useRouter()
  const [items, setItems] = React.useState<AdminRecord[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [markingAll, setMarkingAll] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadNotifications = React.useCallback(
    async (showErrors = false) => {
      const token = readStoredToken()
      if (!token) {
        setItems([])
        setUnreadCount(0)
        setError("Authentication required. Please sign in again.")
        return
      }

      setLoading(true)
      setError(null)
      try {
        const [listResult, nextUnreadCount] = await Promise.all([
          listNotifications(
            token,
            {
              page: 1,
              limit: 20,
              sortBy: "created_at",
              sortOrder: "DESC",
            },
            { cacheTtlMs: 0, dedupe: false }
          ),
          getUnreadNotificationsCount(token),
        ])
        setItems(listResult.rows)
        setUnreadCount(nextUnreadCount)
        onUnreadCountChange?.(nextUnreadCount)
      } catch (errorObject) {
        const message =
          errorObject instanceof Error ? errorObject.message : "Failed to load notifications."
        setError(message)
        if (showErrors) {
          showErrorAlert(message)
        }
      } finally {
        setLoading(false)
      }
    },
    [onUnreadCountChange]
  )

  React.useEffect(() => {
    void loadNotifications(false)
    const intervalId = window.setInterval(() => {
      void loadNotifications(false)
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [loadNotifications])

  React.useEffect(() => {
    if (open) {
      void loadNotifications(false)
    }
  }, [open, loadNotifications])

  const handleMarkAllRead = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please sign in again.")
      return
    }

    setMarkingAll(true)
    try {
      await markAllNotificationsAsRead(token)
      setItems((current) =>
        current.map((item) => ({
          ...item,
          status: "READ",
          read_at: item.read_at ?? new Date().toISOString(),
        }))
      )
      setUnreadCount(0)
      onUnreadCountChange?.(0)
      showSuccessAlert("All notifications marked as read.")
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Failed to mark notifications as read."
      showErrorAlert(message)
    } finally {
      setMarkingAll(false)
    }
  }, [onUnreadCountChange])

  const handleNotificationClick = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const id = readNumber(row, ["id"])
      const unread = isUnreadNotification(row)

      if (token && unread && id !== null) {
        try {
          await markNotificationAsRead(token, id)
          setItems((current) =>
            current.map((item) =>
              readNumber(item, ["id"]) === id
                ? { ...item, status: "READ", read_at: item.read_at ?? new Date().toISOString() }
                : item
            )
          )
          setUnreadCount((current) => {
            const next = Math.max(0, current - 1)
            onUnreadCountChange?.(next)
            return next
          })
        } catch {
          // Navigation is still more important than blocking on read state.
        }
      }

      onOpenChange(false)
      router.push(resolveNotificationUrl(row))
    },
    [onOpenChange, onUnreadCountChange, router]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "border-slate-200 bg-slate-50 text-slate-700",
              unreadCount > 0 ? "border-blue-200 bg-blue-50 text-blue-700" : null
            )}
          >
            {unreadCount} unread
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => void loadNotifications(true)}
            disabled={loading}
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading ? "animate-spin" : "")} />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => void handleMarkAllRead()}
            disabled={markingAll || unreadCount === 0}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark All Read
          </Button>
        </div>
      </div>

      <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-slate-200">
        {error ? (
          <div className="p-4 text-sm text-rose-600">{error}</div>
        ) : null}

        {!error && items.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center gap-3 bg-muted/25 p-6 text-center">
            <div className="rounded-full bg-muted p-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-normal text-muted-foreground">No notifications yet</p>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {items.map((row, index) => {
              const id = readNumber(row, ["id"])
              const title = readString(row, ["title"]) || notificationTypeLabel(row)
              const message = readString(row, ["message", "description"])
              const createdAt = readString(row, ["created_at", "createdAt"])
              const unread = isUnreadNotification(row)

              return (
                <button
                  key={id ?? `notification-${index}`}
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50",
                    unread ? "bg-blue-50/50" : "bg-white"
                  )}
                  onClick={() => void handleNotificationClick(row)}
                >
                  <span
                    className={cn(
                      "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                      unread ? "bg-blue-600" : "bg-slate-300"
                    )}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
                      {createdAt ? (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatNotificationTime(createdAt)}
                        </span>
                      ) : null}
                    </div>
                    {message ? (
                      <p className="line-clamp-2 text-xs leading-5 text-slate-600">{message}</p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] text-slate-700">
                        {notificationTypeLabel(row)}
                      </Badge>
                      {unread ? (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[11px] text-blue-700">
                          Unread
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
