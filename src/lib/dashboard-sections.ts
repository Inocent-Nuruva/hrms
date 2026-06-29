export type DashboardSectionTab = {
  title: string
  url: string
}

export type DashboardSectionTabGroup = {
  title?: string
  items: DashboardSectionTab[]
}

export const employeeSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "All Employees", url: "/dashboard/employees/all" },
      { title: "Register", url: "/dashboard/employees/register" },
      { title: "Offboarding", url: "/dashboard/employees/offboarding" },
      { title: "Onboarding", url: "/dashboard/employees/onboarding" },
    ],
  },
]

export const attendanceSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Attendance Setup",
    items: [
      { title: "Settings", url: "/dashboard/attendance/settings" },
      { title: "Policies", url: "/dashboard/attendance/policies" },
      { title: "Holiday Groups", url: "/dashboard/attendance/holiday-groups" },
      { title: "Holidays", url: "/dashboard/attendance/holidays" },
      { title: "Geofences", url: "/dashboard/attendance/geofences" },
      { title: "Wi-Fi Networks", url: "/dashboard/attendance/wifi-networks" },
      { title: "Checkpoints", url: "/dashboard/attendance/checkpoints" },
    ],
  },
  {
    title: "Shift Management",
    items: [
      { title: "Shifts", url: "/dashboard/attendance/shifts" },
      { title: "Shift Breaks", url: "/dashboard/attendance/shift-breaks" },
      { title: "Shift Assignments", url: "/dashboard/attendance/shift-assignments" },
      { title: "Shift Schedules", url: "/dashboard/attendance/shift-schedules" },
      { title: "Rotation Groups and Rules", url: "/dashboard/attendance/shift-rotation-groups" },
    ],
  },
  {
    title: "Timetable Management",
    items: [
      { title: "Timetables", url: "/dashboard/attendance/timetables" },
      { title: "Timetable Days", url: "/dashboard/attendance/timetable-days" },
      { title: "Timetable Holiday Rules", url: "/dashboard/attendance/timetable-holiday-rules" },
      { title: "Timetable Rotations and Rules", url: "/dashboard/attendance/timetable-rotations" },
      { title: "Employee Timetables", url: "/dashboard/attendance/employee-timetables" },
    ],
  },
  {
    title: "Attendance Operations",
    items: [
      { title: "Mobile Punch Review", url: "/dashboard/attendance/mobile-punches" },
      { title: "Daily Summaries", url: "/dashboard/attendance/daily-summaries" },
      { title: "Recalculation Jobs", url: "/dashboard/attendance/recalculation-jobs" },
      { title: "Unmatched Logs", url: "/dashboard/attendance/unmatched-logs" },
      { title: "Device Sync Logs", url: "/dashboard/attendance/device-sync-logs" },
    ],
  },
]

export const employeeAttendanceSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "Overview", url: "/dashboard/attendance/today" },
      { title: "Punch History", url: "/dashboard/attendance/punch-history" },
      { title: "Attendance History", url: "/dashboard/attendance/attendance-history" },
      { title: "Schedule Preview", url: "/dashboard/attendance/schedule-preview" },
    ],
  },
]

export const positionsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "Positions", url: "/dashboard/positions" },
      { title: "Designations", url: "/dashboard/designations" },
    ],
  },
]

export const leaveManagementSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "Leave Types", url: "/dashboard/leave-management/types" },
      { title: "Leave Requests", url: "/dashboard/leave-management/requests" },
      { title: "Leave Balances", url: "/dashboard/leave-management/balances" },
      { title: "Holidays", url: "/dashboard/leave-management/holidays" },
      { title: "Policies", url: "/dashboard/leave-management/policies" },
      { title: "Workflows", url: "/dashboard/leave-management/workflows" },
    ],
  },
]

export const accessControlSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "Devices", url: "/dashboard/access-control/devices" },
      { title: "Doors", url: "/dashboard/access-control/doors" },
      { title: "Templates", url: "/dashboard/access-control/templates" },
      { title: "Organization", url: "/dashboard/access-control/organizations" },
      { title: "Groups", url: "/dashboard/access-control/groups" },
      { title: "Roles", url: "/dashboard/roles" },
      { title: "Permissions", url: "/dashboard/permissions" },
    ],
  },
]
