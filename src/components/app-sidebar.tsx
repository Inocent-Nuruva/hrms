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
import { Kanban } from "@/components/animate-ui/icons/kanban"
import { MapPin } from "@/components/animate-ui/icons/map-pin"
import { ChartColumn } from "@/components/animate-ui/icons/chart-column"
import { Route } from "@/components/animate-ui/icons/route"
import { Sparkles } from "@/components/animate-ui/icons/sparkles"
import { Key } from "@/components/animate-ui/icons/key"
import { ChartBar } from "@/components/animate-ui/icons/chart-bar"
import { ChartLine } from "@/components/animate-ui/icons/chart-line"
import { LockKeyhole } from "@/components/animate-ui/icons/lock-keyhole"
import { Settings } from "@/components/animate-ui/icons/settings"
import { Search } from "@/components/animate-ui/icons/search"
import { MessageCircleQuestion } from "@/components/animate-ui/icons/message-circle-question"
import type { AdminResourceKey } from "@/lib/admin-api"

const IUsers = <UsersRound size={48} animation="path-loop" />
const IDepartments = <Kanban size={48} animation="path-loop" />
const IBranches = <MapPin size={48} animation="path-loop" />
const IPositions = <ChartColumn size={48} animation="path-loop" />
const ILeave = <Route size={48} animation="path-loop" />
const IPromotion = <Sparkles size={48} animation="path-loop" />
const IRecruitment = <Key size={48} animation="path-loop" />
const IPayroll = <ChartBar size={48} animation="path-loop" />
const IReports = <ChartLine size={48} animation="path-loop" />
const IAccess = <LockKeyhole size={48} animation="path-loop" />
const ISettings = <Settings size={48} animation="path-loop" />
const IHelp = <MessageCircleQuestion size={48} animation="path-loop" />
const ISearch = <Search size={48} animation="path-loop" />

const data = {
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
      icon: IDepartments,
    },
    {
      title: "Branches",
      url: "/dashboard/branches",
      icon: IBranches,
    },
    {
      title: "Positions",
      icon: IPositions,
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
      icon: IRecruitment,
    },
    {
      title: "Payroll",
      url: "/dashboard/operations/payroll",
      icon: IPayroll,
    },
    {
      title: "Reports",
      url: "/dashboard/operations/reports",
      icon: IReports,
    },
    {
      title: "Access Control",
      icon: IAccess,
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

const searchIndex = [
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
              className="data-[slot=sidebar-menu-button]:cursor-default data-[slot=sidebar-menu-button]:rounded-xl data-[slot=sidebar-menu-button]:p-2.5!"
              render={<div />}
              aria-disabled="true"
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">{companyName ?? "HRMS Admin"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-2">
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
