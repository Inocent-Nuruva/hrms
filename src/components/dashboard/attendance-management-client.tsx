"use client"

import dynamic from "next/dynamic"

const AttendanceManagementView = dynamic(
  () =>
    import("@/components/dashboard/attendance-management-view").then(
      (module) => module.AttendanceManagementView
    ),
  { ssr: false }
)

export function AttendanceManagementClient({ section }: { section: string }) {
  return <AttendanceManagementView section={section} />
}
