"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { DateInput } from "@/components/ui/date-input"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  CalendarIcon, CalendarClockIcon, ClockIcon, MailIcon, PhoneIcon, Sparkles, Users, MapPin, User, CreditCard, Landmark, Target, BadgeCheck, Building2, GraduationCap, Briefcase, Award, FileText, CheckCircle, UserCheck, Globe2, ShieldCheck, ShieldAlert, MailCheck, MailWarning, LogIn, LogOut, Network, Wifi } from "lucide-react";
import { countries as countryCodes } from "country-flag-icons"

import { CountryFlag } from "@/components/country-flag"
import { useFluentToastResultState } from "@/components/ui/use-fluent-toast-state"


import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { FluentSelect } from "@/components/ui/fluent-select"
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
  getMyProfile,
  getCurrentEmployee,
  getMyAttendanceToday,
  listMyPayslips,
  listMyAttendancePunches,
  listMyLeaveBalances,
  listLeaveTypes,
  getMyDashboardCardStyle,
  updateMyDashboardCardStyle,
  type DashboardCardStyle,
  createEmployeeSectionItem,
  createEmployeeDocument,
  createMyEmployeeSectionItem,
  createMyEmployeeDocument,
  fileToBase64UploadDto,
  patchEmployeeStatus,
  listMyOnboardingRequests,
  submitMyOnboardingDetails,
  createAttendanceMobilePunchCheckIn,
  createAttendanceMobilePunchCheckOut,
  type AdminRecord,
  type EmployeeProfileSection,
} from "@/lib/admin-api"
import { hasDashboardAdminIdentity } from "@/lib/dashboard-identity"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useDashboardIdentity } from "@/components/dashboard/dashboard-identity"
import { useForbiddenPrefixes } from "@/hooks/use-forbidden-route-guard"
import { canSeeDashboardPage } from "@/lib/forbidden-routes"
import { useMyProfilePhoto } from "@/lib/my-profile-photo"
import {
  clearStoredSession,
  readStoredSessionTokens,
  redirectToLogin,
} from "@/lib/session-client"
import { cn } from "@/lib/utils"
import { pageBleedClass, heroPanelClass } from "@/components/dashboard/talent-visuals"
import { ROUTES } from "@/utils/constants"
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
    attendance_today?: string
    attendance_history?: string
    attendance_schedule?: string
    leave_requests?: string
    leave_balances?: string
  } | null
  attendance_overview?: {
    recent_history?: unknown[]
    stats_last_30_days?: {
      from_date?: string
      to_date?: string
      total_days?: number
      present_days?: number
      absent_days?: number
      half_days?: number
      leave_days?: number
      incomplete_days?: number
      late_days?: number
      overtime_days?: number
    } | null
  } | null
  schedule_preview?: {
    from_date?: string
    to_date?: string
    days?: unknown[]
  } | null
  leave?: {
    current_fiscal_year?: string
    counts?: Record<string, unknown> | null
    balances?: unknown[]
    recent_requests?: unknown[]
    upcoming_approved_leave?: unknown[]
  } | null
  pending_profile_change?: {
    has_pending_profile_change?: boolean
    pending_request_count?: number
  } | null
  [key: string]: unknown
}

type EmployeeDashboardViewProps = {
  dashboardData: EmployeeDashboardData
  token: string
  attendanceToday?: AdminRecord | null
  attendancePunchesToday?: AdminRecord[]
  leaveBalances?: AdminRecord[]
  leaveBalanceTotals?: Record<string, number>
  leaveTypes?: AdminRecord[]
  payslips?: AdminRecord[]
  onAttendanceChanged?: () => Promise<void>
}

type LeaveBalanceSummary = {
  typeName: string
  available: string
  used?: string
  allocated?: string
}

// `optional` sections can be skipped: they are listed but never block completion.
const REQUIRED_ONBOARDING_ITEMS: Array<{ key: string; label: string; description: string; icon: React.ReactNode; optional?: boolean }> = [
  { key: "contacts", label: "Contacts", description: "Add phone, email and primary contact info", icon: <Users className="h-5 w-5" /> },
  { key: "addresses", label: "Addresses", description: "Your home and work addresses", icon: <MapPin className="h-5 w-5" /> },
  { key: "relatives", label: "Relatives", description: "Emergency contacts and family members", icon: <User className="h-5 w-5" /> },
  { key: "identifications", label: "Identifications", description: "ID, passport and official documents", icon: <CreditCard className="h-5 w-5" /> },
  { key: "bank_accounts", label: "Bank Accounts", description: "Salary and payment account details", icon: <Landmark className="h-5 w-5" /> },
  { key: "departments", label: "Departments", description: "Your assigned department information", icon: <Building2 className="h-5 w-5" /> },
  { key: "academic_qualifications", label: "Academic Qualifications", description: "Degrees, diplomas and education records", icon: <GraduationCap className="h-5 w-5" /> },
  { key: "professional_qualifications", label: "Professional Qualifications", description: "Certifications and professional licenses", icon: <Award className="h-5 w-5" />, optional: true },
  { key: "experience_details", label: "Experience Details", description: "Previous jobs and work history", icon: <Briefcase className="h-5 w-5" />, optional: true },
  { key: "documents", label: "Documents", description: "Supporting files and attachments", icon: <FileText className="h-5 w-5" /> },
]

const PROFILE_SECTION_ALIASES: Record<string, string[]> = {
  contacts: ["contacts", "contact_details", "contactDetails"],
  addresses: ["addresses", "address_details", "addressDetails"],
  relatives: ["relatives", "next_of_kin", "nextOfKin"],
  identifications: ["identifications", "identification_documents", "identificationDocuments"],
  bank_accounts: ["bank_accounts", "bankAccounts"],
  departments: ["departments", "department_assignments", "departmentAssignments"],
  academic_qualifications: ["academic_qualifications", "academicQualifications"],
  professional_qualifications: ["professional_qualifications", "professionalQualifications"],
  experience_details: ["experience_details", "experienceDetails"],
  documents: ["documents", "employee_documents", "employeeDocuments"],
}

const EMPLOYEE_OWNED_PROFILE_KEYS = new Set(
  REQUIRED_ONBOARDING_ITEMS.map((item) => item.key).filter((key) => key !== "departments"),
)

// Sections whose certificate file is mandatory and verification link optional.
const CERTIFICATE_SECTIONS: Record<string, { urlField: string; documentSection: string; titlePrefix: string; titleField: string }> = {
  academic_qualifications: {
    urlField: "academic_certificate_document_url",
    documentSection: "education",
    titlePrefix: "Academic certificate",
    titleField: "degree_or_certificate",
  },
  professional_qualifications: {
    urlField: "professional_certificate_document_url",
    documentSection: "professional",
    titlePrefix: "Professional certificate",
    titleField: "programme_name",
  },
}

function employeeSectionHasItems(employee: Record<string, unknown> | null | undefined, key: string) {
  if (!employee) return false
  const aliases = PROFILE_SECTION_ALIASES[key] ?? [key]
  return aliases.some((alias) => {
    const value = employee[alias]
    return Array.isArray(value) && value.length > 0
  })
}

function mergeEmployeeSectionRecords(
  base: Record<string, unknown>,
  extra: Record<string, unknown> | null,
) {
  if (!extra) return base
  const next = { ...base }
  for (const aliases of Object.values(PROFILE_SECTION_ALIASES)) {
    for (const alias of aliases) {
      const extraValue = extra[alias]
      const current = next[alias]
      if (
        Array.isArray(extraValue) &&
        extraValue.length > 0 &&
        (!Array.isArray(current) || current.length === 0)
      ) {
        next[alias] = extraValue
      }
    }
  }
  return next
}

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
  type?: "text" | "email" | "tel" | "url" | "date" | "select" | "file"
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
    { name: "identification_type", label: "ID Type", type: "select", options: ["national_id", "passport", "tax_id", "social_security", "driver_license", "work_permit", "other"], defaultValue: "national_id", required: true },
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
    { name: "country_of_residence", label: "Country of Residence", placeholder: "Tanzania", required: true },
    { name: "institution_name", label: "Institution / School", placeholder: "University of Example", required: true },
    { name: "degree_or_certificate", label: "Degree / Certificate", placeholder: "Bachelor of Science", required: true },
    { name: "field_of_study", label: "Field of Study", placeholder: "Computer Science" },
    { name: "education_level", label: "Level", type: "select", options: ["Certificate", "Diploma", "Bachelor's Degree", "Master's Degree", "Other"], defaultValue: "Bachelor's Degree" },
    { name: "start_date", label: "Start Date", type: "date" },
    { name: "end_date", label: "End Date / Graduation", type: "date" },
    { name: "academic_certificate_document_url", label: "Verification Link (HTTPS, optional)", type: "url", placeholder: "https://…" },
    // Mandatory, enforced by hasValidCertificateProof (file inputs aren't tracked in formValues).
    { name: "academic_certificate_file", label: "Academic Certificate Attachment *", type: "file" },
  ],
  professional_qualifications: [
    { name: "country_of_residence", label: "Country of Residence", placeholder: "Tanzania", required: true },
    { name: "institution_name", label: "Institution / Training Provider", placeholder: "Example Institute", required: true },
    { name: "programme_name", label: "Program / Certification Name", placeholder: "AWS Solutions Architect", required: true },
    { name: "issuing_organization", label: "Issuing Organization", placeholder: "Amazon Web Services", required: true },
    { name: "issue_date", label: "Issue Date", type: "date", required: true },
    { name: "expiry_date", label: "Expiry Date (if any)", type: "date" },
    { name: "professional_certificate_document_url", label: "Verification Link (HTTPS, optional)", type: "url", placeholder: "https://…" },
    // Mandatory, enforced by hasValidCertificateProof (file inputs aren't tracked in formValues).
    { name: "professional_certificate_file", label: "Certificate Attachment *", type: "file" },
  ],
  experience_details: [
    { name: "company_name", label: "Company Name", placeholder: "Acme Corp", required: true },
    { name: "job_title", label: "Job Title / Role", placeholder: "Software Engineer", required: true },
    { name: "responsibilities_description", label: "Key Responsibilities", placeholder: "Built and maintained...", required: true },
    { name: "start_date", label: "Start Date", type: "date", required: true },
    { name: "end_date", label: "End Date (leave blank if current)", type: "date" },
  ],
  documents: [
    { name: "title", label: "Document Title", placeholder: "Passport Copy", required: true },
    { name: "type", label: "Type", type: "select", options: ["certificate", "cv", "offer_letter", "contract", "id", "other"], defaultValue: "other" },
    { name: "onboarding_section", label: "Related onboarding section", type: "select", options: ["personal", "assignment", "contacts", "family", "identification", "banking", "education", "experience"], defaultValue: "personal", required: true },
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
  // A blank end date means the employee still works there.
  if (key === "experience_details") payload.currently_working = !payload.end_date
  if (key === "documents" && typeof payload.onboarding_section === "string") {
    payload.metadata = { onboarding_section: payload.onboarding_section }
    delete payload.onboarding_section
  }
  return payload
}

