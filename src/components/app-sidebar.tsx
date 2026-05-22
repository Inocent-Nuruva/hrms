"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { CommandIcon } from "lucide-react"
import { UsersRound } from "@/components/animate-ui/icons/users-round"
import { Route } from "@/components/animate-ui/icons/route"
import { Sparkles } from "@/components/animate-ui/icons/sparkles"
import { ChartBar } from "@/components/animate-ui/icons/chart-bar"
import { Key } from "@/components/animate-ui/icons/key"
import { CircleX } from "@/components/animate-ui/icons/circle-x"
import { ChartColumn } from "@/components/animate-ui/icons/chart-column"
import { Bell } from "@/components/animate-ui/icons/bell"
import { Settings } from "@/components/animate-ui/icons/settings"
import { Search } from "@/components/animate-ui/icons/search"
import { MessageCircleQuestion } from "@/components/animate-ui/icons/message-circle-question"
import type { AdminResourceKey } from "@/lib/admin-api"

const IUsers = <UsersRound size={48} animation="path-loop" />
const ILeave = <Route size={48} animation="path-loop" />
const IPromotion = <Sparkles size={48} animation="path-loop" />
const IPayroll = <ChartBar size={48} animation="path-loop" />
const IRegistration = <Key size={48} animation="path-loop" />
const IOffboarding = <CircleX size={48} animation="path-loop" />
const IAttendance = <ChartColumn size={48} animation="path-loop" />
const IHolidays = <Bell size={48} animation="path-loop" />
const ISettings = <Settings size={48} animation="path-loop" />
const IHelp = <MessageCircleQuestion size={48} animation="path-loop" />
const ISearch = <Search size={48} animation="path-loop" />

type AppSidebarAccessMode = "admin" | "employee"

type SearchItem = { title: string; url: string; section: string; keywords: string[] }

