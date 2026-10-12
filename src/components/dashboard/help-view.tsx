"use client"

import Link from "next/link"
import { motion } from "framer-motion"

import { HeroBand, TalentDoodleSprites } from "@/components/dashboard/talent-visuals"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useForbiddenPrefixes } from "@/hooks/use-forbidden-route-guard"
import { canSeeDashboardPage } from "@/lib/forbidden-routes"
import { useDashboardMotion } from "@/lib/dashboard-motion"

const SHORTCUTS = [
  { keys: "Ctrl K", label: "Open global search" },
  { keys: "↑ ↓", label: "Move through search results" },
  { keys: "Enter", label: "Open the selected search result" },
]

type HelpDestination = { title: string; url: string; hint: string }

const SELF_PAGES: HelpDestination[] = [
  { title: "My profile", url: "/dashboard/me/profile", hint: "Name, photo, and contact details" },
  { title: "My attendance", url: "/dashboard/attendance/today", hint: "Today’s state and punch history" },
  { title: "My leave", url: "/dashboard/me/leave/requests", hint: "Requests, balances, and holidays" },
  { title: "My payroll", url: "/dashboard/me/finance/payroll", hint: "Payslips and payment details" },
  { title: "My performance & activities", url: "/dashboard/me/performance/overview", hint: "KPIs, daily work, reviews, and scores" },
  { title: "My probation", url: "/dashboard/me/probation", hint: "Your confirmation case" },
  { title: "My field", url: "/dashboard/me/field/visits", hint: "Visits, plans, and follow-ups" },
  { title: "My finance", url: "/dashboard/me/finance/payroll", hint: "Payroll, loans, and advances" },
  { title: "My movements", url: "/dashboard/me/movements", hint: "Transfers and role changes" },
  { title: "My team", url: "/dashboard/me/team/overview", hint: "People who report to you" },
  { title: "My requests", url: "/dashboard/me/requests/actions", hint: "Things waiting on you" },
  { title: "Onboarding", url: "/dashboard/me/onboarding", hint: "Your joining checklist" },
  { title: "Offboarding", url: "/dashboard/me/offboarding", hint: "Your exit checklist" },
  { title: "Settings", url: "/dashboard/settings", hint: "Password, 2FA, and devices" },
]

const COMPANY_PAGES: HelpDestination[] = [
  { title: "Access control", url: "/dashboard/access-control", hint: "Roles, devices, and doors" },
  { title: "Attendance", url: "/dashboard/attendance", hint: "Summaries, shifts, and setup" },
  { title: "Employees", url: "/dashboard/employees/all", hint: "Directory and employee records" },
  { title: "Leave management", url: "/dashboard/leave-management", hint: "Types, requests, and balances" },
  { title: "Performance & Activities", url: "/dashboard/performance/overview", hint: "KPI cycles, work, reviews, and reports" },
  { title: "Probation", url: "/dashboard/probation/overview", hint: "Confirmation cases and policies" },
  { title: "Field", url: "/dashboard/field/overview", hint: "Visits, map, and parties" },
  { title: "Finance", url: "/dashboard/finance/overview", hint: "Products, applications, and accounts" },
  { title: "Movements", url: "/dashboard/movements/overview", hint: "Transfers and promotions" },
  { title: "Structure", url: "/dashboard/structure/cost-centers", hint: "Cost centers, grades, and numbering" },
  { title: "Invite and register", url: "/dashboard/operations/recruitment", hint: "Invites and new hires" },
  { title: "Payroll", url: "/dashboard/operations/payroll", hint: "Runs, inputs, and configuration" },
  { title: "Reports", url: "/dashboard/operations/reports", hint: "Attendance downloads and analytics jobs" },
  { title: "Notifications", url: "/dashboard/operations/notifications", hint: "Company alerts" },
  { title: "SMS", url: "/dashboard/sms/overview", hint: "Templates and message logs" },
  { title: "Insights", url: "/dashboard/insights/hr", hint: "HR and management dashboards" },
  { title: "Settings", url: "/dashboard/settings", hint: "Password, 2FA, and devices" },
]

export function HelpView() {
  const motionPreset = useDashboardMotion()
  const actor = useDashboardActor()
  useForbiddenPrefixes()
  const catalog = actor.accessMode === "admin" ? COMPANY_PAGES : SELF_PAGES
  const visiblePages = actor.ready
    ? catalog.filter((item) => canSeeDashboardPage(item.url, actor.permissionLabels, actor.accessMode))
    : []

  return (
    <motion.section className="space-y-8" variants={motionPreset.container} initial="hidden" animate="show">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="Help"
        title="How to get around"
        description="Search, shortcuts, and the pages you can open with your current access."
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Keyboard</h2>
          <ul className="divide-y divide-border/80">
            {SHORTCUTS.map((item) => (
              <li key={item.keys} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <kbd className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                  {item.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Sign-in</h2>
          <p className="text-sm text-muted-foreground">
            Use your work email and password. If your account uses two-factor authentication, you will
            be asked for that code after you sign in.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Pages you can open</h2>
        {visiblePages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other pages are available for your access.</p>
        ) : (
          <ul className="divide-y divide-border/80">
            {visiblePages.map((item) => (
              <li key={item.url} className="py-2.5">
                <Link href={item.url} className="group flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-primary group-hover:underline">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.section>
  )
}
