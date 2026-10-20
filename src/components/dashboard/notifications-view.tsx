"use client"

import { resolveLeaveNotificationUrl } from "@/lib/notification-attention"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArchiveIcon, ArrowUpRightIcon, CheckIcon, RefreshCwIcon, RotateCcwIcon, ToggleLeftIcon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"
import { FluentSearchBox } from "@/components/common/fluent-search-box"

import { formatAdminValue } from "@/components/dashboard/admin-view-shared"
import {
  createTestNotification,
  deleteNotification,
  getNotificationChannelRegistryItem,
  getNotificationChannelSetting,
  getNotificationDelivery,
  getNotificationMailLog,
  getNotificationRule,
  getNotificationTemplate,
  getPlatformNotificationMailLog,
  listNotificationChannelRegistry,
  listNotificationChannelSettings,
  listNotificationDeliveries,
  listNotificationMailLogs,
  listNotificationRules,
  listNotificationTemplates,
  listNotifications,
  listPlatformNotificationChannelRegistry,
  listPlatformNotificationChannelSettings,
  listPlatformNotificationMailLogs,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  markNotificationAsSeen,
  retryPlatformNotificationMailLog,
  retryNotificationMailLog,
  updateNotificationRule,
  updateNotificationTemplate,
  updateNotificationChannelRegistryItem,
  updateNotificationChannelSetting,
  updatePlatformNotificationChannelRegistryItem,
  updatePlatformNotificationChannelSetting,
  type AdminRecord,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationChannelRegistryItem,
  type NotificationChannelSetting,
  type NotificationDeliveryStatus,
  type NotificationItem,
  type NotificationMailLogStatus,
  type NotificationPriority,
  type NotificationQueryParams,
  type NotificationTemplateStatus,
} from "@/lib/admin-api"
import { DEFAULT_NOTIFICATION_QUERY, useNotifications } from "@/lib/notifications-store"
import { readStoredSessionTokens } from "@/lib/session-client"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { decodeJwtPayload } from "@/lib/dashboard-permissions"
import { Badge } from "@/components/ui/badge"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type NotificationsTab =
  | "inbox"
  | "deliveries"
  | "settings"
  | "mail-logs"
  | "templates"
  | "rules"
  | "registry"
  | "platform-registry"
  | "platform-settings"
  | "platform-mail-logs"
type InboxStatusFilterValue = "all" | "UNREAD" | "READ"
type DeliveryStatusFilterValue = "all" | NotificationDeliveryStatus
type MailLogStatusFilterValue = "all" | NotificationMailLogStatus
type ChannelFilterValue = "all" | NotificationChannel
type TemplateStatusFilterValue = "all" | NotificationTemplateStatus
type RuleEnabledFilterValue = "all" | "enabled" | "disabled"

const TABS: Array<{ id: NotificationsTab; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "deliveries", label: "Deliveries" },
  { id: "settings", label: "Channel Settings" },
  { id: "templates", label: "Templates" },
  { id: "rules", label: "Rules" },
  { id: "mail-logs", label: "Mail Logs" },
  { id: "registry", label: "Channel Registry" },
  { id: "platform-registry", label: "Platform Registry" },
  { id: "platform-settings", label: "Platform Settings" },
  { id: "platform-mail-logs", label: "Platform Mail Logs" },
]

const PLATFORM_NOTIFICATION_TABS = new Set<NotificationsTab>([
  "platform-registry",
  "platform-settings",
  "platform-mail-logs",
])

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

const CHANNEL_OPTIONS: Array<{ value: NotificationChannel; label: string }> = [
  { value: "IN_APP", label: "In-app" },
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "PUSH", label: "Push" },
]

const DELIVERY_STATUSES: NotificationDeliveryStatus[] = [
  "PENDING",
  "DELIVERED",
  "FAILED",
  "SKIPPED",
]

const MAIL_LOG_STATUSES: NotificationMailLogStatus[] = [
  "PENDING",
  "SENT",
  "SKIPPED",
  "FAILED",
]

const inputClass =
  "h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null
}

function readString(
  row: AdminRecord | null | undefined,
  keys: string[],
  fallback = "",
) {
  if (!row) return fallback
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return fallback
}

