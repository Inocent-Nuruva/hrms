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
  Users,
  MapPin,
  User,
  CreditCard,
  Landmark,
  Building2,
  GraduationCap,
  Briefcase,
  Award,
  FileText,
  CheckCircle,
  UserCheck,
} from "lucide-react"
import { LumaSpin } from "@/components/ui/luma-spin"


import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Dialog,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import {
  getMyDashboard,
  getMyAttendanceToday,
  listMyLeaveBalances,
  createEmployeeSectionItem,
  createEmployeeDocument,
  getCurrentEmployee,
  patchEmployeeStatus,
  type AdminRecord,
  type EmployeeProfileSection,
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

const REQUIRED_ONBOARDING_ITEMS: Array<{ key: string; label: string; description: string; icon: React.ReactNode }> = [
  { key: "contacts", label: "Contacts", description: "Add phone, email and primary contact info", icon: <Users className="h-5 w-5" /> },
  { key: "addresses", label: "Addresses", description: "Your home and work addresses", icon: <MapPin className="h-5 w-5" /> },
  { key: "relatives", label: "Relatives", description: "Emergency contacts and family members", icon: <User className="h-5 w-5" /> },
  { key: "identifications", label: "Identifications", description: "ID, passport and official documents", icon: <CreditCard className="h-5 w-5" /> },
  { key: "bank_accounts", label: "Bank Accounts", description: "Salary and payment account details", icon: <Landmark className="h-5 w-5" /> },
  { key: "departments", label: "Departments", description: "Your assigned department information", icon: <Building2 className="h-5 w-5" /> },
  { key: "academic_qualifications", label: "Academic Qualifications", description: "Degrees, diplomas and education records", icon: <GraduationCap className="h-5 w-5" /> },
  { key: "professional_qualifications", label: "Professional Qualifications", description: "Certifications and professional licenses", icon: <Award className="h-5 w-5" /> },
  { key: "experience_details", label: "Experience Details", description: "Previous jobs and work history", icon: <Briefcase className="h-5 w-5" /> },
  { key: "documents", label: "Documents", description: "Supporting files and attachments", icon: <FileText className="h-5 w-5" /> },
]

const SECTION_KEY_TO_API: Record<string, EmployeeProfileSection | "documents" | null> = {
  contacts: "contacts",
  addresses: "addresses",
  relatives: "relatives",
  identifications: "identifications",
  bank_accounts: "bank-accounts",
  departments: null,
  academic_qualifications: "academic-qualifications",
  professional_qualifications: "professional-qualifications",
  experience_details: "experience-details",
  documents: "documents",
}

interface OnboardingFormField {
  name: string
  label: string
  placeholder?: string
  type?: "text" | "email" | "tel" | "date" | "select"
  required?: boolean
  options?: string[]
  defaultValue?: string
}

const ONBOARDING_FORM_SCHEMAS: Record<string, OnboardingFormField[]> = {
  contacts: [
    { name: "phone_number", label: "Phone Number", placeholder: "+1 (555) 123-4567", type: "tel", required: true },
    { name: "email", label: "Email Address", placeholder: "you@example.com", type: "email" },
    { name: "contact_type", label: "Contact Type", type: "select", options: ["personal", "work", "other"], defaultValue: "personal" },
  ],
  addresses: [
    { name: "address_line_1", label: "Address Line 1", placeholder: "123 Main St", required: true },
    { name: "address_line_2", label: "Address Line 2 (optional)", placeholder: "Apt, Suite, etc." },
    { name: "city", label: "City", placeholder: "City", required: true },
    { name: "state", label: "State / Region", placeholder: "State" },
    { name: "country", label: "Country", placeholder: "Country", required: true },
    { name: "postal_code", label: "Postal / ZIP Code", placeholder: "12345" },
  ],
  relatives: [
    { name: "full_name", label: "Full Name", placeholder: "Jane Doe", required: true },
    { name: "relationship", label: "Relationship", placeholder: "Spouse, Parent, etc.", required: true, options: ["Spouse", "Parent", "Child", "Sibling", "Guardian", "Other"] },
    { name: "phone", label: "Phone Number", placeholder: "+1 (555) 987-6543", type: "tel", required: true },
    { name: "email", label: "Email (optional)", placeholder: "relative@example.com", type: "email" },
    { name: "is_emergency_contact", label: "Emergency Contact?", type: "select", options: ["true", "false"], defaultValue: "true" },
  ],
  identifications: [
    { name: "identification_type", label: "ID Type", type: "select", options: ["national_id", "passport", "drivers_license", "other"], defaultValue: "national_id", required: true },
    { name: "identification_number", label: "ID Number", placeholder: "ID-123456789", required: true },
    { name: "issued_country", label: "Issued Country", placeholder: "United States" },
    { name: "expiry_date", label: "Expiry Date (optional)", type: "date" },
  ],
  bank_accounts: [
    { name: "bank_name", label: "Bank Name", placeholder: "First National Bank", required: true },
    { name: "account_name", label: "Account Holder Name", placeholder: "Your Full Name", required: true },
    { name: "account_number", label: "Account Number", placeholder: "1234567890", required: true },
    { name: "branch_name", label: "Branch Name (optional)", placeholder: "Main Branch" },
    { name: "is_primary", label: "Primary Salary Account?", type: "select", options: ["true", "false"], defaultValue: "true" },
  ],
  academic_qualifications: [
    { name: "institution_name", label: "Institution / School", placeholder: "University of Example", required: true },
    { name: "degree_or_certificate", label: "Degree / Certificate", placeholder: "Bachelor of Science", required: true },
    { name: "field_of_study", label: "Field of Study", placeholder: "Computer Science" },
    { name: "education_level", label: "Level", type: "select", options: ["Certificate", "Diploma", "Bachelor's Degree", "Master's Degree", "Other"], defaultValue: "Bachelor's Degree" },
    { name: "start_date", label: "Start Date", type: "date" },
    { name: "end_date", label: "End Date / Graduation", type: "date" },
  ],
  professional_qualifications: [
    { name: "programme_name", label: "Program / Certification Name", placeholder: "AWS Solutions Architect", required: true },
    { name: "issuing_organization", label: "Issuing Organization", placeholder: "Amazon Web Services", required: true },
    { name: "issue_date", label: "Issue Date", type: "date" },
    { name: "expiry_date", label: "Expiry Date (if any)", type: "date" },
  ],
  experience_details: [
    { name: "company_name", label: "Company Name", placeholder: "Acme Corp", required: true },
    { name: "job_title", label: "Job Title / Role", placeholder: "Software Engineer", required: true },
    { name: "responsibilities_description", label: "Key Responsibilities", placeholder: "Built and maintained..." },
    { name: "start_date", label: "Start Date", type: "date", required: true },
    { name: "end_date", label: "End Date (leave blank if current)", type: "date" },
  ],
  documents: [
    { name: "title", label: "Document Title", placeholder: "Passport Copy", required: true },
    { name: "type", label: "Type", type: "select", options: ["certificate", "cv", "offer_letter", "contract", "id", "other"], defaultValue: "other" },
    { name: "notes", label: "Notes (optional)", placeholder: "Scanned copy" },
  ],
  departments: [], // special cased - not user editable via section
}

function getApiSectionForKey(key: string): EmployeeProfileSection | "documents" | null {
  return SECTION_KEY_TO_API[key] ?? null
}

function getFormSchema(key: string): OnboardingFormField[] {
  return ONBOARDING_FORM_SCHEMAS[key] || []
}

function getInitialFormValues(key: string): Record<string, string> {
  const schema = getFormSchema(key)
  const init: Record<string, string> = {}
  schema.forEach((f) => {
    init[f.name] = f.defaultValue ?? ""
  })
  return init
}

function buildPayload(key: string, values: Record<string, string>): AdminRecord {
  const schema = getFormSchema(key)
  const payload: AdminRecord = {}
  schema.forEach((f) => {
    let v = (values[f.name] ?? "").trim()
    if (f.type === "select" && (f.options?.includes("true") || f.options?.includes("false"))) {
      payload[f.name] = v === "true"
    } else if (v) {
      payload[f.name] = v
    }
  })
  // sensible defaults
  if (key === "contacts" && !payload.contact_type) payload.contact_type = "personal"
  if (key === "addresses" && !payload.address_type) payload.address_type = "home"
  if (key === "identifications" && !payload.identification_type) payload.identification_type = "national_id"
  if (key === "bank_accounts" && payload.is_primary === undefined) payload.is_primary = true
  return payload
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
  const [showOnboardingDialog, setShowOnboardingDialog] = React.useState(false)
  const [completedOnboardingItems, setCompletedOnboardingItems] = React.useState<string[]>([])
  const [accessToken, setAccessToken] = React.useState<string>("")
  const [fillingItemKey, setFillingItemKey] = React.useState<string | null>(null)
  const [formValues, setFormValues] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    const adminIdentity = isAdminIdentity()
    setIsAdmin(adminIdentity)

    if (adminIdentity || typeof window === "undefined") {
      setLoading(false)
      return
    }

    // Show onboarding pending dialog on entry for onboarding users
    if (dashboardData?.employee?.employment_status === "onboarding") {
      const dismissedKey = `onboarding_dialog_dismissed_${dashboardData.user?.id || "current"}`
      if (!sessionStorage.getItem(dismissedKey)) {
        setShowOnboardingDialog(true)
      }
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

    setAccessToken(accessToken)

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
        } else if (validDash.employee.employment_status === "onboarding") {
          const dismissedKey = `onboarding_dialog_dismissed_${validDash.user?.id || "current"}`
          if (!sessionStorage.getItem(dismissedKey)) {
            setShowOnboardingDialog(true)
          }
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

  const pendingItems = REQUIRED_ONBOARDING_ITEMS.filter((item) => {
    const emp = dashboardData.employee as any
    const arr = emp?.[item.key]
    const hasData = Array.isArray(arr) && arr.length > 0
    return !hasData && !completedOnboardingItems.includes(item.key)
  })

  const currentFillingItem = fillingItemKey
    ? REQUIRED_ONBOARDING_ITEMS.find((i) => i.key === fillingItemKey) || null
    : null
  const currentFormSchema = fillingItemKey ? getFormSchema(fillingItemKey) : []

  const handleCloseOnboardingDialog = () => {
    const dismissedKey = `onboarding_dialog_dismissed_${dashboardData.user?.id || "current"}`
    sessionStorage.setItem(dismissedKey, "true")
    setShowOnboardingDialog(false)
    // reset any in-progress form state
    setFillingItemKey(null)
    setFormValues({})
    setFormError(null)
  }

  const startFilling = (key: string) => {
    const schema = getFormSchema(key)
    const init = getInitialFormValues(key)

    // Prefill known good values from loaded profile for nicer UX
    if (dashboardData) {
      const u = dashboardData.user
      const e = dashboardData.employee as any
      if (key === "contacts") {
        if (!init.email && u?.email) init.email = u.email
        if (!init.phone_number && u?.phone) init.phone_number = u.phone || ""
      }
      if ((key === "contacts" || key === "relatives") && u) {
        // nothing extra
      }
      if (key === "academic_qualifications" || key === "experience_details") {
        // nothing pre-known
      }
    }

    setFillingItemKey(key)
    setFormValues(init)
    setFormError(null)
  }

  const cancelFilling = () => {
    setFillingItemKey(null)
    setFormValues({})
    setFormError(null)
  }

  const updateFormValue = (name: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveFilling = async () => {
    if (!fillingItemKey || !dashboardData || !accessToken) return

    const empId = (dashboardData.employee as any)?.id
    if (empId == null) {
      setFormError("Unable to identify your employee profile. Please refresh and try again.")
      return
    }

    const apiSection = getApiSectionForKey(fillingItemKey)
    const payload = buildPayload(fillingItemKey, formValues)

    // For departments or empty schema we just optimistically complete
    const isNoApi = !apiSection || getFormSchema(fillingItemKey).length === 0

    setIsSaving(true)
    setFormError(null)

    try {
      if (!isNoApi) {
        if (apiSection === "documents") {
          await createEmployeeDocument(accessToken, empId, payload)
        } else {
          await createEmployeeSectionItem(accessToken, empId, apiSection as EmployeeProfileSection, payload)
        }
      }

      // Mark locally complete + optimistically inject data presence for UI
      setCompletedOnboardingItems((prev) => (prev.includes(fillingItemKey) ? prev : [...prev, fillingItemKey]))

      setDashboardData((prev) => {
        if (!prev) return prev
        const emp = prev.employee as any
        return {
          ...prev,
          employee: {
            ...emp,
            [fillingItemKey]: emp?.[fillingItemKey]?.length ? emp[fillingItemKey] : [{ ...payload, _onboard: true }],
          },
        }
      })

      const remainingAfter = pendingItems.filter((p) => p.key !== fillingItemKey).length

      // Clear form UI
      setFillingItemKey(null)
      setFormValues({})
      setFormError(null)

      // Background refresh to pull authoritative arrays from server (non-blocking)
      if (remainingAfter > 0) {
        getMyDashboard(accessToken).then((fresh) => {
          if (isEmployeeDashboardData(fresh)) {
            setDashboardData(fresh)
          }
        }).catch(() => {})
      }

      // If this was the last pending, optionally activate + close
      if (remainingAfter <= 0) {
        try {
          await patchEmployeeStatus(accessToken, empId, { employment_status: "active" as any })
        } catch {
          // non-fatal; backend may auto-handle or admin may do later
        }
        handleCloseOnboardingDialog()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save this section. Please check the details and try again."
      setFormError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <EmployeeDashboardView
        dashboardData={dashboardData}
        attendanceToday={attendanceToday}
        leaveBalances={leaveBalances}
      />

      <Dialog open={showOnboardingDialog} onOpenChange={(open) => { if (!open) handleCloseOnboardingDialog() }}>
        <DialogPopup
          from="center"
          showCloseButton={false}
          className="max-w-[96vw] sm:max-w-4xl lg:max-w-5xl w-full p-0 overflow-hidden rounded-2xl border-0 shadow-2xl bg-transparent max-h-[88vh] flex flex-col"
        >
          <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 rounded-2xl flex flex-col h-full">
            <DialogHeader className="p-3 sm:p-4 pb-1.5 shrink-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2.5">
                <div className="rounded-xl bg-blue-600/90 p-1.5 sm:p-2 text-white shrink-0 backdrop-blur-sm border border-blue-400/30">
                  <UserCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Complete Your Onboarding
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Provide the required details below.
                  </DialogDescription>
                </div>
              </div>

              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Progress</span>
                  <span className="text-muted-foreground">{REQUIRED_ONBOARDING_ITEMS.length - pendingItems.length} / {REQUIRED_ONBOARDING_ITEMS.length}</span>
                </div>
                <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div 
                    className="h-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all" 
                    style={{ width: `${((REQUIRED_ONBOARDING_ITEMS.length - pendingItems.length) / REQUIRED_ONBOARDING_ITEMS.length) * 100}%` }} 
                  />
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-4 py-1.5 sm:py-2">
              {pendingItems.length === 0 && !fillingItemKey ? (
                <div className="text-center py-4">
                  <CheckCircle className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
                  <p className="text-sm font-medium">All done! Your profile is complete.</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Account will be fully activated shortly.</p>
                </div>
              ) : fillingItemKey && currentFillingItem ? (
                // Beautiful inline fill form
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-2 sm:p-3 backdrop-blur">
                  <div className="mb-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={cancelFilling}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      ← Back
                    </button>
                    <div className="flex items-center gap-1.5">
                      <div className="rounded-md bg-blue-100 dark:bg-blue-950 p-1 text-blue-600 dark:text-blue-400">
                        {currentFillingItem.icon}
                      </div>
                      <div>
                        <div className="font-semibold text-sm tracking-tight text-slate-900 dark:text-white">{currentFillingItem.label}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-none">{currentFillingItem.description}</div>
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                      {formError}
                    </div>
                  )}

                  {currentFormSchema.length === 0 ? (
                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 p-2 text-[10px] text-slate-600 dark:text-slate-300">
                      Managed by HR. Click <span className="font-medium">Mark complete</span>.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-2">
                      {currentFormSchema.map((field) => {
                        const val = formValues[field.name] ?? ""
                        const isBoolSelect = field.type === "select" && field.options?.some((o) => o === "true" || o === "false")
                        return (
                          <div key={field.name} className={field.name === "responsibilities_description" || field.name.includes("notes") ? "sm:col-span-2" : ""}>
                            <Label className="text-[10px] font-semibold uppercase tracking-[0.5px] text-slate-600 dark:text-slate-400">
                              {field.label}{field.required ? " *" : ""}
                            </Label>
                            {field.type === "select" && field.options ? (
                              <select
                                value={val || (field.defaultValue ?? "")}
                                onChange={(e) => updateFormValue(field.name, e.target.value)}
                                className="mt-0.5 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              >
                                {field.options.map((opt) => (
                                  <option key={opt} value={opt}>{opt === "true" ? "Yes" : opt === "false" ? "No" : opt}</option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                type={field.type === "date" ? "date" : field.type || "text"}
                                value={val}
                                placeholder={field.placeholder}
                                onChange={(e) => updateFormValue(field.name, e.target.value)}
                                className="mt-0.5 h-8 rounded-md border-slate-300 bg-white text-xs focus-visible:ring-blue-400 dark:border-slate-700 dark:bg-slate-950"
                                required={!!field.required}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
                    <Button
                      onClick={handleSaveFilling}
                      disabled={isSaving || (currentFormSchema.length > 0 && currentFormSchema.some(f => f.required && !(formValues[f.name] || "").trim()))}
                      className="flex-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/70 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm h-8 rounded-lg transition-all text-xs"
                    >
                      {isSaving ? "Saving..." : "Save & mark complete"}
                    </Button>
                    <Button variant="outline" onClick={cancelFilling} disabled={isSaving} className="h-8 rounded-lg border-slate-300 dark:border-slate-700 sm:w-auto text-xs">
                      Cancel
                    </Button>
                  </div>

                  <p className="mt-1.5 text-[9px] text-center text-slate-500 dark:text-slate-500">
                    Securely stored for access &amp; payroll setup.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                  {REQUIRED_ONBOARDING_ITEMS.map((item) => {
                    const isPending = pendingItems.some(p => p.key === item.key)
                    if (!isPending) return null
                    return (
                      <div 
                        key={item.key}
                        className="group border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur flex flex-col hover:border-blue-300 dark:hover:border-blue-800 transition-all hover:shadow-sm"
                      >
                        <div className="flex items-start gap-1.5">
                          <div className="rounded-md bg-blue-100 dark:bg-blue-950 p-1 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition shrink-0">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs text-slate-900 dark:text-white tracking-tight leading-tight">{item.label}</div>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0 leading-tight line-clamp-2">{item.description}</p>
                          </div>
                        </div>

                        <div className="mt-auto pt-1">
                          <Button 
                            size="sm" 
                            className="w-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/70 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm transition-all text-[10px] h-6 px-1.5" 
                            onClick={() => startFilling(item.key)}
                          >
                            Fill out now
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-1 sm:py-1.5 bg-white/60 dark:bg-slate-950/60 flex flex-col-reverse sm:flex-row sm:justify-end gap-1 shrink-0">
              <Button variant="ghost" onClick={handleCloseOnboardingDialog} className="text-[11px] h-6 px-2">
                {fillingItemKey ? "Remind later" : "Remind later"}
              </Button>
              <Button 
                onClick={handleCloseOnboardingDialog} 
                className="text-[11px] h-6 px-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/70 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
              >
                {fillingItemKey ? "Close" : "Continue to dashboard"}
              </Button>
            </DialogFooter>
          </div>
        </DialogPopup>
      </Dialog>
    </>
  )
}

export type { EmployeeDashboardData }
