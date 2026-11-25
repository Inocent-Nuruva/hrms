import { redirect } from "next/navigation"

import { AttendanceActivityClient } from "@/components/dashboard/attendance-activity-client"
import { AttendanceManagementClient } from "@/components/dashboard/attendance-management-client"
import { HrAttendanceCorrectionApprovalsView } from "@/components/dashboard/hr-attendance-correction-approvals-view"
import { ScheduleManagementClient } from "@/components/dashboard/schedule-management-client"
import { AttendanceWorkFromHomeClient } from "@/components/dashboard/attendance-work-from-home-client"
import { AccessControlActivityClient } from "@/components/dashboard/access-control-activity-client"
import { AttendanceExemptionsClient } from "@/components/dashboard/attendance-exemptions-client"

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
  "processing-exceptions",
  "recalculation-jobs",
  "unmatched-logs",
  "today",
  "punch-action",
  "attendance-history",
  "schedule-preview",
  "corrections",
  "correction-requests",
  "shifts",
  "shift-breaks",
  "shift-assignments",
  "shift-schedules",
  "timetable-generated-schedules",
  "shift-rotation-groups",
  "shift-rotation-rules",
  "timetables",
  "timetable-days",
  "timetable-shift-rules",
  "timetable-holiday-rules",
  "timetable-rotations",
  "timetable-rotation-rules",
  "employee-timetables",
  "work-from-home-requests",
  "biometric-access",
  "exemptions",
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
  "timetable-generated-schedules",
  "shift-rotation-groups",
  "shift-rotation-rules",
  "timetables",
  "timetable-days",
  "timetable-shift-rules",
  "timetable-holiday-rules",
  "timetable-rotations",
  "timetable-rotation-rules",
  "employee-timetables",
])

const ACTIVITY_ATTENDANCE_VIEWS = new Set([
  "daily-summaries",
  "processing-exceptions",
  "recalculation-jobs",
  "unmatched-logs",
  "today",
  "punch-action",
  "attendance-history",
  "schedule-preview",
  "corrections",
])

interface AttendanceViewPageProps {
  params: Promise<{
    view: string
  }>
  searchParams?: Promise<{ tab?: string }>
}

export default async function AttendanceViewPage({ params, searchParams }: AttendanceViewPageProps) {
  const { view } = await params
  const sp = await searchParams || {}
  const normalized = view?.toLowerCase()

  if (ACCESS_CONTROL_ATTENDANCE_VIEWS.has(normalized)) {
    redirect(`/dashboard/access-control/${normalized}`)
  }

  // Business trips live under Leave Management now.
  if (normalized === "business-trips") {
    redirect("/dashboard/leave-management/business-trips")
  }

  // Punch history is covered by attendance history.
  if (normalized === "punch-history") {
    redirect("/dashboard/attendance/attendance-history")
  }

  // Today is presented as the live hero inside Attendance History so personal
  // attendance has one focused workspace instead of a duplicate Overview tab.
  if (normalized === "today") {
    redirect("/dashboard/attendance/attendance-history")
  }

  if (normalized === "settings") {
    redirect("/dashboard/attendance/policies")
  }

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/attendance")
  }

  if (normalized === "correction-requests") {
    return <HrAttendanceCorrectionApprovalsView />
  }

  if (normalized === "work-from-home-requests") {
    return <AttendanceWorkFromHomeClient />
  }

  if (normalized === "exemptions") {
    return <AttendanceExemptionsClient />
  }

  if (normalized === "biometric-access") {
    return <AccessControlActivityClient section="access-credentials" moduleTitle="Technical Access" />
  }

  if (SCHEDULE_ATTENDANCE_VIEWS.has(normalized)) {
    return <ScheduleManagementClient section={normalized} />
  }

  if (ACTIVITY_ATTENDANCE_VIEWS.has(normalized)) {
    const tab = sp.tab || normalized;
    return <AttendanceActivityClient section={tab} />
  }

  return <AttendanceManagementClient section={normalized} />
}
