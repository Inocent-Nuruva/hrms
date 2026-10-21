"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { selfServiceHomeFor } from "@/lib/dashboard-nav"
import { employeeSectionTabGroups } from "@/lib/dashboard-sections"

export default function EmployeesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const actor = useDashboardActor()
  const pathname = usePathname()
  const router = useRouter()
  const path = pathname ?? ""
  const helperAccess =
    actor.ready &&
    canAccessDashboardRoute(path, actor.permissionLabels, actor.accessMode)

  React.useEffect(() => {
    if (!actor.ready || actor.accessMode !== "employee") return
    if (helperAccess) return
    if (pathname?.startsWith("/dashboard/employees/offboarding")) {
      router.replace("/dashboard/me/offboarding")
      return
    }
    if (pathname?.startsWith("/dashboard/employees/onboarding")) {
      router.replace("/dashboard/me/onboarding")
      return
    }
    if (pathname?.startsWith("/dashboard/employees")) {
      router.replace(selfServiceHomeFor(pathname) ?? "/dashboard")
    }
  }, [actor.accessMode, actor.ready, helperAccess, pathname, router])

  if (!actor.ready) {
    return null
  }

  if (actor.accessMode === "employee" && !helperAccess) {
    return null
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-0">
      <DashboardSectionTabs groups={employeeSectionTabGroups} showGroupNavigation />
      <div className="min-w-0 max-w-full">{children}</div>
    </div>
  )
}
