import { redirect } from "next/navigation"

import { AttendanceActivityClient } from "@/components/dashboard/attendance-activity-client"
import { AttendanceManagementClient } from "@/components/dashboard/attendance-management-client"
import { ScheduleManagementClient } from "@/components/dashboard/schedule-management-client"

const ALLOWED_VIEWS = new Set([
  "settings",
  "policies",
  "devices",
  "checkpoints",
  "holiday-groups",
  "geofences",
  "wifi-networks",
  "mobile-punches",
  "doors",
  "templates",
  "organizations",
  "groups",
  "holidays",
  "device-sync-logs",
  "daily-summaries",
  "recalculation-jobs",
  "unmatched-logs",
  "today",
  "punch-history",
  "attendance-history",
  "schedule-preview",
  "shifts",
  "shift-breaks",
  "shift-assignments",
  "shift-schedules",
  "shift-rotation-groups",
  "shift-rotation-rules",
  "timetables",
  "timetable-days",
  "timetable-holiday-rules",
  "timetable-rotations",
  "timetable-rotation-rules",
  "employee-timetables",
])

const ACCESS_CONTROL_ATTENDANCE_VIEWS = new Set([
  "devices",
  "doors",
  "templates",
  "organizations",
  "groups",
])

const SCHEDULE_ATTENDANCE_VIEWS = new Set([
  "shifts",
  "shift-breaks",
  "shift-assignments",
  "shift-schedules",
  "shift-rotation-groups",
  "shift-rotation-rules",
  "timetables",
  "timetable-days",
  "timetable-holiday-rules",
  "timetable-rotations",
  "timetable-rotation-rules",
  "employee-timetables",
])

const ACTIVITY_ATTENDANCE_VIEWS = new Set([
  "daily-summaries",
  "recalculation-jobs",
  "unmatched-logs",
  "today",
  "punch-history",
  "attendance-history",
  "schedule-preview",
])

interface AttendanceViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function AttendanceViewPage({ params }: AttendanceViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase()

  if (ACCESS_CONTROL_ATTENDANCE_VIEWS.has(normalized)) {
    redirect(`/dashboard/access-control/${normalized}`)
  }

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/attendance")
  }

  if (SCHEDULE_ATTENDANCE_VIEWS.has(normalized)) {
    return <ScheduleManagementClient section={normalized} />
  }

  if (ACTIVITY_ATTENDANCE_VIEWS.has(normalized)) {
    return <AttendanceActivityClient section={normalized} />
  }

  return <AttendanceManagementClient section={normalized} />
}
