import { AttendanceSectionTabs } from "@/components/dashboard/attendance-section-tabs"

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <AttendanceSectionTabs />
      {children}
    </div>
  )
}
