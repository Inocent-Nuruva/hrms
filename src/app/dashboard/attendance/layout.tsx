import { AttendanceSectionTabs } from "@/components/dashboard/attendance-section-tabs"

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 md:gap-2.5">
      <AttendanceSectionTabs />
      {children}
    </div>
  )
}
