"use client"

import * as React from "react"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import {
  attendanceSectionTabGroups,
  employeeAttendanceSectionTabGroups,
} from "@/lib/dashboard-sections"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { asRecord, readString } from "@/utils/token-utils"

const ADMIN_ROLE_KEYS = new Set([
  "admin",
  "administrator",
  "super_admin",
  "super-admin",
  "company_admin",
  "company-admin",
  "hr_admin",
  "hr-admin",
  "owner",
  "root",
])

function readRoleLabels(record: Record<string, unknown> | null) {
  if (!record) {
    return [] as string[]
  }

  const labels = new Set<string>()
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      labels.add(value.trim().toLowerCase())
      return
    }
    if (typeof value === "object" && value !== null) {
      const nested = value as Record<string, unknown>
      const nestedLabel = readString(nested, ["name", "role", "key", "code", "slug", "type", "user_type"])
      if (nestedLabel) {
        labels.add(nestedLabel.toLowerCase())
      }
    }
  }

  push(record.role)
  push(record.user_type)
  push(record.type)

  for (const key of ["roles", "authorities", "userRole", "user_role"]) {
    const value = record[key]
    if (Array.isArray(value)) {
      value.forEach((entry) => push(entry))
      continue
    }
    push(value)
  }

  return Array.from(labels)
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[1]) {
    return null
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    return asRecord(JSON.parse(atob(padded)))
  } catch {
    return null
  }
}

export function AttendanceSectionTabs() {
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    let storedUser: Record<string, unknown> | null = null
    const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
    if (rawUser) {
      try {
        storedUser = asRecord(JSON.parse(rawUser))
      } catch {
        storedUser = null
      }
    }

    const tokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
    let accessToken = ""
    if (tokensRaw) {
      try {
        const parsed = JSON.parse(tokensRaw) as Record<string, unknown>
        accessToken =
          (typeof parsed.accessToken === "string" && parsed.accessToken.trim()) ||
          (typeof parsed.access_token === "string" && parsed.access_token.trim()) ||
          ""
      } catch {
        accessToken = ""
      }
    }

    const tokenPayload = accessToken ? decodeJwtPayload(accessToken) : null
    const roleLabels = [...readRoleLabels(storedUser), ...readRoleLabels(tokenPayload)]
    setIsAdmin(roleLabels.some((role) => ADMIN_ROLE_KEYS.has(role)))
  }, [])

  if (isAdmin === null) {
    return null
  }

  return <DashboardSectionTabs groups={isAdmin ? attendanceSectionTabGroups : employeeAttendanceSectionTabGroups} />
}
