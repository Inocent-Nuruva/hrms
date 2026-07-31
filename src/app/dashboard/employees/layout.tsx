"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { employeeSectionTabGroups } from "@/lib/dashboard-sections"

export default function EmployeesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const actor = useDashboardActor()
  const pathname = usePathname()
  const router = useRouter()

  // Self-service shell users who still land on the HR Employees section
  // (e.g. old offboarding bookmarks) should leave this layout immediately.
  React.useEffect(() => {
    if (!actor.ready || actor.accessMode !== "employee") return
    // Self-service offboarding lives under /dashboard/me/offboarding.
    if (pathname?.startsWith("/dashboard/employees/offboarding")) {
      router.replace("/dashboard/me/offboarding")
      return
    }
    // Any other employees/* route is admin/HR only for the employee shell.
    if (pathname?.startsWith("/dashboard/employees")) {
      router.replace("/dashboard")
    }
  }, [actor.accessMode, actor.ready, pathname, router])

  // Avoid a blank flash for true self-service users; HR/admin keeps rendering.
  if (actor.ready && actor.accessMode === "employee") {
    return null
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3 md:gap-4">
      <DashboardSectionTabs groups={employeeSectionTabGroups} />
      <div className="min-w-0 max-w-full">{children}</div>
    </div>
  )
}
