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
  patchEmployeeStatus,
  type AdminRecord,
  type EmployeeProfileSection,
} from "@/lib/admin-api"
import { hasDashboardAdminIdentity } from "@/lib/dashboard-identity"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { asRecord, readString } from "@/utils/token-utils"

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
  [key: string]: unknown
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

type PublicCountryStateRecord = {
  name: string
  iso2?: string
  iso3?: string
  states: Array<{
    name: string
    state_code?: string
  }>
}

type PublicCountryStateResponse = {
  error: boolean
  msg: string
  data?: PublicCountryStateRecord[]
}

type PublicStateCitiesResponse = {
  error: boolean
  msg: string
  data?: string[]
}

const PUBLIC_COUNTRY_STATES_URL = "/api/public-locations?type=country-states"
const PUBLIC_STATE_CITIES_URL = "/api/public-locations?type=cities"

const ONBOARDING_FORM_SCHEMAS: Record<string, OnboardingFormField[]> = {
  contacts: [
    { name: "phone_number", label: "Phone Number", placeholder: "+1 (555) 123-4567", type: "tel", required: true },
    { name: "email", label: "Email Address", placeholder: "you@example.com", type: "email" },
    { name: "contact_type", label: "Contact Type", type: "select", options: ["personal", "work", "other"], defaultValue: "personal" },
  ],
  addresses: [
    { name: "address_type", label: "Address Type", type: "select", options: ["home", "work", "other"], defaultValue: "home" },
    { name: "is_primary", label: "Primary Address?", type: "select", options: ["true", "false"], defaultValue: "false" },
    { name: "address_line_1", label: "Address Line 1", placeholder: "123 Main St", required: true },
    { name: "address_line_2", label: "Address Line 2 (optional)", placeholder: "Apt, Suite, etc." },
    { name: "country", label: "Country", placeholder: "Country", required: true },
    { name: "state", label: "State / Region", placeholder: "State" },
    { name: "city", label: "City", placeholder: "City", required: true },
    { name: "postal_code", label: "Postal / ZIP Code", placeholder: "12345" },
  ],
  relatives: [
    { name: "full_name", label: "Full Name", placeholder: "Jane Doe", required: true },
    { name: "relationship", label: "Relationship", placeholder: "Spouse, Parent, etc.", type: "select", required: true, options: ["Spouse", "Parent", "Child", "Sibling", "Guardian", "Other"], defaultValue: "Other" },
    { name: "phone", label: "Phone Number", placeholder: "+1 (555) 987-6543", type: "tel", required: true },
    { name: "email", label: "Email (optional)", placeholder: "relative@example.com", type: "email" },
    { name: "address", label: "Address (optional)", placeholder: "123 Main St" },
    { name: "occupation", label: "Occupation (optional)", placeholder: "Teacher" },
    { name: "is_emergency_contact", label: "Emergency Contact?", type: "select", options: ["true", "false"], defaultValue: "true" },
    { name: "is_primary", label: "Primary Relative?", type: "select", options: ["true", "false"], defaultValue: "false" },
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
    const v = (values[f.name] ?? "").trim()
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

function isAdminIdentity() {
  if (typeof window === "undefined") {
    return true
  }
  return hasDashboardAdminIdentity()
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
    const leaveTypeRecord = asRecord(b.leave_type)
    const policyRecord = asRecord(b.policy)
    const typeName =
      readString(b, ["leave_type_name", "name", "type_name", "policy_name"]) ||
      readString(leaveTypeRecord, ["name", "leave_type_name", "type_name", "code"]) ||
      readString(policyRecord, ["name", "policy_name"]) ||
      "Leave"
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
      className="group flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 p-3 transition-all duration-400 ease-out hover:bg-white/20 hover:border-white/40 hover:shadow-sm no-underline hover:no-underline text-white"
      style={{ 
        opacity: mounted ? 1 : 0, 
        transform: mounted ? 'translateY(0)' : 'translateY(6px)',
        transitionDelay: `${delay}ms`
      }}
    >
      <div className="shrink-0 text-white/90">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-tight text-white no-underline">{title}</h3>
      </div>
      <div className="transition-transform group-hover:-translate-y-px">
        <span className="text-xs font-medium text-white/80">Open →</span>
      </div>
    </Link>
  )
}

// Reusable doodle components (same as profile summary)
function DoodleSprites() {
  return (
    <svg width="0" height="0" className="hidden" aria-hidden="true">
      <symbol id="doodle-circles" viewBox="0 0 316 316">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="5" opacity="0.3">
          <path d="M 323.074 256.963 C 312.956 263.991 295.834 280.024 295.479 292.107 C 294.971 309.41 311.806 311.371 322.384 317.098" />
          <path d="M 322.384 225.723 C 303.276 230.431 291.393 236.843 273.403 256.963 C 252.542 280.29 261.674 308.503 261.674 315.536" />
          <path d="M 320.316 193.268 C 285.716 194.491 258.866 221.733 245.117 244.813 C 225.414 277.888 238.218 316.923 236.839 320.568" />
        </g>
      </symbol>
      <symbol id="doodle-curves" viewBox="0 0 316 316">
        <g fill="none" stroke="currentColor" strokeWidth="4" opacity="0.25">
          <path d="M 50 50 Q 150 20 250 80 Q 100 150 200 250" />
          <path d="M 30 100 Q 120 70 220 140 Q 80 200 180 280" />
        </g>
      </symbol>
      <symbol id="doodle-grass" viewBox="0 0 316 316">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" opacity="0.2">
          <path d="M 20 300 Q 40 200 30 100" />
          <path d="M 60 300 Q 80 180 70 80" />
          <path d="M 100 300 Q 120 220 110 120" />
          <path d="M 150 300 Q 170 190 160 90" />
          <path d="M 200 300 Q 220 210 210 110" />
          <path d="M 250 300 Q 270 200 260 100" />
          <path d="M 290 300 Q 310 220 300 120" />
        </g>
      </symbol>
    </svg>
  )
}

function Doodle({ name = "doodle-circles" }: { name?: string }) {
  const doodleType = name.replace('doodle-', '');
  return (
    <svg 
      className={`absolute inset-0 w-full h-full pointer-events-none doodle doodle-${doodleType}`} 
      aria-hidden="true"
    >
      <use href={`#${name}`} />
    </svg>
  );
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
  const palePrimary = 'color-mix(in srgb, var(--primary) 18%, white)';

  return (
    <div className="space-y-4">
      <DoodleSprites />

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

      {/* Quick actions - useful and clear - styled with same design */}
      <div 
        className="relative overflow-hidden rounded-2xl p-5 md:p-6 text-white transition-all duration-500 ease-out"
        style={{ 
          backgroundColor: 'var(--primary)',
          opacity: mounted ? 1 : 0, 
          transform: mounted ? 'translateY(0)' : 'translateY(8px)',
          transitionDelay: '280ms'
        }}
      >
        <Doodle name="doodle-circles" />
        <div className="relative z-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-12 ring-2 ring-white/30">
                {dashboardData.employee.profile_photo_url ? (
                  <AvatarImage src={dashboardData.employee.profile_photo_url} alt={fullName} />
                ) : null}
                <AvatarFallback className="text-lg bg-white/20 text-white">{initialsFor(fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-lg font-semibold tracking-tight text-white">{preferredName}</div>
                <div className="text-xs text-white/70">{dashboardData.employee.employee_no}</div>
                <div className="mt-0.5 text-xs text-white/70">
                  {dashboardData.employee.primary_position?.name ?? "Position"} · {dashboardData.employee.primary_department?.name ?? "Department"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white">
              Hired <span className="font-medium text-white">{formatDate(dashboardData.employee.hire_date)}</span>
              <span className="text-white/40">·</span>
              Tenure <span className="font-medium text-white">{tenure}</span>
              <Link href={profileHref} className="no-underline hover:no-underline ml-1">
                <Button size="sm" variant="outline" className="h-8 px-3 border-white/30 bg-white/10 text-white hover:bg-white/25 hover:text-white focus-visible:text-white">View full profile</Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <QuickActionCard
              href={attendanceHref}
              title="Attendance"
              icon={<ClockIcon className="size-4" />}
              delay={320}
              mounted={mounted}
            />
            <QuickActionCard
              href={leaveRequestHref}
              title="Request leave"
              icon={<CalendarClockIcon className="size-4" />}
              delay={380}
              mounted={mounted}
            />
            <QuickActionCard
              href={leaveBalancesHref}
              title="Leave balances"
              icon={<CalendarIcon className="size-4" />}
              delay={440}
              mounted={mounted}
            />
            <QuickActionCard
              href={holidaysHref}
              title="Office holidays"
              icon={<CalendarIcon className="size-4" />}
              delay={500}
              mounted={mounted}
            />
          </div>
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
            className="relative overflow-hidden rounded-2xl p-4 transition-all duration-500 ease-out"
            style={{ 
              backgroundColor: palePrimary, 
              color: 'var(--primary)',
              opacity: mounted ? 1 : 0, 
              transform: mounted ? 'translateY(0)' : 'translateY(6px)',
              transitionDelay: '480ms'
            }}
          >
            <Doodle name="doodle-curves" />
            <div className="relative z-10">
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
                  <UserIcon className="mt-0.5 size-3.5 shrink-0" />
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
                  <Building2Icon className="mt-0.5 size-3.5 shrink-0" />
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
                  <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
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
          </div>

          <div 
            className="my-3 border-t border-border transition-all duration-400 ease-out"
            style={{ 
              opacity: mounted ? 1 : 0,
              transitionDelay: '680ms'
            }}
          />

          {/* Reporting line */}
          <div 
            className="relative overflow-hidden rounded-2xl p-4 transition-all duration-500 ease-out"
            style={{ 
              backgroundColor: palePrimary, 
              color: 'var(--primary)',
              opacity: mounted ? 1 : 0, 
              transform: mounted ? 'translateY(0)' : 'translateY(6px)',
              transitionDelay: '700ms'
            }}
          >
            <Doodle name="doodle-grass" />
            <div className="relative z-10">
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Reporting line</div>
              <div className="text-xs">
                <div className="font-medium text-foreground">{managerName}</div>
                {dashboardData.employee.manager?.employee_no && (
                  <div className="text-muted-foreground mt-0.5">{dashboardData.employee.manager.employee_no}</div>
                )}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                  {managerUser?.email && (
                    <span className="inline-flex items-center gap-1">
                      <MailIcon className="size-3" /> {managerUser.email}
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
            <div className="relative overflow-hidden rounded-lg border border-white/20 p-3" style={{ backgroundColor: palePrimary, color: 'var(--primary)' }}>
              <Doodle name="doodle-circles" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">{att.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{att.hint}</div>
                </div>
                <Link href={attendanceHref} className="no-underline hover:no-underline">
                  <Button size="sm" variant="outline" className="h-8 border-white/30 text-foreground hover:bg-white/10">Open attendance</Button>
                </Link>
              </div>
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
            <div className="relative overflow-hidden rounded-2xl p-4" style={{ backgroundColor: palePrimary, color: 'var(--primary)' }}>
              <Doodle name="doodle-grass" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Leave balances</div>
                    <div className="text-xs text-muted-foreground">Available days for your main leave types.</div>
                  </div>
                  <Link href={leaveBalancesHref} className="text-xs no-underline hover:no-underline">View all</Link>
                </div>

                {leaveSummaries.length > 0 ? (
                  <div className="space-y-1 mt-1">
                    {leaveSummaries.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg border border-white/20 px-2.5 py-1.5 text-xs">
                        <span className="font-medium text-foreground">{item.typeName}</span>
                        <span className="tabular-nums text-foreground">
                          {item.available} {item.used != null ? <span className="text-muted-foreground text-[10px]">({item.used} used)</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/20 bg-white/10 p-2.5 text-xs text-muted-foreground mt-1.5">
                    No leave balance information available yet.
                  </div>
                )}

                <div className="mt-2">
                  <Link href={leaveRequestHref} className="no-underline hover:no-underline">
                    <Button size="sm" variant="outline" className="h-8 w-full border-white/30 hover:bg-white/10">Request time off</Button>
                  </Link>
                </div>
              </div>
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
  const [publicCountryStates, setPublicCountryStates] = React.useState<PublicCountryStateRecord[]>([])
  const [publicLocationLoading, setPublicLocationLoading] = React.useState(false)
  const [publicLocationError, setPublicLocationError] = React.useState<string | null>(null)
  const [publicCityOptions, setPublicCityOptions] = React.useState<string[]>([])
  const [publicCitiesLoading, setPublicCitiesLoading] = React.useState(false)

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

  React.useEffect(() => {
    const shouldPreload = (fillingItemKey === "addresses" || showOnboardingDialog) && publicCountryStates.length === 0 && !publicLocationLoading
    if (!shouldPreload) {
      return
    }

    let cancelled = false
    setPublicLocationLoading(true)
    setPublicLocationError(null)

    const loadPublicLocations = async () => {
      try {
        const response = await fetch(PUBLIC_COUNTRY_STATES_URL, { cache: "no-store" })
        if (!response.ok) {
          throw new Error(`Failed to load address dataset (${response.status})`)
        }

        const payload = (await response.json()) as PublicCountryStateResponse
        if (!Array.isArray(payload?.data)) {
          throw new Error(payload?.msg || "Failed to load address dataset.")
        }

        if (!cancelled) {
          setPublicCountryStates(payload.data)
        }
      } catch (errorObject) {
        if (!cancelled) {
          setPublicLocationError(
            errorObject instanceof Error ? errorObject.message : "Failed to load address dataset."
          )
        }
      } finally {
        if (!cancelled) {
          setPublicLocationLoading(false)
        }
      }
    }

    void loadPublicLocations()

    return () => {
      cancelled = true
    }
  }, [fillingItemKey, showOnboardingDialog])

  const selectedAddressCountry = React.useMemo(() => {
    if (fillingItemKey !== "addresses") {
      return null
    }

    const normalizedCountry = (formValues.country ?? "").trim().toLowerCase()
    if (!normalizedCountry) {
      return null
    }

    return publicCountryStates.find((entry) => entry.name.trim().toLowerCase() === normalizedCountry) ?? null
  }, [fillingItemKey, formValues.country, publicCountryStates])

  const addressStateOptions = React.useMemo(() => selectedAddressCountry?.states ?? [], [selectedAddressCountry])

  React.useEffect(() => {
    if (fillingItemKey !== "addresses") {
      setPublicCityOptions([])
      setPublicCitiesLoading(false)
      return
    }

    const country = (formValues.country ?? "").trim()
    const state = (formValues.state ?? "").trim()
    if (!country || !state) {
      setPublicCityOptions([])
      setPublicCitiesLoading(false)
      return
    }

    let cancelled = false
    setPublicCitiesLoading(true)

    const params = new URLSearchParams({ country, state })
    const sep = PUBLIC_STATE_CITIES_URL.includes("?") ? "&" : "?"
    const url = `${PUBLIC_STATE_CITIES_URL}${sep}${params.toString()}`

    const loadCities = async () => {
      try {
        const response = await fetch(url, {
          cache: "no-store",
        })
        if (!response.ok) {
          throw new Error(`Failed to load cities (${response.status})`)
        }

        const payload = (await response.json()) as PublicStateCitiesResponse
        if (!Array.isArray(payload.data)) {
          if (!cancelled) {
            setPublicCityOptions([])
          }
          return
        }

        if (!cancelled) {
          setPublicCityOptions(payload.data)
        }
      } catch {
        if (!cancelled) {
          setPublicCityOptions([])
        }
      } finally {
        if (!cancelled) {
          setPublicCitiesLoading(false)
        }
      }
    }

    void loadCities()

    return () => {
      cancelled = true
    }
  }, [fillingItemKey, formValues.country, formValues.state])

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
    const emp = dashboardData.employee as Record<string, unknown>
    const arr = emp?.[item.key]
    const hasData = Array.isArray(arr) && arr.length > 0
    return !hasData && !completedOnboardingItems.includes(item.key)
  })

  const currentFillingItem = fillingItemKey
    ? REQUIRED_ONBOARDING_ITEMS.find((i) => i.key === fillingItemKey) || null
    : null
  const currentFormSchema = fillingItemKey ? getFormSchema(fillingItemKey) : []

  const missingRequiredFields = currentFormSchema.length > 0
    ? currentFormSchema
        .filter((f) => f.required)
        .filter((f) => {
          const v = formValues[f.name] ?? ""
          return !String(v).trim()
        })
        .map((f) => f.label)
    : []

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
    const init = getInitialFormValues(key)

    // Prefill known good values from loaded profile for nicer UX
    if (dashboardData) {
      const u = dashboardData.user
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
    setFormValues((prev) => {
      const nextValues = { ...prev, [name]: value }

      if (fillingItemKey === "addresses") {
        if (name === "country" && prev.country !== value) {
          nextValues.state = ""
          nextValues.city = ""
        }
        if (name === "state" && prev.state !== value) {
          nextValues.city = ""
        }
      }

      return nextValues
    })
  }

  const handleSaveFilling = async () => {
    if (!fillingItemKey || !dashboardData || !accessToken) return

    const empId = dashboardData.employee.id
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
        const emp = prev.employee
        const employeeRecord = emp as Record<string, unknown>
        const existingSectionItems = emp[fillingItemKey]
        return {
          ...prev,
          employee: {
            ...employeeRecord,
            [fillingItemKey]:
              Array.isArray(existingSectionItems) && existingSectionItems.length > 0
                ? existingSectionItems
                : [{ ...payload, _onboard: true }],
          } as DashboardEmployee,
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
          await patchEmployeeStatus(accessToken, empId, { employment_status: "active" })
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

  const isStillOnboarding = !isAdmin && dashboardData?.employee?.employment_status === "onboarding"

  return (
    <>
      {isStillOnboarding && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-900 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            Your employee profile is still in onboarding.
          </div>
          <Button
            size="sm"
            onClick={() => {
              // allow re-opening the modal
              const dismissedKey = `onboarding_dialog_dismissed_${dashboardData.user?.id || "current"}`
              try { sessionStorage.removeItem(dismissedKey) } catch {}
              setShowOnboardingDialog(true)
            }}
          >
            Finish onboarding
          </Button>
        </div>
      )}

      <EmployeeDashboardView
        dashboardData={dashboardData}
        attendanceToday={attendanceToday}
        leaveBalances={leaveBalances}
      />

      <Dialog open={showOnboardingDialog} onOpenChange={(open) => { if (!open) handleCloseOnboardingDialog() }}>
        <DialogPopup
          from="center"
          showCloseButton={false}
          className="max-w-[96vw] sm:max-w-3xl lg:max-w-4xl w-full p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-950 max-h-[90vh] flex flex-col"
        >
            <DialogHeader className="px-5 sm:px-6 pt-5 pb-3 shrink-0 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Complete your onboarding
                  </DialogTitle>
                  <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    Fill the missing sections to activate your account.
                  </DialogDescription>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Progress</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">{REQUIRED_ONBOARDING_ITEMS.length - pendingItems.length} / {REQUIRED_ONBOARDING_ITEMS.length}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div 
                    className="h-2 rounded-full bg-blue-600 transition-all duration-300" 
                    style={{ width: `${((REQUIRED_ONBOARDING_ITEMS.length - pendingItems.length) / REQUIRED_ONBOARDING_ITEMS.length) * 100}%` }} 
                  />
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto min-h-0 px-5 sm:px-6 py-4">
              {pendingItems.length === 0 && !fillingItemKey ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-10 w-10 mx-auto text-emerald-600 mb-3" />
                  <p className="text-base font-semibold">All done! Your profile is complete.</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Your account will be activated shortly.</p>
                </div>
              ) : fillingItemKey && currentFillingItem ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 pl-1">
                      <div className="rounded-lg bg-blue-100 dark:bg-blue-950 p-1.5 text-blue-600 dark:text-blue-400">
                        {currentFillingItem.icon}
                      </div>
                      <div>
                        <div className="font-semibold text-base text-slate-900 dark:text-white">{currentFillingItem.label}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{currentFillingItem.description}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={cancelFilling}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      ← Back to checklist
                    </button>
                  </div>

                  {formError && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                      {formError}
                    </div>
                  )}

                  {currentFormSchema.length === 0 ? (
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-600 dark:text-slate-300">
                      This section is managed by HR. Click <span className="font-medium">Mark complete</span> to finish.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentFormSchema.map((field) => {
                        const val = formValues[field.name] ?? ""
                        const isAddressLookupField =
                          fillingItemKey === "addresses" &&
                          (field.name === "country" || field.name === "state" || field.name === "city")
                        return (
                          <div key={field.name} className={field.name === "responsibilities_description" || field.name.includes("notes") ? "sm:col-span-2" : ""}>
                            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                              {field.label}{field.required ? " *" : ""}
                            </Label>
                            {isAddressLookupField ? (
                              <>
                                <input
                                  list={
                                    field.name === "country"
                                      ? "onboarding-address-country-options"
                                      : field.name === "state"
                                        ? "onboarding-address-state-options"
                                        : "onboarding-address-city-options"
                                  }
                                  type="text"
                                  value={val}
                                  placeholder={
                                    field.name === "country"
                                      ? publicLocationLoading
                                        ? "Loading countries..."
                                        : field.placeholder
                                      : field.name === "state"
                                        ? !formValues.country
                                          ? "Select country first"
                                          : addressStateOptions.length > 0
                                            ? "Search state / region"
                                            : field.placeholder
                                        : !formValues.state
                                          ? "Select state first"
                                          : publicCitiesLoading
                                            ? "Loading cities..."
                                            : publicCityOptions.length > 0
                                              ? "Search city"
                                              : field.placeholder
                                  }
                                  onChange={(e) => updateFormValue(field.name, e.target.value)}
                                  className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                  required={!!field.required}
                                />
                                {/* Visible clickable suggestions for better discoverability when picking country -> state -> city */}
                                {field.name === "state" && addressStateOptions.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {addressStateOptions.slice(0, 6).map((s, idx) => (
                                      <button
                                        key={s.state_code ?? idx}
                                        type="button"
                                        onClick={() => updateFormValue("state", s.name)}
                                        className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-blue-950"
                                      >
                                        {s.name}
                                      </button>
                                    ))}
                                    {addressStateOptions.length > 6 && (
                                      <span className="text-[10px] text-slate-400 self-center">+{addressStateOptions.length - 6} more (type to filter)</span>
                                    )}
                                  </div>
                                )}
                                {field.name === "city" && publicCityOptions.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {publicCityOptions.slice(0, 8).map((c, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => updateFormValue("city", c)}
                                        className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-blue-950"
                                      >
                                        {c}
                                      </button>
                                    ))}
                                    {publicCityOptions.length > 8 && (
                                      <span className="text-[10px] text-slate-400 self-center">+{publicCityOptions.length - 8} more (type to filter)</span>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : field.type === "select" && field.options ? (
                              <select
                                value={val || (field.defaultValue ?? "")}
                                onChange={(e) => updateFormValue(field.name, e.target.value)}
                                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                                className="mt-1 h-9 rounded-md border-slate-300 bg-white text-sm focus-visible:ring-blue-400 dark:border-slate-700 dark:bg-slate-950"
                                required={!!field.required}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {fillingItemKey === "addresses" && (
                    <>
                      <datalist id="onboarding-address-country-options">
                        {publicCountryStates.map((entry) => (
                          <option key={entry.iso2 ?? entry.name} value={entry.name} />
                        ))}
                      </datalist>
                      <datalist id="onboarding-address-state-options">
                        {addressStateOptions.map((entry) => (
                          <option key={entry.state_code ?? entry.name} value={entry.name} />
                        ))}
                      </datalist>
                      <datalist id="onboarding-address-city-options">
                        {publicCityOptions.map((entry) => (
                          <option key={entry} value={entry} />
                        ))}
                      </datalist>
                    </>
                  )}

                  {fillingItemKey === "addresses" ? (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      Pick country (via typing or suggestions), then click a state suggestion below the field, then a city. ZIP/Postal code is free text.
                    </p>
                  ) : null}

                  {fillingItemKey === "addresses" && publicLocationError ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Address suggestions temporarily unavailable — enter values manually.
                    </p>
                  ) : null}

                  {missingRequiredFields.length > 0 && (
                    <div className="mb-2 text-xs text-amber-700 dark:text-amber-400">
                      Please fill required fields: {missingRequiredFields.join(", ")}
                    </div>
                  )}

                  <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button
                      onClick={handleSaveFilling}
                      disabled={isSaving || missingRequiredFields.length > 0}
                      className="flex-1 h-9 rounded-lg text-sm"
                    >
                      {isSaving ? "Saving..." : "Save & mark complete"}
                    </Button>
                    <Button variant="outline" onClick={cancelFilling} disabled={isSaving} className="h-9 rounded-lg text-sm sm:w-auto">
                      Cancel
                    </Button>
                  </div>

                  <p className="mt-3 text-center text-[11px] text-slate-500 dark:text-slate-500">
                    Data is stored securely for HR, payroll and compliance.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {REQUIRED_ONBOARDING_ITEMS.map((item) => {
                    const isPending = pendingItems.some(p => p.key === item.key)
                    if (!isPending) return null
                    return (
                      <div 
                        key={item.key}
                        className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 hover:border-blue-200 dark:hover:border-blue-900/70 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-400 group-hover:scale-[1.02] transition shrink-0">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-900 dark:text-white tracking-tight">{item.label}</div>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">{item.description}</p>
                          </div>
                        </div>

                        <div className="mt-auto pt-3">
                          <Button 
                            size="sm" 
                            className="w-full h-9 text-sm transition-all group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600" 
                            variant="outline"
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

            <DialogFooter className="border-t border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-3 bg-slate-50/80 dark:bg-slate-950/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
              <Button 
                variant="ghost" 
                onClick={handleCloseOnboardingDialog} 
                className="h-9 px-4 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Remind me later
              </Button>
              <Button 
                onClick={handleCloseOnboardingDialog} 
                className="h-9 px-5 text-sm"
              >
                {fillingItemKey ? "Close" : "Continue to dashboard"}
              </Button>
            </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  )
}

export type { EmployeeDashboardData }
