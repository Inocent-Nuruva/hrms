"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  CalendarIcon,
  CalendarClockIcon,
  ClockIcon,
  MailIcon,
  PhoneIcon,
  Sparkles,
  Users,
  MapPin,
  User,
  CreditCard,
  Landmark,
  Target,
  BadgeCheck,
  Building2,
  GraduationCap,
  Briefcase,
  Award,
  FileText,
  CheckCircle,
  UserCheck,
  Globe2,
  ShieldCheck,
  ShieldAlert,
  MailCheck,
  MailWarning,
} from "lucide-react"
import { countries as countryCodes } from "country-flag-icons"
import * as FlagIcons from "country-flag-icons/react/3x2"
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
  getEmployeeDashboard,
  getMyDashboard,
  getMyAttendanceToday,
  listMyPayslips,
  listMyAttendancePunches,
  listMyLeaveBalances,
  listLeaveTypes,
  createEmployeeSectionItem,
  createEmployeeDocument,
  fileToBase64UploadDto,
  patchEmployeeStatus,
  type AdminRecord,
  type EmployeeProfileSection,
} from "@/lib/admin-api"
import { hasDashboardAdminIdentity } from "@/lib/dashboard-identity"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useForbiddenPrefixes } from "@/hooks/use-forbidden-route-guard"
import { canSeeDashboardPage } from "@/lib/forbidden-routes"
import { useMyProfilePhoto } from "@/lib/my-profile-photo"
import { cn } from "@/lib/utils"
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
  profile_photo_url?: string | null
  company_user?: {
    id?: number
    company_id?: number
    user_id?: number
    profile_photo_url?: string | null
    status?: string
    user?: {
      id?: number
      user_no?: string
      first_name?: string
      last_name?: string
      profile_photo_url?: string | null
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
  gender?: string | null
  sex?: string | null
  nationality?: string | null
  employment_status?: string
  employment_type?: string
  hire_date?: string | null
  probation_end_date?: string | null
  confirmation_date?: string | null
  current_fiscal_year_confirmation_date?: string | null
  is_manager?: boolean
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
  profile_photo_url?: string | null
  phone?: string
  email: string
  status: string
  user_type?: string
  is_email_verified?: boolean
  is_two_factor_enabled?: boolean
  roles: DashboardRole[]
  permissions: DashboardPermission[]
  active_company?: DashboardCompany | null
  active_company_membership?: DashboardCompanyMembership | null
  [key: string]: unknown
}

type EmployeeDashboardData = {
  generated_at?: string
  user: DashboardUser
  employee: DashboardEmployee
  status?: {
    account_status?: string
    employment_status?: string
    employment_type?: string
    is_manager?: boolean
    current_fiscal_year_confirmation_date?: string | null
    confirmation_date?: string | null
  } | null
  action_flags?: {
    can_check_in?: boolean
    can_check_out?: boolean
    can_request_leave?: boolean
    has_employee_profile?: boolean
    is_manager?: boolean
  } | null
  links?: {
    profile?: string
    leave_requests?: string
    leave_balances?: string
  } | null
  [key: string]: unknown
}

type EmployeeDashboardViewProps = {
  dashboardData: EmployeeDashboardData
  attendanceToday?: AdminRecord | null
  attendancePunchesToday?: AdminRecord[]
  leaveBalances?: AdminRecord[]
  leaveTypes?: AdminRecord[]
  payslips?: AdminRecord[]
}

type LeaveBalanceSummary = {
  typeName: string
  available: string
  used?: string
  allocated?: string
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

function resolveDashboardProfilePhotoUrl(dashboardData: EmployeeDashboardData) {
  const employeeRecord = asRecord(dashboardData.employee)
  const companyUser = asRecord(employeeRecord?.company_user)
  const companyUserUser = asRecord(companyUser?.user)
  const userRecord = asRecord(dashboardData.user)

  return (
    readString(employeeRecord, ["profile_photo_url"]) ||
    readString(companyUser, ["profile_photo_url"]) ||
    readString(companyUserUser, ["profile_photo_url"]) ||
    readString(userRecord, ["profile_photo_url"]) ||
    undefined
  )
}

function resolveManagerProfilePhotoUrl(manager: DashboardManager | null | undefined) {
  const managerRecord = asRecord(manager)
  const companyUser = asRecord(managerRecord?.company_user)
  const userRecord = asRecord(companyUser?.user)

  return (
    readString(managerRecord, ["profile_photo_url"]) ||
    readString(companyUser, ["profile_photo_url"]) ||
    readString(userRecord, ["profile_photo_url"]) ||
    undefined
  )
}

function resolveManagerDetails(manager: DashboardManager | null | undefined) {
  const managerRecord = asRecord(manager)
  const companyUser = asRecord(managerRecord?.company_user)
  const userRecord = asRecord(companyUser?.user)

  const name =
    [readString(managerRecord, ["first_name"]), readString(managerRecord, ["last_name"])]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    [readString(userRecord, ["first_name"]), readString(userRecord, ["last_name"])]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Not assigned"

  const employeeNo =
    readString(managerRecord, ["employee_no"]) ||
    readString(companyUser, ["employee_no", "employee_number", "employee_code"]) ||
    readString(userRecord, ["employee_no", "employee_number", "employee_code", "user_no"])

  const email =
    readString(managerRecord, ["email"]) || readString(companyUser, ["email"]) || readString(userRecord, ["email"])

  const phone =
    readString(managerRecord, ["phone"]) || readString(companyUser, ["phone"]) || readString(userRecord, ["phone"])

  return {
    name,
    employeeNo,
    email,
    phone,
    profilePhotoUrl: resolveManagerProfilePhotoUrl(manager),
  }
}

function greetingForNow() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

const dashboardStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const dashboardItem = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 380, damping: 28, mass: 0.7 },
  },
}

const NAME_SPARKLES = [
  { top: "-18%", left: "-12%", size: 11, delay: 0, duration: 1.6 },
  { top: "-22%", right: "-8%", size: 9, delay: 0.25, duration: 1.8 },
  { top: "55%", right: "-18%", size: 8, delay: 0.45, duration: 1.5 },
  { top: "70%", left: "-16%", size: 7, delay: 0.7, duration: 1.9 },
  { top: "-8%", left: "42%", size: 6, delay: 0.15, duration: 1.4 },
] as const

function AnimatedGreetingName({ name }: { name: string }) {
  return (
    <span className="relative inline-flex items-center">
      <motion.span
        className="relative z-[1] bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent"
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.18 }}
      >
        {name}
      </motion.span>
      {NAME_SPARKLES.map((spark, index) => (
        <motion.span
          key={index}
          className="pointer-events-none absolute z-[2] text-primary"
          style={{
            top: spark.top,
            left: "left" in spark ? spark.left : undefined,
            right: "right" in spark ? spark.right : undefined,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0.85, 0],
            scale: [0.4, 1.15, 0.9, 0.5],
            rotate: [0, 18, -8, 12],
            y: [4, -6, -2, 3],
          }}
          transition={{
            duration: spark.duration,
            delay: 0.35 + spark.delay,
            repeat: Infinity,
            repeatDelay: 1.1 + index * 0.15,
            ease: "easeInOut",
          }}
          aria-hidden
        >
          <Sparkles style={{ width: spark.size, height: spark.size }} className="fill-primary/25" />
        </motion.span>
      ))}
    </span>
  )
}