function isEmployeeDashboardData(value: unknown): value is EmployeeDashboardData {
  const record = asRecord(value)
  const user = asRecord(record?.user)
  const employee = asRecord(record?.employee)
  return Boolean(user && employee)
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch (errorObject) {
    return errorObject instanceof Error
      ? `Unable to serialize dashboard payload: ${errorObject.message}`
      : "Unable to serialize dashboard payload."
  }
}

function formatDashboardPayloadError(value: unknown) {
  if (value == null) {
    return "The dashboard API did not return any data. Please refresh or sign in again."
  }

  const record = asRecord(value)
  if (!record) {
    return `Dashboard payload is not an object.\n\n${safeJsonStringify(value)}`
  }

  const missingSections: string[] = []
  if (!asRecord(record.user)) missingSections.push("user")
  if (!asRecord(record.employee)) missingSections.push("employee")

  const topLevelKeys = Object.keys(record)
  const summary = [
    "Dashboard payload is incomplete.",
    missingSections.length > 0
      ? `Missing required sections: ${missingSections.join(", ")}.`
      : "Required sections exist, but the payload still failed validation.",
    topLevelKeys.length > 0
      ? `Top-level keys received: ${topLevelKeys.join(", ")}.`
      : "The payload did not include any top-level keys.",
  ].join("\n")

  return `${summary}\n\n${safeJsonStringify(value)}`
}

function readErrorStatus(errorObject: unknown) {
  if (!errorObject || typeof errorObject !== "object") return null
  if (!("status" in errorObject)) return null
  const status = Number(errorObject.status)
  return Number.isFinite(status) ? status : null
}

function isSessionEndedError(errorObject: unknown) {
  const status = readErrorStatus(errorObject)
  const payload = errorObject && typeof errorObject === "object" && "payload" in errorObject
    ? asRecord(errorObject.payload)
    : null
  const code = typeof payload?.code === "string" ? payload.code : ""
  const message = errorObject instanceof Error ? errorObject.message : ""
  return (
    status === 401 ||
    code === "SESSION_REPLACED" ||
    /session ended|signed in on another device/i.test(message)
  )
}

function isPasswordResetRequiredMessage(message: string) {
  return /temporary password|must change.+password|change.+password before continuing|before you can continue/i.test(
    message,
  )
}

async function composeDashboardFromProfile(token: string) {
  const [profile, employee] = await Promise.all([
    getMyProfile(token).catch(() => null),
    getCurrentEmployee(token).catch(() => null),
  ])
  const user = asRecord(profile)
  const employeeRecord = asRecord(employee)
  if (!user || !employeeRecord) {
    return null
  }
  return {
    user,
    employee: employeeRecord,
  }
}

async function loadEmployeeDashboardOverview(token: string) {
  const errors: unknown[] = []
  let lastPayload: unknown = null

  try {
    const dedicatedDashboard = await getEmployeeDashboard(token)
    lastPayload = dedicatedDashboard
    if (isEmployeeDashboardData(dedicatedDashboard)) {
      return dedicatedDashboard
    }
  } catch (errorObject) {
    if (isSessionEndedError(errorObject)) {
      throw errorObject
    }
    errors.push(errorObject)
  }

  try {
    const fallbackDashboard = await getMyDashboard(token)
    lastPayload = fallbackDashboard
    if (isEmployeeDashboardData(fallbackDashboard)) {
      return fallbackDashboard
    }
  } catch (errorObject) {
    if (isSessionEndedError(errorObject)) {
      throw errorObject
    }
    errors.push(errorObject)
  }

  try {
    const composedDashboard = await composeDashboardFromProfile(token)
    lastPayload = composedDashboard ?? lastPayload
    if (isEmployeeDashboardData(composedDashboard)) {
      return composedDashboard
    }
  } catch (errorObject) {
    if (isSessionEndedError(errorObject)) {
      throw errorObject
    }
    errors.push(errorObject)
  }

  if (errors.length > 0 && lastPayload == null) {
    throw errors[errors.length - 1]
  }
  return lastPayload
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

function dashboardPathFromApiLink(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback
  const trimmed = value.trim()
  if (trimmed.startsWith("/dashboard/")) return trimmed
  if (trimmed.startsWith("/me/")) return `/dashboard${trimmed}`
  if (trimmed.startsWith("/")) return `/dashboard${trimmed}`
  return fallback
}

function resolvePersonalAttendanceHref(value: unknown, fallback: string) {
  const path = dashboardPathFromApiLink(value, fallback)
  if (
    path === "/dashboard/attendance/today" ||
    path === "/dashboard/attendance/punch-action" ||
    path === "/dashboard/attendance/attendance-history" ||
    path === "/dashboard/attendance/schedule-preview" ||
    path === "/dashboard/attendance/corrections"
  ) {
    return path
  }
  if (path.includes("history")) return "/dashboard/attendance/attendance-history"
  if (path.includes("schedule")) return "/dashboard/attendance/schedule-preview"
  if (path.includes("correction")) return "/dashboard/attendance/corrections"
  return fallback
}

function formatCompactDate(value?: string | null) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(parsed)
}

function formatWeekdayLabel(value?: string | null) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
  }).format(parsed)
}

