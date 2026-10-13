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
  ArrowUpRight20Regular as ArrowUpRight,
  Checkmark20Regular as Check,
  Clock20Regular as Clock,
  People20Regular as People,
} from "@fluentui/react-icons"
import { Button } from "@/components/ui/button"
import {
  type AdminRecord,
  type NotificationQueryParams,
} from "@/lib/admin-api"
import {
  DEFAULT_NOTIFICATION_QUERY,
  useNotifications,
} from "@/lib/notifications-store"
import { showErrorAlert } from "@/lib/error-alert"
import {
  isUnreadNotification,
  resolveNotificationUrl,
} from "@/lib/notification-attention"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"
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

function belongsToRequests(row: AdminRecord) {
  const value = [
    readString(row, ["type", "entity_type", "entityType", "related_module", "relatedModule"]),
    readString(row, ["category"]),
  ].join(" ")
  return /request|approval|required|onboarding|leave|offboarding|correction/i.test(value)
}

function belongsToMentions(row: AdminRecord) {
  const explicit = readString(row, ["type", "event_key", "kind"])
  const metadata = row.metadata && typeof row.metadata === "object"
    ? row.metadata as AdminRecord
    : null
  if (/mention/i.test(explicit) || Boolean(readNumber(metadata, ["mentioned_company_user_id", "mention_id"]))) {
    return true
  }
  const recipients = metadata?.mentions ?? metadata?.mentioned_users
  return Array.isArray(recipients) && recipients.length > 0
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

function notificationGroupLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Earlier"
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days < 1) return "Today"
  if (days < 2) return "Yesterday"
  if (days < 7) return "Last week"
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
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