function readNumber(row: AdminRecord | null | undefined, keys: string[]) {
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

function readBoolean(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") return value
    if (typeof value === "number") {
      if (value === 1) return true
      if (value === 0) return false
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (["true", "1", "yes"].includes(normalized)) return true
      if (["false", "0", "no"].includes(normalized)) return false
    }
  }
  return null
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

function formatLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function readMetadata(row: AdminRecord | null | undefined) {
  return asRecord(row?.metadata)
}

function statusTone(label: string) {
  const normalized = label.toUpperCase()
  if (["UNREAD", "PENDING"].includes(normalized)) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"
  }
  if (["READ", "SEEN", "DELIVERED", "SENT", "ENABLED", "ACTIVE"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
  }
  if (["FAILED", "DISABLED"].includes(normalized)) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
  }
  if (["ARCHIVED", "SKIPPED", "HIGH", "URGENT"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
  }
  return "border-border bg-muted/40 text-muted-foreground"
}

function appendRequestHighlight(url: string, requestId: string) {
  if (!url.startsWith("/") || !requestId) {
    return url
  }

  const [pathWithQuery, hash = ""] = url.split("#")
  const [path, query = ""] = pathWithQuery.split("?")
  const params = new URLSearchParams(query)
  if (!params.has("highlight") && !params.has("requestId") && !params.has("request_id")) {
    params.set("highlight", requestId)
  }
  const nextQuery = params.toString()
  return `${path}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`
}

function readNotificationId(row: AdminRecord | null | undefined) {
  return readNumber(row, ["id", "notification_id", "notificationId"])
}

function isUnreadNotification(row: AdminRecord | null | undefined) {
  const status = readString(row, ["status"]).toUpperCase()
  if (status === "READ") return false
  if (status === "UNREAD") return true
  return !readString(row, ["read_at", "readAt"])
}

function isSeenNotification(row: AdminRecord | null | undefined) {
  const explicit = readBoolean(row, ["seen", "is_seen", "isSeen"])
  if (explicit !== null) return explicit
  return Boolean(readString(row, ["seen_at", "seenAt"]))
}

function isArchivedNotification(row: AdminRecord | null | undefined) {
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

function notificationStatusLabel(row: AdminRecord | null | undefined) {
  if (isArchivedNotification(row)) return "Archived"
  return isUnreadNotification(row) ? "Unread" : "Read"
}

function notificationSeenLabel(row: AdminRecord | null | undefined) {
  return isSeenNotification(row) ? "Seen" : "Unseen"
}

function notificationTypeLabel(row: AdminRecord | null | undefined) {
  const type = readString(row, ["type", "entity_type", "entityType"])
  return type ? formatLabel(type) : "Notification"
}

function notificationCategoryLabel(row: AdminRecord | null | undefined) {
  const category = readString(row, ["category"]).toUpperCase()
  return category ? formatLabel(category) : "General"
}

function notificationPriorityLabel(row: AdminRecord | null | undefined) {
  const priority = readString(row, ["priority"]).toUpperCase()
  return priority ? formatLabel(priority) : "Low"
}

function resolveNotificationUrl(row: AdminRecord) {
  const leaveDestination = resolveLeaveNotificationUrl(row)
  if (leaveDestination) return leaveDestination
  const direct = readString(row, ["action_url", "actionUrl", "url", "link"])
  const metadata = readMetadata(row)
  const requestId =
    readString(row, ["entity_id", "entityId", "request_id", "requestId"]) ||
    readString(metadata, ["request_id", "requestId", "entity_id", "entityId"])

  if (direct.startsWith("/")) return appendRequestHighlight(direct, requestId)

  if (metadata) {
    const nested = readString(metadata, ["action_url", "actionUrl", "url", "link"])
    if (nested.startsWith("/")) return appendRequestHighlight(nested, requestId)
  }

  const entityType = (
    readString(row, ["entity_type", "entityType", "type"]) ||
    readString(metadata, ["entity_type", "entityType", "type"])
  ).toLowerCase()

  const destinationByType: Record<string, string> = {
    profile_update_request: "/dashboard/employees/profile-update-approvals",
    profile_update_submitted: "/dashboard/employees/profile-update-approvals",
    attendance_correction_request: "/dashboard/attendance/correction-requests",
    attendance_correction_submitted: "/dashboard/attendance/correction-requests",
    leave_request: "/dashboard/leave-management/requests",
    leave_request_submitted: "/dashboard/leave-management/requests",
    onboarding_request: "/dashboard/employees/onboarding",
    onboarding_request_submitted: "/dashboard/employees/onboarding",
    offboarding_request: "/dashboard/employees/offboarding",
    offboarding_request_submitted: "/dashboard/employees/offboarding",
  }

  return appendRequestHighlight(destinationByType[entityType] ?? "/dashboard", requestId)
}

function readDeliveryId(row: AdminRecord | null | undefined) {
  return readNumber(row, ["id", "delivery_id", "deliveryId"])
}

function deliveryChannelLabel(row: AdminRecord | null | undefined) {
  const channel = readString(row, ["channel", "delivery_channel"]).toUpperCase()
  return channel ? formatLabel(channel) : "—"
}

function deliveryStatusLabel(row: AdminRecord | null | undefined) {
  const status = readString(row, ["status", "delivery_status", "deliveryStatus"]).toUpperCase()
  return status ? formatLabel(status) : "—"
}

function deliveryRecipientLabel(row: AdminRecord | null | undefined) {
  return (
    readString(row, [
      "recipient_email",
      "recipientEmail",
      "emailAddress",
      "email_address",
      "receiver_name",
      "receiverName",
      "display_name",
      "displayName",
    ]) ||
    (readNumber(row, ["receiver_company_user_id", "receiverCompanyUserId"]) !== null
      ? `Company user #${readNumber(row, ["receiver_company_user_id", "receiverCompanyUserId"])}`
      : "—")
  )
}

function deliveryTitle(row: AdminRecord | null | undefined) {
  return (
    readString(row, [
      "title",
      "notification_title",
      "notificationTitle",
      "notificationName",
      "notification_name",
      "subject",
    ]) ||
    `Notification #${readNumber(row, ["notification_id", "notificationId", "id"]) ?? "—"}`
  )
}

function readChannelSettingKey(row: AdminRecord | null | undefined) {
  return readString(row, ["channel"]).toUpperCase()
}

function readRegistryCode(row: AdminRecord | null | undefined) {
  return readString(row, ["code"]).toUpperCase()
}

function readRegistryIdentity(row: AdminRecord | null | undefined) {
  const channel = readChannelSettingKey(row)
  const code = readRegistryCode(row)
  return channel && code ? `${channel}:${code}` : ""
}

function readTemplateId(row: AdminRecord | null | undefined) {
  return readNumber(row, ["id", "template_id", "templateId"])
}

function readTemplateCode(row: AdminRecord | null | undefined) {
  return readString(row, ["template_code", "templateCode", "code"]).toUpperCase()
}

function templateStatusLabel(row: AdminRecord | null | undefined) {
  return readString(row, ["status"], "ACTIVE").toUpperCase() === "ACTIVE" ? "Active" : "Inactive"
}

function templateEnabled(row: AdminRecord | null | undefined) {
  return templateStatusLabel(row) === "Active"
}

function readRuleId(row: AdminRecord | null | undefined) {
  return readNumber(row, ["id", "rule_id", "ruleId"])
}

function readRuleType(row: AdminRecord | null | undefined) {
  return readString(row, ["notificationType", "notification_type"], "GENERAL")
}

function readRuleEvent(row: AdminRecord | null | undefined) {
  return readString(row, ["triggerEvent", "trigger_event"], "notification.triggered")
}

function ruleEnabled(row: AdminRecord | null | undefined) {
  return readBoolean(row, ["enabled", "is_enabled", "isEnabled"]) !== false
}

function ruleStatusLabel(row: AdminRecord | null | undefined) {
  return ruleEnabled(row) ? "Enabled" : "Disabled"
}

function channelSettingEnabled(row: AdminRecord | null | undefined) {
  return Boolean(readBoolean(row, ["isEnabled", "is_enabled"]))
}

function channelSettingStatusLabel(row: AdminRecord | null | undefined) {
  return channelSettingEnabled(row) ? "Enabled" : "Disabled"
}

function registryStatusLabel(row: AdminRecord | null | undefined) {
  return channelSettingEnabled(row) ? "Enabled" : "Disabled"
}

function readMailLogId(row: AdminRecord | null | undefined) {
  return readNumber(row, ["id", "mail_log_id", "mailLogId"])
}

function mailLogStatusLabel(row: AdminRecord | null | undefined) {
  const status = readString(row, ["status"]).toUpperCase()
  return status ? formatLabel(status) : "—"
}

function mailLogMethodLabel(row: AdminRecord | null | undefined) {
  return (
    readString(row, ["method", "delivery_method", "deliveryMethod"]).toUpperCase() ||
    "EMAIL"
  )
}

function mailLogRecipient(row: AdminRecord | null | undefined) {
  return readString(
    row,
    ["recipient_email", "recipientEmail", "email", "to_email", "toEmail"],
    "—",
  )
}

function mailLogSubject(row: AdminRecord | null | undefined) {
  return (
    readString(row, ["subject", "title", "notificationName", "notification_name"]) ||
    "Email notification"
  )
}

function canRetryMailLog(row: AdminRecord | null | undefined) {
  const status = readString(row, ["status"]).toUpperCase()
  return status === "FAILED" || status === "SKIPPED"
}

function rowIdentity(tab: NotificationsTab, row: AdminRecord | null | undefined) {
  if (!row) return ""
  if (tab === "settings") {
    return readChannelSettingKey(row)
  }
  if (tab === "platform-settings") {
    return readChannelSettingKey(row)
  }
  if (tab === "registry") {
    return readRegistryIdentity(row)
  }
  if (tab === "platform-registry") {
    return readRegistryIdentity(row)
  }
  if (tab === "templates") {
    return String(readTemplateId(row) ?? "")
  }
  if (tab === "rules") {
    return String(readRuleId(row) ?? "")
  }
  if (tab === "deliveries") {
    return String(readDeliveryId(row) ?? "")
  }
  if (tab === "mail-logs") {
    return String(readMailLogId(row) ?? "")
  }
  if (tab === "platform-mail-logs") {
    return String(readMailLogId(row) ?? "")
  }
  return String(readNotificationId(row) ?? "")
}

function metadataEntries(row: AdminRecord | null) {
  const metadata = readMetadata(row)
  if (!metadata) return []
  return Object.entries(metadata).filter(
    ([, value]) =>
      value !== null && value !== undefined && formatAdminValue(value) !== "-",
  )
}

function renderSummaryCards(items: Array<[string, string]>) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-xs font-medium text-foreground break-words">{value}</p>
        </div>
      ))}
    </div>
  )
}