function formatClockLabel(value?: string | null) {
  if (!value?.trim()) return ""
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{2}):(\d{2})/)
  if (match) {
    return `${match[1]}:${match[2]}`
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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

function NationalityFlag({
  code,
  className,
}: {
  code: string | null
  className?: string
}) {
  return <CountryFlag code={code} className={cn("h-3.5 w-5 border-border/70 shadow-sm", className)} />
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

function readLeaveTotalsValue(totals: Record<string, number> | undefined, keys: string[]) {
  if (!totals) return null
  for (const key of keys) {
    const value = totals[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
  }
  return null
}

function flattenDashboardLeaveBalances(leavePayload: unknown): AdminRecord[] {
  const leaveRecord = asRecord(leavePayload)
  if (!leaveRecord || !Array.isArray(leaveRecord.balances)) return []

  const rows: AdminRecord[] = []
  for (const entry of leaveRecord.balances) {
    const groupRecord = asRecord(entry)
    const balances = Array.isArray(groupRecord?.leave_balances)
      ? groupRecord.leave_balances
      : Array.isArray(groupRecord?.leaveBalances)
        ? groupRecord.leaveBalances
        : []

    for (const row of balances) {
      const record = asRecord(row)
      if (record) {
        rows.push(record)
      }
    }
  }

  return rows
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

function countVisibleLeaveTypes(
  leaveTypes: AdminRecord[] | undefined,
  employee?: AdminRecord | DashboardEmployee | null
): number {
  if (!Array.isArray(leaveTypes) || leaveTypes.length === 0) return 0

  const employeeGender = readEmployeeGender(employee)
  const visibleKeys = new Set<string>()

  for (const row of leaveTypes) {
    const leaveTypeRecord = asRecord(row.leave_type) ?? asRecord(row.leaveType) ?? row
    const leaveTypeId =
      readNumericish(row, ["id", "leave_type_id", "leaveTypeId", "type_id", "typeId"]) ??
      readNumericish(leaveTypeRecord, ["id", "leave_type_id", "leaveTypeId"])
    const typeName =
      readString(row, [
        "name",
        "display_name",
        "displayName",
        "leave_type_name",
        "leaveTypeName",
        "type_name",
        "typeName",
        "title",
        "code",
      ]) ||
      readString(leaveTypeRecord, [
        "name",
        "display_name",
        "displayName",
        "leave_type_name",
        "leaveTypeName",
        "type_name",
        "typeName",
        "title",
        "code",
      ]) ||
      ""

    const restriction = resolveLeaveTypeGenderRestriction(typeName || "Leave", leaveTypeRecord, row)
    if (!isLeaveTypeVisibleForGender(restriction, employeeGender)) continue

    if (leaveTypeId !== null) {
      visibleKeys.add(`id:${leaveTypeId}`)
      continue
    }

    const normalizedName = typeName.trim().toLowerCase()
    if (normalizedName) {
      visibleKeys.add(`name:${normalizedName}`)
    }
  }

  return visibleKeys.size
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
      className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-white/10 px-3 py-2 text-white no-underline shadow-[0_10px_24px_-18px_rgba(0,0,0,0.55)] transition-all duration-300 hover:bg-white/16 hover:no-underline focus:no-underline active:no-underline"
      style={{ textDecoration: "none" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-white/12 transition-transform duration-300 group-hover:translate-x-1"
        style={{ clipPath: "polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -left-3 bottom-0 h-7 w-16 bg-white/10 transition-transform duration-300 group-hover:-translate-x-1"
        style={{ clipPath: "polygon(0% 100%, 24% 12%, 100% 0%, 76% 100%)" }}
      />
      <span
        className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/14 text-white no-underline backdrop-blur-sm group-hover:no-underline [&_svg]:size-3.5"
        style={{ textDecoration: "none" }}
      >
        {icon}
      </span>
      <span
        className="relative z-10 min-w-0 flex-1 truncate text-xs font-semibold leading-tight no-underline group-hover:no-underline"
        style={{ textDecoration: "none" }}
      >
        {title}
      </span>
      <span
        className="relative z-10 text-[10px] font-medium text-white/75 no-underline transition-transform group-hover:translate-x-0.5 group-hover:no-underline"
        style={{ textDecoration: "none" }}
      >
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

const dashboardCardPalettes = [
  { id: "ocean", label: "Ocean", color: "#0877B9" },
  { id: "forest", label: "Forest", color: "#08785C" },
  { id: "plum", label: "Plum", color: "#6845A8" },
  { id: "coral", label: "Coral", color: "#B84F3E" },
  { id: "midnight", label: "Midnight", color: "#334155" },
  { id: "berry", label: "Berry", color: "#A33F69" },
  { id: "neutral", label: "Neutral", color: "#64748B" },
  { id: "white", label: "Dynamic", color: "#FFFFFF" },
] as const

const dashboardCardArtworks = [
  { id: "none", label: "None" },
  { id: "orbit", label: "Orbit" },
  { id: "waves", label: "Waves" },
  { id: "confetti", label: "Confetti" },
  { id: "arches", label: "Arches" },
  { id: "sprigs", label: "Sprigs" },
] as const

type DashboardCardArtworkId = (typeof dashboardCardArtworks)[number]["id"]
type DashboardCardLook = DashboardCardStyle

const defaultDashboardCardLook: DashboardCardLook = {
  palette: "ocean",
  artwork: "waves",
}

function normalizeDashboardCardLook(value: unknown): DashboardCardLook | null {
  if (!value || typeof value !== "object") return null
  const parsed = value as Partial<DashboardCardLook>
  const palette = dashboardCardPalettes.find((item) => item.id === parsed.palette)
  const artwork = dashboardCardArtworks.find((item) => item.id === parsed.artwork)
  return palette && artwork ? { palette: palette.id, artwork: artwork.id } : null
}

function CardDoodleArtwork({
  pattern,
  className,
}: {
  pattern: DashboardCardArtworkId
  className?: string
}) {
  if (pattern === "none") return null
  return (
    <svg
      viewBox="0 0 420 220"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {pattern === "orbit" ? (
        <g>
          <circle cx="320" cy="110" r="66" />
          <circle cx="320" cy="110" r="43" />
          <circle cx="320" cy="110" r="19" />
          <path d="M235 160c46-72 105-112 178-118M248 56c51 25 95 68 130 130" />
          <circle cx="250" cy="57" r="5" fill="currentColor" />
          <circle cx="402" cy="42" r="5" fill="currentColor" />
          <circle cx="250" cy="57" r="3" fill="#38BDF8" stroke="none" />
          <circle cx="402" cy="42" r="3" fill="#FBBF24" stroke="none" />
        </g>
      ) : null}
      {pattern === "waves" ? (
        <g>
          <path d="M205 58c32-25 63 25 96 0s64 25 97 0 64 25 97 0" />
          <path d="M180 91c32-25 63 25 96 0s64 25 97 0 64 25 97 0" />
          <path d="M205 124c32-25 63 25 96 0s64 25 97 0 64 25 97 0" />
          <path d="M180 157c32-25 63 25 96 0s64 25 97 0 64 25 97 0" />
        </g>
      ) : null}
      {pattern === "confetti" ? (
        <g>
          <circle cx="268" cy="56" r="7" /><circle cx="337" cy="42" r="4" />
          <circle cx="389" cy="89" r="8" /><circle cx="300" cy="120" r="5" />
          <circle cx="365" cy="157" r="6" /><circle cx="245" cy="171" r="4" />
          <path d="m322 78 14-15m43 55 14 14m-99 7-12 17m-19-91 9 9m81 73 9-11" />
          <path d="m280 96 7-7m88-57 8 10m-33 150 7-7" />
          <circle cx="268" cy="56" r="3" fill="#F9A8D4" stroke="none" />
          <circle cx="389" cy="89" r="3" fill="#FCD34D" stroke="none" />
          <circle cx="365" cy="157" r="3" fill="#7DD3FC" stroke="none" />
        </g>
      ) : null}
      {pattern === "arches" ? (
        <g>
          <path d="M230 190V116a45 45 0 0 1 90 0v74" />
          <path d="M265 190v-58a28 28 0 0 1 56 0v58" />
          <path d="M320 190V98a57 57 0 0 1 114 0v92" />
          <path d="M354 190v-71a23 23 0 0 1 46 0v71" />
        </g>
      ) : null}
      {pattern === "sprigs" ? (
        <g>
          <path d="M300 205c12-47 36-84 73-119m-49 49c-22-2-37-14-43-35 21-2 38 9 43 35Zm22-24c-2-23 8-41 29-51 4 21-6 40-29 51Zm-10 34c-20-6-32-22-33-44 21 3 34 17 33 44Zm32-37c2-22 15-37 37-42 0 22-13 38-37 42Z" />
          <path d="M220 206c9-33 25-59 50-80m-35 32c-16-2-26-11-30-26 15-1 26 8 30 26Zm16-17c0-16 7-28 22-35 2 15-5 27-22 35Z" />
        </g>
      ) : null}
    </svg>
  )
}

type BrowserNetworkInformation = {
  type?: string
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

type NavigatorWithConnection = Navigator & {
  connection?: BrowserNetworkInformation
  mozConnection?: BrowserNetworkInformation
  webkitConnection?: BrowserNetworkInformation
}

type NetworkCheckResult = {
  online: boolean
  transport: string
  effectiveType: string | null
  downlink: number | null
  rtt: number | null
  saveData: boolean | null
  location: {
    latitude: number
    longitude: number
    accuracy: number
  } | null
  locationMessage: string | null
}

type BrowserLocationResult = Pick<
  NetworkCheckResult,
  "location" | "locationMessage"
>

function getBrowserConnection(): BrowserNetworkInformation | undefined {
  const browserNavigator = navigator as NavigatorWithConnection
  return (
    browserNavigator.connection ??
    browserNavigator.mozConnection ??
    browserNavigator.webkitConnection
  )
}

function connectionTypeLabel(type?: string): string {
  switch (type?.toLowerCase()) {
    case "wifi":
      return "Wi-Fi"
    case "ethernet":
      return "Ethernet"
    case "cellular":
      return "Mobile data"
    case "bluetooth":
      return "Bluetooth"
    case "wimax":
      return "WiMAX"
    case "none":
      return "No connection"
    case "other":
    case "unknown":
    case undefined:
      return "Not shared by this browser"
    default:
      return type || "Not shared by this browser"
  }
}

function locationErrorMessage(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission was not allowed. You can enable it in your browser settings."
    case error.POSITION_UNAVAILABLE:
      return "Your current location could not be found."
    case error.TIMEOUT:
      return "The location check took too long. Please try again."
    default:
      return "Your location could not be checked."
  }
}

function requestBrowserLocation(): Promise<BrowserLocationResult> {
  return new Promise((resolve) => {
    if (!window.isSecureContext) {
      resolve({
        location: null,
        locationMessage:
          "To check in with your location, open HRMS using your organization’s secure link.",
      })
      return
    }

    if (!navigator.geolocation) {
      resolve({
        location: null,
        locationMessage: "Location checking is not supported by this browser.",
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          locationMessage: null,
        })
      },
      (error) => {
        resolve({
          location: null,
          locationMessage: locationErrorMessage(error),
        })
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 10_000,
      },
    )
  })
}

function NetworkCheckButton() {
  const [open, setOpen] = React.useState(false)
  const [checking, setChecking] = React.useState(false)
  const [result, setResult] = React.useState<NetworkCheckResult | null>(null)

  const runCheck = React.useCallback(async () => {
    setOpen(true)
    setChecking(true)

    const connection = getBrowserConnection()
    const locationResult = await requestBrowserLocation()

    setResult({
      online: navigator.onLine,
      transport: connectionTypeLabel(connection?.type),
      effectiveType: connection?.effectiveType?.toUpperCase() ?? null,
      downlink:
        typeof connection?.downlink === "number" ? connection.downlink : null,
      rtt: typeof connection?.rtt === "number" ? connection.rtt : null,
      saveData:
        typeof connection?.saveData === "boolean" ? connection.saveData : null,
      ...locationResult,
    })
    setChecking(false)
  }, [])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 px-2.5 text-xs"
        onClick={() => void runCheck()}
      >
        <Network className="size-3.5" aria-hidden="true" />
        Network check
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup from="center" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="size-5 text-primary" aria-hidden="true" />
              Network and location check
            </DialogTitle>
            <DialogDescription>
              See the connection details your browser can safely share.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-5 pb-2 sm:px-6" aria-live="polite">
            {checking ? (
              <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
                <FluentLoadingIndicator className="size-6 animate-spin text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-foreground">Checking your connection</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Allow location access if your browser asks.
                  </p>
                </div>
              </div>
            ) : result ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Internet
                    </p>
                    <p className={cn("mt-1 text-sm font-semibold", result.online ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                      {result.online ? "Connected" : "Offline"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Connection type
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{result.transport}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Connection details
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {result.effectiveType ? `${result.effectiveType} estimated quality` : "Quality details are not shared by this browser."}
                  </p>
                  {result.downlink !== null || result.rtt !== null || result.saveData !== null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        result.downlink !== null ? `About ${result.downlink} Mbps` : null,
                        result.rtt !== null ? `${result.rtt} ms response` : null,
                        result.saveData === true ? "Data saver is on" : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Location</p>
                      {result.location ? (
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {result.location.latitude.toFixed(5)}, {result.location.longitude.toFixed(5)} · accurate to about {Math.round(result.location.accuracy)} m
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">{result.locationMessage}</p>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Browsers do not reveal the Wi-Fi name. Attendance uses your permitted location, while the server must verify an approved office network from the request itself.
                </p>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={() => void runCheck()} disabled={checking}>
              {checking ? "Checking…" : "Check again"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  )
}

function AttendancePunchActions({
  employeeId,
  canCheckIn,
  canCheckOut,
  onAttendanceChanged,
}: {
  employeeId: number
  canCheckIn: boolean
  canCheckOut: boolean
  onAttendanceChanged?: () => Promise<void>
}) {
  const [busyAction, setBusyAction] = React.useState<"in" | "out" | null>(null)
  const [message, setMessage] = React.useState<{
    tone: "success" | "error"
    text: string
  } | null>(null)

  useFluentToastResultState(message, setMessage)

  const submitPunch = React.useCallback(
    async (action: "in" | "out") => {
      setMessage(null)
      setBusyAction(action)

      try {
        if (!navigator.onLine) {
          throw new Error("You appear to be offline. Connect to the office network and try again.")
        }

        const token = readStoredSessionTokens().accessToken
        if (!token) {
          throw new Error("Your session has expired. Please sign in again.")
        }

        const locationResult = await requestBrowserLocation()
        if (!locationResult.location) {
          throw new Error(
            locationResult.locationMessage ||
              "Location permission is required to record attendance.",
          )
        }

        const connection = getBrowserConnection()
        const payload: AdminRecord = {
          clientRequestId: crypto.randomUUID(),
          employeeId,
          latitude: locationResult.location.latitude,
          longitude: locationResult.location.longitude,
          accuracyMeters: locationResult.location.accuracy,
          deviceIdentifier: `web-${navigator.platform || "browser"}`,
          deviceInfo: {
            platform: "web",
            networkType: connection?.type,
          },
        }

        if (action === "in") {
          await createAttendanceMobilePunchCheckIn(token, payload)
        } else {
          await createAttendanceMobilePunchCheckOut(token, payload)
        }

        setMessage({
          tone: "success",
          text: action === "in" ? "Check-in recorded." : "Check-out recorded.",
        })
        await onAttendanceChanged?.().catch(() => undefined)
      } catch (errorObject) {
        setMessage({
          tone: "error",
          text:
            errorObject instanceof Error
              ? errorObject.message
              : `Unable to check ${action === "in" ? "in" : "out"}.`,
        })
      } finally {
        setBusyAction(null)
      }
    },
    [employeeId, onAttendanceChanged],
  )

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={!canCheckIn || busyAction !== null}
          onClick={() => void submitPunch("in")}
        >
          {busyAction === "in" ? (
            <FluentLoadingIndicator className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <LogIn className="size-3.5" aria-hidden="true" />
          )}
          {busyAction === "in" ? "Checking in…" : "Check in"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={!canCheckOut || busyAction !== null}
          onClick={() => void submitPunch("out")}
        >
          {busyAction === "out" ? (
            <FluentLoadingIndicator className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="size-3.5" aria-hidden="true" />
          )}
          {busyAction === "out" ? "Checking out…" : "Check out"}
        </Button>
        <NetworkCheckButton />
      </div>
    </div>
  )
}

export function EmployeeDashboardView({
  dashboardData,
  token,
  attendanceToday,
  attendancePunchesToday,
  leaveBalances,
  leaveBalanceTotals,
  leaveTypes,
  payslips,
  onAttendanceChanged,
}: EmployeeDashboardViewProps) {
  const { url: myProfilePhotoUrl } = useMyProfilePhoto()
  const actor = useDashboardActor()
  const dashboardIdentity = useDashboardIdentity()
  useForbiddenPrefixes()
  const [dashboardCardLook, setDashboardCardLook] = React.useState<DashboardCardLook>(defaultDashboardCardLook)
  const [dashboardCardLookSaveState, setDashboardCardLookSaveState] = React.useState<"idle" | "saving" | "error">("idle")
  const dashboardCardLookKey = dashboardData?.user?.id
    ? `hrms.dashboard.card-look.v1:${dashboardData.user.id}`
    : null

  React.useEffect(() => {
    if (!dashboardCardLookKey || !token) return
    let active = true
    setDashboardCardLookSaveState("idle")
    void getMyDashboardCardStyle(token)
      .then((style) => {
        if (active) setDashboardCardLook(normalizeDashboardCardLook(style) ?? defaultDashboardCardLook)
      })
      .catch(() => {
        if (active) setDashboardCardLook(defaultDashboardCardLook)
      })
    return () => {
      active = false
    }
  }, [dashboardCardLookKey, token])

  const saveDashboardCardLook = React.useCallback(async (next: DashboardCardLook) => {
    setDashboardCardLook(next)
    setDashboardCardLookSaveState("saving")
    try {
      const saved = await updateMyDashboardCardStyle(token, next)
      setDashboardCardLook(normalizeDashboardCardLook(saved) ?? next)
      setDashboardCardLookSaveState("idle")
    } catch {
      setDashboardCardLookSaveState("error")
    }
  }, [token])

  if (!isEmployeeDashboardData(dashboardData)) {
    return (
      <Card className="rounded-2xl border border-destructive/30 bg-card">
        <CardContent className="py-10">
          <div className="space-y-3">
            <p className="text-sm font-medium text-destructive">Dashboard payload error</p>
            <pre className="overflow-x-auto rounded-xl bg-muted/50 p-3 text-xs text-foreground whitespace-pre-wrap">
              {formatDashboardPayloadError(dashboardData)}
            </pre>
          </div>
        </CardContent>
      </Card>
    )
  }

  const activeDashboardCardPalette =
    dashboardCardPalettes.find((palette) => palette.id === dashboardCardLook.palette) ??
    dashboardCardPalettes[0]
  const isDynamicDashboardCard = dashboardCardLook.palette === "white"
  const dashboardCardBackground = isDynamicDashboardCard
    ? "var(--background)"
    : activeDashboardCardPalette.color
  const fullName = `${dashboardData.user.first_name} ${dashboardData.user.last_name}`.trim()
  const preferredName =
    dashboardData.employee.preferred_name?.trim() || dashboardData.user.first_name
  const linksRecord = asRecord(dashboardData.links)
  const dashboardRoot = asRecord(dashboardData)
  const dashboardLeave = asRecord(dashboardRoot?.leave)
  const dashboardAttendanceOverview = asRecord(dashboardRoot?.attendance_overview)
  const dashboardSchedulePreview = asRecord(dashboardRoot?.schedule_preview)
  const dashboardPendingProfileChange = asRecord(dashboardRoot?.pending_profile_change)
  const profileHref = dashboardPathFromApiLink(linksRecord?.profile, "/dashboard/me/profile")
  const leaveBalancesHref = dashboardPathFromApiLink(linksRecord?.leave_balances, "/dashboard/me/leave/balances")
  const leaveRequestHref = dashboardPathFromApiLink(linksRecord?.leave_requests, "/dashboard/me/leave/requests")
  const attendanceHref = resolvePersonalAttendanceHref(
    linksRecord?.attendance_today,
    "/dashboard/attendance/today",
  )
  const attendanceHistoryHref = resolvePersonalAttendanceHref(
    linksRecord?.attendance_history,
    "/dashboard/attendance/attendance-history",
  )
  const attendanceScheduleHref = resolvePersonalAttendanceHref(
    linksRecord?.attendance_schedule,
    "/dashboard/attendance/schedule-preview",
  )
  const payrollHref = "/dashboard/me/finance/payroll"

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
  const hasCheckedIn = att.checkIn !== "—"
  const hasCheckedOut = att.checkOut !== "—"
  const canCheckIn =
    !hasCheckedIn && (dashboardData.action_flags?.can_check_in ?? true)
  const canCheckOut =
    hasCheckedIn &&
    !hasCheckedOut &&
    (dashboardData.action_flags?.can_check_out ?? true)
  const dashboardLeaveBalances = flattenDashboardLeaveBalances(dashboardLeave)
  const resolvedLeaveBalances =
    Array.isArray(leaveBalances) && leaveBalances.length > 0 ? leaveBalances : dashboardLeaveBalances
  const leaveSummaries = extractLeaveSummaries(
    resolvedLeaveBalances,
    leaveTypes,
    asRecord(dashboardData.employee)
  )
  const leaveAvailableTotal = readLeaveTotalsValue(leaveBalanceTotals, [
    "available_days",
    "available",
    "remaining_days",
    "remaining",
  ])
  const totalLeaveDays = leaveSummaries.reduce((sum, item) => {
    const n = Number(String(item.available).replace(/[^\d.-]/g, ""))
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  const leaveLeftValue =
    leaveAvailableTotal !== null
      ? formatBalanceNumber(leaveAvailableTotal)
      : leaveSummaries.length > 0
        ? formatBalanceNumber(totalLeaveDays)
        : "—"
  const leaveTypeCount =
    leaveSummaries.length > 0
      ? new Set(leaveSummaries.map((item) => item.typeName.trim().toLowerCase()).filter(Boolean)).size
      : countVisibleLeaveTypes(leaveTypes, asRecord(dashboardData.employee))
  const leaveCountsRecord = asRecord(dashboardLeave?.counts)
  const leaveFiscalYear = readString(dashboardLeave, ["current_fiscal_year", "currentFiscalYear"])
  const pendingLeaveRequests =
    readNumericish(leaveCountsRecord, [
      "pending_total",
      "pendingTotal",
      "submitted",
      "in_review",
      "pending_department_manager",
      "pending_hr",
      "returned_for_correction",
    ]) ?? 0
  const approvedLeaveRequests = readNumericish(leaveCountsRecord, ["approved"]) ?? 0
  const attendanceStatsRecord = asRecord(dashboardAttendanceOverview?.stats_last_30_days)
  const attendanceFromDate = readString(attendanceStatsRecord, ["from_date", "fromDate"])
  const attendanceToDate = readString(attendanceStatsRecord, ["to_date", "toDate"])
  const attendanceTotalDays = readNumericish(attendanceStatsRecord, ["total_days", "totalDays"]) ?? 0
  const attendancePresentDays = readNumericish(attendanceStatsRecord, ["present_days", "presentDays"]) ?? 0
  const attendanceAbsentDays = readNumericish(attendanceStatsRecord, ["absent_days", "absentDays"]) ?? 0
  const attendanceLeaveDays = readNumericish(attendanceStatsRecord, ["leave_days", "leaveDays"]) ?? 0
  const attendanceLateDays = readNumericish(attendanceStatsRecord, ["late_days", "lateDays"]) ?? 0
  const attendancePresentRate =
    attendanceTotalDays > 0 ? Math.round((attendancePresentDays / attendanceTotalDays) * 100) : null
  const scheduleDays = Array.isArray(dashboardSchedulePreview?.days)
    ? dashboardSchedulePreview.days
        .map((item) => asRecord(item))
        .filter((item): item is AdminRecord => Boolean(item))
    : []
  const hasPendingProfileChange =
    readBooleanValue(dashboardPendingProfileChange, [
      "has_pending_profile_change",
      "hasPendingProfileChange",
    ]) ?? false
  const pendingProfileChangeCount =
    readNumericish(dashboardPendingProfileChange, [
      "pending_request_count",
      "pendingRequestCount",
    ]) ?? 0
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
      value: leaveLeftValue,
      className: "bg-background",
      valueClassName: leaveLeftValue === "—" ? "text-muted-foreground" : "text-primary",
    },
    {
      key: "types",
      label: "Leave types",
      value: String(leaveTypeCount),
      className: "bg-background",
      valueClassName: leaveTypeCount > 0 ? "text-primary" : "text-muted-foreground",
    },
  ]

  return (
    <motion.div
      className="space-y-4"
      variants={dashboardStagger}
      initial="hidden"
      animate="show"
    >
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
          <AttendancePunchActions
            employeeId={dashboardData.employee.id}
            canCheckIn={canCheckIn}
            canCheckOut={canCheckOut}
            onAttendanceChanged={onAttendanceChanged}
          />
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
        className={cn(heroPanelClass, pageBleedClass, "overflow-visible")}
        style={{ backgroundColor: dashboardCardBackground }}
      >
        <CardDoodleArtwork
          pattern={dashboardCardLook.artwork}
          className={cn("absolute inset-0 h-full w-full", isDynamicDashboardCard ? "text-foreground/15" : "text-white/20")}
        />
        <div className="relative z-10 space-y-4">
          <div className="flex justify-end">
            <details className="group relative z-50">
              <summary className={cn("inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden", isDynamicDashboardCard ? "border-border bg-muted/60 text-foreground hover:bg-muted focus-visible:ring-ring" : "border-white/30 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/70")}>
                <Sparkles className="size-3.5" aria-hidden="true" />
                Card artwork
              </summary>
              <div className="absolute right-0 top-full z-30 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
                <div>
                  <p className="text-xs font-semibold">Doodle structure</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Choose a pattern for your card.</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {dashboardCardArtworks.map((artwork) => {
                      const selected = dashboardCardLook.artwork === artwork.id
                      return (
                        <button
                          key={artwork.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => void saveDashboardCardLook({ ...dashboardCardLook, artwork: artwork.id })}
                          className={cn(
                            "overflow-hidden rounded-lg border text-left text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/50",
                          )}
                        >
                          <span
                            className="relative block h-10 overflow-hidden"
                            style={{ backgroundColor: dashboardCardBackground }}
                          >
                            <CardDoodleArtwork pattern={artwork.id} className={cn("absolute inset-0 h-full w-full", isDynamicDashboardCard ? "text-foreground/50" : "text-white/70")} />
                          </span>
                          <span className="block px-1.5 py-1">{artwork.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-xs font-semibold">Color</p>
                  <div className="mt-2 grid grid-cols-6 gap-2">
                    {dashboardCardPalettes.map((palette) => {
                      const selected = dashboardCardLook.palette === palette.id
                      return (
                        <button
                          key={palette.id}
                          type="button"
                          aria-label={`${palette.label} card color`}
                          aria-pressed={selected}
                          title={palette.label}
                          onClick={() => void saveDashboardCardLook({ ...dashboardCardLook, palette: palette.id })}
                          className={cn(
                            "relative size-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            selected ? "border-foreground ring-2 ring-primary/30" : "border-border hover:scale-110",
                          )}
                          style={palette.id === "white"
                            ? { backgroundImage: "linear-gradient(135deg, #fff 0 50%, #111 50% 100%)" }
                            : { backgroundColor: palette.color }}
                        >
                          {palette.id === "white" ? (
                            <span aria-hidden="true" className="pointer-events-none absolute inset-[5px] flex overflow-hidden rounded-full">
                              <span className="flex flex-1 items-center justify-center bg-white"><span className="size-1.5 rounded-full bg-black" /></span>
                              <span className="flex flex-1 items-center justify-center bg-black"><span className="size-1.5 rounded-full bg-white" /></span>
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">
                    {dashboardCardLookSaveState === "saving"
                      ? "Syncing to mobile…"
                      : dashboardCardLookSaveState === "error"
                        ? "Could not sync. Check your connection and try again."
                        : `${activeDashboardCardPalette.label} · shared across web and mobile`}
                  </p>
                </div>
              </div>
            </details>
          </div>
          <div className="flex min-w-0 items-start gap-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.12 }}
            >
              <Avatar className={cn("size-14 shrink-0 ring-2 md:size-16", isDynamicDashboardCard ? "ring-border" : "ring-white/30")}>
                {employeeProfilePhotoUrl ? (
                  <AvatarImage src={employeeProfilePhotoUrl} alt={fullName} />
                ) : null}
                <AvatarFallback className={cn("text-lg font-semibold", isDynamicDashboardCard ? "bg-muted text-foreground" : "bg-white/20 text-white")}>
                  {initialsFor(fullName)}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={cn("text-xl font-semibold tracking-tight md:text-2xl", isDynamicDashboardCard ? "text-foreground" : "text-white")}>
                  {fullName}
                </h2>
                <span className={cn("text-[11px] font-semibold capitalize", isDynamicDashboardCard ? "text-muted-foreground" : "text-white/85")}>
                  {employmentStatus}
                </span>
              </div>
              {dashboardIdentity.rolesLabel ? (
                <p className={cn("text-[10px] font-semibold uppercase leading-4 tracking-[0.15em]", isDynamicDashboardCard ? "text-muted-foreground" : "text-white/75")}>
                  {dashboardIdentity.rolesLabel}
                </p>
              ) : null}
              <Link href={profileHref} className="inline-block no-underline hover:no-underline">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn("h-7 px-2.5 text-xs", isDynamicDashboardCard ? "border-border bg-muted/60 text-foreground hover:bg-muted hover:text-foreground" : "border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white")}
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
                <p className={cn("text-[9px] font-semibold uppercase tracking-wide", isDynamicDashboardCard ? "text-muted-foreground" : "text-white/70")}>
                  {field.label}
                </p>
                <p className={cn("truncate text-xs font-semibold", isDynamicDashboardCard ? "text-foreground" : "text-white")}>{field.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: attendanceHref, title: "My attendance", icon: <ClockIcon /> },
              { href: leaveRequestHref, title: "Request leave", icon: <CalendarClockIcon /> },
              { href: payrollHref, title: "My payroll", icon: <Landmark /> },
              { href: "/dashboard/me/performance/overview", title: "My performance", icon: <Target /> },
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

      {hasPendingProfileChange || pendingProfileChangeCount > 0 ? (
        <motion.div variants={dashboardItem}>
          <DashboardSection
            title="Profile update pending"
            subtitle="Your submitted profile changes are waiting for review"
            action={
              <Link
                href={profileHref}
                className="shrink-0 text-xs font-medium text-primary no-underline hover:underline"
              >
                Open profile
              </Link>
            }
            barClassName="bg-amber-500"
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <BadgeCheck className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {pendingProfileChangeCount} pending change request{pendingProfileChangeCount === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-muted-foreground">
                  We&apos;ll reflect approved updates here once they are reviewed.
                </p>
              </div>
            </div>
          </DashboardSection>
        </motion.div>
      ) : null}

      {/* Leave balances — full width */}
      <motion.div variants={dashboardItem}>
        <DashboardSection
          title="Leave balances"
          subtitle={leaveFiscalYear ? `Available days by type · FY ${leaveFiscalYear}` : "Available days by type"}
          action={
            <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
              {pendingLeaveRequests > 0 ? (
                <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {pendingLeaveRequests} pending
                </span>
              ) : null}
              {approvedLeaveRequests > 0 ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {approvedLeaveRequests} approved
                </span>
              ) : null}
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
              {leaveFiscalYear
                ? `No leave balance information is available for FY ${leaveFiscalYear} yet.`
                : "No leave balance information available yet."}
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

      <div className="grid gap-3 lg:grid-cols-2">
        <motion.div variants={dashboardItem}>
          <DashboardSection
            title="Attendance trend"
            subtitle={
              attendanceFromDate && attendanceToDate
                ? `${formatCompactDate(attendanceFromDate)} - ${formatCompactDate(attendanceToDate)}`
                : "Last 30 days"
            }
            action={
              <Link
                href={attendanceHistoryHref}
                className="shrink-0 text-xs font-medium text-primary no-underline hover:underline"
              >
                View history
              </Link>
            }
            barClassName="bg-primary"
          >
            {attendanceTotalDays > 0 ? (
              <div className="grid gap-3 px-3 py-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Tracked days",
                    value: String(attendanceTotalDays),
                    tone: "text-foreground",
                  },
                  {
                    label: "Present",
                    value:
                      attendancePresentRate !== null
                        ? `${attendancePresentDays} (${attendancePresentRate}%)`
                        : String(attendancePresentDays),
                    tone: "text-emerald-700 dark:text-emerald-400",
                  },
                  {
                    label: "Absent",
                    value: String(attendanceAbsentDays),
                    tone: "text-rose-700 dark:text-rose-400",
                  },
                  {
                    label: "Leave / Late",
                    value: `${attendanceLeaveDays} / ${attendanceLateDays}`,
                    tone: "text-amber-700 dark:text-amber-400",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-muted/40 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className={cn("mt-1 text-sm font-semibold", item.tone)}>{item.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                Attendance trend data will appear once your recent attendance is available.
              </div>
            )}
          </DashboardSection>
        </motion.div>

        <motion.div variants={dashboardItem}>
          <DashboardSection
            title="This week"
            subtitle="Upcoming schedule preview"
            action={
              <Link
                href={attendanceScheduleHref}
                className="shrink-0 text-xs font-medium text-primary no-underline hover:underline"
              >
                Open schedule
              </Link>
            }
            barClassName="bg-primary"
          >
            {scheduleDays.length > 0 ? (
              <div className="flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
                {scheduleDays.slice(0, 7).map((day) => {
                  const dayDate = readString(day, ["date"])
                  const holidayRecord = asRecord(day.holiday)
                  const shiftRecord = asRecord(day.shift)
                  const isOffDay =
                    readBooleanValue(day, ["is_off_day", "isOffDay"]) ?? false
                  const holidayName = readString(holidayRecord, ["name"]) || "Public holiday"
                  const shiftName = readString(shiftRecord, ["name"]) || "Work day"
                  const shiftStart = formatClockLabel(readString(shiftRecord, ["start_time", "startTime"]))
                  const shiftEnd = formatClockLabel(readString(shiftRecord, ["end_time", "endTime"]))
                  const detail = holidayRecord
                    ? holidayName
                    : isOffDay
                      ? "Off day"
                      : shiftStart && shiftEnd
                        ? `${shiftStart} - ${shiftEnd}`
                        : "Scheduled"

                  return (
                    <div
                      key={dayDate || shiftName}
                      className="flex min-w-[7.5rem] flex-1 flex-col rounded-xl bg-muted/40 px-3 py-3"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {formatWeekdayLabel(dayDate)}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatCompactDate(dayDate)}
                      </p>
                      <p
                        className={cn(
                          "mt-2 text-xs font-medium",
                          holidayRecord
                            ? "text-amber-700 dark:text-amber-400"
                            : isOffDay
                              ? "text-muted-foreground"
                              : "text-primary"
                        )}
                      >
                        {holidayRecord ? holidayName : isOffDay ? "Off day" : shiftName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                Your upcoming schedule preview is not available yet.
              </div>
            )}
          </DashboardSection>
        </motion.div>
      </div>

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
  const [leaveBalanceTotals, setLeaveBalanceTotals] = React.useState<Record<string, number> | undefined>(undefined)
  const [leaveTypes, setLeaveTypes] = React.useState<AdminRecord[]>([])
  const [payslips, setPayslips] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isAdmin, setIsAdmin] = React.useState(true)
  const [showOnboardingDialog, setShowOnboardingDialog] = React.useState(false)
  const [completedOnboardingItems, setCompletedOnboardingItems] = React.useState<string[]>([])
  const [onboardingDetailsSubmitted, setOnboardingDetailsSubmitted] = React.useState(false)
  const [unavailableOptionalItems, setUnavailableOptionalItems] = React.useState<string[]>([])
  const [onboardingSubmissionError, setOnboardingSubmissionError] = React.useState<string | null>(null)
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

    const accessToken = readStoredSessionTokens().accessToken
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
        const [dash, attToday, punchesResult, leaveBalancesResult, types, payrollRows, currentEmployee, myProfile] = await Promise.all([
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
          listMyLeaveBalances(accessToken, { limit: 8 })
            .then((result) => ({
              rows: (result.rows || []) as AdminRecord[],
              totals: result.totals,
            }))
            .catch(() => ({
              rows: [] as AdminRecord[],
              totals: undefined as Record<string, number> | undefined,
            })),
          listLeaveTypes(accessToken, { page: 1, limit: 100 })
            .then((r) => r.rows || [])
            .catch(() => []),
          listMyPayslips(accessToken).catch(() => []),
          getCurrentEmployee(accessToken).catch(() => null),
          getMyProfile(accessToken).catch(() => null),
        ])

        if (cancelled) return

        const validDash = isEmployeeDashboardData(dash) ? dash : null
        const allPunches = punchesResult as AdminRecord[]
        let punchesToday = allPunches.filter((row) => isPunchOnLocalDate(row, todayIso))
        // If date filter wiped everything but we still got rows, retry client filter on full set.
        if (punchesToday.length === 0 && allPunches.length > 0) {
          punchesToday = allPunches.filter((row) => isPunchOnLocalDate(row, todayIso))
        }
        const mergedEmployee = validDash
          ? mergeEmployeeSectionRecords(
              mergeEmployeeSectionRecords(
                asRecord(validDash.employee) ?? {},
                asRecord(currentEmployee),
              ),
              asRecord(myProfile),
            )
          : null
        const resolvedDash = validDash && mergedEmployee
          ? {
              ...validDash,
              employee: {
                ...validDash.employee,
                ...mergedEmployee,
              },
            }
          : validDash
        setDashboardData(resolvedDash)
        setAttendanceToday((attToday as AdminRecord) || null)
        setAttendancePunchesToday(punchesToday)
        setLeaveBalances(leaveBalancesResult.rows)
        setLeaveBalanceTotals(leaveBalancesResult.totals)
        setLeaveTypes(types as AdminRecord[])
        setPayslips(payrollRows as AdminRecord[])

        if (!resolvedDash) {
          setError(formatDashboardPayloadError(dash))
        } else {
          const dismissedKey = `onboarding_dialog_dismissed_${resolvedDash.user?.id || "current"}`
          const hasPendingProfileItems = REQUIRED_ONBOARDING_ITEMS.some(
            (item) =>
              EMPLOYEE_OWNED_PROFILE_KEYS.has(item.key) &&
              !item.optional &&
              !employeeSectionHasItems(mergedEmployee, item.key),
          )
          if (hasPendingProfileItems && !sessionStorage.getItem(dismissedKey)) {
            setShowOnboardingDialog(true)
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load your dashboard."
          if (isPasswordResetRequiredMessage(message)) {
            setError(null)
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("hrms:force-password-reset"))
            }
            return
          }
          if (isSessionEndedError(err)) {
            setError(
              err instanceof Error && err.message.trim()
                ? err.message
                : "Your session has expired. Please sign in again.",
            )
            clearStoredSession()
            redirectToLogin()
            return
          }
          setError(message)
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
    const userId = dashboardData?.user?.id
    if (!userId || typeof window === "undefined") return
    let cancelled = false
    try {
      const skipped = JSON.parse(window.localStorage.getItem(`onboarding_unavailable_optional_${userId}`) || "[]")
      setUnavailableOptionalItems(Array.isArray(skipped) ? skipped.filter((item): item is string => typeof item === "string") : [])
      setOnboardingDetailsSubmitted(window.localStorage.getItem(`onboarding_details_submitted_${userId}`) === "true")
    } catch {
      setUnavailableOptionalItems([])
      setOnboardingDetailsSubmitted(false)
    }
    if (accessToken) {
      void listMyOnboardingRequests(accessToken).then((requests) => {
        if (cancelled) return
        const openRequest = requests.find((request) => {
          const status = String(request.status ?? request.request_status ?? "").toLowerCase()
          return status !== "completed" && status !== "cancelled" && status !== "activating"
        })
        const metadata = asRecord(openRequest?.metadata)
        const review = asRecord(openRequest?.employee_details_review) ?? asRecord(metadata?.employee_details_review)
        const reviewStatus = String(review?.status ?? "").toLowerCase()
        const submitted = ["submitted", "in_review", "approved"].includes(reviewStatus)
        setOnboardingDetailsSubmitted(submitted)
        if (submitted) window.localStorage.setItem(`onboarding_details_submitted_${userId}`, "true")
        else window.localStorage.removeItem(`onboarding_details_submitted_${userId}`)
      }).catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [accessToken, dashboardData?.user?.id])

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

  const refreshAttendance = React.useCallback(async () => {
    const token = accessToken || readStoredSessionTokens().accessToken
    if (!token) return

    const todayIso = localDateIso()
    const [dashboardResult, todayResult, punchesResult] = await Promise.all([
      loadEmployeeDashboardOverview(token).catch(() => null),
      getMyAttendanceToday(token).catch(() => null),
      listMyAttendancePunches(token, {
        page: 1,
        limit: 50,
        sortBy: "created_at",
        sortOrder: "DESC",
        dateFrom: todayIso,
        dateTo: todayIso,
      })
        .then((result) => result.rows || [])
        .catch(() => [] as AdminRecord[]),
    ])

    const punchesToday = (punchesResult as AdminRecord[]).filter((row) =>
      isPunchOnLocalDate(row, todayIso),
    )
    setAttendanceToday((todayResult as AdminRecord | null) || null)
    setAttendancePunchesToday(punchesToday)

    if (isEmployeeDashboardData(dashboardResult)) {
      setDashboardData((current) =>
        current
          ? {
              ...current,
              action_flags: dashboardResult.action_flags,
              attendance_overview: dashboardResult.attendance_overview,
              generated_at: dashboardResult.generated_at,
            }
          : dashboardResult,
      )
    }
  }, [accessToken])

  if (isAdmin) {
    return null
  }

  if (loading) {
    return (
      <Card className="rounded-2xl border border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-10">
          <FluentLoadingIndicator size="large" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    const sessionEnded = /session has expired|session ended|signed in on another device|sign in again/i.test(error)
    return (
      <Card className="rounded-2xl border border-destructive/30 bg-card">
        <CardContent className="py-10">
          <div className="space-y-3">
            <p className="text-sm font-medium text-destructive">Dashboard error</p>
            <pre className="overflow-x-auto rounded-xl bg-muted/50 p-3 text-xs text-foreground whitespace-pre-wrap">
              {error}
            </pre>
            {sessionEnded ? (
              <Button type="button" onClick={() => window.location.assign(ROUTES.login)}>
                Sign in again
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!dashboardData) {
    return null
  }

  const unfilledItems = REQUIRED_ONBOARDING_ITEMS.filter((item) => {
    if (!EMPLOYEE_OWNED_PROFILE_KEYS.has(item.key)) return false
    const emp = dashboardData.employee as Record<string, unknown>
    return !employeeSectionHasItems(emp, item.key) &&
      !completedOnboardingItems.includes(item.key) &&
      !unavailableOptionalItems.includes(item.key)
  })
  // Only required sections block completion; optional ones can be skipped.
  const pendingItems = unfilledItems.filter((item) => !item.optional)
  const optionalUnfilledItems = unfilledItems.filter((item) => item.optional)
  const ownedProfileItemCount = REQUIRED_ONBOARDING_ITEMS.filter((item) =>
    EMPLOYEE_OWNED_PROFILE_KEYS.has(item.key) && !item.optional,
  ).length
  const completedProfileItemCount = Math.max(
    0,
    ownedProfileItemCount - pendingItems.length,
  )
  const profileCompletionPercent =
    ownedProfileItemCount > 0
      ? Math.round((completedProfileItemCount / ownedProfileItemCount) * 100)
      : 0

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

  const certificateSection = fillingItemKey ? CERTIFICATE_SECTIONS[fillingItemKey] ?? null : null
  const certificateUrl = certificateSection ? formValues[certificateSection.urlField]?.trim() ?? "" : ""
  const hasValidCertificateProof = (() => {
    if (!certificateSection) return true
    if (!documentUploadFile) return false
    if (!certificateUrl) return true
    try {
      return new URL(certificateUrl).protocol === "https:"
    } catch {
      return false
    }
  })()

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
    if (unavailableOptionalItems.includes(key)) {
      const nextUnavailable = unavailableOptionalItems.filter((item) => item !== key)
      setUnavailableOptionalItems(nextUnavailable)
      if (dashboardData?.user?.id) {
        window.localStorage.setItem(`onboarding_unavailable_optional_${dashboardData.user.id}`, JSON.stringify(nextUnavailable))
      }
    }
    setOnboardingSubmissionError(null)
    setOnboardingDetailsSubmitted(false)
    if (dashboardData?.user?.id) {
      window.localStorage.removeItem(`onboarding_details_submitted_${dashboardData.user.id}`)
    }
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

  const markOptionalUnavailable = (key: string) => {
    const nextUnavailable = Array.from(new Set([...unavailableOptionalItems, key]))
    setUnavailableOptionalItems(nextUnavailable)
    setOnboardingSubmissionError(null)
    if (dashboardData?.user?.id) {
      window.localStorage.setItem(`onboarding_unavailable_optional_${dashboardData.user.id}`, JSON.stringify(nextUnavailable))
    }
  }

  const submitCompletedOnboardingDetails = async () => {
    if (!dashboardData || !accessToken) return
    setOnboardingSubmissionError(null)
    try {
      const requests = await listMyOnboardingRequests(accessToken)
      const openRequest = requests.find((request) => {
        const status = String(request.status ?? request.request_status ?? "").toLowerCase()
        return status !== "completed" && status !== "cancelled" && status !== "activating"
      })
      const requestId = openRequest ? Number(openRequest.id ?? openRequest.request_id) : NaN
      if (!Number.isFinite(requestId) || requestId <= 0) {
        throw new Error("No open onboarding request was found for this employee. Contact HR for help.")
      }
      const notProvidedItems = unavailableOptionalItems.filter((key) =>
        key === "professional_qualifications" || key === "experience_details",
      )
      await submitMyOnboardingDetails(accessToken, requestId, {
        not_provided_items: notProvidedItems,
      })
      setOnboardingDetailsSubmitted(true)
      window.localStorage.setItem(`onboarding_details_submitted_${dashboardData.user.id}`, "true")
    } catch (errorObject) {
      setOnboardingSubmissionError(
        errorObject instanceof Error ? errorObject.message : "Could not submit your details to HR. Please try again.",
      )
    }
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

    if (certificateSection && certificateUrl) {
      try {
        if (new URL(certificateUrl).protocol !== "https:") {
          setFormError("The verification link must use https://, or leave it empty.")
          return
        }
      } catch {
        setFormError("Enter a valid HTTPS verification link, or leave it empty.")
        return
      }
    }
    if (certificateSection && !documentUploadFile) {
      setFormError("Attach your certificate file.")
      return
    }

    // For departments or empty schema we just optimistically complete
    const isNoApi = !apiSection || getFormSchema(fillingItemKey).length === 0

    // Onboarding employees save through the self-scoped /employees/me/* routes,
    // which resolve the employee from the token and need no HR permissions.
    const isSelfOnboarding = !isAdmin && dashboardData.employee.employment_status === "onboarding"
    const saveDocument = (data: AdminRecord) =>
      isSelfOnboarding ? createMyEmployeeDocument(accessToken, data) : createEmployeeDocument(accessToken, empId, data)
    const saveSectionItem = (section: EmployeeProfileSection, data: AdminRecord) =>
      isSelfOnboarding
        ? createMyEmployeeSectionItem(accessToken, section, data)
        : createEmployeeSectionItem(accessToken, empId, section, data)

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
          await saveDocument(payload)
        } else if (certificateSection) {
          if (documentUploadFile) {
            await saveDocument({
              title: `${certificateSection.titlePrefix} - ${String(formValues[certificateSection.titleField] || "Qualification")}`,
              type: "certificate",
              metadata: { onboarding_section: certificateSection.documentSection },
              classification: "CONFIDENTIAL",
              notes: `Uploaded with ${currentFillingItem?.label.toLowerCase() ?? "qualification"} profile completion.`,
              file: await fileToBase64UploadDto(documentUploadFile),
            })
          }
          if (certificateUrl) {
            payload[certificateSection.urlField] = certificateUrl
          } else {
            delete payload[certificateSection.urlField]
          }
          await saveSectionItem(apiSection as EmployeeProfileSection, payload)
        } else {
          await saveSectionItem(apiSection as EmployeeProfileSection, payload)
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

      // If this was the last pending, close. Only HR may activate the employee;
      // a self-onboarding employee stays "onboarding" until HR reviews.
      if (remainingAfter <= 0 && !isSelfOnboarding) {
        if (!isSelfOnboarding && dashboardData.employee.employment_status === "onboarding") {
          try {
            await patchEmployeeStatus(accessToken, empId, {
              employment_status: "active",
              effective_date: new Date().toISOString().slice(0, 10),
            })
          } catch {
            // non-fatal; backend may auto-handle or admin may do later
          }
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
  const showMissingProfileBanner =
    !isAdmin && !showOnboardingDialog && pendingItems.length > 0

  return (
    <>
      {showMissingProfileBanner ? (
        <div className="mb-4 flex items-center justify-between gap-3 border border-amber-200 bg-amber-50/80 px-4 py-2.5 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="text-sm text-amber-900 dark:text-amber-200">
            {isStillOnboarding
              ? "Your employee profile is still in onboarding."
              : `Your profile is missing ${pendingItems.map((item) => item.label.toLowerCase()).join(", ")}.`}
          </div>
          <Button
            size="sm"
            onClick={() => {
              const dismissedKey = `onboarding_dialog_dismissed_${dashboardData.user?.id || "current"}`
              try { sessionStorage.removeItem(dismissedKey) } catch {}
              setShowOnboardingDialog(true)
            }}
          >
            {isStillOnboarding ? "Finish onboarding" : "Fill details"}
          </Button>
        </div>
      ) : null}

      <EmployeeDashboardView
        dashboardData={dashboardData}
        token={accessToken}
        attendanceToday={attendanceToday}
        attendancePunchesToday={attendancePunchesToday}
        leaveBalances={leaveBalances}
        leaveBalanceTotals={leaveBalanceTotals}
        leaveTypes={leaveTypes}
        payslips={payslips}
        onAttendanceChanged={refreshAttendance}
      />

      <Dialog open={showOnboardingDialog} onOpenChange={(open) => { if (!open) handleCloseOnboardingDialog() }}>
        <DialogPopup
          from="bottom"
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-0.75rem)] w-[calc(100%-0.75rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-xl border border-border bg-background p-0 shadow-xl sm:max-h-[min(88dvh,46rem)] sm:w-[calc(100%-2rem)]"
        >
            <DialogHeader className="m-0 shrink-0 border-b border-border px-3 py-3 sm:px-5 sm:py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                  <UserCheck className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                    {isStillOnboarding ? "Complete your onboarding" : "Complete your profile"}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 max-w-2xl text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    {isStillOnboarding
                      ? "Add the remaining details so HR can finish setting up your employee account."
                      : "Some details were not filled during registration or onboarding. You can complete them now, or continue and we will remind you the next time you sign in."}
                  </DialogDescription>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {pendingItems.length} remaining
                </span>
              </div>

              <div className="mt-2.5 rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] text-foreground">
                  <span className="font-semibold">Profile progress</span>
                  <span className="font-semibold tabular-nums text-muted-foreground">
                    {completedProfileItemCount} of {ownedProfileItemCount} complete · {profileCompletionPercent}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${profileCompletionPercent}%` }}
                  />
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-3.5">
              {pendingItems.length === 0 && !fillingItemKey ? (
                <div className="py-5 text-center">
                  {isStillOnboarding ? (
                    <MailCheck className="mx-auto mb-2 size-8 text-primary" />
                  ) : (
                    <CheckCircle className="mx-auto mb-2 size-8 text-emerald-600" />
                  )}
                  <p className="text-sm font-semibold">
                    {isStillOnboarding
                      ? onboardingDetailsSubmitted
                        ? "Your details have been submitted to HR."
                        : "Complete or mark optional details unavailable before submitting to HR."
                      : "All done! Your profile is complete."}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {isStillOnboarding
                      ? onboardingDetailsSubmitted
                        ? "Your account remains in onboarding until HR reviews your details and completes activation."
                        : "If you do not have professional qualifications or previous work experience, mark those sections unavailable."
                      : "Thanks for keeping your records up to date."}
                  </p>
                  {onboardingSubmissionError ? (
                    <p role="alert" className="mx-auto mt-2 max-w-lg text-xs text-destructive">
                      {onboardingSubmissionError}
                    </p>
                  ) : null}
                  {optionalUnfilledItems.length > 0 ? (
                    <div className="mx-auto mt-5 max-w-md text-left">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Optional details — add them if applicable, or mark them unavailable:
                      </p>
                      <div className="grid gap-2">
                        {optionalUnfilledItems.map((item) => (
                          <div
                            key={item.key}
                            className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm"
                          >
                            <span className="text-primary">{item.icon}</span>
                            <span className="flex-1 font-medium text-foreground">{item.label}</span>
                            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => startFilling(item.key)}>
                              Add details
                            </Button>
                            {isStillOnboarding ? (
                              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => markOptionalUnavailable(item.key)}>
                                I don’t have these details
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {isStillOnboarding && !onboardingDetailsSubmitted ? (
                    <div className="mt-4">
                      <Button
                        type="button"
                        size="sm"
                        disabled={optionalUnfilledItems.length > 0}
                        onClick={() => void submitCompletedOnboardingDetails()}
                      >
                        Submit details to HR
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : fillingItemKey && currentFillingItem ? (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <div>
                    <div className="min-w-0 p-3 sm:p-4">
                      <div className="mb-3 flex items-start justify-between gap-2 border-b border-border pb-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                            {currentFillingItem.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">Profile details</p>
                            <div className="text-sm font-semibold tracking-tight text-foreground">{currentFillingItem.label}</div>
                            <div className="text-[11px] leading-snug text-muted-foreground">{currentFillingItem.description}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={cancelFilling}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <span aria-hidden="true">←</span><span className="hidden sm:inline">Back to checklist</span><span className="sm:hidden">Back</span>
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
                    <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
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
                              <FluentSelect
                                ariaLabel={field.label}
                                className="w-full"
                                value={String(val || (field.defaultValue ?? ""))}
                                onChange={(value) => updateFormValue(field.name, value)}
                                options={field.options.map((opt) => ({
                                  value: opt,
                                  label:
                                    opt === "true"
                                      ? "Yes"
                                      : opt === "false"
                                        ? "No"
                                        : opt === opt.toUpperCase()
                                          ? opt
                                          : opt.replace(/_/g, " ").replace(/(^|\s)([a-z])/g, (_match, space: string, character: string) => `${space}${character.toUpperCase()}`),
                                }))}
                              />
                            ) : field.type === "file" ? (
                              <div className="mt-1 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                                <Input
                                  type="file"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null
                                    setDocumentUploadFile(file)
                                    updateFormValue(field.name, file?.name ?? "")
                                    if (file && !String(formValues.title ?? "").trim()) {
                                      updateFormValue("title", file.name.replace(/\.[^.]+$/, ""))
                                    }
                                  }}
                                  className="h-auto border-0 px-0 py-0 shadow-none focus-visible:ring-0"
                                  required={!!field.required}
                                />
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                  {documentUploadFile
                                    ? `Selected: ${documentUploadFile.name}`
                                    : certificateSection
                                      ? "Required: attach the certificate PDF or image."
                                      : "Choose the attachment to upload with this document."}
                                </p>
                              </div>
                            ) : field.type === "date" ? (
                              <DateInput
                                value={String(val ?? "")}
                                placeholder={field.placeholder}
                                onChange={(event) => updateFormValue(field.name, event.target.value)}
                                className="mt-1 h-9 rounded-md border-slate-300 bg-white text-sm focus-visible:ring-blue-400 dark:border-slate-700 dark:bg-slate-950"
                                required={!!field.required}
                              />
                            ) : (
                              <Input
                                type={field.type || "text"}
                                value={val}
                                placeholder={field.placeholder}
                                onChange={(e) => updateFormValue(field.name, e.target.value)}
                                className="mt-1 h-9 rounded-md border-slate-300 bg-white text-sm focus-visible:ring-blue-400 dark:border-slate-700 dark:bg-slate-950"
                                required={!!field.required}
                              />
                            )}
                            {field.name === "academic_certificate_document_url" || field.name === "professional_certificate_document_url" ? (
                              <p className="mt-1 text-xs text-muted-foreground">Optional. If provided, the link must use https://.</p>
                            ) : null}
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
                    <div className="mb-3 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                      Please fill required fields: {missingRequiredFields.join(", ")}
                    </div>
                  )}
                  {!hasValidCertificateProof ? (
                    <p className="mb-3 text-xs font-medium text-destructive">{documentUploadFile ? "The verification link must be a valid HTTPS URL, or leave it empty." : "Attach the certificate file to continue."}</p>
                  ) : null}

                  <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
                    <Button
                      onClick={handleSaveFilling}
                      disabled={isSaving || missingRequiredFields.length > 0 || !hasValidCertificateProof}
                      className="h-10 flex-1 rounded-lg text-sm"
                    >
                      {isSaving ? "Saving..." : "Save & mark complete"}
                    </Button>
                    <Button variant="outline" onClick={cancelFilling} disabled={isSaving} className="h-10 rounded-lg text-sm sm:w-auto">
                      Cancel
                    </Button>
                  </div>

                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    Data is stored securely for HR, payroll and compliance.
                  </p>
                    </div>
                    <aside className="border-t border-border bg-muted/30 p-4 sm:p-5 lg:border-l lg:border-t-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Before you save</p>
                      {certificateSection ? (
                        <div className="mt-3 grid gap-3 text-xs leading-relaxed text-muted-foreground">
                          <p>Enter your country of residence and the institution and qualification details shown on your certificate.</p>
                          <div className="rounded-lg border border-border bg-background p-3">
                            <p className="font-semibold text-foreground">Attach your certificate</p>
                            <p className="mt-1">The certificate file is required. A secure HTTPS verification link is optional.</p>
                          </div>
                          <p>Only add accurate information. HR may use these details for employment records and verification.</p>
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-3 text-xs leading-relaxed text-muted-foreground">
                          <p>Complete the required fields marked with an asterisk.</p>
                          <p>Your changes are saved to your employee profile and can be reviewed by HR.</p>
                        </div>
                      )}
                    </aside>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Details still needed</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Choose a section and add the information you have.</p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground sm:hidden">
                      {pendingItems.length} remaining
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {REQUIRED_ONBOARDING_ITEMS.map((item, itemIndex) => {
                    const isPending = unfilledItems.some(p => p.key === item.key)
                    if (!isPending) return null
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => startFilling(item.key)}
                        className="group flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold tabular-nums text-muted-foreground">
                          {String(itemIndex + 1).padStart(2, "0")}
                        </span>
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                            {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                            {item.label}
                            {item.optional ? (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Optional
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-muted-foreground">{item.description}</p>
                        </div>
                        <span className="shrink-0 text-lg text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary">→</span>
                      </button>
                    )
                  })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="m-0 shrink-0 border-t border-border bg-background/95 px-3 py-2 backdrop-blur sm:px-5">
              <Button 
                variant="outline"
                onClick={handleCloseOnboardingDialog} 
                className="h-9 px-4 text-sm"
              >
                Finish later
              </Button>
              {!isStillOnboarding ? (
                <Button
                  onClick={handleCloseOnboardingDialog}
                  className="h-9 px-5 text-sm"
                >
                  {fillingItemKey ? "Close" : "Continue to dashboard"}
                </Button>
              ) : null}
            </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  )
}

export type { EmployeeDashboardData }