interface OnboardingFormField {
  name: string
  label: string
  placeholder?: string
  type?: "text" | "email" | "tel" | "date" | "select" | "file"
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
    { name: "classification", label: "Classification", type: "select", options: ["PRIVATE", "CONFIDENTIAL", "RESTRICTED"], defaultValue: "PRIVATE" },
    { name: "file", label: "Attachment", type: "file", required: true },
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
    if (f.type === "file") {
      return
    }
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

async function loadEmployeeDashboardOverview(token: string) {
  const dedicatedDashboard = await getEmployeeDashboard(token).catch(() => null)
  if (isEmployeeDashboardData(dedicatedDashboard)) {
    return dedicatedDashboard
  }

  const fallbackDashboard = await getMyDashboard(token).catch(() => dedicatedDashboard)
  return fallbackDashboard
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

function formatEmploymentType(value?: string | null) {
  if (!value?.trim()) return "—"
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function readBooleanValue(
  record: Record<string, unknown> | null | undefined,
  keys: string[]
): boolean | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "boolean") return value
    if (typeof value === "number" && Number.isFinite(value)) return value !== 0
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (["true", "1", "yes", "y", "on", "enabled", "verified"].includes(normalized)) return true
      if (["false", "0", "no", "n", "off", "disabled", "unverified"].includes(normalized)) return false
    }
  }
  return undefined
}

function resolveCountryCode(value?: string | null): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  const codes = countryCodes as string[]
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase()
    return codes.includes(upper) ? upper : null
  }
  try {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
    const needle = trimmed.toLowerCase()
    for (const code of codes) {
      const name = regionNames.of(code)
      if (!name) continue
      if (name.toLowerCase() === needle) return code
      // e.g. "Tanzanian" → match "Tanzania"
      if (needle.startsWith(name.toLowerCase()) || name.toLowerCase().startsWith(needle.replace(/n$/i, ""))) {
        if (needle.length >= 4) return code
      }
    }
  } catch {
    // ignore
  }
  return null
}

function formatNationality(value?: string | null) {
  if (!value?.trim()) return "—"
  const code = resolveCountryCode(value)
  if (code) {
    try {
      const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
      return regionNames.of(code) ?? code
    } catch {
      return code
    }
  }
  return value.trim()
}

function formatGenderLabel(value?: string | null) {
  if (!value?.trim()) return "—"
  return value
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

/** Regional-indicator emoji fallback when the SVG flag component is unavailable. */
function flagEmojiFromIso(code: string) {
  const upper = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return null
  return Array.from(upper)
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("")
}

function NationalityFlag({
  code,
  className,
}: {
  code: string | null
  className?: string
}) {
  if (!code) return null
  const Flag = (FlagIcons as Record<string, React.ComponentType<{ title?: string; className?: string }>>)[
    code.toUpperCase()
  ]
  if (Flag) {
    return (
      <span
        className={cn(
          "inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] border border-border/70 bg-muted shadow-sm",
          className
        )}
        title={code.toUpperCase()}
      >
        <Flag title={code.toUpperCase()} className="h-full w-full object-cover" />
      </span>
    )
  }
  const emoji = flagEmojiFromIso(code)
  if (!emoji) return null
  return (
    <span className={cn("inline-flex shrink-0 text-sm leading-none", className)} title={code.toUpperCase()}>
      {emoji}
    </span>
  )
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function formatBalanceNumber(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "")
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(1).replace(/\.0$/, "")
    }
    return value.trim()
  }
  return "—"
}