export function NotificationsView() {
  const router = useRouter()
  const actor = useDashboardActor()
  const { loadUnreadCount } = useNotifications()
  const [tab, setTab] = React.useState<NotificationsTab>("inbox")
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [searchInput, setSearchInput] = React.useState("")
  const deferredSearch = React.useDeferredValue(searchInput.trim())
  const [inboxStatusFilter, setInboxStatusFilter] =
    React.useState<InboxStatusFilterValue>("all")
  const [categoryFilter, setCategoryFilter] =
    React.useState<NotificationCategory | "all">("all")
  const [priorityFilter, setPriorityFilter] =
    React.useState<NotificationPriority | "all">("all")
  const [includeArchived, setIncludeArchived] = React.useState(false)
  const [deliveryStatusFilter, setDeliveryStatusFilter] =
    React.useState<DeliveryStatusFilterValue>("all")
  const [channelFilter, setChannelFilter] =
    React.useState<ChannelFilterValue>("all")
  const [mailLogStatusFilter, setMailLogStatusFilter] =
    React.useState<MailLogStatusFilterValue>("all")
  const [templateStatusFilter, setTemplateStatusFilter] =
    React.useState<TemplateStatusFilterValue>("all")
  const [ruleEnabledFilter, setRuleEnabledFilter] =
    React.useState<RuleEnabledFilterValue>("all")
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [selectedRow, setSelectedRow] = React.useState<AdminRecord | null>(null)
  const [busyKeys, setBusyKeys] = React.useState<string[]>([])
  const [markingAllRead, setMarkingAllRead] = React.useState(false)
  const [sendingTestNotification, setSendingTestNotification] = React.useState(false)
  const loadRequestIdRef = React.useRef(0)
  const isPlatformAdmin = actor.scope === "platform"
  const availableTabs = React.useMemo(
    () =>
      TABS.filter((entry) =>
        PLATFORM_NOTIFICATION_TABS.has(entry.id) ? isPlatformAdmin : !isPlatformAdmin
      ),
    [isPlatformAdmin]
  )
  const unreadInboxCount = React.useMemo(
    () => (tab === "inbox" ? rows.filter((row) => !isArchivedNotification(row) && isUnreadNotification(row)).length : 0),
    [rows, tab]
  )
  const canSendTestNotification = React.useMemo(
    () => readCurrentCompanyUserId() !== null,
    []
  )

  React.useEffect(() => {
    if (!actor.ready) return
    setTab((current) => {
      if (isPlatformAdmin) {
        return PLATFORM_NOTIFICATION_TABS.has(current) ? current : "platform-settings"
      }
      return PLATFORM_NOTIFICATION_TABS.has(current) ? "inbox" : current
    })
  }, [actor.ready, isPlatformAdmin])

  const activeFilterCount =
    tab === "inbox"
      ? [
          Boolean(deferredSearch),
          inboxStatusFilter !== "all",
          categoryFilter !== "all",
          priorityFilter !== "all",
          includeArchived,
        ].filter(Boolean).length
      : tab === "deliveries"
        ? [Boolean(deferredSearch), deliveryStatusFilter !== "all", channelFilter !== "all"].filter(Boolean).length
        : tab === "registry" || tab === "platform-registry"
          ? [Boolean(deferredSearch), channelFilter !== "all"].filter(Boolean).length
        : tab === "templates"
          ? [Boolean(deferredSearch), templateStatusFilter !== "all"].filter(Boolean).length
        : tab === "rules"
          ? [Boolean(deferredSearch), ruleEnabledFilter !== "all"].filter(Boolean).length
        : tab === "mail-logs"
          ? [Boolean(deferredSearch), mailLogStatusFilter !== "all"].filter(Boolean).length
          : tab === "platform-mail-logs"
            ? [Boolean(deferredSearch), mailLogStatusFilter !== "all"].filter(Boolean).length
          : 0

  const markBusy = React.useCallback((key: string, busy: boolean) => {
    setBusyKeys((current) => {
      if (busy) return current.includes(key) ? current : [...current, key]
      return current.filter((entry) => entry !== key)
    })
  }, [])

  const syncUnreadCount = React.useCallback(() => {
    void loadUnreadCount({ notifyOnError: false })
  }, [loadUnreadCount])

  const loadRows = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setRows([])
      setError("Authentication required. Please sign in again.")
      return
    }

    const requestId = loadRequestIdRef.current + 1
    loadRequestIdRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      if (tab === "inbox") {
        const result = await listNotifications(token, {
          ...DEFAULT_NOTIFICATION_QUERY,
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
          ...(deferredSearch ? { search: deferredSearch } : {}),
          ...(inboxStatusFilter !== "all" ? { status: inboxStatusFilter } : {}),
          ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
          ...(priorityFilter !== "all" ? { priority: priorityFilter } : {}),
          ...(includeArchived ? { include_archived: true } : {}),
        } as NotificationQueryParams)
        if (loadRequestIdRef.current !== requestId) return
        setRows(result.rows ?? [])
        return
      }

      if (tab === "deliveries") {
        const result = await listNotificationDeliveries(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
          ...(deferredSearch ? { search: deferredSearch } : {}),
          ...(deliveryStatusFilter !== "all" ? { status: deliveryStatusFilter } : {}),
          ...(channelFilter !== "all" ? { channel: channelFilter } : {}),
        })
        if (loadRequestIdRef.current !== requestId) return
        setRows(result.rows ?? [])
        return
      }

      if (tab === "settings") {
        const result = await listNotificationChannelSettings(token)
        if (loadRequestIdRef.current !== requestId) return
        setRows(result)
        return
      }

      if (tab === "platform-settings") {
        const result = await listPlatformNotificationChannelSettings(token)
        if (loadRequestIdRef.current !== requestId) return
        setRows(result)
        return
      }

      if (tab === "registry") {
        const result = await listNotificationChannelRegistry(token, {
          ...(deferredSearch ? { search: deferredSearch } : {}),
          ...(channelFilter !== "all" ? { channel: channelFilter } : {}),
        })
        if (loadRequestIdRef.current !== requestId) return
        setRows(result)
        return
      }

      if (tab === "platform-registry") {
        const result = await listPlatformNotificationChannelRegistry(token, {
          ...(deferredSearch ? { search: deferredSearch } : {}),
          ...(channelFilter !== "all" ? { channel: channelFilter } : {}),
        })
        if (loadRequestIdRef.current !== requestId) return
        setRows(result)
        return
      }

      if (tab === "templates") {
        const result = await listNotificationTemplates(token, {
          ...(deferredSearch ? { search: deferredSearch } : {}),
          ...(templateStatusFilter !== "all" ? { status: templateStatusFilter } : {}),
        })
        if (loadRequestIdRef.current !== requestId) return
        setRows(result)
        return
      }

      if (tab === "rules") {
        const result = await listNotificationRules(token, {
          ...(deferredSearch ? { search: deferredSearch } : {}),
          ...(ruleEnabledFilter !== "all" ? { enabled: ruleEnabledFilter === "enabled" } : {}),
        })
        if (loadRequestIdRef.current !== requestId) return
        setRows(result)
        return
      }

      if (tab === "platform-mail-logs") {
        const result = await listPlatformNotificationMailLogs(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
          ...(deferredSearch ? { search: deferredSearch } : {}),
          ...(mailLogStatusFilter !== "all" ? { status: mailLogStatusFilter } : {}),
        })
        if (loadRequestIdRef.current !== requestId) return
        setRows(result.rows ?? [])
        return
      }

      const result = await listNotificationMailLogs(token, {
        page: 1,
        limit: 100,
        sortBy: "created_at",
        sortOrder: "DESC",
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(mailLogStatusFilter !== "all" ? { status: mailLogStatusFilter } : {}),
      })
      if (loadRequestIdRef.current !== requestId) return
      setRows(result.rows ?? [])
    } catch (errorObject) {
      if (loadRequestIdRef.current !== requestId) return
      setRows([])
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load notification data.",
      )
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [
    categoryFilter,
    channelFilter,
    deferredSearch,
    deliveryStatusFilter,
    inboxStatusFilter,
    includeArchived,
    mailLogStatusFilter,
    priorityFilter,
    ruleEnabledFilter,
    tab,
    templateStatusFilter,
  ])

  React.useEffect(() => {
    void loadRows()
  }, [loadRows])

  React.useEffect(() => {
    setSelectedRow(null)
    setDetailOpen(false)
    setDetailLoading(false)
    setSearchInput("")
    setError(null)
  }, [tab])

  React.useEffect(() => {
    if (!selectedRow) return
    const identity = rowIdentity(tab, selectedRow)
    if (!identity) return
    const nextSelected = rows.find((row) => rowIdentity(tab, row) === identity) ?? null
    setSelectedRow(nextSelected)
    if (!nextSelected) {
      setDetailOpen(false)
    }
  }, [rows, selectedRow, tab])

  const updateRow = React.useCallback(
    (targetTab: NotificationsTab, key: string, nextRow: AdminRecord | null, remove = false) => {
      setRows((current) => {
        if (remove) {
          return current.filter((row) => rowIdentity(targetTab, row) !== key)
        }
        return current.map((row) =>
          rowIdentity(targetTab, row) === key ? nextRow ?? row : row,
        )
      })
      setSelectedRow((current) => {
        if (!current || rowIdentity(targetTab, current) !== key) {
          return current
        }
        return remove ? null : nextRow ?? current
      })
      if (remove) {
        setDetailOpen(false)
      }
    },
    [],
  )

  const openDetail = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      setSelectedRow(row)
      setDetailOpen(true)

      if (!token) return
      if (tab === "inbox") return

      setDetailLoading(true)
      try {
        if (tab === "deliveries") {
          const id = readDeliveryId(row)
          if (id !== null) {
            const detail = await getNotificationDelivery(token, id)
            if (detail) setSelectedRow(detail)
          }
        } else if (tab === "registry") {
          const channel = readChannelSettingKey(row)
          const code = readRegistryCode(row)
          if (channel && code) {
            const detail = await getNotificationChannelRegistryItem(token, channel, code)
            if (detail) setSelectedRow(detail)
          }
        } else if (tab === "platform-registry") {
          setSelectedRow(row)
        } else if (tab === "settings") {
          const channel = readChannelSettingKey(row)
          if (channel) {
            const detail = await getNotificationChannelSetting(token, channel)
            if (detail) setSelectedRow(detail)
          }
        } else if (tab === "platform-settings") {
          setSelectedRow(row)
        } else if (tab === "templates") {
          const id = readTemplateId(row)
          if (id !== null) {
            const detail = await getNotificationTemplate(token, id)
            if (detail) setSelectedRow(detail)
          }
        } else if (tab === "rules") {
          const id = readRuleId(row)
          if (id !== null) {
            const detail = await getNotificationRule(token, id)
            if (detail) setSelectedRow(detail)
          }
        } else if (tab === "mail-logs") {
          const id = readMailLogId(row)
          if (id !== null) {
            const detail = await getNotificationMailLog(token, id)
            if (detail) setSelectedRow(detail)
          }
        } else if (tab === "platform-mail-logs") {
          const id = readMailLogId(row)
          if (id !== null) {
            const detail = await getPlatformNotificationMailLog(token, id)
            if (detail) setSelectedRow(detail)
          }
        }
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to load the selected record.",
        )
      } finally {
        setDetailLoading(false)
      }
    },
    [tab],
  )

  const handleMarkRead = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const id = readNotificationId(row)
      const unread = isUnreadNotification(row)
      const unseen = !isSeenNotification(row)
      if (!token || id === null || isArchivedNotification(row) || (!unread && !unseen)) {
        return
      }

      const key = rowIdentity("inbox", row)
      markBusy(key, true)
      try {
        const [readUpdated, seenUpdated] = await Promise.all([
          unread ? markNotificationAsRead(token, id) : Promise.resolve(null),
          unseen ? markNotificationAsSeen(token, id) : Promise.resolve(null),
        ])
        const updated = seenUpdated ?? readUpdated
        updateRow(
          "inbox",
          key,
          (updated as NotificationItem | null) ?? {
            ...row,
            status: "READ",
            read_at: new Date().toISOString(),
            seen: true,
            seen_at: new Date().toISOString(),
          },
        )
        syncUnreadCount()
        toast.success("Notification marked as read.")
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to mark notification as read.",
        )
      } finally {
        markBusy(key, false)
      }
    },
    [markBusy, syncUnreadCount, updateRow],
  )

  const handleMarkAllRead = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token || unreadInboxCount === 0) {
      return
    }

    setMarkingAllRead(true)
    try {
      await markAllNotificationsAsRead(token)
      await Promise.all([loadRows(), Promise.resolve(syncUnreadCount())])
      toast.success("All notifications marked as read.")
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to mark all notifications as read.",
      )
    } finally {
      setMarkingAllRead(false)
    }
  }, [loadRows, syncUnreadCount, unreadInboxCount])

  const handleSendTestNotification = React.useCallback(async () => {
    const token = readStoredToken()
    const receiverCompanyUserId = readCurrentCompanyUserId()
    if (!token || receiverCompanyUserId === null) {
      toast.error("Could not determine the current company user for a test notification.")
      return
    }

    setSendingTestNotification(true)
    try {
      await createTestNotification(token, {
        receiver_company_user_id: receiverCompanyUserId,
        title: "Dashboard test notification",
        message: `Triggered from notifications on ${new Date().toLocaleString()}.`,
        type: "dashboard_test",
        category: "SYSTEM",
        priority: "LOW",
        related_module: "notifications",
        entity_type: "notification",
        entity_id: "operations-notifications",
        action_url: "/dashboard/operations/notifications",
        dedupe_key: `operations-notifications-test-${Date.now()}`,
        metadata: {
          source: "operations-notifications",
          triggered_at: new Date().toISOString(),
        },
      })
      await Promise.all([loadRows(), Promise.resolve(syncUnreadCount())])
      toast.success("Test notification sent.")
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to send the test notification.",
      )
    } finally {
      setSendingTestNotification(false)
    }
  }, [loadRows, syncUnreadCount])

  const handleArchiveNotification = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const id = readNotificationId(row)
      if (!token || id === null || isArchivedNotification(row)) return

      const key = rowIdentity("inbox", row)
      markBusy(key, true)
      try {
        await deleteNotification(token, id)
        updateRow("inbox", key, null, true)
        syncUnreadCount()
        toast.success("Notification archived.")
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to archive notification.",
        )
      } finally {
        markBusy(key, false)
      }
    },
    [markBusy, syncUnreadCount, updateRow],
  )

  const handleOpenTarget = React.useCallback(
    async (row: AdminRecord) => {
      if (!isArchivedNotification(row)) {
        await handleMarkRead(row)
      }
      setDetailOpen(false)
      router.push(resolveNotificationUrl(row))
    },
    [handleMarkRead, router],
  )

  const handleToggleChannelSetting = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const channel = readChannelSettingKey(row)
      if (!token || !channel) return

      const key = rowIdentity("settings", row)
      markBusy(key, true)
      try {
        const updated = await updateNotificationChannelSetting(token, channel, {
          is_enabled: !channelSettingEnabled(row),
        })
        updateRow(
          "settings",
          key,
          (updated as NotificationChannelSetting | null) ?? {
            ...row,
            isEnabled: !channelSettingEnabled(row),
          },
        )
        toast.success(
          !channelSettingEnabled(row)
            ? `${formatLabel(channel)} notifications enabled.`
            : `${formatLabel(channel)} notifications disabled.`,
        )
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to update channel setting.",
        )
      } finally {
        markBusy(key, false)
      }
    },
    [markBusy, updateRow],
  )

  const handleTogglePlatformChannelSetting = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const channel = readChannelSettingKey(row)
      if (!token || !channel) return

      const key = rowIdentity("platform-settings", row)
      markBusy(key, true)
      try {
        const updated = await updatePlatformNotificationChannelSetting(token, channel, {
          is_enabled: !channelSettingEnabled(row),
        })
        updateRow(
          "platform-settings",
          key,
          (updated as NotificationChannelSetting | null) ?? {
            ...row,
            isEnabled: !channelSettingEnabled(row),
          },
        )
        toast.success(
          !channelSettingEnabled(row)
            ? `${formatLabel(channel)} platform notifications enabled.`
            : `${formatLabel(channel)} platform notifications disabled.`,
        )
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to update platform channel setting.",
        )
      } finally {
        markBusy(key, false)
      }
    },
    [markBusy, updateRow],
  )

  const handleToggleRegistryItem = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const channel = readChannelSettingKey(row)
      const code = readRegistryCode(row)
      if (!token || !channel || !code) return

      const key = rowIdentity("registry", row)
      markBusy(key, true)
      try {
        const updated = await updateNotificationChannelRegistryItem(token, channel, code, {
          is_enabled: !channelSettingEnabled(row),
        })
        updateRow(
          "registry",
          key,
          (updated as NotificationChannelRegistryItem | null) ?? {
            ...row,
            isEnabled: !channelSettingEnabled(row),
          },
        )
        toast.success(
          !channelSettingEnabled(row)
            ? `${formatLabel(code)} enabled for ${formatLabel(channel)}.`
            : `${formatLabel(code)} disabled for ${formatLabel(channel)}.`,
        )
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to update channel registry item.",
        )
      } finally {
        markBusy(key, false)
      }
    },
    [markBusy, updateRow],
  )

  const handleTogglePlatformRegistryItem = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const channel = readChannelSettingKey(row)
      const code = readRegistryCode(row)
      if (!token || !channel || !code) return

      const key = rowIdentity("platform-registry", row)
      markBusy(key, true)
      try {
        const updated = await updatePlatformNotificationChannelRegistryItem(
          token,
          channel,
          code,
          {
            is_enabled: !channelSettingEnabled(row),
          },
        )
        updateRow(
          "platform-registry",
          key,
          (updated as NotificationChannelRegistryItem | null) ?? {
            ...row,
            isEnabled: !channelSettingEnabled(row),
          },
        )
        toast.success(
          !channelSettingEnabled(row)
            ? `${formatLabel(code)} enabled for platform ${formatLabel(channel)}.`
            : `${formatLabel(code)} disabled for platform ${formatLabel(channel)}.`,
        )
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to update platform channel registry item.",
        )
      } finally {
        markBusy(key, false)
      }
    },
    [markBusy, updateRow],
  )

  const handleToggleTemplate = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const id = readTemplateId(row)
      if (!token || id === null) return

      const key = rowIdentity("templates", row)
      markBusy(key, true)
      try {
        const updated = await updateNotificationTemplate(token, id, {
          status: templateEnabled(row) ? "INACTIVE" : "ACTIVE",
        })
        updateRow(
          "templates",
          key,
          (updated as AdminRecord | null) ?? {
            ...row,
            status: templateEnabled(row) ? "INACTIVE" : "ACTIVE",
          },
        )
        toast.success(
          templateEnabled(row)
            ? "Notification template deactivated."
            : "Notification template activated.",
        )
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to update notification template.",
        )
      } finally {
        markBusy(key, false)
      }
    },
    [markBusy, updateRow],
  )

  const handleToggleRule = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const id = readRuleId(row)
      if (!token || id === null) return

      const key = rowIdentity("rules", row)
      markBusy(key, true)
      try {
        const updated = await updateNotificationRule(token, id, {
          enabled: !ruleEnabled(row),
        })
        updateRow(
          "rules",
          key,
          (updated as AdminRecord | null) ?? {
            ...row,
            enabled: !ruleEnabled(row),
          },
        )
        toast.success(ruleEnabled(row) ? "Notification rule disabled." : "Notification rule enabled.")
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to update notification rule.",
        )
      } finally {
        markBusy(key, false)
      }
    },
    [markBusy, updateRow],
  )

  const handleRetryMailLog = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const id = readMailLogId(row)
      if (!token || id === null || !canRetryMailLog(row)) return

      const key = rowIdentity("mail-logs", row)
      markBusy(key, true)
      try {
        const nextRecord = await retryNotificationMailLog(token, id)
        toast.success("Mail log retry queued.")
        await loadRows()
        if (detailOpen) {
          setSelectedRow((nextRecord as NotificationItem | null) ?? row)
        }
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to retry mail log.",
        )
      } finally {
        markBusy(key, false)
      }
    },
    [detailOpen, loadRows, markBusy],
  )

  const handleRetryPlatformMailLog = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const id = readMailLogId(row)
      if (!token || id === null || !canRetryMailLog(row)) return

      const key = rowIdentity("platform-mail-logs", row)
      markBusy(key, true)
      try {
        const nextRecord = await retryPlatformNotificationMailLog(token, id)
        toast.success("Platform mail log retry queued.")
        await loadRows()
        if (detailOpen) {
          setSelectedRow((nextRecord as NotificationItem | null) ?? row)
        }
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to retry platform mail log.",
        )
      } finally {
        markBusy(key, false)
      }
    },
    [detailOpen, loadRows, markBusy],
  )

  const columns = React.useMemo<Array<Column<AdminRecord>>>(() => {
    if (tab === "inbox") {
      return [
        {
          key: "title",
          label: "Title",
          defaultWidth: 220,
          render: (row) => (
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-xs",
                  isUnreadNotification(row)
                    ? "font-semibold text-foreground"
                    : "font-medium text-foreground/90",
                )}
              >
                {readString(row, ["title"]) || notificationTypeLabel(row)}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {readString(row, ["message", "description"], "No message provided.")}
              </p>
            </div>
          ),
        },
        {
          key: "category",
          label: "Category",
          defaultWidth: 110,
          render: (row) => (
            <span className="text-xs text-muted-foreground">
              {notificationCategoryLabel(row)}
            </span>
          ),
        },
        {
          key: "priority",
          label: "Priority",
          defaultWidth: 90,
          render: (row) => (
            <Badge variant="outline" className={cn("text-[10px]", statusTone(notificationPriorityLabel(row)))}>
              {notificationPriorityLabel(row)}
            </Badge>
          ),
        },
        {
          key: "status",
          label: "Status",
          defaultWidth: 90,
          render: (row) => (
            <Badge variant="outline" className={cn("text-[10px]", statusTone(notificationStatusLabel(row)))}>
              {notificationStatusLabel(row)}
            </Badge>
          ),
        },
        {
          key: "created_at",
          label: "Created",
          defaultWidth: 140,
          render: (row) => (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDateTime(row.created_at ?? row.createdAt)}
            </span>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 156,
          sortable: false,
          render: (row) => {
            const key = rowIdentity("inbox", row)
            const busy = busyKeys.includes(key)
            return (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                  onClick={() => void openDetail(row)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="admin-table-icon-button"
                  title="Mark as read"
                  aria-label="Mark as read"
                  disabled={busy || isArchivedNotification(row) || (!isUnreadNotification(row) && isSeenNotification(row))}
                  onClick={() => void handleMarkRead(row)}
                >
                  {busy ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckIcon className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  className="admin-table-icon-button"
                  data-variant="danger"
                  title="Archive"
                  aria-label="Archive"
                  disabled={busy || isArchivedNotification(row)}
                  onClick={() => void handleArchiveNotification(row)}
                >
                  {busy ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArchiveIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )
          },
        },
      ]
    }

    if (tab === "deliveries") {
      return [
        {
          key: "title",
          label: "Notification",
          defaultWidth: 220,
          render: (row) => (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {deliveryTitle(row)}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {deliveryRecipientLabel(row)}
              </p>
            </div>
          ),
        },
        {
          key: "channel",
          label: "Channel",
          defaultWidth: 90,
          render: (row) => <span className="text-xs">{deliveryChannelLabel(row)}</span>,
        },
        {
          key: "status",
          label: "Status",
          defaultWidth: 95,
          render: (row) => (
            <Badge variant="outline" className={cn("text-[10px]", statusTone(deliveryStatusLabel(row)))}>
              {deliveryStatusLabel(row)}
            </Badge>
          ),
        },
        {
          key: "module",
          label: "Module",
          defaultWidth: 110,
          render: (row) => (
            <span className="text-xs text-muted-foreground">
              {readString(row, ["related_module", "relatedModule", "module"], "—")}
            </span>
          ),
        },
        {
          key: "created_at",
          label: "Created",
          defaultWidth: 140,
          render: (row) => (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDateTime(row.created_at ?? row.createdAt)}
            </span>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 72,
          sortable: false,
          render: (row) => (
            <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                onClick={() => void openDetail(row)}
              >
                View
              </button>
            </div>
          ),
        },
      ]
    }

    if (tab === "settings") {
      return [
        {
          key: "channel",
          label: "Channel",
          defaultWidth: 120,
          render: (row) => (
            <span className="text-xs font-medium text-foreground">
              {formatLabel(readChannelSettingKey(row) || "—")}
            </span>
          ),
        },
        {
          key: "isEnabled",
          label: "Status",
          defaultWidth: 90,
          render: (row) => (
            <Badge variant="outline" className={cn("text-[10px]", statusTone(channelSettingStatusLabel(row)))}>
              {channelSettingStatusLabel(row)}
            </Badge>
          ),
        },
        {
          key: "description",
          label: "Description",
          defaultWidth: 240,
          render: (row) => (
            <span className="block truncate text-xs text-muted-foreground">
              {readString(row, ["description"], "—")}
            </span>
          ),
        },
        {
          key: "updatedAt",
          label: "Updated",
          defaultWidth: 140,
          render: (row) => (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDateTime(row.updatedAt ?? row.updated_at)}
            </span>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 112,
          sortable: false,
          render: (row) => {
            const key = rowIdentity("settings", row)
            const busy = busyKeys.includes(key)
            return (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                  onClick={() => void openDetail(row)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="admin-table-icon-button"
                  title={channelSettingEnabled(row) ? "Disable" : "Enable"}
                  aria-label={channelSettingEnabled(row) ? "Disable" : "Enable"}
                  disabled={busy}
                  onClick={() => void handleToggleChannelSetting(row)}
                >
                  {busy ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )
          },
        },
      ]
    }

    if (tab === "platform-settings") {
      return [
        {
          key: "channel",
          label: "Channel",
          defaultWidth: 120,
          render: (row) => (
            <span className="text-xs font-medium text-foreground">
              {formatLabel(readChannelSettingKey(row) || "—")}
            </span>
          ),
        },
        {
          key: "isEnabled",
          label: "Status",
          defaultWidth: 90,
          render: (row) => (
            <Badge variant="outline" className={cn("text-[10px]", statusTone(channelSettingStatusLabel(row)))}>
              {channelSettingStatusLabel(row)}
            </Badge>
          ),
        },
        {
          key: "description",
          label: "Description",
          defaultWidth: 240,
          render: (row) => (
            <span className="block truncate text-xs text-muted-foreground">
              {readString(row, ["description"], "—")}
            </span>
          ),
        },
        {
          key: "updatedAt",
          label: "Updated",
          defaultWidth: 140,
          render: (row) => (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDateTime(row.updatedAt ?? row.updated_at)}
            </span>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 112,
          sortable: false,
          render: (row) => {
            const key = rowIdentity("platform-settings", row)
            const busy = busyKeys.includes(key)
            return (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                  onClick={() => void openDetail(row)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="admin-table-icon-button"
                  title={channelSettingEnabled(row) ? "Disable" : "Enable"}
                  aria-label={channelSettingEnabled(row) ? "Disable" : "Enable"}
                  disabled={busy}
                  onClick={() => void handleTogglePlatformChannelSetting(row)}
                >
                  {busy ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )
          },
        },
      ]
    }

    if (tab === "registry") {
      return [
        {
          key: "name",
          label: "Notification",
          defaultWidth: 220,
          render: (row) => (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {readString(row, ["name"], "—")}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {readString(row, ["code"], "—")}
              </p>
            </div>
          ),
        },
        {
          key: "channel",
          label: "Channel",
          defaultWidth: 90,
          render: (row) => <span className="text-xs">{formatLabel(readChannelSettingKey(row) || "—")}</span>,
        },
        {
          key: "module",
          label: "Module",
          defaultWidth: 120,
          render: (row) => (
            <span className="text-xs text-muted-foreground">
              {readString(row, ["module"], "—")}
            </span>
          ),
        },
        {
          key: "isEnabled",
          label: "Status",
          defaultWidth: 90,
          render: (row) => (
            <Badge variant="outline" className={cn("text-[10px]", statusTone(registryStatusLabel(row)))}>
              {registryStatusLabel(row)}
            </Badge>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 112,
          sortable: false,
          render: (row) => {
            const key = rowIdentity("registry", row)
            const busy = busyKeys.includes(key)
            return (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                  onClick={() => void openDetail(row)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="admin-table-icon-button"
                  title={channelSettingEnabled(row) ? "Disable" : "Enable"}
                  aria-label={channelSettingEnabled(row) ? "Disable" : "Enable"}
                  disabled={busy}
                  onClick={() => void handleToggleRegistryItem(row)}
                >
                  {busy ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )
          },
        },
      ]
    }

    if (tab === "platform-registry") {
      return [
        {
          key: "name",
          label: "Notification",
          defaultWidth: 220,
          render: (row) => (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {readString(row, ["name"], "—")}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {readString(row, ["code"], "—")}
              </p>
            </div>
          ),
        },
        {
          key: "channel",
          label: "Channel",
          defaultWidth: 90,
          render: (row) => <span className="text-xs">{formatLabel(readChannelSettingKey(row) || "—")}</span>,
        },
        {
          key: "module",
          label: "Module",
          defaultWidth: 120,
          render: (row) => (
            <span className="text-xs text-muted-foreground">
              {readString(row, ["module"], "—")}
            </span>
          ),
        },
        {
          key: "isEnabled",
          label: "Status",
          defaultWidth: 90,
          render: (row) => (
            <Badge variant="outline" className={cn("text-[10px]", statusTone(registryStatusLabel(row)))}>
              {registryStatusLabel(row)}
            </Badge>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 112,
          sortable: false,
          render: (row) => {
            const key = rowIdentity("platform-registry", row)
            const busy = busyKeys.includes(key)
            return (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                  onClick={() => void openDetail(row)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="admin-table-icon-button"
                  title={channelSettingEnabled(row) ? "Disable" : "Enable"}
                  aria-label={channelSettingEnabled(row) ? "Disable" : "Enable"}
                  disabled={busy}
                  onClick={() => void handleTogglePlatformRegistryItem(row)}
                >
                  {busy ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )
          },
        },
      ]
    }

    if (tab === "templates") {
      return [
        {
          key: "template_code",
          label: "Template",
          defaultWidth: 240,
          render: (row) => (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {readString(row, ["title"], "Untitled template")}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {readTemplateCode(row) || "NO_CODE"}
              </p>
            </div>
          ),
        },
        {
          key: "message",
          label: "System Message",
          defaultWidth: 260,
          render: (row) => (
            <span className="block truncate text-xs text-muted-foreground">
              {readString(row, ["systemMessage", "system_message"], "—")}
            </span>
          ),
        },
        {
          key: "status",
          label: "Status",
          defaultWidth: 90,
          render: (row) => (
            <Badge variant="outline" className={cn("text-[10px]", statusTone(templateStatusLabel(row)))}>
              {templateStatusLabel(row)}
            </Badge>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 112,
          sortable: false,
          render: (row) => {
            const key = rowIdentity("templates", row)
            const busy = busyKeys.includes(key)
            return (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                  onClick={() => void openDetail(row)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="admin-table-icon-button"
                  title={templateEnabled(row) ? "Deactivate" : "Activate"}
                  aria-label={templateEnabled(row) ? "Deactivate" : "Activate"}
                  disabled={busy}
                  onClick={() => void handleToggleTemplate(row)}
                >
                  {busy ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ToggleLeftIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )
          },
        },
      ]
    }

    if (tab === "rules") {
      return [
        {
          key: "notification_type",
          label: "Rule",
          defaultWidth: 240,
          render: (row) => (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {formatLabel(readRuleType(row))}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {readRuleEvent(row)}
              </p>
            </div>
          ),
        },
        {
          key: "recipient_type",
          label: "Recipient",
          defaultWidth: 150,
          render: (row) => (
            <span className="text-xs text-muted-foreground">
              {formatLabel(readString(row, ["recipientType", "recipient_type"], "recipient"))}
            </span>
          ),
        },
        {
          key: "channels",
          label: "Channels",
          defaultWidth: 140,
          render: (row) => {
            const value = row.channels
            const channels = Array.isArray(value) ? value.join(", ") : readString(row, ["channels"], "—")
            return <span className="text-xs text-muted-foreground">{channels}</span>
          },
        },
        {
          key: "enabled",
          label: "Status",
          defaultWidth: 90,
          render: (row) => (
            <Badge variant="outline" className={cn("text-[10px]", statusTone(ruleStatusLabel(row)))}>
              {ruleStatusLabel(row)}
            </Badge>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 112,
          sortable: false,
          render: (row) => {
            const key = rowIdentity("rules", row)
            const busy = busyKeys.includes(key)
            return (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                  onClick={() => void openDetail(row)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="admin-table-icon-button"
                  title={ruleEnabled(row) ? "Disable" : "Enable"}
                  aria-label={ruleEnabled(row) ? "Disable" : "Enable"}
                  disabled={busy}
                  onClick={() => void handleToggleRule(row)}
                >
                  {busy ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ToggleLeftIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )
          },
        },
      ]
    }

    return [
      {
        key: "recipient_email",
        label: "Recipient",
        defaultWidth: 180,
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{mailLogRecipient(row)}</p>
            <p className="truncate text-[11px] text-muted-foreground">{mailLogSubject(row)}</p>
          </div>
        ),
      },
      {
        key: "method",
        label: "Method",
        defaultWidth: 90,
        render: (row) => <span className="text-xs">{mailLogMethodLabel(row)}</span>,
      },
      {
        key: "status",
        label: "Status",
        defaultWidth: 95,
        render: (row) => (
          <Badge variant="outline" className={cn("text-[10px]", statusTone(mailLogStatusLabel(row)))}>
            {mailLogStatusLabel(row)}
          </Badge>
        ),
      },
      {
        key: "module",
        label: "Module",
        defaultWidth: 110,
        render: (row) => (
          <span className="text-xs text-muted-foreground">
            {readString(row, ["module", "related_module", "relatedModule"], "—")}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "Created",
        defaultWidth: 140,
        render: (row) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatDateTime(row.created_at ?? row.createdAt)}
          </span>
        ),
      },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 112,
          sortable: false,
          render: (row) => {
            const targetTab = tab === "platform-mail-logs" ? "platform-mail-logs" : "mail-logs"
            const key = rowIdentity(targetTab, row)
            const busy = busyKeys.includes(key)
            return (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                  onClick={() => void openDetail(row)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="admin-table-icon-button"
                  title="Retry"
                  aria-label="Retry"
                  disabled={busy || !canRetryMailLog(row)}
                  onClick={() =>
                    void (tab === "platform-mail-logs"
                      ? handleRetryPlatformMailLog(row)
                      : handleRetryMailLog(row))
                  }
                >
                  {busy ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcwIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )
          },
        },
    ]
  }, [
    busyKeys,
    handleArchiveNotification,
    handleMarkRead,
    handleRetryPlatformMailLog,
    handleRetryMailLog,
    handleToggleTemplate,
    handleToggleRule,
    handleTogglePlatformChannelSetting,
    handleTogglePlatformRegistryItem,
    handleToggleRegistryItem,
    handleToggleChannelSetting,
    openDetail,
    tab,
  ])

  const detailMetadata = React.useMemo(() => metadataEntries(selectedRow), [selectedRow])
  const selectedKey = rowIdentity(tab, selectedRow)
  const selectedBusy = selectedKey ? busyKeys.includes(selectedKey) : false

  const sectionTitle =
    tab === "inbox"
      ? "Inbox"
      : tab === "deliveries"
        ? "Deliveries"
        : tab === "settings"
          ? "Channel Settings"
        : tab === "templates"
          ? "Templates"
        : tab === "rules"
          ? "Rules"
            : tab === "mail-logs"
              ? "Mail Logs"
              : tab === "registry"
                ? "Channel Registry"
                : tab === "platform-registry"
                  ? "Platform Registry"
                : tab === "platform-settings"
                  ? "Platform Settings"
                  : "Platform Mail Logs"

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {isPlatformAdmin ? "Platform" : "Operations"}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {isPlatformAdmin ? "Platform Notifications" : "Notifications"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isPlatformAdmin
              ? "Configure platform channel registry, delivery settings, and outbound mail logs."
              : "Review inbox events, delivery outcomes, company channel switches, and outbound mail activity."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border/80">
        {availableTabs.map((entry) => {
          const isActive = tab === entry.id
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() =>
                React.startTransition(() => {
                  setTab(entry.id)
                })
              }
              className={cn(
                "border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <ResizableTable
        title={sectionTitle}
        data={rows}
        columns={columns}
        loading={loading}
        itemsPerPage={20}
        showExport={false}
        storageKey={`operations-notifications-${tab}`}
        toolbarStart={
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Notifications
            </span>
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {sectionTitle}
            </h2>
            {activeFilterCount > 0 ? (
              <span className="text-xs font-medium text-primary">
                {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        }
        toolbarActions={
          <>
            {tab !== "settings" && tab !== "platform-settings" ? (
              <FluentSearchBox
                size="small"
                className="!w-36 sm:!w-44"
                placeholder="Search…"
                aria-label={`Search ${sectionTitle.toLowerCase()}`}
                value={searchInput}
                onChange={(_event, data) => setSearchInput(data.value)}
              />
            ) : null}

            {tab === "inbox" ? (
              <>
                <FluentSelect
                  ariaLabel="Status"
                  size="small"
                  value={inboxStatusFilter}
                  onChange={(value) =>
                    setInboxStatusFilter(value as InboxStatusFilterValue)
                  }
                  options={[
                    { value: "all", label: "All status" },
                    { value: "UNREAD", label: "Unread" },
                    { value: "READ", label: "Read" },
                  ]}
                />
                <FluentSelect
                  ariaLabel="Category"
                  size="small"
                  value={categoryFilter}
                  onChange={(value) =>
                    setCategoryFilter(value as NotificationCategory | "all")
                  }
                  options={[
                    { value: "all", label: "All categories" },
                    ...CATEGORY_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Priority"
                  size="small"
                  value={priorityFilter}
                  onChange={(value) =>
                    setPriorityFilter(value as NotificationPriority | "all")
                  }
                  options={[
                    { value: "all", label: "All priorities" },
                    ...PRIORITY_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
                <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(event) => setIncludeArchived(event.target.checked)}
                  />
                  Show archived
                </label>
              </>
            ) : null}

            {tab === "deliveries" ? (
              <>
                <FluentSelect
                  ariaLabel="Channel"
                  size="small"
                  value={channelFilter}
                  onChange={(value) =>
                    setChannelFilter(value as ChannelFilterValue)
                  }
                  options={[
                    { value: "all", label: "All channels" },
                    ...CHANNEL_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Delivery status"
                  size="small"
                  value={deliveryStatusFilter}
                  onChange={(value) =>
                    setDeliveryStatusFilter(value as DeliveryStatusFilterValue)
                  }
                  options={[
                    { value: "all", label: "All statuses" },
                    ...DELIVERY_STATUSES.map((status) => ({
                      value: status,
                      label: formatLabel(status),
                    })),
                  ]}
                />
              </>
            ) : null}

            {tab === "registry" || tab === "platform-registry" ? (
              <FluentSelect
                ariaLabel="Channel"
                size="small"
                value={channelFilter}
                onChange={(value) =>
                  setChannelFilter(value as ChannelFilterValue)
                }
                options={[
                  { value: "all", label: "All channels" },
                  ...CHANNEL_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
              />
            ) : null}

            {tab === "templates" ? (
              <FluentSelect
                ariaLabel="Template status"
                size="small"
                value={templateStatusFilter}
                onChange={(value) =>
                  setTemplateStatusFilter(value as TemplateStatusFilterValue)
                }
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
            ) : null}

            {tab === "rules" ? (
              <FluentSelect
                ariaLabel="Rule status"
                size="small"
                value={ruleEnabledFilter}
                onChange={(value) =>
                  setRuleEnabledFilter(value as RuleEnabledFilterValue)
                }
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "enabled", label: "Enabled" },
                  { value: "disabled", label: "Disabled" },
                ]}
              />
            ) : null}

            {tab === "mail-logs" || tab === "platform-mail-logs" ? (
              <FluentSelect
                ariaLabel="Mail log status"
                size="small"
                value={mailLogStatusFilter}
                onChange={(value) =>
                  setMailLogStatusFilter(value as MailLogStatusFilterValue)
                }
                options={[
                  { value: "all", label: "All statuses" },
                  ...MAIL_LOG_STATUSES.map((status) => ({
                    value: status,
                    label: formatLabel(status),
                  })),
                ]}
              />
            ) : null}

            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border transition hover:bg-muted disabled:opacity-60"
              disabled={loading}
              onClick={() => void loadRows()}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCwIcon className={cn("h-3.5 w-3.5 text-primary", loading && "animate-spin")} />
            </button>

            {tab === "inbox" ? (
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
                disabled={loading || markingAllRead || unreadInboxCount === 0}
                onClick={() => void handleMarkAllRead()}
                title={unreadInboxCount > 0 ? "Mark all inbox notifications as read" : "No unread notifications"}
              >
                {markingAllRead ? (
                  <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <CheckIcon className="mr-1 h-3.5 w-3.5" />
                    Mark all read
                  </>
                )}
              </button>
            ) : null}

            {tab === "inbox" ? (
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
                disabled={loading || sendingTestNotification || !canSendTestNotification}
                onClick={() => void handleSendTestNotification()}
                title={
                  canSendTestNotification
                    ? "Send a test notification to your current company user"
                    : "Current company user could not be determined"
                }
              >
                {sendingTestNotification ? (
                  <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <ArrowUpRightIcon className="mr-1 h-3.5 w-3.5" />
                    Send test
                  </>
                )}
              </button>
            ) : null}
          </>
        }
        onRowSelect={(_, row) => {
          if (!row) return
          void openDetail(row)
        }}
      />

      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setSelectedRow(null)
            setDetailLoading(false)
          }
        }}
      >
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border bg-muted/20 px-4 py-3 pr-12">
            <SheetDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {tab === "inbox"
                ? "Notification detail"
                : tab === "deliveries"
                  ? "Delivery detail"
                  : tab === "registry"
                    ? "Registry detail"
                  : tab === "platform-registry"
                    ? "Platform registry detail"
                  : tab === "settings"
                    ? "Channel setting detail"
                    : tab === "platform-settings"
                      ? "Platform setting detail"
                      : "Mail log detail"}
            </SheetDescription>
            <SheetTitle className="text-base font-semibold">
              {tab === "inbox"
                ? selectedRow
                  ? readString(selectedRow, ["title"]) || notificationTypeLabel(selectedRow)
                  : "Notification"
                : tab === "deliveries"
                  ? selectedRow
                    ? deliveryTitle(selectedRow)
                    : "Delivery"
                  : tab === "registry"
                    ? selectedRow
                      ? readString(selectedRow, ["name"], "Registry item")
                      : "Registry item"
                  : tab === "platform-registry"
                    ? selectedRow
                      ? readString(selectedRow, ["name"], "Platform registry item")
                      : "Platform registry item"
                  : tab === "settings"
                    ? selectedRow
                      ? formatLabel(readChannelSettingKey(selectedRow))
                      : "Channel setting"
                    : tab === "platform-settings"
                      ? selectedRow
                        ? formatLabel(readChannelSettingKey(selectedRow))
                        : "Platform setting"
                    : selectedRow
                      ? mailLogSubject(selectedRow)
                      : "Mail log"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 overflow-y-auto p-4">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FluentLoadingIndicator className="size-4 animate-spin text-primary" />
                Loading…
              </div>
            ) : null}

            {selectedRow ? (
              <>
                {tab === "inbox" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                        disabled={selectedBusy || isArchivedNotification(selectedRow) || (!isUnreadNotification(selectedRow) && isSeenNotification(selectedRow))}
                        onClick={() => void handleMarkRead(selectedRow)}
                      >
                        {selectedBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />}
                        Mark read
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-700 disabled:opacity-60 dark:border-rose-900/50 dark:text-rose-300"
                        disabled={selectedBusy || isArchivedNotification(selectedRow)}
                        onClick={() => void handleArchiveNotification(selectedRow)}
                      >
                        {selectedBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <ArchiveIcon className="size-3.5" />}
                        Archive
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium"
                        onClick={() => void handleOpenTarget(selectedRow)}
                      >
                        <ArrowUpRightIcon className="size-3.5" />
                        Open related page
                      </button>
                    </div>
                    {renderSummaryCards([
                      ["Status", notificationStatusLabel(selectedRow)],
                      ["Seen", notificationSeenLabel(selectedRow)],
                      ["Category", notificationCategoryLabel(selectedRow)],
                      ["Priority", notificationPriorityLabel(selectedRow)],
                      ["Type", notificationTypeLabel(selectedRow)],
                      ["Module", readString(selectedRow, ["related_module", "relatedModule"], "—")],
                      ["Created", formatDateTime(selectedRow.created_at ?? selectedRow.createdAt)],
                      ["Destination", resolveNotificationUrl(selectedRow)],
                    ])}
                    <div className="rounded-md border border-border bg-background px-3 py-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Message
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {readString(selectedRow, ["message", "description"], "No message was provided for this notification.")}
                      </p>
                    </div>
                  </>
                ) : null}

                {tab === "deliveries" ? (
                  <>
                    {renderSummaryCards([
                      ["Status", deliveryStatusLabel(selectedRow)],
                      ["Channel", deliveryChannelLabel(selectedRow)],
                      ["Recipient", deliveryRecipientLabel(selectedRow)],
                      ["Notification", deliveryTitle(selectedRow)],
                      [
                        "Notification ID",
                        String(readNumber(selectedRow, ["notification_id", "notificationId"]) ?? "—"),
                      ],
                      [
                        "Receiver",
                        readNumber(selectedRow, ["receiver_company_user_id", "receiverCompanyUserId"]) !== null
                          ? `Company user #${readNumber(selectedRow, ["receiver_company_user_id", "receiverCompanyUserId"])}`
                          : "—",
                      ],
                      ["Module", readString(selectedRow, ["related_module", "relatedModule", "module"], "—")],
                      ["Created", formatDateTime(selectedRow.created_at ?? selectedRow.createdAt)],
                    ])}
                    {readString(selectedRow, ["error_message", "errorMessage"]) ? (
                      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                        {readString(selectedRow, ["error_message", "errorMessage"])}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {tab === "registry" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                        disabled={selectedBusy}
                        onClick={() => void handleToggleRegistryItem(selectedRow)}
                      >
                        {selectedBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />}
                        {channelSettingEnabled(selectedRow) ? "Disable item" : "Enable item"}
                      </button>
                    </div>
                    {renderSummaryCards([
                      ["Name", readString(selectedRow, ["name"], "—")],
                      ["Code", readString(selectedRow, ["code"], "—")],
                      ["Channel", formatLabel(readChannelSettingKey(selectedRow) || "—")],
                      ["Module", readString(selectedRow, ["module"], "—")],
                      ["Status", registryStatusLabel(selectedRow)],
                      ["Description", readString(selectedRow, ["description"], "—")],
                      ["Created", formatDateTime(selectedRow.createdAt ?? selectedRow.created_at)],
                      ["Updated", formatDateTime(selectedRow.updatedAt ?? selectedRow.updated_at)],
                    ])}
                  </>
                ) : null}

                {tab === "platform-registry" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                        disabled={selectedBusy}
                        onClick={() => void handleTogglePlatformRegistryItem(selectedRow)}
                      >
                        {selectedBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />}
                        {channelSettingEnabled(selectedRow) ? "Disable item" : "Enable item"}
                      </button>
                    </div>
                    {renderSummaryCards([
                      ["Name", readString(selectedRow, ["name"], "—")],
                      ["Code", readString(selectedRow, ["code"], "—")],
                      ["Channel", formatLabel(readChannelSettingKey(selectedRow) || "—")],
                      ["Module", readString(selectedRow, ["module"], "—")],
                      ["Status", registryStatusLabel(selectedRow)],
                      ["Description", readString(selectedRow, ["description"], "—")],
                      ["Created", formatDateTime(selectedRow.createdAt ?? selectedRow.created_at)],
                      ["Updated", formatDateTime(selectedRow.updatedAt ?? selectedRow.updated_at)],
                    ])}
                  </>
                ) : null}

                {tab === "settings" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                        disabled={selectedBusy}
                        onClick={() => void handleToggleChannelSetting(selectedRow)}
                      >
                        {selectedBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />}
                        {channelSettingEnabled(selectedRow) ? "Disable channel" : "Enable channel"}
                      </button>
                    </div>
                    {renderSummaryCards([
                      ["Channel", formatLabel(readChannelSettingKey(selectedRow) || "—")],
                      ["Status", channelSettingStatusLabel(selectedRow)],
                      ["Updated By", String(readNumber(selectedRow, ["updatedByCompanyUserId", "updated_by_company_user_id"]) ?? "—")],
                      ["Created", formatDateTime(selectedRow.createdAt ?? selectedRow.created_at)],
                      ["Updated", formatDateTime(selectedRow.updatedAt ?? selectedRow.updated_at)],
                      ["Description", readString(selectedRow, ["description"], "—")],
                    ])}
                  </>
                ) : null}

                {tab === "platform-settings" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                        disabled={selectedBusy}
                        onClick={() => void handleTogglePlatformChannelSetting(selectedRow)}
                      >
                        {selectedBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />}
                        {channelSettingEnabled(selectedRow) ? "Disable platform channel" : "Enable platform channel"}
                      </button>
                    </div>
                    {renderSummaryCards([
                      ["Channel", formatLabel(readChannelSettingKey(selectedRow) || "—")],
                      ["Status", channelSettingStatusLabel(selectedRow)],
                      ["Updated By", String(readNumber(selectedRow, ["updatedByCompanyUserId", "updated_by_company_user_id"]) ?? "—")],
                      ["Created", formatDateTime(selectedRow.createdAt ?? selectedRow.created_at)],
                      ["Updated", formatDateTime(selectedRow.updatedAt ?? selectedRow.updated_at)],
                      ["Description", readString(selectedRow, ["description"], "—")],
                    ])}
                  </>
                ) : null}

                {tab === "templates" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                        disabled={selectedBusy}
                        onClick={() => void handleToggleTemplate(selectedRow)}
                      >
                        {selectedBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <ToggleLeftIcon className="size-3.5" />}
                        {templateEnabled(selectedRow) ? "Deactivate template" : "Activate template"}
                      </button>
                    </div>
                    {renderSummaryCards([
                      ["Code", readTemplateCode(selectedRow) || "—"],
                      ["Status", templateStatusLabel(selectedRow)],
                      ["Title", readString(selectedRow, ["title"], "—")],
                      ["Email subject", readString(selectedRow, ["emailSubject", "email_subject"], "—")],
                      [
                        "Variables",
                        Array.isArray(selectedRow.availableVariables)
                          ? selectedRow.availableVariables.join(", ")
                          : Array.isArray(selectedRow.available_variables)
                            ? selectedRow.available_variables.join(", ")
                            : "—",
                      ],
                      ["Updated", formatDateTime(selectedRow.updatedAt ?? selectedRow.updated_at)],
                    ])}
                    <div className="rounded-md border border-border bg-background px-3 py-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        System message
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {readString(selectedRow, ["systemMessage", "system_message"], "—")}
                      </p>
                    </div>
                    {readString(selectedRow, ["emailBody", "email_body"]) ? (
                      <div className="rounded-md border border-border bg-background px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Email body
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                          {readString(selectedRow, ["emailBody", "email_body"])}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {tab === "rules" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                        disabled={selectedBusy}
                        onClick={() => void handleToggleRule(selectedRow)}
                      >
                        {selectedBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <ToggleLeftIcon className="size-3.5" />}
                        {ruleEnabled(selectedRow) ? "Disable rule" : "Enable rule"}
                      </button>
                    </div>
                    {renderSummaryCards([
                      ["Status", ruleStatusLabel(selectedRow)],
                      ["Type", formatLabel(readRuleType(selectedRow))],
                      ["Trigger", readRuleEvent(selectedRow)],
                      ["Module", readString(selectedRow, ["relatedModule", "related_module"], "—")],
                      ["Recipient", formatLabel(readString(selectedRow, ["recipientType", "recipient_type"], "recipient"))],
                      [
                        "Channels",
                        Array.isArray(selectedRow.channels)
                          ? selectedRow.channels.join(", ")
                          : readString(selectedRow, ["channels"], "—"),
                      ],
                      ["Priority", formatLabel(readString(selectedRow, ["priority"], "MEDIUM"))],
                      [
                        "Reminder before",
                        String(readNumber(selectedRow, ["reminderBeforeMinutes", "reminder_before_minutes"]) ?? "—"),
                      ],
                      [
                        "Reminder after",
                        String(readNumber(selectedRow, ["reminderAfterMinutes", "reminder_after_minutes"]) ?? "—"),
                      ],
                      [
                        "Escalation after",
                        String(readNumber(selectedRow, ["escalationAfterMinutes", "escalation_after_minutes"]) ?? "—"),
                      ],
                      [
                        "Repeat interval",
                        String(readNumber(selectedRow, ["repeatIntervalMinutes", "repeat_interval_minutes"]) ?? "—"),
                      ],
                    ])}
                  </>
                ) : null}

                {tab === "mail-logs" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                        disabled={selectedBusy || !canRetryMailLog(selectedRow)}
                        onClick={() => void handleRetryMailLog(selectedRow)}
                      >
                        {selectedBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <RotateCcwIcon className="size-3.5" />}
                        Retry mail
                      </button>
                    </div>
                    {renderSummaryCards([
                      ["Status", mailLogStatusLabel(selectedRow)],
                      ["Recipient", mailLogRecipient(selectedRow)],
                      ["Subject", mailLogSubject(selectedRow)],
                      ["Method", mailLogMethodLabel(selectedRow)],
                      ["Module", readString(selectedRow, ["module"], "—")],
                      ["Sent At", formatDateTime(selectedRow.sentAt ?? selectedRow.sent_at)],
                      ["Created", formatDateTime(selectedRow.createdAt ?? selectedRow.created_at)],
                      [
                        "Retry Of",
                        String(readNumber(selectedRow, ["retryOfLogId", "retry_of_log_id"]) ?? "—"),
                      ],
                    ])}
                    {readString(selectedRow, ["message", "body_text", "bodyText", "html_body", "htmlBody"]) ? (
                      <div className="rounded-md border border-border bg-background px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Body
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                          {readString(selectedRow, ["message", "body_text", "bodyText", "html_body", "htmlBody"])}
                        </p>
                      </div>
                    ) : null}
                    {readString(selectedRow, ["errorMessage", "error_message"]) ? (
                      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                        {readString(selectedRow, ["errorMessage", "error_message"])}
                      </div>
                    ) : null}
                    {readString(selectedRow, ["providerResponse", "provider_response", "templateSnapshot", "template_snapshot"]) ? (
                      <div className="rounded-md border border-border bg-background px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Provider / Template details
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                          {readString(selectedRow, ["providerResponse", "provider_response", "templateSnapshot", "template_snapshot"])}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {tab === "platform-mail-logs" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                        disabled={selectedBusy || !canRetryMailLog(selectedRow)}
                        onClick={() => void handleRetryPlatformMailLog(selectedRow)}
                      >
                        {selectedBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <RotateCcwIcon className="size-3.5" />}
                        Retry platform mail
                      </button>
                    </div>
                    {renderSummaryCards([
                      ["Status", mailLogStatusLabel(selectedRow)],
                      ["Recipient", mailLogRecipient(selectedRow)],
                      ["Subject", mailLogSubject(selectedRow)],
                      ["Method", mailLogMethodLabel(selectedRow)],
                      ["Module", readString(selectedRow, ["module"], "—")],
                      ["Sent At", formatDateTime(selectedRow.sentAt ?? selectedRow.sent_at)],
                      ["Created", formatDateTime(selectedRow.createdAt ?? selectedRow.created_at)],
                      ["Retry Of", String(readNumber(selectedRow, ["retryOfLogId", "retry_of_log_id"]) ?? "—")],
                    ])}
                    {readString(selectedRow, ["message", "body_text", "bodyText", "html_body", "htmlBody"]) ? (
                      <div className="rounded-md border border-border bg-background px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Body
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                          {readString(selectedRow, ["message", "body_text", "bodyText", "html_body", "htmlBody"])}
                        </p>
                      </div>
                    ) : null}
                    {readString(selectedRow, ["errorMessage", "error_message"]) ? (
                      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                        {readString(selectedRow, ["errorMessage", "error_message"])}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {detailMetadata.length > 0 ? (
                  <div className="rounded-md border border-border bg-background">
                    <div className="border-b border-border px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Metadata
                      </p>
                    </div>
                    <div className="grid gap-x-4 gap-y-2 px-3 py-3 md:grid-cols-2">
                      {detailMetadata.map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2"
                        >
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {formatLabel(key)}
                          </p>
                          <p className="mt-1 text-xs text-foreground break-words">
                            {formatAdminValue(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a record to review its details.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default NotificationsView
