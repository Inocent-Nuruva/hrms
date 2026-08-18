"use client"

import dynamic from "next/dynamic"
import * as React from "react"
import { useRouter } from "next/navigation"

import { useDashboardActor } from "@/hooks/use-dashboard-actor"

const AttendanceActivityView = dynamic(
  () =>
    import("@/components/dashboard/attendance-activity-view").then(
      (module) => module.AttendanceActivityView
    ),
  { ssr: false }
)

const EMPLOYEE_SELF_SERVICE_ATTENDANCE_SECTIONS = new Set([
  "today",
  "attendance-history",
  "schedule-preview",
  "corrections",
  "punch-action",
])

export function AttendanceActivityClient({ section }: { section: string }) {
  const actor = useDashboardActor()
  const router = useRouter()

  React.useEffect(() => {
    if (!actor.ready) {
      return
    }

    if (actor.isAdmin && EMPLOYEE_SELF_SERVICE_ATTENDANCE_SECTIONS.has(section)) {
      router.replace("/dashboard/attendance/daily-summaries")
    }
  }, [actor.isAdmin, actor.ready, router, section])

  if (!actor.ready) {
    return null
  }

  if (actor.isAdmin && EMPLOYEE_SELF_SERVICE_ATTENDANCE_SECTIONS.has(section)) {
    return null
  }

  return <AttendanceActivityView section={section} />
}