function readMoneyAmount(record: AdminRecord | null | undefined, keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function formatMoneyAmount(amount: number | null, currency?: string | null) {
  if (amount === null) return "—"
  const prefix = currency?.trim() ? `${currency.trim()} ` : ""
  return `${prefix}${amount.toLocaleString()}`
}

function readPayslipPeriodLabel(record: AdminRecord | null | undefined) {
  if (!record) return "Latest payslip"
  const direct =
    readString(record ?? null, ["period_label", "periodLabel", "label", "name"]) ||
    readString(asRecord(record.period), ["label", "name", "title"]) ||
    ""
  if (direct) return direct

  const year = readString(record ?? null, ["year"]) || readString(asRecord(record.period), ["year"])
  const month =
    readString(record ?? null, ["month_name", "monthName", "month"]) ||
    readString(asRecord(record.period), ["month_name", "monthName", "month"])
  if (month || year) {
    return [month, year].filter(Boolean).join(" ")
  }
  return "Latest payslip"
}

function readPayslipStatusLabel(record: AdminRecord | null | undefined) {
  const raw =
    readString(record ?? null, ["status", "payslip_status", "payslipStatus"]) ||
    readString(asRecord(record?.period), ["status"]) ||
    "Available"
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function readNumericish(record: AdminRecord | null | undefined, keys: string[]): number | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function buildLeaveTypeLabelMap(leaveTypes: AdminRecord[] | undefined): Map<string, string> {
  const labels = new Map<string, string>()
  if (!Array.isArray(leaveTypes)) return labels

  for (const row of leaveTypes) {
    const id =
      readNumericish(row, ["id", "leave_type_id", "leaveTypeId", "type_id", "typeId"]) ??
      readNumericish(asRecord(row.leave_type), ["id", "leave_type_id"])
    if (id === null) continue

    const nested = asRecord(row.leave_type) ?? asRecord(row.leaveType)
    const label =
      readString(row, ["name", "display_name", "displayName", "leave_type_name", "leaveTypeName", "type_name", "typeName", "title", "code"]) ||
      readString(nested, ["name", "display_name", "displayName", "leave_type_name", "code", "title"]) ||
      ""
    if (label) {
      labels.set(String(id), label)
    }
  }
  return labels
}

function buildLeaveTypeMetaMap(
  leaveTypes: AdminRecord[] | undefined
): Map<string, AdminRecord> {
  const map = new Map<string, AdminRecord>()
  if (!Array.isArray(leaveTypes)) return map
  for (const row of leaveTypes) {
    const id =
      readNumericish(row, ["id", "leave_type_id", "leaveTypeId", "type_id", "typeId"]) ??
      readNumericish(asRecord(row.leave_type), ["id", "leave_type_id"])
    if (id === null) continue
    map.set(String(id), row)
  }
  return map
}

/** Normalize gender values from employee or leave-type restriction fields. */
function normalizeGender(value: unknown): "male" | "female" | "any" | null {
  if (value == null) return null
  const raw = String(value).trim().toLowerCase().replace(/[_\s-]+/g, "")
  if (!raw) return null
  if (raw === "any" || raw === "all" || raw === "both" || raw === "none" || raw === "unrestricted") {
    return "any"
  }
  if (raw === "m" || raw === "male" || raw === "man" || raw === "masculine") return "male"
  if (raw === "f" || raw === "female" || raw === "woman" || raw === "feminine") return "female"
  if (raw.includes("female") || raw.includes("woman")) return "female"
  if (raw.includes("male") || raw.includes("man")) return "male"
  return null
}

function readEmployeeGender(employee: AdminRecord | DashboardEmployee | null | undefined): "male" | "female" | null {
  if (!employee) return null
  const record = asRecord(employee) ?? (employee as AdminRecord)
  const direct = normalizeGender(
    record.gender ??
      record.sex ??
      record.Gender ??
      record.Sex ??
      asRecord(record.personal_details)?.gender ??
      asRecord(record.personalDetails)?.gender ??
      asRecord(record.profile)?.gender
  )
  if (direct === "male" || direct === "female") return direct
  return null
}

/**
 * Resolve who a leave type is restricted to.
 * Uses leave type gender_restriction when present; falls back to name heuristics
 * (maternity → female, paternity → male).
 */
function resolveLeaveTypeGenderRestriction(
  typeName: string,
  leaveTypeRecord: AdminRecord | null,
  leaveTypeMeta: AdminRecord | null
): "male" | "female" | "any" {
  const candidates = [
    leaveTypeRecord,
    leaveTypeMeta,
    asRecord(leaveTypeMeta?.leave_type),
    asRecord(leaveTypeMeta?.leaveType),
  ]
  for (const source of candidates) {
    if (!source) continue
    const restriction = normalizeGender(
      source.gender_restriction ??
        source.genderRestriction ??
        source.gender ??
        source.applicable_gender ??
        source.applicableGender ??
        source.sex_restriction ??
        source.sexRestriction
    )
    if (restriction === "male" || restriction === "female" || restriction === "any") {
      return restriction
    }
  }

  const name = typeName.toLowerCase()
  if (
    name.includes("maternity") ||
    name.includes("pregnancy") ||
    name.includes("maternal") ||
    name.includes("childbirth") ||
    name.includes("antenatal") ||
    name.includes("prenatal")
  ) {
    return "female"
  }
  if (name.includes("paternity") || name.includes("paternal")) {
    return "male"
  }
  return "any"
}

function isLeaveTypeVisibleForGender(
  restriction: "male" | "female" | "any",
  employeeGender: "male" | "female" | null
): boolean {
  if (restriction === "any") return true
  // If employee gender is unknown, keep gender-specific types visible to avoid hiding data wrongly.
  if (!employeeGender) return true
  return restriction === employeeGender
}

function extractLeaveSummaries(
  balances: AdminRecord[] | undefined,
  leaveTypes?: AdminRecord[],
  employee?: AdminRecord | DashboardEmployee | null
): LeaveBalanceSummary[] {
  if (!Array.isArray(balances) || balances.length === 0) return []
  const leaveTypeLabels = buildLeaveTypeLabelMap(leaveTypes)
  const leaveTypeMeta = buildLeaveTypeMetaMap(leaveTypes)
  const employeeGender = readEmployeeGender(employee)

  return balances
    .map((b) => {
      const leaveTypeRecord =
        asRecord(b.leave_type) ?? asRecord(b.leaveType) ?? asRecord(b.type) ?? asRecord(b.leave)
      const policyRecord = asRecord(b.policy) ?? asRecord(b.leave_policy) ?? asRecord(b.leavePolicy)

      const leaveTypeId =
        readNumericish(b, ["leave_type_id", "leaveTypeId", "type_id", "typeId"]) ??
        readNumericish(leaveTypeRecord, ["id", "leave_type_id", "leaveTypeId"])

      // Prefer explicit leave-type labels; avoid bare row.name (often employee/person name).
      const typeName =
        readString(b, ["leave_type_name", "leaveTypeName", "type_name", "typeName", "leave_type_code"]) ||
        readString(leaveTypeRecord, ["name", "display_name", "displayName", "leave_type_name", "title", "code"]) ||
        readString(policyRecord, ["name", "display_name", "displayName", "policy_name", "title"]) ||
        (leaveTypeId !== null ? leaveTypeLabels.get(String(leaveTypeId)) : undefined) ||
        (leaveTypeId !== null ? `Leave type #${leaveTypeId}` : "") ||
        ""

      const usedRaw = readNumericish(b, ["used_days", "usedDays", "used", "taken", "taken_days"])
      const pendingRaw = readNumericish(b, ["pending_days", "pendingDays", "pending"])
      const allocatedRaw = readNumericish(b, [
        "allocated_days",
        "allocatedDays",
        "allocated",
        "entitlement",
        "entitlement_days",
      ])
      const availableRaw = readNumericish(b, [
        "available_days",
        "availableDays",
        "available",
        "remaining_days",
        "remainingDays",
        "remaining",
        "balance",
        "current_balance",
        "currentBalance",
        "days_available",
        "daysAvailable",
      ])

      let available = availableRaw
      if (available === null && allocatedRaw !== null) {
        available = allocatedRaw - (usedRaw ?? 0) - (pendingRaw ?? 0)
      }

      const resolvedName = typeName.trim() || "Leave"
      const genderRestriction = resolveLeaveTypeGenderRestriction(
        resolvedName,
        leaveTypeRecord,
        leaveTypeId !== null ? leaveTypeMeta.get(String(leaveTypeId)) ?? null : null
      )

      return {
        typeName: resolvedName,
        available: formatBalanceNumber(available),
        used: usedRaw != null ? formatBalanceNumber(usedRaw) : undefined,
        allocated: allocatedRaw != null ? formatBalanceNumber(allocatedRaw) : undefined,
        genderRestriction,
      }
    })
    .filter((row) => !(row.typeName === "Leave" && row.available === "—"))
    .filter((row) => isLeaveTypeVisibleForGender(row.genderRestriction, employeeGender))
    .map(({ typeName, available, used, allocated }) => ({
      typeName,
      available,
      used,
      allocated,
    }))
}

function formatPunchState(state: string | null | undefined): string {
  if (!state) return "No activity"
  return state
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function coerceTimeValue(value: unknown): string {
  if (value == null || value === "" || value === "-") return ""
  if (typeof value === "number" && Number.isFinite(value)) {
    // Unix seconds / ms
    const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : NaN
    if (Number.isFinite(ms)) {
      return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    }
    return ""
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed || trimmed === "-") return ""
    // Already a clock time (HH:mm or HH:mm:ss)
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed.slice(0, 5)
    }
    const date = new Date(trimmed)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    }
    return trimmed
  }
  // Nested object e.g. { punched_at, time, at }
  const record = asRecord(value)
  if (record) {
    return (
      coerceTimeValue(record.punched_at) ||
      coerceTimeValue(record.punch_time) ||
      coerceTimeValue(record.punch_at) ||
      coerceTimeValue(record.time) ||
      coerceTimeValue(record.at) ||
      coerceTimeValue(record.timestamp) ||
      coerceTimeValue(record.datetime) ||
      coerceTimeValue(record.created_at)
    )
  }
  return ""
}

function readTimeFromRecord(record: AdminRecord | null | undefined, keys: string[]): string {
  if (!record) return ""
  for (const key of keys) {
    const formatted = coerceTimeValue(record[key])
    if (formatted) return formatted
  }
  return ""
}

// Align with Android HomeScreen / AttendanceScreen field order for /api/me/attendance/today
const CHECK_IN_KEYS = [
  "checkInAt",
  "check_in_at",
  "firstCheckInAt",
  "first_check_in_at",
  "first_punch",
  "first_punch_at",
  "check_in_time",
  "checkInTime",
  "check_in",
  "checkIn",
  "clock_in_at",
  "clockInAt",
  "clock_in",
  "clockIn",
  "in_time",
  "inTime",
  "actual_check_in_at",
  "actualCheckInAt",
]

const CHECK_OUT_KEYS = [
  "checkOutAt",
  "check_out_at",
  "lastCheckOutAt",
  "last_check_out_at",
  "last_punch",
  "last_punch_at",
  "check_out_time",
  "checkOutTime",
  "check_out",
  "checkOut",
  "clock_out_at",
  "clockOutAt",
  "clock_out",
  "clockOut",
  "out_time",
  "outTime",
  "actual_check_out_at",
  "actualCheckOutAt",
]

function readPunchTimesFromList(value: unknown): { first: string; last: string } {
  if (!Array.isArray(value) || value.length === 0) return { first: "", last: "" }
  const times = value
    .map((entry) => coerceTimeValue(entry) || readTimeFromRecord(asRecord(entry), ["punched_at", "punch_time", "punch_at", "time", "at", "timestamp", "created_at"]))
    .filter(Boolean)
  if (times.length === 0) return { first: "", last: "" }
  return { first: times[0] ?? "", last: times[times.length - 1] ?? "" }
}

type AttendanceTone = "present" | "absent" | "late" | "leave" | "half" | "holiday" | "off" | "pending" | "neutral"

const ATTENDANCE_TONE_STYLES: Record<
  AttendanceTone,
  { icon: string; label: string; hint: string }
> = {
  present: {
    icon: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "text-emerald-700 dark:text-emerald-300",
    hint: "text-emerald-700/75 dark:text-emerald-300/75",
  },
  absent: {
    icon: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
    label: "text-rose-700 dark:text-rose-300",
    hint: "text-rose-700/75 dark:text-rose-300/75",
  },
  late: {
    icon: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    label: "text-amber-800 dark:text-amber-300",
    hint: "text-amber-800/75 dark:text-amber-300/75",
  },
  leave: {
    icon: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
    label: "text-sky-700 dark:text-sky-300",
    hint: "text-sky-700/75 dark:text-sky-300/75",
  },
  half: {
    icon: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
    label: "text-orange-700 dark:text-orange-300",
    hint: "text-orange-700/75 dark:text-orange-300/75",
  },
  holiday: {
    icon: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
    label: "text-violet-700 dark:text-violet-300",
    hint: "text-violet-700/75 dark:text-violet-300/75",
  },
  off: {
    icon: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
    label: "text-slate-600 dark:text-slate-300",
    hint: "text-slate-600/75 dark:text-slate-300/75",
  },
  pending: {
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
    label: "text-blue-700 dark:text-blue-300",
    hint: "text-blue-700/75 dark:text-blue-300/75",
  },
  neutral: {
    icon: "border-border bg-muted text-muted-foreground",
    label: "text-foreground",
    hint: "text-muted-foreground",
  },
}

