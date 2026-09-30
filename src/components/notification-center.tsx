"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion"
import {
  Alert20Regular as Bell,
  Archive20Regular as Archive,
  ArrowSync20Regular as RefreshCw,
  ArrowUpRight20Regular as ArrowUpRight,
  Checkmark20Regular as Check,
  CheckmarkCircle20Regular as CheckCheck,
  Dismiss20Regular as X,
  Eye20Regular as Eye,
  Send20Regular as Send,
} from "@fluentui/react-icons"
import { Card, Field } from "@fluentui/react-components"
import { FluentSearchBox } from "@/components/common/fluent-search-box"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  createTestNotification,
  type AdminRecord,
  type NotificationCategory,
  type NotificationPriority,
  type NotificationQueryParams,
  type NotificationStatus,
} from "@/lib/admin-api"
import { decodeJwtPayload } from "@/lib/dashboard-permissions"
import {
  DEFAULT_NOTIFICATION_QUERY,
  playNotificationSound,
  unlockNotificationAudioFromGesture,
  useNotifications,
} from "@/lib/notifications-store"
import { showErrorAlert } from "@/lib/error-alert"
import {
  isUnreadNotification,
  resolveNotificationUrl,
} from "@/lib/notification-attention"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const LEGACY_ADMIN_TOKEN_KEY = "hrms.admin.accessToken"
const SEARCH_DEBOUNCE_MS = 250

const CATEGORY_OPTIONS: Array<{ value: NotificationCategory; label: string }> = [
  { value: "GENERAL", label: "General" },
  { value: "HR", label: "HR" },
  { value: "AUTH", label: "Auth" },
  { value: "ACCESS_CONTROL", label: "Access Control" },
  { value: "SYSTEM", label: "System" },
]

const PRIORITY_OPTIONS: Array<{ value: NotificationPriority; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
]

type StatusFilterValue = "all" | NotificationStatus

function readStoredToken() {
  if (typeof window === "undefined") return ""
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw) as {
        accessToken?: string
        access_token?: string
      }
      const accessToken = (parsed.accessToken ?? parsed.access_token ?? "").trim()
      if (accessToken) return accessToken
    } catch {
      // fall through
    }
  }
  return (
    window.localStorage.getItem(LEGACY_ADMIN_TOKEN_KEY)?.trim() ??
    window.localStorage.getItem("hrms.admin.accessToken")?.trim() ??
    ""
  )
}

function readString(row: AdminRecord | null, keys: string[]) {
  if (!row) return ""
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function readNumber(row: AdminRecord | null, keys: string[]) {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readBoolean(row: AdminRecord | null, keys: string[]) {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") return value
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (["true", "1", "yes"].includes(normalized)) return true
      if (["false", "0", "no"].includes(normalized)) return false
    }
    if (typeof value === "number") {
      if (value === 1) return true
      if (value === 0) return false
    }
  }
  return null
}

function formatLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function readNotificationId(row: AdminRecord) {
  return readNumber(row, ["id", "notification_id", "notificationId"])
}

function isSeenNotification(row: AdminRecord) {
  const explicit = readBoolean(row, ["seen", "is_seen", "isSeen"])
  if (explicit !== null) return explicit
  return Boolean(readString(row, ["seen_at", "seenAt"]))
}

function isArchivedNotification(row: AdminRecord) {
  const explicit = readBoolean(row, [
    "archived",
    "is_archived",
    "isArchived",
    "deleted",
    "is_deleted",
    "isDeleted",
  ])
  if (explicit !== null) return explicit
  if (readString(row, ["archived_at", "archivedAt", "deleted_at", "deletedAt"])) {
    return true
  }
  const status = readString(row, ["status"]).toUpperCase()
  return status === "ARCHIVED" || status === "DELETED" || status === "REMOVED"
}

function notificationTypeLabel(row: AdminRecord) {
  const type = readString(row, ["type", "entity_type", "entityType"])
  return type ? formatLabel(type) : "Notification"
}

function notificationCategoryLabel(row: AdminRecord) {
  const category = readString(row, ["category"]).toUpperCase()
  return category ? formatLabel(category) : "General"
}

function notificationPriorityLabel(row: AdminRecord) {
  const priority = readString(row, ["priority"]).toUpperCase()
  return priority ? formatLabel(priority) : "Low"
}

function formatNotificationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const deltaMs = date.getTime() - Date.now()
  const deltaMinutes = Math.round(deltaMs / 60_000)
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  if (Math.abs(deltaMinutes) < 60) return formatter.format(deltaMinutes, "minute")
  const deltaHours = Math.round(deltaMinutes / 60)
  if (Math.abs(deltaHours) < 24) return formatter.format(deltaHours, "hour")
  const deltaDays = Math.round(deltaHours / 24)
  if (Math.abs(deltaDays) < 30) return formatter.format(deltaDays, "day")
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function readCurrentCompanyUserId() {
  const token = readStoredToken()
  if (!token) return null
  const jwt = decodeJwtPayload(token)
  if (!jwt) return null
  return (
    readNumber(jwt, [
      "membershipId",
      "membership_id",
      "company_user_id",
      "companyUserId",
      "company_membership_id",
    ]) ?? null
  )
}

/** Plain text color for category labels (no pill/card chrome). */
function categoryTextClass(label: string) {
  const normalized = label.toLowerCase()
  if (normalized.includes("hr")) {
    return "text-emerald-700 dark:text-emerald-300"
  }
  if (normalized.includes("auth")) {
    return "text-sky-700 dark:text-sky-300"
  }
  if (normalized.includes("access")) {
    return "text-violet-700 dark:text-violet-300"
  }
  if (normalized.includes("system")) {
    return "text-muted-foreground"
  }
  return "text-muted-foreground"
}

