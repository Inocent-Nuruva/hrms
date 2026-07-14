"use client"

import * as React from "react"

import {
  hasAdminDashboardAccess,
  normalizePermissionLabels,
} from "@/components/app-sidebar"
import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import {
  attendanceSectionTabGroups,
  employeeAttendanceSectionTabGroups,
} from "@/lib/dashboard-sections"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

function readPermissionsFromUnknown(value: unknown, sink: Set<string>) {
  if (typeof value === "string" && value.trim()) {
    sink.add(value.trim())
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => readPermissionsFromUnknown(entry, sink))
    return
  }

  if (typeof value !== "object" || value === null) {
    return
  }

  const record = value as Record<string, unknown>
  for (const key of ["permissions", "authorities", "actions", "scopes", "data", "items", "results", "user"]) {
    readPermissionsFromUnknown(record[key], sink)
  }
}

function readStoredPermissionLabels() {
  if (typeof window === "undefined") {
    return [] as string[]
  }

  const labels = new Set<string>()

  const rawActorPermissions = window.sessionStorage.getItem("hrms.dashboard.actorPermissions")
  if (rawActorPermissions) {
    try {
      const parsed = JSON.parse(rawActorPermissions)
      if (Array.isArray(parsed)) {
        return normalizePermissionLabels(parsed.filter((entry) => typeof entry === "string"))
      }
    } catch {
      // Fall through to local sources.
    }
  }

  const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
  if (rawUser) {
    try {
      readPermissionsFromUnknown(JSON.parse(rawUser), labels)
    } catch {
      // ignore malformed stored user
    }
  }

  const rawTokens = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (rawTokens) {
    try {
      readPermissionsFromUnknown(JSON.parse(rawTokens), labels)
    } catch {
      // ignore malformed stored tokens
    }
  }

  return normalizePermissionLabels(Array.from(labels))
}

export function AttendanceSectionTabs() {
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const normalizedPermissions = readStoredPermissionLabels()
    setIsAdmin(hasAdminDashboardAccess(normalizedPermissions))
  }, [])

  if (isAdmin === null) {
    return null
  }

  return <DashboardSectionTabs groups={isAdmin ? attendanceSectionTabGroups : employeeAttendanceSectionTabGroups} />
}
