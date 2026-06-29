"use client"

import * as React from "react"
import Link from "next/link"
import {
  Building2Icon,
  CalendarIcon,
  CalendarClockIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  UserIcon,
} from "lucide-react"
import { LumaSpin } from "@/components/ui/luma-spin"


import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  getMyDashboard,
  getMyAttendanceToday,
  listMyLeaveBalances,
  type AdminRecord,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { asRecord, readString } from "@/utils/token-utils"

const ADMIN_ROLE_KEYS = new Set([
  "admin",
  "administrator",
  "super_admin",
  "super-admin",
  "company_admin",
  "company-admin",
  "hr_admin",
  "hr-admin",
  "owner",
  "root",
])

type DashboardRole = {
  id: number
  name: string
  display_name?: string
  description?: string
  company_id?: number
  is_system_generated?: boolean
  created_at?: string
  updated_at?: string
}

type DashboardPermission = {
  id: number
  name: string
  display_name?: string
  description?: string
  is_system_generated?: boolean
  created_at?: string
  updated_at?: string
}

type DashboardCompany = {
  id: number
  name: string
  slug?: string
  status?: string
}

type DashboardCompanyMembership = {
  id: number
  company_id: number
  user_id: number
  status?: string
  is_default?: boolean
  last_accessed_at?: string
}

type DashboardManager = {
  id: number
  employee_no?: string
  first_name?: string
  last_name?: string
  company_user?: {
    id?: number
    company_id?: number
    user_id?: number
    status?: string
    user?: {
      id?: number
      user_no?: string
      first_name?: string
      last_name?: string
      phone?: string
      email?: string
      status?: string
      user_type?: string
    } | null
  } | null
}

type DashboardBranch = {
  id: number
  name: string
  code?: string
  city?: string
  country?: string
  status?: string
}

type DashboardDepartment = {
  id: number
  name: string
  code?: string
  description?: string
  status?: string
  branch?: DashboardBranch | null
}

type DashboardPosition = {
  id: number
  name: string
  code?: string
  description?: string
  status?: string
}

type DashboardEmployee = {
  id: number
  employee_no: string
  first_name?: string
  middle_name?: string | null
  last_name?: string
  preferred_name?: string | null
  profile_photo_url?: string | null
  employment_status?: string
  employment_type?: string
  hire_date?: string | null
  probation_end_date?: string | null
  notes?: string | null
  primary_branch?: DashboardBranch | null
  primary_department?: DashboardDepartment | null
  primary_position?: DashboardPosition | null
  manager?: DashboardManager | null
  metadata?: Record<string, unknown> | null
}

type DashboardUser = {
  id: number
  user_no: string
  first_name: string
  last_name: string
  phone?: string
  email: string
  status: string
  user_type?: string
  roles: DashboardRole[]
  permissions: DashboardPermission[]
  active_company?: DashboardCompany | null
  active_company_membership?: DashboardCompanyMembership | null
}

type EmployeeDashboardData = {
  generated_at?: string
  user: DashboardUser
  employee: DashboardEmployee
  status?: {
    account_status?: string
    employment_status?: string
    employment_type?: string
  } | null
  action_flags?: {
    can_check_in?: boolean
    can_check_out?: boolean
    can_request_leave?: boolean
    has_employee_profile?: boolean
  } | null
  links?: {
    profile?: string
    leave_requests?: string
    leave_balances?: string
  } | null
}

type EmployeeDashboardViewProps = {
  dashboardData: EmployeeDashboardData
  attendanceToday?: AdminRecord | null
  leaveBalances?: AdminRecord[]
}

type LeaveBalanceSummary = {
  typeName: string
  available: number | string
  used?: number | string
}

function isEmployeeDashboardData(value: unknown): value is EmployeeDashboardData {
  const record = asRecord(value)
  const user = asRecord(record?.user)
  const employee = asRecord(record?.employee)
  return Boolean(user && employee)
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[1]) {
    return null
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    return asRecord(JSON.parse(atob(padded)))
  } catch {
    return null
  }
}

function collectRoleLabels(record: Record<string, unknown> | null) {
  if (!record) {
    return [] as string[]
  }

  const labels = new Set<string>()
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      labels.add(value.trim().toLowerCase())
      return
    }
    const nested = asRecord(value)
    if (!nested) {
      return
    }
    const nestedLabel = readString(nested, ["name", "role", "key", "code", "slug", "type", "user_type"])
    if (nestedLabel) {
      labels.add(nestedLabel.toLowerCase())
    }
  }

  push(record.role)
  push(record.user_type)
  push(record.type)

  for (const key of ["roles", "authorities", "userRole", "user_role"]) {
    const value = record[key]
    if (Array.isArray(value)) {
      value.forEach((entry) => push(entry))
      continue
    }
    push(value)
  }

  return Array.from(labels)
}