function notificationIconClass(row: AdminRecord) {
  const value = [
    readString(row, ["category"]),
    readString(row, ["type", "entity_type", "entityType"]),
    readString(row, ["related_module", "relatedModule"]),
  ].join(" ").toLowerCase()

  if (/leave|time.?off|attendance/.test(value)) return "text-emerald-600 dark:text-emerald-400"
  if (/payroll|salary|compensation|benefit/.test(value)) return "text-amber-600 dark:text-amber-400"
  if (/onboard|employee|staff|hr/.test(value)) return "text-violet-600 dark:text-violet-400"
  if (/security|auth|access|account/.test(value)) return "text-rose-600 dark:text-rose-400"
  if (/system|technical|integration/.test(value)) return "text-sky-600 dark:text-sky-400"
  if (/request|approval|workflow/.test(value)) return "text-orange-600 dark:text-orange-400"
  return "text-indigo-600 dark:text-indigo-400"
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
    error,
    items,
    loadNotifications: loadNotificationsFromStore,
    loadUnreadCount,
    markAsRead,
    markAsSeen,
    quietWarning,
    setViewState,
    unreadCount,
  } = useNotifications()

  const [busyIds, setBusyIds] = React.useState<number[]>([])
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(() => new Set())
  const [selectionMode, setSelectionMode] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(true)
  const [page, setPage] = React.useState(1)

  const [inboxTab, setInboxTab] = React.useState<"all" | "requests" | "mentions" | "urgent">("all")

  const requestParams = React.useMemo<NotificationQueryParams>(
    () => ({
      ...DEFAULT_NOTIFICATION_QUERY,
      page: 1,
      limit: 50,
      sortBy: "created_at",
      sortOrder: "DESC",
    }),
    []
  )

  const inboxCounts = React.useMemo(() => ({
    all: items.length,
    requests: items.filter(belongsToRequests).length,
    mentions: items.filter(belongsToMentions).length,
    urgent: items.filter((row) => readString(row, ["priority"]).toUpperCase() === "URGENT").length,
  }), [items])
  const visibleItems = React.useMemo(() => items.filter((row) => {
    if (inboxTab === "all") return true
    if (inboxTab === "urgent") return readString(row, ["priority"]).toUpperCase() === "URGENT"
    if (inboxTab === "requests") return belongsToRequests(row)
    return belongsToMentions(row)
  }), [inboxTab, items])

  const toggleSelected = React.useCallback((id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllVisible = React.useCallback(() => {
    setSelectedIds(new Set(visibleItems.map(readNotificationId).filter((id): id is number => id !== null)))
  }, [visibleItems])

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((row) => {
    const id = readNotificationId(row)
    return id !== null && selectedIds.has(id)
  })

  const toggleAllVisible = React.useCallback(() => {
    if (allVisibleSelected) setSelectedIds(new Set())
    else selectAllVisible()
  }, [allVisibleSelected, selectAllVisible])

  const toggleSelectionMode = React.useCallback(() => {
    setSelectionMode((current) => {
      if (current) setSelectedIds(new Set())
      return !current
    })
  }, [])

  const handleBulkAction = React.useCallback(async (action: "read" | "archive") => {
    const ids = action === "read"
      ? Array.from(selectedIds).filter((id) => {
          const row = items.find((item) => readNotificationId(item) === id)
          return row !== undefined && isUnreadNotification(row) && !isArchivedNotification(row)
        })
      : Array.from(selectedIds)
    if (!ids.length) return
    setBusyIds(ids)
    const results = await Promise.allSettled(ids.map((id) => action === "read" ? markAsRead(id) : archiveNotification(id)))
    const failed = results.filter((result) => result.status === "rejected").length
    setBusyIds([])
    setSelectedIds(new Set())
    if (failed) showErrorAlert(`${failed} notification${failed === 1 ? "" : "s"} could not be updated.`)
    else showSuccessAlert(action === "read" ? "Selected notifications marked as read." : "Selected notifications archived.")
  }, [archiveNotification, items, markAsRead, selectedIds])

  const selectedUnreadCount = items.filter((row) => {
    const id = readNotificationId(row)
    return id !== null && selectedIds.has(id) && isUnreadNotification(row) && !isArchivedNotification(row)
  }).length

  const handleLoadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const rows = await loadNotificationsFromStore(
        { ...requestParams, page: nextPage },
        { append: true, notifyOnError: true },
      )
      setHasMore(rows.length >= (requestParams.limit ?? 50))
      setPage(nextPage)
      setViewState(open, { ...requestParams, page: nextPage })
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loadNotificationsFromStore, loadingMore, open, page, requestParams, setViewState])

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
      const [rows] = await Promise.all([
        loadNotificationsFromStore(requestParams, {
          markVisibleSeen,
          notifyOnError: showErrors,
        }),
        loadUnreadCount({ notifyOnError: showErrors }),
      ])
      if ((requestParams.page ?? 1) === 1) {
        setPage(1)
        setHasMore(rows.length >= (requestParams.limit ?? 50))
        setSelectedIds(new Set())
      }
    },
    [loadNotificationsFromStore, loadUnreadCount, requestParams]
  )

  React.useEffect(() => {
    setViewState(open, requestParams)
  }, [open, requestParams, setViewState])

  React.useEffect(() => {
    if (!open) return
    void loadNotifications()
  }, [loadNotifications, open])

  React.useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [onUnreadCountChange, unreadCount])

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
      const unread = isUnreadNotification(row)
      const unseen = !isSeenNotification(row)
      if (!unread && !unseen) return
      markBusy(id, true)
      try {
        await Promise.all([
          unread ? markAsRead(id) : Promise.resolve(null),
          unseen ? markAsSeen(id) : Promise.resolve(null),
        ])
      } catch (errorObject) {
        showErrorAlert(
          errorObject instanceof Error ? errorObject.message : "Failed to mark as read."
        )
      } finally {
        markBusy(id, false)
      }
    },
    [markAsRead, markAsSeen, markBusy]
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

  const shouldReduceMotion = useReducedMotion()
  const shouldAnimate = !shouldReduceMotion

  // Re-stagger when the dialog opens or inbox tab changes.
  const listAnimationKey = React.useMemo(
    () =>
      [
        open ? "open" : "closed",
        inboxTab,
      ].join("|"),
    [inboxTab, open]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2.5">
        <div role="tablist" aria-label="Notification inbox" className="flex w-full items-center gap-2 overflow-x-auto border-b border-border">
          {([
            ["all", "All"],
            ["requests", "Requests"],
            ["mentions", "Mentions"],
            ["urgent", "Urgent"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={inboxTab === key}
              onClick={() => setInboxTab(key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
                inboxTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {key === "requests" ? <People className="size-5" /> : null}
              {key === "mentions" ? <span className="text-xl leading-none">@</span> : null}
              {key === "urgent" ? <Clock className="size-5" /> : null}
              {label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-xs", inboxTab === key ? "bg-primary text-primary-foreground" : "bg-muted")}>{inboxCounts[key]}</span>
            </button>
          ))}
        </div>

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <div className="flex items-center gap-3 text-sm font-medium">
              <span>{selectedIds.size} selected</span>
              <button type="button" className="text-xs text-primary hover:underline" onClick={selectAllVisible}>Select all visible</button>
              <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setSelectedIds(new Set())}>Clear</button>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" disabled={selectedUnreadCount === 0} onClick={() => void handleBulkAction("read")}>Mark read</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void handleBulkAction("archive")}>Archive</Button>
            </div>
          </div>
        ) : null}

        {quietWarning ? (
          <div className="w-full rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {quietWarning}
          </div>
        ) : null}

      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/60 pt-2 pr-0.5">
        <div className="mb-1 flex items-center justify-between px-2">
          <p className="text-[11px] text-muted-foreground">{items.length} loaded</p>
          <div className="flex items-center gap-2">
            {selectionMode ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleAllVisible}
                className="h-8 px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
              >
                {allVisibleSelected ? "Deselect all" : "Select all"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              aria-pressed={selectionMode}
              onClick={toggleSelectionMode}
              className={cn(
                "h-8 gap-1.5 px-2.5 text-xs font-semibold shadow-sm",
                selectionMode
                  ? "ring-2 ring-primary/25 ring-offset-1"
                  : "border-primary/35 text-primary hover:border-primary hover:bg-primary/10 hover:text-primary",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-3.5 items-center justify-center rounded border-2",
                  selectionMode
                    ? "border-primary-foreground bg-primary-foreground text-primary"
                    : "border-primary/70 bg-background",
                )}
              >
                {selectionMode ? <Check className="size-3" /> : null}
              </span>
              {selectionMode ? "Selecting" : "Select notifications"}
            </Button>
          </div>
        </div>
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {!error && visibleItems.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground">
              <Bell className="size-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {inboxTab === "all" ? "You’re all caught up" : `No ${inboxTab} notifications`}
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              {inboxTab === "all"
                ? "New notifications will show up here."
                : "New notifications in this category will show up here."}
            </p>
          </div>
        ) : null}

        {visibleItems.length > 0 ? (
          <div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={listAnimationKey}
                className="grid gap-0"
                variants={shouldAnimate ? notificationListVariants : undefined}
                initial={shouldAnimate ? "hidden" : false}
                animate="visible"
              >
                {visibleItems.map((row, index) => {
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
                  const groupLabel = notificationGroupLabel(createdAt)
                  const previousCreatedAt = index > 0
                    ? readString(visibleItems[index - 1], ["created_at", "createdAt"])
                    : ""
                  const showGroupHeading = index === 0 || notificationGroupLabel(previousCreatedAt) !== groupLabel

                  return (
                    <React.Fragment key={rowKey}>
                    {showGroupHeading ? (
                      <p className="px-3 pb-1.5 pt-3 text-xs font-semibold text-muted-foreground">{groupLabel}</p>
                    ) : null}
                    <motion.div
                      key={`${rowKey}-row`}
                      layout={shouldAnimate}
                      variants={shouldAnimate ? notificationItemVariants : undefined}
                      initial={shouldAnimate ? "hidden" : false}
                      animate="visible"
                      exit={shouldAnimate ? "exit" : undefined}
                      className={cn("group", archived ? "opacity-75" : null)}
                    >
                      <div
                        className={cn(
                          "relative flex items-center gap-2 border-b px-3 py-2 transition-colors",
                          unread ? "border-blue-100 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/35" : "border-border/70 bg-background",
                          id !== null && selectedIds.has(id) ? "border-primary bg-primary/10" : null,
                        )}
                      >
                      {selectionMode ? <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        aria-label={`Select ${title}`}
                        checked={id !== null && selectedIds.has(id)}
                        disabled={id === null}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => id !== null && toggleSelected(id)}
                      /> : <span className="flex w-3 shrink-0 justify-center">{unread ? <span className="size-2 rounded-full bg-blue-600 dark:bg-blue-400" /> : null}</span>}

                      <div
                        role="button"
                        tabIndex={0}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                        onClick={() => {
                          if (selectionMode && id !== null) toggleSelected(id)
                          else void handleNotificationClick(row)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            if (selectionMode && id !== null) toggleSelected(id)
                            else void handleNotificationClick(row)
                          }
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                              unread
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <Bell className={cn("h-4 w-4", notificationIconClass(row))} />
                          </div>
                          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5">
                            <div className="flex min-w-0 items-center gap-1">
                              <span
                                className={cn(
                                  "min-w-0 truncate text-[13px] font-semibold leading-tight tracking-tight text-foreground"
                                )}
                              >
                                {title}
                              </span>
                              {unread ? (
                              <span className="sr-only">Unread</span>
                              ) : null}
                              {archived ? (
                                <span className="shrink-0 rounded-full bg-violet-50 px-1 py-px text-[9px] font-medium leading-none text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                                  Archived
                                </span>
                              ) : null}
                            </div>
                            {createdAt ? (
                                <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                                {formatNotificationTime(createdAt)}
                              </span>
                            ) : <span />}
                            {message ? (
                              <p className="col-span-2 line-clamp-2 text-xs leading-tight text-muted-foreground">
                                {message}
                              </p>
                            ) : null}
                            <div className="col-span-2 flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
                              <span className={cn("font-medium", categoryTextClass(categoryLabel))}>{categoryLabel}</span>
                              {relatedModule ? <><span>·</span><span>{formatLabel(relatedModule)}</span></> : null}
                              {priorityLabel === "Urgent" ? <span className={cn("font-medium", priorityTextClass(priorityLabel))}>· Urgent</span> : null}
                              {!seen ? <span>· Unseen</span> : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Always-visible inline actions — system primary color */}
                      <div
                        className="relative flex shrink-0 items-center gap-0"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {busy ? (
                          <span
                            role="status"
                            aria-label="Updating notification"
                            className="absolute -left-4 top-1/2 z-10 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-primary/20 border-t-primary bg-background"
                          />
                        ) : null}
                            <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="!size-10 !min-w-10 !p-0 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                          disabled={busy}
                          title="Open"
                          aria-label={`Open ${title}`}
                          onClick={() => void handleNotificationClick(row)}
                        >
                          <ArrowUpRight className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                        </Button>
                        {!archived && unread ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="!size-10 !min-w-10 !p-0 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                            disabled={busy}
                            title="Mark read"
                            aria-label={`Mark ${title} as read`}
                            onClick={() => void handleMarkRead(row)}
                          >
                            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          </Button>
                        ) : null}
                        {!archived ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="!size-10 !min-w-10 !p-0 rounded-md text-primary hover:bg-primary/10 hover:text-primary"
                            disabled={busy}
                            title="Archive"
                            aria-label={`Archive ${title}`}
                            onClick={() => void handleArchive(row)}
                          >
                            <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          </Button>
                        ) : null}
                      </div>
                      </div>
                    </motion.div>
                    </React.Fragment>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : null}
        {hasMore && visibleItems.length > 0 ? (
          <div className="flex justify-center py-4">
            <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void handleLoadMore()}>
              {loadingMore ? <FluentLoadingIndicator className="mr-2 size-4 animate-spin" /> : null}
              {loadingMore ? "Loading notifications…" : "Load more notifications"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
