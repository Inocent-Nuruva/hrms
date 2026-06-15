"use client"

import dynamic from "next/dynamic"

const ScheduleManagementView = dynamic(
  () =>
    import("@/components/dashboard/schedule-management-view").then(
      (module) => module.ScheduleManagementView
    ),
  { ssr: false }
)

export function ScheduleManagementClient({ section }: { section: string }) {
  return <ScheduleManagementView section={section} />
}
