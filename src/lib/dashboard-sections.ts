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
      { title: "Registration", url: "/dashboard/employees/registration" },
      { title: "Onboarding", url: "/dashboard/employees/onboarding" },
      { title: "Profile Updates", url: "/dashboard/employees/profile-update-approvals" },
      { title: "Offboarding", url: "/dashboard/employees/offboarding" },
    ],
  },
]

export const attendanceSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Attendance Operations",
    items: [
      { title: "Daily Summaries", url: "/dashboard/attendance/daily-summaries" },
      { title: "Mobile Punch Review", url: "/dashboard/attendance/mobile-punches" },
      { title: "Recalculation Jobs", url: "/dashboard/attendance/recalculation-jobs" },
      { title: "Unmatched Logs", url: "/dashboard/attendance/unmatched-logs" },
      { title: "Device Sync Logs", url: "/dashboard/attendance/device-sync-logs" },
    ],
  },
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
    // Single-item group → rendered as a direct tab link (no dropdown).
    title: "Correction Requests",
    items: [{ title: "Correction Requests", url: "/dashboard/attendance/correction-requests" }],
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
]

export const employeeAttendanceSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "Overview", url: "/dashboard/attendance/today" },
      { title: "Punch History", url: "/dashboard/attendance/punch-history" },
      { title: "Attendance History", url: "/dashboard/attendance/attendance-history" },
      { title: "Schedule Preview", url: "/dashboard/attendance/schedule-preview" },
      { title: "Correction Requests", url: "/dashboard/attendance/corrections" },
    ],
  },
]

export const selfLeaveSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "Requests", url: "/dashboard/me/leave/requests" },
      { title: "Balances", url: "/dashboard/me/leave/balances" },
      { title: "Holidays", url: "/dashboard/me/leave/holidays" },
      { title: "Policies", url: "/dashboard/me/leave/policies" },
    ],
  },
]

export const positionsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "Positions", url: "/dashboard/positions" },
    ],
  },
]

export const leaveManagementSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "Leave Types", url: "/dashboard/leave-management/types" },
      { title: "Leave Requests", url: "/dashboard/leave-management/requests" },
      { title: "Leave Balances", url: "/dashboard/leave-management/balances" },
      { title: "Business Trips", url: "/dashboard/leave-management/business-trips" },
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
