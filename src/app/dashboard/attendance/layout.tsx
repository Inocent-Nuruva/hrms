import { AttendanceSectionTabs } from "@/components/dashboard/attendance-section-tabs"

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <AttendanceSectionTabs />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
