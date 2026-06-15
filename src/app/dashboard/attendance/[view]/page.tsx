import { redirect } from "next/navigation"

import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { AccessControlManagementClient } from "@/components/dashboard/access-control-management-client"
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
  "punch-action",
  "punch-history",
  "attendance-history",
  "schedule-preview",
  "shifts",
  "shift-breaks",
  "shift-attendance-rules",
  "shift-overtime-rules",
  "shift-assignments",
  "shift-schedules",
  "shift-templates",
  "shift-rotation-groups",
  "shift-rotation-rules",
  "shift-change-requests",
  "timetables",
  "timetable-days",
  "timetable-shift-rules",
  "timetable-holiday-rules",
  "timetable-attendance-rules",
  "timetable-rotations",
  "timetable-rotation-rules",
  "employee-timetables",
  "timetable-generated-schedules",
])

const ACCESS_CONTROL_ATTENDANCE_VIEWS = new Set([
  "doors",
  "templates",
  "organizations",
  "groups",
])

const SCHEDULE_ATTENDANCE_VIEWS = new Set([
  "shifts",
  "shift-breaks",
  "shift-attendance-rules",
  "shift-overtime-rules",
  "shift-assignments",
  "shift-schedules",
  "shift-templates",
  "shift-rotation-groups",
  "shift-rotation-rules",
  "shift-change-requests",
  "timetables",
  "timetable-days",
  "timetable-shift-rules",
  "timetable-holiday-rules",
  "timetable-attendance-rules",
  "timetable-rotations",
  "timetable-rotation-rules",
  "employee-timetables",
  "timetable-generated-schedules",
])

const ACTIVITY_ATTENDANCE_VIEWS = new Set([
  "daily-summaries",
  "recalculation-jobs",
  "unmatched-logs",
  "today",
  "punch-action",
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

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/attendance/settings")
  }

  return (
    <AdminDashboardView>
      {ACCESS_CONTROL_ATTENDANCE_VIEWS.has(normalized) ? (
        <AccessControlManagementClient section={normalized} moduleTitle="Attendance Management" />
      ) : SCHEDULE_ATTENDANCE_VIEWS.has(normalized) ? (
        <ScheduleManagementClient section={normalized} />
      ) : ACTIVITY_ATTENDANCE_VIEWS.has(normalized) ? (
        <AttendanceActivityClient section={normalized} />
      ) : (
        <AttendanceManagementClient section={normalized} />
      )}
    </AdminDashboardView>
  )
}