function normalizeAttendanceKey(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
}

function resolveAttendanceTone(state: string | null | undefined): AttendanceTone {
  const normalized = normalizeAttendanceKey(state)
  if (!normalized) return "neutral"

  // Order matters: match exception states before broad present/leave tokens.
  if (
    normalized.includes("absent") ||
    normalized.includes("no_show") ||
    normalized.includes("noshow") ||
    normalized.includes("reject")
  ) {
    return "absent"
  }
  if (
    normalized.includes("early_departure") ||
    normalized.includes("early_depart") ||
    normalized.includes("early_leave") ||
    normalized.includes("early_out") ||
    normalized.includes("early_checkout") ||
    normalized.includes("early_check_out") ||
    normalized.includes("left_early") ||
    normalized.includes("departed_early") ||
    normalized.includes("late") ||
    normalized.includes("missing_punch") ||
    normalized.includes("undertime")
  ) {
    return "late"
  }
  if (normalized.includes("half")) {
    return "half"
  }
  if (normalized.includes("holiday") || normalized.includes("public_holiday")) {
    return "holiday"
  }
  if (
    normalized.includes("off_day") ||
    normalized.includes("offday") ||
    normalized.includes("weekend") ||
    normalized.includes("rest_day") ||
    normalized === "off"
  ) {
    return "off"
  }
  if (
    normalized.includes("on_leave") ||
    normalized.includes("leave") ||
    normalized.includes("vacation") ||
    normalized.includes("sick")
  ) {
    return "leave"
  }
  if (
    normalized.includes("pending") ||
    normalized.includes("processing") ||
    normalized.includes("draft") ||
    normalized.includes("in_progress")
  ) {
    return "pending"
  }
  if (
    normalized.includes("present") ||
    normalized.includes("on_time") ||
    normalized.includes("checked_in") ||
    normalized.includes("checked_out") ||
    normalized.includes("check_in") ||
    normalized.includes("check_out") ||
    normalized.includes("worked") ||
    normalized.includes("complete") ||
    normalized === "in" ||
    normalized === "out"
  ) {
    return "present"
  }
  return "neutral"
}

function deepFindStringByKeyHint(
  source: unknown,
  keyHints: RegExp[],
  depth = 0
): string | undefined {
  if (!source || depth > 4) return undefined
  const record = asRecord(source)
  if (!record) return undefined

  for (const [key, value] of Object.entries(record)) {
    if (!keyHints.some((re) => re.test(key))) continue
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" || typeof value === "boolean") return String(value)
  }

  for (const value of Object.values(record)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = deepFindStringByKeyHint(value, keyHints, depth + 1)
      if (nested) return nested
    }
  }
  return undefined
}

function deepFindTimeByKeyHint(source: unknown, keyHints: RegExp[], depth = 0): string {
  if (!source || depth > 4) return ""
  const record = asRecord(source)
  if (!record) return ""

  for (const [key, value] of Object.entries(record)) {
    if (!keyHints.some((re) => re.test(key))) continue
    const formatted = coerceTimeValue(value)
    if (formatted) return formatted
  }

  for (const value of Object.values(record)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = deepFindTimeByKeyHint(value, keyHints, depth + 1)
      if (nested) return nested
    }
  }
  return ""
}

function pickAttendanceState(today: AdminRecord): string | undefined {
  const summary =
    asRecord(today.summary) ??
    asRecord(today.daily_summary) ??
    asRecord(today.dailySummary) ??
    asRecord(today.attendance)

  // Prefer day-level attendance status over raw punch_state ("in"/"out").
  return (
    readString(today, [
      "attendance_status",
      "attendanceStatus",
      "day_status",
      "dayStatus",
      "summary_status",
      "summaryStatus",
      "work_status",
      "workStatus",
      "final_status",
      "finalStatus",
      "computed_status",
      "computedStatus",
    ]) ||
    readString(summary, [
      "attendance_status",
      "attendanceStatus",
      "day_status",
      "dayStatus",
      "status",
      "state",
      "final_status",
      "finalStatus",
    ]) ||
    deepFindStringByKeyHint(today, [
      /attendance_?status/i,
      /day_?status/i,
      /summary_?status/i,
      /work_?status/i,
      /final_?status/i,
    ]) ||
    readString(today, ["status", "state", "punch_state", "punchState"])
  )
}

function punchTypeOf(row: AdminRecord): "CHECK_IN" | "CHECK_OUT" | "OTHER" {
  const raw =
    readString(row, ["punch_type", "punchType", "type", "direction", "in_out", "inOut", "event_type", "eventType"]) ||
    ""
  const normalized = normalizeAttendanceKey(raw)
  // Check OUT before IN so values like "checked_out" don't match "out" wrongly after "in".
  if (
    normalized.includes("check_out") ||
    normalized.includes("clock_out") ||
    normalized === "out" ||
    normalized === "co" ||
    normalized === "o" ||
    normalized.endsWith("_out") ||
    normalized.includes("departure")
  ) {
    return "CHECK_OUT"
  }
  if (
    normalized.includes("check_in") ||
    normalized.includes("clock_in") ||
    normalized === "in" ||
    normalized === "ci" ||
    normalized === "i" ||
    normalized.endsWith("_in") ||
    // Android treats punch types containing "in" as check-in (CHECK_IN, IN, …)
    (normalized.includes("in") && !normalized.includes("out"))
  ) {
    return "CHECK_IN"
  }
  return "OTHER"
}

function punchTimeRaw(row: AdminRecord): string {
  // Android uses punched_at / punchedAt first for /api/me/attendance/punches
  return (
    readTimeFromRecord(row, [
      "punched_at",
      "punchedAt",
      "punch_time",
      "punchTime",
      "punch_at",
      "punchAt",
      "timestamp",
      "datetime",
      "event_time",
      "eventTime",
      "time",
      "at",
      "created_at",
      "createdAt",
    ]) || ""
  )
}

function punchSortKey(row: AdminRecord): number {
  const candidates = [
    row.punched_at,
    row.punchedAt,
    row.punch_time,
    row.punchTime,
    row.punch_at,
    row.punchAt,
    row.timestamp,
    row.datetime,
    row.event_time,
    row.eventTime,
    row.time,
    row.created_at,
    row.createdAt,
  ]
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 1e12 ? value : value > 1e9 ? value * 1000 : value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Date.parse(value)
      if (!Number.isNaN(parsed)) return parsed
      // HH:mm(:ss) → minutes for same-day ordering
      const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
      if (match) {
        return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0)
      }
    }
  }
  return 0
}

/** Derive first check-in and last check-out from /api/me/attendance/punches rows. */
function punchTimesFromHistory(punches: AdminRecord[] | undefined): { first: string; last: string } {
  if (!Array.isArray(punches) || punches.length === 0) return { first: "", last: "" }

  const sorted = [...punches].sort((a, b) => punchSortKey(a) - punchSortKey(b))
  const checkIns = sorted.filter((row) => punchTypeOf(row) === "CHECK_IN")
  const checkOuts = sorted.filter((row) => punchTypeOf(row) === "CHECK_OUT")

  let first = ""
  let last = ""

  if (checkIns.length > 0) {
    first = punchTimeRaw(checkIns[0]!)
  }
  if (checkOuts.length > 0) {
    last = punchTimeRaw(checkOuts[checkOuts.length - 1]!)
  }

  // Untyped punches: use earliest as in, latest as out when there are 2+ events.
  if (!first || !last) {
    const allTimes = sorted.map(punchTimeRaw).filter(Boolean)
    if (!first && allTimes.length > 0) first = allTimes[0] ?? ""
    if (!last && allTimes.length > 1) last = allTimes[allTimes.length - 1] ?? ""
  }

  if (first && last && first === last && sorted.length === 1) {
    last = ""
  }

  return { first, last }
}

