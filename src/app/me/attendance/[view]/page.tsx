import { redirect } from "next/navigation"

interface LegacyAttendanceViewPageProps {
  params: Promise<{ view: string }>
}

const destinationByView: Record<string, string> = {
  assignments: "/dashboard/attendance/schedule-preview",
  "check-in": "/dashboard/attendance/punch-action",
  "check-out": "/dashboard/attendance/punch-action",
  history: "/dashboard/attendance/attendance-history",
  overview: "/dashboard/attendance/today",
  punches: "/dashboard/attendance/attendance-history",
  schedule: "/dashboard/attendance/schedule-preview",
  today: "/dashboard/attendance/today",
  "work-from-home": "/dashboard/attendance/work-from-home-requests",
}

export default async function LegacyAttendanceViewPage({ params }: LegacyAttendanceViewPageProps) {
  const { view } = await params
  redirect(destinationByView[view.toLowerCase()] ?? "/dashboard/attendance/today")
}
