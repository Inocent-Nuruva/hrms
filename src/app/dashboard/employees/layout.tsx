"use client"

import * as React from "react"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { asRecord, readString } from "@/utils/token-utils"
import { employeeSectionTabGroups } from "@/lib/dashboard-sections"

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

export default function EmployeesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [groups, setGroups] = React.useState(employeeSectionTabGroups)

  React.useEffect(() => {
    const rawUser = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_STORAGE_KEYS.user) : null
    let storedUser: Record<string, unknown> | null = null
    if (rawUser) {
      try { storedUser = JSON.parse(rawUser) } catch {}
    }
    const tokensRaw = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens) : null
    let accessToken = ""
    if (tokensRaw) {
      try {
        const parsed = JSON.parse(tokensRaw) as Record<string, unknown>
        accessToken = (typeof parsed.accessToken === "string" && parsed.accessToken.trim()) ||
          (typeof parsed.access_token === "string" && parsed.access_token.trim()) || ""
      } catch {}
    }
    const tokenPayload = accessToken ? decodeJwtPayload(accessToken) : null
    const roleLabels = [...readRoleLabels(storedUser), ...readRoleLabels(tokenPayload)]
    const isAdmin = roleLabels.some((role) => ADMIN_ROLE_KEYS.has(role)) || false

    let filteredGroups = employeeSectionTabGroups
    if (!isAdmin) {
      filteredGroups = [
        {
          items: [
            { title: "Register", url: "/dashboard/employees/register" },
            { title: "Offboarding", url: "/dashboard/employees/offboarding" },
          ],
        },
      ]
    } else {
      filteredGroups = employeeSectionTabGroups
    }
    setGroups(filteredGroups)
  }, [])

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <DashboardSectionTabs groups={groups} />
      {children}
    </div>
  )
}