function localDateIso(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function getAttendanceStatus(
  today: AdminRecord | null | undefined,
  punchesToday?: AdminRecord[]
): {
  label: string
  hint: string
  tone: AttendanceTone
  checkIn: string
  checkOut: string
} {
  if (!today && (!punchesToday || punchesToday.length === 0)) {
    return {
      label: "No data",
      hint: "Attendance not loaded yet",
      tone: "neutral",
      checkIn: "—",
      checkOut: "—",
    }
  }

  const summary = today
    ? asRecord(today.summary) ?? asRecord(today.daily_summary) ?? asRecord(today.attendance)
    : null
  const state = today ? pickAttendanceState(today) : undefined
  const tone = resolveAttendanceTone(state)
  const proc = today
    ? readString(today, ["processing_state", "processingState"]) ||
      readString(summary, ["processing_state", "processingState"])
    : undefined

  // Punch history is the source of truth for actual clock times.
  const fromHistory = punchTimesFromHistory(punchesToday)

  let firstFmt =
    fromHistory.first ||
    (today ? readTimeFromRecord(today, CHECK_IN_KEYS) : "") ||
    readTimeFromRecord(summary, CHECK_IN_KEYS) ||
    (today
      ? deepFindTimeByKeyHint(today, [
          /first_?(check_?in|punch)/i,
          /check_?in(_?at|_?time)?$/i,
          /clock_?in/i,
          /^in_?time$/i,
        ])
      : "")

  let lastFmt =
    fromHistory.last ||
    (today ? readTimeFromRecord(today, CHECK_OUT_KEYS) : "") ||
    readTimeFromRecord(summary, CHECK_OUT_KEYS) ||
    (today
      ? deepFindTimeByKeyHint(today, [
          /last_?(check_?out|punch)/i,
          /check_?out(_?at|_?time)?$/i,
          /clock_?out/i,
          /^out_?time$/i,
        ])
      : "")

  // Nested lists on the today payload.
  if (today && (!firstFmt || !lastFmt)) {
    const listCandidates = [
      today.punches,
      today.punch_logs,
      today.events,
      today.attendance_logs,
      summary?.punches,
      summary?.punch_logs,
      summary?.events,
    ]
    for (const candidate of listCandidates) {
      const times = readPunchTimesFromList(candidate)
      if (!firstFmt && times.first) firstFmt = times.first
      if (!lastFmt && times.last) lastFmt = times.last
      if (firstFmt && lastFmt) break
    }
  }

  if (firstFmt && lastFmt && firstFmt === lastFmt) {
    const onlyOneHistory = Array.isArray(punchesToday) && punchesToday.length === 1
    const onlyOneNested = today
      ? [today.punches, today.punch_logs, today.events, summary?.punches]
          .filter(Array.isArray)
          .some((list) => (list as unknown[]).length === 1)
      : false
    if (onlyOneHistory || onlyOneNested) {
      lastFmt = ""
    }
  }

  const label = formatPunchState(state) || (firstFmt ? "Active" : "No activity")
  let hint: string
  if (firstFmt && lastFmt) {
    hint = `In ${firstFmt} · Out ${lastFmt}`
  } else if (firstFmt) {
    hint = `In ${firstFmt} · No check-out yet`
  } else if (lastFmt) {
    hint = `Out ${lastFmt}`
  } else if (tone === "absent" || tone === "off" || tone === "holiday" || tone === "leave") {
    hint =
      tone === "absent"
        ? "No punches recorded today"
        : tone === "leave"
          ? "On approved leave today"
          : tone === "holiday"
            ? "Public holiday"
            : "Scheduled off day"
  } else if (tone === "late" || tone === "present" || tone === "half") {
    hint = "Punch times not available yet"
  } else {
    hint = "No punches recorded today"
  }

  if (proc) {
    hint += ` · ${proc.replace(/_/g, " ")}`
  }
  return {
    label,
    hint,
    tone,
    checkIn: firstFmt || "—",
    checkOut: lastFmt || "—",
  }
}

function QuickActionLink({
  href,
  title,
  icon,
}: {
  href: string
  title: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-2 py-1.5 text-white no-underline transition-colors hover:bg-white/18 hover:no-underline"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-white/15 text-white [&_svg]:size-3">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold leading-tight">{title}</span>
      <span className="text-[10px] font-medium text-white/75 transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  )
}

function DashboardSection({
  title,
  subtitle,
  action,
  children,
  barClassName = "bg-primary",
  className,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  barClassName?: string
  className?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex">
        <div className={cn("w-1 shrink-0", barClassName)} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-3 py-2.5">
          <div className="min-w-0 flex-1 basis-[10rem]">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {subtitle ? (
              <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="ml-auto shrink-0">{action}</div> : null}
        </div>
      </div>
      <div className="border-t border-border/70">{children}</div>
    </section>
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
  attendancePunchesToday,
  leaveBalances,
  leaveTypes,
  payslips,
}: EmployeeDashboardViewProps) {
  const { url: myProfilePhotoUrl } = useMyProfilePhoto()
  const actor = useDashboardActor()
  useForbiddenPrefixes()

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
  const preferredName =
    dashboardData.employee.preferred_name?.trim() || dashboardData.user.first_name
  const profileHref = "/dashboard/me/profile"
  const leaveBalancesHref = "/dashboard/me/leave/balances"
  const leaveRequestHref = "/dashboard/me/leave/requests"
  const attendanceHref = "/dashboard/attendance/today"
  const holidaysHref = "/dashboard/me/leave/holidays"
  const payrollHref = "/dashboard/me/payroll"

  const employeeProfilePhotoUrl =
    myProfilePhotoUrl || resolveDashboardProfilePhotoUrl(dashboardData) || undefined
  const managerDetails = resolveManagerDetails(dashboardData.employee.manager)
  const positionLabel = dashboardData.employee.primary_position?.name || "—"
  const departmentLabel = dashboardData.employee.primary_department?.name || "—"
  const branchLabel =
    [dashboardData.employee.primary_branch?.name, dashboardData.employee.primary_branch?.city]
      .filter(Boolean)
      .join(" · ") || "—"
  const employeeNo = dashboardData.employee.employee_no || "—"
  const hireDateLabel = formatDate(dashboardData.employee.hire_date)
  const employmentStatus =
    readString(asRecord(dashboardData.employee), ["employment_status", "status"]) || "Active"
  const employeeRecord = asRecord(dashboardData.employee)
  const userRecord = asRecord(dashboardData.user)
  const statusRecord = asRecord(dashboardData.status)
  const actionFlagsRecord = asRecord(dashboardData.action_flags)
  const dashboardRoot = asRecord(dashboardData)

  const nationalityRaw =
    readString(employeeRecord, ["nationality"]) ||
    readString(statusRecord, ["nationality"]) ||
    null
  const nationalityCode = resolveCountryCode(nationalityRaw)
  const nationalityLabel = formatNationality(nationalityRaw)
  const genderLabel = formatGenderLabel(
    readString(employeeRecord, ["gender", "sex", "Gender", "Sex"]) ||
      (readEmployeeGender(dashboardData.employee) ?? null)
  )
  const employmentTypeLabel = formatEmploymentType(
    readString(employeeRecord, ["employment_type", "employmentType"]) ||
      readString(statusRecord, ["employment_type", "employmentType"])
  )
  const probationEndDateRaw =
    readString(employeeRecord, ["probation_end_date", "probationEndDate"]) ||
    readString(statusRecord, ["probation_end_date", "probationEndDate"])
  const probationEndDateLabel = probationEndDateRaw
    ? formatDate(probationEndDateRaw)
    : "—"

  const roleLooksManager = (dashboardData.user.roles ?? []).some((role) => {
    const name = `${role.name ?? ""} ${role.display_name ?? ""}`.toLowerCase()
    return (
      name.includes("manager") ||
      name.includes("supervisor") ||
      name.includes("team lead") ||
      name.includes("team_lead")
    )
  })
  const isManager =
    readBooleanValue(employeeRecord, ["is_manager", "isManager", "is_managerial", "isManagerial"]) ??
    readBooleanValue(statusRecord, ["is_manager", "isManager", "is_managerial"]) ??
    readBooleanValue(actionFlagsRecord, ["is_manager", "isManager"]) ??
    readBooleanValue(userRecord, ["is_manager", "isManager"]) ??
    readBooleanValue(dashboardRoot, ["is_manager", "isManager"]) ??
    roleLooksManager

  const fiscalConfirmationRaw =
    readString(employeeRecord, [
      "current_fiscal_year_confirmation_date",
      "currentFiscalYearConfirmationDate",
      "fiscal_year_confirmation_date",
      "fiscalYearConfirmationDate",
      "confirmation_date",
      "confirmationDate",
    ]) ||
    readString(statusRecord, [
      "current_fiscal_year_confirmation_date",
      "currentFiscalYearConfirmationDate",
      "fiscal_year_confirmation_date",
      "confirmation_date",
      "confirmationDate",
    ]) ||
    readString(dashboardRoot, [
      "current_fiscal_year_confirmation_date",
      "currentFiscalYearConfirmationDate",
      "fiscal_year_confirmation_date",
      "confirmation_date",
    ])
  // API returns FY confirmation for managers; also show when the date is present.
  const showFiscalConfirmation = isManager || Boolean(fiscalConfirmationRaw)
  const fiscalConfirmationLabel = fiscalConfirmationRaw
    ? formatDate(fiscalConfirmationRaw)
    : "—"

  const isEmailVerified =
    readBooleanValue(userRecord, [
      "is_email_verified",
      "isEmailVerified",
      "email_verified",
      "emailVerified",
    ]) ?? false
  const isTwoFactorEnabled =
    readBooleanValue(userRecord, [
      "is_two_factor_enabled",
      "isTwoFactorEnabled",
      "two_factor_enabled",
      "twoFactorEnabled",
      "is_2fa_enabled",
      "is2faEnabled",
    ]) ??
    readBooleanValue(dashboardRoot, [
      "is_two_factor_enabled",
      "isTwoFactorEnabled",
      "two_factor_enabled",
    ]) ??
    false
  const settingsTwoFactorHref = "/dashboard/settings?tab=two-factor"
  const settingsEmailVerifyHref = "/dashboard/settings?tab=email"

  const att = getAttendanceStatus(attendanceToday, attendancePunchesToday)
  const leaveSummaries = extractLeaveSummaries(
    leaveBalances,
    leaveTypes,
    asRecord(dashboardData.employee)
  )
  const totalLeaveDays = leaveSummaries.reduce((sum, item) => {
    const n = Number(String(item.available).replace(/[^\d.-]/g, ""))
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  const latestPayslip = Array.isArray(payslips) && payslips.length > 0 ? payslips[0] : null
  const latestPayslipCurrency =
    readString(latestPayslip, ["currency", "pay_currency", "payCurrency"]) ||
    readString(asRecord(latestPayslip?.period), ["currency"]) ||
    ""
  const latestPayslipNet = formatMoneyAmount(
    readMoneyAmount(latestPayslip, ["net_pay", "netPay", "net_salary", "netSalary"]),
    latestPayslipCurrency
  )
  const latestPayslipGross = formatMoneyAmount(
    readMoneyAmount(latestPayslip, ["gross_pay", "grossPay", "gross_salary", "grossSalary"]),
    latestPayslipCurrency
  )
  const latestPayslipPeriod = readPayslipPeriodLabel(latestPayslip)
  const latestPayslipStatus = readPayslipStatusLabel(latestPayslip)

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  const snapshotChips = [
    {
      key: "status",
      label: "Today",
      value: att.label,
      className: ATTENDANCE_TONE_STYLES[att.tone].icon,
      valueClassName: ATTENDANCE_TONE_STYLES[att.tone].label,
    },
    {
      key: "in",
      label: "Check in",
      value: att.checkIn,
      className: "bg-background",
      valueClassName: att.checkIn === "—" ? "text-muted-foreground" : "text-primary",
    },
    {
      key: "out",
      label: "Check out",
      value: att.checkOut,
      className: "bg-background",
      valueClassName: att.checkOut === "—" ? "text-muted-foreground" : "text-primary",
    },
    {
      key: "leave",
      label: "Leave left",
      value: leaveSummaries.length > 0 ? String(totalLeaveDays) : "—",
      className: "bg-background",
      valueClassName:
        leaveSummaries.length > 0 ? "text-primary" : "text-muted-foreground",
    },
    {
      key: "types",
      label: "Leave types",
      value: String(leaveSummaries.length),
      className: "bg-background",
      valueClassName: leaveSummaries.length > 0 ? "text-primary" : "text-muted-foreground",
    },
  ]

  return (
    <motion.div
      className="space-y-4"
      variants={dashboardStagger}
      initial="hidden"
      animate="show"
    >
      <DoodleSprites />

      {/* Greeting + day snapshot on the right */}
      <motion.div
        variants={dashboardItem}
        className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div className="min-w-0 max-w-full">
          <motion.p
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {todayLabel}
          </motion.p>
          <h1 className="mt-0.5 break-words text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            <motion.span
              className="inline-block"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {greetingForNow()},
            </motion.span>{" "}
            <AnimatedGreetingName name={preferredName} />
          </h1>
          <motion.p
            className="mt-0.5 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.35 }}
          >
            Here&apos;s your day at a glance.
          </motion.p>
        </div>

        <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain sm:w-auto sm:max-w-[min(100%,36rem)] sm:shrink-0">
          <div className="inline-flex min-w-full flex-nowrap items-stretch rounded-lg border border-border sm:min-w-0">
            {snapshotChips.map((chip, index, arr) => (
              <motion.div
                key={chip.key}
                className={cn(
                  "flex min-w-[4.75rem] flex-1 flex-col justify-center px-2 py-2 sm:min-w-[5.25rem] sm:flex-none sm:px-2.5",
                  chip.className,
                  index < arr.length - 1 ? "border-r border-border/60" : null
                )}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 + index * 0.05, duration: 0.28 }}
              >
                <span className="truncate text-[9px] font-semibold uppercase tracking-wide opacity-80 sm:text-[10px]">
                  {chip.label}
                </span>
                <span
                  className={cn(
                    "truncate text-xs font-semibold tabular-nums leading-tight capitalize sm:text-sm",
                    chip.valueClassName
                  )}
                >
                  {chip.value}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Hero — primary card with labeled identity */}
      <motion.div
        variants={dashboardItem}
        className="relative overflow-hidden rounded-2xl p-4 text-white md:p-5"
        style={{ backgroundColor: "var(--primary)" }}
      >
        <Doodle name="doodle-circles" />
        <div className="relative z-10 space-y-4">
          <div className="flex min-w-0 items-start gap-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.12 }}
            >
              <Avatar className="size-14 shrink-0 ring-2 ring-white/30 md:size-16">
                {employeeProfilePhotoUrl ? (
                  <AvatarImage src={employeeProfilePhotoUrl} alt={fullName} />
                ) : null}
                <AvatarFallback className="bg-white/20 text-lg font-semibold text-white">
                  {initialsFor(fullName)}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                  {fullName}
                </h2>
                <span className="inline-flex items-center rounded-full border border-white/30 bg-white/20 px-2 py-0.5 text-[11px] font-semibold capitalize text-white">
                  {employmentStatus}
                </span>
              </div>
              <Link href={profileHref} className="inline-block no-underline hover:no-underline">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  View full profile
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Employee no.", value: employeeNo },
              { label: "Position", value: positionLabel },
              { label: "Department", value: departmentLabel },
              { label: "Branch", value: branchLabel },
              { label: "Joined", value: hireDateLabel },
            ].map((field, index) => (
              <motion.div
                key={field.label}
                className="min-w-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.05, duration: 0.3 }}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide text-white/50">
                  {field.label}
                </p>
                <p className="truncate text-xs font-semibold text-white">{field.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: attendanceHref, title: "Attendance", icon: <ClockIcon /> },
              { href: leaveRequestHref, title: "Request leave", icon: <CalendarClockIcon /> },
              { href: leaveBalancesHref, title: "Leave balances", icon: <CalendarIcon /> },
              { href: payrollHref, title: "My payroll", icon: <Landmark /> },
              { href: "/dashboard/me/performance/overview", title: "My performance", icon: <Target /> },
              { href: "/dashboard/me/probation", title: "My probation", icon: <BadgeCheck /> },
              { href: "/dashboard/me/field/visits", title: "My field", icon: <MapPin /> },
              { href: "/dashboard/me/finance", title: "My finance", icon: <Landmark /> },
              { href: "/dashboard/me/activities/today", title: "My activities", icon: <FileText /> },
              { href: "/dashboard/me/movements", title: "My movements", icon: <Users /> },
              { href: "/dashboard/me/team/overview", title: "My team", icon: <UserCheck /> },
              { href: "/dashboard/me/insights", title: "My insights", icon: <Sparkles /> },
              { href: "/dashboard/me/requests/actions", title: "My requests", icon: <FileText /> },
              { href: holidaysHref, title: "Holidays", icon: <CalendarIcon /> },
            ].filter((action) =>
              actor.ready &&
              canSeeDashboardPage(action.href, actor.permissionLabels, actor.accessMode)
            ).map((action, index) => (
              <motion.div
                key={action.href}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 360,
                  damping: 26,
                  delay: 0.28 + index * 0.06,
                }}
              >
                <QuickActionLink href={action.href} title={action.title} icon={action.icon} />
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Leave balances — full width */}
      <motion.div variants={dashboardItem}>
        <DashboardSection
          title="Leave balances"
          subtitle="Available days by type"
          action={
            <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
              <Link
                href={leaveBalancesHref}
                className="shrink-0 text-xs font-medium text-primary no-underline hover:underline"
              >
                View all
              </Link>
              <Link href={leaveRequestHref} className="shrink-0 no-underline hover:no-underline">
                <Button size="sm" className="h-7 px-2 text-[11px] bg-primary !text-white hover:bg-primary/90 sm:px-2.5 sm:text-xs">
                  Request time off
                </Button>
              </Link>
            </div>
          }
        >
          {leaveSummaries.length > 0 ? (
            <div className="flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
              {leaveSummaries.map((item, idx) => (
                <motion.div
                  key={`${item.typeName}-${idx}`}
                  className="flex min-w-[6.25rem] flex-1 flex-col items-center justify-center rounded-xl bg-muted/40 px-1.5 py-2.5 text-center sm:min-w-[7.5rem] sm:px-2 sm:py-3"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + idx * 0.05, duration: 0.25 }}
                >
                  <p className="line-clamp-2 min-h-[1.4rem] w-full text-[9px] font-medium leading-tight text-muted-foreground">
                    {item.typeName}
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums leading-none text-primary">
                    {item.available}
                  </p>
                  <p className="mt-0.5 text-[8px] text-muted-foreground">days left</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              No leave balance information available yet.
            </div>
          )}
        </DashboardSection>
      </motion.div>

      <motion.div variants={dashboardItem}>
        <DashboardSection
          title="Payroll"
          subtitle="Latest payslip snapshot"
          action={
            <Link
              href={payrollHref}
              className="shrink-0 text-xs font-medium text-primary no-underline hover:underline"
            >
              Open payroll
            </Link>
          }
          barClassName="bg-emerald-500"
        >
          {latestPayslip ? (
            <div className="grid gap-3 px-3 py-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-muted/40 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Period
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{latestPayslipPeriod}</p>
                <p className="mt-1 text-xs text-muted-foreground">{latestPayslipStatus}</p>
              </div>
              <div className="rounded-xl bg-muted/40 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Net pay
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{latestPayslipNet}</p>
              </div>
              <div className="rounded-xl bg-muted/40 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Gross pay
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{latestPayslipGross}</p>
              </div>
              <div className="rounded-xl bg-muted/40 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Available payslips
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{payslips?.length ?? 0}</p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              No payslips have been published to your account yet.
            </div>
          )}
        </DashboardSection>
      </motion.div>

      {/* Manager (left) + Employment (right) — same card design */}
      <div className="grid gap-3 lg:grid-cols-2">
        <motion.div variants={dashboardItem}>
          <DashboardSection title="Your manager" subtitle="Reporting line" barClassName="bg-primary">
            <div className="flex items-start gap-3 px-3 py-3">
              <Avatar className="size-11 shrink-0 ring-1 ring-border">
                {managerDetails.profilePhotoUrl ? (
                  <AvatarImage src={managerDetails.profilePhotoUrl} alt={managerDetails.name} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {initialsFor(managerDetails.name === "Not assigned" ? "NA" : managerDetails.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div>
                  <p className="truncate text-sm font-semibold text-foreground">{managerDetails.name}</p>
                  {managerDetails.employeeNo ? (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {managerDetails.employeeNo}
                    </p>
                  ) : null}
                </div>
                {managerDetails.email || managerDetails.phone ? (
                  <div className="flex flex-col gap-1">
                    {managerDetails.email ? (
                      <a
                        href={`mailto:${managerDetails.email}`}
                        className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground no-underline hover:text-primary hover:underline"
                      >
                        <MailIcon className="size-3 shrink-0 text-primary" />
                        <span className="truncate">{managerDetails.email}</span>
                      </a>
                    ) : null}
                    {managerDetails.phone ? (
                      <a
                        href={`tel:${managerDetails.phone.replace(/\s+/g, "")}`}
                        className="flex min-w-0 items-center gap-1.5 text-xs tabular-nums text-muted-foreground no-underline hover:text-primary hover:underline"
                      >
                        <PhoneIcon className="size-3 shrink-0 text-primary" />
                        <span className="truncate">{managerDetails.phone}</span>
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Contact details not available.</p>
                )}
              </div>
            </div>
          </DashboardSection>
        </motion.div>

        <motion.div variants={dashboardItem}>
          <DashboardSection title="Employment" barClassName="bg-primary">
            <div className="min-w-0 space-y-1.5 px-3 py-3">
              <div className="flex flex-col gap-1.5">
                <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                  <Globe2 className="mt-0.5 size-3 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="text-muted-foreground/80">Nationality · </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      <NationalityFlag code={nationalityCode} className="mt-px" />
                      <span>{nationalityLabel}</span>
                    </span>
                  </span>
                </p>
                <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                  <User className="mt-0.5 size-3 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="text-muted-foreground/80">Gender · </span>
                    <span className="font-medium text-foreground">{genderLabel}</span>
                  </span>
                </p>
                <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                  <Briefcase className="mt-0.5 size-3 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="text-muted-foreground/80">Employment type · </span>
                    <span className="font-medium text-foreground">{employmentTypeLabel}</span>
                  </span>
                </p>
                <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                  <CalendarIcon className="mt-0.5 size-3 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="text-muted-foreground/80">Probation end · </span>
                    <span className="font-medium text-foreground">{probationEndDateLabel}</span>
                  </span>
                </p>
                {showFiscalConfirmation ? (
                  <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                    <UserCheck className="mt-0.5 size-3 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="text-muted-foreground/80">FY confirmation · </span>
                      <span className="font-medium text-foreground">{fiscalConfirmationLabel}</span>
                    </span>
                  </p>
                ) : null}
                <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                  {isEmailVerified ? (
                    <MailCheck className="mt-0.5 size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <MailWarning className="mt-0.5 size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className="min-w-0">
                    <span className="text-muted-foreground/80">Email · </span>
                    {isEmailVerified ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">Verified</span>
                    ) : (
                      <>
                        <span className="font-medium text-amber-700 dark:text-amber-400">Not verified</span>
                        <Link
                          href={settingsEmailVerifyHref}
                          className="ml-1.5 font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Verify in settings
                        </Link>
                      </>
                    )}
                  </span>
                </p>
                <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                  {isTwoFactorEnabled ? (
                    <ShieldCheck className="mt-0.5 size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ShieldAlert className="mt-0.5 size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className="min-w-0">
                    <span className="text-muted-foreground/80">2FA · </span>
                    {isTwoFactorEnabled ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">Enabled</span>
                    ) : (
                      <>
                        <span className="font-medium text-amber-700 dark:text-amber-400">Not enabled</span>
                        <Link
                          href={settingsTwoFactorHref}
                          className="ml-1.5 font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Enable in settings
                        </Link>
                      </>
                    )}
                  </span>
                </p>
              </div>
            </div>
          </DashboardSection>
        </motion.div>
      </div>
    </motion.div>
  )
}

function dateIsoFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return localDateIso(parsed)
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : NaN
    if (Number.isFinite(ms)) return localDateIso(new Date(ms))
  }
  return null
}

function isPunchOnLocalDate(row: AdminRecord, dateIso: string): boolean {
  // Prefer actual punch timestamp (Android uses punched_at).
  const stampKeys = [
    "punched_at",
    "punchedAt",
    "punch_time",
    "punchTime",
    "punch_at",
    "punchAt",
    "event_time",
    "eventTime",
    "timestamp",
    "datetime",
    "attendance_date",
    "attendanceDate",
    "work_date",
    "workDate",
    "date",
    "created_at",
    "createdAt",
  ] as const

  let sawDate = false
  for (const key of stampKeys) {
    if (!(key in row) || row[key] == null || row[key] === "") continue
    const iso = dateIsoFromUnknown(row[key])
    if (!iso) continue
    sawDate = true
    if (iso === dateIso) return true
  }
  // No usable date on the row → keep only if caller already date-filtered the request.
  return !sawDate
}

export function EmployeeHomeDashboard() {
  const [dashboardData, setDashboardData] = React.useState<EmployeeDashboardData | null>(null)
  const [attendanceToday, setAttendanceToday] = React.useState<AdminRecord | null>(null)
  const [attendancePunchesToday, setAttendancePunchesToday] = React.useState<AdminRecord[]>([])
  const [leaveBalances, setLeaveBalances] = React.useState<AdminRecord[]>([])
  const [leaveTypes, setLeaveTypes] = React.useState<AdminRecord[]>([])
  const [payslips, setPayslips] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isAdmin, setIsAdmin] = React.useState(true)
  const [showOnboardingDialog, setShowOnboardingDialog] = React.useState(false)
  const [completedOnboardingItems, setCompletedOnboardingItems] = React.useState<string[]>([])
  const [accessToken, setAccessToken] = React.useState<string>("")
  const [fillingItemKey, setFillingItemKey] = React.useState<string | null>(null)
  const [formValues, setFormValues] = React.useState<Record<string, string>>({})
  const [documentUploadFile, setDocumentUploadFile] = React.useState<File | null>(null)
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
        const todayIso = localDateIso()
        const [dash, attToday, punchesResult, leaves, types, payrollRows] = await Promise.all([
          loadEmployeeDashboardOverview(accessToken),
          getMyAttendanceToday(accessToken).catch(() => null),
          // Match Android: load recent punches, then filter to today client-side.
          // dateFrom/dateTo are still sent as a server hint when supported.
          listMyAttendancePunches(accessToken, {
            page: 1,
            limit: 50,
            sortBy: "created_at",
            sortOrder: "DESC",
            dateFrom: todayIso,
            dateTo: todayIso,
          })
            .then((r) => r.rows || [])
            .catch(() =>
              // Fallback without date filters if the API rejects unknown query params.
              listMyAttendancePunches(accessToken, {
                page: 1,
                limit: 50,
                sortBy: "created_at",
                sortOrder: "DESC",
              })
                .then((r) => r.rows || [])
                .catch(() => [] as AdminRecord[])
            ),
          listMyLeaveBalances(accessToken, { limit: 8 }).then((r) => r.rows || []).catch(() => []),
          listLeaveTypes(accessToken, { page: 1, limit: 100 })
            .then((r) => r.rows || [])
            .catch(() => []),
          listMyPayslips(accessToken).catch(() => []),
        ])

        if (cancelled) return

        const validDash = isEmployeeDashboardData(dash) ? dash : null
        const allPunches = punchesResult as AdminRecord[]
        let punchesToday = allPunches.filter((row) => isPunchOnLocalDate(row, todayIso))
        // If date filter wiped everything but we still got rows, retry client filter on full set.
        if (punchesToday.length === 0 && allPunches.length > 0) {
          punchesToday = allPunches.filter((row) => isPunchOnLocalDate(row, todayIso))
        }
        setDashboardData(validDash)
        setAttendanceToday((attToday as AdminRecord) || null)
        setAttendancePunchesToday(punchesToday)
        setLeaveBalances(leaves as AdminRecord[])
        setLeaveTypes(types as AdminRecord[])
        setPayslips(payrollRows as AdminRecord[])

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
  }, [fillingItemKey, showOnboardingDialog, publicCountryStates.length, publicLocationLoading])

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
    setDocumentUploadFile(null)
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
    setDocumentUploadFile(null)
    setFormError(null)
  }

  const cancelFilling = () => {
    setFillingItemKey(null)
    setFormValues({})
    setDocumentUploadFile(null)
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
          if (!documentUploadFile) {
            setFormError("Choose a file before saving this document.")
            return
          }
          payload.file = await fileToBase64UploadDto(documentUploadFile)
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
                : [{
                    ...payload,
                    ...(fillingItemKey === "documents" && documentUploadFile
                      ? {
                          original_file_name: documentUploadFile.name,
                          mime_type: documentUploadFile.type || "application/octet-stream",
                          file_size: String(documentUploadFile.size),
                        }
                      : {}),
                    _onboard: true,
                  }],
          } as DashboardEmployee,
        }
      })

      const remainingAfter = pendingItems.filter((p) => p.key !== fillingItemKey).length

      // Clear form UI
      setFillingItemKey(null)
      setFormValues({})
      setDocumentUploadFile(null)
      setFormError(null)

      // Background refresh to pull authoritative arrays from server (non-blocking)
      if (remainingAfter > 0) {
        loadEmployeeDashboardOverview(accessToken).then((fresh) => {
          if (isEmployeeDashboardData(fresh)) {
            setDashboardData(fresh)
          }
        }).catch(() => {})
      }

      // If this was the last pending, optionally activate + close
      if (remainingAfter <= 0) {
        try {
          await patchEmployeeStatus(accessToken, empId, {
            employment_status: "active",
            effective_date: new Date().toISOString().slice(0, 10),
          })
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
        attendancePunchesToday={attendancePunchesToday}
        leaveBalances={leaveBalances}
        leaveTypes={leaveTypes}
        payslips={payslips}
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
                            ) : field.type === "file" ? (
                              <div className="mt-1 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                                <Input
                                  type="file"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null
                                    setDocumentUploadFile(file)
                                    updateFormValue(field.name, file?.name ?? "")
                                  }}
                                  className="h-auto border-0 px-0 py-0 shadow-none focus-visible:ring-0"
                                  required={!!field.required}
                                />
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                  {documentUploadFile ? `Selected: ${documentUploadFile.name}` : "Choose the attachment to upload with this document."}
                                </p>
                              </div>
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