function isAdminIdentity() {
  if (typeof window === "undefined") {
    return true
  }

  let storedUser: Record<string, unknown> | null = null
  const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
  if (rawUser) {
    try {
      storedUser = asRecord(JSON.parse(rawUser))
    } catch {
      storedUser = null
    }
  }

  const rawTokens = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  let tokenPayload: Record<string, unknown> | null = null
  if (rawTokens) {
    try {
      const parsed = JSON.parse(rawTokens) as Record<string, unknown>
      const accessToken =
        (typeof parsed.accessToken === "string" && parsed.accessToken.trim()) ||
        (typeof parsed.access_token === "string" && parsed.access_token.trim()) ||
        ""
      tokenPayload = accessToken ? decodeJwtPayload(accessToken) : null
    } catch {
      tokenPayload = null
    }
  }

  const labels = [...collectRoleLabels(storedUser), ...collectRoleLabels(tokenPayload)]
  return labels.some((role) => ADMIN_ROLE_KEYS.has(role))
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function computeTenure(hireDate?: string | null): string {
  if (!hireDate) return "—"
  const hire = new Date(hireDate)
  if (Number.isNaN(hire.getTime())) return "—"
  const now = new Date()
  let years = now.getFullYear() - hire.getFullYear()
  let months = now.getMonth() - hire.getMonth()
  if (months < 0) {
    years--
    months += 12
  }
  if (years > 0) {
    return `${years}y ${months}m`
  }
  return `${months}m`
}

function extractLeaveSummaries(balances: AdminRecord[] | undefined): LeaveBalanceSummary[] {
  if (!Array.isArray(balances) || balances.length === 0) return []
  return balances.slice(0, 4).map((b) => {
    const typeName =
      readString(b, ["leave_type_name", "leave_type", "name", "type_name", "policy_name"]) || "Leave"
    const available = b.available ?? b.balance ?? b.remaining ?? b.current_balance ?? "—"
    const used = b.used ?? b.taken ?? undefined
    return {
      typeName: String(typeName),
      available: typeof available === "number" ? available : String(available),
      used: used != null ? (typeof used === "number" ? used : String(used)) : undefined,
    }
  })
}

function formatPunchState(state: string | null | undefined): string {
  if (!state) return "No activity"
  return state
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getAttendanceStatus(today: AdminRecord | null | undefined) {
  if (!today) return { label: "No data", hint: "—" }
  const state = readString(today, ["punch_state", "status", "state", "attendance_status"])
  const proc = readString(today, ["processing_state"])
  const first = readString(today, ["first_punch", "first_punch_at", "check_in"])
  const last = readString(today, ["last_punch", "last_punch_at", "check_out"])
  const label = formatPunchState(state)
  let hint = first ? (last ? `In: ${first} • Out: ${last}` : `First: ${first}`) : "—"
  if (proc) hint += ` (${proc.replace(/_/g, " ")})`
  return { label, hint }
}

function QuickActionCard({
  href,
  title,
  icon,
  delay = 0,
  mounted = true,
}: {
  href: string
  title: string
  icon: React.ReactNode
  delay?: number
  mounted?: boolean
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 transition-all duration-400 ease-out hover:border-primary/50 hover:bg-accent/30 no-underline hover:no-underline"
      style={{ 
        opacity: mounted ? 1 : 0, 
        transform: mounted ? 'translateY(0)' : 'translateY(6px)',
        transitionDelay: `${delay}ms`
      }}
    >
      <div className="shrink-0 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-tight text-foreground no-underline">{title}</h3>
      </div>
      <div className="transition-transform group-hover:-translate-y-px">
        <span className="text-xs font-medium text-primary">Open →</span>
      </div>
    </Link>
  )
}

export function EmployeeDashboardView({
  dashboardData,
  attendanceToday,
  leaveBalances,
}: EmployeeDashboardViewProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(false)
    const id = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(id)
  }, [dashboardData])

  if (!isEmployeeDashboardData(dashboardData)) {
    return (
      <Card className="rounded-2xl border border-border bg-card">
        <CardContent className="py-10">
          <p className="text-sm text-muted-foreground">
            Your dashboard data is not ready yet. Please refresh in a moment.
          </p>
        </CardContent>
      </Card>
    )
  }

  const fullName = `${dashboardData.user.first_name} ${dashboardData.user.last_name}`.trim()
  const preferredName = dashboardData.employee.preferred_name?.trim() || dashboardData.user.first_name
  const profileHref = "/dashboard/me/profile"
  const leaveBalancesHref = "/dashboard/me/leave/balances"
  const leaveRequestHref = "/dashboard/me/leave/requests"
  const attendanceHref = "/dashboard/attendance/today"
  const holidaysHref = "/dashboard/me/leave/holidays"

  const managerUser = dashboardData.employee.manager?.company_user?.user
  const managerName =
    [dashboardData.employee.manager?.first_name, dashboardData.employee.manager?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "Not assigned"

  const tenure = computeTenure(dashboardData.employee.hire_date)

  const att = getAttendanceStatus(attendanceToday)
  const leaveSummaries = extractLeaveSummaries(leaveBalances)

  return (
    <div className="space-y-4">
      {/* Greeting + quick context */}
      <div 
        className="flex flex-col gap-1 transition-all duration-500 ease-out"
        style={{ 
          opacity: mounted ? 1 : 0, 
          transform: mounted ? 'translateY(0)' : 'translateY(6px)',
          transitionDelay: '0ms'
        }}
      >
        <h1 className="text-xl tracking-tight text-foreground">
          {["Good", "to", "see", "you,"].map((word, index) => {
            const delay = index * 80
            return (
              <span 
                key={index} 
                className="inline-block mr-1 transition-all duration-300"
                style={{ 
                  opacity: mounted ? 1 : 0, 
                  transform: mounted ? 'translateY(0)' : 'translateY(6px)',
                  transitionDelay: `${delay}ms`
                }}
              >
                {word}
              </span>
            )
          })}
          <span 
            className="font-semibold transition-all duration-300"
            style={{ 
              opacity: mounted ? 1 : 0, 
              transitionDelay: '380ms'
            }}
          >
            {dashboardData.user.first_name}
          </span>.
        </h1>
      </div>

      {/* Quick actions - useful and clear */}
      <div 
        className="rounded-3xl border border-border bg-card/90 p-5 transition-all duration-500 ease-out"
        style={{ 
          opacity: mounted ? 1 : 0, 
          transform: mounted ? 'translateY(0)' : 'translateY(8px)',
          transitionDelay: '280ms'
        }}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {dashboardData.employee.profile_photo_url ? (
                <AvatarImage src={dashboardData.employee.profile_photo_url} alt={fullName} />
              ) : null}
              <AvatarFallback className="text-lg">{initialsFor(fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-lg font-semibold tracking-tight text-foreground">{preferredName}</div>
              <div className="text-xs text-muted-foreground">{dashboardData.employee.employee_no}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {dashboardData.employee.primary_position?.name ?? "Position"} · {dashboardData.employee.primary_department?.name ?? "Department"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="rounded-lg border border-border bg-muted/60 px-2.5 py-1">
              <span className="text-muted-foreground">Hired</span> <span className="font-medium text-foreground">{formatDate(dashboardData.employee.hire_date)}</span>
            </div>
            <div className="rounded-lg border border-border bg-muted/60 px-2.5 py-1">
              <span className="text-muted-foreground">Tenure</span> <span className="font-medium text-foreground">{tenure}</span>
            </div>
            <Link href={profileHref} className="no-underline hover:no-underline">
              <Button size="sm" variant="outline" className="h-8">View full profile</Button>
            </Link>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            href={attendanceHref}
            title="Attendance"
            icon={<ClockIcon className="size-4 text-primary" />}
            delay={320}
            mounted={mounted}
          />
          <QuickActionCard
            href={leaveRequestHref}
            title="Request leave"
            icon={<CalendarClockIcon className="size-4 text-primary" />}
            delay={380}
            mounted={mounted}
          />
          <QuickActionCard
            href={leaveBalancesHref}
            title="Leave balances"
            icon={<CalendarIcon className="size-4 text-primary" />}
            delay={440}
            mounted={mounted}
          />
          <QuickActionCard
            href={holidaysHref}
            title="Office holidays"
            icon={<CalendarIcon className="size-4 text-primary" />}
            delay={500}
            mounted={mounted}
          />
        </div>
      </div>

      <div className="my-3 border-t border-border" />

      {/* Main two-column content */}
      <div 
        className="grid gap-3 lg:grid-cols-12 transition-all duration-500 ease-out"
        style={{ 
          opacity: mounted ? 1 : 0, 
          transform: mounted ? 'translateY(0)' : 'translateY(8px)',
          transitionDelay: '420ms'
        }}
      >
        {/* Left: My details + Manager */}
        <div className="lg:col-span-7 space-y-3">
          <div 
            className="transition-all duration-500 ease-out"
            style={{ 
              opacity: mounted ? 1 : 0, 
              transform: mounted ? 'translateY(0)' : 'translateY(6px)',
              transitionDelay: '480ms'
            }}
          >
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Employment details</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div 
                className="flex gap-2.5 transition-all duration-400 ease-out"
                style={{ 
                  opacity: mounted ? 1 : 0, 
                  transform: mounted ? 'translateY(0)' : 'translateY(4px)',
                  transitionDelay: '520ms'
                }}
              >
                <UserIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
                <div className="text-xs">
                  <div className="text-muted-foreground">Employee number</div>
                  <div className="font-medium text-foreground">{dashboardData.employee.employee_no}</div>
                </div>
              </div>
              <div 
                className="flex gap-2.5 transition-all duration-400 ease-out"
                style={{ 
                  opacity: mounted ? 1 : 0, 
                  transform: mounted ? 'translateY(0)' : 'translateY(4px)',
                  transitionDelay: '560ms'
                }}
              >
                <BriefcaseIcon />
                <div className="text-xs">
                  <div className="text-muted-foreground">Position</div>
                  <div className="font-medium text-foreground">{dashboardData.employee.primary_position?.name ?? "—"}</div>
                </div>
              </div>
              <div 
                className="flex gap-2.5 transition-all duration-400 ease-out"
                style={{ 
                  opacity: mounted ? 1 : 0, 
                  transform: mounted ? 'translateY(0)' : 'translateY(4px)',
                  transitionDelay: '600ms'
                }}
              >
                <Building2Icon className="mt-0.5 size-3.5 text-primary shrink-0" />
                <div className="text-xs">
                  <div className="text-muted-foreground">Department</div>
                  <div className="font-medium text-foreground">{dashboardData.employee.primary_department?.name ?? "—"}</div>
                </div>
              </div>
              <div 
                className="flex gap-2.5 transition-all duration-400 ease-out"
                style={{ 
                  opacity: mounted ? 1 : 0, 
                  transform: mounted ? 'translateY(0)' : 'translateY(4px)',
                  transitionDelay: '640ms'
                }}
              >
                <MapPinIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
                <div className="text-xs">
                  <div className="text-muted-foreground">Location</div>
                  <div className="font-medium text-foreground">
                    {[dashboardData.employee.primary_branch?.name, dashboardData.employee.primary_branch?.city]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div 
            className="my-3 border-t border-border transition-all duration-400 ease-out"
            style={{ 
              opacity: mounted ? 1 : 0,
              transitionDelay: '680ms'
            }}
          />

          {/* Reporting line - no card */}
          <div 
            className="transition-all duration-500 ease-out"
            style={{ 
              opacity: mounted ? 1 : 0, 
              transform: mounted ? 'translateY(0)' : 'translateY(6px)',
              transitionDelay: '700ms'
            }}
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Reporting line</div>
            <div className="text-xs">
              <div className="font-medium text-foreground">{managerName}</div>
              {dashboardData.employee.manager?.employee_no && (
                <div className="text-muted-foreground mt-0.5">{dashboardData.employee.manager.employee_no}</div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                {managerUser?.email && (
                  <span className="inline-flex items-center gap-1">
                    <MailIcon className="size-3 text-primary" /> {managerUser.email}
                  </span>
                )}
                {managerUser?.phone && (
                  <span>{managerUser.phone}</span>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Contact your manager for leave approvals and team questions.</p>
          </div>
        </div>

        {/* Right: Live widgets - no cards */}
        <div 
          className="lg:col-span-5 space-y-4 transition-all duration-500 ease-out"
          style={{ 
            opacity: mounted ? 1 : 0, 
            transform: mounted ? 'translateY(0)' : 'translateY(8px)',
            transitionDelay: '520ms'
          }}
        >
          {/* Today’s attendance */}
          <div 
            className="transition-all duration-400 ease-out"
            style={{ 
              opacity: mounted ? 1 : 0, 
              transform: mounted ? 'translateY(0)' : 'translateY(4px)',
              transitionDelay: '560ms'
            }}
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Today’s attendance</div>
            <div className="text-xs text-muted-foreground mb-1.5">Current punch state and times.</div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div>
                <div className="text-xs font-semibold text-foreground">{att.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{att.hint}</div>
              </div>
              <Link href={attendanceHref} className="no-underline hover:no-underline">
                <Button size="sm" variant="secondary" className="h-8">Open attendance</Button>
              </Link>
            </div>
          </div>

          <div 
            className="my-3 border-t border-border transition-all duration-400 ease-out"
            style={{ 
              opacity: mounted ? 1 : 0,
              transitionDelay: '600ms'
            }}
          />

          {/* Leave balances */}
          <div 
            className="transition-all duration-400 ease-out"
            style={{ 
              opacity: mounted ? 1 : 0, 
              transform: mounted ? 'translateY(0)' : 'translateY(4px)',
              transitionDelay: '620ms'
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Leave balances</div>
                <div className="text-xs text-muted-foreground">Available days for your main leave types.</div>
              </div>
              <Link href={leaveBalancesHref} className="text-xs text-primary no-underline hover:no-underline">View all</Link>
            </div>

            {leaveSummaries.length > 0 ? (
              <div className="space-y-1 mt-1">
                {leaveSummaries.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-xs">
                    <span className="font-medium text-foreground">{item.typeName}</span>
                    <span className="tabular-nums text-foreground">
                      {item.available} {item.used != null ? <span className="text-muted-foreground text-[10px]">({item.used} used)</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground mt-1.5">
                No leave balance information available yet.
              </div>
            )}

            <div className="mt-2">
              <Link href={leaveRequestHref} className="no-underline hover:no-underline">
                <Button size="sm" variant="outline" className="h-8 w-full">Request time off</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

// Local icon helper to avoid extra import noise
function BriefcaseIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 size-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.5V8.25A2.25 2.25 0 0018.75 6h-3.379a1.5 1.5 0 01-1.06-.44l-1.122-1.12A1.5 1.5 0 0012.12 4H5.25A2.25 2.25 0 003 6.25v10.5A2.25 2.25 0 005.25 19h13.5" /></svg>
}

export function EmployeeHomeDashboard() {
  const [dashboardData, setDashboardData] = React.useState<EmployeeDashboardData | null>(null)
  const [attendanceToday, setAttendanceToday] = React.useState<AdminRecord | null>(null)
  const [leaveBalances, setLeaveBalances] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isAdmin, setIsAdmin] = React.useState(true)

  React.useEffect(() => {
    const adminIdentity = isAdminIdentity()
    setIsAdmin(adminIdentity)

    if (adminIdentity || typeof window === "undefined") {
      setLoading(false)
      return
    }

    const rawTokens = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
    if (!rawTokens) {
      setError("Your session has expired. Please sign in again.")
      setLoading(false)
      return
    }

    let accessToken = ""
    try {
      const parsed = JSON.parse(rawTokens) as Record<string, unknown>
      accessToken =
        (typeof parsed.accessToken === "string" && parsed.accessToken.trim()) ||
        (typeof parsed.access_token === "string" && parsed.access_token.trim()) ||
        ""
    } catch {
      accessToken = ""
    }

    if (!accessToken) {
      setError("Your session has expired. Please sign in again.")
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        const [dash, attToday, leaves] = await Promise.all([
          getMyDashboard(accessToken),
          getMyAttendanceToday(accessToken).catch(() => null),
          listMyLeaveBalances(accessToken, { limit: 8 }).then((r) => r.rows || []).catch(() => []),
        ])

        if (cancelled) return

        const validDash = isEmployeeDashboardData(dash) ? dash : null
        setDashboardData(validDash)
        setAttendanceToday((attToday as AdminRecord) || null)
        setLeaveBalances(leaves as AdminRecord[])

        if (!validDash) {
          setError("Your dashboard payload is incomplete right now. Please refresh and try again.")
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load your dashboard.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (isAdmin) {
    return null
  }

  if (loading) {
    return (
      <Card className="rounded-2xl border border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-10">
          <LumaSpin />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="rounded-2xl border border-destructive/30 bg-card">
        <CardContent className="py-10">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!dashboardData) {
    return null
  }

  return (
    <EmployeeDashboardView
      dashboardData={dashboardData}
      attendanceToday={attendanceToday}
      leaveBalances={leaveBalances}
    />
  )
}

export type { EmployeeDashboardData }
