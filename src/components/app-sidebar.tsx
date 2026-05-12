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
import {
  BarChart3Icon,
  BriefcaseBusinessIcon,
  CircleHelpIcon,
  CommandIcon,
  KeyRoundIcon,
  LandmarkIcon,
  TrendingUpIcon,
  SearchIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react"
import type { AdminResourceKey } from "@/lib/admin-api"

const data = {
  navMain: [
    {
      title: "Employees",
      icon: <UsersIcon />,
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
          title: "Leave Management",
          url: "/dashboard/employees/leave-management",
        },
        {
          title: "Attendance",
          url: "/dashboard/employees/attendance",
        },
      ],
    },
    {
      title: "Promotion",
      url: "/dashboard/operations/promotion",
      icon: <TrendingUpIcon />,
    },
    {
      title: "Recruitment",
      url: "/dashboard/operations/recruitment",
      icon: <BriefcaseBusinessIcon />,
    },
    {
      title: "Payroll",
      url: "/dashboard/operations/payroll",
      icon: <LandmarkIcon />,
    },
    {
      title: "Reports",
      url: "/dashboard/operations/reports",
      icon: <BarChart3Icon />,
    },
    {
      title: "Access Control",
      icon: <KeyRoundIcon />,
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
      icon: <Settings2Icon />,
    },
    {
      title: "Get Help",
      url: "#",
      icon: <CircleHelpIcon />,
    },
    {
      title: "Search",
      url: "#",
      icon: <SearchIcon />,
    },
  ],
}

const searchIndex = [
  { title: "Dashboard", url: "/dashboard", section: "General", keywords: ["home", "overview"] },
  { title: "Employees / All Employees", url: "/dashboard/employees/all", section: "Employees", keywords: ["employee", "directory", "staff"] },
  { title: "Employees / Register", url: "/dashboard/employees/register", section: "Employees", keywords: ["employee", "onboard"] },
  { title: "Employees / Offboarding", url: "/dashboard/employees/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Employees / Leave Management", url: "/dashboard/employees/leave-management", section: "Employees", keywords: ["leave", "vacation"] },
  { title: "Employees / Attendance", url: "/dashboard/employees/attendance", section: "Employees", keywords: ["attendance", "timesheet"] },
  { title: "Promotion", url: "/dashboard/operations/promotion", section: "Operations", keywords: ["career", "upgrade"] },
  { title: "Recruitment", url: "/dashboard/operations/recruitment", section: "Operations", keywords: ["hiring", "talent"] },
  { title: "Payroll", url: "/dashboard/operations/payroll", section: "Operations", keywords: ["salary", "payments"] },
  { title: "Reports", url: "/dashboard/operations/reports", section: "Operations", keywords: ["analytics", "insights"] },
  { title: "Roles", url: "/dashboard/roles", section: "Access Control", keywords: ["role", "access", "authorization"] },
  { title: "Permissions", url: "/dashboard/permissions", section: "Access Control", keywords: ["permission", "policy", "authorization"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userName?: string | null
  userEmail?: string | null
  companyName?: string | null
  activeResource?: AdminResourceKey
  onSelectResource?: (resource: AdminResourceKey) => void
}

export function AppSidebar({
  userName,
  userEmail,
  companyName,
  activeResource,
  onSelectResource,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:cursor-default data-[slot=sidebar-menu-button]:p-1.5!"
              render={<div />}
              aria-disabled="true"
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">{companyName ?? "HRMS Admin"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={data.navMain}
          activeResource={activeResource}
          onSelectResource={onSelectResource}
        />
        <NavSecondary items={data.navSecondary} searchItems={searchIndex} className="mt-auto" />
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