const adminData = {
  navMain: [
    {
      title: "Employees",
      icon: IUsers,
      items: [
        {
          title: "All Employees",
          url: "/dashboard/employees/all",
        },
        {
          title: "Register",
          url: "/dashboard/employees/register",
        },
        {
          title: "Offboarding",
          url: "/dashboard/employees/offboarding",
        },
        {
          title: "Onboarding",
          url: "/dashboard/employees/onboarding",
        },
        {
          title: "Attendance",
          url: "/dashboard/employees/attendance",
        },
      ],
    },
    {
      title: "Departments",
      url: "/dashboard/departments",
      icon: IUsers,
    },
    {
      title: "Branches",
      url: "/dashboard/branches",
      icon: IUsers,
    },
    {
      title: "Positions",
      icon: IUsers,
      items: [
        {
          title: "Positions",
          url: "/dashboard/positions",
        },
        {
          title: "Designations",
          url: "/dashboard/designations",
        },
      ],
    },
    {
      title: "Leave Management",
      icon: ILeave,
      items: [
        {
          title: "Leave Types",
          url: "/dashboard/leave-management/types",
        },
        {
          title: "Leave Requests",
          url: "/dashboard/leave-management/requests",
        },
        {
          title: "Leave Balances",
          url: "/dashboard/leave-management/balances",
        },
        {
          title: "Holidays",
          url: "/dashboard/leave-management/holidays",
        },
        {
          title: "Policies",
          url: "/dashboard/leave-management/policies",
        },
        {
          title: "Workflows",
          url: "/dashboard/leave-management/workflows",
        },
      ],
    },
    {
      title: "Promotion",
      url: "/dashboard/operations/promotion",
      icon: IPromotion,
    },
    {
      title: "Recruitment",
      url: "/dashboard/operations/recruitment",
      icon: IUsers,
    },
    {
      title: "Payroll",
      url: "/dashboard/operations/payroll",
      icon: IPayroll,
    },
    {
      title: "Reports",
      url: "/dashboard/operations/reports",
      icon: IUsers,
    },
    {
      title: "Access Control",
      icon: IUsers,
      items: [
        {
          title: "Roles",
          url: "/dashboard/roles",
        },
        {
          title: "Permissions",
          url: "/dashboard/permissions",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: ISettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: ISearch,
    },
  ],
}

const adminSearchIndex = [
  { title: "Dashboard", url: "/dashboard", section: "General", keywords: ["home", "overview"] },
  { title: "Employees / All Employees", url: "/dashboard/employees/all", section: "Employees", keywords: ["employee", "directory", "staff"] },
  { title: "Employees / Register", url: "/dashboard/employees/register", section: "Employees", keywords: ["employee", "onboard"] },
  { title: "Employees / Offboarding", url: "/dashboard/employees/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Employees / Onboarding", url: "/dashboard/employees/onboarding", section: "Employees", keywords: ["employee", "workflow", "request", "approve"] },
  { title: "Employees / Attendance", url: "/dashboard/employees/attendance", section: "Employees", keywords: ["attendance", "timesheet"] },
  { title: "Leave Management / Leave Types", url: "/dashboard/leave-management/types", section: "Leave", keywords: ["leave", "types", "vacation"] },
  { title: "Leave Management / Leave Requests", url: "/dashboard/leave-management/requests", section: "Leave", keywords: ["leave", "request", "approval"] },
  { title: "Leave Management / Leave Balances", url: "/dashboard/leave-management/balances", section: "Leave", keywords: ["leave", "balance", "quota"] },
  { title: "Leave Management / Holidays", url: "/dashboard/leave-management/holidays", section: "Leave", keywords: ["leave", "holiday", "calendar"] },
  { title: "Leave Management / Policies", url: "/dashboard/leave-management/policies", section: "Leave", keywords: ["leave", "policy", "quota"] },
  { title: "Leave Management / Workflows", url: "/dashboard/leave-management/workflows", section: "Leave", keywords: ["leave", "workflow", "approval"] },
  { title: "Departments", url: "/dashboard/departments", section: "Organization", keywords: ["department", "org"] },
  { title: "Branches", url: "/dashboard/branches", section: "Organization", keywords: ["branch", "location"] },
  { title: "Positions", url: "/dashboard/positions", section: "Organization", keywords: ["position", "job title"] },
  { title: "Designations", url: "/dashboard/designations", section: "Organization", keywords: ["designation", "grade", "hierarchy"] },
  { title: "Promotion", url: "/dashboard/operations/promotion", section: "Operations", keywords: ["career", "upgrade"] },
  { title: "Recruitment", url: "/dashboard/operations/recruitment", section: "Operations", keywords: ["hiring", "talent"] },
  { title: "Payroll", url: "/dashboard/operations/payroll", section: "Operations", keywords: ["salary", "payments"] },
  { title: "Reports", url: "/dashboard/operations/reports", section: "Operations", keywords: ["analytics", "insights"] },
  { title: "Roles", url: "/dashboard/roles", section: "Access Control", keywords: ["role", "access", "authorization"] },
  { title: "Permissions", url: "/dashboard/permissions", section: "Access Control", keywords: ["permission", "policy", "authorization"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
]

const employeeData = {
  navMain: [
    {
      title: "Registration",
      icon: IRegistration,
      url: "/dashboard/employees/register",
    },
    {
      title: "My Info",
      icon: IUsers,
      url: "/dashboard/me/profile",
    },
    {
      title: "My Attendance",
      icon: IAttendance,
      url: "/dashboard/employees/attendance",
    },
    {
      title: "My Leave",
      icon: ILeave,
      url: "/dashboard/leave-management/balances",
    },
    {
      title: "My Payroll",
      url: "/dashboard/operations/payroll",
      icon: IPayroll,
    },
    {
      title: "Office Holidays",
      icon: IHolidays,
      url: "/dashboard/leave-management/holidays",
    },
    {
      title: "My Promotion",
      icon: IPromotion,
      url: "/dashboard/operations/promotion",
    },
    {
      title: "Offboarding",
      icon: IOffboarding,
      url: "/dashboard/employees/offboarding",
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: ISettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: ISearch,
    },
  ],
}

const employeeSearchIndex = [
  { title: "Dashboard", url: "/dashboard", section: "General", keywords: ["home", "overview"] },
  { title: "Registration", url: "/dashboard/employees/register", section: "Employees", keywords: ["employee", "register", "onboard"] },
  { title: "My Info", url: "/dashboard/me/profile", section: "Employees", keywords: ["profile", "my info", "account"] },
  { title: "My Attendance", url: "/dashboard/employees/attendance", section: "Employees", keywords: ["attendance", "timesheet"] },
  { title: "My Leave", url: "/dashboard/leave-management/balances", section: "Leave", keywords: ["leave", "balance", "quota"] },
  { title: "My Payroll", url: "/dashboard/operations/payroll", section: "Operations", keywords: ["salary", "payments", "payroll"] },
  { title: "Office Holidays", url: "/dashboard/leave-management/holidays", section: "Leave", keywords: ["leave", "holiday", "calendar", "office"] },
  { title: "My Promotion", url: "/dashboard/operations/promotion", section: "Operations", keywords: ["career", "upgrade"] },
  { title: "Offboarding", url: "/dashboard/employees/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userName?: string | null
  userEmail?: string | null
  companyName?: string | null
  accessMode?: AppSidebarAccessMode
  permissionLabels?: string[]
  activeResource?: AdminResourceKey
  onSelectResource?: (resource: AdminResourceKey) => void
}

const ADMIN_ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/dashboard/employees/all": ["employees:read"],
  "/dashboard/employees/register": ["employees:create"],
  "/dashboard/employees/offboarding": ["offboarding_requests:read", "offboarding_workflows:read"],
  "/dashboard/employees/onboarding": ["onboarding_requests:read", "onboarding_workflows:read"],
  "/dashboard/employees/attendance": [
    "attendance_devices:read",
    "attendance_settings:read",
    "attendance_policies:read",
    "attendance_checkpoints:read",
  ],
  "/dashboard/departments": ["departments:read"],
  "/dashboard/branches": ["branches:read"],
  "/dashboard/positions": ["positions:read"],
  "/dashboard/designations": ["designations:read"],
  "/dashboard/leave-management/types": ["leave_types:read"],
  "/dashboard/leave-management/requests": ["leave_requests:read"],
  "/dashboard/leave-management/balances": ["leave_balances:read"],
  "/dashboard/leave-management/holidays": ["holidays:read", "attendance_holidays:read"],
  "/dashboard/leave-management/policies": ["leave_policies:read"],
  "/dashboard/leave-management/workflows": ["leave_workflows:read"],
  "/dashboard/operations/promotion": ["view_company_data"],
  "/dashboard/operations/recruitment": ["view_company_data"],
  "/dashboard/operations/payroll": ["view_company_data"],
  "/dashboard/operations/reports": ["view_company_data"],
  "/dashboard/roles": ["roles:read"],
  "/dashboard/permissions": ["permissions:read"],
}

function normalizePermissionLabels(permissionLabels: string[]) {
  return permissionLabels
    .map((label) => label.trim().toLowerCase())
    .filter((label) => label.length > 0)
}

function canAccessAdminRoute(url: string, normalizedPermissions: string[]) {
  const requiredPermissions = ADMIN_ROUTE_PERMISSIONS[url]
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true
  }
  if (normalizedPermissions.length === 0) {
    return false
  }
  if (
    normalizedPermissions.some(
      (entry) => entry === "*" || entry === "all" || entry.includes("admin") || entry.includes("super")
    )
  ) {
    return true
  }
  return requiredPermissions.some((required) => normalizedPermissions.includes(required))
}

function filterAdminNavByPermissions(navMain: typeof adminData.navMain, normalizedPermissions: string[]) {
  return navMain
    .map((item) => {
      if ("url" in item) {
        return canAccessAdminRoute(item.url ?? "", normalizedPermissions) ? item : null
      }
      const filteredItems = item.items.filter((subItem) => canAccessAdminRoute(subItem.url, normalizedPermissions))
      if (filteredItems.length === 0) {
        return null
      }
      return {
        ...item,
        items: filteredItems,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

function filterAdminSearchByPermissions(searchItems: SearchItem[], normalizedPermissions: string[]) {
  return searchItems.filter((item) => canAccessAdminRoute(item.url, normalizedPermissions))
}

export function AppSidebar({
  userName,
  userEmail,
  companyName,
  accessMode = "admin",
  permissionLabels = [],
  activeResource,
  onSelectResource,
  ...props
}: AppSidebarProps) {
  const normalizedPermissions = React.useMemo(
    () => normalizePermissionLabels(permissionLabels),
    [permissionLabels]
  )

  const navData = React.useMemo(() => {
    if (accessMode === "employee") {
      return employeeData
    }
    return {
      ...adminData,
      navMain: filterAdminNavByPermissions(adminData.navMain, normalizedPermissions),
    }
  }, [accessMode, normalizedPermissions])

  const searchIndex = React.useMemo(() => {
    if (accessMode === "employee") {
      return employeeSearchIndex
    }
    return filterAdminSearchByPermissions(adminSearchIndex, normalizedPermissions)
  }, [accessMode, normalizedPermissions])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:cursor-default data-[slot=sidebar-menu-button]:rounded-xl data-[slot=sidebar-menu-button]:p-2.5!"
              render={<div />}
              aria-disabled="true"
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">
                {companyName ?? (accessMode === "employee" ? "HRMS Portal" : "HRMS Admin")}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <NavMain
          items={navData.navMain}
          activeResource={activeResource}
          onSelectResource={onSelectResource}
        />
        <NavSecondary items={navData.navSecondary} searchItems={searchIndex} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: userName ?? "Admin",
            email: userEmail ?? "admin@hrms.local",
            avatar: "/assets/alliance-logo.png",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
