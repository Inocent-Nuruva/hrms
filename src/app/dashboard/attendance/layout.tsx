import { AttendanceSectionTabs } from "@/components/dashboard/attendance-section-tabs"

/**
 * Attendance pages share one frame: sub-tabs flush under the top bar, then
 * the page with the same spacing on every device (design: 18px above the
 * content and 20px at the sides; 14px / 12px on phones). The dashboard shell
 * already pads 12px (phone) / 16px (tablet and up), so we add the difference.
 */
export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <AttendanceSectionTabs />
      <div className="min-w-0 pt-3.5 sm:px-1 sm:pt-[18px]">{children}</div>
    </div>
  )
}
