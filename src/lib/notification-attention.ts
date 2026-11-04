import type { AdminRecord, NotificationItem } from "@/lib/admin-api"

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null
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

function readMetadata(row: AdminRecord) {
  return asRecord(row.metadata)
}

function normalizeInternalActionUrl(value: string) {
  if (!value) return ""
  if (value.startsWith("/")) return value
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return ""
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return ""
  }
}

function appendRequestHighlight(url: string, requestId: string) {
  if (!url.startsWith("/") || !requestId) return url

  const [pathWithQuery, hash = ""] = url.split("#")
  const [path, query = ""] = pathWithQuery.split("?")
  const params = new URLSearchParams(query)
  if (!params.has("highlight") && !params.has("requestId") && !params.has("request_id")) {
    params.set("highlight", requestId)
  }
  const nextQuery = params.toString()
  return `${path}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`
}

/** Legacy manager-portal links (/manager/...) have no frontend route; map them to the dashboard equivalents. */
function rewriteLegacyManagerUrl(url: string) {
  const match = url.match(/^\/manager(\/[^?#]*)?([?#].*)?$/i)
  if (!match) return url
  const section = (match[1] ?? "").split("/").filter(Boolean)[0]?.toLowerCase() ?? ""
  const suffix = match[2] ?? ""
  const destinations: Record<string, string> = {
    attendance: "/dashboard/me/team/attendance",
    team: "/dashboard/me/team/members",
    activities: "/dashboard/activities/reviews",
  }
  return `${destinations[section] ?? "/dashboard/me/team/overview"}${suffix}`
}

function isTestNotification(row: AdminRecord) {
  const type = readString(row, ["type"]).toLowerCase()
  const source = readString(readMetadata(row), ["source"]).toLowerCase()
  return type.includes("test") || source.includes("notification-center") || source.includes("test")
}

export function isUnreadNotification(row: AdminRecord) {
  const status = readString(row, ["status"]).toUpperCase()
  if (status === "READ") return false
  if (status === "UNREAD") return true
  return !readString(row, ["read_at", "readAt"])
}

/** Resolve both current and historical leave links to routes that actually exist. */
export function resolveLeaveNotificationUrl(row: AdminRecord): string | null {
  const metadata = readMetadata(row)
  const type = readString(row, ["type"]).toUpperCase()
  const ownTypes = new Set(["LEAVE_SUBMITTED", "LEAVE_APPROVED", "LEAVE_REJECTED", "LEAVE_RETURNED_FOR_CORRECTION", "LEAVE_EVIDENCE_REQUIRED"])
  const reviewerTypes = new Set(["LEAVE_APPROVAL_REQUIRED", "LEAVE_ROUTING_REQUIRED"])
  const requestId = readString(row, ["entity_id", "entityId", "request_id", "requestId"]) || readString(metadata, ["request_id", "requestId"])
  const ownPath = "/dashboard/me/leave/requests"
  const reviewPath = "/dashboard/leave-management/requests"
  for (const value of [readString(row, ["action_url", "actionUrl", "url", "link"]), readString(metadata, ["action_url", "actionUrl", "url", "link"])]) {
    if (!value) continue
    try {
      const parsed = new URL(value, "https://hrms.invalid")
      const legacy = parsed.pathname.match(/^\/leave\/(\d+)(\/review)?\/?$/)
      if (legacy) return appendRequestHighlight(ownTypes.has(type) || (!legacy[2] && !reviewerTypes.has(type)) ? ownPath : reviewPath, requestId || legacy[1])
      if (parsed.pathname === ownPath || parsed.pathname === reviewPath) {
        return appendRequestHighlight(`${parsed.pathname}${parsed.search}${parsed.hash}`, requestId)
      }
    } catch { /* Fall back to the event type for malformed historical links. */ }
  }
  if (ownTypes.has(type)) return appendRequestHighlight(ownPath, requestId)
  if (reviewerTypes.has(type)) return appendRequestHighlight(reviewPath, requestId)
  return null
}

export function resolveNotificationUrl(row: AdminRecord) {
  if (isTestNotification(row)) return "/dashboard"
  const leaveDestination = resolveLeaveNotificationUrl(row)
  if (leaveDestination) return leaveDestination

  const direct = rewriteLegacyManagerUrl(normalizeInternalActionUrl(readString(row, ["action_url", "actionUrl", "url", "link"])))
  const metadata = readMetadata(row)
  const requestId =
    readString(row, ["entity_id", "entityId", "request_id", "requestId"]) ||
    readString(metadata, ["request_id", "requestId", "entity_id", "entityId"])

  if (direct.startsWith("/")) {
    if (/^\/(?:dashboard\/)?me\/daily-activities(?:\/|\?|$)/i.test(direct)) {
      return "/dashboard/me/activities/today"
    }
    return appendRequestHighlight(direct, requestId)
  }

  const nested = rewriteLegacyManagerUrl(normalizeInternalActionUrl(readString(metadata, ["action_url", "actionUrl", "url", "link"])))
  if (nested.startsWith("/")) {
    if (/^\/(?:dashboard\/)?me\/daily-activities(?:\/|\?|$)/i.test(nested)) {
      return "/dashboard/me/activities/today"
    }
    return appendRequestHighlight(nested, requestId)
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
    onboarding_task: "/dashboard/me/requests/actions",
    onboarding_task_assigned: "/dashboard/me/requests/actions",
    offboarding_request: "/dashboard/employees/offboarding",
    offboarding_request_submitted: "/dashboard/employees/offboarding",
    daily_activity_report: "/dashboard/me/activities/today",
    daily_activity_not_submitted: "/dashboard/me/activities/today",
    daily_activity_not_submitted_employee: "/dashboard/me/activities/today",
  }

  if (destinationByType[entityType]) {
    return appendRequestHighlight(destinationByType[entityType], requestId)
  }

  const notificationHints = [
    entityType,
    readString(row, ["related_module", "relatedModule"]),
    readString(row, ["title", "subject"]),
    readString(row, ["message", "body", "content", "description"]),
    readString(metadata, ["template_code", "templateCode"]),
  ].join(" ").toLowerCase().replace(/[_-]+/g, " ")
  if (/daily activity|activity report/.test(notificationHints)) {
    return "/dashboard/me/activities/today"
  }

  return appendRequestHighlight("/dashboard", requestId)
}

export function normalizeAttentionPath(url: string) {
  const path = url.split(/[?#]/, 1)[0] || "/"
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path
}

export function notificationAttentionRoutes(items: NotificationItem[]) {
  return Array.from(
    new Set(
      items
        .filter(isUnreadNotification)
        .map(resolveNotificationUrl)
        .map(normalizeAttentionPath),
    ),
  )
}

export function notificationAttentionIdsForRoute(
  items: NotificationItem[],
  currentUrl: string,
) {
  const currentPath = normalizeAttentionPath(currentUrl)

  return Array.from(
    new Set(
      items
        .filter(isUnreadNotification)
        .filter(
          (item) =>
            normalizeAttentionPath(resolveNotificationUrl(item)) === currentPath,
        )
        .map((item) => {
          const id = item.id ?? item.notification_id ?? item.notificationId
          if (typeof id === "number" && Number.isFinite(id)) return id
          if (typeof id === "string" && id.trim()) {
            const parsed = Number(id)
            return Number.isFinite(parsed) ? parsed : null
          }
          return null
        })
        .filter((id): id is number => id !== null),
    ),
  )
}

export function routesNeedAttention(candidateUrls: string[], attentionRoutes: string[]) {
  return candidateUrls.some((candidateUrl) => {
    const candidate = normalizeAttentionPath(candidateUrl)
    return attentionRoutes.some((attentionUrl) => {
      const attention = normalizeAttentionPath(attentionUrl)
      if (candidate === "/dashboard") return attention === candidate
      return attention === candidate || attention.startsWith(`${candidate}/`)
    })
  })
}