function priorityTextClass(label: string) {
  if (label === "Urgent") return "font-medium text-rose-600 dark:text-rose-400"
  if (label === "High") return "font-medium text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}

/** Same stagger/enter animation as resizable table population. */
const notificationListVariants: Variants = {
  visible: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
}

const notificationItemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.985, filter: "blur(3px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 420, damping: 26, mass: 0.65 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
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
  const {
    archiveNotification,
    clearAllNotifications,
    error,
    items,
    loadNotifications: loadNotificationsFromStore,
    loadUnreadCount,
    markAllAsRead,
    markAsRead,
    markAsSeen,
    quietWarning,
    setViewState,
    unreadCount,
    loading,
  } = useNotifications()

  const [markingAll, setMarkingAll] = React.useState(false)
  const [clearingAll, setClearingAll] = React.useState(false)
  const [sendingTest, setSendingTest] = React.useState(false)
  const [busyIds, setBusyIds] = React.useState<number[]>([])

  const [searchInput, setSearchInput] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilterValue>("all")
  const [categoryFilter, setCategoryFilter] = React.useState<NotificationCategory | "all">("all")
  const [priorityFilter, setPriorityFilter] = React.useState<NotificationPriority | "all">("all")
  const [includeArchived, setIncludeArchived] = React.useState(false)

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const activeFilterCount = React.useMemo(() => {
    return [
      Boolean(searchQuery),
      statusFilter !== "all",
      categoryFilter !== "all",
      priorityFilter !== "all",
      includeArchived,
    ].filter(Boolean).length
  }, [categoryFilter, includeArchived, priorityFilter, searchQuery, statusFilter])

  const requestParams = React.useMemo<NotificationQueryParams>(
    () => ({
      ...DEFAULT_NOTIFICATION_QUERY,
      page: 1,
      limit: 30,
      sortBy: "created_at",
      sortOrder: "DESC",
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
      ...(priorityFilter !== "all" ? { priority: priorityFilter } : {}),
      ...(includeArchived ? { include_archived: true } : {}),
    }),
    [categoryFilter, includeArchived, priorityFilter, searchQuery, statusFilter]
  )

  const markBusy = React.useCallback((id: number, busy: boolean) => {
    setBusyIds((current) => {
      if (busy) return current.includes(id) ? current : [...current, id]
      return current.filter((entry) => entry !== id)
    })
  }, [])

  const loadNotifications = React.useCallback(
    async ({
      showErrors = false,
      markVisibleSeen = false,
    }: {
      showErrors?: boolean
      markVisibleSeen?: boolean
    } = {}) => {
      await Promise.all([
        loadNotificationsFromStore(requestParams, {
          markVisibleSeen,
          notifyOnError: showErrors,
        }),
        loadUnreadCount({ notifyOnError: showErrors }),
      ])
    },
    [loadNotificationsFromStore, loadUnreadCount, requestParams]
  )

  React.useEffect(() => {
    setViewState(open, requestParams)
  }, [open, requestParams, setViewState])

  React.useEffect(() => {
    if (!open) return
    void loadNotifications({ markVisibleSeen: true })
  }, [loadNotifications, open])

  React.useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [onUnreadCountChange, unreadCount])

  const clearFilters = React.useCallback(() => {
    setSearchInput("")
    setSearchQuery("")
    setStatusFilter("all")
    setCategoryFilter("all")
    setPriorityFilter("all")
    setIncludeArchived(false)
  }, [])

  const handleMarkAllRead = React.useCallback(async () => {
    setMarkingAll(true)
    try {
      await markAllAsRead()
      showSuccessAlert("All notifications marked as read.")
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error ? errorObject.message : "Failed to mark notifications as read."
      )
    } finally {
      setMarkingAll(false)
    }
  }, [markAllAsRead])

  const handleArchiveAllNotifications = React.useCallback(async () => {
    if (items.length === 0) return
    setClearingAll(true)
    try {
      const archivedCount = await clearAllNotifications()
      showSuccessAlert(
        archivedCount === 1
          ? "1 notification archived."
          : `${archivedCount} notifications archived.`
      )
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error ? errorObject.message : "Failed to archive notifications."
      )
    } finally {
      setClearingAll(false)
    }
  }, [clearAllNotifications, items.length])

  const handleNotificationClick = React.useCallback(
    async (row: AdminRecord) => {
      const id = readNotificationId(row)
      const unread = isUnreadNotification(row)
      const unseen = !isSeenNotification(row)
      const archived = isArchivedNotification(row)
      const destination = resolveNotificationUrl(row)

      // Archived/soft-deleted notifications cannot be mutated via /read or /seen.
      if (id !== null && !archived) {
        await Promise.allSettled([
          unread ? markAsRead(id) : Promise.resolve(null),
          unseen ? markAsSeen(id) : Promise.resolve(null),
        ])
      }

      onOpenChange(false)
      router.push(destination)
    },
    [markAsRead, markAsSeen, onOpenChange, router]
  )

  const handleMarkRead = React.useCallback(
    async (row: AdminRecord) => {
      const id = readNotificationId(row)
      if (id === null) return
      markBusy(id, true)
      try {
        await markAsRead(id)
      } catch (errorObject) {
        showErrorAlert(
          errorObject instanceof Error ? errorObject.message : "Failed to mark as read."
        )
      } finally {
        markBusy(id, false)
      }
    },
    [markAsRead, markBusy]
  )

  const handleMarkSeen = React.useCallback(
    async (row: AdminRecord) => {
      const id = readNotificationId(row)
      if (id === null) return
      markBusy(id, true)
      try {
        await markAsSeen(id)
      } catch (errorObject) {
        showErrorAlert(
          errorObject instanceof Error ? errorObject.message : "Failed to mark as seen."
        )
      } finally {
        markBusy(id, false)
      }
    },
    [markAsSeen, markBusy]
  )

  const handleArchive = React.useCallback(
    async (row: AdminRecord) => {
      const id = readNotificationId(row)
      if (id === null) return
      markBusy(id, true)
      try {
        await archiveNotification(id)
        showSuccessAlert("Notification archived.")
      } catch (errorObject) {
        showErrorAlert(
          errorObject instanceof Error ? errorObject.message : "Failed to archive notification."
        )
      } finally {
        markBusy(id, false)
      }
    },
    [archiveNotification, markBusy]
  )

  const handleSendTestNotification = React.useCallback(async () => {
    const token = readStoredToken()
    const receiverCompanyUserId = readCurrentCompanyUserId()
    if (!token || receiverCompanyUserId === null) {
      showErrorAlert("Could not determine the current company user for a test notification.")
      return
    }

    // Unlock autoplay in this click gesture (before any await loses the gesture).
    await unlockNotificationAudioFromGesture()

    setSendingTest(true)
    try {
      await createTestNotification(token, {
        receiver_company_user_id: receiverCompanyUserId,
        title: "Dashboard test notification",
        message: `Triggered from the dashboard on ${new Date().toLocaleString()}.`,
        type: "dashboard_test",
        category: "SYSTEM",
        priority: "LOW",
        related_module: "dashboard",
        entity_type: "notification",
        entity_id: "dashboard",
        action_url: "/dashboard",
        dedupe_key: `dashboard-test-${Date.now()}`,
        metadata: {
          source: "notification-center",
          triggered_at: new Date().toISOString(),
        },
      })
      showSuccessAlert("Test notification sent.")
      // Chime immediately (works even when live socket is on REST-only).
      playNotificationSound()
      await loadNotifications({ markVisibleSeen: false })
      await loadUnreadCount({ notifyOnError: false })
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error ? errorObject.message : "Failed to send test notification."
      )
    } finally {
      setSendingTest(false)
    }
  }, [loadNotifications, loadUnreadCount])

  const hasRecipientForTest = readCurrentCompanyUserId() !== null
  const shouldReduceMotion = useReducedMotion()
  const shouldAnimate = !shouldReduceMotion

  // Re-stagger when the dialog opens or filters change (matches table page keys).
  const listAnimationKey = React.useMemo(
    () =>
      [
        open ? "open" : "closed",
        statusFilter,
        categoryFilter,
        priorityFilter,
        includeArchived ? "archived" : "active",
        searchQuery,
      ].join("|"),
    [categoryFilter, includeArchived, open, priorityFilter, searchQuery, statusFilter]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2.5">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Review recent activity and approval updates.
          </p>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 ? (
              <span className="text-xs font-medium text-primary">
                {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
              </span>
            ) : null}
            <div className="flex items-center gap-1" role="toolbar" aria-label="Notification actions">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="!size-7 !min-w-7 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => void loadNotifications({ showErrors: true, markVisibleSeen: open })}
                disabled={loading}
                title="Refresh"
                aria-label="Refresh notifications"
              >
                <RefreshCw className={cn("size-4", loading ? "animate-spin" : "")} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="!size-7 !min-w-7 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => void handleMarkAllRead()}
                disabled={markingAll || unreadCount === 0}
                title="Mark all as read"
                aria-label="Mark all notifications as read"
              >
                {markingAll ? (
                  <FluentLoadingIndicator className="size-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="!size-7 !min-w-7 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => void handleArchiveAllNotifications()}
                disabled={clearingAll || loading || items.length === 0 || includeArchived}
                title={
                  includeArchived
                    ? "Switch off Archived to archive active notifications"
                    : "Archive all notifications"
                }
                aria-label="Archive all notifications"
              >
                {clearingAll ? (
                  <FluentLoadingIndicator className="size-3.5 animate-spin" />
                ) : (
                  <Archive className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="!size-7 !min-w-7 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => void handleSendTestNotification()}
                disabled={sendingTest || clearingAll || !hasRecipientForTest}
                title={
                  hasRecipientForTest
                    ? "Send a test notification to yourself"
                    : "Current company user could not be determined"
                }
                aria-label="Send test notification"
              >
                <Send className={cn("size-4", sendingTest ? "animate-pulse" : "")} />
              </Button>
            </div>
          </div>
        </div>

        {quietWarning ? (
          <div className="w-full rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {quietWarning}
          </div>
        ) : null}

        <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <FluentSearchBox
                size="small"
                value={searchInput}
                onChange={(_event, data) => setSearchInput(data.value)}
                placeholder="Search notifications"
                aria-label="Search notifications"
                className="w-full"
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Switch
                checked={includeArchived}
                onCheckedChange={(checked) => setIncludeArchived(Boolean(checked))}
                size="sm"
                label="Include archived"
                aria-label="Include archived notifications"
              />
              {activeFilterCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="!size-7 !min-w-7 shrink-0 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={clearFilters}
                  title="Clear filters"
                  aria-label="Clear filters"
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Status" size="small">
              <Select
                value={statusFilter}
                onValueChange={(value) => value && setStatusFilter(value as StatusFilterValue)}
              >
                <SelectTrigger size="sm" className="w-full" aria-label="Status filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="rounded-md">All</SelectItem>
                  <SelectItem value="UNREAD" className="rounded-md">Unread</SelectItem>
                  <SelectItem value="READ" className="rounded-md">Read</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Category" size="small">
              <Select
                value={categoryFilter}
                onValueChange={(value) =>
                  value && setCategoryFilter(value as NotificationCategory | "all")
                }
              >
                <SelectTrigger size="sm" className="w-full" aria-label="Category filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="rounded-md">All</SelectItem>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="rounded-md">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Priority" size="small">
              <Select
                value={priorityFilter}
                onValueChange={(value) =>
                  value && setPriorityFilter(value as NotificationPriority | "all")
                }
              >
                <SelectTrigger size="sm" className="w-full" aria-label="Priority filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="rounded-md">All</SelectItem>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="rounded-md">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/60 pt-3 pr-0.5">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {!error && items.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <div className="rounded-full bg-muted p-2.5">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground">
              {activeFilterCount > 0
                ? "Try clearing filters or include archived items."
                : "You're all caught up."}
            </p>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={listAnimationKey}
                className="grid gap-2"
                variants={shouldAnimate ? notificationListVariants : undefined}
                initial={shouldAnimate ? "hidden" : false}
                animate="visible"
              >
                {items.map((row, index) => {
                  const id = readNotificationId(row)
                  const title = readString(row, ["title"]) || notificationTypeLabel(row)
                  const message = readString(row, ["message", "description"])
                  const createdAt = readString(row, ["created_at", "createdAt"])
                  const relatedModule = readString(row, ["related_module", "relatedModule"])
                  const unread = isUnreadNotification(row)
                  const seen = isSeenNotification(row)
                  const archived = isArchivedNotification(row)
                  const priorityLabel = notificationPriorityLabel(row)
                  const categoryLabel = notificationCategoryLabel(row)
                  const busy = id !== null && busyIds.includes(id)
                  const rowKey = id != null ? `notification-${id}` : `notification-${index}`

                  return (
                    <motion.div
                      key={rowKey}
                      layout={shouldAnimate}
                      variants={shouldAnimate ? notificationItemVariants : undefined}
                      initial={shouldAnimate ? "hidden" : false}
                      animate="visible"
                      exit={shouldAnimate ? "exit" : undefined}
                      className={cn("group", archived ? "opacity-75" : null)}
                    >
                      <Card
                        appearance={unread ? "filled-alternative" : "outline"}
                        size="small"
                        className={cn(
                          "relative !flex-row !items-center gap-2 !rounded-lg !px-2.5 !py-2 transition-colors",
                          unread ? "border-primary/25" : null,
                        )}
                      >
                      {unread ? (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                      ) : null}

                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => void handleNotificationClick(row)}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                              unread
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <Bell className="h-3 w-3" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={cn(
                                  "truncate text-[13px] leading-tight tracking-tight text-primary",
                                  unread ? "font-semibold" : "font-medium opacity-90"
                                )}
                              >
                                {title}
                              </p>
                              <div className="flex shrink-0 items-center gap-1">
                                {unread ? (
                                  <span className="rounded-full bg-primary/10 px-1 py-px text-[9px] font-semibold leading-none text-primary">
                                    New
                                  </span>
                                ) : null}
                                {archived ? (
                                  <span className="rounded-full bg-violet-50 px-1 py-px text-[9px] font-medium leading-none text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                                    Arch
                                  </span>
                                ) : null}
                                {createdAt ? (
                                  <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                                    {formatNotificationTime(createdAt)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {message ? (
                              <p className="line-clamp-1 text-[11px] leading-4 text-muted-foreground">
                                {message}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-none">
                              <span className={cn("font-medium", categoryTextClass(categoryLabel))}>
                                {categoryLabel}
                              </span>
                              <span className="text-border">·</span>
                              <span className={cn(priorityTextClass(priorityLabel))}>
                                {priorityLabel}
                              </span>
                              {relatedModule ? (
                                <>
                                  <span className="text-border">·</span>
                                  <span className="text-muted-foreground">
                                    {formatLabel(relatedModule)}
                                  </span>
                                </>
                              ) : null}
                              {!seen ? (
                                <>
                                  <span className="text-border">·</span>
                                  <span className="text-amber-700 dark:text-amber-400">Unseen</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Always-visible inline actions — system primary color */}
                      <div
                        className="flex shrink-0 items-center gap-0.5"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {busy ? (
                          <FluentLoadingIndicator className="mx-1 h-3.5 w-3.5 animate-spin text-primary" />
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                          disabled={busy}
                          title="Open"
                          aria-label={`Open ${title}`}
                          onClick={() => void handleNotificationClick(row)}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                        {!archived && unread ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                            disabled={busy}
                            title="Mark read"
                            aria-label={`Mark ${title} as read`}
                            onClick={() => void handleMarkRead(row)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {!archived && !seen ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                            disabled={busy}
                            title="Mark seen"
                            aria-label={`Mark ${title} as seen`}
                            onClick={() => void handleMarkSeen(row)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {!archived ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                            disabled={busy}
                            title="Archive"
                            aria-label={`Archive ${title}`}
                            onClick={() => void handleArchive(row)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </div>
  )
}
