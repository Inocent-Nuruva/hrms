import {
  hasAdminDashboardAccess,
  normalizePermissionLabels,
} from "@/components/app-sidebar"
import { asRecord } from "@/utils/token-utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const DASHBOARD_PERMISSION_STORAGE_KEY = "hrms.dashboard.actorPermissions"
const LEGACY_ADMIN_USER_STORAGE_KEY = "hrms.admin.user"

export type DashboardAccessMode = "admin" | "employee"

function collectPermissionLabels(value: unknown, sink: Set<string>) {
  if (typeof value === "string" && value.trim()) {
    sink.add(value.trim())
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectPermissionLabels(entry, sink))
    return
  }

  const nested = asRecord(value)
  if (!nested) {
    return
  }

  for (const key of [
    "permissions",
    "authorities",
    "actions",
    "scopes",
    "data",
    "items",
    "results",
    "user",
    "profile",
    "meta",
  ]) {
    collectPermissionLabels(nested[key], sink)
  }
}

export function readDashboardPermissionLabelsFromBrowser() {
  if (typeof window === "undefined") {
    return [] as string[]
  }

  const rawActorPermissions = window.sessionStorage.getItem(
    DASHBOARD_PERMISSION_STORAGE_KEY
  )
  if (rawActorPermissions) {
    try {
      const parsed = JSON.parse(rawActorPermissions)
      return normalizePermissionLabels(
        Array.isArray(parsed)
          ? parsed.filter((entry) => typeof entry === "string")
          : []
      )
    } catch {
      // Fall back to local storage payloads.
    }
  }

  const labels = new Set<string>()

  for (const key of [
    AUTH_STORAGE_KEYS.user,
    AUTH_STORAGE_KEYS.tokens,
    LEGACY_ADMIN_USER_STORAGE_KEY,
  ]) {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) {
      continue
    }

    try {
      collectPermissionLabels(JSON.parse(rawValue), labels)
    } catch {
      // Ignore malformed storage payloads.
    }
  }

  return normalizePermissionLabels(Array.from(labels))
}

export function getDashboardAccessModeFromBrowser(): DashboardAccessMode {
  const permissionLabels = readDashboardPermissionLabelsFromBrowser()
  return hasAdminDashboardAccess(permissionLabels) ? "admin" : "employee"
}

export function hasDashboardAdminIdentity() {
  return getDashboardAccessModeFromBrowser() === "admin"
}
