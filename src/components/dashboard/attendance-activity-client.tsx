"use client"

import dynamic from "next/dynamic"

const AttendanceActivityView = dynamic(
  () =>
    import("@/components/dashboard/attendance-activity-view").then(
      (module) => module.AttendanceActivityView
    ),
  { ssr: false }
)

export function AttendanceActivityClient({ section }: { section: string }) {
  return <AttendanceActivityView section={section} />
}
