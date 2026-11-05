"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { employeeSectionTabGroups } from "@/lib/dashboard-sections"
import {
  listMyOffboardingRequests,
  listMyOnboardingRequests,
  type AdminRecord,
} from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { EMPLOYEE_LIFECYCLE_REQUESTS_CHANGED } from "@/lib/employee-lifecycle-events"

const TERMINAL_LIFECYCLE_STATUSES = new Set([
  "cancelled",
  "completed",
  "rejected",
])

function statusOf(request: AdminRecord) {
  return String(request.status ?? request.request_status ?? request.state ?? "")
    .trim()
    .toLowerCase()
}

function hasActiveOnboarding(requests: AdminRecord[]) {
  return requests.some(
    (request) => !TERMINAL_LIFECYCLE_STATUSES.has(statusOf(request)),
  )
}

function hasActiveOffboarding(requests: AdminRecord[]) {
  return requests.some((request) => {
    const status = statusOf(request)
    return status !== "draft" && !TERMINAL_LIFECYCLE_STATUSES.has(status)
  })
}

export function EmployeeWorkspaceLayout({
  children,
  hideOnPaths = [],
}: {
  children: React.ReactNode
  hideOnPaths?: string[]
}) {
  const pathname = usePathname()
  const [visibility, setVisibility] = React.useState({
    onboarding: false,
    offboarding: false,
  })

  const loadVisibility = React.useCallback(async () => {
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token) return

    const [onboardingResult, offboardingResult] = await Promise.allSettled([
      listMyOnboardingRequests(token),
      listMyOffboardingRequests(token),
    ])

    setVisibility({
      onboarding:
        onboardingResult.status === "fulfilled" &&
        hasActiveOnboarding(onboardingResult.value),
      offboarding:
        offboardingResult.status === "fulfilled" &&
        hasActiveOffboarding(offboardingResult.value),
    })
  }, [])

  React.useEffect(() => {
    void loadVisibility()
  }, [loadVisibility, pathname])

  React.useEffect(() => {
    const refresh = () => void loadVisibility()
    window.addEventListener(EMPLOYEE_LIFECYCLE_REQUESTS_CHANGED, refresh)
    window.addEventListener("focus", refresh)
    return () => {
      window.removeEventListener(EMPLOYEE_LIFECYCLE_REQUESTS_CHANGED, refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [loadVisibility])

  const visibleGroups = React.useMemo(
    () =>
      employeeSectionTabGroups.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.url === "/dashboard/me/onboarding") {
            return visibility.onboarding
          }
          if (item.url === "/dashboard/me/offboarding") {
            return visibility.offboarding
          }
          return true
        }),
      })),
    [visibility],
  )

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-0">
      <DashboardSectionTabs groups={visibleGroups} hideOnPaths={hideOnPaths} />
      <div className="min-w-0 max-w-full">{children}</div>
    </div>
  )
}
